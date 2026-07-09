import { describe, it, expect } from 'vitest';
import { composer } from '../composer';
import { World, StoryInstance, UserAction } from '../types';

describe('PromptComposer', () => {
  const mockWorld: World = {
    id: 'w1',
    title: 'Test World',
    name: 'Test World',
    description: '',
    background: '',
    instructions: 'Global rules apply.',
    authorStyle: 'a masterful novelist',
    objective: '',
    mature: false,
    nsfw: false,
    skills: ['Wits'],
    possibleCharacters: [
      { characterId: 'pc1', name: 'Aria', description: 'A mage.', skills: { Wits: 3 } },
    ],
    triggerEvents: [],
    victoryCondition: { condition: '', text: 'End', alreadyFired: false },
    defeatCondition: { condition: '', text: 'Dead', alreadyFired: false },
    instructionBlocks: [
      { id: 'quest', name: 'Quest', content: 'You are on a quest for the ring.', isActive: true },
      { id: 'hidden', name: 'Hidden', content: 'Secret info.', isActive: false },
    ],
    loreBookEntries: [
      { id: 'ring', name: 'Ring', keywords: ['ring', 'jewelry'], content: 'The ring is ancient and evil.' },
    ],
    trackedItems: [],
  };

  const mockInstance: StoryInstance = {
    id: 'i1',
    worldId: 'w1',
    characterId: 'pc1',
    currentValues: {},
    modifiedBlocks: {
      quest: 'You have found the ring and are now fleeing.',
    },
    firedTriggers: [],
    turnNumber: 1,
    history: [
      { role: 'user', content: 'Hello!', timestamp: Date.now() },
      { role: 'assistant', content: 'Welcome traveler.', timestamp: Date.now() },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it('should include global instructions and modified blocks', () => {
    const action: UserAction = { text: 'I look around' };
    const prompt = composer.buildUserPrompt(mockWorld, mockInstance, action);

    expect(prompt).toContain('Global rules apply.');
    expect(prompt).toContain('You have found the ring and are now fleeing.');
    expect(prompt).not.toContain('Secret info.');
  });

  it('should inject lore when keywords are present', () => {
    const action: UserAction = { text: 'Tell me about the ring' };
    const prompt = composer.buildUserPrompt(mockWorld, mockInstance, action);

    expect(prompt).toContain('The ring is ancient and evil.');
  });

  it('should include recent history', () => {
    const action: UserAction = { text: 'I walk forward' };
    const prompt = composer.buildUserPrompt(mockWorld, mockInstance, action);

    expect(prompt).toContain('Aria: Hello!');
    expect(prompt).toContain('Storyteller: Welcome traveler.');
  });

  it('should mention character skills', () => {
    const action: UserAction = { text: 'I act' };
    const prompt = composer.buildUserPrompt(mockWorld, mockInstance, action);
    expect(prompt).toContain('Wits');
    expect(prompt).toContain('Aria');
  });
});
