// Tutorial.test.jsx — Area S of the Session 17 audit.
//
// The slide illustrations draw to a real <canvas>, which jsdom does not
// implement (getContext('2d') returns null by default). Per audit decision
// D3, pixel-level draw assertions are skipped entirely; canvas.getContext is
// stubbed with a permissive Proxy (any method call / property set is a
// silent no-op) purely so the component's draw effects don't throw.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Tutorial from './Tutorial.jsx'

function makeFakeCtx() {
  return new Proxy(
    {},
    {
      get(target, prop) {
        if (prop in target) return target[prop]
        return vi.fn()
      },
      set(target, prop, value) {
        target[prop] = value
        return true
      },
    },
  )
}

function setInnerHeight(h) {
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true })
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(makeFakeCtx())
})

afterEach(() => {
  vi.restoreAllMocks()
  setInnerHeight(768) // reset to jsdom's default
})

describe('Tutorial', () => {
  it('starts at slide 1 of 3', () => {
    render(<Tutorial onDone={() => {}} />)
    expect(screen.getByText('Predator Instinct')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
  })

  it('Next advances through the slides', () => {
    render(<Tutorial onDone={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('On the Prowl')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('60 Seconds')).toBeInTheDocument()
  })

  it('the last slide shows a Play button whose click dismisses and marks the flag', () => {
    const onDone = vi.fn()
    render(<Tutorial onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    const playBtn = screen.getByRole('button', { name: 'Play' })
    fireEvent.click(playBtn)
    expect(localStorage.getItem('hunter_tutorial_seen')).toBe('true')
    expect(onDone).toHaveBeenCalled()
  })

  it('Skip dismisses from any slide and marks the flag', () => {
    const onDone = vi.fn()
    render(<Tutorial onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' })) // slide 2
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(localStorage.getItem('hunter_tutorial_seen')).toBe('true')
    expect(onDone).toHaveBeenCalled()
  })

  it('swiping left advances to the next slide', () => {
    const { container } = render(<Tutorial onDone={() => {}} />)
    const root = container.firstChild
    fireEvent.touchStart(root, { changedTouches: [{ clientX: 200 }] })
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 100 }] }) // dx = -100
    expect(screen.getByText('On the Prowl')).toBeInTheDocument()
  })

  it('swiping right moves to the previous slide', () => {
    const { container } = render(<Tutorial onDone={() => {}} />)
    const root = container.firstChild
    fireEvent.click(screen.getByRole('button', { name: 'Next' })) // go to slide 2
    fireEvent.touchStart(root, { changedTouches: [{ clientX: 100 }] })
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 200 }] }) // dx = +100
    expect(screen.getByText('Predator Instinct')).toBeInTheDocument()
  })

  it('a swipe below the threshold is ignored', () => {
    const { container } = render(<Tutorial onDone={() => {}} />)
    const root = container.firstChild
    fireEvent.touchStart(root, { changedTouches: [{ clientX: 200 }] })
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 185 }] }) // dx = -15, below 40
    expect(screen.getByText('Predator Instinct')).toBeInTheDocument()
  })

  it('prev clamps at slide 0', () => {
    const { container } = render(<Tutorial onDone={() => {}} />)
    const root = container.firstChild
    fireEvent.touchStart(root, { changedTouches: [{ clientX: 100 }] })
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 200 }] }) // swipe right from slide 0
    expect(screen.getByText('Predator Instinct')).toBeInTheDocument() // still slide 0
  })

  // ROADMAP.md B5/B6/O25 — compact layout at landscape-phone heights. These
  // prove which branch renders at a given innerHeight, not that content
  // actually fits at 393px (jsdom has no layout engine — ROADMAP.md A14).
  describe('compact layout (landscape phone heights, B5/O25)', () => {
    it('the root is a scroll container regardless of compact mode (B6 fallback)', () => {
      const { container } = render(<Tutorial onDone={() => {}} />)
      expect(container.firstChild).toHaveClass('overflow-y-auto')
    })

    it('scales the illustration display size down in compact mode', () => {
      setInnerHeight(393)
      const { container } = render(<Tutorial onDone={() => {}} />)
      const canvas = container.querySelector('canvas')
      // Slide 1 is 200x120; compact scales display size by 0.7 (CSS only —
      // the canvas still draws at full resolution, see the component header).
      expect(canvas.style.width).toBe('140px')
      expect(canvas.style.height).toBe('84px')
    })

    it('does not scale the illustration display size outside compact mode', () => {
      setInnerHeight(800)
      const { container } = render(<Tutorial onDone={() => {}} />)
      const canvas = container.querySelector('canvas')
      expect(canvas.style.width).toBe('200px')
      expect(canvas.style.height).toBe('120px')
    })

    it('Next/Play remains reachable and title text shrinks in compact mode', () => {
      setInnerHeight(393)
      render(<Tutorial onDone={() => {}} />)
      const heading = screen.getByText('Predator Instinct')
      expect(heading).toHaveClass('text-xl')
      expect(heading).not.toHaveClass('text-3xl')
      expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
    })
  })
})
