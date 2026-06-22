from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from .core.state import StateManager
from .core.triggers import TriggerProcessor
from .core.composer import PromptComposer

app = FastAPI()

# Setup core services
state_mgr = StateManager("/home/ion/projects/botstory/backend/data/college_of_magic_schema.json")
trigger_proc = TriggerProcessor(state_mgr)
composer = PromptComposer(state_mgr)

class ActionRequest(BaseModel):
    session_id: str
    user_input: str

class SessionCreateRequest(BaseModel):
    session_id: str
    character_id: str

@app.post("/session/create")
async def create_session(req: SessionCreateRequest):
    try:
        state_mgr.create_session(req.session_id, req.character_id)
        return {"status": "success", "session_id": req.session_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/story/action")
async def story_action(req: ActionRequest):
    try:
        # 1. Assemble Prompt
        prompt = composer.assemble_prompt(req.session_id, req.user_input)
        
        # 2. Mock LLM Response (Since we don't have an API key yet)
        # In a real app: response = llm.generate(prompt)
        mock_narrative = "You walk through the dorm room, feeling the magic in the air. You've just completed your first day of training!"
        mock_state_updates = [{"itemId": "dCU5kQrB", "newValue": "Acolyte"}]
        
        # 3. Apply State Updates
        for update in mock_state_updates:
            state_mgr.update_item(req.session_id, update["itemId"], update["newValue"])
            
        # 4. Process Triggers
        fired = trigger_proc.process_triggers(req.session_id, mock_narrative)
        
        return {
            "narrative": mock_narrative,
            "fired_triggers": fired,
            "prompt_used": prompt # For debugging
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
