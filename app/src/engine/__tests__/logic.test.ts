import { describe, it, expect } from 'vitest';
import { stateManager } from '../stateManager';
import { triggerProcessor } from '../triggerProcessor';
import { World, StoryInstance, AIOutcome } from '../types';

describe('Game Logic Integration', () => {
  const mockWorld: World = {
    id: 'w1',
    title: 'Test World',
    name: 'Test World',
    description: '',
    background: '',
    instructions: '',
    authorStyle: '',
    objective: '',
    mature: false,
    nsfw: false,
    skills: ['Wits'],
    possibleCharacters: [],
    triggerEvents: [
      {
        id: 'find_gold',
        name: 'Find Gold',
        triggerConditions: [{ type: 'triggerOnEvent', data: 'found_treasure' }],
        triggerEffects: [
          { type: 'effectSetTrackedItemValue', data: { action: 'set', newValue: 100, trackedItemID: 'gold' } },
          { type: 'effectShowMessage', data: 'You found 100 gold!' },
          { type: 'effectModifyInstructionBlock', data: { id: 'quest', content: 'Now you are rich!' } },
        ],
      },
    ],
    victoryCondition: { condition: '', text: '', alreadyFired: false },
    defeatCondition: { condition: '', text: '', alreadyFired: false },
    instructionBlocks: [{ id: 'quest', name: 'Quest', content: 'Initial Quest', isActive: true }],
    loreBookEntries: [],
    trackedItems: [
      {
        id: 'gold',
        name: 'Gold',
        dataType: 'number',
        visibility: 'everyone',
        description: '',
        updateInstructions: '',
        initialValue: 0,
      },
    ],
  };

  const mockInstance: StoryInstance = {
    id: 'i1',
    worldId: 'w1',
    characterId: null,
    currentValues: { gold: 0 },
    modifiedBlocks: {},
    firedTriggers: [],
    turnNumber: 1,
    history: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it('should update state and fire triggers based on AI outcome', () => {
    const outcome: AIOutcome = {
      reasoning: 'User finds treasure',
      narrative: 'You open the chest...',
      stateUpdates: { gold: 100 },
      visualVariables: {},
      suggestedActions: [],
      triggeredEvents: ['found_treasure'],
    };

    const stateUpdatedInstance = stateManager.applyStateUpdates(mockInstance, outcome, mockWorld);
    expect(stateUpdatedInstance.currentValues.gold).toBe(100);

    const { updatedInstance, messages } = triggerProcessor.processTriggers(mockWorld, stateUpdatedInstance, outcome);

    expect(updatedInstance.currentValues.gold).toBe(100);
    expect(messages).toContain('You found 100 gold!');
    expect(updatedInstance.modifiedBlocks.quest).toBe('Now you are rich!');
    expect(updatedInstance.firedTriggers).toContain('find_gold');
  });

  it('should not fire the same trigger twice', () => {
    const instance: StoryInstance = { ...mockInstance, firedTriggers: ['find_gold'] };
    const outcome: AIOutcome = {
      narrative: '...',
      stateUpdates: {},
      visualVariables: {},
      suggestedActions: [],
      triggeredEvents: ['found_treasure'],
    };
    const r = triggerProcessor.processTriggers(mockWorld, instance, outcome);
    expect(r.firedTriggerIds).not.toContain('find_gold');
  });

  it('should respect data type when applying state updates', () => {
    const instance = { ...mockInstance, currentValues: { gold: 0 } };
    const outcome: AIOutcome = {
      narrative: '...',
      stateUpdates: { gold: '50' as unknown as number },
      visualVariables: {},
      suggestedActions: [],
      triggeredEvents: [],
    };
    const r = stateManager.applyStateUpdates(instance, outcome, mockWorld);
    expect(r.currentValues.gold).toBe(50);
  });
});
