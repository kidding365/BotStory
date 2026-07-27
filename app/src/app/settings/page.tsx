'use client';

import { useState } from 'react';
import Link from 'next/link';
import { storage } from '@/engine/storage';
import {
  TextProviderId,
  TextProviderConfig,
  ImageProviderId,
  ImageProviderConfig,
  WorkerConfig,
} from '@/engine/types';

const TEXT_PRESETS: Record<TextProviderId, { label: string; defaultModel: string; endpoint?: string; placeholder: string; viaWorker?: boolean }> = {
  gemini: {
    label: 'Google AI Studio (Gemini)',
    defaultModel: 'gemini-2.5-flash',
    placeholder: 'AIza...',
  },
  openrouter: {
    label: 'OpenRouter',
    defaultModel: 'openai/gpt-4o-mini',
    placeholder: 'sk-or-...',
  },
  nvidia: {
    label: 'NVIDIA NIM',
    defaultModel: 'meta/llama-3.1-70b-instruct',
    placeholder: 'nvapi-...',
    viaWorker: true,
  },
  custom: {
    label: 'Custom (OpenAI-compatible)',
    defaultModel: 'gpt-4o-mini',
    placeholder: 'your-api-key',
  },
};

const IMAGE_PRESETS: Record<ImageProviderId, { label: string; defaultModel: string; placeholder: string; needsAccountId?: boolean; viaWorker?: boolean }> = {
  none: {
    label: 'Off (no images)',
    defaultModel: '',
    placeholder: '',
  },
  'gemini-imagen': {
    label: 'Gemini Imagen',
    defaultModel: 'imagen-4.0-fast-generate-001',
    placeholder: 'AIza... (same key as Gemini text)',
  },
  cloudflare: {
    label: 'Cloudflare Workers AI',
    defaultModel: '@cf/black-forest-labs/flux-1-schnell',
    placeholder: 'cfat_... (Cloudflare API token)',
    needsAccountId: true,
    viaWorker: true,
  },
  custom: {
    label: 'Custom image endpoint',
    defaultModel: '',
    placeholder: 'your-api-key',
  },
};

