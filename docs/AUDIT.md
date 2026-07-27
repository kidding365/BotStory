# BotStory — Code & Architecture Audit

**Audited:** 2026-07-12
**Revision:** `714abd5` (HEAD of main)
**Scope:** `app/` engine + pages, `proxy/`, CI, docs config.

## Health (all green at audit time)
| Check | Command | Result |
|---|---|---|
| Unit tests | `npm test` | 19/19 pass |
| Type check | `npx tsc --noEmit` | clean |
| Lint | `npm run lint` | clean |
| Build | `npm run build` | succeeds, 5 routes (`/`, `/play`, `/settings`, `/worlds`, `/_not-found`) |

## Verdict
A well-scoped, disciplined ~1,300-LOC client-side app. Engine is cleanly separated from React, dependency-light (only `idb` is non-platform), unit-tested at the stateful seams, and the BYOK promise is honored honestly. The real issues below are "shipped a stub / dead flag" rather than "designed wrong."

## What's good
- **Dependency hygiene.** Runtime: `next`, `react`, `react-dom`, `idb`. No state lib, UI lib, or schema lib. `idb` is the right non-platform dep.
- **Engine/UI separation.** `engine/` has zero React imports; pages import it. `TurnOrchestrator` ctor takes deps — testable; `orchestrator.test.ts` mocks them.
- **Error UX at trust boundaries.** `llmClient.ts:41-55` translates "Failed to fetch" into a specific NVIDIA-CORS hint pointing at the included Worker. Senior move — symptom generic, cause isn't.
- **Cloudflare Worker** (`proxy/cloudflare-worker.js`) — minimal, correct, no key bake-in, CORS preflight handled, 405 on wrong method.
- **Defensive importer.** `importer.ts` normalizes IW casing, defaults gracefully, warns vs. throws, every field through `asString`/`asNumber`/`asArray`.
- **JSON extraction** (`llmClient.ts:84-142`) — clean parse → balanced-brace slice → trailing-comma/quote fix, last-resort 500-char error slice. Pragmatic.
- **Self-check suite.** 19 tests cover composer/logic/orchestrator/importer/storage — the stateful path end-to-end (mocked LLM), trigger one-shot semantics, schema normalization.

## Issues by severity

### 🔴 P1 — Dead feature metronome
`World.victoryCondition` / `defeatCondition` (`types.ts:104-105`) carry `alreadyFired?: boolean` that nothing ever sets to `true` or reads. README/Spec claim victory/defeat (`README:13`) but the engine never evaluates these — only the LLM's `ended`/`endMessage` (`orchestrator.ts:89-92`) ends a game. `StoryInstance.firedTriggerOutcomes` (`types.ts:126`) likewise declared, never written, never read.
**Root cause:** signals designed in, never wired.
**Fix:** ~30 lines — add a `victoryDefeatProcessor` step in the orchestrator after triggers, evaluating the two conditions against `currentValues`/`outcome`, mirroring `triggerProcessor`'s `item` condition. Or delete the fields and retire the claim from README/Spec.
**Until then** the dashboard and README overstate what the engine does.

### 🔴 P1 — Snapshot restoration never happens
`orchestrator.ts:34` calls `this.stateManager.snapshot(instance)` and **throws the return value away**. `StateManager.restore()` (`stateManager.ts:45`) is never called anywhere. `regenerateLastTurn` (`orchestrator.ts:106`) manually slices `history` and decrements `turnNumber` instead — leaving `currentValues`, `modifiedBlocks`, `firedTriggers` at their *post-turn* state. So "Regenerate" re-rolls the prose but keeps the state changes you just made — the opposite of what a snapshot is for.
**Fix:** store the snapshot on the instance and restore it in `regenerateLastTurn`, OR delete `snapshot`/`restore` (YAGNI). The current middle state is the worst option — the manual slice ate the feature.

### 🟠 P2 — Three API key files in the working tree
`gemini_key.txt`, `nvidia_key.txt`, `openrouter_key.txt` at repo root. They **are** gitignored (`.gitignore:53-56`); `git ls-files` confirms untracked — no leak, nothing pushed. But real-looking keys (40/71/74 chars) in plaintext next to a public-bound repo is one bad `git add -A` from a disaster.
**Fix:** delete them; load keys via Settings like every other user. **Rotate if real** — on disk since Jul 11.

### 🟠 P2 — `storage.deleteWorld` orphans story instances
`storage.ts:45-48` deletes only the world. The cascade lives in the React UI (`worlds/page.tsx:77-79`). A programmatic caller (future API, "import and replace", test helper) orphans `StoryInstance` rows — they render as "Unknown world" (`play/page.tsx:118`) forever.
**Fix:** move the cascade into `deleteWorld` itself; drop the UI's manual loop. One place, one rule.

