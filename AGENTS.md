## Quality gates

Before declaring a task done on this repo, run **all three** from `app/`:
- `npm test` — vitest run, currently 35/35 passing
- `npm run lint` — eslint, expect 0 errors / 0 warnings
- `npx tsc --noEmit` — TypeScript, expect clean

There is no `typecheck` script in `app/package.json`; invoke `tsc` directly. All three MUST be green before any commit.

## Dev server (for live QA)

Run from `app/` with the **detached** pattern (plain `nohup` is killed when the tool call hits its 120s timeout):
```bash
cd app && setsid bash -c 'PORT=3939 npm run dev > /tmp/botstory-dev.log 2>&1' < /dev/null & disown
```
Verify: `curl -sS -m 5 http://localhost:3939/ -w "HTTP:%{http_code}\n"` → `HTTP:200`.

## Browser-driven QA

Read `docs/wiki/Browser_Automation_Notes.md` **before** attempting any in-browser QA — it documents the working toolchain (`browser-use`, not `agent-browser`), the CDP popup gate, the daemon-IPC patterns that hang the connection, and the BotStory-specific IndexedDB / localStorage key names. Skip reading it and you will hit the same 30+ min of friction that the 2026-07-27 session did.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
