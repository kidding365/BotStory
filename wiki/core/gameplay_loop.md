# Core Gameplay Loop

The core loop of Infinite Worlds (and by extension, the foundation for BotStory) is a state-driven interaction between the player and the Storyteller AI.

## Turn Sequence
1. **Context Assembly:**
   - **Static Context:** Main Instructions + Author Style + Objective.
   - **Dynamic Context:** Player Action + Recent History (2-8 turns) + Story Summary.
   - **State Context:** Current values of visible Tracked Items + Character data.
2. **AI Evaluation:**
   - The Storyteller AI determines the feasibility of the action (`evaluation`).
   - It calculates the impact on the world state.
3. **Outcome Generation:**
   - Writes the `outcomeDescription`.
   - Generates `secretInfo` and suggested `options`.
   - Updates `stateVariablesUpdates`.
4. **Trigger Processing:**
   - All triggers are evaluated in sequence.
   - Effects are applied (e.g., changing instructions, modifying variables).
5. **Post-Turn Housekeeping:**
   - `whereWhenAfter` is updated.
   - Periodically (every 6 turns), the Summary AI updates the long-term memory.

## BotStory Modification Points
*Potential areas to innovate or change:*
- **Loop Speed:** Could we introduce "Fast Forward" turns?
- **Evaluation Logic:** Can we make the `evaluation` more transparent to the player?
- **Trigger Timing:** Could triggers fire *during* the turn instead of only at the end?
