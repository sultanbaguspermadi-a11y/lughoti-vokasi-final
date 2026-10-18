import { useMemo } from 'react'
import { MAJORS, type Major, type Word } from './lib/core'
import { Ic, ICON } from './ui'
import './onboard.css'

interface Props {
  current: Major | null
  words?: Word[]
  onPick: (m: Major) => void
  onClose?: () => void
}

// Every dataset (including general vocabulary) is a valid starting point.
const PICK = MAJORS

export default function Onboard({ current, words, onPick, onClose }: Props) {
  // One pass over the dictionary instead of one filter() per row.
  const counts = useMemo(() => {
    if (!words) return null
    const map = new Map<Major, number>()
    for (const w of words) map.set(w.major, (map.get(w.major) ?? 0) + 1)
    return map
  }, [words])

  return (
    <main className="major screen">
      <div className="major__inner">
        {onClose && (
          <div className="major__bar">
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup"><Ic d={ICON.close} /></button>
          </div>
        )}

        <header className="major__head">
          <h1 className="major__title">Kamu jurusan apa?</h1>
          <p className="major__ask ar" lang="ar" dir="rtl">ما تخصصك؟</p>
          <p className="major__sub">Pencarian dan daftar kata mengikuti jurusan yang kamu pilih. Kamu bisa menggantinya kapan saja.</p>
        </header>

        <ul className="toc" aria-label="Pilih jurusan">
          {PICK.map(m => {
            const total = counts ? counts.get(m.key) ?? 0 : null
            return (
              <li key={m.key}>
                <button type="button" className="toc__row" aria-pressed={current === m.key} onClick={() => onPick(m.key)}>
                  <span className="stamp">{m.code}</span>
                  <span className="toc__main">
                    <span className="toc__line">
                      <b className="toc__name">{m.full}</b>
                      <span className="toc__ar ar" lang="ar" dir="rtl">{m.ar}</span>
                    </span>
                    <span className="toc__meta">
                      <span>{total == null ? '…' : `${total} entri`}</span>
                      {current === m.key && <span>Jurusan aktif</span>}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </main>
  )
}
