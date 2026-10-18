import { useEffect, useState } from 'react'

/* Shared UI atoms. One place for icons and the single ornamental motif. */

export const ICON = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4',
  close: 'M6 6l12 12M18 6 6 18',
  star: 'm12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z',
  shuffle: 'M3 7h4l10 10h4M3 17h4l3-3m4-4 3-3h4M18 4l3 3-3 3M18 14l3 3-3 3',
  sliders: 'M4 6h9m4 0h3M4 12h3m4 0h9M4 18h11m4 0h1',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
  back: 'M19 12H5m6-6-6 6 6 6',
  share: 'M12 15V3m0 0L8 7m4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  check: 'M5 12.5 9.5 17 19 7.5',
  chevron: 'm9 6 6 6-6 6',
  up: 'M12 19V5m-6 6 6-6 6 6',
  reset: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5',
} as const

export const Ic = ({ d, fill }: { d: string; fill?: boolean }) => (
  <svg className="i" viewBox="0 0 24 24" aria-hidden fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
)

/** Khatam: two squares rotated 45° (an eight-point star). The same figure tiles the story cards in
 *  lib/share.ts, so the cover, dividers and share images read as one system. */
export const Khatam = ({ size = 18 }: { size?: number }) => (
  <svg className="khatam" width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.25">
    <rect x="5" y="5" width="14" height="14" /><rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)" />
  </svg>
)

/** Jump-to-top: appears only after ~1.5 screens of scrolling, jumps instantly (no smooth scroll),
 *  then hands focus to `focusSel` so keyboard users are not left on a button that just disappeared. */
export function BackToTop({ focusSel }: { focusSel?: string }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    let raf = 0
    const check = () => { raf = 0; setShow(window.scrollY > window.innerHeight * 1.5) }
    const on = () => { if (!raf) raf = requestAnimationFrame(check) }
    check(); window.addEventListener('scroll', on, { passive: true })
    return () => { window.removeEventListener('scroll', on); if (raf) cancelAnimationFrame(raf) }
  }, [])
  const go = () => {
    window.scrollTo(0, 0)
    ;(focusSel ? document.querySelector<HTMLElement>(focusSel) : null)?.focus({ preventScroll: true })
  }
  return (
    <button type="button" className="totop" data-show={show} onClick={go} aria-label="Kembali ke atas" title="Kembali ke atas" tabIndex={show ? 0 : -1} aria-hidden={!show}>
      <Ic d={ICON.up} />
    </button>
  )
}
