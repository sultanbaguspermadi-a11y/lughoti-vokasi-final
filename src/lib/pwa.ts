/** Registers the offline service worker (production only). Failure is silent: the app works without it. */
export function registerSW() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  addEventListener('load', () => { navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => { /* offline mode unavailable */ }) })
}
