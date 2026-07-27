import { describe, it, expect } from 'vitest';
import { VictoryDefeatProcessor } from '../victoryDefeatProcessor';
import { World, StoryInstance, AIOutcome } from '../types';

function worldWith(victory: string, defeat: string): World {
  return {
    id: 'w1',
    title: 'Test',
    name: 'Test',
    description: '',
    background: '',
    instructions: '',
    authorStyle: '',
    objective: '',
    mature: false,
    nsfw: false,
    skills: [],
    possibleCharacters: [],
    triggerEvents: [],
    victoryCondition: { condition: victory, text: 'You win!' },
    defeatCondition: { condition: defeat, text: 'You lose.' },
    instructionBlocks: [],
    loreBookEntries: [],
    trackedItems: [
      { id: 'hp', name: 'Health', dataType: 'number', visibility: 'everyone', description: '', updateInstructions: '', initialValue: 10 },
      { id: 'flag', name: 'Flag', dataType: 'text', visibility: 'everyone', description: '', updateInstructions: '', initialValue: 'no' },
    ],
  };
}

function baseInstance(values: Record<string, string | number>): StoryInstance {
  return {
    id: 'i1',
    worldId: 'w1',
    characterId: null,
    currentValues: values,
    modifiedBlocks: {},
    firedTriggers: [],
    turnNumber: 5,
    history: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

const outcome = (override: Partial<AIOutcome> = {}): AIOutcome => ({
  reasoning: '',
  narrative: '',
  stateUpdates: {},
  visualVariables: {},
  suggestedActions: [],
  triggeredEvents: [],
  ...override,
});

describe('VictoryDefeatProcessor', () => {
  it('fires defeat when tracked item matches the JSON DSL value (number)', () => {
    const proc = new VictoryDefeatProcessor();
    const world = worldWith('Free text victory condition.', '{"trackedItemID":"hp","value":0}');
    const inst = baseInstance({ hp: 0 });
    const result = proc.process(world, inst, outcome());
    expect(result.ended).toBe(true);
    expect(result.endMessage).toBe('You lose.');
    expect(result.updatedInstance.firedTriggerOutcomes?.defeat).toBe(true);
    expect(result.updatedInstance.firedTriggerOutcomes?.victory).toBeUndefined();
  });

  it('fires victory when tracked text item matches the JSON DSL value (string)', () => {
    const proc = new VictoryDefeatProcessor();
    const world = worldWith('{"trackedItemID":"flag","value":"yes"}', 'Free text defeat condition.');
    const inst = baseInstance({ flag: 'yes' });
    const result = proc.process(world, inst, outcome());
    expect(result.ended).toBe(true);
    expect(result.endMessage).toBe('You win!');
    expect(result.updatedInstance.firedTriggerOutcomes?.victory).toBe(true);
  });

  it('does not fire on non-matching values', () => {
    const proc = new VictoryDefeatProcessor();
    const world = worldWith('{"trackedItemID":"flag","value":"yes"}', '{"trackedItemID":"hp","value":0}');
    const inst = baseInstance({ hp: 7, flag: 'no' });
    const result = proc.process(world, inst, outcome());
    expect(result.ended).toBe(false);
    expect(result.updatedInstance.firedTriggerOutcomes).toBeUndefined();
  });

  it('fires victory when outcome.evaluation === SUCCESS', () => {
    const proc = new VictoryDefeatProcessor();
    const world = worldWith('Free text victory condition.', 'Free text defeat condition.');
    const inst = baseInstance({ hp: 10 });
    const result = proc.process(world, inst, outcome({ evaluation: 'SUCCESS' }));
    expect(result.ended).toBe(true);
    expect(result.endMessage).toBe('You win!');
  });

  it('fires defeat when outcome.evaluation === FAILURE', () => {
    const proc = new VictoryDefeatProcessor();
    const world = worldWith('Free text victory condition.', 'Free text defeat condition.');
    const inst = baseInstance({ hp: 10 });
    const result = proc.process(world, inst, outcome({ evaluation: 'FAILURE' }));
    expect(result.ended).toBe(true);
    expect(result.endMessage).toBe('You lose.');
  });

  it('does not re-fire after already fired', () => {
    const proc = new VictoryDefeatProcessor();
    const world = worldWith('Free text victory condition.', '{"trackedItemID":"hp","value":0}');
    const inst = baseInstance({ hp: 0, flag: 'no' });
    inst.firedTriggerOutcomes = { defeat: true };
    const result = proc.process(world, inst, outcome());
    expect(result.ended).toBe(false);
  });

  it('ignores malformed JSON condition strings', () => {
    const proc = new VictoryDefeatProcessor();
    const world = worldWith('{ not json', 'Random prose with no meaning.');
    const inst = baseInstance({ hp: 10 });
    const result = proc.process(world, inst, outcome());
    expect(result.ended).toBe(false);
  });
});
