# Gameplay Interface: Runtime Experience

The gameplay interface is the bridge between the user and the AI engine. It provides a seamless narrative experience while allowing advanced users to "peek under the hood" via Storyteller and Debug modes.

## 1. The Narrative Loop
- **The Turn**: Each turn consists of a narrative block, a set of AI-suggested actions, and a custom input area.
- **Interaction Options**:
    - **Suggested Actions**: 3 buttons based on the current state.
    - **Custom Action**: A textarea for free-form input.
    - **Narrative Override**: A specific box to tell the AI exactly what should happen next, bypassing standard probability/skill checks.
- **Image Interaction**:
    - **Generation**: Manual trigger for turn images.
    - **Refinement**: The "wrench" icon provides a a look at the composite prompts (Appearance + Setting) and allows for manual editing.

## 2. User Utilities (The Icon Bar)
Located above the action options, these provide instant access to world state:
- **Character Sheet**: View current skills and bio.
- **Tracked Items**: View the "public" state of the world (Inventory, Rank).
- **Hidden Items**: View the "internal" state (e.g., technical spell effects).
- **Storyteller Overrides**: (Locked unless Storyteller mode is on)
    - **Edit State**: Manually change any tracked item.
    - **Reveal Secrets**: View the "meta-truth" of the current turn.
    - **Edit Turn**: Rewrite the action and the outcome.

## 3. The System Menu
- **Storyteller Mode**: Toggles the ability to override game logic.
- **World Debug Tools**:
    - **AI Prompt View**: See the exact final prompt sent to the LLM.
    - **Trigger Monitor**: See which triggers are active or have fired.
    - **Thinking Trace**: View the reasoning process of "thinking" models.
- **Model Management**:
    - **AI Model Selection**: Switch between tiers (Lynx $\rightarrow$ Massivecat) and variants (Standard vs. Thinking).
    - **Image Model Selection**: Switch models and associated style presets.
- **Illustration Options**: Configure image generation frequency and quantity.

## 4. State Persistence
- **Save/Load**: Ability to snapshot the current session state.
- **Export Story**: Export the narrative history.
