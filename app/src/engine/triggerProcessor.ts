import { World, StoryInstance, AIOutcome, TriggerEvent, TriggerEffect } from './types';

export interface TriggerResult {
  updatedInstance: StoryInstance;
  messages: string[];
  firedTriggerIds: string[];
  ended: boolean;
  endMessage?: string;
}

interface NormalizedCondition {
  type: 'event' | 'turn' | 'item' | 'random';
  payload: string;
}

interface NormalizedEffect {
  type: 'showMessage' | 'setValue' | 'modifyBlock' | 'endGame';
  payload: string | { itemId?: string; newValue?: string | number; blockId?: string; content?: string; text?: string; action?: string };
}

function normalizeCondition(c: TriggerEvent['triggerConditions'][number]): NormalizedCondition {
  if (c.type === 'triggerOnTurn') {
    return { type: 'turn', payload: c.data };
  }
  if (c.type === 'triggerOnItemValue') {
    return { type: 'item', payload: c.data };
  }
  if (c.type === 'triggerOnRandomChance') {
    return { type: 'random', payload: c.data };
  }
  return { type: 'event', payload: c.data };
}

function normalizeEffect(e: TriggerEffect): NormalizedEffect {
  const data = typeof e.data === 'string' ? e.data : e.data;
  switch (e.type) {
    case 'effectSetTrackedItemValue': {
      const d = (data as { action?: string; newValue?: string | number; trackedItemID?: string }) || {};
      return {
        type: 'setValue',
        payload: { itemId: d.trackedItemID, newValue: d.newValue, action: d.action || 'set' },
      };
    }
    case 'effectModifyInstructionBlock': {
      const d = (data as { id?: string; content?: string }) || {};
      return { type: 'modifyBlock', payload: { blockId: d.id, content: d.content } };
    }
    case 'effectEndGame':
      return { type: 'endGame', payload: { text: typeof data === 'string' ? data : '' } };
    case 'effectShowMessage':
    default:
      return { type: 'showMessage', payload: typeof data === 'string' ? data : JSON.stringify(data) };
  }
}

export class TriggerProcessor {
  processTriggers(world: World, instance: StoryInstance, outcome: AIOutcome): TriggerResult {
    let current = { ...instance };
    const messages: string[] = [];
    const fired: string[] = [];
    let ended = !!outcome.ended;
    let endMessage = outcome.endMessage;

    if (outcome.ended && outcome.endMessage) {
      ended = true;
      endMessage = outcome.endMessage;
    }

    for (const trigger of world.triggerEvents) {
      if (current.firedTriggers.includes(trigger.id)) continue;

      const conditions = trigger.triggerConditions.map(normalizeCondition);
      const allMatch = conditions.every((c) => this.evaluate(c, current, outcome));
      if (!allMatch) continue;

      const effects = trigger.triggerEffects.map(normalizeEffect);
      for (const eff of effects) {
        const r = this.apply(eff, current, world);
        current = r.instance;
        if (r.message) messages.push(r.message);
        if (r.ended) {
          ended = true;
          endMessage = r.endMessage || endMessage;
        }
      }
      current.firedTriggers = [...current.firedTriggers, trigger.id];
      fired.push(trigger.id);
    }

    return { updatedInstance: current, messages, firedTriggerIds: fired, ended, endMessage };
  }

  private evaluate(c: NormalizedCondition, instance: StoryInstance, outcome: AIOutcome): boolean {
    switch (c.type) {
      case 'event':
        return outcome.triggeredEvents.some((e) => this.fuzzy(e, c.payload));
      case 'turn': {
        const n = Number(c.payload);
        return Number.isFinite(n) && instance.turnNumber === n;
      }
      case 'item': {
        try {
          const parsed = JSON.parse(c.payload) as { trackedItemID: string; value?: string | number };
          const v = instance.currentValues[parsed.trackedItemID];
          return v === parsed.value;
        } catch {
          return false;
        }
      }
      case 'random': {
        const chance = Number(c.payload);
        return Math.random() * 100 <= (chance || 0);
      }
      default:
        return false;
    }
  }

  private fuzzy(eventLabel: string, conditionData: string): boolean {
    if (!eventLabel || !conditionData) return false;
    const e = eventLabel.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const c = conditionData.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (e === c) return true;
    if (c.includes(e) || e.includes(c)) return true;
    const eTokens = new Set(e.split('_').filter(Boolean));
    const cTokens = new Set(c.split('_').filter(Boolean));
    let overlap = 0;
    for (const t of eTokens) if (cTokens.has(t)) overlap++;
    return overlap >= Math.max(2, Math.floor(eTokens.size * 0.5));
  }

  private apply(
    effect: NormalizedEffect,
    instance: StoryInstance,
    world: World
  ): { instance: StoryInstance; message?: string; ended?: boolean; endMessage?: string } {
    if (effect.type === 'showMessage') {
      return { instance, message: String(effect.payload) };
    }
    if (effect.type === 'setValue') {
      const p = effect.payload as { itemId?: string; newValue?: string | number; action?: string };
      if (!p.itemId) return { instance };
      const ti = world.trackedItems.find((t) => t.id === p.itemId);
      const next = { ...instance.currentValues };
      if (ti?.dataType === 'number') {
        const n = typeof p.newValue === 'number' ? p.newValue : Number(p.newValue);
        if (p.action === 'increment' || p.action === '+=') {
          next[p.itemId] = (Number(next[p.itemId] ?? 0) || 0) + (Number.isFinite(n) ? n : 0);
        } else if (p.action === 'decrement' || p.action === '-=') {
          next[p.itemId] = (Number(next[p.itemId] ?? 0) || 0) - (Number.isFinite(n) ? n : 0);
        } else {
          next[p.itemId] = Number.isFinite(n) ? n : 0;
        }
      } else {
        next[p.itemId] = String(p.newValue ?? '');
      }
      return { instance: { ...instance, currentValues: next } };
    }
    if (effect.type === 'modifyBlock') {
      const p = effect.payload as { blockId?: string; content?: string };
      if (!p.blockId) return { instance };
      return {
        instance: {
          ...instance,
          modifiedBlocks: { ...instance.modifiedBlocks, [p.blockId]: p.content ?? '' },
        },
      };
    }
    if (effect.type === 'endGame') {
      const p = effect.payload as { text?: string };
      return { instance, ended: true, endMessage: p.text || 'The End' };
    }
    return { instance };
  }
}

export const triggerProcessor = new TriggerProcessor();
