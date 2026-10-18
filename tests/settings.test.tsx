// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import App from '../src/App'
import Cover from '../src/Cover'
import { clearStored, normalizePrefs, DEFAULTS, ID_FONTS, AR_FONTS } from '../src/lib/core'

const json = readFileSync('public/words.json', 'utf-8')
const css = readFileSync('src/index.css', 'utf-8')

beforeEach(() => {
  clearStored()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(json, { status: 200 })))
})
afterEach(async () => {
  cleanup(); vi.unstubAllGlobals()
  while (history.state?.lv) { history.back(); await act(() => new Promise(r => setTimeout(r, 20))) }
})

const rootVar = (k: string) => document.documentElement.style.getPropertyValue(k)
const openSettings = async () => {
  fireEvent.click(screen.getByText('Buka kamus'))
  fireEvent.click(await screen.findByText(/Rekayasa Perangkat Lunak/))
  await screen.findByRole('search')
  fireEvent.click(screen.getByLabelText('Pengaturan tampilan'))
  await screen.findByRole('button', { name: /Atur ulang semua/ })
}

describe('normalizePrefs', () => {
  it('returns defaults for anything that is not an object', () => {
    for (const bad of [null, undefined, 42, 'x', [1, 2]]) expect(normalizePrefs(bad)).toEqual(DEFAULTS)
  })

  it('replaces unknown fonts, bad types and out-of-range numbers instead of leaving nothing selected', () => {
    const p = normalizePrefs({ ...DEFAULTS, idFont: 'Comic Neue', arFont: 'toString', accent: 'red', theme: 'neon', arSize: 99, lh: NaN, width: -5, compact: 'yes' })
    expect(p.idFont).toBe(DEFAULTS.idFont)
    expect(p.arFont).toBe(DEFAULTS.arFont)       // prototype keys must not count as fonts
    expect(p.accent).toBe(DEFAULTS.accent)
    expect(p.theme).toBe('system')
    expect(p.arSize).toBe(4)                     // clamped to the slider's max
    expect(p.lh).toBe(DEFAULTS.lh)
    expect(p.width).toBe(720)
    expect(p.compact).toBe(false)
  })

  it('keeps every valid font the picker offers', () => {
    for (const idFont of Object.keys(ID_FONTS)) expect(normalizePrefs({ ...DEFAULTS, idFont }).idFont).toBe(idFont)
    for (const arFont of Object.keys(AR_FONTS)) expect(normalizePrefs({ ...DEFAULTS, arFont }).arFont).toBe(arFont)
  })

  it('migrates prefs saved under an older rev, and is idempotent', () => {
    const old = normalizePrefs({ ...DEFAULTS, rev: 2, idFont: 'Source Serif', accent: '#A07A12', theme: 'dark' })
    expect(old.idFont).toBe(DEFAULTS.idFont)
    expect(old.accent).toBe('#8A6A0E')
    expect(old.theme).toBe('dark')               // unrelated choices survive
    expect(normalizePrefs(old)).toEqual(old)
    expect(JSON.stringify(normalizePrefs(DEFAULTS))).toBe(JSON.stringify(DEFAULTS)) // clean state serialises identically
  })
})

describe('Indonesian font setting', () => {
  it('drives every Indonesian string: --ui-font is an alias of --id-font, not a second hard-coded font', () => {
    expect(css).toMatch(/--ui-font:\s*var\(--id-font\)/)
    // the default stack may be written once, in :root; any other mention would pin some text to it again
    expect(css.match(/"Plus Jakarta Sans"/g)?.length).toBe(1)
  })

  it('applies the chosen font to the document and survives a reload', async () => {
    const { unmount } = render(<App />)
    await openSettings()
    fireEvent.click(screen.getByRole('button', { name: /Source Serif/ }))
    expect(rootVar('--id-font')).toContain('Source Serif 4')
    expect(screen.getByRole('button', { name: /Source Serif/ }).getAttribute('aria-pressed')).toBe('true')
    unmount()
    render(<App />)
    await act(async () => {})
    expect(rootVar('--id-font')).toContain('Source Serif 4')
  })
})

describe('global reset', () => {
  it('is disabled while everything is already default', async () => {
    render(<App />)
    await openSettings()
    expect((screen.getByRole('button', { name: /Atur ulang semua/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('restores every group at once, and Urungkan brings the previous state back', async () => {
    render(<App />)
    await openSettings()
    fireEvent.click(screen.getByRole('button', { name: /Source Serif/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Gelap' }))
    fireEvent.click(screen.getByLabelText('Safir'))
    fireEvent.click(screen.getByRole('button', { name: 'Ringkas' }))
    expect(document.documentElement.dataset.theme).toBe('dark')

    fireEvent.click(screen.getByRole('button', { name: /Atur ulang semua/ }))
    expect(rootVar('--id-font')).toContain('Plus Jakarta Sans')
    expect(rootVar('--acc')).toBe(DEFAULTS.accent)
    expect(document.documentElement.dataset.compact).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: 'Urungkan' }))
    expect(rootVar('--id-font')).toContain('Source Serif 4')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.dataset.compact).toBe('true')
  })

  it('drops the undo offer after a later manual change, so Urungkan cannot erase newer edits', async () => {
    render(<App />)
    await openSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Gelap' }))
    fireEvent.click(screen.getByRole('button', { name: /Atur ulang semua/ }))
    expect(screen.queryByRole('button', { name: 'Urungkan' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Terang' }))
    expect(screen.queryByRole('button', { name: 'Urungkan' })).toBeNull()
  })

  it('per-group reset only touches its own group and is disabled when that group is default', async () => {
    render(<App />)
    await openSettings()
    const resetColor = screen.getByRole('button', { name: 'Atur ulang warna' }) as HTMLButtonElement
    expect(resetColor.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Gelap' }))
    fireEvent.click(screen.getByRole('button', { name: /Source Serif/ }))
    expect(resetColor.disabled).toBe(false)
    fireEvent.click(resetColor)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(rootVar('--id-font')).toContain('Source Serif 4') // text group untouched
  })
})

describe('Cover', () => {
  it('has a named title, real Arabic text and a working start button', () => {
    const onStart = vi.fn()
    render(<Cover onStart={onStart} onAbout={() => {}} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Lughati Vokasi')
    expect(document.querySelector('[lang=ar]')?.textContent).toBe('لُغَتِي')
    expect(screen.getByText('Sultan Bagus Permadi')).toBeTruthy()
    fireEvent.click(screen.getByText('Buka kamus'))
    expect(onStart).toHaveBeenCalledOnce()
  })
})
