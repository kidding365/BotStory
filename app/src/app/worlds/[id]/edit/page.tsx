'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { storage } from '@/engine/storage';
import {
  World,
  InstructionBlock,
  TrackedItem,
  TriggerEvent,
  TriggerCondition,
  TriggerEffect,
  EndCondition,
} from '@/engine/types';

export default function EditWorldPageWrapper() {
  return (
    <Suspense fallback={<Centered>Loading…</Centered>}>
      <EditWorldPage />
    </Suspense>
  );
}

const newId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

function normalizeWorld(w: World): World {
  return {
    ...w,
    instructionBlocks: w.instructionBlocks?.length ? w.instructionBlocks : [],
    trackedItems: w.trackedItems?.length ? w.trackedItems : [],
    triggerEvents: w.triggerEvents?.length ? w.triggerEvents : [],
    loreBookEntries: w.loreBookEntries?.length ? w.loreBookEntries : [],
    possibleCharacters: w.possibleCharacters?.length ? w.possibleCharacters : [],
    skills: w.skills || [],
    victoryCondition: w.victoryCondition || { condition: '', text: '' },
    defeatCondition: w.defeatCondition || { condition: '', text: '' },
  };
}

function EditWorldPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const id = sp.get('id');
  const [world, setWorld] = useState<World | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({ general: true, victory: true });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  useEffect(() => {
    void (async () => {
      if (!id) return;
      const w = await storage.getWorld(id);
      if (!w) {
        setError('World not found.');
        return;
      }
      setWorld(normalizeWorld(w));
    })();
  }, [id]);

  async function save() {
    if (!world) return;
    setError('');
    setSaving(true);
    try {
      await storage.saveWorld(world);
      setSavedAt(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function saveAndPlay() {
    void (async () => {
      await save();
      if (world) router.push(`/play?worldId=${world.id}`);
    })();
  }

  // Field setters — keep edits immutable at the top level so React state churns cleanly.
  function setField<K extends keyof World>(k: K, v: World[K]) {
    setWorld((w) => (w ? { ...w, [k]: v } : w));
  }

  if (!hydrated) return <Centered>Loading…</Centered>;
  if (error && !world) return <Centered>{error}</Centered>;
  if (!world) return <Centered>Loading…</Centered>;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs text-zinc-500">Editing world</div>
            <h1 className="text-xl font-bold truncate">{world.title || '(untitled)'}</h1>
          </div>
          <div className="flex gap-2 text-sm shrink-0">
            <Link href="/worlds" className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded">
              ← Library
            </Link>
            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded disabled:opacity-50"
              title="Save without leaving"
            >
              {saving ? 'Saving…' : '💾 Save'}
            </button>
            <button
              onClick={saveAndPlay}
              disabled={saving}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
            >
              ▶ Save & Play
            </button>
          </div>
        </header>

        {error && <div className="px-3 py-2 bg-red-900/40 border border-red-800 text-sm text-red-200 rounded">{error}</div>}
        {savedAt && (
          <div className="px-3 py-2 bg-green-900/30 border border-green-800 text-sm text-green-200 rounded">
            Saved at {new Date(savedAt).toLocaleTimeString()}.
          </div>
        )}

        <Card title="Introducing the story" open={open.general} onToggle={() => toggle('general')}>
          <Field label="Title">
            <input
              value={world.title}
              onChange={(e) => setField('title', e.target.value)}
              className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded text-sm outline-none"
            />
          </Field>
          <Field label="Description (short pitch)">
            <textarea
              value={world.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={2}
              className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded text-sm outline-none"
            />
          </Field>
          <Field label="Background (opening scene setup)">
            <textarea
              value={world.background}
              onChange={(e) => setField('background', e.target.value)}
              rows={3}
              className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded text-sm outline-none"
            />
          </Field>
          <Field label="Objective (shown once on turn 1)">
            <textarea
              value={world.objective}
              onChange={(e) => setField('objective', e.target.value)}
              rows={2}
              className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded text-sm outline-none"
            />
          </Field>
          <Field label="Main instructions">
            <textarea
              value={world.instructions}
              onChange={(e) => setField('instructions', e.target.value)}
              rows={4}
              className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded text-sm outline-none"
            />
          </Field>
          <Field label="Author style (one phrase)">
            <input
              value={world.authorStyle}
              onChange={(e) => setField('authorStyle', e.target.value)}
              className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded text-sm outline-none"
            />
          </Field>
          <Field label="First input (optional auto-triggered opening action)">
            <input
              value={world.firstInput || ''}
              onChange={(e) => setField('firstInput', e.target.value)}
              className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded text-sm outline-none"
            />
          </Field>
        </Card>

        <Card title={`Instruction Blocks (${world.instructionBlocks.length})`} open={open.blocks} onToggle={() => toggle('blocks')}>
          <div className="space-y-3">
            {world.instructionBlocks.map((b, idx) => (
              <div key={b.id} className="p-3 bg-zinc-900 border border-zinc-800 rounded space-y-2">
                <div className="flex gap-2">
                  <input
                    value={b.name}
                    onChange={(e) => updateBlock(idx, { name: e.target.value })}
                    placeholder="Block name"
                    className="flex-1 p-2 bg-zinc-950 border border-zinc-800 rounded text-sm outline-none"
                  />
                  <label className="text-xs text-zinc-400 flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={b.isActive !== false}
                      onChange={(e) => updateBlock(idx, { isActive: e.target.checked })}
                    />
                    Active
                  </label>
                  <button
                    onClick={() => removeBlock(idx)}
                    className="text-xs text-red-400 hover:text-red-300 px-2"
                    title="Remove block"
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  value={b.content}
                  onChange={(e) => updateBlock(idx, { content: e.target.value })}
                  rows={3}
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono outline-none"
                />
                <input
                  value={(b.keywords || []).join(', ')}
                  onChange={(e) =>
                    updateBlock(idx, {
                      keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="Keywords (comma-separated, optional)"
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded text-xs outline-none"
                />
              </div>
            ))}
            <button
              onClick={addBlock}
              className="w-full py-2 border border-dashed border-zinc-700 hover:border-zinc-500 rounded text-sm text-zinc-400"
            >
              + Add instruction block
            </button>
          </div>
        </Card>

        <Card title={`Tracked Items (${world.trackedItems.length})`} open={open.items} onToggle={() => toggle('items')}>
          <div className="space-y-3">
            {world.trackedItems.map((t, idx) => (
              <div key={t.id} className="p-3 bg-zinc-900 border border-zinc-800 rounded space-y-2">
                <div className="flex gap-2 items-center">
                  <input
                    value={t.name}
                    onChange={(e) => updateItem(idx, { name: e.target.value })}
                    placeholder="Item name"
                    className="flex-1 p-2 bg-zinc-950 border border-zinc-800 rounded text-sm outline-none"
                  />
                  <select
                    value={t.dataType}
                    onChange={(e) => updateItem(idx, { dataType: e.target.value as TrackedItem['dataType'] })}
                    className="p-2 bg-zinc-950 border border-zinc-800 rounded text-sm outline-none"
                  >
                    <option value="text">text</option>
                    <option value="number">number</option>
                    <option value="xml">xml</option>
                  </select>
                  <select
                    value={t.visibility}
                    onChange={(e) => updateItem(idx, { visibility: e.target.value as TrackedItem['visibility'] })}
                    className="p-2 bg-zinc-950 border border-zinc-800 rounded text-sm outline-none"
                  >
                    <option value="everyone">everyone</option>
                    <option value="ai_only">ai_only</option>
                    <option value="player_only">player_only</option>
                  </select>
                  <button
                    onClick={() => removeItem(idx)}
                    className="text-xs text-red-400 hover:text-red-300 px-2"
                    title="Remove tracked item"
                  >
                    ✕
                  </button>
                </div>
                <input
                  value={String(t.initialValue ?? '')}
                  onChange={(e) =>
                    updateItem(idx, {
                      initialValue:
                        t.dataType === 'number' ? Number(e.target.value || 0) : e.target.value,
                    })
                  }
                  placeholder="Initial value"
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded text-sm outline-none"
                />
                <textarea
                  value={t.description}
                  onChange={(e) => updateItem(idx, { description: e.target.value })}
                  rows={2}
                  placeholder="Description (shown to AI)"
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded text-xs outline-none"
                />
                <textarea
                  value={t.updateInstructions}
                  onChange={(e) => updateItem(idx, { updateInstructions: e.target.value })}
                  rows={2}
                  placeholder="Update instructions for the AI"
                  className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded text-xs outline-none"
                />
              </div>
            ))}
            <button
              onClick={addItem}
              className="w-full py-2 border border-dashed border-zinc-700 hover:border-zinc-500 rounded text-sm text-zinc-400"
            >
              + Add tracked item
            </button>
          </div>
        </Card>

        <Card title={`Triggers (${world.triggerEvents.length})`} open={open.triggers} onToggle={() => toggle('triggers')}>
          <div className="space-y-3">
            {world.triggerEvents.map((t, idx) => (
              <div key={t.id} className="p-3 bg-zinc-900 border border-zinc-800 rounded space-y-2">
                <div className="flex gap-2">
                  <input
                    value={t.name}
                    onChange={(e) => updateTrigger(idx, { name: e.target.value })}
                    placeholder="Trigger name"
                    className="flex-1 p-2 bg-zinc-950 border border-zinc-800 rounded text-sm outline-none"
                  />
                  <button
                    onClick={() => removeTrigger(idx)}
                    className="text-xs text-red-400 hover:text-red-300 px-2"
                    title="Remove trigger"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-xs text-zinc-500">Conditions (all must match to fire):</div>
                {t.triggerConditions.map((c, ci) => (
                  <ConditionEditor
                    key={ci}
                    cond={c}
                    onChange={(nc) => updateCond(idx, ci, nc)}
                    onRemove={() => removeCond(idx, ci)}
                  />
                ))}
                <button
                  onClick={() => addCond(idx)}
                  className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded"
                >
                  + Add condition
                </button>
                <div className="text-xs text-zinc-500 mt-2">Effects:</div>
                {t.triggerEffects.map((e, ei) => (
                  <EffectEditor
                    key={ei}
                    eff={e}
                    onChange={(ne) => updateEffect(idx, ei, ne)}
                    onRemove={() => removeEffect(idx, ei)}
                  />
                ))}
                <button
                  onClick={() => addEffect(idx)}
                  className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded"
                >
                  + Add effect
                </button>
              </div>
            ))}
            <button
              onClick={addTrigger}
              className="w-full py-2 border border-dashed border-zinc-700 hover:border-zinc-500 rounded text-sm text-zinc-400"
            >
              + Add trigger
            </button>
          </div>
        </Card>

        <Card title="Victory and Defeat" open={open.victory} onToggle={() => toggle('victory')}>
          <EndConditionEditor
            label="Victory"
            cond={world.victoryCondition}
            onChange={(c) => setField('victoryCondition', c)}
          />
          <EndConditionEditor
            label="Defeat"
            cond={world.defeatCondition}
            onChange={(c) => setField('defeatCondition', c)}
          />
          <p className="text-xs text-zinc-500 mt-2">
            Tip: use the JSON DSL like <code className="text-zinc-300">{`{"trackedItemID":"hp","value":0}`}</code> to fire on a tracked-item match; free text is treated as a narrative hint only.
          </p>
        </Card>

        <div className="text-xs text-zinc-600">
          Need finer control? The world JSON can be edited directly via re-import from the Library. Panel editor covers the most-tuned fields.
        </div>
      </div>
    </div>
  );

  function toggle(key: string) {
    setOpen((o) => ({ ...o, [key]: !o[key] }));
  }

  function addBlock() {
    const b: InstructionBlock = { id: newId(), name: 'New block', content: '', keywords: [], isActive: true };
    setField('instructionBlocks', [...world!.instructionBlocks, b]);
  }
  function updateBlock(idx: number, patch: Partial<InstructionBlock>) {
    setField(
      'instructionBlocks',
      world!.instructionBlocks.map((b, i) => (i === idx ? { ...b, ...patch } : b))
    );
  }
  function removeBlock(idx: number) {
    setField('instructionBlocks', world!.instructionBlocks.filter((_, i) => i !== idx));
  }

  function addItem() {
    const t: TrackedItem = {
      id: newId(),
      name: 'New item',
      dataType: 'number',
      visibility: 'everyone',
      description: '',
      updateInstructions: '',
      initialValue: 0,
    };
    setField('trackedItems', [...world!.trackedItems, t]);
  }
  function updateItem(idx: number, patch: Partial<TrackedItem>) {
    setField('trackedItems', world!.trackedItems.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }
  function removeItem(idx: number) {
    setField('trackedItems', world!.trackedItems.filter((_, i) => i !== idx));
  }

  function addTrigger() {
    const t: TriggerEvent = { id: newId(), name: 'New trigger', triggerConditions: [], triggerEffects: [] };
    setField('triggerEvents', [...world!.triggerEvents, t]);
  }
  function updateTrigger(idx: number, patch: Partial<TriggerEvent>) {
    setField('triggerEvents', world!.triggerEvents.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }
  function removeTrigger(idx: number) {
    setField('triggerEvents', world!.triggerEvents.filter((_, i) => i !== idx));
  }

  function updateCond(tIdx: number, cIdx: number, nc: TriggerCondition) {
    const t = world!.triggerEvents[tIdx];
    updateTrigger(tIdx, {
      triggerConditions: t.triggerConditions.map((c, i) => (i === cIdx ? nc : c)),
    });
  }
  function removeCond(tIdx: number, cIdx: number) {
    const t = world!.triggerEvents[tIdx];
    updateTrigger(tIdx, { triggerConditions: t.triggerConditions.filter((_, i) => i !== cIdx) });
  }
  function addCond(tIdx: number) {
    const t = world!.triggerEvents[tIdx];
    updateTrigger(tIdx, {
      triggerConditions: [
        ...t.triggerConditions,
        { type: 'triggerOnEvent', data: '' },
      ],
    });
  }
  function updateEffect(tIdx: number, eIdx: number, ne: TriggerEffect) {
    const t = world!.triggerEvents[tIdx];
    updateTrigger(tIdx, {
      triggerEffects: t.triggerEffects.map((e, i) => (i === eIdx ? ne : e)),
    });
  }
  function removeEffect(tIdx: number, eIdx: number) {
    const t = world!.triggerEvents[tIdx];
    updateTrigger(tIdx, { triggerEffects: t.triggerEffects.filter((_, i) => i !== eIdx) });
  }
  function addEffect(tIdx: number) {
    const t = world!.triggerEvents[tIdx];
    updateTrigger(tIdx, {
      triggerEffects: [...t.triggerEffects, { type: 'effectShowMessage', data: '' }],
    });
  }
}

function Card({ title, open, onToggle, children }: { title: string; open?: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className="border border-zinc-800 rounded-lg bg-zinc-950">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2 text-left"
      >
        <span className="font-semibold text-zinc-200 text-sm">{title}</span>
        <span className="text-xs text-zinc-500">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="p-4 pt-0 space-y-3">{children}</div>}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function ConditionEditor({ cond, onChange, onRemove }: { cond: TriggerCondition; onChange: (c: TriggerCondition) => void; onRemove: () => void }) {
  return (
    <div className="flex gap-2">
      <select
        value={cond.type}
        onChange={(e) => onChange({ ...cond, type: e.target.value as TriggerCondition['type'] })}
        className="p-2 bg-zinc-950 border border-zinc-800 rounded text-xs outline-none shrink-0"
      >
        <option value="triggerOnEvent">event</option>
        <option value="triggerOnTurn">turn</option>
        <option value="triggerOnItemValue">item value</option>
        <option value="triggerOnRandomChance">random %</option>
      </select>
      <input
        value={cond.data}
        onChange={(e) => onChange({ ...cond, data: e.target.value })}
        placeholder={
          cond.type === 'triggerOnItemValue'
            ? `JSON e.g. {"trackedItemID":"hp","value":0}`
            : cond.type === 'triggerOnTurn'
              ? 'turn number'
              : cond.type === 'triggerOnRandomChance'
                ? '% chance 0-100'
                : 'event label'
        }
        className="flex-1 p-2 bg-zinc-950 border border-zinc-800 rounded text-xs outline-none"
      />
      <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-300 px-2">✕</button>
    </div>
  );
}

function EffectEditor({ eff, onChange, onRemove }: { eff: TriggerEffect; onChange: (e: TriggerEffect) => void; onRemove: () => void }) {
  const data = typeof eff.data === 'string' ? eff.data : JSON.stringify(eff.data);
  return (
    <div className="flex gap-2">
      <select
        value={eff.type}
        onChange={(e) => onChange({ type: e.target.value as TriggerEffect['type'], data: eff.data })}
        className="p-2 bg-zinc-950 border border-zinc-800 rounded text-xs outline-none shrink-0"
      >
        <option value="effectShowMessage">show message</option>
        <option value="effectSetTrackedItemValue">set item value</option>
        <option value="effectModifyInstructionBlock">modify block</option>
        <option value="effectEndGame">end game</option>
      </select>
      <input
        value={data}
        onChange={(e) => {
          const v = e.target.value;
          if (eff.type === 'effectShowMessage' || eff.type === 'effectEndGame') {
            onChange({ ...eff, data: v });
          } else {
            try {
              onChange({ ...eff, data: JSON.parse(v) });
            } catch {
              onChange({ ...eff, data: v });
            }
          }
        }}
        placeholder={
          eff.type === 'effectSetTrackedItemValue'
            ? `JSON e.g. {"action":"set","trackedItemID":"hp","newValue":0}`
            : eff.type === 'effectModifyInstructionBlock'
              ? `JSON e.g. {"id":"atmosphere","content":"..."}`
            : eff.type === 'effectEndGame'
              ? 'end message text'
              : 'message text'
        }
        className="flex-1 p-2 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono outline-none"
      />
      <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-300 px-2">✕</button>
    </div>
  );
}

function EndConditionEditor({ label, cond, onChange }: { label: string; cond: EndCondition; onChange: (c: EndCondition) => void }) {
  return (
    <div className="space-y-1 pb-3">
      <div className="text-xs text-zinc-400 font-semibold">{label}</div>
      <Field label="Condition (JSON DSL or narrative hint)">
        <input
          value={cond.condition}
          onChange={(e) => onChange({ ...cond, condition: e.target.value })}
          className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono outline-none"
        />
      </Field>
      <Field label="End message">
        <input
          value={cond.text}
          onChange={(e) => onChange({ ...cond, text: e.target.value })}
          className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded text-sm outline-none"
        />
      </Field>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-6">{children}</div>;
}
