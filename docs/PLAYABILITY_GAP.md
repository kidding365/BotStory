# BotStory vs InfiniteWorlds — Playable-Experience Gap Analysis

**Generated:** 2026-07-12
**Method:** Drove `infiniteworlds.app` live as a new player through: world library → character customize → play turn → in-game Menu → world editor (Make copy + Edit on a cloned College of Magic v2.24, every section incl. Show optional features).

The audit in `AUDIT.md` covers code quality. This doc covers **what's missing for a playable experience** — features BotStory either lacks or stubs that IW renders well, organized by what the user explicitly named plus what else I found missing while clicking around.

See also `docs/InfiniteWorlds_Analysis.md` for the spec-level architecture (still accurate).

---

## What the user named directly

### 1. Layout "alignment" feels better in IW
IW play surface is a **single centered column** with three stacked zones, fixed-width, generous vertical breathing room:
  - Narration block (top, fills the column)
  - Suggested-action buttons (3 chip-buttons, centered, evenly spaced, large hit area)
  - Free-text input + "Take action" (bottom of column)
  - Header has: title (`College of Magic — Aria Silverleaf, turn 1`), credits (`Credits: 1121`), `Menu`, an image toolbar (`Swap image`, `Background`)

BotStory `play/page.tsx` (lines 257–420) puts the same zones in a `flex h-screen` two-pane layout: left chat column + optional 96-rem **Storyteller Dashboard** drawer on the right. The dashboard is opt-in and slid over, but the default-stacked chat column doesn't center horizontally and the suggested-actions chips wrap as flex-wrap with small padding (`play/page.tsx:357-371`). The play surface itself reads as a port of a chat UI rather than a game surface.

**Fix (small):**
  - Wrap the play column in `mx-auto max-w-3xl` so narration blocks stay centered on wide monitors (currently the chat column is `flex-1` and spreads to viewport edge).
  - Give the suggested-action chips `gap-3` and a fixed unit width (`grid grid-cols-1 md:grid-cols-3 gap-3`) so they read as a 3-row of equal buttons like IW's.
  - Move `Credits`/`Swap image`/`Background` chips into the header row alongside the existing toaster/Import/Dashboard buttons — IW keeps tooling in one strip, BotStory has it scattered.
  - That's ~10 lines of Tailwind. No engine change.

### 2. No way to edit a world — before or during play
IW has two entry points to the same editor:
  - **From the library:** "Make copy" of any world → clone appears under **Your Worlds** with `Edit / Make copy / Share / Delete` actions.
  - **Mid-game:** `Menu → "Start new adventure / Edit adventure"` opens the editor on the **currently-loaded world**, you save and resume.

The editor is a single scrolled page with **collapsible sections** (not a textarea of raw JSON):
  - *Introducing the story* (title, description, objective)
  - *Main instructions* — big textarea + **Extra instruction blocks** as named, add/remove/reorder cards
  - *Image style* (model + style details)
  - *Player character options* (this is per-character edit — see §3)
  - *Victory and defeat* (freeform condition + epilogue text)
  - *Other characters (optional)*
  - *Keyword instruction blocks* (advanced) — lorebook
  - *Tracked items (advanced)* — each item is a named expandable card (dataType, visibility, value, description, update instructions)
  - *Triggers (advanced)* — same card pattern
  - *Specialist instructions* — overrideable eval / description / **summarisation** prompts
  - *Misc advanced features* — `<<var>>` equation editor, AI-specific instruction blocks, "Show raw JSON" escape hatch
  - *Permissions* (optional, for sharing)
  Footer: `Discard changes / Save changes and exit / Save and play now`

BotStory has only the raw-JSON paste/upload path (`worlds/page.tsx:28-73`, `play/page.tsx:217-225`). There is **no panel editor**, **no per-block CRUD**, and **no edit-after-import** — once imported, a world is immutable except by re-importing.

**Fix (big but incremental):** A new route `/worlds/[id]/edit` rendering one collapsible-card per `World` field with `useState` + `storage.saveWorld` on save. Reuse the existing `importWorld` shape as the form state; ~8 cards. Add a "Make copy" button on `worlds/page.tsx:122` that clones via `storage.saveWorld({...w, id: crypto.randomUUID()})`. Add the in-game entry by extending `play/page.tsx`'s header Import button group with an "✎ Edit" link to `/worlds/[id]/edit`.
  - Ship the **block editor for instruction blocks + tracked items + triggers first** — those are the three blocks the user is most likely trying to tune. The rest can ship as fields behind the same scaffolding later.

### 3. No character choice
IW's College of Magic shows **6 characters**, each with:
  - Name + portrait
  - Description (3–5 sentences)
  - 5 skills with **named levels** (`Magical talent: 4 (Highly skilled)`, `Charisma: 3 (Competent)`, etc.)
  - `Choose character` button (start now)
  - `Customize Character` button — opens a panel with editable **Name**, **Description**, **portrait regenerate** (`Generate New Portraits`), and **Free Skill Points** redistribution via per-skill `− / +` buttons.

