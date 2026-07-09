import { World, TrackedItem, InstructionBlock, LoreBookEntry, TriggerEvent } from './types';

export interface ImportResult {
  world: World;
  warnings: string[];
}

export class SchemaImportError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'SchemaImportError';
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : fallback;
}

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function normalizeDataType(v: unknown): TrackedItem['dataType'] {
  if (v === 'Number' || v === 'number') return 'number';
  if (v === 'XML' || v === 'xml') return 'xml';
  return 'text';
}

function normalizeVisibility(v: unknown): TrackedItem['visibility'] {
  if (v === 'ai_only' || v === 'ai') return 'ai_only';
  if (v === 'player_only' || v === 'player') return 'player_only';
  return 'everyone';
}

function normalizeConditionType(v: unknown): TriggerEvent['triggerConditions'][number]['type'] {
  switch (v) {
    case 'triggerOnEvent':
    case 'triggerOnTurn':
    case 'triggerOnItemValue':
    case 'triggerOnRandomChance':
      return v;
    default:
      return 'triggerOnEvent';
  }
}

function normalizeEffectType(v: unknown): TriggerEvent['triggerEffects'][number]['type'] {
  switch (v) {
    case 'effectShowMessage':
    case 'effectSetTrackedItemValue':
    case 'effectModifyInstructionBlock':
    case 'effectEndGame':
      return v;
    default:
      return 'effectShowMessage';
  }
}

