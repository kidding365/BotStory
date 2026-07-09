import { StoryInstance, AIOutcome, World } from './types';

export class StateManager {
  applyStateUpdates(instance: StoryInstance, outcome: AIOutcome, world: World): StoryInstance {
    const newValues: Record<string, string | number> = { ...instance.currentValues };
    const knownIds = new Set(world.trackedItems.map((t) => t.id));

    for (const [key, value] of Object.entries(outcome.stateUpdates || {})) {
      if (!knownIds.has(key)) continue;
      const ti = world.trackedItems.find((t) => t.id === key)!;
      if (ti.dataType === 'number') {
        const n = typeof value === 'number' ? value : Number(value);
        newValues[key] = Number.isFinite(n) ? n : 0;
      } else {
        newValues[key] = String(value ?? '');
      }
    }

    return {
      ...instance,
      currentValues: newValues,
    };
  }

  replaceVariables(text: string, values: Record<string, string | number>): string {
    return text.replace(/<<([\w_]+)>>/g, (_, key) => {
      return values[key]?.toString() || `<<${key}>>`;
    });
  }

  applyEndState(instance: StoryInstance, ended: boolean, endMessage?: string): StoryInstance {
    return { ...instance, ended, endMessage };
  }

  snapshot(instance: StoryInstance) {
    return {
      currentValues: { ...instance.currentValues },
      modifiedBlocks: { ...instance.modifiedBlocks },
      firedTriggers: [...instance.firedTriggers],
      turnNumber: instance.turnNumber,
      historyLength: instance.history.length,
    };
  }

  restore(instance: StoryInstance, snap: ReturnType<StateManager['snapshot']>): StoryInstance {
    return {
      ...instance,
      currentValues: { ...snap.currentValues },
      modifiedBlocks: { ...snap.modifiedBlocks },
      firedTriggers: [...snap.firedTriggers],
      turnNumber: snap.turnNumber,
      history: instance.history.slice(0, snap.historyLength),
    };
  }
}

export const stateManager = new StateManager();

export function serializeForExport(instance: StoryInstance) {
  return {
    worldId: instance.worldId,
    characterId: instance.characterId,
    currentValues: instance.currentValues,
    modifiedBlocks: instance.modifiedBlocks,
    firedTriggers: instance.firedTriggers,
    turnNumber: instance.turnNumber,
    history: instance.history,
    exportedAt: Date.now(),
  };
}
