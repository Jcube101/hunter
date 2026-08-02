// useFullscreen.test.js — Area L of the Session 17 audit.
//
// jsdom doesn't implement the Fullscreen API or screen.orientation.lock, so
// both are stubbed per test (audit decision D7). Each stub can be made to
// resolve, reject, or simply be absent to exercise the graceful-fallback path.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFullscreen } from './useFullscreen.js'
import { installOrientationStub } from '../test/deviceStubs.js'

afterEach(() => {
  vi.restoreAllMocks()
  delete document.documentElement.requestFullscreen
  delete document.exitFullscreen
  delete window.screen.orientation
  Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true })
})

describe('useFullscreen — enter()', () => {
  it('calls requestFullscreen and orientation.lock when available', async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    document.documentElement.requestFullscreen = requestFullscreen
    const { lock } = installOrientationStub()

    const { result } = renderHook(() => useFullscreen(() => {}))
    await act(async () => {
      await result.current.enter()
    })
    expect(requestFullscreen).toHaveBeenCalled()
    expect(lock).toHaveBeenCalledWith('landscape')
  })

  it('swallows a requestFullscreen rejection without throwing (graceful fallback)', async () => {
    document.documentElement.requestFullscreen = vi.fn().mockRejectedValue(new Error('denied'))
    const { result } = renderHook(() => useFullscreen(() => {}))
    await expect(
      act(async () => {
        await result.current.enter()
      }),
    ).resolves.not.toThrow()
  })

  it('does nothing (no throw) when the Fullscreen API is entirely absent (iOS Safari)', async () => {
    // No requestFullscreen, no webkitRequestFullscreen, no orientation.lock.
    const { result } = renderHook(() => useFullscreen(() => {}))
    await expect(
      act(async () => {
        await result.current.enter()
      }),
    ).resolves.not.toThrow()
  })

  it('swallows an orientation.lock rejection without throwing', async () => {
    document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined)
    installOrientationStub({ lockResolves: false })
    const { result } = renderHook(() => useFullscreen(() => {}))
    await expect(
      act(async () => {
        await result.current.enter()
      }),
    ).resolves.not.toThrow()
  })
})

describe('useFullscreen — exit()', () => {
  it('calls exitFullscreen only when currently fullscreen', async () => {
    const exitFullscreen = vi.fn().mockResolvedValue(undefined)
    document.exitFullscreen = exitFullscreen
    Object.defineProperty(document, 'fullscreenElement', {
      value: document.documentElement,
      configurable: true,
    })
    const { result } = renderHook(() => useFullscreen(() => {}))
    await act(async () => {
      await result.current.exit()
    })
    expect(exitFullscreen).toHaveBeenCalled()
  })

  it('does not call exitFullscreen when not currently fullscreen', async () => {
    const exitFullscreen = vi.fn().mockResolvedValue(undefined)
    document.exitFullscreen = exitFullscreen
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true })
    const { result } = renderHook(() => useFullscreen(() => {}))
    await act(async () => {
      await result.current.exit()
    })
    expect(exitFullscreen).not.toHaveBeenCalled()
  })
})

describe('useFullscreen — fullscreenchange', () => {
  it('updates isFullscreen and fires onExit only when exiting', () => {
    const onExit = vi.fn()
    const { result } = renderHook(() => useFullscreen(onExit))
    expect(result.current.isFullscreen).toBe(false)

    Object.defineProperty(document, 'fullscreenElement', {
      value: document.documentElement,
      configurable: true,
    })
    act(() => document.dispatchEvent(new Event('fullscreenchange')))
    expect(result.current.isFullscreen).toBe(true)
    expect(onExit).not.toHaveBeenCalled()

    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true })
    act(() => document.dispatchEvent(new Event('fullscreenchange')))
    expect(result.current.isFullscreen).toBe(false)
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})
