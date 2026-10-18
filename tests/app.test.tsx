// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import App from '../src/App'
import ErrorBoundary from '../src/ErrorBoundary'
import { clearStored } from '../src/lib/core'

const json = readFileSync('public/words.json', 'utf-8')
beforeEach(() => {
  clearStored() // also drops the in-memory fallback copy
  vi.stubGlobal('fetch', vi.fn(async () => new Response(json, { status: 200 })))
})
afterEach(async () => {
  cleanup(); vi.unstubAllGlobals()
  while (history.state?.lv) { history.back(); await act(() => new Promise(r => setTimeout(r, 20))) }
})

const pick = async (name: RegExp) => {
  fireEvent.click(screen.getByText('Buka kamus'))
  fireEvent.click(await screen.findByText(name))
  await screen.findByRole('search')
}
const search = async (q: string) => { await act(async () => { fireEvent.change(screen.getByRole('searchbox'), { target: { value: q } }) }) }

describe('App', () => {
  it('offers general vocabulary (Umum) as a choice and lists its entries', async () => {
    render(<App />)
    await pick(/Kosakata umum/)
    await waitFor(() => expect(screen.getByText(/entri di UMU/)).toBeTruthy())
  })

  it('falls back to other majors when the chosen one has no match', async () => {
    render(<App />)
    await pick(/Rekayasa Perangkat Lunak/)
    await search('rantai motor') // absent in RPL, present in TSM
    await waitFor(() => expect(screen.getByText(/Menampilkan hasil dari jurusan lain/)).toBeTruthy())
  })

  it('shows the standard empty state for gibberish', async () => {
    render(<App />)
    await pick(/Rekayasa Perangkat Lunak/)
    await search('zzzqqq')
    expect(await screen.findByText('Tidak ada hasil')).toBeTruthy()
  })

  it('opens an entry, and Back closes it instead of leaving the app', async () => {
    render(<App />)
    await pick(/Rekayasa Perangkat Lunak/)
    await waitFor(() => expect(document.querySelector('.entry__open')).toBeTruthy())
    fireEvent.click(document.querySelector('.entry__open')!)
    await waitFor(() => expect(history.state?.lv).toBe(1))
    history.back()
    await waitFor(() => expect(history.state?.lv ?? 0).toBe(0))
    expect(document.querySelector('dialog[open]')).toBeNull()
  })

  it('survives corrupted localStorage instead of white-screening', async () => {
    localStorage.setItem('lv:favs', '"not-an-array"'); localStorage.setItem('lv:prefs', '[1,2]'); localStorage.setItem('lv:mine', '123')
    render(<App />)
    expect(screen.getByText('Buka kamus')).toBeTruthy()
    fireEvent.click(screen.getByText('Buka kamus'))
    expect(await screen.findByText('Kamu jurusan apa?')).toBeTruthy()
  })

  it('shows the recovery screen if rendering crashes', () => {
    const Boom = () => { throw new Error('boom') }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByText('Ada yang tidak beres')).toBeTruthy()
  })
})
