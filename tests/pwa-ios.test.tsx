// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'

// iOS has no beforeinstallprompt: the offer must open manual steps instead. The UA is read when pwa.ts loads.
Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1', configurable: true })

describe('iOS install help', () => {
  it('opens Share > Add to Home Screen steps from the offer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(readFileSync('public/words.json', 'utf-8'))))
    localStorage.setItem('lv:aboutSeen', 'true')
    const { default: App } = await import('../src/App')
    render(<App />)
    fireEvent.click(screen.getByText('Buka kamus')); fireEvent.click(await screen.findByText(/Rekayasa Perangkat Lunak/)); await screen.findByRole('search')
    fireEvent.click(await screen.findByText('Pasang di layar utama', { selector: 'b' }))
    await waitFor(() => expect(screen.getByText(/Tambah ke Layar Utama/)).toBeTruthy())
    expect(document.querySelector('dialog[open] .ios-steps li')).toBeTruthy()
  })
})
