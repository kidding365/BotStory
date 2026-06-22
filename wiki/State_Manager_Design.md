# Design: State Manager & Trigger Processor

The State Manager is the "source of truth" for a running story session. It manages the lifecycle of world state and handles the execution of trigger-based logic.

## 1. Data Models

### Session State
```json
{
  "sessionId": "uuid",
  "worldId": "college_of_magic",
  "characterId": "Z1N4dG0d",
  "currentValues": {
    "BReU0Pzu8": "Firefly",
    "pSWhvfnP": "<spell name=\"Firefly\">...</spell>",
    "HUSBFSjKB": "Letter of Welcome",
    "dCU5kQrB": "Initiate"
  },
  "modifiedInstructions": {
    "eqikTl7i5": "Current modified content of the main storyline block..."
  },
  "firedTriggers": ["aAZYc0TS"],
  "history": []
}
```

## 2. State Manager Logic

### Initialization
1. Load World Schema.
2. Selected Character $\rightarrow$ map `initialTrackedItemValues` and skills to `currentValues`.
3. Load default `instructionBlocks`.

### Update Pipeline
When the LLM returns a state update:
1. **Parse**: Extract `itemId` and `newValue`.
2. **Validate**: (Optional) check if the update contradicts the `updateInstructions`.
3. **Commit**: Update `currentValues` in MongoDB.
4. **Trigger Check**: Immediately call the Trigger Processor.

## 3. Trigger Processor Logic

The Trigger Processor runs after every state update or narrative turn.

### Evaluation Cycle
For each `triggerEvent` in the schema:
1. **Skip** if `triggerEvent.id` is in `firedTriggers`.
2. **Check Conditions**: 
   - `triggerOnEvent`: This is a semantic check. The system asks the LLM (or a small specialized "Referee" model): *"Based on the latest narrative and state, has the event '{{condition_data}}' occurred?"*
   - `Boolean Check`: If the condition is a simple value check (e.g., `rank == 'Acolyte'`), it is evaluated programmatically.
3. **Execute Effects**: If conditions are met:
   - `effectShowMessage`: Add a system message to the narrative output.
   - `effectSetTrackedItemValue`: Update a value in the State Manager.
   - `effectModifyInstructionBlock`: Replace the content of an `instructionBlock`.
4. **Mark Fired**: Add `triggerEvent.id` to `firedTriggers`.

## 4. The "Referee" Pattern
To avoid "hallucinated" triggers, the system uses a two-step process for `triggerOnEvent`:
1. **Candidate Identification**: The system identifies triggers that *might* be firing based on keywords.
2. **Verification**: A prompt is sent to the LLM:
   *"Current Event: {{narrative}}\nCondition: {{condition_data}}\nDid this happen? Answer Yes/No."*
3. **Action**: Only if "Yes" are the effects applied.
