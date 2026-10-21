/* Lughati service worker.
   The version and the precache list below are injected at build time by pwa/offline-plugin.ts; the
   file is otherwise plain JS you can read and test as-is (see tests/sw.test.ts).

   Strategy
   - Shell (HTML, JS, CSS, fonts, icons): precached, cache-first. A new build installs a new versioned
     cache next to the old one and WAITS; the page decides when to switch (SKIP_WAITING), so a reload
     never swaps assets underneath a student mid-search.
   - words.json: stale-while-revalidate in its own cache. Dictionary edits arrive on the next visit
     without a new app release, and a bad network response can never replace a good copy. */
'use strict'

const VERSION = '__VERSION__'
const PRECACHE = __PRECACHE__

// Cache names are namespaced by scope: on shared origins (github.io/<user>/...) another project's
// caches are never ours to delete.
const SCOPE = self.registration.scope
const NS = 'lughati:' + new URL(SCOPE).pathname
const SHELL = `${NS}:shell:${VERSION}`
const DATA = `${NS}:data`
const INDEX = new URL('./index.html', SCOPE).href
const WORDS = new URL('./words.json', SCOPE).href
// Caches written by the first (unscoped) generation of this worker.
const LEGACY = /^lv-(data|[0-9a-f]{10})$/

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const [shell, data] = await Promise.all([caches.open(SHELL), caches.open(DATA)])
    // cache:'reload' skips the HTTP cache, so a stale CDN/browser copy is never frozen into the new version.
    const fresh = u => new Request(u, { cache: 'reload' })
    await Promise.all([
      shell.addAll(PRECACHE.map(fresh)),
      // Refresh the dictionary with the app, but an offline-capable copy we already have beats a failed update.
      data.add(fresh(WORDS)).catch(async err => { if (!(await data.match(WORDS))) throw err }),
    ])
    // No skipWaiting() here on purpose: see the SKIP_WAITING message below.
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL, DATA])
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => !keep.has(k) && (k.startsWith(NS + ':') || LEGACY.test(k))).map(k => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname === new URL(WORDS).pathname) { event.respondWith(dictionary(event)); return }
  // Single-page app: every navigation inside the scope is the cached shell, so it opens instantly and offline.
  if (request.mode === 'navigate') { event.respondWith(fromShell(INDEX, request)); return }
  event.respondWith(fromShell(request, request))
})

async function fromShell(key, request) {
  const cache = await caches.open(SHELL)
  return (await cache.match(key, { ignoreSearch: true })) || fetch(request)
}

async function dictionary(event) {
  const cache = await caches.open(DATA)
  const cached = await cache.match(WORDS)
  const refresh = fetch(event.request).then(async res => {
    // A captive portal answers 200 with HTML: only a real JSON response may overwrite the cached dictionary.
    if (res.ok && /json/i.test(res.headers.get('content-type') || '')) await cache.put(WORDS, res.clone())
    return res
  })
  // waitUntil keeps the worker alive until the cache write finishes, even after the page got its answer.
  event.waitUntil(refresh.catch(() => {}))
  return cached || refresh
}
