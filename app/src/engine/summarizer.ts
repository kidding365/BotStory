import { World, StoryInstance, TextProviderConfig } from './types';
import { TextClient } from './textClient';

/**
 * Periodic long-term memory summariser.
 *
 * Runs every N turns starting at turn START_TURN. Combines the existing
 * instance.summary (if any) with the turns since the last summaryTurn into a
 * fresh, compact summary. The world can override what to keep via
 * `World.summarizationInstructions` (otherwise a sensible default is used).
 *
 * Tunable triggers live in `summarizer.DEFAULTS`.
 */
export const SUMMARY_DEFAULTS = {
  startTurn: 8,
  every: 6,
  // How many recent (post-last-summary) turns to fold into the next summary.
  windowLookback: 12,
  // Soft cap on summary length so it doesn't itself grow quadratically.
  maxSummaryChars: 1500,
} as const;

export class Summarizer {
  /**
   * Should the summariser run after this turn completes?
   * True when `turnNumber` crossed START_TURN and a multiple of EVERY since the last summary.
   */
  shouldSummarise(world: World, instance: StoryInstance): boolean {
    if (instance.turnNumber < SUMMARY_DEFAULTS.startTurn) return false;
    const sinceLast = instance.turnNumber - (instance.summaryTurn || 0);
    return sinceLast >= SUMMARY_DEFAULTS.every;
  }

  /**
   * Run the summarisation call. Returns the updated instance (with summary + summaryTurn set)
   * or the original instance unchanged on any failure (summarisation is best-effort).
   */
  async run(
    world: World,
    instance: StoryInstance,
    textProvider: TextProviderConfig,
    opts: { signal?: AbortSignal; client?: TextClient } = {}
  ): Promise<StoryInstance> {
    if (!textProvider?.apiKey) return instance;
    const client = opts.client || new TextClient();

    const sinceTurn = instance.summaryTurn || 0;
    const windowStart = Math.max(0, instance.history.length - SUMMARY_DEFAULTS.windowLookback * 2);
    const recent = instance.history.slice(windowStart);
    if (recent.length < 2) return instance;

    const priorSummary = instance.summary || '';
    const historyText = recent
      .map((m) => `${m.role === 'user' ? 'Player' : 'Storyteller'}: ${m.content}`)
      .join('\n');

    const systemPrompt = [
      'You are a memory summariser for an interactive story engine.',
      'Compress the recent events into a concise running summary (aim for under 500 words).',
      'Keep key facts: locations, NPC relations, plot milestones, item states, character goals, and unresolved threads.',
      'Be neutral, specific, and avoid speculation.',
      world.summarizationInstructions
        ? `Author override:\n${world.summarizationInstructions}`
        : '',
      'Respond with plain prose — no JSON, no headers.',
    ]
      .filter(Boolean)
      .join('\n');

    const userPrompt = [
      priorSummary ? `PREVIOUS SUMMARY (turns 1–${sinceTurn}):\n${priorSummary}` : 'No prior summary.',
      '',
      `RECENT HISTORY (turns ${sinceTurn + 1}–${instance.turnNumber}):\n${historyText}`,
      '',
      'Write the new running summary covering turns 1 through this turn.',
    ].join('\n');

    try {
      const outcome = await client.call(textProvider, systemPrompt, userPrompt, {
        signal: opts.signal,
      });
      const summary = (outcome.narrative || '').trim();
      if (!summary) return instance;
      return {
        ...instance,
        summary: summary.slice(0, SUMMARY_DEFAULTS.maxSummaryChars),
        summaryTurn: instance.turnNumber,
      };
    } catch {
      return instance;
    }
  }
}

export const summarizer = new Summarizer();
