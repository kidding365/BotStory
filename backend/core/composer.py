from typing import Dict, Any, List
from .state import StateManager

class PromptComposer:
    def __init__(self, state_manager: StateManager):
        self.state_manager = state_manager

    def assemble_prompt(self, session_id: str, user_input: str) -> str:
        session = self.state_manager.get_session(session_id)
        world = self.state_manager.world
        
        # 1. System Core
        prompt = "You are a world-class novelist and the engine for an interactive story.\n"
        prompt += "Format your response as follows:\n[Narrative]\n\n[State Updates]\n\n[Suggested Actions]\n\n"
        
        # 2. World Constants
        prompt += f"\nWORLD SETTING: {world.title}\n"
        prompt += f"BACKGROUND: {world.background}\n"
        prompt += f"CORE INSTRUCTIONS: {world.instructions}\n"
        prompt += f"AUTHOR STYLE: {world.authorStyle}\n"
        
        # 3. Dynamic Instructions
        prompt += "\nCURRENT STORY TRUTHS:\n"
        for block_id, content in session["modified_instructions"].items():
            prompt += f"- {content}\n"
            
        # 4. State Injection
        prompt += "\nWORLD STATE:\n"
        for item_id, value in session["current_values"].items():
            item_def = next((i for i in world.trackedItems if i.id == item_id), None)
            if item_def:
                prompt += f"- {item_def.name}: {value} (Update rule: {item_def.updateInstructions})\n"
        
        # 5. Character Profile
        char = session["character"]
        prompt += f"\nPLAYER CHARACTER: {char.name}\n"
        prompt += f"DESCRIPTION: {char.description}\n"
        prompt += f"SKILLS: {char.skills}\n"
        
        # 6. Lore (Simple keyword match for now)
        prompt += "\nRELEVANT LORE:\n"
        for entry in world.loreBookEntries:
            if any(kw.lower() in user_input.lower() for kw in entry.keywords):
                prompt += f"- {entry.name}: {entry.content}\n"
                
        # 7. User Input
        prompt += f"\nUSER ACTION: {user_input}\n"
        
        return prompt
