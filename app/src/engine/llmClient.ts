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
    switch (config.id) {
      case 'gemini':
        return this.callGemini(config, systemPrompt, userPrompt, opts);
      case 'openrouter':
        return this.callOpenAICompatible(config, systemPrompt, userPrompt, opts, {
          url: 'https://openrouter.ai/api/v1/chat/completions',
          extraHeaders: {
            'HTTP-Referer': 'https://botstory.local',
            'X-Title': 'BotStory',
          },
          defaultModel: 'openai/gpt-4o-mini',
        });
      case 'nvidia':
        return this.callOpenAICompatible(config, systemPrompt, userPrompt, opts, {
          url: 'https://integrate.api.nvidia.com/v1/chat/completions',
          defaultModel: 'meta/llama-3.1-70b-instruct',
        });
      case 'custom':
        return this.callOpenAICompatible(config, systemPrompt, userPrompt, opts, {
          url: config.endpoint || '',
          defaultModel: 'gpt-4o-mini',
        });
      default:
        throw new Error(`Unsupported provider: ${config.id}`);
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
    try {
      return JSON.parse(trimmed) as AIOutcome;
    } catch {
      // try to find the first {...} block
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start === -1 || end === -1) {
        throw new Error('LLM did not return valid JSON.');
      }
      return JSON.parse(trimmed.slice(start, end + 1)) as AIOutcome;
    }
  }

  private async callGemini(
    config: ProviderConfig,
    systemPrompt: string,
    userPrompt: string,
    opts: LLMOptions
  ): Promise<AIOutcome> {
    const model = config.model || 'gemini-1.5-flash';
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

  private async geminiImage(config: ProviderConfig, prompt: string): Promise<string | null> {
    const model = config.imageModel || 'imagen-3.0-generate-002';
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
