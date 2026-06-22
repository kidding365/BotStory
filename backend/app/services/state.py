from typing import List, Dict, Any, Optional
from ..models.world import WorldSchema, StoryInstance, TurnSnapshot

class StateManager:
    def __init__(self, world: WorldSchema):
        self.world = world

    def create_instance(self, user_id: Any, character_id: str) -> StoryInstance:
        # Initialize current_values from world schema and character
        current_values = {item['id']: item.get('initialValue', '') for item in self.world.trackedItems}
        
        # Initialize modified_instructions from world schema
        modified_instructions = {block['id']: block['content'] for block in self.world.instructionBlocks}
        
        return StoryInstance(
            user_id=user_id,
            world_id="world_1", # Placeholder
            character_id=character_id,
            current_values=current_values,
            modified_instructions=modified_instructions
        )

    def apply_updates(self, instance: StoryInstance, updates: Dict[str, Any]):
        for item_id, new_val in updates.items():
            instance.current_values[item_id] = new_val

class TriggerProcessor:
    def __init__(self, world: WorldSchema):
        self.world = world

    def evaluate(self, instance: StoryInstance, fired_by_ai: List[str]) -> List[str]:
        """
        Processes triggers. 
        1. AI-suggested triggers are checked.
        2. Automatic state-based triggers are checked.
        """
        newly_fired = []
        
        # AI-suggested triggers
        for trigger_id in fired_by_ai:
            if trigger_id not in instance.fired_triggers:
                self._apply_trigger_effects(instance, trigger_id)
                instance.fired_triggers.append(trigger_id)
                newly_fired.append(trigger_id)
                
        return newly_fired

    def _apply_trigger_effects(self, instance: StoryInstance, trigger_id: str):
        trigger = next((t for t in self.world.triggerEvents if t['id'] == trigger_id), None)
        if not trigger:
            return
            
        for effect in trigger['triggerEffects']:
            if effect['type'] == 'effectSetTrackedItemValue':
                data = effect['data']
                instance.current_values[data['trackedItemID']] = data['newValue']
            elif effect['type'] == 'effectModifyInstructionBlock':
                data = effect['data']
                instance.modified_instructions[data['id']] = data['content']
