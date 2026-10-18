/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createHash } from 'node:crypto'

/* Emits sw.js with the exact list of built files, so the whole app (shell, fonts, dictionary) works offline.
   The cache name is a hash of that list: every deploy that changes an asset installs a fresh cache and
   drops the old one. words.json is served stale-while-revalidate, so dictionary edits arrive on the next visit. */
const SW = `const V = 'lv-__V__', D = 'lv-data', SHELL = __FILES__
self.addEventListener('install', e => e.waitUntil(Promise.all([
  caches.open(V).then(c => c.addAll(SHELL)), caches.open(D).then(c => c.add('./words.json')),
]).then(() => self.skipWaiting())))
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k !== V && k !== D).map(k => caches.delete(k)))).then(() => self.clients.claim())))
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url)
  if (r.method !== 'GET' || u.origin !== location.origin) return
  if (u.pathname.endsWith('/words.json')) {
    e.respondWith(caches.open(D).then(async c => {
      const hit = await c.match(r)
      const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res }).catch(() => hit)
      return hit || net
    })); return
  }
  if (r.mode === 'navigate') { e.respondWith(fetch(r).catch(() => caches.match('./index.html'))); return }
  e.respondWith(caches.match(r).then(hit => hit || fetch(r)))
})
`
const offline = (): Plugin => ({
  name: 'lv-offline',
  apply: 'build',
  generateBundle(_, bundle) {
    // .woff duplicates .woff2 for ancient browsers; every browser that can install a PWA uses woff2
    const files = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
      ...Object.keys(bundle).filter(f => !f.endsWith('.woff')).map(f => './' + f)]
    const v = createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 10)
    this.emitFile({ type: 'asset', fileName: 'sw.js', source: SW.replace('__V__', v).replace('__FILES__', JSON.stringify(files)) })
  },
})

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), offline()],
  test: { environment: 'node', setupFiles: ['tests/setup.ts'], include: ['tests/**/*.test.{ts,tsx}'] },
})
