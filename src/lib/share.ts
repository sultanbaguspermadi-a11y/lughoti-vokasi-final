import { entrySeq, entryNo, majorOf, type Word } from './core'

/* ------------------------------------------------------------------ *
 *  Kartu bagikan: lembar kamus bergaya majalah.
 *  Prinsip: satu kata raksasa, satu angka hantu, garis tipis ala koran,
 *  teks Latin rata kiri, teks Arab rata kanan (diagonal yang disengaja).
 *  Semuanya digambar dengan Canvas, tanpa layanan eksternal (offline).
 * ------------------------------------------------------------------ */

interface Palette {
  label: string
  a: string; b: string      // gradasi latar atas → bawah
  ink: string; acc: string  // teks utama, aksen
  ghost: 'stroke' | 'fill'  // angka hantu: garis tepi atau isi
}

const PALETTE = {
  Zamrud: { label: 'Zamrud', a: '#0B4F3F', b: '#04201A', ink: '#F6EFD9', acc: '#E6C66A', ghost: 'stroke' },
  Gading: { label: 'Gading', a: '#FAF5E8', b: '#E9DEC2', ink: '#1B201D', acc: '#B8381F', ghost: 'fill' },
  Arang: { label: 'Arang', a: '#1D211F', b: '#0A0C0B', ink: '#EFEADB', acc: '#CDE566', ghost: 'stroke' },
} as const satisfies Record<string, Palette>

export type CardStyle = keyof typeof PALETTE
export const STYLES = Object.keys(PALETTE) as CardStyle[]
export const styleSwatch = (s: CardStyle) => ({ bg: PALETTE[s].a, ink: PALETTE[s].ink, acc: PALETTE[s].acc })

export const FORMATS = {
  story: { label: 'Story', ratio: '9:16', w: 1080, h: 1920 },
  feed: { label: 'Feed', ratio: '4:5', w: 1080, h: 1350 },
} as const
export type CardFormat = keyof typeof FORMATS

const LOGO = 'لغتي'  // tanpa harakat, seperti di sampul
const W = 1080
const M = 88            // margin kiri/kanan
const CW = W - M * 2    // lebar konten

