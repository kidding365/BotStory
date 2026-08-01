/**
 * BotStory single Cloudflare Worker — route-dispatching proxy.
 *
 * Why
 * ---
 * GitHub Pages is static. Two provider families we want to use block
 * browser-direct CORS:
 *   - NVIDIA NIM          (integrate.api.nvidia.com)  — text
 *   - Cloudflare Workers AI (api.cloudflare.com)      — image (and more text if wanted)
 *
 * Both expect `Authorization: Bearer <key>` server-side, neither returns
 * `Access-Control-Allow-Origin` to a browser, so a static site can't call them
 * directly. This Worker is the minimal shim: it accepts the user's own key
 * (kept BYOK — passed in headers from the browser, never baked in) and forwards
 * it upstream as the right `Authorization` header.
 *
 * Routes
 * ------
 *   POST /nvidia/*           -> https://integrate.api.nvidia.com/v1/<path>
 *     Browser sends: X-Api-Key: <user's nvapi-... key>
 *     Body: OpenAI-shape chat completions body.
 *     Response: proxy text + CORS headers.
 *
 *   POST /cfimage            -> https://api.cloudflare.com/client/v4/accounts/<acct>/ai/run/<model>
 *     Browser sends: X-Api-Key: <user's Cloudflare API token>, X-Account-Id: <acct>, body: { model, prompt, steps?, seed?, width?, height? }
 *     (Account/model are here so we stay BYOK — the Worker doesn't know the account.)
 *     Response: { image: "data:image/png;base64,..." }  (the browser UI wants a ready data URI)
 *
 *   OPTIONS  (any route)     -> CORS preflight, no upstream call.
 *   other / GET              -> 200 health check + 405 for non-POST on action routes.
 *
 * RATE LIMIT
 * ----------
 * The Worker URL is public. To keep someone from scraping CF credits
 * (or hammering NVIDIA), there's a per-IP requests-per-minute cap using the
 * Cloudflare Cache API as a tiny counters store. Tunable below; off if you set
 * RATE_LIMIT_PER_MIN=0 in the Worker env.
 *
 * DEPLOY (~3 min one-time)
 * ------------------------
 *   1. cd into the repo root (this repo, on your machine).
 *   2. `npx wrangler login`  (opens a browser, sign into the same Cloudflare account you use for Workers AI).
 *   3. `npx wrangler deploy proxy/cloudflare-worker.js --name botstory-proxy --compatibility-date 2024-09-01`
 *   4. Copy the URL it prints, e.g. `https://botstory-proxy.<yourname>.workers.dev`.
 *   5. In BotStory -> Settings -> Worker proxy, paste that URL.
 *   6. In BotStory -> Settings -> NVIDIA NIM, paste your nvapi-... key. The
 *      Settings UI will send it to the Worker as X-Api-Key on every /nvidia request,
 *      the Worker injects `Authorization: Bearer ...` upstream.
 *   7. In BotStory -> Settings -> Cloudflare image, paste your Cloudflare API
 *      token (Workers AI - Read + Edit), your Account ID (`a3e40b1b...` on the
 *      dashboard URL), and pick a model. Same flow — browser sends them via headers,
 *      Worker injects Authorization server-side.
 *
 * The Worker itself stores NO keys. All keys live in your browser localStorage
 * and are sent per-request. If you ever want to lock it down harder, set a
 * SHARED_TOKEN env var in the Worker dashboard and the browser must echo it via
 * X-Worker-Token or every request 401s.
 */

const RATE_LIMIT_PER_MIN = 60; // per IP; set 0 to disable
const UPSTREAM_NVIDIA = 'https://integrate.api.nvidia.com/v1/';
const UPSTREAM_CF = 'https://api.cloudflare.com/client/v4/accounts/';

const CORS_BASE = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, content-type, x-api-key, x-account-id, x-worker-token',
  'Access-Control-Max-Age': '86400',
};

function corsResponse(body, init = {}) {
  return new Response(body, {
    ...init,
    headers: { ...(init.headers || {}), ...CORS_BASE },
  });
}

