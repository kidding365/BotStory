'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { storage } from '@/engine/storage';
import { World, StoryInstance, ProviderConfig } from '@/engine/types';

export default function HomePage() {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [instances, setInstances] = useState<StoryInstance[]>([]);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    void (async () => {
      setWorlds(await storage.getAllWorlds());
      setInstances(await storage.getAllInstances());
      setProviders(storage.getAllProviders());
      setActiveId(storage.getActiveProviderId());
    })();
  }, []);

  const hasKey = providers.some((p) => p.apiKey && p.apiKey.length > 8);
  const activeProvider = providers.find((p) => p.id === activeId);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        <header className="space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-bold tracking-tight">BotStory</h1>
            <div className="flex gap-2 text-sm">
              <Link
                href="/worlds"
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
              >
                Open Library →
              </Link>
              <Link
                href="/settings"
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded"
              >
                ⚙ Settings
              </Link>
            </div>
          </div>
          <p className="text-zinc-400 max-w-2xl">
            An open, client-side, BYOK (Bring-Your-Own-Key) clone of{' '}
            <a className="underline" href="https://infiniteworlds.app" target="_blank" rel="noopener noreferrer">
              infiniteworlds.app
            </a>
            . Import an existing world JSON, pick an LLM, and start a story. Your keys never leave your browser.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatusCard
            label="BYOK status"
            ok={hasKey}
            okText="API key configured"
            warnText="No API key yet"
            hint={activeProvider ? `Active: ${activeProvider.label} (${activeProvider.model})` : 'Set one in Settings.'}
          />
          <StatusCard
            label="Worlds"
            ok={worlds.length > 0}
            okText={`${worlds.length} imported`}
            warnText="No worlds yet"
            hint="Import from JSON in the Library."
          />
          <StatusCard
            label="Story instances"
            ok={instances.length > 0}
            okText={`${instances.length} saved`}
            warnText="No active playthroughs"
            hint="Each game creates a save you can resume."
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">How it works</h2>
          <ol className="list-decimal list-inside text-zinc-300 space-y-2">
            <li>
              Go to <Link href="/settings" className="text-blue-400 underline">Settings</Link> and
              paste your Google AI Studio, OpenRouter, NVIDIA NIM, or any OpenAI-compatible
              API key. Stored in localStorage only.
            </li>
            <li>
              Open the <Link href="/worlds" className="text-blue-400 underline">World Library</Link>{' '}
              and either load the sample world or paste a JSON exported from infiniteworlds.app
              (turn on <em>Show raw JSON</em> in the World Editor → Misc advanced features).
            </li>
            <li>
              Click <strong>Play</strong>. Each turn, BotStory composes a prompt from the
              world schema (instructions + tracked items + active instruction blocks +
              keyword-triggered lore + recent history), sends it to your LLM, parses the
              JSON outcome, updates state, fires any matching triggers, and (if you set an
              image model) generates an illustration.
            </li>
            <li>
              Use the <strong>Storyteller Dashboard</strong> to peek at hidden state, the
              <strong> 🔄 Regenerate</strong> button to re-roll the last turn, and the
              <strong> 🎬 Image Instructions</strong> box to steer the look of the next
              illustration.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Recent playthroughs</h2>
          {instances.length === 0 ? (
            <p className="text-zinc-500 italic">No story instances yet. Start one from the World Library.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {instances.slice(0, 6).map((i) => {
                const w = worlds.find((x) => x.id === i.worldId);
                return (
                  <Link
                    key={i.id}
                    href={`/play?worldId=${i.worldId}&instanceId=${i.id}`}
                    className="p-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-zinc-100">{w?.title || 'Unknown world'}</div>
                      <div className="text-xs text-zinc-500">
                        Turn {i.turnNumber} · {i.ended ? 'Ended' : 'In progress'} · {new Date(i.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <span className="text-blue-400 text-sm">Resume →</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <footer className="text-xs text-zinc-600 border-t border-zinc-900 pt-4">
          BotStory runs entirely in your browser. Source on GitHub. Inspired by Infinite Worlds, not affiliated.
        </footer>
      </div>
    </main>
  );
}

function StatusCard({
  label,
  ok,
  okText,
  warnText,
  hint,
}: {
  label: string;
  ok: boolean;
  okText: string;
  warnText: string;
  hint: string;
}) {
  return (
    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-1">
      <div className="text-xs uppercase tracking-widest text-zinc-500">{label}</div>
      <div className={`text-lg font-semibold ${ok ? 'text-green-400' : 'text-amber-400'}`}>
        {ok ? okText : warnText}
      </div>
      <div className="text-xs text-zinc-500">{hint}</div>
    </div>
  );
}
