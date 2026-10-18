import { describe, it, expect } from 'vitest'
import { norm, search, dailyWord, parseDataset, type Word } from '../src/lib/core'

const mk = (ar: string, tr: string, mean: string): Word => ({
  id: 'RPL:0', major: 'RPL', ar, tr, mean, topic: 't', exAr: '', exId: '',
  n: { ar: norm(ar), tr: norm(tr), mean: norm(mean), ex: '' },
})

describe('norm', () => {
  it('ignores vowel marks, shadda and tatweel', () => expect(norm('شَجَرَة')).toBe(norm('شجرة')))
  it('folds hamza/alef, alef maqsura and ta marbuta', () => {
    expect(norm('أَكْبَر')).toBe(norm('اكبر'))
    expect(norm('مَسْتَشْفَى')).toBe(norm('مستشفي'))
    expect(norm('شجرة')).toBe(norm('شجره'))
  })
  it('strips transliteration diacritics and apostrophes', () => expect(norm('ḥāsūb mu’asysyir')).toBe('hasub muasysyir'))
})

describe('search', () => {
  const words = [mk('شَجَرَة', 'syajarah', 'pohon (struktur data)'), mk('مَكْدَس', 'makdas', 'tumpukan (stack)'), mk('عَدَد ثُنَائِيّ', 'ʿadad ṡunāʾiyy', 'bilangan biner')]
  it('finds Arabic typed without vowels or with ta marbuta as ha', () => {
    expect(search(words, 'شجره')[0].w.tr).toBe('syajarah')
    expect(search(words, 'شجرة')[0].w.tr).toBe('syajarah')
  })
  it('finds by Indonesian meaning, transliteration and English gloss', () => {
    expect(search(words, 'pohon')).toHaveLength(1)
    expect(search(words, 'makdas')).toHaveLength(1)
    expect(search(words, 'stack')[0].w.tr).toBe('makdas')
  })
  it('matches multi-word queries when each word appears', () => expect(search(words, 'biner bilangan')).toHaveLength(1))
  it('ranks exact meaning above substring', () => {
    const l = [mk('أ', 'a', 'kodekode'), mk('ب', 'b', 'kode')]
    expect(search(l, 'kode')[0].w.tr).toBe('b')
  })
  it('returns everything for an empty query and nothing for gibberish', () => {
    expect(search(words, '  ')).toHaveLength(3)
    expect(search(words, 'zzzzqq')).toHaveLength(0)
  })
})

describe('dailyWord', () => {
  it('is stable within a day and always in range', () => {
    const l = Array.from({ length: 7 }, (_, i) => mk('ا' + i, 'x', 'm' + i))
    const d = new Date(2026, 9, 17, 8)
    expect(dailyWord(l, d)).toBe(dailyWord(l, new Date(2026, 9, 17, 23)))
    expect(l).toContain(dailyWord(l, d))
  })
})

describe('parseDataset', () => {
  it('rejects non-objects and datasets without usable rows', () => {
    expect(() => parseDataset(null)).toThrow()
    expect(() => parseDataset({ RPL: [] })).toThrow()
  })
  it('skips malformed rows but keeps ids tied to row position', () => {
    const r = parseDataset({ RPL: [['', '', '', '', '', ''], ['أ', 'a', 'x', 't', '', '']], Mirip: [['bad']] })
    expect(r.words.map(w => w.id)).toEqual(['RPL:1'])
    expect(r.skipped).toBe(2)
  })
})
