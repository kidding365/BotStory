import type { TriggerEvent } from "../types/schema";
import { StateManager } from "./StateManager";

export class TriggerProcessor {
  private stateManager: StateManager;
  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  public processTriggers(latestNarrative: string): string[] {
    const state = this.stateManager.getState();
    if (!state) return [];

    const firedThisTurn: string[] = [];
    const world = state.world;
    const session = state.session;

    for (const event of world.triggerEvents || []) {
      if (session.firedTriggers.includes(event.id)) {
        continue;
      }

      if (this.evaluateConditions(event, latestNarrative)) {
        this.applyEffects(event);
        this.stateManager.markTriggerFired(event.id);
        firedThisTurn.push(event.name);
      }
    }

    return firedThisTurn;
  }

  private evaluateConditions(event: TriggerEvent, narrative: string): boolean {
    if (!event.triggerConditions) return false;
    for (const condition of event.triggerConditions) {
      if (condition.type === "triggerOnEvent") {
        // Simple keyword-based heuristic for now, as in the backend reference.
        // In a full implementation, this might involve an LLM call or advanced NLP.
        const keywords = (condition.data as string).toLowerCase().split(/\s+/);
        const match = keywords.some(kw => kw.trim().length > 0 && narrative.toLowerCase().includes(kw.trim()));
        if (!match) return false;
      }
      // Add other condition types as needed
    }
    return true;
  }

  private applyEffects(event: TriggerEvent) {
    if (!event.triggerEffects) return;
    for (const effect of event.triggerEffects) {
      switch (effect.type) {
        case "effectShowMessage":
          // Handle UI notification elsewhere or via a callback
          console.log("SYSTEM MESSAGE:", effect.data);
          break;
        case "effectSetTrackedItemValue":
          this.stateManager.updateItem(effect.data.trackedItemID, effect.data.newValue);
          break;
        case "effectModifyInstructionBlock":
          this.stateManager.updateInstruction(effect.data.id, effect.data.content);
          break;
      }
    }
  }
}
