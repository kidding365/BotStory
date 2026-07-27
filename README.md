# BotStory

A client-side, **BYOK** (Bring-Your-Own-Key) clone of [infiniteworlds.app](https://infiniteworlds.app) that you can host for free on GitHub Pages.

🌐 **Live demo:** <https://kidding365.github.io/BotStory/>

## Features

- **BYOK** — paste your own API key in the browser. No backend, no proxy, no rate limits from us. Your key is stored only in your browser's `localStorage` and sent directly to the provider.
  - **Text providers** (Story AI): **Google AI Studio (Gemini)**, **OpenRouter**, **NVIDIA NIM**, and any **OpenAI-compatible** endpoint. NVIDIA (and Cloudflare below) route through your own Cloudflare Worker proxy (BYOK; deploy once, free tier).
  - **Image providers** (Image AI): Off, **Gemini Imagen**, **Cloudflare Workers AI** (Flux / SDXL / SDXL-Lightning), and any custom endpoint.
- **Auto-summariser** — best-effort long-term memory: every N turns past turn 8, the engine makes a one-shot summary LLM call and folds it into subsequent prompts so 200+-turn playthroughs still have grounded context.
- **JSON import** — paste any world exported from infiniteworlds.app (turn on *Show raw JSON* in the World Editor → Misc advanced features) and BotStory will adapt it automatically. Or use the built-in sample world.
- **Panel World Editor** — `/worlds/[id]/edit` lets you author/modify every part of a world (title/description/instructions, instruction blocks, tracked items, triggers, victory/defeat conditions) without touching JSON. Plus per-world ✎ Edit and ⎘ Copy actions in the World Library.
- **Full game loop**: tracked items, instruction blocks, keyword-triggered lore, trigger events with effects (messages, state updates, instruction block rewrites, end-game), state snapshots, regenerate-turn, narrative override ("Storyteller mode"), image steering, victory/defeat conditions (JSON DSL `{ "trackedItemID": "<id>", "value": <v> }` + LLM `evaluation`).
- **In-game Menu** — mid-game Save point (snapshot clone), model swap, Storyteller-mode toggle, and Restart, all without leaving the play page.
- **Storyteller Dashboard** — peek at hidden state, fired triggers, and active instruction blocks.
- **Multiple playthroughs** — every Play creates a saved `StoryInstance` you can resume.
- **Zero infrastructure for the app** — the entire app is a Next.js static export, hosted on GitHub Pages. NVIDIA + Cloudflare image need a single Cloudflare Worker deployed once (see `proxy/`).

## How it works

```
JSON world schema ─┐
                   │
Player action  ────┼─► PromptComposer ─► LLM (Gemini/OpenRouter/NVIDIA/...) ─► AIOutcome
                   │                                                          │
Active blocks   ───┘                                                          ▼
Recent history  ──────────────────────────────────────────────► StateManager + TriggerProcessor
Lore (RAG)      ──────────────────────────────────────────────►  - applies stateUpdates
Tracked items   ──────────────────────────────────────────────►  - fires triggers
                                                                - mutates instruction blocks
                                                                - (optionally) generates image
                                                                ▼
                                                          StoryInstance (IndexedDB)
```

## Project layout

```
.
├── .github/workflows/deploy.yml   # CI: lint, test, build, deploy to gh-pages
├── AGENTS.md                      # Recipes for agent sessions: quality gates, dev server, browser-QA toolchain
├── app/                           # Next.js 16 app (TypeScript + Tailwind)
│   ├── src/
│   │   ├── app/                   # Pages: /, /settings, /worlds, /worlds/[id]/edit, /play
│   │   └── engine/                # Core engine (see below) + __tests__ (vitest)
│   └── package.json
├── docs/                          # Design docs, schemas, analysis, progress
│   ├── AUDIT.md
│   ├── BotStory_Spec.md
│   ├── InfiniteWorlds_Analysis.md
│   ├── PLAYABILITY_GAP.md
│   ├── PROGRESS.md                # Comprehensive session progress / next actions
│   ├── college_of_magic_schema.json
│   └── wiki/                      # Detailed design notes (incl. Browser_Automation_Notes.md)
├── proxy/                         # Cloudflare Worker for NVIDIA + Cloudflare image CORS
│   ├── cloudflare-worker.js
│   ├── wrangler.toml
│   └── package.json
└── README.md (this file)
```

### Engine modules (`app/src/engine/`)

- **`types.ts`** — TypeScript model of a world, instance, turn, AI outcome. Includes dual-provider configs (text + image) and the `WorkerConfig` shape.
- **`composer.ts`** — Builds the system + user prompt for the LLM from the world schema and live instance state. Folds `instance.summary` into the prompt past turn-8 boundaries.
- **`stateManager.ts`** — Applies `stateUpdates` respecting each tracked item's data type. Snapshots/restores for *Regenerate Turn*.
- **`triggerProcessor.ts`** — Evaluates trigger conditions, applies effects (set value, modify block, show message, end game), enforces one-shot semantics.
- **`victoryDefeatProcessor.ts`** — Evaluates `world.victoryCondition`/`defeatCondition`: JSON-DSL tracked-item match OR `outcome.evaluation === 'SUCCESS'/'FAILURE'`.
- **`summarizer.ts`** — `SUMMARY_DEFAULTS = { startTurn: 8, every: 6, windowLookback: 12, maxSummaryChars: 1500 }`; `shouldSummarise` predicate + `run` method (best-effort, errors swallowed).
- **`textClient.ts`** — Story (text) provider client — direct calls for Gemini/OpenRouter, Worker-routed for NVIDIA/Custom.
- **`imageClient.ts`** — Image provider client — Off / Gemini Imagen / Cloudflare (via Worker) / Custom.
- **`llmClient.ts`** — Compat shim re-exporting `textClient` (deprecated).
- **`orchestrator.ts`** — The full turn: snapshot → compose → LLM → state → triggers → V/D → image → history append → summariser → persist. Plus `regenerateLastTurn` and `swapImage`.
- **`importer.ts`** — Validates and normalises a world JSON (InfiniteWorlds or native format) into our `World` model. Throws `SchemaImportError` on failure.
- **`storage.ts`** — IndexedDB for worlds/instances, localStorage for text_provider/image_provider/worker configs with backward-compatible migrations. Cascade delete in `deleteWorld`.

## Run locally

```bash
cd app
npm install
# Default Next.js port is 3000, but our dev conventions use 3939 so the dev server
# can coexist with other tooling on the dev box.
PORT=3939 npm run dev   # http://localhost:3939
```

Then open <http://localhost:3939>, go to **Settings**, paste your Story AI key (Gemini/OpenRouter/NVIDIA) and Image AI key (Gemini Imagen/Cloudflare) and (for NVIDIA + Cloudflare image) the Worker URL, then open the **World Library** and click **Load sample world** → **Import JSON** → **▶ Play new**.

> If you want to use NVIDIA NIM text or Cloudflare Workers AI image, deploy the Cloudflare Worker in `proxy/` first. NVIDIA does not allow browser-direct CORS for `integrate.api.nvidia.com`, and Cloudflare image has the same CORS restriction. The Worker is BYOK (server-side key suppression, but the keys we use are sent in `X-Api-Key` headers from the browser — improve as you see fit). Plain Gemini/Gemini-Imagen text are direct browser calls.

## Test

```bash
cd app
npm test        # vitest run, 35 tests as of 2026-07-27
npm run lint    # eslint, 0 errors expected
npx tsc --noEmit  # TypeScript typecheck, expect clean
npm run build   # static export to ./out
```

There is no `typecheck` script — invoke `npx tsc --noEmit` directly. All three gates MUST be green before any commit.

## Deploy

Pushes to `main` trigger `.github/workflows/deploy.yml`, which:

1. Lints and runs the test suite.
2. Builds the static export with `output: 'export'`.
3. Adds `.nojekyll`.
4. Uses `JamesIves/github-pages-deploy-action` to push `./out` to the `gh-pages` branch.

The GitHub Pages site is configured to serve the `gh-pages` branch at <https://kidding365.github.io/BotStory/>.

## Credits

Inspired by, and reverse-engineered from, [Infinite Worlds](https://infiniteworlds.app). Not affiliated.

## License

MIT (see `LICENSE` if you add one — currently uses the default).
