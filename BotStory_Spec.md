# BotStory Requirements Specification

## 1. Functional Requirements
- **User Account System**: Secure login/signup to manage sensitive API keys.
- **BYOK (Bring Your Own Key)**: 
    - Primary support for Google AI Studio (Gemini/Gemma/Imagen).
    - "Others" provider for custom endpoints (API Key, Endpoint, Model Name).
- **World Editor:** Tool to create/edit the JSON schema. Supports raw JSON import with "Best Effort" recovery.
- **Game Engine:**
    - **Turn Orchestrator**: Single-pass generation of (Reasoning $\rightarrow$ Narrative $\rightarrow$ Visuals $\rightarrow$ State $\rightarrow$ Actions).
    - **Instance-Based Play**: Every "Play" creates a unique `StoryInstance` for persistence and separate playthroughs.
    - **Regenerate Turn**: Ability to rollback state and re-run a turn.
    - **Prompt Builder**: Implements a tiered hierarchy with a high-priority "Image Instructions" override.
    - **State Manager**: Handles `trackedItems` and variable replacement.
- **Player Interface:**
    - Chat-like interface with a "Quick-Select" bar for the 3 suggested actions.
    - **Storyteller Dashboard**: Toggleable view for hidden state, secret info, and narrative overrides.
    - **Image Steering**: Toggleable "Image Instructions" box for direct visual control.



## 2. Technical Requirements
- **Backend:** Node.js/Python (to be decided).
- **LLM Integration:** Support for multiple providers (OpenRouter/Anthropic/Google) to allow "Thinking" vs "Fast" models.
- **State Persistence:** Ability to save/load game state (JSON).

## 3. Key Ambiguities to Resolve
- **Trigger Evaluation:** Does the AI output trigger IDs, or does a second "Judge" LLM pass evaluate the outcomes?
- **XML Logic:** How strictly should the `XML` data type be validated?
- **Image Prompting:** How to best translate `imagePromptDetails` into a consistent visual style.