export default function SettingsPage() {
  const [textConfig, setTextConfig] = useState<TextProviderConfig>(() =>
    storage.getTextProvider() ?? storage.migrateTextProvider() ?? {
      id: 'gemini' as TextProviderId,
      label: TEXT_PRESETS.gemini.label,
      apiKey: '',
      model: TEXT_PRESETS.gemini.defaultModel,
    }
  );
  const [textSaved, setTextSaved] = useState(false);

  const [imageConfig, setImageConfig] = useState<ImageProviderConfig>(() =>
    storage.getImageProvider() ?? storage.migrateImageProvider() ?? {
      id: 'cloudflare' as ImageProviderId,
      label: IMAGE_PRESETS.cloudflare.label,
      apiKey: '',
      model: IMAGE_PRESETS.cloudflare.defaultModel,
      accountId: '',
    }
  );
  const [imageSaved, setImageSaved] = useState(false);

  const [workerConfig, setWorkerConfig] = useState<WorkerConfig>(() =>
    storage.getWorkerConfig() ?? { url: 'https://botstory-proxy.jainkumar365.workers.dev' }
  );
  const [workerSaved, setWorkerSaved] = useState(false);

  const updateText = (patch: Partial<TextProviderConfig>) => {
    const next = { ...textConfig, ...patch };
    setTextConfig(next);
    storage.saveTextProvider(next);
    setTextSaved(true);
    setTimeout(() => setTextSaved(false), 1800);
  };

  const updateImage = (patch: Partial<ImageProviderConfig>) => {
    const next = { ...imageConfig, ...patch };
    setImageConfig(next);
    storage.saveImageProvider(next);
    setImageSaved(true);
    setTimeout(() => setImageSaved(false), 1800);
  };

  const updateWorker = (url: string) => {
    const wc: WorkerConfig = { url };
    setWorkerConfig(wc);
    storage.saveWorkerConfig(wc);
    setWorkerSaved(true);
    setTimeout(() => setWorkerSaved(false), 1800);
  };

  const clearAll = () => {
    if (!confirm('Remove all API keys from this browser?')) return;
    storage.clearAllProviders();
    setTextConfig({ id: 'gemini', label: TEXT_PRESETS.gemini.label, apiKey: '', model: TEXT_PRESETS.gemini.defaultModel });
    setImageConfig({ id: 'cloudflare', label: IMAGE_PRESETS.cloudflare.label, apiKey: '', model: IMAGE_PRESETS.cloudflare.defaultModel, accountId: '' });
    setWorkerConfig({ url: '' });
  };

  const workerNeeded = textConfig.id === 'nvidia' || imageConfig.id === 'cloudflare';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Settings — BYOK</h1>
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200 underline">← Back to Worlds</Link>
        </header>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-2">
          <h2 className="text-lg font-semibold text-zinc-200">About Bring-Your-Own-Key</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            BotStory is 100% client-side. Your API keys are stored <strong>only in your browser&apos;s localStorage</strong>
            and sent directly to the provider — except for NVIDIA and Cloudflare Workers AI, which route through
            your own Cloudflare Worker (deploy once, free tier, BYOK). You can mix story and image providers
            independently.
          </p>
        </div>

        {/* ── Story AI ──────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Story AI (text)</h2>
          {(Object.keys(TEXT_PRESETS) as TextProviderId[]).map((id) => {
            const preset = TEXT_PRESETS[id];
            const isActive = textConfig.id === id;
            const ep = preset.viaWorker ? workerConfig.url : undefined;
            return (
              <div key={id} className={`bg-zinc-900 border rounded-xl p-5 space-y-3 ${isActive ? 'border-blue-500' : 'border-zinc-800'}`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="text-provider" checked={isActive} onChange={() => updateText({ id, label: preset.label, model: preset.defaultModel, endpoint: ep })} className="accent-blue-500" />
                  <span className="font-semibold">{preset.label}</span>
                </label>

                <input type="password" placeholder={`${preset.placeholder} — API key`}
                  value={isActive ? textConfig.apiKey : ''} onChange={(e) => updateText({ apiKey: e.target.value })}
                  className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white outline-none focus:ring-2 focus:ring-blue-500" />

                <div>
                  <label className="text-xs text-zinc-500">Model</label>
                  <input type="text" value={isActive ? textConfig.model : preset.defaultModel}
                    onChange={(e) => updateText({ model: e.target.value })}
                    className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white outline-none text-sm" />
                </div>

                {id === 'nvidia' && (
                  <div className="text-xs text-amber-300 bg-amber-950/30 border border-amber-800 rounded p-3">
                    NVIDIA NIM routes through the Worker proxy (below). Ensure the Worker URL is set.
                  </div>
                )}
                {id === 'custom' && (
                  <div>
                    <label className="text-xs text-zinc-500">Endpoint</label>
                    <input type="text" placeholder="https://your-provider/v1/chat/completions"
                      value={isActive ? textConfig.endpoint || '' : ''} onChange={(e) => updateText({ endpoint: e.target.value })}
                      className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white outline-none text-sm" />
                  </div>
                )}
              </div>
            );
          })}
          {textSaved && <span className="text-sm text-green-400">Story AI saved.</span>}
        </section>

        {/* ── Image AI ──────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Image AI</h2>
          {(Object.keys(IMAGE_PRESETS) as ImageProviderId[]).map((id) => {
            const preset = IMAGE_PRESETS[id];
            const isActive = imageConfig.id === id;
            return (
              <div key={id} className={`bg-zinc-900 border rounded-xl p-5 space-y-3 ${isActive ? 'border-blue-500' : 'border-zinc-800'}`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="image-provider" checked={isActive} onChange={() => {
                    const base: Partial<ImageProviderConfig> = { id, label: preset.label, model: preset.defaultModel };
                    if (id === 'cloudflare') base.endpoint = workerConfig.url;
                    updateImage(base);
                  }} className="accent-blue-500" />
                  <span className="font-semibold">{preset.label}</span>
                </label>

                {id !== 'none' && (
                  <>
                    <input type="password" placeholder={`${preset.placeholder} — API key`}
                      value={isActive ? imageConfig.apiKey : ''} onChange={(e) => isActive && updateImage({ apiKey: e.target.value })}
                      className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white outline-none focus:ring-2 focus:ring-blue-500" />

                    <div>
                      <label className="text-xs text-zinc-500">Model</label>
                      {id === 'cloudflare' ? (
                        <select value={isActive ? imageConfig.model : preset.defaultModel}
                          onChange={(e) => isActive && updateImage({ model: e.target.value })}
                          className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white outline-none text-sm">
                          <option value="@cf/black-forest-labs/flux-1-schnell">Flux.1 [schnell] — fast 4-step</option>
                          <option value="@cf/black-forest-labs/flux-2-klein-9b">Flux.2 [klein] 9B</option>
                          <option value="@cf/stabilityai/stable-diffusion-xl-1.0-timm">SDXL</option>
                          <option value="@cf/bytedance/stable-diffusion-xl-lightning">SDXL-Lightning</option>
                        </select>
                      ) : id === 'gemini-imagen' ? (
                        <select value={isActive ? imageConfig.model : preset.defaultModel}
                          onChange={(e) => isActive && updateImage({ model: e.target.value })}
                          className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white outline-none text-sm">
                          <option value="imagen-4.0-fast-generate-001">Imagen 4.0 Fast</option>
                          <option value="imagen-3.0-generate-002">Imagen 3.0</option>
                        </select>
                      ) : (
                        <input type="text" value={isActive ? imageConfig.model : preset.defaultModel}
                          onChange={(e) => isActive && updateImage({ model: e.target.value })}
                          className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white outline-none text-sm" />
                      )}
                    </div>

                    {id === 'cloudflare' && (
                      <div>
                        <label className="text-xs text-zinc-500">Cloudflare Account ID</label>
                        <input type="text" placeholder="a3e40b1b..."
                          value={isActive ? imageConfig.accountId || '' : ''} onChange={(e) => isActive && updateImage({ accountId: e.target.value })}
                          className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white outline-none text-sm" />
                        <p className="text-xs text-zinc-500 mt-1">Find this on your Cloudflare dashboard URL or in Workers AI → Use REST API.</p>
                      </div>
                    )}

                    {id === 'custom' && (
                      <div>
                        <label className="text-xs text-zinc-500">Endpoint</label>
                        <input type="text" placeholder="https://your-image-endpoint"
                          value={isActive ? imageConfig.endpoint || '' : ''} onChange={(e) => isActive && updateImage({ endpoint: e.target.value })}
                          className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white outline-none text-sm" />
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
          {imageSaved && <span className="text-sm text-green-400">Image AI saved.</span>}
        </section>

        {/* ── Worker proxy ──────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Worker proxy</h2>
          <p className="text-sm text-zinc-500">
            Required for NVIDIA text and Cloudflare Workers AI image — neither allows browser-direct
            CORS. Deploy <code className="text-blue-300">proxy/cloudflare-worker.js</code> once (~3 min, see README).
            The Worker forwards your key to the upstream provider server-side.
          </p>
          <div>
            <label className="text-xs text-zinc-500">Worker URL</label>
            <input type="text" placeholder="https://botstory-proxy.yourname.workers.dev"
              value={workerConfig.url} onChange={(e) => updateWorker(e.target.value)}
              className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white outline-none text-sm" />
          </div>
          {workerNeeded && !workerConfig.url && (
            <p className="text-xs text-amber-400">Worker URL is required for the selected provider mix.</p>
          )}
          {workerSaved && <span className="text-sm text-green-400">Worker saved.</span>}
        </section>

        <div className="flex items-center gap-3">
          <button onClick={clearAll}
            className="px-5 py-2 bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-200 rounded transition-colors">
            Clear all keys &amp; settings
          </button>
        </div>

        <p className="text-xs text-zinc-500 italic">
          Tip: Get a free Gemini key at{' '}
          <a className="underline" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/app/apikey</a>.
          Cloudflare Workers AI is free for 10,000 neurons/day.
        </p>
      </div>
    </div>
  );
}