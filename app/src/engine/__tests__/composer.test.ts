import { describe, it, expect } from 'vitest';
import { composer } from '../composer';
import { applyPreset } from '../imageStylePresets';
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

  describe('buildImagePrompt preset routing', () => {
    it('routes a character-flagged visual scene through the Character Pre+subject+appearance+expression+Character Post template', () => {
      const w = applyPreset({ ...mockWorld }, 'anime');
      const prompt = composer.buildImagePrompt(
        w,
        mockInstance,
        { subject: 'Aria Silverleaf', appearance: 'silver hair', expression: 'curious', isCharacter: 'true' }
      );
      // Pre wraps the subject
      expect(prompt.startsWith('Anime illustration of')).toBe(true);
      // Subject + appearance + expression all included
      expect(prompt).toContain('Aria Silverleaf');
      expect(prompt).toContain('silver hair');
      expect(prompt).toContain('curious');
      // Post wraps them
      expect(prompt).toContain('IWAnime');
      expect(prompt).toContain('Looking at the viewer');
    });

    it('routes a non-character visual scene through the NonCharacter Pre+subject+setting+appearance+NonCharacter Post template', () => {
      const w = applyPreset({ ...mockWorld }, 'photorealistic-1');
      const prompt = composer.buildImagePrompt(
        w,
        mockInstance,
        { subject: 'shoreline', setting: 'dawn', appearance: 'glittering sand', isCharacter: 'false' }
      );
      expect(prompt.startsWith('Photograph of')).toBe(true);
      expect(prompt).toContain('shoreline');
      expect(prompt).toContain('dawn');
      expect(prompt).toContain('glittering sand');
      expect(prompt).toContain('High quality photograph');
    });

    it('passes the bare visualVariables straight to the model when no preset is applied (the flat-infographic baseline)', () => {
      const w = applyPreset({ ...mockWorld }, 'none');
      const prompt = composer.buildImagePrompt(
        w,
        mockInstance,
        { subject: 'A curious, beachcombing Wanderer, standing on a small, isolated beach at dawn', setting: '', appearance: '', isCharacter: 'false' }
      );
      // No Pre/Post padding — exactly the LLM-authored scene description
      expect(prompt).toBe('A curious, beachcombing Wanderer, standing on a small, isolated beach at dawn');
    });

    it('a hand-customised world preserves its custom Pre/Post over preset-routing', () => {
      const w: World = {
        ...mockWorld,
        imageStyleCharacterPre: 'oil painting of',
        imageStyleCharacterPost: 'in the cubist style',
        imageStyleNonCharacterPre: '',
        imageStyleNonCharacterPost: '',
      };
      const prompt = composer.buildImagePrompt(
        w,
        mockInstance,
        { subject: 'a man', appearance: 'wearing a hat', expression: 'averted', isCharacter: 'true' }
      );
      expect(prompt.startsWith('oil painting of')).toBe(true);
      expect(prompt).toContain('in the cubist style');
    });
  });
});
