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

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(makeFakeCtx())
})

afterEach(() => {
  vi.restoreAllMocks()
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
})
