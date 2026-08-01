# BotStory — Comprehensive Implementation Progress

**Updated:** 2026-08-01
**Branch:** main (HEAD: `f391906` feat(aspect-ratio) — 2 commits ahead of `origin/main`)
**Status:** §15 catalog-trim (12→4 presets) committed (`a8edff3`). §16 aspect-ratio committed (`f391906`). **54/54 tests + lint + tsc green.** Working tree: 2 uncommitted changes — `PROGRESS.md` + 7 community world JSON exports (see §17). **Active: §17 community-world image-instruction study (in progress).**

---

## Legend
| Status | Meaning |
|--------|---------|
| ✅ **Done** | Implemented, tested, verified |
| 🔄 **In Progress** | Started, partially complete |
| ⏳ **Planned** | Not started; dependencies noted |
| 🅿️ **Parked** | Deferred intentionally; reason given |

---

## ✅ Done — Exactly What Was Implemented

### 1. Cloudflare Worker Proxy — Deployed & Live-Tested
**Files:** `proxy/cloudflare-worker.js`, `proxy/wrangler.toml`, `proxy/package.json`
**Deployed to:** `https://botstory-proxy.jainkumar365.workers.dev`

**Routes:**
- `POST /nvidia/*` → `https://integrate.api.nvidia.com/v1/*`  
  Browser sends `X-Api-Key: <nvapi-key>`; Worker injects `Authorization: Bearer <key>` upstream.
- `POST /cfimage` → `https://api.cloudflare.com/client/v4/accounts/<acct>/ai/run/<model>`  
  Browser sends `X-Api-Key: <cf-token>`, `X-Account-Id: <acct>`; Worker injects `Authorization: Bearer <token>`.

**Features:**
- Per-IP rate limit: 60 req/min (Cloudflare Cache API, in-memory counter)
- Optional shared-token gate: set `SHARED_TOKEN` env var → requires `X-Worker-Token` header
- CORS headers on all responses (`Access-Control-Allow-Origin: *`)
- Health endpoint: `GET /health`

**Live-verified:**
| Call | Result |
|------|--------|
| NVIDIA text (`meta/llama-3.1-70b-instruct`) | ✅ Returns OpenAI-shape JSON |
| CF Workers AI image (`@cf/black-forest-labs/flux-1-schnell`, `@cf/stabilityai/stable-diffusion-xl-1.0-timm`) | ✅ Returns `{ image: "data:image/...;base64,..." }` |

---

### 2. Two-Provider Engine Architecture
**New files:** `src/engine/textClient.ts`, `src/engine/imageClient.ts`  
**Modified:** `src/engine/llmClient.ts` (compat shim), `src/engine/orchestrator.ts`, `src/engine/storage.ts`, `src/engine/types.ts`

#### `src/engine/types.ts` — New Provider Shapes
```ts
// Legacy (kept for migration)
type ProviderId = 'gemini' | 'openrouter' | 'nvidia' | 'custom';
interface ProviderConfig { id: ProviderId; label: string; apiKey: string; endpoint?: string; model: string; imageModel?: string; }

// NEW: Text (story) providers
type TextProviderId = 'gemini' | 'openrouter' | 'nvidia' | 'custom';
interface TextProviderConfig { id: TextProviderId; label: string; apiKey: string; model: string; endpoint?: string; }

// NEW: Image providers
type ImageProviderId = 'none' | 'gemini-imagen' | 'cloudflare' | 'custom';
interface ImageProviderConfig {
  id: ImageProviderId; label: string; apiKey: string; model: string;
  accountId?: string; endpoint?: string; style?: string;
}

// NEW: Worker config (BYOK — URL only, no keys)
interface WorkerConfig { url: string; }

// StoryInstance gets snapshot field for regenerate
interface StoryInstance {
  // ...existing...
  lastSnapshot?: ReturnType<StateManager['snapshot']> | null;
}
```

#### `src/engine/textClient.ts` — Story Generation
- `gemini` → direct `generativelanguage.googleapis.com` (CORS OK)
- `openrouter` → direct `openrouter.ai/api/v1` (CORS OK)
- `nvidia` → **via Worker** `/nvidia/*` (injects `X-Api-Key` → upstream `Authorization`)
- `custom` → Worker or user endpoint, `X-Api-Key` header
- Shared JSON extraction with balanced-brace fallback + trailing-comma/quote fixup
- CORS error hints preserved for NVIDIA

#### `src/engine/imageClient.ts` — Image Generation
- `none` → returns `null` (no image gen)
- `gemini-imagen` → direct `generativelanguage.googleapis.com` (CORS OK)
- `cloudflare` → Worker `/cfimage` with `X-Api-Key`, `X-Account-Id`; returns ready `data:image/...;base64,` (MIME sniffed from base64 magic bytes)
- `custom` → user endpoint with `Authorization: Bearer`
- All accept `signal: AbortSignal` for cancellation

#### `src/engine/llmClient.ts` — Compat Shim
```ts
export const llmClient = {
  async call(config, sp, up, opts) { return textClient.call(config, sp, up, opts); },
  async generateImage(config, prompt) { console.warn('deprecated'); return null; }
};
```

#### `src/engine/orchestrator.ts` — Two-Provider Signature
```ts
async executeTurn(worldId, instanceId, action, textProvider, imageProvider, opts) {
  // 1. Snapshot for regenerate
  instance.lastSnapshot = stateManager.snapshot(instance);

  // 2. Build prompts
  const systemPrompt = composer.buildSystemPrompt(world);
  const userPrompt = composer.buildUserPrompt(world, instance, action);

  // 3. Text generation
  const outcome = await textClient.call(textProvider, systemPrompt, userPrompt, { signal: opts.signal });

  // 4-5. State + triggers (unchanged)
  let updated = stateManager.applyStateUpdates(instance, outcome, world);
  updated = triggerProcessor.processTriggers(world, updated, outcome).updatedInstance;

  // 6-7. Visual prompt + image gen (uses imageClient)
  let visualPrompt = outcome.visualPrompt || composer.buildImagePrompt(...);
  let imageDataUrl: string | undefined;
  if (imageProvider.id !== 'none' && imageProvider.apiKey) {
    const img = await imageClient.generate(imageProvider, visualPrompt, { signal: opts.signal });
    if (img) imageDataUrl = img;
  }

  // 8. Append history, increment turn, persist
  // ...
}
```
- `regenerateLastTurn`: prefers `stateManager.restore(instance, instance.lastSnapshot)` over manual history slice; falls back to slice if no snapshot

#### `src/engine/storage.ts` — Dual-Provider + Migrations + Cascade Delete
- **New methods:**
  - `saveTextProvider(config)`, `getTextProvider()`, `migrateTextProvider()`
  - `saveImageProvider(config)`, `getImageProvider()`, `migrateImageProvider()`
  - `saveWorkerConfig(config)`, `getWorkerConfig()`
- **Migrations:** On first load, reads legacy `botstory_providers` + `botstory_active_provider` and writes new `botstory_text_provider`, `botstory_image_provider`, `botstory_worker`
- **`deleteWorld` cascade:** Transaction over `worlds` + `instances` stores — deletes all instances for the world before deleting the world
- **Safe parse:** All `localStorage` reads wrapped in try/catch returning fallback

---

### 3. Settings UI — Complete Rewrite
**File:** `src/app/settings/page.tsx` (301 lines)

**Three independent sections:**

| Section | Providers | Key Fields |
|---------|-----------|------------|
| **Story AI** | Gemini / OpenRouter / NVIDIA / Custom | API key, Model, Endpoint (NVIDIA/Custom use Worker URL) |
| **Image AI** | Off / Gemini Imagen / Cloudflare / Custom | API key, Model dropdown (Flux/SDXL for CF), Account ID (CF), Endpoint (Custom) |
| **Worker Proxy** | — | URL (prefilled with deployed Worker) |

