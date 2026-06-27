import type { GameState } from "../types/schema";

export class PromptComposer {
  public assemblePrompt(state: GameState, userInput: string): string {
    const { world, session } = state;

    let prompt = `Continue the story based on the history and world settings provided below.
You MUST respond with a JSON object.

CRITICAL: The "imagePrompt" you generate must be a vivid, detailed visual description of the SCENE that just happened in your "narrative".
It should emphasize colors, lighting, composition, and specific character appearances as defined in the character profile.
Use the world's style if applicable: ${world.imageStyleCharacterPost || ''}

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
