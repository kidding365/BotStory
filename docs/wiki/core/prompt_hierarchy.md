# Prompt Hierarchy & Instruction Flow

The core of the Infinite Worlds storytelling engine is a tiered prompt system that allows for both global consistency and dynamic, plot-driven changes.

## The Hierarchy
1. **Main Instructions (Global):**
   - The foundation of the world.
   - Contains setting, tone, core mechanics, and the overarching plot.
   - Sent to the AI every turn.
2. **Extra Instruction Blocks (Modular):**
   - Discrete segments of instructions appended to the Main Instructions.
   - **Key Feature:** These can be fully replaced or modified by **Trigger Events**.
   - Example: A "Current Quest" block that updates as the player progresses.
3. **Lorebook Entries (Keyword-Triggered):**
   - Content that is only injected into the prompt when specific keywords are detected in the current context.
   - Prevents prompt bloat by only providing "on-demand" information.

## Data Flow for a Turn
`Context` = `Main Instructions` + `(Active Extra Blocks)` + `(Triggered Lorebook Entries)` + `Author Style` + `Recent History` + `Summary`

## BotStory Implementation Goals
- **Dynamic Prompting:** Implement a system that can swap "Instruction Blocks" based on game state.
- **Efficient Lore:** Create a keyword-based injection system to handle large worlds without exceeding context limits.
