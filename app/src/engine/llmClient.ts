/**
 * @deprecated Use textClient from './textClient' for story generation
 *             and imageClient from './imageClient' for image generation.
 *             This file is a backward-compat shim for existing callers
 *             during the migration from a single ProviderConfig.
 */
import type { AIOutcome, TextProviderConfig, TextProviderId } from './types';
import { textClient } from './textClient';
export { textClient };
export type { AIOutcome };

export interface LLMOptions {
  signal?: AbortSignal;
}

// Minimal compat export — `call` maps the old ProviderConfig shape to the new
// TextProviderConfig shape and delegates to textClient.
export const llmClient = {
  async call(config: { id: TextProviderId; label: string; apiKey: string; endpoint?: string; model: string }, systemPrompt: string, userPrompt: string, opts: { signal?: AbortSignal } = {}): Promise<AIOutcome> {
    const tc: TextProviderConfig = {
      id: config.id,
      label: config.label,
      apiKey: config.apiKey,
      model: config.model,
      endpoint: config.endpoint,
    };
    return textClient.call(tc, systemPrompt, userPrompt, opts);
  },
  async generateImage(config: { id: string; apiKey?: string; imageModel?: string; endpoint?: string }, prompt: string): Promise<string | null> {
    // Old callers that use generateImage should migrate to imageClient directly.
    console.warn('[deprecated] llmClient.generateImage is a stub — use imageClient.generate instead');
    void config; void prompt;
    return null;
  },
};