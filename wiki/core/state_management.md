# State Management (Tracked Items)

Infinite Worlds uses a system of "Tracked Items" to maintain persistent state across turns without relying on the AI's imperfect memory.

## Item Properties
- **Name:** Descriptive identifier (used in `<<item_name>>` syntax).
- **Data Type:** 
    - `Text`: For descriptions, inventories, or names.
    - `Number`: For stats, currency, or counters.
    - `XML`: For complex structured data (e.g., spell effects).
- **Visibility:** 
    - `Player`: Shown in the UI.
    - `AI`: Used as context for the Storyteller.
- **Update Instructions:** Natural language guides telling the AI when to change the value.

## State Flow
`AI Outcome` -> `stateVariablesUpdates` -> `Tracked Item Value` -> `Trigger Condition` -> `Trigger Effect` -> `Tracked Item Value`

## BotStory Modification Points
- **Complex Types:** Could we add a `Boolean` or `Enum` type for simpler state tracking?
- **Dependency Chains:** Could one tracked item's update automatically trigger another's?
- **Player-Controlled State:** Allow players to directly edit certain tracked items through a specialized interface.