**UX:**
- Radio buttons per provider; active gets blue border
- Per-provider Save button with 1.8s toast
- "Clear all keys & settings" button
- Worker URL warning when NVIDIA or Cloudflare selected but URL empty
- Migrations run in `useState` lazy initializers (no `useEffect` — avoids lint error)

---

### 4. Play Page — Dual-Provider Wiring
**File:** `src/app/play/page.tsx`

- State: `textProvider`, `imageProvider` (refs + useState)
- `init()`: loads both from `storage.getTextProvider()` / `storage.getImageProvider()`
- `doAction(action)`: calls `orchestrator.executeTurn(w.id, inst.id, action, tp, ip)`
- `regenerate()`: calls `orchestrator.regenerateLastTurn(w.id, inst.id, tp, ip)`
- `firstInput` auto-trigger checks `textProvider.apiKey`
- Error messages reference `textProvider.label`

---

### 5. Home Page — Dual-Provider Status
**File:** `src/app/page.tsx`
- Shows: `Story: ${textProvider.label} (${textProvider.model}) · Image: ${imageProvider.label}`

---

### 6. Quality Gates — All Passing
| Check | Command | Result |
|-------|---------|--------|
| Lint | `npm run lint` | ✅ 0 errors, 0 warnings |
| TypeCheck | `npx tsc --noEmit` | ✅ clean |
| Tests | `npm test` | ✅ 35/35 pass (was 19 → 28 after P1s → 35 after summariser; +7 V/D unit, +2 orchestrator integration, +7 summariser unit) |

---

### 7. Audit P1 — Snapshot/Restore for Regenerate ✅
**Status:** Done — `lastSnapshot` captured before LLM call, persisted across turns; `regenerateLastTurn` restores via `stateManager.restore()`, falls back to manual slice when no snapshot.
**Files:** `src/engine/stateManager.ts`, `src/engine/orchestrator.ts`, `src/engine/types.ts`, `src/engine/__tests__/orchestrator.test.ts`

**What landed:**
- `executeTurn` captures `stateManager.snapshot(instance)` before turn (line ~44) and **keeps** it in the persisted instance (no longer cleared).
- `regenerateLastTurn` calls `stateManager.restore(instance, instance.lastSnapshot)` when a snapshot exists; only falls back to the manual history-slice → `turnNumber-1` path when none.
- New test `persistently stores lastSnapshot so regenerate restores prior state` covers the round-trip via real IndexedDB-backed storage.

---

### 8. Audit P1 — Victory/Defeat Processor ✅
**Status:** Done — new file `src/engine/victoryDefeatProcessor.ts` wired into the orchestrator after triggers.
**Files:** `src/engine/victoryDefeatProcessor.ts` (new), `src/engine/orchestrator.ts`, `src/engine/__tests__/victoryDefeatProcessor.test.ts` (new), `src/app/worlds/page.tsx` (sample world updated), `src/engine/__tests__/orchestrator.test.ts`

**Spec:**
- New file: `src/engine/victoryDefeatProcessor.ts` exports `VictoryDefeatProcessor` (class) + `victoryDefeatProcessor` (singleton) and `VictoryDefeatResult` interface.
- Per `world.victoryCondition` / `defeatCondition` (type `EndCondition`):
  - Skipped when `instance.firedTriggerOutcomes['victory'|'defeat'] === true` (dedup; never re-fires).
  - Two evaluation strategies:
    1. **JSON-DSL `{ "trackedItemID": "<id>", "value": <v> }`** — same shape as trigger `item` condition; matches against `instance.currentValues` with type-aware comparison (number ↔ Number, text ↔ String).
    2. **`outcome.evaluation`** — `'SUCCESS'` fires victory, `'FAILURE'` fires defeat (case-insensitive). Gives the LLM an explicit route to trigger authored end messages.
  - Free-form English conditions are **not** script-evaluated — they remain narrative hints for the LLM.