BotStory's equivalent (`play/page.tsx:93-94`): `const characterId = w.possibleCharacters[0]?.characterId || null;` — silently takes the first character. The dashboard passively *shows* the active character's name; there is no UI to choose among `world.possibleCharacters` even though the schema already supports many (`types.ts:5-13`, `composer.ts:36-49` already renders whichever one is selected).

**Fix (small):** If `world.possibleCharacters.length > 1`, render a `CharacterPicker` step before the play surface — a list of cards each with name/portrait/description/skill rows + a "Choose" button that sets `instance.characterId` and `storage.saveInstance`. Skip the picker if there's only one (current behavior). ~40 lines, no engine change.
  - Customize-redistribute is a *separate* feature (skill-point arithmetic + AI portrait gen) — defer until someone asks. The picker alone closes the named gap.

### 4. "JSON data is put in its own blocks" — the panel editor
Already covered in §2 — IW's editor renders each `World` fieldgroup as its own card; raw JSON is an **escape hatch** under "Misc advanced features", explicitly labeled unsupported/documented. BotStory currently exposes *only* the raw JSON. Inverting that default is the entire fix.

---

## What else is missing for a playable experience (found while clicking)

These are gaps the user didn't name but which IW treats as table-stakes and BotStory doesn't have at all. Listed by impact, lowest-first since the user can ship §1–§4 first.

### A. World sharing / community library
IW's community library has 5,140 worlds with tags, search, sort (Trending / Newest / Most played / Random), mature-content filter, favourites filter, anonymous-display-name authors (`Shy Burgundy Meerkat`), per-world share-link (`infiniteworlds.app/shared/rourzr`), and "X turns played" counters.

BotStory has no sharing layer at all — worlds live in the user's own IndexedDB. The README's "hosted for free on GitHub Pages" pitch implies sharing-URLs but they don't exist.
  - This is **out of scope for a static BYOK clone** unless you add a tiny backend (Firebase, Supabase, or a GitHub-gist-backed scheme). **Don't build this** until §1–§4 are done and someone still wants it — it's a 10×-larger feature than the rest of the app combined.

### B. Save / Load / Restart adventure
IW Menu has explicit `Save game / Load game / Restart adventure`. Each playthrough is a named savable slot, not just an auto-persisted instance.

BotStory *auto-persists* every instance (`orchestrator.ts:96`) but exposes no manual save-slot UI. The current `/play?instanceId=…` URL + "Recent playthroughs" cards on the home page (`page.tsx:110-135`) amounts to a single implicit autosave per world. Close, but no "save before a risky action and restore on failure" workflow.
  - **Fix (small):** "Save snapshot" button that clones the current instance under a new id `inst_<ts>_save_<label>`; restore = navigate to that id. IW's net effect is the same. ~30 lines, all client-side.

### C. Model choice at session time + per-turn model swap
IW Menu surfaces `AI model: Smilodon` and `Image model: Manticore` and credits (`Credits: 1121`) — and both can be swapped mid-game. The College of Magic page advertises per-turn cost differences (`0.9 credits on Lynx, 2.4 on Smilodon`).

BotStory has the provider plumbing (`storage.ts:90-110`, `settings/page.tsx:104`) but **model is set in Settings only** and applies globally. No mid-session swap, no cost indicator, no per-world recommended model surfaced in the UI even though the schema has `World.recommendedAIModel` (`types.ts:82`) and it's *imported* (`importer.ts:175`) but never displayed anywhere.
  - **Fix (small):** Surface `world.recommendedAIModel` on the World Library card + Settings; add a model dropdown to the in-game Menu if a Menu ever appears. Cost indicator only makes sense with a billing layer — skip (see §A).

