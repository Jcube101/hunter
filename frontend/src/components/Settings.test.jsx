// Settings.test.jsx — Area Q of the Session 17 audit.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Settings } from './Settings.jsx'

function setInnerHeight(h) {
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true })
}

afterEach(() => {
  setInnerHeight(768) // reset to jsdom's default
})

describe('Settings', () => {
  it('reflects the audioOn prop on the toggle', () => {
    render(<Settings onClose={() => {}} audioOn={true} onToggleAudio={() => {}} />)
    expect(screen.getByRole('button', { name: /sound/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('reflects audioOn=false on the toggle', () => {
    render(<Settings onClose={() => {}} audioOn={false} onToggleAudio={() => {}} />)
    expect(screen.getByRole('button', { name: /sound/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onToggleAudio(!on) when the toggle is clicked', () => {
    const onToggleAudio = vi.fn()
    render(<Settings onClose={() => {}} audioOn={true} onToggleAudio={onToggleAudio} />)
    fireEvent.click(screen.getByRole('button', { name: /sound/i }))
    expect(onToggleAudio).toHaveBeenCalledWith(false)
  })

  it('calls onClose from both the close (X) and Back buttons', () => {
    const onClose = vi.fn()
    render(<Settings onClose={onClose} audioOn={true} onToggleAudio={() => {}} />)
    fireEvent.click(screen.getByLabelText('Close settings'))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  // ROADMAP.md B12 — this screen already fit comfortably under 393px before
  // any compact adjustment; the hook is wired in for consistency with the
  // other four screens, not because content clipped here. These prove which
  // branch renders at a given viewport, not that content visually fits
  // (jsdom has no layout engine — ROADMAP.md A14).
  describe('compact layout (landscape phone heights, B12)', () => {
    it('the root is a scroll container regardless of compact mode (B6-consistent fallback)', () => {
      const { container } = render(<Settings onClose={() => {}} audioOn={true} onToggleAudio={() => {}} />)
      expect(container.firstChild).toHaveClass('overflow-y-auto')
    })

    it('uses smaller heading text in compact mode', () => {
      setInnerHeight(393)
      render(<Settings onClose={() => {}} audioOn={true} onToggleAudio={() => {}} />)
      const heading = screen.getByText('SETTINGS')
      expect(heading).toHaveClass('text-2xl')
      expect(heading).not.toHaveClass('text-4xl')
    })

    it('uses the full heading size outside compact mode', () => {
      setInnerHeight(800)
      render(<Settings onClose={() => {}} audioOn={true} onToggleAudio={() => {}} />)
      const heading = screen.getByText('SETTINGS')
      expect(heading).toHaveClass('text-4xl')
      expect(heading).not.toHaveClass('text-2xl')
    })

    it('the toggle and Back button remain reachable in compact mode', () => {
      setInnerHeight(393)
      const onToggleAudio = vi.fn()
      render(<Settings onClose={() => {}} audioOn={true} onToggleAudio={onToggleAudio} />)
      fireEvent.click(screen.getByRole('button', { name: /sound/i }))
      expect(onToggleAudio).toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    })
  })
})
