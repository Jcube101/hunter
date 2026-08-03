// PauseScreen.test.jsx — no prior coverage existed for this component (it was
// exercised only indirectly through App.test.jsx's pause-path tests). Added
// alongside the compact-layout wiring (ROADMAP.md B12) so that wiring has its
// own direct coverage, not just prior App-level indirection.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PauseScreen from './PauseScreen.jsx'

const baseProps = {
  onResume: () => {},
  onQuit: () => {},
  audioOn: true,
  onToggleAudio: () => {},
}

function setInnerHeight(h) {
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true })
}

afterEach(() => {
  setInnerHeight(768) // reset to jsdom's default
})

describe('PauseScreen', () => {
  it('shows PAUSED and calls onResume/onQuit', () => {
    const onResume = vi.fn()
    const onQuit = vi.fn()
    render(<PauseScreen {...baseProps} onResume={onResume} onQuit={onQuit} />)
    expect(screen.getByText('PAUSED')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(onResume).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Quit' }))
    expect(onQuit).toHaveBeenCalled()
  })

  it('reflects the audioOn prop and calls onToggleAudio', () => {
    const onToggleAudio = vi.fn()
    render(<PauseScreen {...baseProps} audioOn={false} onToggleAudio={onToggleAudio} />)
    const audioBtn = screen.getByLabelText('Turn sound on')
    expect(audioBtn).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(audioBtn)
    expect(onToggleAudio).toHaveBeenCalled()
  })

  // ROADMAP.md B12 — this screen already fit comfortably under 393px before
  // any compact adjustment; the hook is wired in for consistency with the
  // other four screens, not because content clipped here. These prove which
  // branch renders at a given viewport, not that content visually fits
  // (jsdom has no layout engine — ROADMAP.md A14).
  describe('compact layout (landscape phone heights, B12)', () => {
    it('the root is a scroll container regardless of compact mode (B6-consistent fallback)', () => {
      const { container } = render(<PauseScreen {...baseProps} />)
      expect(container.firstChild).toHaveClass('overflow-y-auto')
    })

    it('uses smaller heading text and tighter spacing in compact mode', () => {
      setInnerHeight(393)
      render(<PauseScreen {...baseProps} />)
      const heading = screen.getByText('PAUSED')
      expect(heading).toHaveClass('text-2xl')
      expect(heading).not.toHaveClass('text-4xl')
    })

    it('uses the full heading size outside compact mode', () => {
      setInnerHeight(800)
      render(<PauseScreen {...baseProps} />)
      const heading = screen.getByText('PAUSED')
      expect(heading).toHaveClass('text-4xl')
      expect(heading).not.toHaveClass('text-2xl')
    })

    it('Resume and Quit remain reachable in compact mode', () => {
      setInnerHeight(393)
      const onResume = vi.fn()
      render(<PauseScreen {...baseProps} onResume={onResume} />)
      fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
      expect(onResume).toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Quit' })).toBeInTheDocument()
    })
  })
})
