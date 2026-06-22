# Storyteller Mode

Storyteller Mode is a "God Mode" that allows the player to bypass the AI's autonomy and directly steer the narrative.

## Capabilities
1. **Hidden State Visibility:** Access to `secretInfo` and `trackedItems` that are normally hidden from the player.
2. **Narrative Imperatives:** An additional input box that gives the AI a "strong imperative" about what must happen in the next turn.
3. **Direct Editing:** Ability to modify the world design (instructions, variables) in real-time during play.

## Implementation Logic
When Storyteller Mode is active:
- The prompt builder adds a high-priority "Imperative" block to the top of the la-turn instructions.
- The UI reveals hidden state variables.
- The "Edit World" menu is accessible from the gameplay screen.