### 🟡 P3 — Image generation ignores cancellation
`generateImage` (`llmClient.ts:58-66, 256-279`) takes no `signal`; `orchestrator.ts:64` doesn't forward `opts.signal`. A user navigating away mid-imagen still waits on the fetch and burns the API call. Pass `opts.signal` through `generateImage(config, prompt, opts)` → `geminiImage(... opts)` → `fetch(..., { signal })`. Three lines.
Wider: the UI never constructs an `AbortController` at all — `doAction`/`regenerate` can't be cancelled. Signal plumbing is half-built, un-wired.

### 🟡 P3 — Unbounded prompt growth / O(turns × lore × keywords)
`composer.ts:94` sends last 8 history messages, all active instruction blocks, all keyword-matched lore, all tracked items — every turn. `collectLore:120-128` concatenates **the entire history** into the haystack and scans every lore entry's every keyword on every turn. O(turns × lore × keywords) per turn — fine at turn 50 w/ 20 entries, painful at turn 500 w/ 200.
**Fix:** cap the haystack to the same last-N history window, or scan only recent history for lore keywords. Name the ceiling, move on.

### 🟡 P3 — Stale victory/defeat GUI text & dashboard drift
Play page declares sample world's `victory/defeatCondition` (`worlds/page.tsx:313-320`) and renders `instance.ended`/`endMessage` — but the engine never fires those conditions (P1), so the only way a game ends is the LLM deciding `ended: true`. Dashboard shows "Fired Triggers" but never victory/defeat status. Either wire P1 or stop implying they're live.

### ⚪ P4 — Nits
- `triggerProcessor.ts:35` — `const data = typeof e.data === 'string' ? e.data : e.data;` both branches identical. Leftover refactor. Delete the ternary.
- `importer.ts:108` — `Array.isArray(raw.trackedItems) === false` only fires when the key is explicitly non-array; never triggers for the common "key missing" case. Should be `!Array.isArray(...)` if intent is "no trackedItems key seen."
- `logic.test.ts:86` — assert `firedTriggers.includes('find_gold')` is `false`; current `firedTriggerIds` assertion is the same thing twice.
- `app/dev.log` — gitignored leftover; `rm`.
- `README:99` — claims MIT but no LICENSE file, no `license` in `package.json`. Repo is technically all-rights-reserved. Add the file or stop implying MIT.
- `AGENTS.md` documents a `graphify-out/` graph that doesn't exist (`docs/graphify-out/` is empty). Drop the section or run `graphify update .`.

## Security
- ✅ Keys in localStorage, sent direct to providers — no third-party exfil by design.
- ✅ Cloudflare Worker doesn't bake keys; user passes `Authorization` per request.
- ✅ Zero `dangerouslySetInnerHTML` / `innerHTML` — narrative rendered as text.
- ✅ No `eval` / `new Function` / dynamic template injection.
- ⚠️ The three `*_key.txt` files (P2) — not committed, but a habit away from a leak.
- ⚠️ `JSON.parse` on `localStorage` provider blob (`storage.ts:85,93,100`) unguarded — self-inflicted corruption crashes Settings load. One try/catch returning `{}` on failure, free.
- ✅ CORS handled correctly per-provider; NVIDIA gap documented in-product, not hidden.

## Correctness spotlight: trigger fuzzy-match
`TriggerProcessor.fuzzy` (`triggerProcessor.ts:119-130`) — lowercased substring then 2+ token overlap at ≥50% of event tokens. Reasonable heuristic for LLM-generated event labels against authored conditions. Will false-positive on short labels (`"start"` ↔ `"restart_the_engine"`) but the ≥2-token guard bounds the damage. Acceptable; mark the ceiling in a comment.

## Fix order
1. **Decide victory/defeat (P1).** Wire it (~30 lines) or delete the fields + retire README/Spec claim. Dead end-conditions bite future maintainers.
2. **Decide snapshot (P1).** Use `restore()` in `regenerateLastTurn` or delete `snapshot`/`restore`. The middle state is the worst.
3. **Delete the three key files (P2)** and rotate if real.
4. **Move delete-cascade into `storage.deleteWorld` (P2)** — three lines.
5. P3/P4: ship-when-bothersome.

## One-line starter fixes (after the P1 decisions)
```ts
// storage.ts — cascade at the trust boundary
async deleteWorld(id: string): Promise<void> {
  const db = await this.getDB();
  const tx = db.transaction([STORE_WORLDS, STORE_INSTANCES], 'readwrite');
  const insts = (await tx.objectStore(STORE_INSTANCES).getAll()) as StoryInstance[];
  for (const i of insts) if (i.worldId === id) await tx.objectStore(STORE_INSTANCES).delete(i.id);
  await tx.objectStore(STORE_WORLDS).delete(id);
  await tx.done;
}
```
```ts
// orchestrator.ts — forward the signal that's already plumbed
if (opts.generateImage) {
  const img = await this.llmClient.generateImage(provider, visualPrompt, opts); // pass opts through
  if (img) imageDataUrl = img;
}
```
