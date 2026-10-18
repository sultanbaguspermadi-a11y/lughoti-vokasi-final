import { useEffect, useState } from 'react'

/* ---------- storage (falls back to memory when localStorage is blocked) ---------- */
const mem = new Map<string, string>()
/** Reads a stored value; anything that fails `valid` (corrupt JSON, wrong shape) falls back to the default. */
export function load<T>(k: string, d: T, valid: (v: unknown) => boolean = () => true): T {
  const read = (raw: string | null | undefined): T | undefined => {
    if (raw == null) return undefined
    try { const v: unknown = JSON.parse(raw); return valid(v) ? (v as T) : undefined } catch { return undefined }
  }
  let stored: string | null = null
  try { stored = localStorage.getItem('lv:' + k) } catch { /* storage blocked */ }
  return read(stored) ?? read(mem.get(k)) ?? d
}
/** Removes every key this app owns (used by the crash screen's "reset" action). */
export function clearStored() {
  mem.clear()
  try { Object.keys(localStorage).filter(k => k.startsWith('lv:')).forEach(k => localStorage.removeItem(k)) } catch { /* ignore */ }
}
export function save(k: string, v: unknown) {
  const s = JSON.stringify(v); mem.set(k, s)
  try { localStorage.setItem('lv:' + k, s) } catch { /* storage unavailable: memory only */ }
}
export function usePersisted<T>(k: string, d: T, valid?: (v: unknown) => boolean) {
  const [v, set] = useState<T>(() => load(k, d, valid))
  useEffect(() => save(k, v), [k, v])
  return [v, set] as const
}

/* ---------- data model ---------- */
export type Major = 'RPL' | 'TBKR' | 'Akuntansi' | 'TSM' | 'Umum'
// `key` is the stable identifier stored in favourites/prefs and the dataset - never rename it.
// `full` is the unabbreviated Indonesian name, `ar` its Arabic equivalent and `code` the short index
// prefix used in entry numbers (RPL-014) - all three are display-only.
export const MAJORS: { key: Major; code: string; full: string; ar: string }[] = [
  { key: 'RPL', code: 'RPL', full: 'Rekayasa Perangkat Lunak', ar: 'هندسة البرمجيات' },
  { key: 'TBKR', code: 'TBKR', full: 'Teknik Bodi Kendaraan Ringan', ar: 'تقنية هياكل المركبات الخفيفة' },
  { key: 'Akuntansi', code: 'AKT', full: 'Akuntansi', ar: 'المحاسبة' },
  { key: 'TSM', code: 'TSM', full: 'Teknik Sepeda Motor', ar: 'تقنية الدراجات النارية' },
  { key: 'Umum', code: 'UMU', full: 'Kosakata umum', ar: 'مفردات عامة' },
]
export const majorOf = (k: Major) => MAJORS.find(m => m.key === k)!

/* Dictionary-style entry number. The sequence is the row position inside the major's list, which is
   already part of the stable id ("RPL:13" -> RPL-014), so numbers never drift when entries are appended. */
export const entrySeq = (w: Word) => String(+w.id.split(':')[1] + 1).padStart(3, '0')
export const entryNo = (w: Word) => `${majorOf(w.major).code}-${entrySeq(w)}`
export interface Word {
  id: string; major: Major; ar: string; tr: string; mean: string; topic: string; exAr: string; exId: string
  n: { ar: string; tr: string; mean: string; ex: string }
}
export interface Similar { a1: string; t1: string; m1: string; a2: string; t2: string; m2: string; tip: string; scope: 'all' | Major; n1: string; n2: string }

