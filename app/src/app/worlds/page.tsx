'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { storage } from '@/engine/storage';
import { World, StoryInstance } from '@/engine/types';
import { importWorld, safeParseJson, SchemaImportError } from '@/engine/importer';

export default function WorldsPage() {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [instances, setInstances] = useState<StoryInstance[]>([]);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const ws = await storage.getAllWorlds();
    const ins = await storage.getAllInstances();
    setWorlds(ws);
    setInstances(ins);
  }

  async function handleImport() {
    setImportMessage(null);
    setImporting(true);
    try {
      const { value, error } = safeParseJson(importText);
      if (error || value == null) {
        throw new SchemaImportError(`Invalid JSON: ${error}`);
      }
      const { world, warnings } = importWorld(value);
      await storage.saveWorld(world);
      setImportText('');
      setImportMessage({
        kind: 'ok',
        text: `Imported "${world.title}". ${warnings.length ? 'Warnings: ' + warnings.join('; ') : ''}`,
      });
      await refresh();
    } catch (e) {
      setImportMessage({ kind: 'err', text: (e as Error).message });
    } finally {
      setImporting(false);
    }
  }

  async function handleFile(file: File) {
    setImportMessage(null);
    setImporting(true);
    try {
      const text = await file.text();
      setImportText(text);
      const { value, error } = safeParseJson(text);
      if (error || value == null) {
        throw new SchemaImportError(`Invalid JSON: ${error}`);
      }
      const { world, warnings } = importWorld(value);
      await storage.saveWorld(world);
      setImportMessage({
        kind: 'ok',
        text: `Imported "${world.title}" from ${file.name}. ${warnings.length ? 'Warnings: ' + warnings.join('; ') : ''}`,
      });
      await refresh();
    } catch (e) {
      setImportMessage({ kind: 'err', text: (e as Error).message });
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this world and all of its story instances?')) return;
    const ins = await storage.getInstancesByWorld(id);
    for (const i of ins) await storage.deleteInstance(i.id);
    await storage.deleteWorld(id);
    await refresh();
  }

  async function handleDeleteInstance(id: string) {
    if (!confirm('Delete this story instance?')) return;
    await storage.deleteInstance(id);
    await refresh();
  }

  function loadSample() {
    setImportText(JSON.stringify(SAMPLE_IW, null, 2));
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-5xl mx-auto space-y-10">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">World Library</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Import an Infinite Worlds JSON, or start from a sample.
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/settings" className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded">
              ⚙ Settings
            </Link>
            <Link href="/" className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded">
              Home
            </Link>
          </div>
        </header>

        <section>
          <h2 className="text-lg font-semibold mb-3">Your Worlds</h2>
          {worlds.length === 0 ? (
            <p className="text-zinc-500 italic">No worlds yet. Import one below or load the sample.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {worlds.map((w) => {
                const myInstances = instances.filter((i) => i.worldId === w.id);
                return (
                  <div key={w.id} className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-zinc-100">{w.title}</div>
                        <div className="text-xs text-zinc-500">
                          {w.source === 'infiniteworlds' ? 'InfiniteWorlds import' : 'Native'} · v{w.version || w.schemaVersion || '?'} · {w.trackedItems.length} items, {w.triggerEvents.length} triggers
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(w.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                        title="Delete world"
                      >
                        ✕
                      </button>
                    </div>
                    {w.description && (
                      <p className="text-xs text-zinc-400 line-clamp-3">{w.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/play?worldId=${w.id}`}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                      >
                        ▶ Play new
                      </Link>
                    </div>
                    {myInstances.length > 0 && (
                      <div className="border-t border-zinc-800 pt-2 space-y-1">
                        <div className="text-xs text-zinc-500">Saved playthroughs:</div>
                        {myInstances.map((i) => (
                          <div key={i.id} className="flex items-center justify-between text-xs">
                            <Link
                              href={`/play?worldId=${w.id}&instanceId=${i.id}`}
                              className="text-blue-400 hover:underline"
                            >
                              Turn {i.turnNumber} — {i.ended ? 'Ended' : 'In progress'}
                            </Link>
                            <button
                              onClick={() => handleDeleteInstance(i.id)}
                              className="text-red-400 hover:text-red-300"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Import World JSON</h2>
          <p className="text-sm text-zinc-500">
            Paste an exported world (e.g. from infiniteworlds.app — its &quot;Show raw JSON&quot; feature) or
            upload a file. BotStory will validate and adapt the schema automatically.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='Paste a world JSON here, e.g. an exported InfiniteWorlds schema…'
            className="w-full h-56 p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleImport}
              disabled={!importText.trim() || importing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded disabled:opacity-50"
            >
              {importing ? 'Importing…' : 'Import JSON'}
            </button>
            <button
              onClick={() => fileInput.current?.click()}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded"
            >
              Upload .json file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = '';
              }}
            />
            <button
              onClick={loadSample}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded"
            >
              Load sample world
            </button>
            {importMessage && (
              <span className={`text-sm ${importMessage.kind === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                {importMessage.text}
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const SAMPLE_IW = {
  id: 'sample_mystic_isle',
  title: 'The Mystic Isle',
  description: 'A short tutorial adventure to try out BotStory.',
  background:
    'You wash ashore on a strange island. The sand glitters faintly. To the north, a lighthouse. To the south, a dark forest. A small satchel is strapped to your waist.',
  instructions:
    'You are the protagonist of a low-fantasy adventure. The tone is curious and slightly mysterious. Keep scenes short (1-2 paragraphs) and end each turn with a clear sense of place. Always respect the player\'s agency.',
  authorStyle: 'a lyrical adventure novelist',
  firstInput: 'I look around and check my satchel.',
  objective: 'Escape the island or uncover its secret.',
  skills: ['Courage', 'Cunning', 'Empathy', 'Wits'],
  possibleCharacters: [
    {
      characterId: 'pc_default',
      name: 'Wanderer',
      description: 'A traveler of no fixed origin.',
      skills: { Courage: 3, Cunning: 2, Empathy: 3, Wits: 4 },
    },
  ],
  trackedItems: [
    {
      id: 'hp',
      name: 'Health',
      dataType: 'number',
      visibility: 'everyone',
      description: 'Your current health, 0-10.',
      updateInstructions: 'Decrease when the player is hurt. Set to 0 if the player dies.',
      initialValue: 10,
    },
    {
      id: 'inventory',
      name: 'Inventory',
      dataType: 'text',
      visibility: 'everyone',
      description: 'A list of items the player carries.',
      updateInstructions: 'Add items when picked up. Remove items when lost. Separate items with newlines, with a leading newline.',
      initialValue: '\nSatchel',
    },
    {
      id: 'clues',
      name: 'Clues',
      dataType: 'text',
      visibility: 'ai_only',
      description: 'Hidden notes the AI keeps about plot clues.',
      updateInstructions: 'Add any new plot clues the player uncovers. Be concise.',
      initialValue: '',
    },
  ],
  instructionBlocks: [
    {
      id: 'atmosphere',
      name: 'Atmosphere',
      content: 'The air tastes of salt and old magic. Time of day: dawn. The tide is going out.',
    },
  ],
  loreBookEntries: [
    {
      id: 'lighthouse',
      name: 'The Lighthouse',
      keywords: ['lighthouse', 'light', 'tower'],
      content:
        'The lighthouse is older than any map of this island. Its light has not been seen for fifty years, yet it glows tonight.',
    },
  ],
  triggerEvents: [
    {
      id: 'enter_lighthouse',
      name: 'Enter the Lighthouse',
      triggerConditions: [
        { type: 'triggerOnEvent', data: 'I enter the lighthouse' },
      ],
      triggerEffects: [
        { type: 'effectShowMessage', data: 'A spiral stair begins to glow under your feet.' },
        {
          type: 'effectModifyInstructionBlock',
          data: { id: 'atmosphere', content: 'Inside the lighthouse, dust swirls in slow columns. The light at the top pulses in time with your heartbeat.' },
        },
      ],
    },
  ],
  victoryCondition: {
    condition: 'The player uncovers the island\'s secret and escapes.',
    text: 'You step off the island — but you carry its memory forever.',
  },
  defeatCondition: {
    condition: 'The player\'s health reaches 0.',
    text: 'The tide claims you.',
  },
  mature: false,
  nsfw: false,
  schemaVersion: 2.1,
};
