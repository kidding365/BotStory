# BotStory

A client-side, **BYOK** (Bring-Your-Own-Key) clone of [infiniteworlds.app](https://infiniteworlds.app) that you can host for free on GitHub Pages.

🌐 **Live demo:** <https://kidding365.github.io/BotStory/>

## Features

- **BYOK** — paste your own API key in the browser. No backend, no proxy, no rate limits from us. Your key is stored only in your browser's `localStorage` and sent directly to the provider.
  - Supported providers: **Google AI Studio (Gemini)**, **OpenAI**, **Anthropic Claude**, **OpenRouter**, and any **OpenAI-compatible** endpoint.
- **Image generation** for Gemini via Imagen (if you set an image model).
- **JSON import** — paste any world exported from infiniteworlds.app (turn on *Show raw JSON* in the World Editor → Misc advanced features) and BotStory will adapt it automatically. Or use the built-in sample world.
- **Full game loop**: tracked items, instruction blocks, keyword-triggered lore, trigger events with effects (messages, state updates, instruction block rewrites, end-game), state snapshots, regenerate-turn, narrative override, image steering, victory/defeat conditions.
- **Storyteller Dashboard** — peek at hidden state, fired triggers, and active instruction blocks.
- **Multiple playthroughs** — every Play creates a saved `StoryInstance` you can resume.
- **Zero infrastructure** — the entire app is a Next.js static export. Hosted on GitHub Pages.

## How it works

```
JSON world schema ─┐
                   │
Player action  ────┼─► PromptComposer ─► LLM (Gemini/OpenAI/...) ─► AIOutcome
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
├── app/                           # Next.js 16 app (TypeScript + Tailwind)
│   ├── src/
│   │   ├── app/                   # Pages: /, /settings, /worlds, /play
│   │   └── engine/                # Core engine (see below)
│   └── package.json
├── docs/                          # Design docs, schemas, analysis
│   ├── BotStory_Spec.md
│   ├── InfiniteWorlds_Analysis.md
│   ├── college_of_magic_schema.json
│   └── wiki/                      # Detailed design notes
└── README.md (this file)
```

### Engine modules (`app/src/engine/`)

- **`types.ts`** — TypeScript model of a world, instance, turn, AI outcome.
- **`composer.ts`** — Builds the system + user prompt for the LLM from the world schema and live instance state. Includes lore keyword injection and image-prompt assembly.
- **`stateManager.ts`** — Applies `stateUpdates` respecting each tracked item's data type. Snapshots for *Regenerate Turn*.
- **`triggerProcessor.ts`** — Evaluates trigger conditions, applies effects (set value, modify block, show message, end game), enforces one-shot semantics.
- **`llmClient.ts`** — Provider-aware HTTP client. Direct browser-to-provider calls (no proxy). JSON-mode responses, with a lenient fallback extractor.
- **`orchestrator.ts`** — The full turn: snapshot → compose → LLM → state → triggers → image → persist.
- **`importer.ts`** — Validates and normalises a world JSON (InfiniteWorlds or native format) into our `World` model. Throws `SchemaImportError` on failure.
- **`storage.ts`** — IndexedDB for worlds/instances, localStorage for providers/keys.

## Run locally

```bash
cd app
npm install
npm run dev     # http://localhost:3000
```

Then open <http://localhost:3000>, go to **Settings**, paste a Gemini (or other) API key, then open the **World Library** and click **Load sample world** → **Play**.

## Test

```bash
cd app
npm test        # 19 tests
npm run lint
npm run build   # static export to ./out
```

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
