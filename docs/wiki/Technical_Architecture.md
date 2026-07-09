# Technical Architecture: BotStory

## 1. High-Level Stack
- **Frontend**: Next.js (TypeScript) + Tailwind CSS
- **Backend**: FastAPI (Python 3.11+)
- **Database**: MongoDB (for User, World, and StoryInstance data) + Redis (for session caching)
- **AI Orchestration**: Direct-to-Provider Proxy (BYOK). Uses the user's provided API key to call Gemini/Gemma/Imagen.
- **LLM Integration**: Multi-provider (Google AI Studio primary, others via custom endpoints).

## 2. Core System Components

### A. User & Key Management (New)
- **Auth**: JWT-based authentication.
- **Key Store**: Encrypted storage of API keys (Google, Custom) per user account.

### B. Prompt Assembly Pipeline (The "Composer")
The engine assembles a final prompt by traversing the hierarchy:
`Global World Prompt` $\rightarrow$ `Modular Prompts (Active)` $\rightarrow$ `Lore Prompts (Relevant)` $\rightarrow$ `User Input`
- **Thinking Phase**: The prompt requires a structured JSON output starting with a `reasoning` block.
- **Visual Steering**: A high-priority `image_instructions` field that overrides the default visual context.

### C. Instance-Based State Management
- **World Blueprint**: The static JSON schema.
- **Story Instance**: A unique playthrough. Tracks:
    - `current_values`: The evolved state of tracked items.
    - `modified_instructions`: The current state of dynamic blocks.
    - `fired_triggers`: List of events already executed.
- **Turn Snapshots**: Every turn is saved as a snapshot. This allows for **Regenerate Turn** functionality by reverting the instance state to the snapshot's `state_before`.

### D. Trigger Processor (The "Referee")
Handles the logic-based events in the world.
- **Trigger Condition**: `triggerOnEvent` check.
- **Outcome Mapping**: Maps triggers to effects (Messages, State Updates, Block Modifications).

## 3. Data Flow: The Story Loop
1. **Input**: User provides an action + optional image instructions.
2. **Assembly**: Composer builds the prompt using World Blueprint + Instance State + Turn History.
3. **Inference**: LLM returns a JSON packet: `Reasoning` $\rightarrow$ `Narrative` $\rightarrow$ `State Updates` $\rightarrow$ `Visual Variables` $\rightarrow$ `Suggested Actions`.
4. **State Update**: State Manager applies updates and saves a Turn Snapshot.
5. **Trigger Check**: Trigger Processor evaluates conditions based on the new state.
6. **Output**: Frontend renders narrative and triggers the Image AI using merged visual prompts.

## 4. API Endpoints (Proposed)
- `POST /story/action`: Submit user input, trigger the loop, return narrative + state.
- `GET /story/state`: Retrieve current world state and active prompts.
- `POST /story/steer`: "Storyteller Mode" input to force a narrative direction.
- `GET /world/schema`: Get the world definition (similar to `college_of_magic_schema.json`).
