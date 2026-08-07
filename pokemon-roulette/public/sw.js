/*
  Simple runtime cache Service Worker for GitHub Pages.

  Goals for this project:
  - Cache remote trainer sprites (Showdown, GitHub raw, Bulbagarden) and remote audio cries (Showdown)
  - Allow the app to "prefetch" a list of URLs right after the player chooses a generation

  Notes:
  - We intentionally keep this SW small and framework-agnostic (no Angular service-worker tooling).
  - Cross-origin responses are often opaque; we still cache them safely.
*/

// Bump on every release that changes the BYTES behind an existing asset URL — `activate`
// deletes every runtime-* cache that is not the current VERSION, which is the only way to
// evict entries players already hold.
const VERSION = 'v1.0.6';
const RUNTIME_CACHE = `runtime-${VERSION}`;

self.addEventListener('install', () => {
  // Activate ASAP.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clean old caches.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('runtime-') && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );

      // Take control immediately.
      await self.clients.claim();
    })()
  );
});

function isCacheableRequest(req) {
  if (!req) return false;
  if (req.method !== 'GET') return false;

  const url = new URL(req.url);

  // Cache:
  // - same-origin static assets
  // - remote assets from known hosts
  if (url.origin === self.location.origin) {
    // Never cache i18n JSON: avoids stale translations that can surface raw keys.
    if (/\/i18n\/.*\.json$/i.test(url.pathname)) return false;

    // Never cache custom config JSON: these files are edited frequently during development.
    if (/\/data\/custom-(mega-forms|cries)\.json$/i.test(url.pathname)) return false;

    // Cache images/audio/json/fonts.
    return /\.(png|jpg|jpeg|webp|gif|svg|mp3|ogg|wav|json|woff2?|ttf)$/i.test(url.pathname);
  }

  // Remote hosts we use for assets.
  const host = url.hostname;
  return (
    host.endsWith('pokemonshowdown.com') ||
    host.endsWith('githubusercontent.com') ||
    host === 'raw.githubusercontent.com' ||
    host.endsWith('pokeapi.co') ||
    host.endsWith('veekun.com') ||
    host.endsWith('bulbagarden.net') ||
    host.endsWith('shoutwiki.com')
  );
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request, { ignoreVary: true });

  const fetchPromise = (async () => {
    try {
      const response = await fetch(request);
      if (!response) return response;

      // <img> cross-origin requests are frequently "opaque" (can't be inspected).
      // Some hosts occasionally return HTML/rate-limit pages that then get cached and
      // "freeze" a broken image permanently. To avoid sticky bad caches, we do NOT cache
      // opaque responses from Bulbagarden.
      try {
        const url = new URL(request.url);
        const isBulbagarden = url.hostname.endsWith('bulbagarden.net');

        if (response.type === 'opaque') {
          if (!isBulbagarden) {
            await cache.put(request, response.clone());
          }
          return response;
        }

        // For non-opaque responses, only cache successful ones.
        if (response.status === 200) {
          // Extra safety: for images, avoid caching non-image content.
          const dest = request.destination;
          const ct = (response.headers.get('content-type') || '').toLowerCase();
          if (dest === 'image' && !ct.startsWith('image/')) return response;
          await cache.put(request, response.clone());
        }
      } catch {
        // If URL parsing fails, fall back to conservative caching.
        if (response.status === 200) {
          await cache.put(request, response.clone());
        }
      }
      return response;
    } catch {
      return cached;
    }
  })();

  // Return cached immediately if present; otherwise wait for network.
  return cached || fetchPromise;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!isCacheableRequest(req)) return;

  // Audio elements often request MP3/OGG with a Range header.
  // Serving a cached *full* response to a Range request can break playback.
  // Bypass SW caching for Range requests and let the browser stream normally.
  try {
    if (req.headers && req.headers.has('range')) return;
  } catch {
    // ignore
  }

  event.respondWith(staleWhileRevalidate(req));
});

async function prefetchUrlList(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return { ok: 0, fail: 0 };

  const cache = await caches.open(RUNTIME_CACHE);
  let ok = 0;
  let fail = 0;

  // Small concurrency to avoid hammering on mobile.
  const concurrency = 6;
  let idx = 0;

  async function worker() {
    while (idx < urls.length) {
      const i = idx++;
      const u = urls[i];
      try {
        const abs = new URL(u, self.location.href).toString();
        const req = new Request(abs, { method: 'GET' });

        // Skip if already cached.
        const hit = await cache.match(req, { ignoreVary: true });
        if (hit) {
          ok++;
          continue;
        }

        // For cross-origin assets that might not send CORS headers, rely on opaque responses.
        const isCross = new URL(abs).origin !== self.location.origin;
        const resp = await fetch(req, isCross ? { mode: 'no-cors' } : undefined);

        // Same safety rule as runtime fetches: don't cache opaque responses from Bulbagarden.
        const isBulbagarden = new URL(abs).hostname.endsWith('bulbagarden.net');
        if (resp && resp.type === 'opaque') {
          if (!isBulbagarden) {
            await cache.put(req, resp.clone());
          }
          ok++;
        } else if (resp && resp.status === 200) {
          await cache.put(req, resp.clone());
          ok++;
        } else {
          fail++;
        }
      } catch {
        fail++;
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker());
  await Promise.all(workers);

  return { ok, fail };
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'PREFETCH') return;

  const urls = Array.isArray(data.urls) ? data.urls : [];
  const port = event.ports && event.ports[0];

  event.waitUntil(
    (async () => {
      const result = await prefetchUrlList(urls);
      if (port) {
        try {
          port.postMessage({ type: 'PREFETCH_DONE', ...result });
        } catch {
          // ignore
        }
      }
    })()
  );
});
