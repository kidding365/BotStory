# Technical Note: Browser Automation Workflow

This document records the specific method and toolchain used to drive the live BotStory app from an agent session. Read this **before** attempting any in-browser QA, or you will hit the same dead-ends we did on the first session.

## 1. Toolchain (current as of 2026-07-27)

- **Binary**: `/home/ion/.browser_use_venv/bin/browser-use` (version 0.1.5 — update to 0.1.7 available; do not upgrade without re-running doctor)
- **Target**: the user's already-running Chromium instance on `127.0.0.1:9222` (the dev's normal browsing Chromium, launched the normal Arch way with no special flags; CDP is gated by `chrome://inspect/#remote-debugging` → "Allow remote debugging for this browser instance" once per browser process)
- **HTTP discovery is broken on this Chromium build**: `GET /json/version` on port 9222 returns HTTP 404. Do NOT use any tool that relies on the HTTP discovery endpoint (`agent-browser`, `curl http://127.0.0.1:9222/json/*`). The raw WebSocket endpoint **does** work — and that's what `browser-use` uses.
- **NOT** `agent-browser`: that CLI tries the HTTP discovery endpoint and fails with "Operation timed out" / it may bind its own listener on 9222 (which then EADDRINUSE-conflicts). Reach for `browser-use` first.

## 2. Connection Strategy (use exactly this; every other path wasted >30 min in retries on 2026-07-27)

The `browser-use connect` subcommand was **removed in CLI 3.0**. The replacement is the heredoc runner that auto-attaches to the running browser. Verify with:

```bash
/home/ion/.browser_use_venv/bin/browser-use <<'PY'
ensure_real_tab()
print(page_info())
PY
```

If `doctor` reports `[FAIL] active browser connections — 0` and the heredoc throws `fatal: CDP WS handshake failed: timed out during opening handshake`, the gating reason is **Chromium waiting on an in-window "Allow remote debugging?" popup**. Action it in the live Chromium window — there is no out-of-band workaround, do NOT spend time on retry loops. The popup re-prompts on every fresh WS connection (every daemon restart), so once it's been clicked for a given browser process, leave the daemon alive and avoid `--reload` unless absolutely necessary.

### Recovery sequence (only if `ensure_real_tab()` actually throws — otherwise don't touch the daemon)

1. Click "Allow" on the popup you'll find somewhere in the Chromium window.
2. (Sometimes `--reload` is needed first to surface a fresh popup): `/home/ion/.browser_use_venv/bin/browser-use --reload`
3. Re-run the heredoc above. Repeat at most 2× — beyond that, ask the human to click Allow again.

## 3. Interaction pattern that does NOT hang the daemon

`browser-use` exposes:
- `page_info()` — sync, returns `{url, title, w, h, ...}`. **This always works** — use it as the connectivity canary.
- `js(expression)` — runs a JS string. **The single biggest source of daemon hangs is passing an async IIFE that does `await new Promise(...)` and returns a Promise the harness tries to await over IPC. A hung IPC kills the daemon and forces an `--reload` → triggers another Chromium popup.**

### Patterns that work

- **Pure sync JS**: `js("JSON.stringify({a:1, b:location.href})")`. Always returns immediately.
- **Background async-IDB read**: kick an `(async () => { ... window.__q = result; })()` IIFE that **returns a literal string** (`'kicked'`), poll for `window.__q` on the next call with sync JS. This avoids the harness awaiting the Promise:

```python
js("""
window.__q = null;
(async () => {
  try {
    var req = indexedDB.open('BotStoryDB');
    var db = await new Promise((res, rej) => { req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error); });
    var all = await new Promise((res, rej) => { var rq = db.transaction('instances','readonly').objectStore('instances').getAll(); rq.onsuccess=()=>res(rq.result); rq.onerror=()=>rej(rq.error); });
    window.__q = all.map(i => ({id: i.id, turn: i.turnNumber}));
  } catch (e) { window.__q = {err: ''+e}; }
})();
'kicked'
""")
# next browser-use call (sync):
print(js("JSON.stringify(window.__q)"))
```

### Patterns that break

- `goto_url(url)` — uses a separate CDP `Page.navigate` IPC path that times out frequently. **Use `js("location.href = '...url...'")` followed by an external `sleep` instead.**
- Async IIFE that returns the Promise directly (no `'kicked'` tail) — harness tries to await → timeout.
- `--reload` between calls — triggers the popup re-prompt.

