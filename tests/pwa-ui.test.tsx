// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import App from '../src/App'
import PwaStatus from '../src/PwaStatus'
import { clearStored } from '../src/lib/core'

const json = readFileSync('public/words.json', 'utf-8')
beforeEach(() => { clearStored(); vi.stubGlobal('fetch', vi.fn(async () => new Response(json, { status: 200 }))) })
afterEach(async () => {
  cleanup(); vi.unstubAllGlobals()
  while (history.state?.lv) { history.back(); await act(() => new Promise(r => setTimeout(r, 20))) }
})
const fire = (e: Event) => act(() => { window.dispatchEvent(e) })
const promptEvent = (outcome: 'accepted' | 'dismissed') => Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: vi.fn(async () => {}), userChoice: Promise.resolve({ outcome }) })
const enterApp = async () => { fireEvent.click(screen.getByText('Buka kamus')); fireEvent.click(await screen.findByText(/Rekayasa Perangkat Lunak/)); await screen.findByRole('search') }

describe('PwaStatus', () => {
  it('tells the student when the connection drops, and again after each new outage', async () => {
    render(<PwaStatus />)
    expect(screen.queryByText(/offline/)).toBeNull()
    await fire(new Event('offline')); expect(screen.getByText('Kamu sedang offline.')).toBeTruthy()
    fireEvent.click(screen.getByText('Tutup')); expect(screen.queryByText(/offline/)).toBeNull()
    await fire(new Event('online')); await fire(new Event('offline'))
    expect(screen.getByText('Kamu sedang offline.')).toBeTruthy()
    await fire(new Event('online')); expect(screen.queryByText(/offline/)).toBeNull()
  })

  it('keeps its live region in the DOM so announcements are read out', () => {
    render(<PwaStatus />); expect(document.querySelector('.pwa[role=status][aria-live=polite]')).toBeTruthy()
  })
})

describe('install offer in App', () => {
  it('shows after the story teaser is out of the way, installs through the native prompt, and honours a "no" for two weeks', async () => {
    localStorage.setItem('lv:aboutSeen', 'true')
    const ev = promptEvent('dismissed'); await fire(ev)
    render(<App />); await enterApp()
    fireEvent.click(await screen.findByText('Pasang di layar utama', { selector: 'b' }))
    await waitFor(() => expect(ev.prompt).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.queryByText('Pasang di layar utama', { selector: 'b' })).toBeNull())
    expect(Number(JSON.parse(localStorage.getItem('lv:installAsked')!))).toBeGreaterThan(Date.now() - 5000)
    // the browser hands out a fresh prompt later; the footer link still offers it, the card stays away
    await fire(promptEvent('accepted'))
    expect(screen.queryByText('Pasang di layar utama', { selector: 'b' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Pasang di layar utama' })).toBeTruthy()
  })

  it('waits behind the "Kenapa kamus ini dibuat?" teaser instead of stacking two cards', async () => {
    await fire(promptEvent('accepted'))
    render(<App />); await enterApp()
    expect(screen.getByText('Kenapa kamus ini dibuat?')).toBeTruthy()
    expect(screen.queryByText('Pasang di layar utama', { selector: 'b' })).toBeNull()
  })

  it('disappears for good once the app is installed', async () => {
    localStorage.setItem('lv:aboutSeen', 'true'); await fire(promptEvent('accepted'))
    render(<App />); await enterApp()
    expect(await screen.findByText('Pasang di layar utama', { selector: 'b' })).toBeTruthy()
    await fire(new Event('appinstalled'))
    expect(screen.queryByText('Pasang di layar utama', { selector: 'b' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Pasang di layar utama' })).toBeNull()
  })
})
