import { describe, it, expect, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { TurnOrchestrator } from '../orchestrator';
import { StorageService } from '../storage';
import { PromptComposer } from '../composer';
import { StateManager } from '../stateManager';
import { TriggerProcessor } from '../triggerProcessor';
import { VictoryDefeatProcessor } from '../victoryDefeatProcessor';
import { Summarizer } from '../summarizer';
import { TextClient } from '../textClient';
import { ImageClient } from '../imageClient';
import { World, StoryInstance, AIOutcome, TextProviderConfig, ImageProviderConfig } from '../types';

class FakeTextClient extends TextClient {
  constructor(private next: AIOutcome) { super(); }
  async call(): Promise<AIOutcome> { return this.next; }
}

const TP = { id: 'gemini', label: 'Gemini', apiKey: 'k', model: 'm' } as TextProviderConfig;
const IP = { id: 'none', label: 'Off', apiKey: '', model: '' } as ImageProviderConfig;

function worldWith(opts: { victory?: string; defeat?: string; trackedItems?: World['trackedItems'] }): World {
  return {
    id: 'w-fixtures',
    title: 'T', name: 'T', description: '', background: '', instructions: '', authorStyle: '',
    objective: '', mature: false, nsfw: false, skills: [], possibleCharacters: [], triggerEvents: [],
    victoryCondition: { condition: opts.victory || '', text: 'Victory text' },
    defeatCondition: { condition: opts.defeat || '', text: 'Defeat text' },
    instructionBlocks: [], loreBookEntries: [],
    trackedItems: opts.trackedItems || [],
  };
}

function instance(id: string, currentValues: Record<string, string | number>): StoryInstance {
  return {
    id, worldId: 'w-fixtures', characterId: null,
    currentValues, modifiedBlocks: {}, firedTriggers: [],
    turnNumber: 0, history: [], createdAt: Date.now(), updatedAt: Date.now(),
  };
}

describe('TurnOrchestrator', () => {
  it('should coordinate a full turn sequence', async () => {
    const mockWorld: World = {
      id: 'w1',
      title: 'Test',
      name: 'Test',
      description: '',
      background: '',
      instructions: 'Rules',
      authorStyle: '',
      objective: '',
      mature: false,
      nsfw: false,
      skills: [],
      possibleCharacters: [],
      triggerEvents: [],
      victoryCondition: { condition: '', text: '', alreadyFired: false },
      defeatCondition: { condition: '', text: '', alreadyFired: false },
      instructionBlocks: [],
      loreBookEntries: [],
      trackedItems: [],
    };

    const mockInstance: StoryInstance = {
      id: 'i1',
      worldId: 'w1',
      characterId: null,
      currentValues: {},
      modifiedBlocks: {},
      firedTriggers: [],
      turnNumber: 0,
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockOutcome: AIOutcome = {
      reasoning: 'Logic',
      narrative: 'Story text',
      stateUpdates: {},
      visualVariables: {},
      suggestedActions: [],
      triggeredEvents: [],
    };

    const storage = new StorageService();
    const composer = new PromptComposer();
    const stateManager = new StateManager();
    const triggerProcessor = new TriggerProcessor();
    const victoryDefeatProcessor = new VictoryDefeatProcessor();
    const textClient = new TextClient();
    const imageClient = new ImageClient();

    vi.spyOn(storage, 'getWorld').mockResolvedValue(mockWorld);
    vi.spyOn(storage, 'getInstance').mockResolvedValue(mockInstance);
    vi.spyOn(storage, 'saveInstance').mockResolvedValue(undefined);
    vi.spyOn(textClient, 'call').mockResolvedValue(mockOutcome);
    vi.spyOn(imageClient, 'generate').mockResolvedValue(null);

    const orch = new TurnOrchestrator(storage, composer, stateManager, triggerProcessor, victoryDefeatProcessor, new Summarizer(), textClient, imageClient);

    const textProvider: TextProviderConfig = { id: 'gemini', label: 'Gemini', apiKey: 'fake', model: 'gemini-1.5-flash' };
    const imageProvider: ImageProviderConfig = { id: 'none', label: 'Off', apiKey: '', model: '' };
    const result = await orch.executeTurn('w1', 'i1', { text: 'Hello' }, textProvider, imageProvider);

    expect(result.outcome.narrative).toBe('Story text');
    expect(result.updatedInstance.turnNumber).toBe(1);
    expect(result.updatedInstance.history).toHaveLength(2);
    expect(storage.saveInstance).toHaveBeenCalled();
  });

  it('persists lastSnapshot and uses restore on regenerate (real storage)', async () => {
    const world = worldWith({
      trackedItems: [{ id: 'hp', name: 'Health', dataType: 'number', visibility: 'everyone', description: '', updateInstructions: '', initialValue: 10 }],
    });
    const storage = new StorageService();
    await storage.saveWorld(world);
    await storage.saveInstance(instance('snap-inst', { hp: 10 }));

    const fall: AIOutcome = { reasoning: '', narrative: 'You fall.', stateUpdates: { hp: 0 }, visualVariables: {}, suggestedActions: [], triggeredEvents: [] };
    const stand: AIOutcome = { reasoning: '', narrative: 'You stand.', stateUpdates: {}, visualVariables: {}, suggestedActions: [], triggeredEvents: [] };

    const textClient = new FakeTextClient(fall);
    const imageClient = new ImageClient();
    const orch = new TurnOrchestrator(storage, new PromptComposer(), new StateManager(), new TriggerProcessor(), new VictoryDefeatProcessor(), new Summarizer(), textClient, imageClient);
    vi.spyOn(imageClient, 'generate').mockResolvedValue(null);

    const first = await orch.executeTurn('w-fixtures', 'snap-inst', { text: 'fight' }, TP, IP);
    const afterFirst = await storage.getInstance('snap-inst');
    expect(afterFirst?.currentValues.hp).toBe(0);
    expect(afterFirst?.turnNumber).toBe(1);
    expect(afterFirst?.history).toHaveLength(2);
    expect(afterFirst?.lastSnapshot?.currentValues.hp).toBe(10);
    expect(afterFirst?.lastSnapshot?.historyLength).toBe(0);
    expect(first.updatedInstance.lastSnapshot?.currentValues.hp).toBe(10);

    // Swap to the "you stand" outcome for the regenerated turn
    (textClient as unknown as { next: AIOutcome }).next = stand;
    await orch.regenerateLastTurn('w-fixtures', 'snap-inst', TP, IP);

    const restored = await storage.getInstance('snap-inst');
    expect(restored?.turnNumber).toBe(1); // executeTurn ran again
    expect(restored?.currentValues.hp).toBe(10); // snapshot restored pre-turn hp
    expect(restored?.history).toHaveLength(2); // one full turn pair after restore
  });

  it('fires a JSON-DSL victory condition and ends the turn', async () => {
    const world = worldWith({
      victory: '{"trackedItemID":"flag","value":"yes"}',
      trackedItems: [{ id: 'flag', name: 'Flag', dataType: 'text', visibility: 'everyone', description: '', updateInstructions: '', initialValue: 'no' }],
    });
    const storage = new StorageService();
    await storage.saveWorld(world);
    await storage.saveInstance(instance('v-inst', { flag: 'no' }));

    const raise: AIOutcome = { reasoning: '', narrative: 'You raise the flag.', stateUpdates: { flag: 'yes' }, visualVariables: {}, suggestedActions: [], triggeredEvents: [] };
    const textClient = new FakeTextClient(raise);
    const imageClient = new ImageClient();
    const orch = new TurnOrchestrator(storage, new PromptComposer(), new StateManager(), new TriggerProcessor(), new VictoryDefeatProcessor(), new Summarizer(), textClient, imageClient);
    vi.spyOn(imageClient, 'generate').mockResolvedValue(null);

    const r = await orch.executeTurn('w-fixtures', 'v-inst', { text: 'raise flag' }, TP, IP);
    expect(r.updatedInstance.ended).toBe(true);
    expect(r.updatedInstance.endMessage).toBe('Victory text');
    expect(r.updatedInstance.firedTriggerOutcomes?.victory).toBe(true);
  });
});

