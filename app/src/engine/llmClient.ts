import { AIOutcome, ProviderConfig } from './types';

export interface LLMOptions {
  signal?: AbortSignal;
}

export class LLMClient {
  async call(
    config: ProviderConfig,
    systemPrompt: string,
    userPrompt: string,
    opts: LLMOptions = {}
  ): Promise<AIOutcome> {
    try {
      switch (config.id) {
        case 'gemini':
          return await this.callGemini(config, systemPrompt, userPrompt, opts);
        case 'openrouter':
          return await this.callOpenAICompatible(config, systemPrompt, userPrompt, opts, {
            url: 'https://openrouter.ai/api/v1/chat/completions',
            extraHeaders: {
              'HTTP-Referer': 'https://botstory.local',
              'X-Title': 'BotStory',
            },
            defaultModel: 'openai/gpt-4o-mini',
          });
        case 'nvidia':
          return await this.callNvidia(config, systemPrompt, userPrompt, opts);
        case 'custom':
          return await this.callOpenAICompatible(config, systemPrompt, userPrompt, opts, {
            url: config.endpoint || '',
            defaultModel: 'gpt-4o-mini',
          });
        default:
          throw new Error(`Unsupported provider: ${config.id}`);
      }
    } catch (e) {
      const msg = (e as Error).message || String(e);
      // Browser throws a generic "Failed to fetch" / "NetworkError" on CORS
      // failures. Surface a clearer hint for the providers known to be blocked.
      if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
        if (config.id === 'nvidia') {
          throw new Error(
            'Network error reaching NVIDIA. NVIDIA integrate.api.nvidia.com does NOT allow browser-direct CORS requests, so it cannot be used from a static GitHub Pages deployment without a small proxy. ' +
              'Either switch to Gemini / OpenRouter / Custom, or deploy the included Cloudflare Worker (~5 min, free tier) and point the Custom provider at it. See README › "NVIDIA via a Cloudflare Worker".'
          );
        }
        throw new Error(
          'Network error reaching the LLM provider (likely CORS or offline). ' +
            'If you are using a custom endpoint, ensure it allows Access-Control-Allow-Origin for this site. ' +
            `(provider: ${config.label})`
        );
      }
      throw e;
    }
  }

  async generateImage(
    config: ProviderConfig,
    prompt: string
  ): Promise<string | null> {
    if (config.id === 'gemini') {
      return this.geminiImage(config, prompt);
    }
    return null;
  }

  private buildSchema() {
    return `{
  "reasoning": "string (chain of thought, hidden from the player)",
  "evaluation": "SUCCESS" | "FAILURE" | "DENIED",
  "whereWhen": "string (current time and place)",
  "narrative": "string (2-6 paragraphs of rich, in-character narrative)",
  "stateUpdates": { "<trackedItemId>": <newValue matching the tracked item data type> },
  "visualVariables": { "subject": "string", "appearance": "string", "setting": "string", "expression": "string", "isCharacter": true|false },
  "visualPrompt": "string (a single composite prompt that merges subject + appearance + setting)",
  "suggestedActions": ["action 1", "action 2", "action 3"],
  "triggeredEvents": ["event1", "event2"],
  "ended": false,
  "endMessage": ""
}`;
  }

  private extractJson(text: string): AIOutcome {
    const trimmed = text.trim();
    // First try direct parse
    try {
      return JSON.parse(trimmed) as AIOutcome;
    } catch {
      // Try to extract a balanced JSON object
      const extracted = this.findBalancedJson(trimmed);
      if (extracted) {
        try {
          return JSON.parse(extracted) as AIOutcome;
        } catch {
          // fall through
        }
      }
      // Last resort: try to fix common issues (trailing commas, etc.)
      const fixed = this.fixCommonJsonIssues(trimmed);
      try {
        return JSON.parse(fixed) as AIOutcome;
      } catch {
        // give up
        throw new Error(`LLM did not return valid JSON. Raw response (first 500 chars): ${trimmed.slice(0, 500)}`);
      }
    }
  }

  private findBalancedJson(text: string): string | null {
    let depth = 0;
    let start = -1;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          return text.slice(start, i + 1);
        }
        if (depth < 0) return null;
      }
    }
    return null;
  }

  private fixCommonJsonIssues(text: string): string {
    // Remove markdown code fences if present
    let t = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    // Fix trailing commas in objects/arrays
    t = t.replace(/,(\s*[}\]])/g, '$1');
    // Fix single quotes to double quotes (simple cases)
    t = t.replace(/'([^']*)':/g, '"$1":');
    // Remove any trailing text after the closing brace of the main object
    const lastBrace = t.lastIndexOf('}');
    if (lastBrace !== -1 && lastBrace < t.length - 1) {
      t = t.slice(0, lastBrace + 1);
    }
    return t;
  }

  private async callGemini(
    config: ProviderConfig,
    systemPrompt: string,
    userPrompt: string,
    opts: LLMOptions
  ): Promise<AIOutcome> {
    const model = config.model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      systemInstruction: {
        role: 'system',
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.9,
      },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error: ${res.status} ${err}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned no content.');
    return this.extractJson(text);
  }

  private async callOpenAICompatible(
    config: ProviderConfig,
    systemPrompt: string,
    userPrompt: string,
    opts: LLMOptions,
    cfg: { url: string; defaultModel: string; extraHeaders?: Record<string, string> }
  ): Promise<AIOutcome> {
    const url = cfg.url || config.endpoint || '';
    if (!url) {
      throw new Error('Provider endpoint is not configured.');
    }
    const model = config.model || cfg.defaultModel;
    const body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt + '\n\nIMPORTANT: Respond ONLY with a JSON object matching this schema:\n' + this.buildSchema() },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.9,
    };
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    };
    if (cfg.extraHeaders) Object.assign(headers, cfg.extraHeaders);

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LLM API error (${url}): ${res.status} ${err}`);
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('LLM returned no content.');
    return this.extractJson(text);
  }

  /**
   * NVIDIA NIM does not allow browser-direct CORS requests. If you've deployed
   * the included Cloudflare Worker (`/proxy/cloudflare-worker.js`), point
   * `config.endpoint` (the Custom provider endpoint input) at the worker URL,
   * and we'll forward the Authorization header server-side. If no proxy is
   * configured, this will fail with a clear hint.
   */
  private async callNvidia(
    config: ProviderConfig,
    systemPrompt: string,
    userPrompt: string,
    opts: LLMOptions
  ): Promise<AIOutcome> {
    const proxyUrl = config.endpoint?.trim();
    if (!proxyUrl) {
      throw new Error(
        'NVIDIA NIM requires the Custom provider "endpoint" field to point at a small CORS proxy (e.g. the included Cloudflare Worker). ' +
          'Go to Settings → Custom → Endpoint and paste your Worker URL, then click the radio button on "Custom" instead of "NVIDIA NIM". ' +
          'See README › "NVIDIA via a Cloudflare Worker".'
      );
    }
    // Forward to the proxy. The worker accepts the same OpenAI-shape body,
    // adds the server-side NVIDIA Authorization header, and returns the OpenAI-shape response.
    return this.callOpenAICompatible(config, systemPrompt, userPrompt, opts, {
      url: proxyUrl,
      defaultModel: config.model || 'meta/llama-3.1-70b-instruct',
    });
  }

  private async geminiImage(config: ProviderConfig, prompt: string): Promise<string | null> {
    const model = config.imageModel || 'imagen-4.0-fast-generate-001';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predict?key=${encodeURIComponent(config.apiKey)}`;
    const body = {
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '16:9' },
    };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        return null;
      }
      const data = await res.json();
      const b64: string | undefined = data?.predictions?.[0]?.bytesBase64Encoded;
      if (!b64) return null;
      return `data:image/png;base64,${b64}`;
    } catch {
      return null;
    }
  }
}

export const llmClient = new LLMClient();
