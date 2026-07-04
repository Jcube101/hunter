// Settings.test.jsx — Area Q of the Session 17 audit.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Settings } from './Settings.jsx'

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
})
