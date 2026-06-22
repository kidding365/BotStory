# BotStory API Reference

This document outlines the API endpoints for the BotStory backend.

## 1. Authentication & User Management
- `POST /auth/signup`: Create a new account.
- `POST /auth/login`: Authenticate and receive a JWT.
- `GET /user/settings`: Retrieve current API key configuration.
- `PUT /user/settings`: Update API keys, providers, or default models.

## 2. World Management
- `POST /worlds/import`: Import a world via raw JSON.
- `GET /worlds`: List all worlds in the user's library.
- `GET /worlds/{world_id}`: Retrieve a specific world blueprint.
- `PUT /worlds/{world_id}`: Update world settings via GUI.

## 3. Session & Story Instances
- `POST /story/start`: Initialize a new `StoryInstance` from a `World`.
- `GET /story/instances`: List all active playthroughs for the user.
- `GET /story/instance/{instance_id}`: Retrieve current state of a playthrough.

## 4. The Storytelling Loop
- `POST /story/turn`: The primary game loop endpoint.
    - **Input**: `instance_id`, `user_input`, `image_instructions` (optional).
    - **Process**: Prompt Assembly $\rightarrow$ LLM $\rightarrow$ State Update $\rightarrow$ Trigger Check.
    - **Output**: `narrative`, `reasoning`, `suggested_actions`, `visual_prompt`, `fired_triggers`.
- `POST /story/regenerate`: Roll back to the previous snapshot and re-run the turn.
- `POST /story/override`: Manually update a tracked item or narrative block (Storyteller mode).

## 5. Visuals
- `POST /images/generate`: Trigger the image AI using the current turn's merged prompt.
- `POST /images/refine`: Modify existing image prompts for regeneration.
