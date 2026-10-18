import { useId, useState, type ReactNode } from 'react'
import { ACCENTS, AR_FONTS, ID_FONTS, DEFAULTS, stripHarakat, type Prefs } from './lib/core'
import { Ic, ICON } from './ui'
import './settings.css'

type Props = { p: Prefs; set: (p: Prefs) => void; onDone: () => void; count?: number }
type NumKey = 'arSize' | 'idSize' | 'subSize' | 'lh' | 'width'
type Keys = (keyof Prefs)[]

const THEMES = [['system', 'Sistem'], ['light', 'Terang'], ['dark', 'Gelap']] as const
// One choice scales Arabic, meaning and transliteration together; the sliders below stay for fine tuning.
const SIZES = [['Kecil', 2.0, 0.95, 0.8], ['Sedang', 2.4, 1.05, 0.85], ['Besar', 2.9, 1.2, 0.95], ['Sangat besar', 3.4, 1.4, 1.1]] as const
const GROUPS: Record<'color' | 'text' | 'list', Keys> = {
  color: ['theme', 'accent'],
  text: ['arFont', 'idFont', 'arSize', 'idSize', 'subSize', 'lh'],
  list: ['compact', 'harakat', 'translit', 'width', 'calm'],
}
// `rev` is a storage version, not a setting the user can change or reset.
const ALL: Keys = (Object.keys(DEFAULTS) as Keys).filter(k => k !== 'rev')
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6
const isDefault = (p: Prefs, keys: Keys) => keys.every(k => (typeof p[k] === 'number' ? near(p[k] as number, DEFAULTS[k] as number) : p[k] === DEFAULTS[k]))

function Range({ label, k, min, max, step, pct, cls, p, set }: Pick<Props, 'p' | 'set'> & { label: string; k: NumKey; min: number; max: number; step: number; pct?: boolean; cls?: string }) {
  const id = useId()
  // sizes read as a percentage of the default; "2.4rem" means nothing to a student
  const shown = pct ? `${Math.round((p[k] / DEFAULTS[k]) * 100)}%` : k === 'width' ? `${p[k]}px` : String(p[k])
  return (
    <div className={`set-field ${cls ?? ''}`}>
      <div className="set-head">
        <label className="set-label" htmlFor={id}>{label}</label>
        <output className="set-value" htmlFor={id}>{shown}</output>
      </div>
      <input id={id} className="set-range" type="range" min={min} max={max} step={step} value={p[k]} onChange={e => set({ ...p, [k]: +e.target.value })} />
    </div>
  )
}

