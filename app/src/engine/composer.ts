import { World, StoryInstance, UserAction, TrackedItem } from './types';

export class PromptComposer {
  buildSystemPrompt(world: World): string {
    const lines: string[] = [];
    lines.push('You are the storyteller engine for an infinite, evolving interactive world.');
    lines.push('You are also a brilliant novelist; write in the style described below.');
    lines.push('');
    lines.push(`AUTHOR STYLE: ${world.authorStyle || 'a masterful novelist'}`);
    lines.push('');
    lines.push('RULES:');
    lines.push('1. ALWAYS stay in character with the world described below.');
    lines.push('2. NEVER break the fourth wall. NEVER mention "the player" or "prompts".');
    lines.push('3. You MUST respond with a single valid JSON object matching the schema given to you.');
    lines.push('4. In "narrative", write 2-6 paragraphs of rich prose. Show, do not tell.');
    lines.push('5. In "suggestedActions", suggest EXACTLY 3 distinct, plot-advancing player actions.');
    lines.push('6. In "stateUpdates", mutate ONLY the tracked items provided. Respect each item\'s data type and updateInstructions.');
    lines.push('7. In "visualVariables", describe the current visual scene in detail.');
    lines.push('8. In "triggeredEvents", list any world events that occurred (e.g. "found_treasure", "I_enter_the_Wild_Oaks") so trigger conditions can fire.');
    lines.push('9. If the player wins, set "ended": true and put the final epilogue in "endMessage".');
    lines.push('10. NEVER output markdown code fences or any text outside the JSON.');
    return lines.join('\n');
  }

  buildUserPrompt(world: World, instance: StoryInstance, action: UserAction): string {
    const parts: string[] = [];

    parts.push('=== WORLD CONSTANTS ===');
    if (world.title) parts.push(`# Title: ${world.title}`);
    if (world.description) parts.push(`Description: ${world.description}`);
    if (world.objective) parts.push(`Objective: ${world.objective}`);
    if (world.background) parts.push(`Background:\n${world.background}`);
    if (world.instructions) parts.push(`Main Instructions:\n${world.instructions}`);

    parts.push('');
    parts.push('=== CURRENT PLAYER ===');
    const pc = world.possibleCharacters.find((c) => c.characterId === instance.characterId);
    if (pc) {
      parts.push(`Name: ${pc.name}`);
      if (pc.description) parts.push(`Description: ${pc.description}`);
      if (pc.skills && Object.keys(pc.skills).length) {
        parts.push('Skills:');
        for (const [k, v] of Object.entries(pc.skills)) {
          parts.push(`  - ${k}: ${v}`);
        }
      }
    } else {
      parts.push('(No specific character; the player is "You".)');
    }

    parts.push('');
    parts.push('=== TRACKED ITEMS (state) ===');
    if (world.trackedItems.length === 0) {
      parts.push('(No tracked items in this world.)');
    } else {
      for (const ti of world.trackedItems) {
        const cur = instance.currentValues[ti.id] ?? ti.initialValue;
        const visibility = ti.visibility === 'ai_only' ? '[AI-ONLY]' : '[Public]';
        parts.push(`- [${ti.id}] ${ti.name} (${ti.dataType}) ${visibility}`);
        parts.push(`    Description: ${ti.description}`);
        parts.push(`    Current value: ${JSON.stringify(cur)}`);
        parts.push(`    Update instructions: ${ti.updateInstructions}`);
      }
    }

    parts.push('');
    parts.push('=== ACTIVE INSTRUCTION BLOCKS (dynamic lore) ===');
    const activeBlocks = world.instructionBlocks.filter((b) => b.isActive !== false);
    if (activeBlocks.length === 0) {
      parts.push('(No additional instruction blocks.)');
    } else {
      for (const b of activeBlocks) {
        const content = instance.modifiedBlocks[b.id] || b.content;
        parts.push(`--- BLOCK: ${b.id} (${b.name}) ---`);
        parts.push(content);
        parts.push('--- END BLOCK ---');
      }
    }

    const lore = this.collectLore(world, instance, action);
    if (lore.length) {
      parts.push('');
      parts.push('=== RELEVANT LORE (keyword-triggered) ===');
      for (const l of lore) {
        parts.push(`--- LORE: ${l.name} ---`);
        parts.push(l.content);
        parts.push('--- END LORE ---');
      }
    }

    if (instance.history.length > 0) {
      parts.push('');
      parts.push('=== RECENT HISTORY (verbatim) ===');
      const recent = instance.history.slice(-8);
      for (const m of recent) {
        const who = m.role === 'user' ? (pc ? pc.name : 'You') : 'Storyteller';
        parts.push(`${who}: ${m.content}`);
      }
    }

    if (instance.turnNumber === 0 && world.firstInput) {
      parts.push('');
      parts.push(`=== SUGGESTED OPENING ACTION ===\n${world.firstInput}`);
    }

    parts.push('');
    parts.push('=== PLAYER ACTION ===');
    parts.push(action.text);
    if (action.narrativeOverride) {
      parts.push(`(NARRATIVE OVERRIDE - bypass skill checks and make this happen exactly: ${action.narrativeOverride})`);
    }
    if (action.imageInstructions) {
      parts.push(`(Visual steering for the illustration: ${action.imageInstructions})`);
    }

    return parts.join('\n');
  }

