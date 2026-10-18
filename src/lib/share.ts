import type { Word } from './core'

const ST = {
  Zamrud: { a: '#0B4F3F', b: '#052319', ink: '#F6EFD9', acc: '#E6C66A' },
  Gading: { a: '#FBF7EE', b: '#EADFC4', ink: '#1B201D', acc: '#9A7410' },
  Arang: { a: '#1C201E', b: '#080A09', ink: '#EDE8DA', acc: '#E6C66A' },
} as const
export const STYLES = Object.keys(ST) as (keyof typeof ST)[]

/** Draws a 1080×1920 (9:16) story card with Canvas — fully offline, no external services. */
export async function renderStory(w: Word, style: keyof typeof ST, arFont: string): Promise<Blob> {
  const t = ST[style]; const AR = `${arFont === 'Noto Naskh' ? '"Noto Naskh Arabic"' : 'Amiri'},"Amiri",serif`; const UI = '"Plus Jakarta Sans",system-ui,sans-serif'
  await Promise.all([document.fonts.load(`700 100px ${AR}`, w.ar + w.exAr), document.fonts.load(`600 40px ${UI}`, w.mean), document.fonts.load(`400 40px ${UI}`, w.exId), document.fonts.load(`400 46px ${UI}`, w.tr)]).catch(() => {})
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920
  const x = c.getContext('2d')!
  const g = x.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, t.a); g.addColorStop(1, t.b); x.fillStyle = g; x.fillRect(0, 0, 1080, 1920)
  x.strokeStyle = t.acc; x.globalAlpha = 0.09; x.lineWidth = 2
  for (let i = 0; i < 10; i++) for (let j = 0; j < 17; j++) { x.save(); x.translate(i * 120 + 60, j * 120 + 60); x.strokeRect(-34, -34, 68, 68); x.rotate(Math.PI / 4); x.strokeRect(-34, -34, 68, 68); x.restore() }
  x.globalAlpha = 1; x.textAlign = 'center'; x.textBaseline = 'alphabetic'
  const lines = (s: string, max: number) => { const out: string[] = []; let cur = ''; for (const wd of s.split(/\s+/)) { const n = cur ? cur + ' ' + wd : wd; if (cur && x.measureText(n).width > max) { out.push(cur); cur = wd } else cur = n } if (cur) out.push(cur); return out }
  const draw = (s: string, y: number, size: number, lh: number, max = 880) => { const l = lines(s, max); l.forEach((ln, i) => x.fillText(ln, 540, y + i * lh)); return y + l.length * lh }

  x.fillStyle = t.acc; x.font = `600 30px ${UI}`; x.direction = 'ltr'; x.fillText('L U G H A T I   V O K A S I', 540, 170)
  let y = 560
  x.fillStyle = t.ink; x.direction = 'rtl'
  let s = 240; do { s -= 10; x.font = `700 ${s}px ${AR}` } while (s > 110 && x.measureText(w.ar).width > 880) // s always equals the size in use
  y = draw(w.ar, y, s, s * 1.35)
  x.direction = 'ltr'; y += 40
  if (w.tr) { x.fillStyle = t.acc; x.font = `400 46px ${UI}`; y = draw(w.tr, y, 46, 60) + 10 }
  x.fillStyle = t.ink; x.font = `600 76px ${UI}`; y = draw(w.mean, y + 50, 76, 96) + 10
  if (w.exAr) {
    x.fillStyle = t.acc; x.globalAlpha = 0.5; x.fillRect(440, y + 40, 200, 3); x.globalAlpha = 1
    x.fillStyle = t.ink; x.direction = 'rtl'; x.font = `400 58px ${AR}`; y = draw(w.exAr, y + 140, 58, 96)
    x.direction = 'ltr'; x.globalAlpha = 0.75; x.font = `400 36px ${UI}`; draw(w.exId, y + 20, 36, 52); x.globalAlpha = 1
  }
  x.fillStyle = t.ink; x.globalAlpha = 0.8; x.font = `600 32px ${UI}`; x.fillText('Kamus Digital Arab–Indonesia untuk Siswa SMK', 540, 1750)
  x.globalAlpha = 0.55; x.font = `400 28px ${UI}`; x.fillText('SMK Muhammadiyah Pencongan · Sultan Bagus Permadi', 540, 1800)
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Gagal membuat gambar'))), 'image/png'))
}
