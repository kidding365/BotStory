import { describe, it, expect } from 'vitest';
import { Summarizer, SUMMARY_DEFAULTS } from '../summarizer';
import { TextClient } from '../textClient';
import { World, StoryInstance, AIOutcome, TextProviderConfig } from '../types';

class FakeTextClient extends TextClient {
  calls: { system: string; user: string }[] = [];
  constructor(private next: AIOutcome) { super(); }
  async call(_c: TextProviderConfig, system: string, user: string): Promise<AIOutcome> {
    this.calls.push({ system, user });
    return this.next;
  }
}

function world(): World {
  return {
    id: 'w1', title: 'T', name: 'T', description: '', background: '', instructions: '',
    authorStyle: '', objective: '', mature: false, nsfw: false,
    skills: [], possibleCharacters: [], triggerEvents: [],
    victoryCondition: { condition: '', text: '' },
    defeatCondition: { condition: '', text: '' },
    instructionBlocks: [], loreBookEntries: [], trackedItems: [],
  };
}

function instance(turn: number, historyLength: number): StoryInstance {
  const history = Array.from({ length: historyLength }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `turn ${Math.floor(i / 2) + 1} ${i % 2 === 0 ? 'action' : 'narrative'}`,
    timestamp: i,
  }));
  return {
    id: 'i1', worldId: 'w1', characterId: null, currentValues: {}, modifiedBlocks: {},
    firedTriggers: [], turnNumber: turn, history, createdAt: 0, updatedAt: 0,
    summary: undefined, summaryTurn: undefined,
  };
}

describe('Summarizer', () => {
  it('does not run before the configured start turn', () => {
    const s = new Summarizer();
    expect(s.shouldSummarise(world(), instance(0, 0))).toBe(false);
    expect(s.shouldSummarise(world(), instance(SUMMARY_DEFAULTS.startTurn - 1, 2))).toBe(false);
  });

  it('runs on the start turn and every "every" turns thereafter', () => {
    const s = new Summarizer();
    expect(s.shouldSummarise(world(), instance(SUMMARY_DEFAULTS.startTurn, 10))).toBe(true);
    const w = world();
    const i = instance(SUMMARY_DEFAULTS.startTurn, 10);
    i.summaryTurn = SUMMARY_DEFAULTS.startTurn;
    expect(s.shouldSummarise(w, i)).toBe(false);
    i.turnNumber = SUMMARY_DEFAULTS.startTurn + SUMMARY_DEFAULTS.every;
    expect(s.shouldSummarise(w, i)).toBe(true);
  });

  it('run() calls the text client and stores the new summary + turn', async () => {
    const s = new Summarizer();
    const fake = new FakeTextClient({
      reasoning: '', narrative: 'The player fought a wraith and won.', stateUpdates: {},
      visualVariables: {}, suggestedActions: [], triggeredEvents: [],
    });
    const tp: TextProviderConfig = { id: 'gemini', label: 'Gemini', apiKey: 'k', model: 'm' };
    const result = await s.run(world(), instance(8, 16), tp, { client: fake });
    expect(fake.calls).toHaveLength(1);
    expect(result.summary).toContain('wraith');
    expect(result.summaryTurn).toBe(8);
    expect(fake.calls[0].user).toContain('RECENT HISTORY');
  });

  it('respects world.summarizationInstructions in the system prompt', async () => {
    const s = new Summarizer();
    const fake = new FakeTextClient({
      reasoning: '', narrative: 'sum', stateUpdates: {}, visualVariables: {},
      suggestedActions: [], triggeredEvents: [],
    });
    const w = world();
    w.summarizationInstructions = 'Record clues about the murder in detail.';
    await s.run(w, instance(8, 16), { id: 'gemini', label: 'Gemini', apiKey: 'k', model: 'm' }, { client: fake });
    expect(fake.calls[0].system).toContain('Record clues about the murder in detail.');
  });

  it('returns instance unchanged when no API key is configured', async () => {
    const s = new Summarizer();
    const fake = new FakeTextClient({
      reasoning: '', narrative: 'should not be used', stateUpdates: {}, visualVariables: {},
      suggestedActions: [], triggeredEvents: [],
    });
    const tp: TextProviderConfig = { id: 'gemini', label: 'Gemini', apiKey: '', model: 'm' };
    const before = instance(8, 16);
    const result = await s.run(world(), before, tp, { client: fake });
    expect(result).toBe(before);
    expect(fake.calls).toHaveLength(0);
  });

  it('incorporates the prior summary into the next summary user prompt', async () => {
    const s = new Summarizer();
    const fake = new FakeTextClient({
      reasoning: '', narrative: 'updated running summary', stateUpdates: {},
      visualVariables: {}, suggestedActions: [], triggeredEvents: [],
    });
    const i = instance(14, 16);
    i.summary = 'Prior context: met the wizard.';
    i.summaryTurn = 8;
    await s.run(world(), i, { id: 'gemini', label: 'Gemini', apiKey: 'k', model: 'm' }, { client: fake });
    expect(fake.calls[0].user).toContain('Prior context: met the wizard.');
    expect(fake.calls[0].user).toContain('PREVIOUS SUMMARY (turns 1–8)');
  });

  it('caps summary length', async () => {
    const s = new Summarizer();
    const longText = 'x'.repeat(SUMMARY_DEFAULTS.maxSummaryChars * 2);
    const fake = new FakeTextClient({
      reasoning: '', narrative: longText, stateUpdates: {}, visualVariables: {},
      suggestedActions: [], triggeredEvents: [],
    });
    const result = await s.run(world(), instance(8, 16), {
      id: 'gemini', label: 'Gemini', apiKey: 'k', model: 'm',
    }, { client: fake });
    expect(result.summary!.length).toBeLessThanOrEqual(SUMMARY_DEFAULTS.maxSummaryChars);
  });
});
