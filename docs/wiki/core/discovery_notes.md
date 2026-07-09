# System Discovery: Trigger Referee & Semantic State

Based on the analysis of the "College of Magic" (a reference world designed to showcase engine features), we can confirm the following architectural patterns:

## 1. The Trigger Referee (Logic Evaluation)
The system uses an **AI-Driven Event Evaluator**. 
- **The Pattern:** Triggers use `triggerOnEvent` with natural language conditions (e.g., "I enter the Wild Oaks").
- **The Discovery:** Since these conditions are passed to the Storyteller AI, the AI must act as the "Referee". It evaluates the current turn's outcome and explicitly flags which Trigger IDs have been activated.
- **BotStory Requirement:** We need a "Trigger Evaluation" pass. This can be:
    - **Integrated:** The LLM outputs a JSON array of `triggered_event_ids` as part of the turn response.
    - **Separate:** A smaller, faster LLM pass that takes the outcome and the list of potential triggers to decide which ones fire.

## 2. Semantic State (XML & Update Instructions)
The system manages complex state through "Tracked Items" with natural language update rules.
- **The Pattern:**
    - **XML Data Type:** Used for structured data (e.g., `<spell name="Firefly">...</spell>`). This allows the AI to store and retrieve specific properties of an item without losing the rest of the list.
    - **Update Instructions:** Instead of hardcoded logic, the AI is given a guide (e.g., "Decrease by 5 or more when I am hit").
- **The Discovery:** This "Semantic State" allows the world author to define complex game mechanics (like a spell system or inventory) without writing code, relying entirely on the LLM's ability to follow the "Update Instructions".
- **BotStory Requirement:**
    - Implement a `TrackedItem` class that supports `Text`, `Number`, and `XML`.
    - The prompt builder must inject the `updateInstructions` for all visible items into the AI's system prompt to ensure state consistency.

## 3. Prompt Injection (Lorebooks & Blocks)
- **Keyword-Based Injection:** Lorebook entries are injected only when keywords appear.
- **Block Modification:** Triggers don't just change variables; they change the *rules* by modifying `InstructionBlocks`.
- **BotStory Requirement:** A dynamic prompt assembly pipeline that can handle `<<variable>>` replacement and block swapping in real-time.
