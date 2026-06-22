# BotStory Development Guide

This guide provides instructions for setting up and running the BotStory project.

## 1. Environment Setup
### Backend (FastAPI)
1. Install Python 3.11+.
2. Install dependencies: `pip install fastapi uvicorn pydantic google-generativeai pymongo`.
3. Configure environment variables (e.g., `MONGO_URI`, `JWT_SECRET`).
4. Run the server: `uvicorn backend.app.main:app --reload`.

### Frontend (Next.js)
1. Install Node.js 18+.
2. Install dependencies: `npm install`.
3. Run in development mode: `npm run dev`.

## 2. Working with World Blueprints
- **JSON Format**: Worlds are defined by a JSON schema. See `college_of_magic_schema.json` for a reference.
- **Importing**: Use the `/worlds/import` endpoint to upload raw JSON. The system will perform a "best effort" mapping to the `WorldSchema` model.

## 3. Debugging the AI Loop
To debug the narrative generation:
1. Enable **Storyteller Mode** in the UI.
2. Open **World Debug Tools**.
3. Inspect the **AI Prompt View** to see exactly what is being sent to the LLM.
4. Compare the **Reasoning** block with the final **Narrative** output to identify logic gaps.

## 4. Image Prompt Tuning
When testing the visual pipeline:
- Use the **Wrench Icon** to view the merged prompt.
- Adjust the **Image Instructions** box to see how specific keywords affect the output of Imagen.
- Test different **Style Presets** to find the best match for the world's aesthetic.