// Cloudflare Cache API is per-colo but good enough for a soft per-IP counter.
// ponytail: per-colo global lock on the counter; fine until one IP is on many colos.
async function rateLimited(ip) {
  if (RATE_LIMIT_PER_MIN <= 0 || !ip) return false;
  const cache = caches.default;
  const key = new Request(`https://botstory.local/rl/${ip}`, { method: 'GET' });
  const now = Date.now();
  let entry = { count: 0, ts: now };
  const cached = await cache.match(key);
  if (cached) {
    try { entry = await cached.json(); } catch { /* corrupt, start fresh */ }
  }
  if (now - entry.ts > 60_000) { entry = { count: 0, ts: now }; }
  entry.count += 1;
  await cache.put(key, new Response(JSON.stringify(entry), { headers: { 'Content-Type': 'application/json' } }));
  return entry.count > RATE_LIMIT_PER_MIN;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response('', { headers: CORS_BASE });
    }

    // Optional shared-token gate. Set SHARED_TOKEN in the Worker dashboard to enable.
    if (env.SHARED_TOKEN) {
      const t = request.headers.get('x-worker-token');
      if (t !== env.SHARED_TOKEN) {
        return corsResponse('Worker token required or wrong.', { status: 401 });
      }
    }

    // Soft per-IP rate limit
    const ip = request.headers.get('CF-Connecting-IP') || '';
    if (await rateLimited(ip)) {
      return corsResponse('Rate limit exceeded. Try again in a minute.', { status: 429 });
    }

    if (path === '/health' || path === '/' || path === '') {
      return corsResponse('ok\nBotStory proxy. Routes: POST /nvidia/*, POST /cfimage', {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    if (path.startsWith('/nvidia/')) {
      return forwardNvidia(request, path.slice('/nvidia/'.length));
    }
    if (path === '/cfimage') {
      return forwardCfImage(request);
    }

    return corsResponse('Not found. Use POST /nvidia/* or POST /cfimage.', { status: 404 });
  },
};

async function forwardNvidia(request, subPath) {
  if (request.method !== 'POST') {
    return corsResponse('POST only', { status: 405 });
  }
  const apiKey =
    request.headers.get('x-api-key') ||
    (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!apiKey) {
    return corsResponse('Missing API key. Send X-Api-Key: <nvapi-...>.', { status: 401 });
  }
  const upstream = UPSTREAM_NVIDIA + subPath;
  const body = await request.text();
  const upstreamRes = await fetch(upstream, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    body,
  });
  const text = await upstreamRes.text();
  return corsResponse(text, {
    status: upstreamRes.status,
    headers: {
      'Content-Type': upstreamRes.headers.get('content-type') || 'application/json',
    },
  });
}

/**
 * /cfimage  — BYOK Cloudflare Workers AI image generation.
 *
 * Request headers:
 *   X-Api-Key:    <user's Cloudflare API token, Workers AI - Read + Edit>
 *   X-Account-Id: <user's Cloudflare Account ID>
 *   (optional) X-Worker-Token: if SHARED_TOKEN set on the Worker.
 *
 * Request body (JSON):
 *   { model: "@cf/black-forest-labs/flux-1-schnell",
 *     prompt: "...",
 *     steps?: 4,         // flux schnell: 1..8
 *     seed?:  Number,
 *     width?:  Number,   // px; default per-model (1024 for flux). BotStory ships 900 (3:4) or 1600 (16:9)
 *     height?: Number    // px; default per-model. BotStory ships 1200 (3:4) or 900 (16:9)
 *   }
 *
 * Response body (JSON): the Workers AI REST envelope, plus our prepackaged
 * data URI for the browser:
 *   {
 *     "result": { ... },          // raw CF response
 *     "success": true,
 *     "image":  "data:image/png;base64,..."    // ready for <img src>
 *   }
 *
 * We do NOT bake the account ID upstream — the browser sends it, because
 * BotStory is BYOK and a user's Worker copy should not be tied to one account.
 */
async function forwardCfImage(request) {
  if (request.method !== 'POST') {
    return corsResponse('POST only', { status: 405 });
  }
  const apiKey = request.headers.get('x-api-key');
  const accountId = request.headers.get('x-account-id');
  if (!apiKey) {
    return corsResponse('Missing X-Api-Key (Cloudflare API token).', { status: 401 });
  }
  if (!accountId) {
    return corsResponse('Missing X-Account-Id.', { status: 400 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return corsResponse('Invalid JSON body.', { status: 400 });
  }
  const model = body.model;
  if (!model || typeof model !== 'string' || model.includes('..')) {
    return corsResponse('Missing or invalid model.', { status: 400 });
  }
  const upstreamUrl = `${UPSTREAM_CF}${accountId}/ai/run/${model}`;
  const upstreamBody = {
    prompt: String(body.prompt || ''),
    ...(body.steps != null ? { steps: Number(body.steps) } : {}),
    ...(body.seed != null ? { seed: Number(body.seed) } : {}),
    ...(body.width != null ? { width: Number(body.width) } : {}),
    ...(body.height != null ? { height: Number(body.height) } : {}),
  };
  const upstreamRes = await fetch(upstreamUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(upstreamBody),
  });
  const text = await upstreamRes.text();
  let cfEnvelope;
  try {
    cfEnvelope = JSON.parse(text);
  } catch {
    return corsResponse(JSON.stringify({ success: false, upstream: text }), {
      status: upstreamRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // Workers AI returns { result: { image?: "<base64>" }, success, errors, messages }
  const b64 = cfEnvelope?.result?.image;
  const out = {
    ...cfEnvelope,
    image: b64 ? `data:image/png;base64,${b64}` : null,
  };
  return corsResponse(JSON.stringify(out), {
    status: upstreamRes.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
