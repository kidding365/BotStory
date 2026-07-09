# AI Orchestration

The system uses a multi-model approach to balance cost, speed, and intelligence.

## Model Roles
- **Storyteller AI:** The primary writer. Handles outcomes, options, and illustration prompts.
    - **Standard Models:** Optimized for speed and cost.
    - **Thinking Models:** (e.g., Lion-Thinking, Smilodon-Thinking) Use extended reasoning to resolve complex plot points and maintain deeper consistency, though at a higher cost.
- **Summary AI:** The archivist. Condenses history every 6 turns to prevent context overflow.
- **Image AI:** The artist. Renders visuals based on Storyteller prompts.
- **World Generator:** The architect. Builds the initial world skeleton from a prompt.


## Prompting Strategy
- **Main Instructions:** The global system prompt.
- **Extra Instruction Blocks (EIBs):** Modular prompts that can be swapped or modified by triggers.
- **Keyword Instruction Blocks (KIBs):** Conditional prompts triggered by specific words (Lorebooks).
- **Author Style:** Controls the tone, POV, and prose quality.

## BotStory Modification Points
- **Model Routing:** Could we use a cheaper model for simple turns and a "Thinking" model for complex plot pivots?
- **Collaborative AI:** Could the Summary AI and Storyteller AI "debate" the next turn to improve coherence?
- **Multi-Modal Integration:** Direct integration of audio or interactive elements into the loop.
