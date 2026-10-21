import { describe, it, expect, vi } from 'vitest'
import { createPwa, type Env } from '../src/lib/pwa'

/* The store against a fake browser: EventTarget-based window, navigator and service-worker objects. */
class Worker extends EventTarget { state = 'installing'; postMessage = vi.fn(); to(s: string) { this.state = s; this.dispatchEvent(new Event('statechange')) } }
class Registration extends EventTarget { installing: Worker | null = null; waiting: Worker | null = null; update = vi.fn(async () => {}) }

function env(o: { ua?: string; platform?: string; touch?: number; standalone?: boolean; online?: boolean; controller?: boolean; swFails?: boolean; noSW?: boolean } = {}) {
  const win: any = new EventTarget()
  win.matchMedia = (q: string) => ({ matches: !!o.standalone && q.includes('standalone') })
  win.location = { reload: vi.fn() }
  win.document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  const reg = new Registration()
  const sw: any = Object.assign(new EventTarget(), { controller: o.controller ? {} : null, register: vi.fn(async () => { if (o.swFails) throw new Error('x'); return reg }) })
  const nav: any = { userAgent: o.ua ?? 'Mozilla/5.0 (Linux; Android 14) Chrome/130', platform: o.platform ?? 'Linux armv8l', maxTouchPoints: o.touch ?? 5, onLine: o.online ?? true, storage: { persist: vi.fn(async () => true) } }
  if (!o.noSW) nav.serviceWorker = sw
  return { win, nav, reg, sw, pwa: createPwa({ win, nav } as Env) }
}
const installEvent = (outcome: 'accepted' | 'dismissed' = 'accepted') => Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: vi.fn(async () => {}), userChoice: Promise.resolve({ outcome }) })

describe('install prompt', () => {
  it('captures the native prompt, shows it once, and reports the outcome', async () => {
    const t = env(); const ev = installEvent('dismissed')
    t.win.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)              // the mini-infobar is replaced by our own card
    expect(t.pwa.getState().installable).toBe(true)
    expect(await t.pwa.install()).toBe('dismissed')
    expect(ev.prompt).toHaveBeenCalledOnce()
    expect(t.pwa.getState().installable).toBe(false)    // the event is single-use
    expect(await t.pwa.install()).toBe('unavailable')
  })

  it('appinstalled clears every install offer and asks for persistent storage', () => {
    const t = env(); t.win.dispatchEvent(installEvent()); t.win.dispatchEvent(new Event('appinstalled'))
    expect(t.pwa.getState()).toMatchObject({ installable: false, iosInstallable: false, standalone: true })
    expect(t.nav.storage.persist).toHaveBeenCalled()
  })

  it('does not request persistent storage on a plain browser visit', () => {
    expect(env().nav.storage.persist).not.toHaveBeenCalled()
    expect(env({ standalone: true }).nav.storage.persist).toHaveBeenCalled()
  })

  it('detects iPhone and iPadOS (which pretends to be a Mac) as manually installable, unless already installed', () => {
    expect(env({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }).pwa.getState().iosInstallable).toBe(true)
    expect(env({ ua: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', touch: 5 }).pwa.getState().iosInstallable).toBe(true)
    expect(env({ ua: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', touch: 0 }).pwa.getState().iosInstallable).toBe(false)
    expect(env({ ua: 'Mozilla/5.0 (iPhone)', standalone: true }).pwa.getState().iosInstallable).toBe(false)
  })

  it('treats iOS navigator.standalone as installed', () => {
    const t = env({ ua: 'Mozilla/5.0 (iPhone)' }); t.nav.standalone = true
    expect(createPwa({ win: t.win, nav: t.nav }).getState().standalone).toBe(true)
  })
})

describe('connectivity', () => {
  it('follows online/offline events and notifies subscribers', () => {
    const t = env(); const f = vi.fn(); const off = t.pwa.subscribe(f)
    t.win.dispatchEvent(new Event('offline')); expect(t.pwa.getState().online).toBe(false)
    t.win.dispatchEvent(new Event('online')); expect(t.pwa.getState().online).toBe(true)
    expect(f).toHaveBeenCalledTimes(2); off(); t.win.dispatchEvent(new Event('offline')); expect(f).toHaveBeenCalledTimes(2)
  })
  it('starts offline when the browser says so', () => expect(env({ online: false }).pwa.getState().online).toBe(false))
})

describe('service worker lifecycle', () => {
  it('first install announces offline readiness once, with no update prompt', async () => {
    const t = env(); await t.pwa.register('sw.js')
    expect(t.sw.register).toHaveBeenCalledWith('sw.js')
    const w = new Worker(); t.reg.installing = w; t.reg.dispatchEvent(new Event('updatefound')); w.to('installed')
    expect(t.pwa.getState()).toMatchObject({ offlineReady: true, offlineCapable: true, updateReady: false })
    t.pwa.dismissOfflineReady(); expect(t.pwa.getState().offlineReady).toBe(false)
  })

  it('an upgrade while a worker already controls the page offers an update instead', async () => {
    const t = env({ controller: true }); await t.pwa.register('sw.js')
    expect(t.pwa.getState().offlineCapable).toBe(true)
    const w = new Worker(); t.reg.installing = w; t.reg.dispatchEvent(new Event('updatefound')); w.to('installed')
    expect(t.pwa.getState()).toMatchObject({ updateReady: true, offlineReady: false })
  })

  it('finds a build that was already waiting when the page opened', async () => {
    const t = env({ controller: true }); t.reg.waiting = new Worker(); await t.pwa.register('sw.js')
    expect(t.pwa.getState().updateReady).toBe(true)
  })

  it('applying the update messages the waiting worker and reloads only after it takes control', async () => {
    const t = env({ controller: true }); await t.pwa.register('sw.js')
    const w = new Worker(); t.reg.installing = w; t.reg.dispatchEvent(new Event('updatefound')); w.to('installed')
    t.pwa.applyUpdate()
    expect(w.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(t.win.location.reload).not.toHaveBeenCalled()
    t.sw.dispatchEvent(new Event('controllerchange')); expect(t.win.location.reload).toHaveBeenCalledOnce()
    t.sw.dispatchEvent(new Event('controllerchange')); expect(t.win.location.reload).toHaveBeenCalledOnce()  // once, never a loop
  })

  it('never reloads by itself when a new worker takes control', async () => {
    const t = env(); await t.pwa.register('sw.js'); t.sw.dispatchEvent(new Event('controllerchange'))
    expect(t.win.location.reload).not.toHaveBeenCalled()
    t.pwa.applyUpdate()   // nothing waiting: a no-op
  })

  it('looks for a new build when the app returns to the foreground, at most every 30 minutes, and not offline', async () => {
    vi.useFakeTimers(); try {
      const t = env({ controller: true }); await t.pwa.register('sw.js')
      const show = () => t.win.document.dispatchEvent(new Event('visibilitychange'))
      show(); expect(t.reg.update).not.toHaveBeenCalled()
      vi.advanceTimersByTime(31 * 60e3); t.win.dispatchEvent(new Event('offline')); show(); expect(t.reg.update).not.toHaveBeenCalled()
      t.win.dispatchEvent(new Event('online')); show(); expect(t.reg.update).toHaveBeenCalledOnce()
      show(); expect(t.reg.update).toHaveBeenCalledOnce()
    } finally { vi.useRealTimers() }
  })

  it('stays silent when registration fails or service workers do not exist', async () => {
    await expect(env({ swFails: true }).pwa.register('sw.js')).resolves.toBeUndefined()
    await expect(env({ noSW: true }).pwa.register('sw.js')).resolves.toBeUndefined()
  })
})
