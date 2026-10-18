import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { MAJORS, norm, parseDataset, similarFor } from '../src/lib/core'
import golden from './ids.golden.json'

const raw = JSON.parse(readFileSync(new URL('../public/words.json', import.meta.url), 'utf-8'))
const data = parseDataset(raw)
const byMajor = (k: string) => data.words.filter(w => w.major === k)

describe('words.json integrity', () => {
  it('parses without skipping a single row', () => expect(data.skipped).toBe(0))

  it('every major has entries', () => { for (const m of MAJORS) expect(byMajor(m.key).length, m.key).toBeGreaterThan(0) })

  it('every entry has headword, meaning, transliteration and topic', () => {
    for (const w of data.words) for (const f of ['ar', 'mean', 'tr', 'topic'] as const) expect(w[f], `${w.id} ${f}`).not.toBe('')
  })

  it('has an Indonesian sentence whenever it has an Arabic one (and vice versa)', () => {
    for (const w of data.words) expect(!!w.exAr, w.id).toBe(!!w.exId)
  })

  it('has no duplicate headwords inside a major (vowel-insensitive)', () => {
    for (const m of MAJORS) {
      const seen = new Map<string, string>()
      for (const w of byMajor(m.key)) {
        const k = norm(w.ar).replace(/\s+/g, '') + '|' + norm(w.mean)
        expect(seen.has(k), `${w.id} duplicates ${seen.get(k)}`).toBe(false); seen.set(k, w.id)
      }
    }
  })
})

describe('stable ids (favourites are saved as "MAJOR:row")', () => {
  // Appending is fine. Inserting, deleting or reordering a row would silently remap users' saved favourites.
  it('keeps every previously released row in place', () => {
    for (const [major, heads] of Object.entries(golden as Record<string, string[]>)) {
      const now = byMajor(major)
      expect(now.length, `${major} lost rows`).toBeGreaterThanOrEqual(heads.length)
      heads.forEach((ar, i) => expect(now[i].ar, `${major}:${i}`).toBe(ar))
    }
  })
})

describe('"Hati-hati, mirip" pairs', () => {
  it('has well-formed scopes and at least one resolvable side per pair', () => {
    expect(data.similar.length).toBeGreaterThan(0)
    for (const s of data.similar) {
      expect(['all', ...MAJORS.map(m => m.key)]).toContain(s.scope)
      const hit = data.words.some(w => (norm(w.ar) === s.n1 || norm(w.ar) === s.n2) && (s.scope === 'all' || w.major === s.scope))
      expect(hit, `${s.a1} / ${s.a2} (${s.scope}) never shows on any entry`).toBe(true)
    }
  })

  it('is surfaced on the matching entry', () => {
    const s = data.similar.find(x => x.scope !== 'all')!
    const w = data.words.find(x => (norm(x.ar) === s.n1 || norm(x.ar) === s.n2) && x.major === s.scope)!
    expect(similarFor(data.similar, w)).toContain(s)
  })
})
