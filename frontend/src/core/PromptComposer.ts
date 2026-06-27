import type { GameState } from "../types/schema";

export class PromptComposer {
  public assemblePrompt(state: GameState, userInput: string): string {
    const { world, session } = state;

    let prompt = `You are a world-class novelist and the engine for an interactive story.
IMPORTANT: You MUST respond with ONLY a valid JSON object. Do not include any text before or after the JSON.

Example JSON structure:
{
  "narrative": "The story text goes here...",
  "stateUpdates": [{"itemId": "item1", "newValue": "value"}],
  "suggestedActions": ["Action 1", "Action 2", "Action 3"],
  "imagePrompt": "A highly detailed description of the scene for an image generator."
}

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
${session.history.slice(-10).map(m => `${m.role === 'user' ? 'PLAYER' : 'STORYTELLER'}: ${m.content}`).join("\n")}

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
