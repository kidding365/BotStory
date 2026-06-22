from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
from uuid import UUID, uuid4

class WorldSchema(BaseModel):
    """The blueprint of a world."""
    title: str
    description: str
    background: str
    instructions: str
    authorStyle: str
    objective: str
    skills: List[str]
    possibleCharacters: List[Dict[str, Any]]
    triggerEvents: List[Dict[str, Any]]
    instructionBlocks: List[Dict[str, Any]]
    loreBookEntries: List[Dict[str, Any]]
    trackedItems: List[Dict[str, Any]]
    imageModel: Optional[str] = None
    # ... other image settings as explored in the editor ...

class StoryInstance(BaseModel):
    """A specific playthrough of a world."""
    id: UUID = Field(default_factory=uuid4)
    world_id: str # Reference to the world blueprint
    user_id: UUID
    character_id: str
    current_turn: int = 1
    current_values: Dict[str, Any] = {} # Current values of tracked items
    modified_instructions: Dict[str, str] = {} # Current state of instruction blocks
    fired_triggers: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TurnSnapshot(BaseModel):
    """A snapshot of a single turn for history and regeneration."""
    turn_number: int
    user_input: str
    narrative_output: str
    image_prompt: str
    state_before: Dict[str, Any]
    state_after: Dict[str, Any]
    ai_reasoning: Optional[str] = None # The "Thinking" block
    timestamp: datetime = Field(default_factory=datetime.utcnow)