  collectLore(world: World, instance: StoryInstance, action: UserAction) {
    const haystack =
      action.text.toLowerCase() +
      ' ' +
      (action.narrativeOverride || '').toLowerCase() +
      ' ' +
      instance.history.map((h) => h.content).join(' ').toLowerCase();
    return world.loreBookEntries.filter((l) =>
      l.keywords.some((kw) => haystack.includes(kw.toLowerCase()))
    );
  }

  buildImagePrompt(world: World, instance: StoryInstance, visualVars: Record<string, string>, userImageInstructions?: string): string {
    const parts: string[] = [];
    const isCharacter = visualVars.isCharacter === 'true' || visualVars.isCharacter === '1';
    if (isCharacter) {
      parts.push(world.imageStyleCharacterPre || '');
      parts.push(visualVars.subject || '');
      parts.push(visualVars.appearance || '');
      parts.push(visualVars.expression || '');
      parts.push(world.imageStyleCharacterPost || '');
    } else {
      parts.push(world.imageStyleNonCharacterPre || '');
      parts.push(visualVars.subject || '');
      parts.push(visualVars.setting || '');
      parts.push(visualVars.appearance || '');
      parts.push(world.imageStyleNonCharacterPost || '');
    }
    if (userImageInstructions) parts.push(userImageInstructions);
    if (world.illustrationStyleCharacterHighPriority && isCharacter) parts.push(world.illustrationStyleCharacterHighPriority);
    if (world.illustrationStyleNonCharacterHighPriority && !isCharacter) parts.push(world.illustrationStyleNonCharacterHighPriority);
    if (world.illustrationStyleCharacterLowPriority && isCharacter) parts.push(world.illustrationStyleCharacterLowPriority);
    if (world.illustrationStyleNonCharacterLowPriority && !isCharacter) parts.push(world.illustrationStyleNonCharacterLowPriority);
    return parts.filter(Boolean).join(', ');
  }
}

export const composer = new PromptComposer();

export function defaultInstanceValues(world: World, characterId: string | null): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  const pc = world.possibleCharacters.find((c) => c.characterId === characterId);
  for (const ti of world.trackedItems) {
    let value: string | number = ti.initialValue;
    if (pc && pc.initialTrackedItemValues && ti.id in pc.initialTrackedItemValues) {
      value = pc.initialTrackedItemValues[ti.id];
    }
    out[ti.id] = value;
  }
  return out;
}

export function publicTrackedItems(world: World): TrackedItem[] {
  return world.trackedItems.filter((ti) => ti.visibility !== 'ai_only');
}

export function aiOnlyTrackedItems(world: World): TrackedItem[] {
  return world.trackedItems.filter((ti) => ti.visibility === 'ai_only');
}
