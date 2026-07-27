import { ImageProviderConfig } from './types';

export interface ImageCallOptions {
  signal?: AbortSignal;
}

/**
 * Image client. Independent of TextClient so story and image can use different
 * providers (e.g. NVIDIA text via Worker + Cloudflare Flux image via Worker).
 *
 *   - 'none'             — disabled, returns null (no image gen).
 *   - 'gemini-imagen'    — browser-direct to Google (CORS-friendly).
 *   - 'cloudflare'       — via the Worker proxy (`/cfimage`). CF api.cloudflare.com
 *                          has no CORS for browser-direct so this needs the Worker.
 *   - 'custom'           — POST <endpoint> with the user's key + headers.
 */
export class ImageClient {
  async generate(
    config: ImageProviderConfig,
    prompt: string,
    opts: ImageCallOptions = {}
  ): Promise<string | null> {
    if (config.id === 'none' || !config.apiKey) return null;
    if (config.id === 'gemini-imagen') return this.geminiImage(config, prompt, opts);
    if (config.id === 'cloudflare') return this.cfImage(config, prompt, opts);
    if (config.id === 'custom') return this.customImage(config, prompt, opts);
    return null;
  }

  private async geminiImage(
    config: ImageProviderConfig,
    prompt: string,
    opts: ImageCallOptions
  ): Promise<string | null> {
    const model = config.model || 'imagen-4.0-fast-generate-001';
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
        signal: opts.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      const b64: string | undefined = data?.predictions?.[0]?.bytesBase64Encoded;
      if (!b64) return null;
      return `data:image/png;base64,${b64}`;
    } catch {
      return null;
    }
  }

  private async cfImage(
    config: ImageProviderConfig,
    prompt: string,
    opts: ImageCallOptions
  ): Promise<string | null> {
    const base = (config.endpoint || '').replace(/\/$/, '');
    if (!base) return null;
    if (!config.accountId) return null;
    const url = `${base}/cfimage`;
    const model = config.model || '@cf/black-forest-labs/flux-1-schnell';
    const fullPrompt = config.style ? `${config.style}, ${prompt}` : prompt;
    const body: Record<string, unknown> = {
      model,
      prompt: fullPrompt,
      steps: 4,
      seed: Math.floor(Math.random() * 1_000_000),
    };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': config.apiKey,
          'X-Account-Id': config.accountId,
        },
        body: JSON.stringify(body),
        signal: opts.signal,
      });
      if (!res.ok) {
        console.warn(`Cloudflare image HTTP ${res.status}: ${await res.text().catch(() => '')}`);
        return null;
      }
      const data = await res.json();
      const dataUrl: string | null = data?.image ?? null;
      // The Worker returns a ready data URI. Detect real mime by sniffing first bytes.
      if (dataUrl) return dataUrl;
      // Fallback: raw CF envelope has result.image (base64, no prefix).
      const b64: string | undefined = data?.result?.image;
      return b64 ? this.wrapDataUrl(b64) : null;
    } catch (e) {
      console.warn('Cloudflare image error:', (e as Error).message);
      return null;
    }
  }

  /**
   * Cloudflare returns base64 of the *actual* image bytes; the mime can be
   * jpeg/png depending on model. Sniff magic bytes to label the data URI
   * correctly so <img> and downloads render properly.
   */
  private wrapDataUrl(b64: string): string {
    let mime = 'image/png';
    if (b64.startsWith('/9j/')) mime = 'image/jpeg';
    else if (b64.startsWith('UklGR')) mime = 'image/webp';
    else if (b64.startsWith('iVBOR')) mime = 'image/png';
    return `data:${mime};base64,${b64}`;
  }

  private async customImage(
    config: ImageProviderConfig,
    prompt: string,
    opts: ImageCallOptions
  ): Promise<string | null> {
    const url = config.endpoint || '';
    if (!url) return null;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({ model: config.model, prompt }),
        signal: opts.signal,
      });
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.startsWith('image/')) {
        const blob = await res.blob();
        return await new Promise<string>((resolve) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.readAsDataURL(blob);
        });
      }
      const data = await res.json();
      const b64: string | undefined = data?.image ?? data?.result?.image ?? data?.data?.[0]?.b64_json;
      return b64 ? this.wrapDataUrl(b64.startsWith('data:') ? b64.split(',', 2)[1] : b64) : null;
    } catch {
      return null;
    }
  }
}

export const imageClient = new ImageClient();
