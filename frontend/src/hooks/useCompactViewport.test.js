// useCompactViewport.test.js — ROADMAP.md O24.
//
// Proves the hook returns the right boolean at the threshold boundary and
// reacts to resize/orientationchange. Does NOT prove any screen actually fits
// or clips at a given height — jsdom has no layout engine, so that stays a
// device check (ROADMAP.md A14).

import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, act, fireEvent } from '@testing-library/react'
import { useCompactViewport, COMPACT_HEIGHT_THRESHOLD } from './useCompactViewport.js'

function setInnerHeight(h) {
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true })
}

afterEach(() => {
  setInnerHeight(768) // restore jsdom's usual default so other files aren't affected
})

describe('useCompactViewport', () => {
  it('is compact just under the threshold', () => {
    setInnerHeight(COMPACT_HEIGHT_THRESHOLD - 1)
    const { result } = renderHook(() => useCompactViewport())
    expect(result.current).toBe(true)
  })

  it('is not compact exactly at the threshold', () => {
    setInnerHeight(COMPACT_HEIGHT_THRESHOLD)
    const { result } = renderHook(() => useCompactViewport())
    expect(result.current).toBe(false)
  })

  it('is not compact just over the threshold', () => {
    setInnerHeight(COMPACT_HEIGHT_THRESHOLD + 1)
    const { result } = renderHook(() => useCompactViewport())
    expect(result.current).toBe(false)
  })

  it('responds to a resize crossing the threshold', () => {
    setInnerHeight(800)
    const { result } = renderHook(() => useCompactViewport())
    expect(result.current).toBe(false)
    act(() => {
      setInnerHeight(393) // 851x393 landscape phone reference viewport
      fireEvent(window, new Event('resize'))
    })
    expect(result.current).toBe(true)
  })

  it('responds to orientationchange crossing the threshold', () => {
    setInnerHeight(393)
    const { result } = renderHook(() => useCompactViewport())
    expect(result.current).toBe(true)
    act(() => {
      setInnerHeight(800)
      fireEvent(window, new Event('orientationchange'))
    })
    expect(result.current).toBe(false)
  })

  it('removes its listeners on unmount', () => {
    const { unmount } = renderHook(() => useCompactViewport())
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function))
  })
})
