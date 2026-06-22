from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import uuid

from .app.models.user import User, APIKeyConfig
from .app.models.world import WorldSchema, StoryInstance, TurnSnapshot
from .app.services.composer import PromptComposer
from .app.services.state import StateManager, TriggerProcessor

app = FastAPI(title="BotStory API")

# --- Mock DB & State ---
USERS_DB = {}
WORLDS_DB = {
    "college_of_magic": WorldSchema(
        title="College of Magic",
        description="...",
        background="...",
        instructions="...",
        authorStyle="a bestselling novelist",
        objective="Uncover the secret",
        skills=["Magical talent", "Charisma"],
        possibleCharacters=[],
        triggerEvents=[],
        instructionBlocks=[],
        loreBookEntries=[],
        trackedItems=[]
    )
}
INSTANCES_DB = {}
HISTORY_DB = {}

# --- Request Models ---
class ActionRequest(BaseModel):
    instance_id: str
    user_input: str
    image_instructions: Optional[str] = None

class SessionRequest(BaseModel):
    user_id: str
    world_id: str
    character_id: str

# --- API Endpoints ---

@app.post("/session/start")
async def start_session(req: SessionRequest):
    world = WORLDS_DB.get(req.world_id)
    if not world:
        raise HTTPException(status_code=404, detail="World not found")
    
    state_mgr = StateManager(world)
    instance = state_mgr.create_instance(req.user_id, req.character_id)
    
    INSTANCES_DB[str(instance.id)] = instance
    HISTORY_DB[str(instance.id)] = []
    
    return {"instance_id": str(instance.id)}

@app.post("/story/turn")
async def process_turn(req: ActionRequest):
    instance = INSTANCES_DB.get(req.instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    world = WORLDS_DB.get("college_of_magic") # Simplification
    history = HISTORY_DB.get(req.instance_id, [])
    
    # 1. Assemble Prompt
    composer = PromptComposer(world, instance, history)
    payload = composer.assemble_final_prompt(req.user_input, req.image_instructions)
    
    # 2. Mock LLM Call (Gemma-4-31b-it behavior)
    # In reality, this uses the User's API Key -> Google AI Studio
    mock_response = {
        "reasoning": "The user wants to review the letter. I should reveal the Wild Oaks prohibition.",
        "narrative": "You unfold the letter... and see the prohibition on Wild Oaks.",
        "image_variables": {"subject": "Aria reading a letter", "setting": "Stone dorm room"},
        "suggested_actions": ["Go to bed", "Explore corridors", "Study theory"],
        "state_updates": {"rank": "Initiate"},
        "secret_info": "The missing student is actually in the Wild Oaks.",
        "trigger_events": []
    }
    
    # 3. Apply State & Triggers
    state_mgr = StateManager(world)
    trigger_proc = TriggerProcessor(world)
    
    state_mgr.apply_updates(instance, mock_response["state_updates"])
    fired = trigger_proc.evaluate(instance, mock_response["trigger_events"])
    
    # 4. Snapshot Turn
    turn = TurnSnapshot(
        turn_number=instance.current_turn,
        user_input=req.user_input,
        narrative_output=mock_response["narrative"],
        image_prompt=payload["visual_prompt"],
        state_before={}, # Snapshot logic here
        state_after=instance.current_values,
        ai_reasoning=mock_response["reasoning"]
    )
    
    HISTORY_DB[req.instance_id].append(turn)
    instance.current_turn += 1
    
    return {
        "narrative": mock_response["narrative"],
        "reasoning": mock_response["reasoning"],
        "actions": mock_response["suggested_actions"],
        "visual_prompt": payload["visual_prompt"],
        "fired_triggers": fired
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
