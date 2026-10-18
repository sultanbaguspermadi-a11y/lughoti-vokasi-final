import { Component, type ReactNode } from 'react'
import { clearStored } from './lib/core'

/** Last line of defence: a render crash shows a way out instead of a blank page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: unknown) { console.error('Lughati crashed:', e) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="screen" style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: '1.5rem' }}>
        <div className="state state--error" role="alert">
          <h1 style={{ fontSize: '1.25rem' }}>Ada yang tidak beres</h1>
          <p>Kamus berhenti bekerja. Muat ulang dulu. Jika masih gagal, hapus data lokal (favorit dan pengaturan) lalu coba lagi.</p>
          <button className="btn btn--primary" onClick={() => location.reload()}>Muat ulang</button>{' '}
          <button className="btn" onClick={() => { clearStored(); location.reload() }}>Hapus data lokal</button>
        </div>
      </main>
    )
  }
}