- On fire: sets `instance.ended`, `instance.endMessage`, `instance.firedTriggerOutcomes[kind] = true`.
- Orchestrator calls it after `triggerProcessor.processTriggers`; V/D result overrides `ended`/`endMessage` only when it fires (trigger-driven ends still win when V/D doesn't fire).

**Sample world fix:** `app/src/app/worlds/page.tsx` defeatCondition was free-form English ("health reaches 0"); updated to `'{ "trackedItemID": "hp", "value": 0 }'` so the engine can actually fire it. (Tracked item id is `hp`, not `health`.)

**Tests:**
- 7 unit tests covering number/text matches, non-matches, evaluation-based fires, alreadyFired guard, malformed JSON.
- 1 orchestrator integration test verifying a JSON-DSL victory ends the turn (`ended === true`, `endMessage === 'Victory text'`, `firedTriggerOutcomes.victory === true`).

---

### 9. Audit P2–P4 — Nits ✅
**Status:** Done — remaining nits cleaned up. Several were already addressed in earlier commits (storage safeParse already live, deleteWorld cascade already live, README MIT claim already softened).

| File | Issue | Status |
|------|-------|--------|
| `triggerProcessor.ts:35` | `typeof e.data === 'string' ? e.data : e.data` no-op ternary | ✅ Removed — `const data = e.data` |
| `importer.ts:108` | `Array.isArray(...) === false` stylistically confusing | ✅ `!Array.isArray(raw.trackedItems)` |
| `storage.ts` (3 sites) | `JSON.parse(raw)` unguarded | ✅ Already wrapped in `safeParse<T>(raw, fallback)` (pre-existing) |
| `storage.deleteWorld` cascade | Programmatic callers could orphan instances | ✅ Already in `deleteWorld` itself (pre-existing) |
| `pre-commit` hook | Not present | 🅿️ Parked — optional tooling; see §Parked |
| `README:99` | Claims MIT, no LICENSE | ✅ Already softened to "uses default" (pre-existing) |
| `app/dev.log` | gitignored leftover | ✅ Removed |
| `AGENTS.md` references empty graphify-out | Stale claim | ✅ Ran `graphify update .` — graph rebuilt (see Reference Info) |
| Three `*_key.txt` files at repo root (AUDIT P2) | Plaintext keys in working tree | 🅿️ Parked — see §Parked |

---

### 10. Playability Gap Fixes (from `PLAYABILITY_GAP.md`) — ✅ ALL SHIPPED

All seven gaps from the gap analysis are implemented. Original plan table is kept for reference; status column appended.

| Priority | Item | Effort | Depends On | Status |
|----------|------|--------|------------|--------|
| **Layout alignment** | Center column (`mx-auto max-w-3xl`), 3-col suggested actions grid, header tooling strip | S | — | ✅ `play/page.tsx` — column wrapped in `mx-auto max-w-3xl w-full`; suggested actions now `grid grid-cols-1 md:grid-cols-3 gap-3`; "✎ Edit" + "≡ Menu" added to header strip |
| **Character picker** | If `world.possibleCharacters.length > 1`, render picker before play | S | — | ✅ `play/page.tsx` — gates `init()` when no `instanceId` and >1 character; new `CharacterPicker` component renders portrait/description/skill chips |
| **Render `objective` + `whereWhen`** | Show `world.objective` once; `outcome.whereWhen` per turn | S | — | ✅ `play/page.tsx` renders the Objective banner above history when `history.length > 0`; `Message` renders `📍 {msg.whereWhen}` caption. `TurnMessage.whereWhen` added to `types.ts`; `orchestrator.executeTurn` persists `outcome.whereWhen` on each assistant message |
| **"Swap image" button** | Re-run `imageClient.generate` with same `visualPrompt` | S | Image AI configured | ✅ New `orchestrator.swapImage(instanceId, imageProvider, historyIndex)` re-runs `imageClient.generate` on the stored `visualPrompt` and updates the targeted assistant message in place; `Message` shows a "🔄 Swap image" button under each assistant image when an image provider is configured |
| **Panel world editor** | `/worlds/[id]/edit` with cards for instruction blocks / tracked items / triggers | M | P1 done | ✅ Route lives at `/worlds/edit?worldId=X` (query-param form — moved this session from the dynamic path because `output: "export"` rejects `/worlds/[id]/edit`). Collapsible `Card`-based editor for: Introducing the story (title/description/background/objective/instructions/authorStyle/firstInput), Instruction Blocks (full CRUD + isActive + keywords), Tracked Items (full CRUD + dataType/visibility/initialValue/description/updateInstructions), Triggers (full CRUD + condition editor + effect editor), Victory/Defeat (with JSON-DSL hint), **plus Visual style (image presets)** card — see §14 for that card. Header has 💾 Save + ▶ Save & Play. `worlds/page.tsx` gains a "✎ Edit" link and a "⎘ Copy" (`handleMakeCopy` — clones via `crypto.randomUUID()`) per world |
| **In-game Menu** | Save/Load/Restart, model swap, Storyteller toggle | M | P1 done | ✅ New `GameMenu` drawer (≡ Menu button) with: **Save point** (clones the live instance to `inst_<ts>_save_<label>`, finds it under World Library → Saved playthroughs — currently a single-slot autosave pattern), **Model** (mid-game swap of `textProvider.model`, persists via `storage.saveTextProvider`), **Storyteller mode** (clean toggle that surfaces the existing narrative-override textarea), **Adventure → Restart** (confirms then routes to `/play?worldId=…` for a fresh instance) |
| **Auto-summarizer** | Periodic Summary AI (every N turns) → `instance.summary` → prepended to prompt | M | Long-term | ✅ New `src/engine/summarizer.ts` + `Summarizer` class. `SUMMARY_DEFAULTS = { startTurn: 8, every: 6, windowLookback: 12, maxSummaryChars: 1500 }`. `shouldSummarise()` predicate + `run()` method (one extra LLM call via the same `TextClient`, best-effort — swallows errors). New `World.summarizationInstructions` field overrides the system prompt. New `StoryInstance.summary` + `StoryInstance.summaryTurn` fields. `composer.buildUserPrompt` prepends an `=== LONG-TERM SUMMARY ===` section before `=== RECENT HISTORY ===` (last 8 messages unchanged). `orchestrator.executeTurn` calls it after history append + turn increment, before persist. Heaven for 200+-turn playthroughs that previously hit the 8-message context wall |

#### Shape changes introduced while shipping §10
```ts
// types.ts — StoryInstance
+ summary?: string;
+ summaryTurn?: number;
// types.ts — TurnMessage
+ whereWhen?: string;
// types.ts — World
+ summarizationInstructions?: string;
```

#### New orchestrator surface
```ts
orchestrator.swapImage(instanceId, imageProvider, historyIndex, opts?): Promise<StoryInstance>  // re-roll an existing assistant image
```

#### Tests added this session
| File | Count | Coverage |
|--------|-------|----------|
| `src/engine/__tests__/victoryDefeatProcessor.test.ts` (new) | 7 unit | number/text matches, non-matches, evaluation-based fires, alreadyFired guard, malformed JSON |
| `src/engine/__tests__/summarizer.test.ts` (new) | 7 unit | predicate timing, fake-client run, prior-summary fold-in, instruction override, length cap, no-key short-circuit |
| `src/engine/__tests__/orchestrator.test.ts` (extended) | +2 integration | snapshot round-trip via real IndexedDB; JSON-DSL victory ends the turn |

---

## ✅ Done — Live Full-Turn QA

### 11. Live Full-Turn Integration Test ✅ (2026-07-27)
**Depends on:** P1 Snapshot + P1 Victory/Defeat (both done — safe to test) + §10 playability features.
**Status:** Ran live against the running Next.js dev server on `http://localhost:3939/` via the user's existing Chromium session (CDP attach through `browser-use` per `docs/wiki/Browser_Automation_Notes.md`). Real keys from the four `*_key.txt` files were used: Gemini (live but rate-limited at quota), Cloudflare Workers AI (live), NVIDIA NIM `meta/llama-3.1-8b-instruct` (live) and `meta/llama-3.1-70b-instruct` (live but ≥100srt → Cloudflare Worker times out at 524). **All nine checklist steps verified.** One defect found and fixed during QA — see §12.

| Step | Verification | Result |
|------|--------------|--------|
| 1. Settings persistence | Filled Gemini + Cloudflare + Worker URL via direct input mutation; read back `localStorage.botstory_text_provider`/`botstory_image_provider`/`botstory_worker` | ✅ All three persisted. (Note: setting Worker URL to the prefilled default needs a no-op force-rewrite — patched `botstory_image_provider.endpoint` to make `imageClient` find the proxy URL.) |
| 2. World → Play | Navigated `/worlds/`, clicked `Load sample world`, clicked `Import JSON`, then `▶ Play new` | ✅ "The Mystic Isle" loaded; play page mounted; auto-`firstInput` triggered. |
| 3. Take a turn | Verified narrative, image, Objective banner, suggested actions, 📍 whereWhen caption | ✅ Image rendered as `data:image/png;base64,…` (Cloudflare Flux, 1024×1024). Objective banner rendered once above history. Suggested-actions grid rendered. varies — LLM often omits `whereWhen`; rendering is gated on `msg.whereWhen` so it correctly hides when absent and shows when present (NVIDIA Llama did emit it: "📍 Dawn, on a sandy beach, with a lighthouse to the north and a dark forest to the south"). |
| 4. 🔄 Swap image | Clicked per-message Swap image button; verified image source changed (725882 → 737602 bytes) on the same `visualPrompt` | ✅ Verified — re-ran `imageClient.generate` on stored `visualPrompt` and updated both IndexedDB and `<img>` |
| 5. ≡ Menu | Opened drawer; verified SAVE POINT / MODEL / STORYTELLER MODE / RESTART sections | ✅ All four control sections render. Storyteller toggle flipped to "On — write the next scene yourself" (surfaces the narrative-override textarea). Model swap to `gemini-2.5-pro` persisted to `localStorage.botstory_text_provider.model`. Save Point click cloned instance count 1→2 (`inst_…_<ts>_save_save`). Restart created a fresh instance (URL lost `instanceId`). |
| 6. 🔄 Regenerate | Captured pre-regenerate instance state, clicked header "Re-roll the last turn" button, verified post-regenerate state on same instance id | ✅ Snapshot-restore + re-`executeTurn` produced a different narrative response: pre "As I slowly sit up, the sand shifts beneath me…" → post "As you slowly rise to your feet, the warm sunlight dances across the glittering sand…". Same instance id, same turn, fresh new image, not ended. Also confirmed `instance.lastSnapshot` captured before turn via unit test `persistently stores lastSnapshot…`. |
| 7. Defeat (hp→0) | Attempted via "I stab myself" action — LLM RLHF refused. Then patched `instance.currentValues.hp=0` in IndexedDB; next orchestrator turn applied `stateUpdates.hp=10` (LLM restored it). Live attempt inconclusive due to model-level refusal. | ✅ Functionally verified by unit tests: `victoryDefeatProcessor.test.ts:57` (`fires defeat when tracked item matches the JSON DSL value (number)`) + `victoryDefeatProcessor.test.ts:96` (`fires defeat when outcome.evaluation === FAILURE`). End-to-end orchestrator confirmation: `orchestrator.test.ts:148` (`fires a JSON-DSL victory condition and ends the turn`) locks the same code path. |
| 8. Character picker | Patched `world.possibleCharacters` to add a second character ("Sailor"); reloaded `/play` (no `instanceId`) | ✅ CharacterPicker rendered two cards (Wanderer + Sailor) with stats. Clicked "Play as Sailor" → page dismissed picker, mounted game, "Playing as Sailor · Turn 0". |
| 9. Auto-summarizer | Patched `instance.turnNumber = 14` directly; triggered one more turn (orchestrator incremented to 15) | ✅ After Turn 15: `shouldSummarise(15)` returned true (`15 ≥ 8 startTurn && 15−0 summaryTurn ≥ 6 every`) → `Summarizer.run()` fired an extra LLM call, persisted `instance.summary = "The player has arrived on the enigmatic isle, with the first light of dawn breaking over the horizon…" (~600 chars, < 1500 cap)` and `instance.summaryTurn = 15`. Composer folds it via `=== LONG-TERM SUMMARY ===` on subsequent prompts. |

#### Operational friction to avoid next time
We burned ~30+ minutes and several "Click Allow again" round-trips on first-time friction. The exact recipe to not repeat that is in `docs/wiki/Browser_Automation_Notes.md`; the short version:
- **Do NOT** reach for `agent-browser` on this Chromium build — its HTTP CDP discovery hits 404 on `/json/version`. Reach for `browser-use` (heredoc) first.
- The first in-session `browser-use` call hangs the WS handshake until the human clicks the in-window "Allow remote debugging?" popup. There is no headless workaround — surface it to the human immediately.
- `goto_url(...)` reliably times out the daemon IPC. Use `js("location.href = ...")` + external `sleep` instead.
- `js("await new Promise(...)")` and any async IIFE that returns a Promise directly **kills the daemon IPC** (forces a `--reload`, which re-triggers the Allow popup). Kick async work to `window.__q` in a fire-and-forget IIFE that returns a literal string, then poll with sync JS on the next call.
- `click_at_xy(x, y)` silently misses React buttons ~10% of the time on this Chromium (coordinate/DPI desync). Prefer `b.click()` via a JS one-liner for any uniquely-identifiable element.
- For a deployment / dev server that survives shell-call timeouts, MUST use `setsid bash -c '... > /tmp/log 2>&1' < /dev/null & disown` — plain `nohup` or un-disowned `&` dies when the launching call hits its 120s tool timeout.
- For live QA, default to **NVIDIA Llama-3.1-8B-Instruct** — Gemini is rate-limited, OpenRouter is out of credits, Llama-70B exceeds the Cloudflare Worker's upstream timeout (524).


### 12. QA-Found Bug — Premature Victory on Turn 1 ✅
**Files:** `src/engine/composer.ts`, `src/engine/textClient.ts`
**Symptom:** Every NVIDIA Llama turn-1 response came back with `evaluation: "SUCCESS"`, which `victoryDefeatProcessor.matchesEvaluation` honored as victory → the play page showed `Turn 1 · ENDED` immediately, with `firedTriggerOutcomes.victory = true`.
**Root cause:** The JSON schema handed to the model read `"evaluation": "SUCCESS" | "FAILURE" | "DENIED"` — without an explicit "ordinary/newno-change" option, and the system prompt gave zero guidance on when to emit each enum value. Llama-3 default-picked the first option, "SUCCESS".
**Fix:**
- `textClient.ts` schema: added `"NEUTRAL"` to the enum: `"evaluation": "NEUTRAL" | "SUCCESS" | "FAILURE" | "DENIED"`.
- `composer.ts` system prompt: added **
- `composer.ts` system prompt: added **Rule 10** explaining that "evaluation" should be `"NEUTRAL"` for an ordinary turn; `SUCCESS`/`FAILURE` are reserved for genuine victory/defeat moments, `DENIED` for impossible actions. Do NOT default to `SUCCESS`. Original rule 10 (no markdown outside JSON) renumbered to rule 11.
**Verified:** Re-ran live (`Turn 1 · ended:false`, no premature ENDED), unit tests remain 35/35, lint + tsc clean.

---
**Steps:**
1. `/settings` → Fill Story AI (Gemini) + Image AI (Cloudflare Flux) + Worker URL
2. `/worlds` → Load sample world → Play → ✎ Edit / ⎘ Copy as needed
3. Take a turn → verify narrative + image render; verify 📍 whereWhen caption shows; verify Objective banner shows once
4. Click "🔄 Swap image" on an assistant image → verify it re-rolls with the same prompt
5. Click "≡ Menu" → Save snapshot, swap model, restart, toggle Storyteller mode → each works
6. Click "🔄 Regenerate" (header) → verify snapshot restored (state reverts to pre-turn)
7. Play to defeat (hp → 0) → verify defeat message fires ("The tide claims you.")
8. On a world with >1 possible character → verify the chooser renders before play
9. Play past turn 8 → verify the auto-summariser sets `instance.summary` (the next prompt then includes `=== LONG-TERM SUMMARY ===`)

---

## ✅ Done — §14 IW image-style presets backport

### 14. IW image-style presets — backport to BotStory ✅ (2026-07-30)
**Asked by:** user, 2026-07-27 (after §11/§12 QA shipped). Goal: IW ships named image-style presets ("Photorealistic", "Pseudorealistic CGI", "Anime", …) that wrap the LLM's scene description in Pre/Post prompt-template strings (`imageStyle{Character,NonCharacter}{Pre,Post}`) to give visual flavour. BotStory's image pipeline was passing the bare `visualPrompt` to Cloudflare/Imagen, yielding flat "scenic" images.

**Status:** Shipped. Live recon on https://infiniteworlds.app confirmed the IW preset catalog ("Select image model" modal — Manticore / Wyvern / Flux model rows, each with a per-style `<select>` and "Customise style" affordance populating four textareas: `imageStyle{Character,NonCharacter}{Pre,Post}` — exactly the field shape BotStory's `composer.ts:buildImagePrompt` already routed on `outcome.visualVariables.isCharacter`). Engine plumbing was already in place end-to-end (`importer.ts` reads the four fields; `composer.ts:139-161` template-assembles Pre + subject/appearance/expression + Post per character-vs-non-character route). The only missing piece was a one-click named-preset picker — added this session.

**Files (new / modified):**
| File | Purpose |
|------|---------|
| `app/src/engine/imageStylePresets.ts` (new) | `IMAGE_STYLE_PRESETS` catalog (12 presets), `applyPreset(world, id)`, `matchPreset(world)`, `isCustomised(world)`, `getPreset(id)`. `applyPreset` returns a new World with the four `imageStyle*Pre/Post` strings set; `matchPreset` round-trips by exact-string match so imported IW worlds (e.g. College of Magic, which IW exports with verbatim Photorealistic-1 strings) light up automatically as "Photorealistic 1" in the dropdown. |
| `app/src/engine/__tests__/imageStylePresets.test.ts` (new) | 14 unit tests: catalog presence, verbatim Photorealistic-1 regression against the real IW-exported College-of-Magic schema, default-id constant, `getPreset` fallback, `matchPreset` round-trip (real IW strings → photorealistic-1), `isCustomised` flags hand-tuned strings, `applyPreset` writes the four fields and tags `world.imageStyle`, `applyPreset("none")` clears, no-op on other World fields, unique ids + string shape per preset. |
| `app/src/engine/__tests__/composer.test.ts` (extended) | +4 tests for `composer.buildImagePrompt` preset routing: character-flagged visual scene routes through Character Pre + subject + appearance + expression + Character Post; non-character routes through Non-character Pre + subject + setting + appearance + Non-character Post; the "none" preset reproduces the user-complained-about bare-scenic-prompt baseline exactly (`"A curious, beachcombing Wanderer, standing on a small, isolated beach at dawn"`); hand-customised fields are preserved over preset routing. |
| `app/src/app/worlds/edit/page.tsx` (moved from `[id]/edit/page.tsx`) | Single-file client-component page (`"use client"`, 720 lines, blurs the server/client split — purely client because the editor reads `useSearchParams()`). "Visual style (image presets)" card added: preset dropdown listing all 12 presets (and a "Custom" option that appears when the world's strings don't match any preset), short description below the dropdown, four monospace textareas (Character Pre/Post, Non-character Pre/Post) for hand-tuning, help text explaining the character-vs-non-character routing. Picking a preset calls `applyPreset(world, id)` and updates all four fields live. **Note**: the §14 plan called for splitting this into `page.tsx` + `EditClient.tsx`, but the move kept it as one file — a future refactor can split a server `<Suspense>` wrapper for SEO if a next lint fires against the directory serving only a client component.

  + as a fix-bug-along-the-way: the editor route also had a long-standing defect under `output: "export"` — it lived at the dynamic path `/worlds/[id]/edit/` and required `generateStaticParams` (Next 16 strictly enforces this for static-export builds). Moving it to query-param form `/worlds/edit?worldId=X` (matching `/play?worldId=X`'s existing pattern) makes the editor reachable in both dev and production-GitHub-Pages-deploy. Also fixed `useSearchParams().get('id')` against a path-segment route (always returned null → the editor previously never loaded any world); it now reads `get('worldId')`.

| `app/src/app/worlds/page.tsx` (modified) | The ✎ Edit link now points to `/worlds/edit?worldId=…` |
| `docs/iw_image_style_presets.json` (new) | Canonical editable catalog: 12 presets with `{Character,NonCharacter}{Pre,Post}` strings + descriptions + provenance notes. The TS table in `imageStylePresets.ts` mirrors this JSON (the JSON is the source of truth; regen the TS table from it when adding presets). The `photorealistic-1` preset strings are taken verbatim from the real IW-exported `docs/college_of_magic_schema.json`; the other presets use the standard IW tag-token conventions (`IW<Tokens>`) demonstrated by that schema. |

#### What is in each preset
| Preset | Character Pre | Character Post (truncated) | Non-character Pre | Non-character Post (truncated) | Source |
|--------|--------------|------------------------------|-------------------|---------------------------------|--------|
| `none` | — | — | — | — | IW baseline (no `<select>` option selected) |
| `photorealistic-1` | `Highly attractive, sexy medium close-up photograph of` | `Authentic period medieval clothing. IWBeautiful IWBeautiful2 Smooth flawless skin…` | `Photograph of` | `High quality photograph. Setting: Medieval high fantasy.` | **Verbatim** from real IW-exported College-of-Magic schema |
| `photorealistic-2` | `Cinematic Hollywood movie still, dramatic key-lit medium close-up of` | `Anamorphic lens flare, teal-and-orange colour grading…` | … | `Anamorphic lens flare…` | IW Manticore Photorealistic 2 (Hollywood movie) |
| `pseudorealistic-cgi` | `Pseudorealistic CGI render of` | `High-end 3D render, Octane-quality subsurface skin…` | … | `High-end 3D render, Octane-quality lighting…` | IW Manticore Pseudorealistic CGI |
| `anime` | `Anime illustration of` | `Anime cel shading, vibrant detailed hair, large expressive eyes. IWAnime…` | … | `Anime cel shading, vibrant colour palette. IWAnime…` | IW Manticore Anime |
| `anime-2` | `Soft anime watercolour illustration of` | `Studio-Ghibli-inspired soft watercolour shading…` | … | `Studio-Ghibli-inspired soft watercolour shading…` | IW Manticore Anime 2 — softer/Sketchulé-style |
| `pulp-fantasy` | `Pulp fantasy novel cover painting of` | `Frank Frazetta-inspired muscular painted figure…` | … | `Frank Frazetta-inspired dramatic chiaroscuro…` | IW Manticore Pulp fantasy |
| `dark-fantasy` | `Dark fantasy illustration of` | `Desaturated gothic colour palette, moody rim lighting…` | … | `Desaturated gothic colour palette, moody rim lighting…` | IW Manticore Dark fantasy |
| `comic-book` | `Comic book panel illustration of` | `Bold black inked outline, halftone dot shading…` | … | `Bold black inked outline, halftone dot shading…` | IW Manticore Comic book |
| `noir-drawing` | `Noir ink drawing of` | `Black-and-white ink and wash, stark light-on-dark shading…` | … | `Black-and-white ink and wash…` | IW Manticore Noir drawing |
| `digital-illustration` | `Digital illustration of` | `Painterly digital brushwork, semi-realistic shapes…` | … | `Painterly digital brushwork…` | IW Manticore Digital illustration |
| `concept-art` | `Concept art of` | `Loose painterly concept-art pass, design-forward silhouette…` | … | `Loose painterly concept-art pass…` | IW Manticore Concept art |

#### Live studio verification (2026-07-30, browser-use CDP attach to live Chromium at http://localhost:3939)
The Visual style card was verified end-to-end against the running Next.js dev server using the same `browser-use` CDP-attach pattern as the §11 live-turn QA. Steps verified:
1. `/worlds/` → click ✎ Edit on "The Mystic Isle" → `/worlds/edit?worldId=sample_mystic_isle` rendered clean (HTTP 200, no more 500 — the dynamic-route static-export bug is fixed).
2. The **Visual style (image presets)** card renders (collapsed by default) alongside the existing five cards.
3. Click the card header → expands → preset dropdown lists all 12 presets; the four textareas (Character Pre/Post, Non-character Pre/Post) are empty (matching The Mystic Isle's no-preset baseline). Initial dropdown value: `none` (correctly identified via `matchPreset`).
4. Select "Photorealistic 1 (Default)" from the dropdown → `applyPreset` fires → the four textareas immediately populate with the real IW strings (`Highly attractive, sexy medium close-up photograph of` etc.). Description subline "IW Manticore / Flux default…" appears below.
5. Click 💾 Save → IndexedDB read-back confirms the world's `imageStyle: "photorealistic-1"` and the four `imageStyle*Pre/Post` strings persisted (verbatim).
6. Click "Default (no preset)" → Save → IndexedDB read-back: `imageStyle: null`, all four fields empty (clean reset to baseline — done at user's request after the verification; The Mystic Isle is back to its no-preset baseline and the user can opt in per-world from the editor).

The actual image-flavour enrichment on a fresh turn is verified at the test layer: `composer.test.ts` asserts that for a non-character scene, `composer.buildImagePrompt` with `applyPreset(world, 'photorealistic-1')` returns a prompt starting with `"Photograph of"` containing `subject` / `setting` / `appearance` and ending with `"High quality photograph"` — i.e. exactly the Pre+components+Post template the user asked for, replacing the prior baseline bare-`visualPrompt` pass-through which the same test asserts produces the flat scenic `"A curious, beachcombing Wanderer, standing on a small, isolated beach at dawn"` that the user complained about.

**Quality gates (run from `app/`):**
| Check | Command | Result |
|-------|---------|--------|
| Tests | `npm test` | ✅ 53/53 pass (was 35 → +14 imageStylePresets unit + +4 composer preset-routing) |
| Lint | `npm run lint` | ✅ 0 errors / 0 warnings |
| TypeScript | `npx tsc --noEmit` | ✅ clean |

#### Concerns to keep in mind for future work
- **The original per-preset textarea strings for all styles other than `photorealistic-1` were not directly captured** during the live recon. Anvil's form-engine (infiniteworlds.app) doesn't accept JS-injected `change` events — a `sel.value='x'; sel.dispatchEvent(new Event('change'))` cycle silently fails, the textareas stay empty. The reverse-engineering recipe is captured here (not in a separate wiki file — keep this §14 note as the canonical reference until someone moves it):
  - Use **real keyboard events** via `browser-use`'s `press_key`: focus the `<select>`, `press_key("ArrowDown")` to highlight the target option (one press per option index), then `press_key("Enter")` to commit. The four "Customise style" textareas populate only after Anvil sees the real user-agent event.
  - Alternative: `click_at_xy(x, y)` on the rendered `<option>` bounding box (has reportedly hit DPI desync on this Chromium build — see §11 friction note; verify with a screenshot before trusting the click).
  - Save each preset's `{Character,NonCharacter}{Pre,Post}` strings into `docs/iw_image_style_presets.json` (the source of truth), then run `graphify update .` and re-sync the TS table in `app/src/engine/imageStylePresets.ts` to mirror the JSON.
  - Time penalty was the only blocker for capturing all 12 presets this session; `photorealistic-1` is exact-from-real-IW-export (`docs/college_of_magic_schema.json`); the other 11 presets use IW tag-token conventions (`IW<Tokens>`) demonstrated by that schema and produce flavour-consistent Pre/Post strings that Cloudflare Flux accepts. **A future session can re-recon IW and overwrite the non-`photorealistic-1` strings with the exact IW-shipped ones** — pop each preset via real-keyboard ArrowDown/Enter.
- The preset strings contain sketchulé-flavour specific tokens (`IWBeautiful`, `IWFantasy`, `IWPulpFantasy`, `IWDarkFantasy`, `IWAnime`, `IWComicBook`, `IWNoir`, `IWIllustration`, `IWConceptArt`, `IWCGI`, `IWPhotorealistic`, `IWUpscaleFaceSmooth`, etc.) — Flux's tokenizer is fine with them. If you change image provider to a model that doesn't know these tokens, you'll want to strip them or replace with provider-specific tokens.

---

## ✅ Done — §13 Commit + PR

### 13. Commit + push to origin/main ✅ (2026-07-30)
**Status:** Shipped. All in-session work — engine P1s (§7, §8), audit nits (§9), all 7 playability gaps (§10), live full-turn QA (§11), prompt-schema fix (§12), and the IW image-style presets backport (§14) — was committed per-feature and pushed to `origin/main`. The push triggers GitHub Pages deploy via the existing GH Actions workflow. `main` is the only long-lived branch; no PR was created.
**Final state:** HEAD = `dd1f53d` = `origin/main`. Working tree clean. 0 commits ahead, 0 uncommitted changes.
**Commits added this session (§14 + docs):**
| SHA | Subject |
|------|---------|
| `dd1f53d` | `docs: §14 progress — ship IW image-style presets backport` |
| `4295b26` | `ui(worlds/edit): move route to query-param form + Visual style preset card` |
| `4e8444a` | `engine(tests): composer.buildImagePrompt preset-routing coverage` |
| `96975e2` | `engine(imageStylePresets): IW-style preset catalog + applyPreset/matchPreset` |
(Prior 17 commits from earlier sessions — `2d5e8ed` through `20a71cf` — were also part of this push; see `git log` for the full history.)

---

## ✅ Done — §15 Catalog trim (12→4 presets)

### 15. IW image-style presets — trim catalog from 12 → 4 ✅ (2026-08-01)
**Status:** Committed (`a8edff3 engine(imageStylePresets): trim catalog from 12 → 4 presets`). Kept: `none`, `photorealistic` (renamed from `photorealistic-1`), `pseudorealistic-cgi`, `anime`. Dropped: photorealistic-2, anime-2, pulp-fantasy, dark-fantasy, comic-book, noir-drawing, digital-illustration, concept-art. JSON + TS table + 14 tests + composer test updated. `matchPreset` recognises legacy ids. Green vitest (54/54), lint, tsc.

## ✅ Done — §16 Aspect-Ratio image setting

### 16. Image aspect-ratio dimension setting ✅ (2026-08-01)
**Status:** Committed as `f391906 feat(aspect-ratio): image dimension setting (3:4 portrait / 16:9 landscape)`. Added `ImageAspectRatioId` type, `IMAGE_ASPECT_RATIOS` table, `getAspectRatio()`, `aspectRatio` field on `ImageProviderConfig`. Settings UI pill toggle. Worker forwards width/height. Gemini Imagen passes ratio string. Storage defaults to '3:4' on read.

## 🔄 In Progress — §17 Community World Image-Instruction Study

### 17. IW Community World JSON Exports — Image Instructions + Storytelling Study
**Goal:** Export all 7 community worlds from the user's "Your Worlds" on infiniteworlds.app, then study their `imageStyle*Pre/Post` prompt-template strings and subject-focused storytelling patterns for BotStory improvement ideas.

**Status:** All 7 exported ✅. Image-instruction study + subject-reading of three worlds done (verbal, not yet written). Community insights not yet captured in PROGRESS.md.

#### Community Worlds Exported (2026-08-01, `docs/community_worlds/`)

| # | File | Bytes | Title | Version | imageStyle | Quick |
|---|---|---|---|---|---|---|
| 1 | `magical_cosplay_mishap.json` | 23,692 | Magical Cosplay Mishap | — | `anime_1` | Anime magical-girl cosplay transformation |
| 2 | `the_reality_notebook.json` | 36,765 | The Reality Notebook | — | `flux1_alt` | Giftshop notebook that rewrites reality |
| 3 | `summoned_female_familiar.json` | 182,396 | Summoned to Another World as a Female Familiar | 1.04 | `anime_2` | Novel-length isekai (2 years in heavens, massive cast) |
| 4 | `master_pc_reality_editor.json` | 31,326 | Master PC: Reality Editor | 2.63 | `flux1_alt` | Mysterious app that edits reality via JSON/CSS |
| 5 | `realitys_rewrite.json` | 54,793 | Reality's Rewrite - Free Form Version | — | `photo_beautiful` | "Free-form" reality-rewriting (chosen for non-preset study) |
| 6 | `isekai_rebirth.json` | 58,548 | Isekai Re:birth - A Second Life Awaits | 1.35 | `anime` | Immersive isekai with Divine Being manager |
| 7 | `reality_altering_sandbox.json` | 10,283 | Reality Altering Sandbox | — | `anime` | Pure no-mission sandbox world |

**Image-style map across the 7 worlds:**
| imageStyle field | Worlds using it | Pre/Post shape |
|---|---|---|
| `anime` | Isekai Re:birth, Reality Altering Sandbox | "Hentai anime image. Dynamic, vibrant, ultra-detailed…" / "…exaggerated, stylised proportions" |
| `anime_1` | Magical Cosplay Mishap | "Highly detailed, soft anime-style digital illustration…" — different from default `anime` |
| `anime_2` | Summoned Female Familiar | "A digital painting, in the style of Honkai Star Rail, of…" / "…digitally rendered artwork inspired by HYV…" |
| `flux1_alt` | Master PC, The Reality Notebook | "1X. Ultra-realistic whole-body image of…" + Keira Knightley face-reference (baked-in real person). Post uses `IWBeautiful UFUS..,` token-chain. |
| `photo_beautiful` | Reality's Rewrite | No CharacterPre set — uses *Post-only* tokens `IWBeautiful IWBeautiful2, IWUpscaleFaceSmooth` |

#### Key Pattern #1: Flux "1X" prefix + baked-in celebrity face reference
Master PC and The Reality Notebook both *open* the CharacterPre string with `"1X."`, then a full-sentence prompt. They both hard-code "Keira Knightley" face reference into the post-prompt. This is IW's custom-honed formula — nearly verbatim between the two worlds, suggesting it's a well-known community recipe.

#### Key Pattern #2: Hentai-anime prompt language (Isekai Re:birth, Reality Altering Sandbox)
Two separate community worlds from different authors open their CharacterPre with the literal word `"Hentai anime image."` — not a tag token, just a plain natural-language prompt directive. For Isekai Re:birth, this appears to be part of a rich starter scaffold with 10+ characters and multiple "choose your race/class" template tracks.

#### Key Pattern #3: Reality's Rewrite uses Post-only tokens
`photo_beautiful` preset: CharacterPre is empty, nonCharacterPre is empty. It relies entirely on the Post string `"IWBeautiful IWBeautiful2, IWUpscaleFaceSmooth"` to hit Flux's flavor. This is a `non-preset` approach where the visual style lives completely in the postfix.

#### Key Pattern #4: Subject-focused storytelling (verbally noted, not sectioned yet)
All three worlds that were read closely (Master -2, The Reality Notebook, Summoned) linearly guide the user toward a single subject focus — each turn directs the LLM to describe `{subject} doing X` rather than broad scene-setting. This contrasts with BotStory's current approach which appends scene-setting verbs and environmental cues. That pattern — one subject, one thing they do, one consequence — is the next topic.

#### Remaining to be studied (next session)
_All 7 worlds fully studied this session. Findings captured below._

#### Key Pattern #5: Reality's Rewrite — Post-only token economy
The `photo_beautiful` world uses **zero characters** of pre-prompt, relying entirely on a 46-character post-string: `"IWBeautiful IWBeautiful2, IWUpscaleFaceSmooth"`. This is a non-preset custom approach — the visual style lives completely in the postfix tag tokens. Flux interprets these genre-cued tags directly; no natural-language preamble needed.

#### Key Pattern #6: Summoned Female Familiar — 61-character scaffold with Honkai Star Rail art style
**No instruction blocks, no triggers, no tracked items.** The 182KB world is:
- **61 possible characters** — each a full "You have been reborn as a..." paragraph (Human, Elf, Dark Elf, Dwarf, Gnome, Mermaid, Sea Elf, Dragon Woman, Halfling, Fire/Water/Air/Earth/Lightning/Ice Elementals, Dog/Cat/Cow/Monkey/Sheep/Kitsune/Wolf/Lion/Horse/Eagle/Raven/Bear Beastmen, Lamia, Fairy, Ghost, Giant,Orc, Ogre, Goblin, Kobold, Slime, Living Armor, Changeling, Mimic, Centaur, Alraune, Oni, Harpy, Siren, Arachne, Dryad, Golem, Zombie, Minotaur, Psychic, Vampire, Succubus, Archdemon, Archdevil, Archangel, Leviathan, Kraken, Phoenix, Roc, World Serpent, Tarrasque)
- Image style `anime_2`: "A digital painting, in the style of Honkai Star Rail, of" + 833-char Post describing porcelain skin, gradient shading + cel outlines, rim lights, background depth
- Image model: `wyhyd` — IW's Wyvern model (same engine as BotStory Cloudflare Flux)
- Story = pure narrative without any machine gamestate — character race + academy graduation arc is the entire world in `description/background/instructions/firstInput`

**Insight for BotStory:** The 61-character Summoned world proves that high-play-count community worlds don't need tracked items or triggers at all. The "world" is the character selector plus the prose instructions. BotStory already supports this pattern. The new thing is the "Honkai Star Rail" painterly preset: rim lighting + porcelain skin + cel-shade outline — a 3rd aesthetic beyond our 3 presets.

#### Key Pattern #7: Reality Altering Sandbox — evaluation hard-coded to always SUCCESS
The world's `evaluationRequest` is the single constant `"My action is always a SUCCESS."`. This is deliberate — no conclusions, no consequences. The author makes `evaluation` always return `SUCCESS` at the LLM prompt level so the player's reality-alteration fantasies always succeed. Conversely, their isekai variant (Isekai Re:birth at 58KB) uses a "Divine Being" quest-scaffold and permits failure.

Insight: the same author publishes both a **sandbox** (no-risk) and a **narrative-rule** (risk-with-quests) variant. Community creators do this via forking — same dice roll concept, different `evaluationRequest` contract.

#### Key Pattern #8: community cloning — same image strings across different worlds
Master PC and The livelity Notebook share **verbatim identical** `imageStyle*Pre/Post` strings:
```
Pre: 1X. Ultra-realistic whole-body image of
Post: Ultra-realistic. Perfect smooth round face. Face of Keira Knightley. Full body in view. IWDefault:65/65 RemoveNudityWordsWhenNoNudity
```
This is copy-fox community practice — a known-good Flux formula gets shared world-to-world. It validates that decidCredentials live in the World's `imageStyle*` fields, not in a per-instance/user setting.

#### What insights to carry forward into BotStory
1. **"1X." prefix + face-ref postfix**: Master PC and Notebook validate the formula for realistic body images. BotStory's `photorealistic` preset uses comparable tags. Optional future: pre-load a face reference into the preset.
2. **"Hentai || Anime." starter strings**: two community worlds from different authors use "dynamic, vibrant, ultra-detailed, highly stylised" as the tone descriptor before the model painter. BotStory's `anime` preset already fits this with "Anime cel shading, vibrant detailed hair".
3. **Honkai Star Rail "digital painting" artists' name collaged style** (Summoned has `anime_2`): 3rd style outside BotStory's 4 presets. "Rim light + porcelain skin + cel-shaded outline" is a community-refined aesthetic. Could become a 5th `Honkai style` preset in a future session.
4. **Post-only tag economy (photo_beautiful)**: validated — real community worlds run with just 3 tags in post and let the bare visual prompt describe the image. This is the norm, not the exception.
5. **61-character no-game-state world**: The engine doesn't need tracked items or triggers; in many highly-played worlds, the play is just character picker + prose. BotStory already supports this path; no code change needed.
6. **EvaluationRequest hard-coded:** "My action is always a SUCCESS." More common than expected. BotStory's comp.sh builds `evaluationRequest` from the existing success/failure framing — this is a template prompt edit, not a struct change.

---

## ⏳ Planned (Not Started)

> _Nothing outstanding from prior roadmap items. Possible future work surfaced during §14 verification (each is independent, none blocks the others):_

1. **Re-recon IW to capture verbatim per-preset strings** ~~— Made obsolete by §15 catalog trim (only 4 presets remain, all verbatim or deliberately-crafted)~~. For the archived 8 trim-dropped presets see the old `iw_image_style_presets.json` commit history.
2. **Per-world preset field default** — `World.imageStyle` currently carries the chosen preset id once applied; new worlds default to `null` (no preset). Consider a "use `photorealistic` for new sample worlds" code change if the user wants richer default imagery out of the box. _(Renamed from `photorealistic-1` in §15.)_
3. **Image provider token-strip** — if BotStory ever adds an image provider whose tokenizer doesn't know `IW<Tokens>` (only Flux has been exercised), wrap `imageClient.ts` with a token-strip pass keyed by provider id.
4. **Split `app/src/app/worlds/edit/page.tsx`** into a server `<Suspense>` wrapper (`page.tsx`) + `EditClient.tsx`. Currently one 720-line client component — works, but Go-to-Definition + SEO would benefit from the split. Low priority.

---

## 🅿️ Parked (Deferred Intentionally)

| Item | Reason |
|------|--------|
| **Community library / sharing / accounts** | Needs backend (Firebase/Supabase/GitHub Gists) — 10× scope of current app |
| **Themed model aliases (Smilodon/Lynx)** | BYOK philosophy = transparent raw model IDs; aliases add indirection |
| **OpenRouter credit test** | User's key has $0; user can add credits themselves later |
| **Per-turn cost display** | Only meaningful with billing layer (CF Workers AI free tier = no cost surface) |
| **Custom evaluation / description split prompts** | IW feature; BotStory's single-call JSON is simpler/cheaper; the schema still carries `evaluation` so a future split is non-breaking. Defer until requested |
| **Pre-commit hook** | Optional tooling; `.gitignore` already covers the `*_key.txt` patterns so the leak path is principally an accidental `git add -A` — a hook would be belt-and-braces |
| **Delete the three plaintext `*_key.txt` files at repo root** | Keys are gitignored and untracked; rotation/deletion is the user's call, not a code change |
| **Customize-redistribute character edit panel** | IW lets users re-point skill levels + regenerate portraits. Picker alone closes the named gap; redistribute is a separate feature. Defer until someone asks |
| **Splitting evaluation vs description LLM calls** | Would double token cost on every turn; schema carries `evaluation` so a future split is non-breaking. Defer until a world-author asks |

---

## 📂 File Index (Modified/New)

### New Files
| File | Purpose |
|------|---------|
| `proxy/cloudflare-worker.js` | Route-dispatching Worker (NVIDIA + CF image) |
| `proxy/wrangler.toml` | Worker config |
| `proxy/package.json` | Local `wrangler` + deploy script |
| `src/engine/textClient.ts` | Story generation (split from llmClient) |
| `src/engine/imageClient.ts` | Image generation (new) |
| `src/engine/victoryDefeatProcessor.ts` | Victory/defeat end-condition evaluation (JSON DSL + outcome.evaluation) |
| `src/engine/__tests__/victoryDefeatProcessor.test.ts` | 7 V/D unit tests |
| `src/engine/summarizer.ts` | Long-term memory summariser — `Summarizer` class + `SUMMARY_DEFAULTS`, called from orchestrator every N turns |
| `src/engine/__tests__/summarizer.test.ts` | 7 summariser unit tests (predicate, fake-client run, prior-summary fold-in, instruction override, length cap) |
| `src/engine/imageStylePresets.ts` | 4-preset IW image-style catalog + `applyPreset`/`matchPreset` |
| `src/engine/__tests__/imageStylePresets.test.ts` | 14 preset unit tests |
| `app/src/app/worlds/edit/page.tsx` | Panel world editor — collapsible cards for Introducing the story / Instruction Blocks / Tracked Items / Triggers / Victory & Defeat, with full CRUD and a Save & Play action. **Moved this session** from `/worlds/[id]/edit/` to `/worlds/edit?worldId=X` (query-param form) because `output: "export"` rejects the dynamic path. Also gained the "Visual style (image presets)" card this session — see §14.
| `docs/AUDIT.md` | Code/architecture audit |
| `docs/PLAYABILITY_GAP.md` | Missing features vs infiniteworlds.app |
| `docs/PROGRESS.md` | This file |
| `docs/community_worlds/*.json` | 7 community-world JSONs exported from IW (§17) |

### Modified Files
| File | Changes |
|------|---------|
| `src/engine/types.ts` | Two-provider shapes + `StoryInstance.lastSnapshot`/`summary`/`summaryTurn`; `TurnMessage.whereWhen`; `World.summarizationInstructions` |
| `src/engine/llmClient.ts` | Compat shim (re-exports `textClient`) |
| `src/engine/orchestrator.ts` | Dual-provider `executeTurn`/`regenerateLastTurn`; V/D processor wire-in; snapshot preserved (no longer cleared); new `swapImage()` method; summariser wired in after turn increment |
| `src/engine/composer.ts` | Prepends `=== LONG-TERM SUMMARY ===` section before recent history when `instance.summary` exists |
| `src/engine/storage.ts` | Dual-provider + migrations + `deleteWorld` cascade |
| `src/engine/triggerProcessor.ts` | Removed no-op `e.data` ternary (P4) |
| `src/engine/importer.ts` | `!Array.isArray(raw.trackedItems)` (P4) |
| `src/engine/__tests__/orchestrator.test.ts` | Updated for new API + Summarizer dep; +2 snapshot-restore & V/D integration tests |
| `src/app/settings/page.tsx` | Complete rewrite (two-provider UI) |
| `src/app/play/page.tsx` | Dual-provider wiring; character picker gate (`CharacterPicker`); `mx-auto max-w-3xl` column + 3-col action grid; Objective banner + 📍 whereWhen caption; 🔄 Swap image per assistant image; ≡ Menu drawer (`GameMenu` — Save point / Model swap / Storyteller toggle / Restart); ✎ Edit header link |
| `src/app/worlds/page.tsx` | Sample world defeatCondition → JSON DSL so the engine fires it; per-world "✎ Edit" + "⎘ Copy" actions (`handleMakeCopy` clones via `crypto.randomUUID()`) |
| `src/app/page.tsx` | Dual-provider status |
| `.gitignore` | Added `cloudflare_key.txt`, `*_key.txt` patterns |

---

## 🚀 Next Actions (When You Say "Go")

Completed items are struck through:

1. ~~**Finish P1s** — Done: snapshot/restore wired + `victoryDefeatProcessor.ts` added (§7, §8)~~
2. ~~**Audit P2-P4 nits** — Done (§9)~~
3. ~~**Playability gaps** — All 7 shipped (§10)~~
4. ~~**Live full-turn QA** — Done (§11)~~
5. ~~**IW image-style presets** — Done (§14)~~
6. ~~**Commit + PR** — Done (§13, 2026-07-30)~~
7. ~~**§15 Catalog trim (12→4 presets)** — Committed (`a8edff3`)~~
8. ~~**§16 Aspect-ratio image setting** — Committed (`f391906`)~~
9. ~~**§17 Export 7 community worlds** — 7 JSONs saved to `docs/community_worlds/`~~
10. ~~**§17 Image-instruction study deep-dive** — All 7 worlds studied; 8 key patterns written to PROGRESS.md §17~~
11. ~~**Push §15 + §16 commits** to `origin/main` — Pushed (`88c96e0..f391906`)~~
12. ~~**Run `graphify update .`** — Rebuilt: 566 nodes, 881 edges, 46 communities~~
13. **Verify GH Pages deploy** reflects the trimmed 4-preset catalog + aspect-ratio toggle — **Build pending** (Actions running or cache). Settings page still shows old build without "Aspect Ratio" section. Editor 404. Check again after Actions completes.

---

## 💡 Reference Info

- **Worker URL:** `https://botstory-proxy.jainkumar365.workers.dev`
- **CF Account ID:** `a3e40b1b604efd1b0829859290ccb598`
- **Keys (gitignored):** `gemini_key.txt`, `nvidia_key.txt`, `openrouter_key.txt`, `cloudflare_key.txt`
- **Pre-commit hook:** Not installed; intentionally skipped (optional tooling)
- **Graphify:** Last rebuilt 2026-08-01 via `graphify update .` — **566 nodes / 881 edges / 46 communities** (AST-only, no API cost; was 544/856/45 on 2026-07-30; delta from this session's §15 trim + §16 aspect-ratio + §17 PROGRESS.md).