import { describe, it, expect } from 'vitest'
import { plan, renderServiceWorker, type Entry } from '../pwa/offline-plugin'
import { readFileSync } from 'node:fs'

const e = (name: string, data = name): Entry => ({ name, data })
const base = [e('index.html', '<html>'), e('assets/app-abc.js'), e('assets/f-1.woff2'), e('assets/f-1.woff'), e('icon-192.png'), e('manifest.webmanifest', '{}'), e('words.json'), e('sw.js'), e('assets/app-abc.js.map')]

describe('offline plugin', () => {
  it('precaches the shell, icons and manifest, but not the dictionary, itself, woff duplicates or maps', () => {
    expect(plan(base).urls).toEqual(['./assets/app-abc.js', './assets/f-1.woff2', './icon-192.png', './index.html', './manifest.webmanifest'])
  })

  it('is deterministic and changes version whenever any precached content changes, even an un-hashed file', () => {
    const v = plan(base).version
    expect(plan([...base].reverse()).version).toBe(v)
    expect(plan(base.map(x => (x.name === 'manifest.webmanifest' ? e(x.name, '{"x":1}') : x))).version).not.toBe(v)
    expect(plan(base.map(x => (x.name === 'icon-192.png' ? e(x.name, 'new icon') : x))).version).not.toBe(v)
  })

  it('keeps the version stable when only the dictionary changes (it has its own cache)', () => {
    expect(plan(base.map(x => (x.name === 'words.json' ? e(x.name, 'changed') : x))).version).toBe(plan(base).version)
  })

  it('fails the build if index.html is missing', () => {
    expect(() => plan(base.filter(x => x.name !== 'index.html'))).toThrow(/index\.html/)
  })

  it('fills every placeholder of the real template and refuses a template without them', () => {
    const out = renderServiceWorker(readFileSync('pwa/sw.template.js', 'utf-8'), plan(base))
    expect(out).not.toMatch(/__VERSION__|__PRECACHE__/)
    expect(out).toContain(`'${plan(base).version}'`)
    expect(() => renderServiceWorker('const a = 1', plan(base))).toThrow(/missing/)
  })

  it('treats file names as data, not replacement patterns', () => {
    const out = renderServiceWorker("const V='__VERSION__', P=__PRECACHE__", plan([...base, e('a$&b.png')]))
    expect(out).toContain('./a$&b.png')
  })
})
