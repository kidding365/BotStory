import json
from typing import Dict, Any, List
from ..models.schema import WorldSchema, Character

class StateManager:
    def __init__(self, world_path: str):
        with open(world_path, 'r') as f:
            data = json.load(f)
            self.world = WorldSchema(**data)
        
        self.sessions: Dict[str, Dict[str, Any]] = {}

    def create_session(self, session_id: str, character_id: str) -> Dict[str, Any]:
        # Find character
        character = next((c for c in self.world.possibleCharacters if c.characterId == character_id), None)
        if not character:
            raise ValueError(f"Character {character_id} not found in world.")

        # Initialize tracked item values
        current_values = {item.id: item.initialValue for item in self.world.trackedItems}
        
        # Initialize instruction blocks
        modified_instructions = {block.id: block.content for block in self.world.instructionBlocks}

        self.sessions[session_id] = {
            "character": character,
            "current_values": current_values,
            "modified_instructions": modified_instructions,
            "fired_triggers": set(),
            "history": []
        }
        return self.sessions[session_id]

    def get_session(self, session_id: str) -> Dict[str, Any]:
        if session_id not in self.sessions:
            raise ValueError("Session not found.")
        return self.sessions[session_id]

    def update_item(self, session_id: str, item_id: str, new_value: str):
        session = self.get_session(session_id)
        session["current_values"][item_id] = new_value

    def update_instruction(self, session_id: str, block_id: str, new_content: str):
        session = self.get_session(session_id)
        session["modified_instructions"][block_id] = new_content

    def mark_trigger_fired(self, session_id: str, trigger_id: str):
        session = self.get_session(session_id)
        session["fired_triggers"].add(trigger_id)
