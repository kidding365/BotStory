# Infinite Worlds - System Analysis

## Overview
Infinite Worlds is an AI-powered storytelling platform that allows players to create, play, and share interactive worlds. It functions as a sophisticated AI orchestrator that maintains narrative coherence through a combination of prompt engineering, state tracking, and periodic summarization.

## Core Architecture

### 1. The Gameplay Loop
Every turn follows a specific data flow:
- **Input to Storyteller AI:**
    - Main Instructions (Core rules/style)
    - Player Action (`playerAction`)
    - Recent Context (Last 2-8 turns verbatim)
    - Story Summary (Condensed history of previous turns)
    - Character Data (Active and encountered characters)
- **AI Processing:** The AI evaluates the action against instructions and history.
- **Output from Storyteller AI:**
    - `evaluation`: Feasibility of the action (SUCCESS/FAILURE/DENIED).
    - `whereWhen`: Current timestamp and location.
    - `outcomeDescription`: The narrative result of the action.
    - `secretInfo`: Hidden data for story progression.
    - `optionN_text`: Suggested next actions.
    - `stateVariablesUpdates`: Updates to tracked items.
    - `triggerEvents`: List of activated triggers.
    - `illustr...`: Prompts for the Image AI.

### 2. Memory & Coherence
To solve the "context window" problem of LLMs, Infinite Worlds uses a dual-layer memory system:
- **Short-Term Memory:** Verbatim history of the last few turns.
- **Long-Term Memory:** A `Summary AI` (Kimi K2.5) that activates every 6 turns (starting at turn 8) to condense the story so far, guided by "summary instructions."

### 3. World Design & Toolkit
Worlds are defined by a set of instructions and data structures:
- **Standard Components:**
    - **Main Instructions:** The "system prompt" for the Storyteller.
    - **Player Characters:** Defined skills and descriptions.
    - **Victory/Defeat Conditions:** Logic to end the game.
- **Advanced Components:**
    - **Tracked Items:** State variables (String/Number) used to track inventory, stats, or plot progress.
    - **Trigger Events:** "If-Then" logic.
        - *Conditions:* Turn number, Tracked Item value, Random chance, or AI-evaluated situation (`triggerOnEvent`).
        - *Effects:* Change instructions, modify characters, update variables, show scripted text, or end the game.
    - **Keyword Instruction Blocks:** Conditional prompts added only when specific keywords are detected (similar to Lorebooks in AI roleplay).

### 4. AI Model Ecosystem
The platform abstracts various LLMs under themed names:
- **Storyteller Models:** Range from cheap/fast (Wildcat, Tomcat) to highly intelligent/thinking (Leopard, Smilodon, Lion).
- **Specialized AIs:**
    - **World Generator:** Creates the initial world skeleton from a prompt.
    - **Image AI:** Renders visuals from the Storyteller's descriptions.
    - **Summary AI:** Maintains the long-term narrative arc.
    - **Moderation AI:** Screens content.

## State Flow Diagram (Conceptual)
`Player Action` -> `Storyteller AI (Context + Instructions)` -> `Outcome + State Updates` -> `Trigger Evaluation` -> `World State Update` -> `Summary AI (Periodic)` -> `Updated Context` -> `Next Turn`
