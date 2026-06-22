# World Editor: Configuration & Design

The World Editor is where the fundamental "laws" and "content" of a BotStory world are defined. It follows a structured schema that informs the AI's behavior and the game's state tracking.

## 1. Basic Setup
- **Metadata**: Title, versioning (with auto-increment), and a public description.
- **Narrative Foundation**: 
    - **Background Story**: Sets the initial scene and mood.
    - **First Action**: The forced starting action to guide the player.
    - **Objective**: A high-level goal that the AI tracks to provide guidance.
- **Content Safety**: Mature content toggles and specific content warnings.

## 2. The Prompting Engine
- **Main Instructions**: The primary context for the AI. It defines the setting, player role, and pacing.
- **Author Style**: Defines the linguistic persona (e.g., "a bestselling novelist").
- **Extra Instruction Blocks**: Modular blocks of text. These can be static or linked to triggers for dynamic context injection.

## 3. Image Generation System
The system uses a composite prompting approach:
- **Model Selection**:Choice of models (Manticore, Wyvern, Flux.1).
- **Style Presets**: Dropdowns for specific aesthetics (e.g., "Photorealistic 1", "Anime 2").
- **Composite Prompts**:
    - **Character Guidance**: "Prompt beginning" and "Prompt ending" for consistent character looks.
    - **Scenery Guidance**: Separate beginning/ending prompts for environments.
- **Generation Logic**: Control over frequency (Every turn vs. On Change) and number of alternatives (1-3).

## 4. Character & Skill System
- **Skill Definition**: A set of 4-6 skills (e.g., Intelligence, Guile) that act as the mechanical basis for success/failure.
- **Character Roster**: Multiple pre-defined characters with:
    - Bio/Description.
    - Skill distribution.
    - Portraits.
- **Customization**: Settings to allow/disallow player modifications to characters.

## 5. Advanced Mechanics
- **Victory/Defeat Conditions**: Logic strings that, when met, trigger a world-ending state and a final message.
- **Keyword Instruction Blocks (RAG)**: A "Lore Book" system. Information is only injected into the prompt if specific keywords appear in the narrative or user input.
- **Tracked Items**: Variables (text, numbers, lists) with associated **Update Instructions** that tell the AI how to mutate the value.
- **Triggers**: A conditional system: `Condition (onEvent/Value)` $\rightarrow$ `Effect (Message/State Update/Instruction Modification)`.
- **Specialist Instructions**: Custom prompt overrides for the "Referee" (Evaluation), "Narrator" (Description), and "Archivist" (Summarisation) roles.

## 6. Technical Backend
- **Raw JSON**: Full access to the world schema for bulk editing and portability.
- **Permissions**: Controls for sharing and allowing others to fork/edit the world.