## 4. Click strategy

CDP-level `click_at_xy(x, y)` works **most** of the time, but on this Chromium build it sometimes silently misses the element (we saw it for the character-picker "Play as Sailor" button — coordinates were correct, click registered, but no onClick fired; suspected DPI/scroll-y desync in the compositor).

**Robust fallback** that has worked every time, including for button-onclick React handlers:

```python
js("""
(function(){
  var b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Play as Sailor');
  if (!b) return 'no btn';
  b.click();    // direct DOM click — bypasses compositor coordinate path entirely
  return 'clicked';
})()
""")
```

Prefer `.click()` over `click_at_xy` for any element you can uniquely identify by text. Use `click_at_xy` only for canvas/coordinate-only targets.

## 5. Filling controlled inputs in a React app

React overrides the `value` setter, so `el.value = 'x'` won't fire `onChange`. Use the descriptor path (this works for all our provider select/inputs and is what we used to seed the Settings form):

```python
setval = """
(function(el, val){
  if(!el) return 'missing';
  var proto = el.tagName==='SELECT' ? window.HTMLSelectElement
            : el.tagName==='TEXTAREA' ? window.HTMLTextAreaElement
            : window.HTMLInputElement.prototype;
  var gopd = Object.getOwnPropertyDescriptor(proto, 'value');
  var setter = gopd && gopd.set;
  if (setter) setter.call(el, val);
  else el.value = val;
  el.dispatchEvent(new Event('input', {bubbles:true}));
  el.dispatchEvent(new Event('change', {bubbles:true}));
  return 'ok';
})
"""
```

## 6. BotStory-specific operational notes

- **Dev server**: `PORT=3939 setsid bash -c 'npm run dev > /tmp/botstory-dev.log 2>&1' < /dev/null & disown` from `app/`. The `setsid + disown` is mandatory on this host — a plain `nohup` or un-disowned `&` is killed when the launching shell call hits its 2-min tool timeout. Verify with `curl -sS -m 5 http://localhost:3939/ -w "HTTP:%{http_code}\n"`.
- **IndexedDB name**: `BotStoryDB`. Object stores: `worlds`, `instances`, `settings` (not `botstory_*`).
- **Storage keys in localStorage**: `botstory_text_provider`, `botstory_image_provider`, `botstory_worker` (lowercase). The Worker URL key (`botstory_worker`) is NOT auto-persisted if the user leaves the prefilled default unchanged — when seeding the image provider for Cloudflare, also stamp `imageProvider.endpoint = workerConfig.url` into `botstory_image_provider` or the `imageClient.cfImage` short-circuits with `base = ''`.
- **Auto-`firstInput`**: the play page fires `world.firstInput` on mount when `textProvider.apiKey` is set. This is the main per-page-load LLM cost — be aware when refreshing repeatedly.
- **Quality gates** (run from `app/`): `npm test` (35/35 vitest), `npm run lint`, `npx tsc --noEmit`. All three must be green before any commit on this repo.
- **Live API key status** (gitignored root `*_key.txt`, 2026-07-27):
  - Gemini: valid, rate-limited at free quota after ~3 calls (returns 429).
  - Cloudflare Workers AI Flux: valid, fast (~2-5s/image).
  - NVIDIA Llama-3.1-8B-Instruct: valid, fast (~6-12s/turn). **Recommended default for live QA.**
  - NVIDIA Llama-3.1-70B-Instruct: valid, but ≥60-90s/turn — exceeds the Cloudflare Worker's 100s upstream timeout, returns HTTP `524`. Don't use for live QA.
  - OpenRouter: out of credits (HTTP 402) — matched the parked note in PROGRESS.md.

## 7. State-Action-Verify loop

For each QA step:
1. **State**: sync `js("JSON.stringify({...})")` for the exact DOM/IndexedDB fields you're asserting on.
2. **Action**: either `.click()` via JS, `js("location.href = ...")` for navigation, or the descriptor-fill helper above for inputs.
3. **Verify**: sync `js(...)` again. Persist any longer async-IDB read with the kick + poll pattern from §3.

## 8. Update protocol for this file

When a run verifies or disproves a fact here, update this file before finishing the task. Specifically:
- If a `browser-use` upgrade or a Chromium rebuild changes the CDP popup or HTTP discovery failure, rewrite §1–§2.
- If a new "pattern that breaks" is found, append to §3.
- If a new BotStory storage key or object store is added, append to §6.
