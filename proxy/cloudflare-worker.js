/**
 * Cloudflare Worker proxy for NVIDIA NIM (and any OpenAI-compatible provider).
 *
 * Why this exists
 * ---------------
 * GitHub Pages is a static host: there is no server-side runtime to forward a
 * request with an `Authorization` header to NVIDIA — and NVIDIA's
 * `integrate.api.nvidia.com` does not respond with the right CORS headers for
 * browser-direct POSTs that carry `Authorization`, so the browser blocks them
 * with "Failed to fetch".
 *
 * This Worker is a tiny (<30 lines) shim. Deploy it to Cloudflare (free tier,
 * 100,000 req/day) and point the **Custom** provider's endpoint at its URL.
 * The Worker reads the user's API key from request headers, attaches it as the
 * upstream `Authorization: Bearer ...` header, then forwards the body verbatim.
 *
 * Deploy in ~5 minutes:
 * ----------------------
 *   1. Sign in / create an account at https://dash.cloudflare.com
 *   2. Sidebar → Workers & Pages → Create → Worker → name it e.g. "nvidia-proxy"
 *   3. Paste this file's contents (minus the comments) into the editor
 *   4. Click "Deploy"
 *   5. Copy the URL it gives you, e.g. `https://nvidia-proxy.YOUR-NAME.workers.dev`
 *   6. In BotStory's Settings → Custom → Endpoint, paste that URL
 *   7. Click the radio button on "Custom" (instead of "NVIDIA NIM") and Save
 *
 * Note: the Worker URL is public, so don't bake your key into the Worker.
 *       Pass the API key in the `X-Api-Key` header from the browser (BotStory does
 *       this automatically — it sends `Authorization: Bearer <your-key>` to the
 *       Worker, and we re-use it for upstream).
 */
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response('', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, content-type, x-api-key',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    if (request.method !== 'POST') {
      return new Response('POST only', { status: 405 });
    }

    const upstream = 'https://integrate.api.nvidia.com/v1/chat/completions';
    const apiKey = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
      || request.headers.get('x-api-key');
    if (!apiKey) {
      return new Response('Missing API key. Send Authorization: Bearer <key> or X-Api-Key.', {
        status: 401,
      });
    }
    const body = await request.text();

    const upstreamRes = await fetch(upstream, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });
    const text = await upstreamRes.text();
    return new Response(text, {
      status: upstreamRes.status,
      headers: {
        'Content-Type': upstreamRes.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
