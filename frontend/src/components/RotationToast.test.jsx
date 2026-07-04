// RotationToast.test.jsx — Area O of the Session 17 audit.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { RotationToast } from './RotationToast.jsx'

function setTouchDevice(isTouch) {
  Object.defineProperty(navigator, 'maxTouchPoints', { value: isTouch ? 1 : 0, configurable: true })
}

function setPortrait(isPortrait) {
  Object.defineProperty(window, 'innerWidth', { value: isPortrait ? 400 : 900, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: isPortrait ? 900 : 400, configurable: true })
}

beforeEach(() => {
  sessionStorage.clear()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('RotationToast', () => {
  it('never mounts on a non-touch device', () => {
    setTouchDevice(false)
    setPortrait(true)
    render(<RotationToast />)
    act(() => vi.advanceTimersByTime(1500))
    expect(screen.queryByText(/rotate your phone/i)).not.toBeInTheDocument()
  })

  it('never mounts in landscape', () => {
    setTouchDevice(true)
    setPortrait(false)
    render(<RotationToast />)
    act(() => vi.advanceTimersByTime(1500))
    expect(screen.queryByText(/rotate your phone/i)).not.toBeInTheDocument()
  })

  it('never mounts again in the same session once already shown', () => {
    sessionStorage.setItem('hunter_rotation_toast_shown', 'true')
    setTouchDevice(true)
    setPortrait(true)
    render(<RotationToast />)
    act(() => vi.advanceTimersByTime(1500))
    expect(screen.queryByText(/rotate your phone/i)).not.toBeInTheDocument()
  })

  it('appears 1s after mount on a touch+portrait device and writes the session flag', () => {
    setTouchDevice(true)
    setPortrait(true)
    render(<RotationToast />)
    expect(screen.queryByText(/rotate your phone/i)).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText(/rotate your phone/i)).toBeInTheDocument()
    expect(sessionStorage.getItem('hunter_rotation_toast_shown')).toBe('true')
  })

  it('auto-dismisses ~4s after appearing', () => {
    setTouchDevice(true)
    setPortrait(true)
    render(<RotationToast />)
    act(() => vi.advanceTimersByTime(1000)) // appears
    expect(screen.getByText(/rotate your phone/i)).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(4000 + 300)) // hide + fade-out unmount
    expect(screen.queryByText(/rotate your phone/i)).not.toBeInTheDocument()
  })
})
