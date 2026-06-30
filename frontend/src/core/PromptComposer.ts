import type { GameState } from "../types/schema";

export class PromptComposer {
  public assemblePrompt(state: GameState, userInput: string): string {
    const { world, session } = state;

    let prompt = `Continue the story based on the history and world settings provided below.
You MUST respond with a JSON object.

CRITICAL:
1. "narrative": Write the next part of the story (at least 2 paragraphs).
2. "imagePrompt": Create a vivid, detailed visual description of the IMMEDIATE SCENE from your "narrative".
   - DO NOT describe generic landscapes or "scenery".
   - DO NOT describe mountains or water unless the character is literally on them.
   - FOCUS on the character's face, their current clothing, and what they are doing in the room or area.
   - STYLE: ${world.imageStyleCharacterPre || ''} ${world.imageStyleCharacterPost || ''} ${world.imageStyleNonCharacterPost || ''}
3. "suggestedActions": Provide exactly 3 short, punchy options for the player.
4. "stateUpdates": If the narrative implies a change in rank, inventory, or known spells, include the update here.

World visual style: ${world.imageStyleCharacterPost || ''}

WORLD SETTING: ${world.title}
BACKGROUND: ${world.background}
CORE INSTRUCTIONS: ${world.instructions}
AUTHOR STYLE: ${world.authorStyle}

CURRENT STORY TRUTHS:
${Object.values(session.modifiedInstructions).map(content => `- ${content}`).join("\n")}

WORLD STATE:
${(world.trackedItems || []).map(item => `- ${item.name}: ${session.currentValues[item.id]} (Update rule: ${item.updateInstructions})`).join("\n")}

PLAYER CHARACTER: ${session.character.name}
DESCRIPTION: ${session.character.description}
SKILLS: ${JSON.stringify(session.character.skills)}

STORY HISTORY (LAST 5 TURNS):
${session.history.slice(-10).map(m => `${m.role === 'user' ? 'PLAYER' : 'STORYTELLER'}: ${m.narrative || m.content}`).join("\n")}

RELEVANT LORE:
${(world.loreBookEntries || [])
  .filter(entry => (entry.keywords || []).some(kw => userInput.toLowerCase().includes(kw.toLowerCase())))
  .map(entry => `- ${entry.name}: ${entry.content}`)
  .join("\n")}

USER ACTION: ${userInput}
`;

    return prompt;
  }
}