/** Seeded PRNG supaya butiran kertas pada kartu yang sama selalu identik. */
function rng(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

export async function renderStory(w: Word, style: CardStyle, arFont: string, format: CardFormat = 'story'): Promise<Blob> {
  const P = PALETTE[style]; const H = FORMATS[format].h; const tall = format === 'story'
  const AR = `${arFont === 'Noto Naskh' ? '"Noto Naskh Arabic"' : 'Amiri'},"Amiri",serif`
  const NAST = `"Noto Nastaliq Urdu",${AR}`   // logo baru: tulisan لغتي, sama dengan sampul & header
  const SERIF = '"Source Serif 4",Georgia,"Times New Roman",serif'
  const UI = '"Plus Jakarta Sans",system-ui,sans-serif'

  // Pastikan font siap sebelum mengukur; kegagalan memuat tidak boleh menggagalkan kartu.
  await Promise.all([
    document.fonts.load(`700 100px ${AR}`, w.ar + w.exAr), document.fonts.load(`400 50px ${AR}`, w.exAr),
    document.fonts.load(`600 100px ${SERIF}`, w.mean), document.fonts.load(`italic 400 50px ${SERIF}`, w.tr + w.exId),
    document.fonts.load(`700 100px ${NAST}`, 'لغتي'), document.fonts.load(`600 30px ${UI}`, 'LUGHATI VOKASI'), document.fonts.load(`400 30px ${UI}`, 'Kamus'),
  ]).catch(() => {})

  const c = document.createElement('canvas'); c.width = W; c.height = H
  const x = c.getContext('2d'); if (!x) throw new Error('Canvas tidak tersedia')

  /* ---------- helper ---------- */
  type Align = 'left' | 'right' | 'center'
  const setFont = (f: string, dir: 'ltr' | 'rtl' = 'ltr') => { x.font = f; x.direction = dir }
  /** Huruf kapital berjarak (letterSpacing Canvas belum ada di semua browser, jadi digambar per huruf). */
  const track = (s: string, px: number, py: number, sp: number, align: Align = 'left') => {
    const chars = [...s]; const widths = chars.map(ch => x.measureText(ch).width)
    const total = widths.reduce((a, b) => a + b, 0) + sp * Math.max(0, chars.length - 1)
    let cx = align === 'left' ? px : align === 'right' ? px - total : px - total / 2
    x.textAlign = 'left'; x.direction = 'ltr'
    chars.forEach((ch, i) => { x.fillText(ch, cx, py); cx += widths[i] + sp })
  }
  const wrap = (s: string, max: number) => {
    const out: string[] = []; let cur = ''
    for (const wd of s.split(/\s+/).filter(Boolean)) {
      const n = cur ? `${cur} ${wd}` : wd
      if (cur && x.measureText(n).width > max) { out.push(cur); cur = wd } else cur = n
    }
    if (cur) out.push(cur)
    return out
  }
  const rule = (y: number, h: number, alpha = 1, x0 = M, x1 = W - M) => { x.globalAlpha = alpha; x.fillRect(x0, y, x1 - x0, h); x.globalAlpha = 1 }
  const khatam = (cx: number, cy: number, r: number, lw: number) => {
    x.save(); x.translate(cx, cy); x.lineWidth = lw
    x.strokeRect(-r, -r, r * 2, r * 2); x.rotate(Math.PI / 4); x.strokeRect(-r, -r, r * 2, r * 2); x.restore()
  }

  /* ---------- badan: hierarki Arab → arti → contoh. Menyusut bila tidak muat. ---------- */
  const limit = H - 266
  const body = (k: number, dry: boolean, withExample: boolean, off = 0): number => {
    let y = (tall ? 360 : 336) + off

    // 1. Kata Arab: titik fokus, rata kanan.
    let s = (tall ? 250 : 200) * k
    do { s -= 10; setFont(`700 ${s}px ${AR}`, 'rtl') } while (s > 96 * k && x.measureText(w.ar).width > CW)
    const arLines = wrap(w.ar, CW).slice(0, 3); const arLh = s * 1.3
    if (!dry) { x.fillStyle = P.ink; x.textAlign = 'right'; arLines.forEach((ln, i) => x.fillText(ln, W - M, y + s * 1.05 + i * arLh)) }
    y += s * 1.05 + (arLines.length - 1) * arLh + s * 0.62

    // 2. Garis aksen di kiri + transliterasi miring (kontra-posisi terhadap kata Arab).
    if (!dry) { x.fillStyle = P.acc; rule(y, 10, 1, M, M + 150) }
    y += 10
    if (w.tr) {
      const ts = 54 * k; setFont(`italic 400 ${ts}px ${SERIF}`)
      const tl = wrap(w.tr, CW)
      if (!dry) { x.fillStyle = P.acc; x.textAlign = 'left'; tl.forEach((ln, i) => x.fillText(ln, M, y + ts * 1.25 + i * ts * 1.2)) }
      y += ts * 1.25 + (tl.length - 1) * ts * 1.2 + ts * 0.3
    }

    // 3. Arti: judul editorial serif, rata kiri, rapat.
    y += 56 * k
    if (!dry) { x.fillStyle = P.acc; x.fillRect(M, y - 12, 14, 14); x.fillStyle = P.ink; x.globalAlpha = 0.75; setFont(`600 20px ${UI}`); track('ARTINYA', M + 30, y, 6); x.globalAlpha = 1 }
    y += 22
    let ms = (tall ? 120 : 104) * k; let ml: string[]
    do { setFont(`600 ${ms}px ${SERIF}`); ml = wrap(w.mean, CW); if (ml.length <= 3) break; ms -= 6 } while (ms > 60 * k)
    const mLh = ms * 1.08
    if (!dry) { x.fillStyle = P.ink; x.textAlign = 'left'; ml.forEach((ln, i) => x.fillText(ln, M, y + ms * 0.92 + i * mLh)) }
    y += ms * 0.92 + (ml.length - 1) * mLh + ms * 0.2

    // 4. Contoh kalimat: blok kutipan dengan garis di atas, Arab kanan, Indonesia kiri miring.
    if (withExample && w.exAr) {
      y += 64 * k
      if (!dry) { x.fillStyle = P.ink; rule(y, 1.5, 0.45); x.globalAlpha = 0.75; setFont(`600 20px ${UI}`); track('CONTOH', M, y + 46, 6); x.globalAlpha = 1 }
      y += 64
      const es = 58 * k; setFont(`400 ${es}px ${AR}`, 'rtl'); const el = wrap(w.exAr, CW).slice(0, 3); const eLh = es * 1.7
      if (!dry) { x.fillStyle = P.ink; x.textAlign = 'right'; el.forEach((ln, i) => x.fillText(ln, W - M, y + es * 1.05 + i * eLh)) }
      y += es * 1.05 + (el.length - 1) * eLh + es * 0.5
      if (w.exId) {
        const is = 36 * k; setFont(`italic 400 ${is}px ${SERIF}`); const il = wrap(w.exId, CW).slice(0, 3)
        if (!dry) { x.fillStyle = P.ink; x.globalAlpha = 0.8; x.textAlign = 'left'; il.forEach((ln, i) => x.fillText(ln, M, y + is + i * is * 1.35)); x.globalAlpha = 1 }
        y += is + (il.length - 1) * is * 1.35 + is * 0.3
      }
    }
    return y
  }
  let k = 1; let withExample = true
  for (const kk of [1, 0.92, 0.84, 0.76, 0.68, 0.6]) { k = kk; if (body(kk, true, true) <= limit) break; if (kk === 0.6) withExample = false }
  // Konten pendek: turunkan blok agar ruang kosong terbagi, bukan menumpuk di bawah.
  const off = Math.max(0, Math.min((limit - body(k, true, withExample)) * 0.42, tall ? 280 : 70))

  /* ---------- latar: gradasi, butiran kertas, khatam raksasa terpotong ---------- */
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, P.a); g.addColorStop(1, P.b)
  x.fillStyle = g; x.fillRect(0, 0, W, H)
  const rand = rng(w.id); x.fillStyle = P.ink
  for (let i = 0; i < 1800; i++) { x.globalAlpha = 0.015 + rand() * 0.04; x.fillRect(rand() * W, rand() * H, 1 + rand() * 1.6, 1 + rand() * 1.6) }
  x.globalAlpha = 0.13; x.strokeStyle = P.acc
  khatam(tall ? 80 : 60, H - (tall ? 330 : 250), tall ? 470 : 380, 2)
  khatam(tall ? 80 : 60, H - (tall ? 330 : 250), tall ? 300 : 240, 1.5)
  x.globalAlpha = 1

  /* ---------- angka hantu: nomor entri, besar, keluar dari bingkai ---------- */
  const seq = entrySeq(w); const gs = tall ? 700 : 520
  setFont(`600 ${gs}px ${SERIF}`); x.textAlign = 'right'; x.textBaseline = 'alphabetic'
  const gy = (tall ? 1010 : 800) + off * 0.8
  if (P.ghost === 'stroke') { x.strokeStyle = P.acc; x.lineWidth = 3; x.globalAlpha = 0.3; x.strokeText(seq, W - M + 70, gy) }
  else { x.fillStyle = P.acc; x.globalAlpha = 0.1; x.fillText(seq, W - M + 70, gy) }
  x.globalAlpha = 1

  /* ---------- kepala koran: garis tebal + tipis, dua baris metadata ---------- */
  x.fillStyle = P.ink; rule(84, 6); rule(100, 1.5, 0.7)
  // Logo di kiri (Nastaliq butuh ruang tinggi: ascender ke atas, ekor ke bawah), metadata menumpuk rata kanan.
  x.fillStyle = P.acc; setFont(`700 66px ${NAST}`, 'rtl'); x.textAlign = 'left'; x.fillText(LOGO, M, 222)
  const lw = x.measureText(LOGO).width
  x.fillRect(M + lw + 24, 168, 1.5, 58)
  setFont(`600 20px ${UI}`); track('LUGHATI', M + lw + 42, 188, 6); track('VOKASI', M + lw + 42, 218, 6)
  x.fillStyle = P.ink; setFont(`italic 400 36px ${SERIF}`); x.textAlign = 'right'; x.fillText(`No. ${entryNo(w)}`, W - M, 168)
  x.globalAlpha = 0.7; setFont(`600 19px ${UI}`)
  track((w.topic || 'Kosakata').toUpperCase(), W - M, 204, 4, 'right')
  track(majorOf(w.major).full.toUpperCase(), W - M, 234, 4, 'right')
  x.globalAlpha = 1; rule(278, 1.5, 0.45)

  // Label vertikal di tepi kiri, nuansa folio majalah.
  x.save(); x.translate(46, H / 2); x.rotate(-Math.PI / 2); x.fillStyle = P.ink; x.globalAlpha = 0.45; setFont(`600 17px ${UI}`)
  track('KAMUS ARAB–INDONESIA  ·  SISWA SMK', 0, 0, 5, 'center'); x.restore(); x.globalAlpha = 1

  body(k, false, withExample, off)

  /* ---------- kaki: kolofon, garis ganda, segel khatam ---------- */
  x.fillStyle = P.ink; rule(H - 200, 1.5, 0.7); rule(H - 188, 6)
  x.globalAlpha = 1; setFont(`italic 400 36px ${SERIF}`); x.textAlign = 'left'; x.fillText('Kamus Digital Arab–Indonesia', M, H - 128)
  x.globalAlpha = 0.65; setFont(`400 24px ${UI}`)
  x.fillText('untuk Siswa SMK · SMK Muhammadiyah Pencongan', M, H - 88); x.fillText('Disusun oleh Sultan Bagus Permadi', M, H - 54)
  x.globalAlpha = 1

  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Gagal membuat gambar'))), 'image/png'))
}
