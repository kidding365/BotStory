import type { GameState, WorldSchema } from "../types/schema";

export class StateManager {
  private state: GameState | null = null;

  constructor() {
    this.loadFromStorage();
  }

  public createSession(world: WorldSchema, characterId: string): GameState {
    const character = world.possibleCharacters.find(c => c.characterId === characterId);
    if (!character) {
      throw new Error(`Character ${characterId} not found in world.`);
    }

    const currentValues: Record<string, any> = {};
    world.trackedItems.forEach(item => {
      currentValues[item.id] = item.initialValue;
    });

    const modifiedInstructions: Record<string, string> = {};
    world.instructionBlocks.forEach(block => {
      modifiedInstructions[block.id] = block.content;
    });

    this.state = {
      world,
      session: {
        character,
        currentValues,
        modifiedInstructions,
        firedTriggers: [],
        history: []
      }
    };

    this.saveToStorage();
    return this.state;
  }

  public getState(): GameState | null {
    return this.state;
  }

  public updateItem(itemId: string, newValue: any) {
    if (!this.state) return;
    this.state.session.currentValues[itemId] = newValue;
    this.saveToStorage();
  }

  public updateInstruction(blockId: string, newContent: string) {
    if (!this.state) return;
    this.state.session.modifiedInstructions[blockId] = newContent;
    this.saveToStorage();
  }

  public markTriggerFired(triggerId: string) {
    if (!this.state) return;
    if (!this.state.session.firedTriggers.includes(triggerId)) {
      this.state.session.firedTriggers.push(triggerId);
      this.saveToStorage();
    }
  }

  public addToHistory(role: "user" | "model", content: string, narrative?: string, images?: string[], suggestedActions?: string[]) {
    if (!this.state) return;
    this.state.session.history.push({ role, content, narrative, images, suggestedActions });
    this.saveToStorage();
  }

  private saveToStorage() {
    if (this.state) {
      localStorage.setItem("botstory_game_state", JSON.stringify(this.state));
    }
  }

  private loadFromStorage() {
    const saved = localStorage.getItem("botstory_game_state");
    if (saved) {
      try {
        this.state = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved state", e);
      }
    }
  }

  public clear() {
    this.state = null;
    localStorage.removeItem("botstory_game_state");
  }
}
