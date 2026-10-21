import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

export type Entry = { name: string; data: string | Uint8Array }

/* words.json has its own stale-while-revalidate cache; sw.js must never precache itself. */
const OWN_CACHE = new Set(['words.json', 'sw.js'])
/* .woff duplicates .woff2 for ancient browsers; every browser that can install a PWA picks woff2. */
const SKIP = /\.(woff|map)$/

/** Which files the shell cache holds, and a version that changes exactly when any of them does.
 *  Content is hashed (not only names) so edits to un-hashed files such as the manifest or icons also ship. */
export function plan(entries: Entry[]) {
  const files = entries.filter(e => !OWN_CACHE.has(e.name) && !SKIP.test(e.name)).sort((a, b) => (a.name < b.name ? -1 : 1))
  // Without the shell page there is nothing to open offline; fail the build instead of shipping a hollow worker.
  if (!files.some(f => f.name === 'index.html')) throw new Error('offline plugin: index.html is not part of the build output')
  const hash = createHash('sha256')
  for (const f of files) hash.update(f.name).update('\0').update(f.data).update('\0')
  return { urls: files.map(f => './' + f.name), version: hash.digest('hex').slice(0, 10) }
}

export function renderServiceWorker(template: string, p: ReturnType<typeof plan>) {
  for (const ph of ['__VERSION__', '__PRECACHE__']) if (!template.includes(ph)) throw new Error(`sw template is missing ${ph}`)
  // Replacer functions: file names are data, never `$&`-style replacement patterns.
  return template.replace('__VERSION__', () => p.version).replace('__PRECACHE__', () => JSON.stringify(p.urls))
}

function walk(dir: string, base = ''): Entry[] {
  return readdirSync(join(dir, base), { withFileTypes: true }).flatMap(d => {
    const rel = base ? `${base}/${d.name}` : d.name
    if (d.name.startsWith('.')) return []
    return d.isDirectory() ? walk(dir, rel) : [{ name: rel, data: readFileSync(join(dir, rel)) }]
  })
}

/** Emits sw.js with the exact list of built files, so the whole app (shell, fonts, icons) works offline. */
export function offline({ template }: { template: string }): Plugin {
  let publicDir = ''
  return {
    name: 'lv-offline',
    apply: 'build',
    configResolved(c) { publicDir = c.publicDir },
    // 'post': Vite's HTML plugin emits index.html during generateBundle, and it must be in the list.
    generateBundle: { order: 'post', handler(_, bundle) {
      const built = Object.values(bundle).map<Entry>(o => ({ name: o.fileName, data: o.type === 'chunk' ? o.code : o.source }))
      const pub = publicDir ? walk(publicDir) : []
      const byName = new Map([...pub, ...built].map(e => [e.name, e]))   // build output wins on a name clash, as in dist/
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: renderServiceWorker(readFileSync(template, 'utf-8'), plan([...byName.values()])) })
    } },
  }
}
