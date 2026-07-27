import { World, StoryInstance, AIOutcome, EndCondition } from './types';

export interface VictoryDefeatResult {
  updatedInstance: StoryInstance;
  ended: boolean;
  endMessage?: string;
}

type EndKind = 'victory' | 'defeat';

export class VictoryDefeatProcessor {
  process(world: World, instance: StoryInstance, outcome: AIOutcome): VictoryDefeatResult {
    let current = { ...instance };
    let ended = false;
    let endMessage: string | undefined;

    for (const kind of ['victory', 'defeat'] as EndKind[]) {
      const cond: EndCondition =
        kind === 'victory' ? world.victoryCondition : world.defeatCondition;
      if (!cond || !cond.condition) continue;
      if (this.alreadyFired(current, kind)) continue;

      const fired = this.evaluate(cond, current, outcome, kind);
      if (fired) {
        current = this.markFired(current, kind);
        ended = true;
        endMessage = cond.text || endMessage;
      }
    }

    if (ended) {
      current.ended = true;
      current.endMessage = endMessage;
    }
    return { updatedInstance: current, ended, endMessage };
  }

  private alreadyFired(instance: StoryInstance, kind: EndKind): boolean {
    return Boolean(instance.firedTriggerOutcomes?.[kind]);
  }

  private evaluate(
    cond: EndCondition,
    instance: StoryInstance,
    outcome: AIOutcome,
    kind: EndKind
  ): boolean {
    if (this.matchesItemValue(cond.condition, instance)) return true;
    if (this.matchesEvaluation(outcome, kind)) return true;
    return false;
  }

  private matchesItemValue(condition: string, instance: StoryInstance): boolean {
    const trimmed = condition.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
    try {
      const parsed = JSON.parse(trimmed) as { trackedItemID?: string; value?: string | number };
      if (!parsed.trackedItemID) return false;
      const current = instance.currentValues[parsed.trackedItemID];
      if (current === undefined) return false;
      const expected =
        typeof current === 'number' ? Number(parsed.value) : String(parsed.value);
      return current === expected;
    } catch {
      return false;
    }
  }

  private matchesEvaluation(outcome: AIOutcome, kind: EndKind): boolean {
    const ev = outcome.evaluation;
    if (!ev) return false;
    const lower = String(ev).toUpperCase();
    if (kind === 'victory') return lower === 'SUCCESS';
    if (kind === 'defeat') return lower === 'FAILURE';
    return false;
  }

  private markFired(instance: StoryInstance, kind: EndKind): StoryInstance {
    const firedTriggerOutcomes = { ...(instance.firedTriggerOutcomes || {}) };
    firedTriggerOutcomes[kind] = true;
    return { ...instance, firedTriggerOutcomes };
  }
}

export const victoryDefeatProcessor = new VictoryDefeatProcessor();
