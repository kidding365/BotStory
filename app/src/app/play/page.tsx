'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { storage } from '@/engine/storage';
import { World, StoryInstance, TurnMessage, UserAction, ProviderConfig, PossibleCharacter } from '@/engine/types';
import { orchestrator } from '@/engine/orchestrator';
import { defaultInstanceValues } from '@/engine/composer';
import { serializeForExport } from '@/engine/stateManager';
import { importWorld } from '@/engine/importer';

export default function PlayPageWrapper() {
  return (
    <Suspense fallback={<Centered>Loading…</Centered>}>
      <PlayPage />
    </Suspense>
  );
}

function PlayPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const worldId = sp.get('worldId');
  const instanceId = sp.get('instanceId');

  const [world, setWorld] = useState<World | null>(null);
  const [instance, setInstance] = useState<StoryInstance | null>(null);
  const [provider, setProvider] = useState<ProviderConfig | null>(null);
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const [showNarrativeOverride, setShowNarrativeOverride] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [char, setChar] = useState<PossibleCharacter | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Refs that always mirror the latest state so async callbacks (e.g. setTimeout
  // after init, or the auto firstInput trigger) read fresh values.
  const worldRef = useRef<World | null>(null);
  const instanceRef = useRef<StoryInstance | null>(null);
  const providerRef = useRef<ProviderConfig | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  useEffect(() => {
    worldRef.current = world;
  }, [world]);
  useEffect(() => {
    instanceRef.current = instance;
  }, [instance]);
  useEffect(() => {
    providerRef.current = provider;
  }, [provider]);

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [instance?.history.length]);

  async function init() {
    if (!worldId) {
      setError('No worldId in URL.');
      return;
    }
    const w = await storage.getWorld(worldId);
    if (!w) {
      setError('World not found. Go to the Library to import one.');
      return;
    }
    setWorld(w);
    worldRef.current = w;
    const p = storage.getProvider(storage.getActiveProviderId());
    setProvider(p);
    providerRef.current = p;

    if (instanceId) {
      const i = await storage.getInstance(instanceId);
      if (i) {
        setInstance(i);
        instanceRef.current = i;
        const c = w.possibleCharacters.find((x) => x.characterId === i.characterId) || null;
        setChar(c);
        return;
      }
    }
    // Create a new instance
    const characterId = w.possibleCharacters[0]?.characterId || null;
    const now = Date.now();
    const newInst: StoryInstance = {
      id: `inst_${now}`,
      worldId,
      characterId,
      currentValues: defaultInstanceValues(w, characterId),
      modifiedBlocks: {},
      firedTriggers: [],
      turnNumber: 0,
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    await storage.saveInstance(newInst);
    setInstance(newInst);
    instanceRef.current = newInst;
    setChar(w.possibleCharacters.find((c) => c.characterId === characterId) || null);

    // Auto-trigger firstInput if the world provides one.
    // Use refs so we read the latest provider+instance regardless of React batching.
    if (w.firstInput) {
      const activeProvider = providerRef.current;
      if (!activeProvider || !activeProvider.apiKey) {
        setError(
          `World has a "firstInput" (${w.firstInput.slice(0, 60)}…) but no API key is configured for the active provider (${activeProvider?.label ?? 'unknown'}). Open Settings to add one, then click Send.`
        );
      } else {
        // Defer to allow React to finish painting the initial UI before the request.
        setTimeout(() => {
          void doAction({ text: w.firstInput! });
        }, 400);
      }
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId, instanceId]);

  async function doAction(action: UserAction) {
    // Read fresh values from refs, never from stale closure.
    const w = worldRef.current;
    const inst = instanceRef.current;
    const prov = providerRef.current;

    if (!w || !inst || !prov) {
      setError(
        'Missing world, instance, or API key. Wait for the game to finish loading, then try again. ' +
          `state: w=${!!w}, i=${!!inst}, p=${!!prov}.`
      );
      return;
    }
    if (!prov.apiKey) {
      setError(`No API key set for ${prov.label}. Open Settings to add one.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await orchestrator.executeTurn(w.id, inst.id, action, prov, {
        generateImage: !!prov.imageModel,
      });
      setInstance(result.updatedInstance);
      instanceRef.current = result.updatedInstance;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    const w = worldRef.current;
    const inst = instanceRef.current;
    const prov = providerRef.current;
    if (!w || !inst || !prov) return;
    setBusy(true);
    setError('');
    try {
      const result = await orchestrator.regenerateLastTurn(
        w.id,
        inst.id,
        prov,
        undefined,
        { generateImage: !!prov.imageModel }
      );
      setInstance(result.updatedInstance);
      instanceRef.current = result.updatedInstance;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function exportInstance() {
    if (!instance) return;
    const data = serializeForExport(instance);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `botstory_${instance.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = String(fd.get('text') || '').trim();
    const image = String(fd.get('image') || '').trim();
    const override = String(fd.get('override') || '').trim();
    if (!text) return;
    e.currentTarget.reset();
    setShowImageInput(false);
    setShowNarrativeOverride(false);
    void doAction({ text, imageInstructions: image || undefined, narrativeOverride: override || undefined });
  }

  async function onImportWorld(text: string) {
    try {
      const { world: imported } = importWorld(JSON.parse(text));
      await storage.saveWorld(imported);
      router.push(`/play?worldId=${imported.id}`);
    } catch (e) {
      setError('Import failed: ' + (e as Error).message);
    }
  }

  if (!hydrated) return <Centered>Loading…</Centered>;

  if (error && !world) {
    return (
      <Centered>
        <div className="space-y-3 max-w-md text-center">
          <h1 className="text-2xl font-bold">Cannot start game</h1>
          <p className="text-zinc-400">{error}</p>
          <div className="flex gap-2 justify-center">
            <Link href="/worlds" className="px-4 py-2 bg-blue-600 rounded text-white">
              Open World Library
            </Link>
            <Link href="/settings" className="px-4 py-2 bg-zinc-800 rounded">
              Settings
            </Link>
          </div>
        </div>
      </Centered>
    );
  }

  if (!world || !instance) {
    return <Centered>Loading…</Centered>;
  }

  const suggested = instance.history.length
    ? instance.history[instance.history.length - 1].suggestedActions?.filter(Boolean) || []
    : [];

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60 gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{world.title}</h1>
            <div className="text-xs text-zinc-500 truncate">
              {char ? `Playing as ${char.name}` : 'No character selected'} · Turn {instance.turnNumber}
              {instance.ended ? ' · ENDED' : ''}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Link href="/worlds" className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded">
              ← Library
            </Link>
            <button
              onClick={regenerate}
              disabled={busy || instance.history.length < 2}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded disabled:opacity-50"
              title="Re-roll the last turn"
            >
              🔄
            </button>
            <button
              onClick={exportInstance}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded"
              title="Export this playthrough as JSON"
            >
              ⤓ Export
            </button>
            <button
              onClick={() => setShowImporter(true)}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded"
              title="Import a world JSON without leaving the page"
            >
              ⇪ Import
            </button>
            <button
              onClick={() => setShowDashboard(!showDashboard)}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded"
            >
              {showDashboard ? '✕ Dashboard' : '🛠 Dashboard'}
            </button>
          </div>
        </header>

        {error && (
          <div className="px-4 py-2 bg-red-900/30 border-b border-red-800 text-sm text-red-200">
            {error}
          </div>
        )}

        <div ref={historyRef} className="flex-1 overflow-y-auto p-6 space-y-6">
          {instance.history.length === 0 && (
            <div className="text-zinc-500 italic text-sm">
              {world.firstInput
                ? `The world suggests starting with: "${world.firstInput}". Sending automatically…`
                : 'Begin your adventure below.'}
            </div>
          )}
          {instance.history.map((m, i) => (
            <Message key={i} msg={m} />
          ))}
          {instance.ended && (
            <div className="p-4 bg-amber-900/30 border border-amber-700 rounded-lg text-amber-100">
              <div className="font-bold mb-1">— The End —</div>
              <div>{instance.endMessage}</div>
              <div className="mt-2 text-xs">
                <Link href="/worlds" className="underline">Start a new playthrough →</Link>
              </div>
            </div>
          )}
          {busy && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 text-zinc-400 p-3 rounded-2xl rounded-tl-none animate-pulse text-sm">
                Storyteller is thinking…
              </div>
            </div>
          )}
        </div>

        {!instance.ended && (
          <form
            onSubmit={onSubmit}
            className="border-t border-zinc-800 p-4 bg-zinc-900/70 space-y-2"
          >
            {showImageInput && (
              <input
                name="image"
                placeholder="Image steering: 'cinematic, dark, oil-painting'"
                className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-sm outline-none"
              />
            )}
            {showNarrativeOverride && (
              <textarea
                name="override"
                rows={2}
                placeholder="Narrative override (Storyteller mode): make the next scene happen exactly like this…"
                className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-sm outline-none"
              />
            )}
            {suggested.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggested.map((a, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => doAction({ text: a })}
                    disabled={busy}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-full text-sm text-zinc-200 disabled:opacity-50"
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowImageInput((v) => !v)}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm"
                title="Image instructions"
              >
                🎬
              </button>
              <button
                type="button"
                onClick={() => setShowNarrativeOverride((v) => !v)}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm"
                title="Narrative override (Storyteller mode)"
              >
                ✒
              </button>
              <input
                name="text"
                autoFocus
                disabled={busy}
                placeholder="What do you do?"
                className="flex-1 p-2 bg-zinc-800 border border-zinc-700 rounded outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        )}
      </div>

      {showDashboard && <StorytellerDashboard world={world} instance={instance} />}

      {showImporter && (
        <ModalImport
          onClose={() => setShowImporter(false)}
          onImport={async (t) => {
            await onImportWorld(t);
            setShowImporter(false);
          }}
        />
      )}
    </div>
  );
}

function Message({ msg }: { msg: TurnMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%] space-y-2">
        {!isUser && msg.imageDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={msg.imageDataUrl}
            alt="Illustration"
            className="rounded-xl border border-zinc-800 w-full max-w-md"
          />
        )}
        <div
          className={`p-4 rounded-2xl ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-none'
              : 'bg-zinc-800 text-zinc-100 rounded-tl-none border border-zinc-700'
          }`}
        >
          {isUser ? (
            <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div className="space-y-2">
              {msg.reasoning && (
                <details className="text-xs text-zinc-400">
                  <summary className="cursor-pointer">Reasoning</summary>
                  <div className="mt-1 whitespace-pre-wrap">{msg.reasoning}</div>
                </details>
              )}
              <div className="leading-relaxed whitespace-pre-wrap">{msg.content}</div>
              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="pt-2 border-t border-zinc-700 text-xs text-zinc-400">
                  <div className="mb-1">Suggested actions:</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {msg.suggestedActions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StorytellerDashboard({ world, instance }: { world: World; instance: StoryInstance }) {
  const publicItems = world.trackedItems.filter((t) => t.visibility !== 'ai_only');
  const aiOnlyItems = world.trackedItems.filter((t) => t.visibility === 'ai_only');
  return (
    <aside className="w-96 max-w-[40vw] bg-zinc-900 border-l border-zinc-800 h-full overflow-y-auto p-5 text-sm space-y-6">
      <h2 className="text-lg font-bold text-zinc-200">Storyteller Dashboard</h2>

      <section>
        <h3 className="text-xs uppercase tracking-widest text-zinc-500 mb-2">State — Public</h3>
        <div className="space-y-1">
          {publicItems.length === 0 && <p className="text-zinc-600 italic text-xs">No public items.</p>}
          {publicItems.map((t) => (
            <div key={t.id} className="flex justify-between p-2 bg-zinc-800 border border-zinc-700 rounded text-xs">
              <span className="text-zinc-400">{t.name}</span>
              <span className="font-mono text-blue-300">{String(instance.currentValues[t.id] ?? '')}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-widest text-zinc-500 mb-2">State — AI only</h3>
        <div className="space-y-1">
          {aiOnlyItems.length === 0 && <p className="text-zinc-600 italic text-xs">No hidden items.</p>}
          {aiOnlyItems.map((t) => (
            <div key={t.id} className="flex justify-between p-2 bg-zinc-800 border border-zinc-700 rounded text-xs">
              <span className="text-zinc-400">{t.name}</span>
              <span className="font-mono text-zinc-200">{String(instance.currentValues[t.id] ?? '')}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Active Instruction Blocks</h3>
        <div className="space-y-2">
          {world.instructionBlocks.length === 0 && <p className="text-zinc-600 italic text-xs">None.</p>}
          {world.instructionBlocks.map((b) => (
            <div key={b.id} className="p-2 bg-zinc-800 border border-zinc-700 rounded text-xs">
              <div className="text-zinc-500 font-bold mb-1">{b.name}</div>
              <div className="text-zinc-300 whitespace-pre-wrap">
                {instance.modifiedBlocks[b.id] || b.content}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Fired Triggers</h3>
        <div className="space-y-1 text-xs">
          {instance.firedTriggers.length === 0 && <p className="text-zinc-600 italic">No triggers fired yet.</p>}
          {instance.firedTriggers.map((id) => {
            const t = world.triggerEvents.find((x) => x.id === id);
            return (
              <div key={id} className="p-2 bg-zinc-800 border border-zinc-700 rounded">
                <span className="text-green-400">✓</span> {t?.name || id}
              </div>
            );
          })}
        </div>
      </section>
    </aside>
  );
}

function ModalImport({ onClose, onImport }: { onClose: () => void; onImport: (t: string) => Promise<void> }) {
  const [text, setText] = useState('');
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 w-full max-w-2xl space-y-3">
        <h3 className="text-lg font-bold">Import World JSON</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a world JSON here…"
          rows={12}
          className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono outline-none"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 bg-zinc-800 rounded text-sm">
            Cancel
          </button>
          <button
            onClick={() => onImport(text)}
            disabled={!text.trim()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-6">{children}</div>;
}
