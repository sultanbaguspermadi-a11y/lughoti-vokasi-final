import { useEffect, useRef } from 'react'

/* Hardware/gesture Back support for overlays (dialogs, About, major picker).
   Each open overlay owns one history entry tagged with its depth. Pressing Back closes the topmost
   overlay instead of leaving the site; closing it from the UI pops its entry again, so the stack stays
   in sync. Depth tagging keeps nested overlays (detail -> share) from closing together, and a push that
   arrives while a pop is still in flight waits for it, so one never undoes the other. */
let depth = 0
let busy = false // a history.back() we started has not reported back yet
const waiting: (() => void)[] = []
const when = (f: () => void) => (busy ? waiting.push(f) : f())

if (typeof window !== 'undefined') {
  if (history.state?.lv) history.replaceState(null, '') // stale tag left over from a reload
  // Registered before any hook listener, so depth/busy are settled by the time layers react.
  addEventListener('popstate', () => { busy = false; depth = history.state?.lv ?? 0; waiting.splice(0).forEach(f => f()) })
}

export function useHistoryLayer(active: boolean, onPop: () => void) {
  const mine = useRef(0) // 0 = none, -1 = push queued, >0 = depth of my entry
  const cb = useRef(onPop); cb.current = onPop
  useEffect(() => {
    if (active && !mine.current) {
      mine.current = -1
      when(() => {
        if (mine.current !== -1) return // closed again before the push ran
        mine.current = depth = (history.state?.lv ?? 0) + 1 // derived from real state, never a stale counter
        history.pushState({ lv: mine.current }, '')
      })
    } else if (!active && mine.current) {
      const m = mine.current; mine.current = 0
      if (m > 0 && depth === m) { depth--; if (history.state?.lv === m) { busy = true; history.back() } }
    }
  }, [active])
  useEffect(() => {
    const f = () => {
      const cur: number = history.state?.lv ?? 0
      if (mine.current > 0 && mine.current > cur) { mine.current = 0; cb.current() }
    }
    addEventListener('popstate', f); return () => removeEventListener('popstate', f)
  }, [])
}
