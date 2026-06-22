# UI & User Experience Discovery

Based on live exploration and JSON analysis, the Infinite Worlds user experience is built around high-level AI steering and visual customization.

## 1. Model Tiers (Thinking Levels)
The system offers multiple "intelligence" levels for the Storyteller AI:
- **Fast:** Lowest latency, lowest cost, basic coherence.
- **Standard:** Balanced cost and intelligence.
- **Thinking:** Uses reasoning models (like Claude 3.5 Sonnet or GPT-4o) to handle complex plot twists.
- **Extra-Thinking:** Uses extended reasoning (e.g., o1/o3) for highly complex architectural or mechanical coherence.

## 2. Visual Style Engine
Image generation is not a single prompt but a combination of styles:
- **Style Presets:** "Anime", "Photo-realistic", "Pseudorealistic CGI", "Anime-Retro", "Digital Illustration".
- **Template Mapping:** These presets map to specific `imageStyle...Pre` and `Post` strings in the JSON, which wrap the AI-generated appearance and setting.

## 3. Narrative Steering (Storyteller Mode)
Storyteller Mode transforms the player from a "participant" to a "co-author":
- **State Transparency:** Reveals `secretInfo` (the AI's internal logic/hidden plot).
- **Imperative Input:** A dedicated input field that overrides the AI's autonomy, forcing a specific event or opinion into the next turn's outcome.

## 4. Guided Interaction
- **Suggested Actions:** The AI provides 3 distinct options to lower the "blank page" friction for players.
- **Seamless Onboarding:** A "Make Copy" flow allows players to jump into a complex world without setting up the JSON from scratch.
