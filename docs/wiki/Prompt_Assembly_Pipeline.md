# Design: Prompt Assembly Pipeline

The Prompt Assembly Pipeline is responsible for generating the final context window sent to the LLM. It converts the static world schema and dynamic story state into a coherent set of instructions.

## 1. Assembly Hierarchy
The final prompt is constructed as a concatenation of the following layers:

### Layer 1: System Core (The "Engine" Instructions)
General rules on how the AI should behave as a storyteller:
- "You are a world-class novelist."
- "Format your response as: [Narrative] \n\n [State Updates] \n\n [Suggested Actions]."
- "Maintain the persona and tone defined in the world schema."

### Layer 2: World Constants (Global Context)
- **World Instructions**: The `instructions` field from the schema.
- **Author Style**: The `authorStyle` field (e.g., "a bestselling novelist").
- **Background**: The `background` field.

### Layer 3: Dynamic Instructions (The "Current Truth")
- **Active Instruction Blocks**: All current contents of `instructionBlocks`.
- **Trigger-Modified Blocks**: If a trigger has modified a block, the *updated* content is used.

### Layer 4: Semantic Context (RAG / Lore)
- **Keyword Matching**: The system scans the user's last input and the previous narrative for keywords matching `loreBookEntries`.
- **Lore Injection**: Relevant lore entries are injected as "Known Facts" to ensure consistency.

### Layer 5: State Injection (The "World State")
- **Tracked Items**: All `trackedItems` and their current values are listed.
- **Item Metadata**: For each item, the `updateInstructions` are provided to the AI so it knows how to mutate the state.
- **Player Profile**: Character name, description, and skill levels.

### Layer 6: Conversational History
- The last $N$ turns of the story to maintain immediate continuity.

## 2. The Replacement Engine
Before the prompt is sent, a replacement pass is performed:
- **Placeholders**: `{{player_name}}` $\rightarrow$ "Aria Silverleaf".
- **State Values**: `{{current_rank}}` $\rightarrow$ "Initiate".

## 3. Output Parsing (The "Feedback Loop")
The pipeline also handles the return trip:
1. **Narrative Extraction**: The primary story text.
2. **State Update Extraction**:
   - Looks for blocks like `STATE_UPDATE: { "itemId": "...", "newValue": "..." }`.
   - Validates updates against `updateInstructions`.
3. **Action Generation**:
   - Extracts the 3 suggested actions for the UI.

## 4. Model Tiering Logic
Depending on the selected "Model Tier":
- **Fast**: Uses a smaller context window, skips some Lore entries, uses a faster model (e.g., GPT-4o-mini).
- **Standard**: Full pipeline.
- **Extra-Thinking**: Uses a "Chain of Thought" prompt prefix, encouraging the AI to reason about state changes and trigger conditions *before* writing the narrative.
