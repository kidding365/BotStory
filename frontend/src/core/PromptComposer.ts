import type { GameState } from "../types/schema";

export class PromptComposer {
  public assemblePrompt(state: GameState, userInput: string): string {
    const { world, session } = state;

    let prompt = `You are a world-class novelist and the engine for an interactive story.
Format your response as a JSON object with the following keys:
- narrative: The story text for this turn.
- stateUpdates: An array of objects { itemId: string, newValue: any } reflecting changes in the world state.
- suggestedActions: An array of 3 strings for next possible actions.
- imagePrompt: A detailed prompt for generating an illustration of the current scene.

WORLD SETTING: ${world.title}
BACKGROUND: ${world.background}
CORE INSTRUCTIONS: ${world.instructions}
AUTHOR STYLE: ${world.authorStyle}

CURRENT STORY TRUTHS:
${Object.values(session.modifiedInstructions).map(content => `- ${content}`).join("\n")}

WORLD STATE:
${world.trackedItems.map(item => `- ${item.name}: ${session.currentValues[item.id]} (Update rule: ${item.updateInstructions})`).join("\n")}

PLAYER CHARACTER: ${session.character.name}
DESCRIPTION: ${session.character.description}
SKILLS: ${JSON.stringify(session.character.skills)}

RELEVANT LORE:
${world.loreBookEntries
  .filter(entry => entry.keywords.some(kw => userInput.toLowerCase().includes(kw.toLowerCase())))
  .map(entry => `- ${entry.name}: ${entry.content}`)
  .join("\n")}

USER ACTION: ${userInput}
`;

    return prompt;
  }
}