### D. Storyteller mode (narrative-override is a *toggle*, not a button)
IW Menu: `Storyteller mode: Off/On`. When on, the player can write narrative directly (matches BotStory's existing `narrativeOverride` field — `types.ts:165`, `composer.ts:109-111`, `play/page.tsx:349-356`).

BotStory already has the *capability* but exposes it as a `✒` button that reveals a one-line textarea inline. IW makes it a mode you switch into — clearer affordance, harder to misfire.
  - **Fix (tiny):** Make `showNarrativeOverride` a header toggle like the Dashboard; collapse the textarea into the same drawer. ~5 lines refactoring.

### E. Periodic summarisation (long-term memory)
IW runs a Summary AI every 6 turns starting at turn 8 to condense history — `InfiniteWorlds_Analysis.md:30`, and confirmed in the editor: **"Specialist instructions → Summarisation instructions"** lets world authors override what the summarizer should keep ("Make sure to record in detail what knowledge each character has of the events of the murder").

BotStory sends the last 8 turns verbatim and *no* summary (`composer.ts:91-99`, AUDIT P3). For short playthroughs that's fine; for the 200+-turn worlds dominating IW's "most played" (Hogwarts: 175K turns, Master PC: 984K), the lack of summarization is a hard ceiling — it either truncates older context silently or balloons token cost.
  - **Fix (medium):** A `summarizer.ts` that runs every N turns (configurable per-world via a new `World.summarizationInstructions`), stores a rolling `StoryInstance.summary: string`, and gets prepended to the prompt by `composer.ts` after history. ~80 lines engine + one LLM call per N turns. Until then: name the ceiling in a comment in `composer.ts` (AUDIT already flags O(turns × lore) growth).
  - Lower-effort alternative: just bump the recent-history window + add `Instance.summary` as a single editable field the user pastes manually — defer the auto-summarizer.

### F. Skill-evaluation prompt as a first-class concept
IW splits the LLM call into an *Evaluation* pass (does the action succeed? vs skills/difficulty) and a *Description* pass (narrate the outcome) — both overrideable per-world via Specialist instructions. The composer emits one combined call.

BotStory collapses both into one `AIOutcome` (`types.ts:147-160`): `evaluation`, `narrative`, `stateUpdates`, etc. all in a single JSON-mode response. That's a *simpler, cheaper* design and probably the right lazy call for most worlds — but worlds that care about strictness (College of Magic, RWBY combat) want the separation.
  - **Defer.** Splitting the call doubles token cost on every turn. Add only when a world-author actually asks for it; the schema already carries `evaluation` so a future split is non-breaking.

### G. Image regression / "Swap image" / "Background"
IW play surface has `Swap image` (regenerate current image with a different seed) and `Background` (show the current scene's location card: "Dormroom"). Both are one-tap operations on the current state.

BotStory has image generation (`orchestrator.ts:50-66`) and stores `imageDataUrl` on the assistant turn (`play/page.tsx:429-435`), but there's no "regenerate this image" or "tell me where I am" affordance — only "steer the *next* image" via the 🎬 box.
  - **Fix (small):** Add `🔄 Swap` next to any rendered assistant image that re-runs `generateImage` with the stored `visualPrompt` and replaces the URL. Background can just render `outcome.whereWhen` (already in `AIOutcome`, `types.ts:150`) above the narration. ~15 lines.

### H. `whereWhen` and `objective` rendered in-UI
IW shows "Your objective for this adventure is: …" inline at the bottom of turn 1 and `Dormroom` as a scene tag. BotStory's schema has `World.objective` (`types.ts:84`, imported but never rendered outside the composer prompt) and `AIOutcome.whereWhen` (parsed but never displayed). Both are dead UI fields.

**Fix (tiny):** Render `world.objective` once under the first assistant message; render `outcome.whereWhen` as a small muted caption above each turn. ~10 lines.

---

## Recommended shipping order

These are the changes that move BotStory from "importable clone" to "actually playable" without committing to features that need a backend.

| # | Item | Effort | Closes |
|---|------|-------|-------|
| 1 | Layout alignment (center column, 3-col suggested-actions, header tooling strip) | S | user-named #1 |
| 2 | Character picker (>1 character → choose before play) | S | user-named #3 |
| 3 | Render `objective` + `whereWhen` in-UI; "Swap image" | S | §G, §H |
| 4 | `Edit` route + `Make copy` + per-block cards for instruction blocks / tracked items / triggers (defer Specialist/AI-specific/Permissions cards) | M | user-named #2, #4 |
| 5 | In-game Menu with model swap + Storyteller-mode toggle + Save/Load/Restart | M | §B, §C, §D |
| 6 | Auto-summarizer (long-term memory) | M | §E |
| — | Community library / sharing / accounts | XL | §A — do not start until 1–6 land and a real user asks |

**Definition of "playable":** after 1–5 ship, a new user can import a world from IW, pick a character, edit any block before or mid-play, swap models, save/restart — without ever opening the raw JSON. That matches the IW experience minus the community features, which is the right scope for a static BYOK clone.

## One-line fixes I'd ship today
```tsx
// play/page.tsx — center column + 3-col actions
<div className="flex h-screen ...">
  <div className="flex-1 flex flex-col min-w-0 mx-auto max-w-3xl w-full">
  ...
  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{suggested.map(...)}</div>
```
```tsx
// play/page.tsx — character picker before init()
if (w.possibleCharacters.length > 1 && !instanceId) { setPickingChar(true); return; }
```
```tsx
// new /worlds/[id]/edit/page.tsx — first card (instruction blocks)
{world.instructionBlocks.map(b => <BlockCard block={b} onSave={(nb) => saveBlock(b.id, nb)} />)}
```
