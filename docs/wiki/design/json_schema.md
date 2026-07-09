# Data Schema (JSON Blueprint)

Based on the "College of Magic" extraction, the world state is defined by a specific JSON schema.

## Primary Fields
- `instructions`: String. The global system prompt.
- `authorStyle`: String. Tone/Prose guide.
- `objective`: String. The player's goal, sent to AI every turn.
- `skills`: Array of strings. The metrics used for action success.
- `possibleCharacters`: Array of objects.
    - `skills`: Map of `skillName` $\rightarrow$ `value`.
    - `description`: Background text.
- `trackedItems`: Array of objects.
    - `dataType`: `Text` | `Number` | `XML`.
    - `updateInstructions`: Natural language guide for the AI to maintain the value.
    - `visibility`: `everyone` | `ai_only`.
- `triggerEvents`: Array of objects mapping `triggerConditions` $\rightarrow$ `triggerEffects`.
- `instructionBlocks`: Array of `id` + `content` pairs.
- `loreBookEntries`: Array of `id` + `content` + `keywords`.

## Implementation Requirement
BotStory must be able to:
1. **Serialize/Deserialize** this schema.
2. **Execute** the logic defined in `triggerEvents` against `trackedItems` and `instructionBlocks`.
3. **Inject** the resulting prompt into the LLM.
