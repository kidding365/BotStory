# Trigger System Architecture

Triggers are the "logic gates" of the story, allowing the world to react to player actions and state changes.

## Trigger Structure
- **Condition (`triggerConditions`):** 
    - `triggerOnEvent`: A natural language description (e.g., "I find the Black Tower"). The Storyteller AI evaluates if this occurred during the turn and outputs the Trigger ID.
    - `triggerOnTurn`: Fires when a specific turn number is reached.
    - `triggerOnTrackedItem`: Fires when a variable (Number/Text) meets a condition (e.g., `Rank == "Acolyte"`).
    - `triggerOnRandomChance`: Percentage-based fire rate.
- **Effect (`triggerEffects`):**
    - `effectShowMessage`: Appends a scripted message to the outcome.
    - `effectSetTrackedItemValue`: Directly modifies a state variable.
    - `effectModifyInstructionBlock`: Replaces the content of an Extra Instruction Block, changing the AI's behavior for future turns.

## The "State-Logic" Loop
`Player Action` $\rightarrow$ `AI Outcome` $\rightarrow$ `Trigger Evaluation` $\rightarrow$ `Instruction Modification` $\rightarrow$ `Next Turn's Context`

## Ambiguity & Research Note
The `triggerOnEvent` is the most powerful but ambiguous part. It requires the AI to act as a "referee" and explicitly identify when a plot point has been hit. In BotStory, we should experiment with whether this is a separate "Evaluation" pass or a requirement in the main prompt.