export function importWorld(raw: unknown): ImportResult {
  if (!isObject(raw)) {
    throw new SchemaImportError('Imported value must be a JSON object.');
  }

  const warnings: string[] = [];

  const title =
    asString(raw.title) || asString(raw.name) || asString(raw.id) || 'Untitled World';
  const id =
    asString(raw.id) ||
    asString(raw.worldId) ||
    `world_${Date.now().toString(36)}`;

  const trackedItems: TrackedItem[] = asArray<Record<string, unknown>>(raw.trackedItems).map(
    (t, idx) => {
      const valueRaw = t.initialValue;
      const dt = normalizeDataType(t.dataType);
      const value =
        dt === 'number' && typeof valueRaw === 'string' && valueRaw.trim() !== ''
          ? Number(valueRaw)
          : (valueRaw as string | number) ?? (dt === 'number' ? 0 : '');
      return {
        id: asString(t.id, `ti_${idx}`),
        name: asString(t.name, `Tracked Item ${idx + 1}`),
        positionInList: asNumber(t.positionInList, idx),
        dataType: dt,
        visibility: normalizeVisibility(t.visibility),
        description: asString(t.description),
        updateInstructions: asString(t.updateInstructions),
        initialValue: value,
        initialValueBasedOnPC: asString(t.initialValueBasedOnPC, 'same') as TrackedItem['initialValueBasedOnPC'],
        autoUpdate: asBool(t.autoUpdate, true),
      };
    }
  );

  if (trackedItems.length === 0 && Array.isArray(raw.trackedItems) === false) {
    warnings.push('No trackedItems field found; defaulting to empty list.');
  }

  const instructionBlocks: InstructionBlock[] = asArray<Record<string, unknown>>(
    raw.instructionBlocks
  ).map((b, idx) => ({
    id: asString(b.id, `block_${idx}`),
    name: asString(b.name, `Block ${idx + 1}`),
    content: asString(b.content),
    keywords: Array.isArray(b.keywords) ? (b.keywords as string[]) : undefined,
    isActive: true,
  }));

  const loreBookEntries: LoreBookEntry[] = asArray<Record<string, unknown>>(
    raw.loreBookEntries
  ).map((l, idx) => ({
    id: asString(l.id, `lore_${idx}`),
    name: asString(l.name, `Lore ${idx + 1}`),
    content: asString(l.content),
    keywords: asArray<string>(l.keywords).map((k) => String(k).toLowerCase()),
  }));

  const triggerEvents: TriggerEvent[] = asArray<Record<string, unknown>>(
    raw.triggerEvents
  ).map((t, idx) => {
    const conditions = asArray<Record<string, unknown>>(t.triggerConditions).map((c) => ({
      id: asString(c.id),
      type: normalizeConditionType(c.type),
      category: (asString(c.category, 'condition') as 'condition'),
      data: typeof c.data === 'string' ? c.data : JSON.stringify(c.data ?? ''),
    }));
    const effects = asArray<Record<string, unknown>>(t.triggerEffects).map((e) => {
      let data: string | Record<string, unknown> = '';
      if (typeof e.data === 'string') {
        data = e.data;
      } else if (isObject(e.data)) {
        data = e.data as Record<string, unknown>;
      } else {
        data = String(e.data ?? '');
      }
      return {
        id: asString(e.id),
        type: normalizeEffectType(e.type),
        data,
      };
    });
    return {
      id: asString(t.id, `trigger_${idx}`),
      name: asString(t.name, `Trigger ${idx + 1}`),
      triggerConditions: conditions,
      triggerEffects: effects,
    };
  });

  const skills = asArray<string>(raw.skills).length
    ? (raw.skills as string[])
    : ['Strength', 'Dexterity', 'Intelligence', 'Charisma'];

  const world: World = {
    id,
    title,
    name: title,
    description: asString(raw.description),
    background: asString(raw.background),
    instructions: asString(raw.instructions),
    authorStyle: asString(raw.authorStyle, 'a masterful novelist'),
    recommendedAIModel: asString(raw.recommendedAIModel),
    firstInput: asString(raw.firstInput) || asString(raw.startingAction),
    objective: asString(raw.objective),
    imageModel: asString(raw.imageModel),
    imageStyle: raw.imageStyle == null ? null : asString(raw.imageStyle),
    illustrationStyleNonCharacterLowPriority: asString(raw.illustrationStyleNonCharacterLowPriority),
    illustrationStyleNonCharacterHighPriority: asString(raw.illustrationStyleNonCharacterHighPriority),
    illustrationStyleCharacterLowPriority: asString(raw.illustrationStyleCharacterLowPriority),
    illustrationStyleCharacterHighPriority: asString(raw.illustrationStyleCharacterHighPriority),
    imageStyleCharacterPre: asString(raw.imageStyleCharacterPre),
    imageStyleCharacterPost: asString(raw.imageStyleCharacterPost),
    imageStyleNonCharacterPre: asString(raw.imageStyleNonCharacterPre),
    imageStyleNonCharacterPost: asString(raw.imageStyleNonCharacterPost),
    mature: asBool(raw.mature, false),
    nsfw: asBool(raw.nsfw, false),
    contentWarnings: asString(raw.contentWarnings),
    enableAISpecificInstructionBlocks: asBool(raw.enableAISpecificInstructionBlocks, false),
    previewImage: asString(raw.previewImage),
    fullSizePreviewImage: asString(raw.fullSizePreviewImage),
    skills,
    possibleCharacters: asArray<Record<string, unknown>>(raw.possibleCharacters).map((c, i) => ({
      name: asString(c.name, `Character ${i + 1}`),
      description: asString(c.description),
      portrait: asString(c.portrait),
      fullSizePortrait: asString(c.fullSizePortrait),
      characterId: asString(c.characterId, `char_${i}`),
      skills: isObject(c.skills) ? (c.skills as Record<string, number>) : {},
      initialTrackedItemValues: isObject(c.initialTrackedItemValues)
        ? (c.initialTrackedItemValues as Record<string, string | number>)
        : undefined,
    })),
    triggerEvents,
    victoryCondition: isObject(raw.victoryCondition)
      ? {
          condition: asString((raw.victoryCondition as Record<string, unknown>).condition),
          text: asString((raw.victoryCondition as Record<string, unknown>).text),
          alreadyFired: false,
        }
      : { condition: '', text: 'The End', alreadyFired: false },
    defeatCondition: isObject(raw.defeatCondition)
      ? {
          condition: asString((raw.defeatCondition as Record<string, unknown>).condition),
          text: asString((raw.defeatCondition as Record<string, unknown>).text),
          alreadyFired: false,
        }
      : { condition: '', text: 'Game Over', alreadyFired: false },
    instructionBlocks,
    loreBookEntries,
    trackedItems,
    schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : undefined,
    version: asString(raw.version),
    source: 'infiniteworlds',
    importedAt: Date.now(),
  };

  if (!world.instructions) {
    warnings.push('World has empty "instructions" field; the AI may behave generically.');
  }
  if (world.possibleCharacters.length === 0) {
    warnings.push('No characters found. The game will use a default "You".');
  }

  return { world, warnings };
}

export function safeParseJson(text: string): { value: unknown; error?: string } {
  try {
    return { value: JSON.parse(text) };
  } catch (e) {
    return { value: null, error: (e as Error).message };
  }
}
