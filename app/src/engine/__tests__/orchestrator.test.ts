import { describe, it, expect, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { TurnOrchestrator } from '../orchestrator';
import { StorageService } from '../storage';
import { PromptComposer } from '../composer';
import { StateManager } from '../stateManager';
import { TriggerProcessor } from '../triggerProcessor';
import { LLMClient } from '../llmClient';
import { World, StoryInstance, AIOutcome, ProviderConfig } from '../types';

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
    const llmClient = new LLMClient();

    vi.spyOn(storage, 'getWorld').mockResolvedValue(mockWorld);
    vi.spyOn(storage, 'getInstance').mockResolvedValue(mockInstance);
    vi.spyOn(storage, 'saveInstance').mockResolvedValue(undefined);
    vi.spyOn(llmClient, 'call').mockResolvedValue(mockOutcome);

    const orch = new TurnOrchestrator(storage, composer, stateManager, triggerProcessor, llmClient);

    const provider: ProviderConfig = { id: 'gemini', label: 'Gemini', apiKey: 'fake', model: 'gemini-1.5-flash' };
    const result = await orch.executeTurn('w1', 'i1', { text: 'Hello' }, provider);

    expect(result.outcome.narrative).toBe('Story text');
    expect(result.updatedInstance.turnNumber).toBe(1);
    expect(result.updatedInstance.history).toHaveLength(2);
    expect(storage.saveInstance).toHaveBeenCalled();
  });
});