/** Each option is shown in its own typeface, so the choice is not blind. */
function FontPick({ label, hint, k, fonts, sample, cols, p, set }: Pick<Props, 'p' | 'set'> & { label: string; hint: string; k: 'arFont' | 'idFont'; fonts: Record<string, string>; sample: string; cols: 2 | 3 }) {
  const id = useId()
  const ar = k === 'arFont'
  return (
    <div className="set-field">
      <div><span className="set-label" id={id}>{label}</span><p className="set-hint">{hint}</p></div>
      <div className={`set-fonts set-fonts--${cols}`} role="group" aria-labelledby={id}>
        {Object.keys(fonts).map(n => (
          <button type="button" key={n} aria-pressed={p[k] === n} onClick={() => set({ ...p, [k]: n })}>
            <span className="set-fonts__s" style={{ fontFamily: fonts[n] }} lang={ar ? 'ar' : 'id'} dir={ar ? 'rtl' : undefined}>{sample}</span>
            <span className="set-fonts__n">{n}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId()
  return (
    <div className="set-field set-switch">
      <div><label className="set-label" htmlFor={id}>{label}</label>{hint && <p className="set-hint" id={`${id}-h`}>{hint}</p>}</div>
      <input id={id} type="checkbox" role="switch" checked={checked} aria-describedby={hint ? `${id}-h` : undefined} onChange={e => onChange(e.target.checked)} />
    </div>
  )
}

function Group({ id, title, disabled, onReset, children }: { id: string; title: string; disabled: boolean; onReset: () => void; children: ReactNode }) {
  return (
    <section className="set-group" aria-labelledby={id}>
      <div className="set-gh"><h3 id={id}>{title}</h3><button type="button" className="link" disabled={disabled} onClick={onReset} aria-label={`Atur ulang ${title.toLowerCase()}`}>Atur ulang</button></div>
      {children}
    </section>
  )
}

export default function Settings({ p, set, onDone, count }: Props) {
  const ids = [useId(), useId(), useId(), useId(), useId(), useId()]
  // `undo` keeps the exact state from before a reset, plus the sentence announced to the user.
  const [undo, setUndo] = useState<{ prefs: Prefs; msg: string } | null>(null)
  // Any manual change ends the undo window: "Urungkan" must never silently throw away later edits.
  const change = (next: Prefs) => { setUndo(null); set(next) }
  const reset = (keys: Keys, msg: string) => {
    setUndo({ prefs: p, msg })
    set({ ...p, ...Object.fromEntries(keys.map(k => [k, DEFAULTS[k]])) } as Prefs)
  }
  const sizeNow = SIZES.find(([, a, i, s]) => near(p.arSize, a) && near(p.idSize, i) && near(p.subSize, s))?.[0]
  const sample = p.harakat ? 'حَاسُوب مَحْمُول' : stripHarakat('حَاسُوب مَحْمُول')

  return (
    <div className="set">
      {/* the preview is a real list row plus the accent in use, so every control below is visible here */}
      <section className="set-preview" aria-label="Pratinjau langsung">
        <div className="set-preview__tab" aria-hidden><span>Semua <small>{count ?? ''}</small></span></div>
        <div className="set-row" aria-hidden>
          <span className="entry__no">001</span>
          <span className="entry__tx"><b>laptop</b><small>ḥāsūb maḥmūl</small></span>
          <span className="entry__ar ar" lang="ar" dir="rtl">{sample}</span>
        </div>
      </section>

      <Group id={ids[0]} title="Warna" disabled={isDefault(p, GROUPS.color)} onReset={() => reset(GROUPS.color, 'Warna dikembalikan ke bawaan.')}>
        <div className="set-field">
          <span className="set-label" id={ids[1]}>Tema</span>
          <div className="seg" role="group" aria-labelledby={ids[1]}>
            {THEMES.map(([v, name]) => <button type="button" key={v} aria-pressed={p.theme === v} onClick={() => change({ ...p, theme: v })}>{name}</button>)}
          </div>
        </div>
        <div className="set-field">
          <span className="set-label" id={ids[2]}>Warna aksen</span>
          <div className="set-swatches" role="group" aria-labelledby={ids[2]}>
            {ACCENTS.map(([n, c]) => (
              <button type="button" key={c} title={n} aria-label={n} aria-pressed={p.accent === c} style={{ background: c }} onClick={() => change({ ...p, accent: c })}>
                {p.accent === c && <Ic d={ICON.check} />}
              </button>
            ))}
          </div>
        </div>
      </Group>

      <Group id={ids[3]} title="Teks" disabled={isDefault(p, GROUPS.text)} onReset={() => reset(GROUPS.text, 'Pengaturan teks dikembalikan ke bawaan.')}>
        <div className="set-field">
          <span className="set-label" id={ids[4]}>Ukuran teks</span>
          <div className="seg" role="group" aria-labelledby={ids[4]}>
            {SIZES.map(([n, a, i, s]) => <button type="button" key={n} aria-pressed={sizeNow === n} onClick={() => change({ ...p, arSize: a, idSize: i, subSize: s })}>{n}</button>)}
          </div>
        </div>
        <FontPick label="Font Arab" hint="Untuk semua tulisan Arab." k="arFont" fonts={AR_FONTS} sample="كِتَاب" cols={3} p={p} set={change} />
        <FontPick label="Font teks Indonesia" hint="Untuk semua tulisan Indonesia: arti kata, menu, dan tombol." k="idFont" fonts={ID_FONTS} sample="Kamus kata" cols={2} p={p} set={change} />
        <details className="set-more" open={!sizeNow || undefined}>
          <summary>Atur manual</summary>
          <Range label="Ukuran Arab" k="arSize" min={1.4} max={4} step={0.1} pct p={p} set={change} />
          <Range label="Ukuran arti kata" k="idSize" min={0.85} max={1.7} step={0.05} pct p={p} set={change} />
          <Range label="Ukuran transliterasi" k="subSize" min={0.7} max={1.3} step={0.05} pct p={p} set={change} />
          <Range label="Tinggi baris" k="lh" min={1.3} max={2.1} step={0.05} p={p} set={change} />
        </details>
      </Group>

      <Group id={ids[5]} title="Daftar" disabled={isDefault(p, GROUPS.list)} onReset={() => reset(GROUPS.list, 'Pengaturan daftar dikembalikan ke bawaan.')}>
        <div className="set-field">
          <span className="set-label" id={`${ids[5]}-d`}>Kepadatan</span>
          <div className="seg" role="group" aria-labelledby={`${ids[5]}-d`}>
            <button type="button" aria-pressed={!p.compact} onClick={() => change({ ...p, compact: false })}>Nyaman</button>
            <button type="button" aria-pressed={p.compact} onClick={() => change({ ...p, compact: true })}>Ringkas</button>
          </div>
        </div>
        <Switch label="Tampilkan harakat" hint="Tanda baca vokal pada huruf Arab. Matikan untuk melatih membaca teks gundul." checked={p.harakat} onChange={v => change({ ...p, harakat: v })} />
        <Switch label="Tampilkan transliterasi" hint="Cara baca Latin di bawah arti kata." checked={p.translit} onChange={v => change({ ...p, translit: v })} />
        {/* only useful when the screen is wider than the slider's minimum; hidden on phones via CSS */}
        <Range label="Lebar konten" k="width" min={720} max={1400} step={20} cls="set-width" p={p} set={change} />
        <Switch label="Kurangi animasi" hint="Sudah otomatis aktif jika sistem kamu memintanya." checked={p.calm} onChange={v => change({ ...p, calm: v })} />
      </Group>

      {/* Sticky action bar: the global reset and "Selesai" stay reachable however far the sheet is scrolled. */}
      <div className="set-foot">
        <p className="set-undo" role="status">
          {undo && <>{undo.msg} <button type="button" className="link" onClick={() => { set(undo.prefs); setUndo(null) }}>Urungkan</button></>}
        </p>
        <div className="set-foot__acts">
          <button type="button" className="btn" disabled={isDefault(p, ALL)} onClick={() => reset(ALL, 'Semua pengaturan tampilan dikembalikan ke bawaan.')}><Ic d={ICON.reset} />Atur ulang semua</button>
          <button type="button" className="btn btn--primary" onClick={onDone}>Selesai</button>
        </div>
      </div>
    </div>
  )
}
