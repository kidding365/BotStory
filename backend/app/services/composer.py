from typing import List, Dict, Any, Optional
from .models.world import WorldSchema, StoryInstance

class PromptComposer:
    def __init__(self, world: WorldSchema, instance: StoryInstance, history: List[Any]):
        self.world = world
        self.instance = instance
        self.history = history

    def assemble_system_prompt(self) -> str:
        """Assembles the core instructions for the AI."""
        prompt = f"You are a world-class novelist. Style: {self.world.authorStyle}\n"
        prompt += f"World Setting: {self.world.title}\n"
        prompt += f"Background: {self.world.background}\n"
        prompt += f"Core Instructions: {self.world.instructions}\n"
        
        # Add active instruction blocks
        prompt += "\nCURRENT WORLD TRUTHS:\n"
        for block_id, content in self.instance.modified_instructions.items():
            prompt += f"- {content}\n"
            
        return prompt

    def assemble_state_context(self) -> str:
        """Assembles the current state of the world."""
        state_str = "\nCURRENT WORLD STATE:\n"
        for item in self.world.trackedItems:
            val = self.instance.current_values.get(item['id'], item.get('initialValue', ''))
            state_str += f"- {item['name']}: {val} (Rule: {item['updateInstructions']})\n"
        return state_str

    def assemble_visual_prompt(self, user_image_instr: Optional[str] = None) -> str:
        """
        Merges Image Instructions with base styles.
        Prioritizes user instructions but keeps character/setting context.
        """
        # 1. Base character guidance (from world schema)
        # 2. Base setting guidance (from world schema)
        # 3. User-provided specific instructions (Highest Priority)
        
        base_guidance = "High-quality medieval fantasy style." # Simplified for now
        
        if user_image_instr:
            return f"{user_image_instr}. {base_guidance}"
        
        return base_guidance

    def assemble_final_prompt(self, user_input: str, user_image_instr: Optional[str] = None) -> Dict[str, str]:
        """
        Constructs the final payload for the LLM.
        Supports a 'Thinking' block request.
        """
        system = self.assemble_system_prompt()
        state = self.assemble_state_context()
        
        # Last 8 turns verbatim
        recent_history = "\n".join([f"User: {t.user_input}\nAI: {t.narrative_output}" for t in self.history[-8:]])
        
        final_prompt = (
            f"{system}\n{state}\n"
            f"RECENT HISTORY:\n{recent_history}\n\n"
            f"USER ACTION: {user_input}\n\n"
            f"RESPONSE FORMAT:\n"
            f"Please respond in JSON format with the following keys:\n"
            f"{{ 'reasoning': 'Your internal thinking process', 'narrative': 'The story text', "
            f"'image_variables': {{ 'subject': '...', 'setting': '...' }}, "
            f"'suggested_actions': ['...', '...', '...'], "
            f"'state_updates': {{ 'item_id': 'new_value' }}, "
            f"'secret_info': '...', 'trigger_events': ['event_id'] }}"
        )
        
        return {
            "prompt": final_prompt,
            "visual_prompt": self.assemble_visual_prompt(user_image_instr)
        }
