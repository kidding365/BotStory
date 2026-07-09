'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { storage } from '@/engine/storage';
import { ProviderConfig, ProviderId } from '@/engine/types';

const PRESETS: Record<ProviderId, { label: string; defaultModel: string; defaultImageModel?: string; endpoint?: string; placeholder: string }> = {
  gemini: {
    label: 'Google AI Studio (Gemini)',
    defaultModel: 'gemini-1.5-flash',
    defaultImageModel: 'imagen-3.0-generate-002',
    placeholder: 'AIza...',
  },
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    placeholder: 'sk-...',
  },
  anthropic: {
    label: 'Anthropic Claude',
    defaultModel: 'claude-3-5-sonnet-latest',
    placeholder: 'sk-ant-...',
  },
  openrouter: {
    label: 'OpenRouter',
    defaultModel: 'openai/gpt-4o-mini',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    placeholder: 'sk-or-...',
  },
  custom: {
    label: 'Custom (OpenAI-compatible)',
    defaultModel: 'gpt-4o-mini',
    placeholder: 'your-api-key',
  },
};

export default function SettingsPage() {
  const [providers, setProviders] = useState<Record<string, ProviderConfig>>({});
  const [activeId, setActiveId] = useState<ProviderId>('gemini');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Defer into a microtask so setState isn't called during the effect synchronously.
    const all = storage.getAllProviders();
    const map: Record<string, ProviderConfig> = {};
    for (const p of all) map[p.id] = p;
    queueMicrotask(() => {
      setProviders(map);
      setActiveId(storage.getActiveProviderId());
    });
  }, []);

  const updateProvider = (id: ProviderId, patch: Partial<ProviderConfig>) => {
    setProviders((prev) => {
      const cur: ProviderConfig = prev[id] || {
        id,
        label: PRESETS[id].label,
        apiKey: '',
        model: PRESETS[id].defaultModel,
        imageModel: PRESETS[id].defaultImageModel,
        endpoint: PRESETS[id].endpoint,
      };
      const next = { ...cur, ...patch, id, label: PRESETS[id].label };
      storage.saveProvider(next);
      return { ...prev, [id]: next };
    });
    setSaved(false);
  };

  const saveAll = () => {
    for (const p of Object.values(providers)) storage.saveProvider(p);
    storage.setActiveProvider(activeId);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const clearAll = () => {
    if (!confirm('Remove all API keys from this browser?')) return;
    storage.clearAllProviders();
    setProviders({});
    setActiveId('gemini');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Settings — BYOK</h1>
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200 underline">
            ← Back to Worlds
          </Link>
        </header>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-2">
          <h2 className="text-lg font-semibold text-zinc-200">About Bring-Your-Own-Key</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            BotStory is 100% client-side. Your API keys are stored <strong>only in your browser&apos;s
            localStorage</strong>. They are sent directly from your browser to your chosen LLM provider when
            a turn is generated. Nothing is proxied through any third-party server. You can use
            Google AI Studio (Gemini) for free, OpenAI, Anthropic, OpenRouter, or any OpenAI-compatible
            endpoint.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Providers</h2>
          {(Object.keys(PRESETS) as ProviderId[]).map((id) => {
            const cfg = providers[id] || {
              id,
              label: PRESETS[id].label,
              apiKey: '',
              model: PRESETS[id].defaultModel,
              imageModel: PRESETS[id].defaultImageModel,
              endpoint: PRESETS[id].endpoint,
            };
            return (
              <div
                key={id}
                className={`bg-zinc-900 border rounded-xl p-5 space-y-3 ${
                  activeId === id ? 'border-blue-500' : 'border-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="active-provider"
                      checked={activeId === id}
                      onChange={() => {
                        setActiveId(id);
                        storage.setActiveProvider(id);
                      }}
                      className="accent-blue-500"
                    />
                    <span className="font-semibold">{PRESETS[id].label}</span>
                  </label>
                  <span className="text-xs text-zinc-500">ID: {id}</span>
                </div>

                <input
                  type="password"
                  placeholder={`${PRESETS[id].placeholder} — API key`}
                  value={cfg.apiKey}
                  onChange={(e) => updateProvider(id, { apiKey: e.target.value })}
                  className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white outline-none focus:ring-2 focus:ring-blue-500"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500">Text model</label>
                    <input
                      type="text"
                      value={cfg.model}
                      onChange={(e) => updateProvider(id, { model: e.target.value })}
                      className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500">Image model (optional)</label>
                    <input
                      type="text"
                      placeholder="imagen-3.0-generate-002"
                      value={cfg.imageModel || ''}
                      onChange={(e) => updateProvider(id, { imageModel: e.target.value })}
                      className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white outline-none text-sm"
                    />
                  </div>
                </div>

                {(id === 'custom' || id === 'openrouter') && (
                  <div>
                    <label className="text-xs text-zinc-500">Endpoint</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={cfg.endpoint || ''}
                      onChange={(e) => updateProvider(id, { endpoint: e.target.value })}
                      className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white outline-none text-sm"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={saveAll}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition-colors"
          >
            Save
          </button>
          <button
            onClick={clearAll}
            className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded transition-colors"
          >
            Clear all keys
          </button>
          {saved && <span className="text-sm text-green-400">Saved.</span>}
        </div>

        <p className="text-xs text-zinc-500 italic">
          Tip: Get a free Gemini key at{' '}
          <a className="underline" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
            aistudio.google.com/app/apikey
          </a>
          . Your active provider above will be used for all new story turns.
        </p>
      </div>
    </div>
  );
}