/* ---------- Arabic-aware normalisation (display text is never modified) ---------- */
const STRIP = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u0300-\u036f]/g
export const norm = (s: string) =>
  s.normalize('NFD').replace(STRIP, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[’'‘ʿʾ`]/g, '').toLowerCase()

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/* Row format (words.json _meta.format): [arab, latin, arti, kategori, contoh_arab, contoh_indonesia].
   ID = "<jurusan>:<posisi baris>", stable because new entries are appended at the end of each list. */
export function parseDataset(raw: unknown) {
  const words: Word[] = []; const similar: Similar[] = []; let skipped = 0
  if (!raw || typeof raw !== 'object') throw new Error('Format words.json tidak dikenali (harus berupa objek).')
  const o = raw as Record<string, unknown>
  for (const { key } of MAJORS) {
    const list = o[key]; if (!Array.isArray(list)) continue
    list.forEach((r, i) => {
      if (!Array.isArray(r)) { skipped++; return }
      const [ar, tr, mean, topic, exAr, exId] = [0, 1, 2, 3, 4, 5].map(j => str(r[j]))
      if (!ar || !mean) { skipped++; return }
      words.push({ id: `${key}:${i}`, major: key, ar, tr, mean, topic, exAr, exId,
        n: { ar: norm(ar), tr: norm(tr), mean: norm(mean), ex: norm(exAr + ' ' + exId) } })
    })
  }
  // The dataset writes scopes in lower case ("rpl"); map them onto the Major keys so the comparison in the UI works.
  const byLower = new Map<string, Major>(MAJORS.map(m => [m.key.toLowerCase(), m.key]))
  if (Array.isArray(o.Mirip)) for (const r of o.Mirip) {
    if (!Array.isArray(r) || r.length < 8) { skipped++; continue }
    const [a1, t1, m1, a2, t2, m2, tip, sc] = r.map(str)
    similar.push({ a1, t1, m1, a2, t2, m2, tip, scope: byLower.get(sc.toLowerCase()) ?? 'all', n1: norm(a1), n2: norm(a2) })
  }
  if (!words.length) throw new Error('Tidak ada entri kata yang valid di words.json.')
  return { words, similar, skipped }
}

/* ---------- search & ranking ---------- */
export interface Hit { w: Word; s: number }
export function search(words: Word[], q: string): Hit[] {
  const nq = norm(q).trim()
  if (!nq) return words.map(w => ({ w, s: 0 }))
  const tokens = nq.split(/\s+/).filter(Boolean)
  const out: Hit[] = []
  for (const w of words) {
    const { ar, mean, tr, ex } = w.n
    let s = ar === nq ? 100 : ar.startsWith(nq) ? 85 : ar.includes(nq) ? 65 : 0
    const m = mean === nq ? 95 : mean.split(/[\s/,()]+/).includes(nq) ? 80 : mean.startsWith(nq) ? 75 : mean.includes(nq) ? 55 : 0
    s = Math.max(s, m)
    if (!s && tr.includes(nq)) s = 40
    if (!s && ex.includes(nq)) s = 10
    // "bilangan biner", "kotak centang": every typed word must appear somewhere in the entry
    if (!s && tokens.length > 1 && tokens.every(t => ar.includes(t) || mean.includes(t) || tr.includes(t))) s = 30
    if (s) out.push({ w, s })
  }
  return out.sort((a, b) => b.s - a.s) // stable: ties keep dataset order
}

/** Pairs worth warning about for `w`: matches ignore vowel marks, and respect the pair's major scope. */
export function similarFor(similar: Similar[], w: Word): Similar[] {
  const k = norm(w.ar)
  return similar.filter(s => (s.n1 === k || s.n2 === k) && (s.scope === 'all' || s.scope === w.major))
}

/* Stable "daily word": hash of the local calendar date */
export function dailyWord(words: Word[], d = new Date()) { const k = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return words[h % words.length]
}

/* ---------- preferences ---------- */
export const ACCENTS = [['Zamrud', '#0B6B52'], ['Emas', '#8A6A0E'], ['Safir', '#2F5DA8'], ['Mawar', '#B23A5B'], ['Arang', '#3C4540']] as const
export const AR_FONTS: Record<string, string> = {
  Amiri: '"Amiri","Noto Naskh Arabic","Traditional Arabic",serif',
  'Noto Naskh': '"Noto Naskh Arabic","Amiri","Traditional Arabic",serif',
  Sistem: '"Geeza Pro","Segoe UI",Tahoma,"Noto Sans Arabic",sans-serif',
}
export const ID_FONTS: Record<string, string> = {
  'Plus Jakarta Sans': '"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",sans-serif',
  'Source Serif': '"Source Serif 4",Georgia,"Times New Roman",serif',
  'Atkinson Hyperlegible': '"Atkinson Hyperlegible Next",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
  Sistem: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
}
export const DEFAULTS = { theme: 'system' as 'system' | 'light' | 'dark', accent: '#0B6B52', arFont: 'Amiri', idFont: 'Plus Jakarta Sans', rev: 3,
  arSize: 2.4, idSize: 1.05, subSize: 0.85, lh: 1.6, width: 1100, compact: false, calm: false, harakat: true, translit: true }
export type Prefs = typeof DEFAULTS

const RANGE = { arSize: [1.4, 4], idSize: [0.85, 1.7], subSize: [0.7, 1.3], lh: [1.3, 2.1], width: [720, 1400] } as const
const has = (o: object, k: unknown): k is string => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k)
const num = (v: unknown, k: keyof typeof RANGE) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(RANGE[k][1], Math.max(RANGE[k][0], v)) : DEFAULTS[k])
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)

/** Turns whatever came out of storage into a complete, valid Prefs object. Unknown fonts, wrong types and
 *  out-of-range sliders fall back to the default instead of leaving the UI with no option selected.
 *  Keys are emitted in DEFAULTS order so a clean state serialises identically (no needless rewrite).
 *  Prefs saved under an older `rev` adopt the current reading font and the darker gold accent once. */
export function normalizePrefs(raw: unknown): Prefs {
  const s: Record<string, unknown> = isPlainObject(raw) ? raw : {}
  const legacy = s.rev !== DEFAULTS.rev
  return {
    theme: s.theme === 'light' || s.theme === 'dark' || s.theme === 'system' ? s.theme : DEFAULTS.theme,
    accent: typeof s.accent === 'string' && /^#[0-9a-f]{6}$/i.test(s.accent) ? (s.accent === '#A07A12' ? '#8A6A0E' : s.accent) : DEFAULTS.accent,
    arFont: has(AR_FONTS, s.arFont) ? s.arFont : DEFAULTS.arFont,
    idFont: !legacy && has(ID_FONTS, s.idFont) ? s.idFont : DEFAULTS.idFont,
    rev: DEFAULTS.rev,
    arSize: num(s.arSize, 'arSize'), idSize: num(s.idSize, 'idSize'), subSize: num(s.subSize, 'subSize'), lh: num(s.lh, 'lh'), width: num(s.width, 'width'),
    compact: bool(s.compact, DEFAULTS.compact), calm: bool(s.calm, DEFAULTS.calm), harakat: bool(s.harakat, DEFAULTS.harakat), translit: bool(s.translit, DEFAULTS.translit),
  }
}

/** Display-only: removes Arabic vowel marks and shadda. Stored data and search normalisation are untouched. */
export const stripHarakat = (t: string) => t.replace(/[\u064B-\u065F\u0670]/g, '')

/* ---------- validators for persisted state ---------- */
export const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string')
export const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export const isMineValue = (v: unknown) => v === null || v === 'all' || MAJORS.some(m => m.key === v)
