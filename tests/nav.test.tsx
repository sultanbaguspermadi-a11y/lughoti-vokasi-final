// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { useState } from 'react'
import { useHistoryLayer } from '../src/lib/nav'

const tick = () => act(() => new Promise(r => setTimeout(r, 20)))
function Layer({ name }: { name: string }) {
  const [open, setOpen] = useState(false)
  useHistoryLayer(open, () => setOpen(false))
  return <div><button onClick={() => setOpen(true)}>open-{name}</button><button onClick={() => setOpen(false)}>close-{name}</button><p>{name}:{String(open)}</p></div>
}
afterEach(async () => { cleanup(); while (history.state?.lv) { history.back(); await tick() } })

describe('useHistoryLayer', () => {
  it('Back closes the overlay instead of leaving', async () => {
    render(<Layer name="a" />)
    fireEvent.click(screen.getByText('open-a')); await tick()
    expect(screen.getByText('a:true')).toBeTruthy(); expect(history.state?.lv).toBe(1)
    history.back(); await tick()
    expect(screen.getByText('a:false')).toBeTruthy(); expect(history.state?.lv ?? 0).toBe(0)
  })
  it('closing from the UI pops its history entry', async () => {
    render(<Layer name="a" />)
    fireEvent.click(screen.getByText('open-a')); await tick()
    fireEvent.click(screen.getByText('close-a')); await tick()
    expect(history.state?.lv ?? 0).toBe(0)
  })
  it('nested overlays close one at a time', async () => {
    render(<><Layer name="a" /><Layer name="b" /></>)
    fireEvent.click(screen.getByText('open-a')); await tick()
    fireEvent.click(screen.getByText('open-b')); await tick()
    expect(history.state?.lv).toBe(2)
    history.back(); await tick()
    expect(screen.getByText('b:false')).toBeTruthy(); expect(screen.getByText('a:true')).toBeTruthy()
    history.back(); await tick()
    expect(screen.getByText('a:false')).toBeTruthy()
  })
})
