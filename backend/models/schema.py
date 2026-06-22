from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any, Union

class LoreEntry(BaseModel):
    id: str
    name: str
    content: str
    keywords: List[str]

class TrackedItem(BaseModel):
    id: str
    name: str
    positionInList: int
    dataType: str
    visibility: str
    description: str
    updateInstructions: str
    initialValue: str
    initialValueBasedOnPC: str
    autoUpdate: bool

class TriggerCondition(BaseModel):
    id: str
    data: str
    type: str
    category: str

class TriggerEffect(BaseModel):
    id: str
    data: Union[str, Dict[str, Any]]
    type: str

class TriggerEvent(BaseModel):
    id: str
    name: str
    triggerEffects: List[TriggerEffect]
    triggerConditions: List[TriggerCondition]

class InstructionBlock(BaseModel):
    id: str
    name: str
    content: str

class Character(BaseModel):
    name: str
    description: str
    characterId: str
    skills: Dict[str, int]
    initialTrackedItemValues: List[Any] = []

class WorldSchema(BaseModel):
    title: str
    description: str
    background: str
    instructions: str
    authorStyle: str
    recommendedAIModel: str
    objective: str
    skills: List[str]
    possibleCharacters: List[Character]
    triggerEvents: List[TriggerEvent]
    instructionBlocks: List[InstructionBlock]
    loreBookEntries: List[LoreEntry]
    trackedItems: List[TrackedItem]
    imageModel: Optional[str] = None
    imageStyleCharacterPre: Optional[str] = None
    imageStyleCharacterPost: Optional[str] = None
    imageStyleNonCharacterPre: Optional[str] = None
    imageStyleNonCharacterPost: Optional[str] = None
