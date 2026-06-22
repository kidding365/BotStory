from typing import List, Dict, Any, Optional
from .state import StateManager
from ..models.schema import TriggerEvent, TriggerEffect

class TriggerProcessor:
    def __init__(self, state_manager: StateManager, llm_client=None):
        self.state_manager = state_manager
        self.llm_client = llm_client

    def process_triggers(self, session_id: str, latest_narrative: str):
        session = self.state_manager.get_session(session_id)
        world = self.state_manager.world
        
        fired_this_turn = []

        for event in world.triggerEvents:
            if event.id in session["fired_triggers"]:
                continue
            
            if self._evaluate_conditions(session, event, latest_narrative):
                self._apply_effects(session_id, event)
                session["fired_triggers"].add(event.id)
                fired_this_turn.append(event.name)
        
        return fired_this_turn

    def _evaluate_conditions(self, session: Dict[str, Any], event: TriggerEvent, narrative: str) -> bool:
        for condition in event.triggerConditions:
            if condition.type == "triggerOnEvent":
                if self.llm_client:
                    # Actual AI check
                    result = self.llm_client.verify_event(narrative, condition.data)
                    if not result:
                        return False
                else:
                    # Mock check for development: if keyword in narrative
                    # In real usage, this would be a proper LLM call
                    keywords = condition.data.lower().split()
                    if not any(kw in narrative.lower() for kw in keywords if len(kw) > 4):
                        return False
            # Add other condition types here (e.g. value checks)
        return True

    def _apply_effects(self, session_id: str, event: TriggerEvent):
        for effect in event.triggerEffects:
            if effect.type == "effectShowMessage":
                # In a real app, this would be pushed to a message queue or response
                print(f"SYSTEM MESSAGE: {effect.data}")
            
            elif effect.type == "effectSetTrackedItemValue":
                data = effect.data
                self.state_manager.update_item(session_id, data["trackedItemID"], data["newValue"])
            
            elif effect.type == "effectModifyInstructionBlock":
                data = effect.data
                self.state_manager.update_instruction(session_id, data["id"], data["content"])
