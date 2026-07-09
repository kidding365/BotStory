import { describe, it, expect } from 'vitest';
import { importWorld, safeParseJson, SchemaImportError } from '../importer';

describe('Schema Importer', () => {
  it('should parse an InfiniteWorlds-style JSON', () => {
    const raw = {
      id: 'iw-1',
      title: 'Sample IW',
      description: 'A test',
      background: 'You wake up.',
      instructions: 'Play it cool.',
      authorStyle: 'noir',
      firstInput: 'Look around.',
      objective: 'Survive.',
      skills: ['Wits', 'Courage'],
      possibleCharacters: [
        { characterId: 'pc1', name: 'Detective', description: 'Trench coat.', skills: { Wits: 3 } },
      ],
      trackedItems: [
        {
          id: 'hp',
          name: 'HP',
          dataType: 'number',
          visibility: 'everyone',
          description: 'Health',
          updateInstructions: 'Lose hp when hurt',
          initialValue: 10,
        },
        {
          id: 'notes',
          name: 'Notes',
          dataType: 'text',
          visibility: 'ai_only',
          description: 'Detective notes',
          updateInstructions: 'Add new clues',
          initialValue: '',
        },
      ],
      instructionBlocks: [
        { id: 'block1', name: 'Mood', content: 'Rainy night.' },
      ],
      loreBookEntries: [
        { id: 'l1', name: 'Case', keywords: ['case', 'file'], content: 'The file is missing.' },
      ],
      triggerEvents: [
        {
          id: 'find_file',
          name: 'Find File',
          triggerConditions: [{ type: 'triggerOnEvent', data: 'I find the file' }],
          triggerEffects: [
            { type: 'effectSetTrackedItemValue', data: { trackedItemID: 'hp', newValue: 9 } },
            { type: 'effectShowMessage', data: 'You found the missing file!' },
          ],
        },
      ],
      victoryCondition: { condition: 'solved', text: 'Case closed' },
      defeatCondition: { condition: 'died', text: 'You died' },
      mature: false,
      nsfw: false,
    };
    const { world, warnings } = importWorld(raw);
    expect(world.id).toBe('iw-1');
    expect(world.title).toBe('Sample IW');
    expect(world.source).toBe('infiniteworlds');
    expect(world.trackedItems).toHaveLength(2);
    expect(world.trackedItems[0].dataType).toBe('number');
    expect(world.trackedItems[1].dataType).toBe('text');
    expect(world.instructionBlocks).toHaveLength(1);
    expect(world.loreBookEntries[0].keywords).toEqual(['case', 'file']);
    expect(world.triggerEvents[0].triggerEffects[0].type).toBe('effectSetTrackedItemValue');
    expect(warnings).toEqual([]);
  });

  it('should reject non-objects', () => {
    expect(() => importWorld(null)).toThrow(SchemaImportError);
    expect(() => importWorld('hello')).toThrow(SchemaImportError);
    expect(() => importWorld([])).toThrow(SchemaImportError);
  });

  it('should provide default skills when missing', () => {
    const { world } = importWorld({ id: 'x', title: 'X' });
    expect(world.skills.length).toBeGreaterThan(0);
  });

  it('should warn when instructions are empty', () => {
    const { warnings } = importWorld({ id: 'x', title: 'X', instructions: '' });
    expect(warnings.some((w) => w.includes('instructions'))).toBe(true);
  });

  it('should normalize data type strings from IW casing', () => {
    const { world } = importWorld({
      id: 'x',
      title: 'X',
      trackedItems: [
        { id: 'a', name: 'A', dataType: 'Number', visibility: 'everyone', description: '', updateInstructions: '', initialValue: 5 },
        { id: 'b', name: 'B', dataType: 'XML', visibility: 'everyone', description: '', updateInstructions: '', initialValue: '<x/>' },
      ],
    });
    expect(world.trackedItems[0].dataType).toBe('number');
    expect(world.trackedItems[1].dataType).toBe('xml');
  });

  it('safeParseJson should return error on invalid JSON', () => {
    const r = safeParseJson('{not valid');
    expect(r.error).toBeDefined();
  });
});
