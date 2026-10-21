import { useSyncExternalStore } from 'react'

/* PWA runtime: install prompt, offline readiness, update flow, connectivity.
   One small external store, created at import time so a `beforeinstallprompt` that fires before React
   mounts is not lost. Everything touching the browser goes through `Env`, which keeps it unit-testable. */

export type PwaState = {
  installable: boolean     // browser holds a native install prompt for us (Chromium, Android)
  iosInstallable: boolean  // iOS/iPadOS has no prompt API: the user must use Share > Add to Home Screen
  standalone: boolean      // already running as an installed app
  online: boolean
  offlineCapable: boolean  // a service worker controls this page, so it can start without a network
  offlineReady: boolean    // the worker finished its FIRST install during this visit (announce once)
  updateReady: boolean     // a newer build is installed and waiting for the user's go-ahead
}
export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
export type Env = { win: Window & typeof globalThis; nav: Navigator & { standalone?: boolean } }

const RECHECK_MS = 30 * 60 * 1000 // installed apps are rarely reloaded: look for a new build when they come to the front

export function createPwa({ win, nav }: Env) {
  const standalone = () => !!win.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true
  const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1) // iPadOS reports as a Mac

  let state: PwaState = { installable: false, iosInstallable: ios && !standalone(), standalone: standalone(), online: nav.onLine !== false, offlineCapable: false, offlineReady: false, updateReady: false }
  const subs = new Set<() => void>()
  const set = (patch: Partial<PwaState>) => { state = { ...state, ...patch }; subs.forEach(f => f()) }
  let prompt: InstallEvent | null = null
  let waiting: ServiceWorker | null = null

  // A persistent store keeps the offline copy from being evicted under storage pressure. Only ask once installed:
  // Chromium grants it silently then, while Firefox would pop a permission dialog on a plain visit.
  const persist = () => { if (state.standalone) nav.storage?.persist?.().catch(() => {}) }

  win.addEventListener('beforeinstallprompt', e => { e.preventDefault(); prompt = e as InstallEvent; set({ installable: true }) })
  win.addEventListener('appinstalled', () => { prompt = null; set({ installable: false, iosInstallable: false, standalone: true }); persist() })
  win.addEventListener('online', () => set({ online: true }))
  win.addEventListener('offline', () => set({ online: false }))
  persist()

  return {
    getState: () => state,
    subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f) } },

    /** Shows the native prompt. The event is single-use, so it is dropped either way; the browser fires a new one later if it wants. */
    async install(): Promise<InstallOutcome> {
      const e = prompt; if (!e) return 'unavailable'
      prompt = null; set({ installable: false })
      try { await e.prompt(); return (await e.userChoice).outcome } catch { return 'unavailable' }
    },

    /** Activates the waiting build and reloads once it has taken control. Never reloads on its own. */
    applyUpdate() {
      const sw = nav.serviceWorker; if (!waiting || !sw) return
      sw.addEventListener('controllerchange', () => win.location.reload(), { once: true })
      waiting.postMessage({ type: 'SKIP_WAITING' })
    },

    dismissOfflineReady() { set({ offlineReady: false }) },

    /** Registers the worker. Failure is silent: the app is fully usable online without it. */
    async register(url: string) {
      const sw = nav.serviceWorker; if (!sw) return
      let reg: ServiceWorkerRegistration
      try { reg = await sw.register(url) } catch { return }
      if (sw.controller) set({ offlineCapable: true })

      const track = (w: ServiceWorker) => w.addEventListener('statechange', () => {
        if (w.state !== 'installed') return
        // A controller means this is an upgrade of a worker already serving the page; none means the first install.
        if (sw.controller) { waiting = w; set({ updateReady: true }) } else set({ offlineReady: true, offlineCapable: true })
      })
      if (reg.waiting && sw.controller) { waiting = reg.waiting; set({ updateReady: true }) }
      if (reg.installing) track(reg.installing)
      reg.addEventListener('updatefound', () => { if (reg.installing) track(reg.installing) })

      let last = Date.now()
      win.document.addEventListener('visibilitychange', () => {
        if (win.document.visibilityState !== 'visible' || !state.online || Date.now() - last < RECHECK_MS) return
        last = Date.now(); reg.update().catch(() => {})
      })
    },
  }
}

export const pwa = typeof window === 'undefined' ? null : createPwa({ win: window, nav: navigator })

/** Production only: dev servers would otherwise cache files while you edit them. */
export function registerSW() {
  if (import.meta.env.PROD) void pwa?.register(`${import.meta.env.BASE_URL}sw.js`)
}

const NONE: PwaState = { installable: false, iosInstallable: false, standalone: false, online: true, offlineCapable: false, offlineReady: false, updateReady: false }
const noop = () => () => {}

export function usePwa() {
  const s = useSyncExternalStore(pwa ? pwa.subscribe : noop, pwa ? pwa.getState : () => NONE)
  return { ...s, install: () => pwa?.install() ?? Promise.resolve<InstallOutcome>('unavailable'), applyUpdate: () => pwa?.applyUpdate(), dismissOfflineReady: () => pwa?.dismissOfflineReady() }
}
