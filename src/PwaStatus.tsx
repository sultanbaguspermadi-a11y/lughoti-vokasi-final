import { useEffect, useState } from 'react'
import { usePwa } from './lib/pwa'
import './pwa.css'

/** One quiet notice at a time, most important first: update > offline-ready > offline.
 *  The live region exists before its content changes, otherwise screen readers would not announce it. */
export default function PwaStatus() {
  const s = usePwa()
  const [skipUpdate, setSkipUpdate] = useState(false)
  const [skipOffline, setSkipOffline] = useState(false)
  useEffect(() => { if (s.online) setSkipOffline(false) }, [s.online]) // each new outage deserves one notice

  let msg: { text: string; act?: [string, () => void]; close: () => void } | null = null
  if (s.updateReady && !skipUpdate) msg = { text: 'Versi baru tersedia. Muat ulang untuk memakainya.', act: ['Muat ulang', s.applyUpdate], close: () => setSkipUpdate(true) }
  else if (s.offlineReady) msg = { text: 'Siap dipakai tanpa internet. Kamus sudah tersimpan di perangkat ini.', close: s.dismissOfflineReady }
  else if (!s.online && !skipOffline) msg = { text: s.offlineCapable ? 'Kamu sedang offline. Kamus tetap bisa dipakai.' : 'Kamu sedang offline.', close: () => setSkipOffline(true) }

  return (
    <div className="pwa" role="status" aria-live="polite">
      {msg && (
        <div className="pwa__card">
          <p>{msg.text}</p>
          <div className="pwa__acts">
            {msg.act && <button type="button" className="btn btn--primary" onClick={msg.act[1]}>{msg.act[0]}</button>}
            <button type="button" className="btn" onClick={msg.close}>{msg.act ? 'Nanti' : 'Tutup'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
