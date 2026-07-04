// StartScreen.test.jsx — Area P of the Session 17 audit.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StartScreen from './StartScreen.jsx'

const baseProps = {
  onPlay: () => {},
  onLeaderboard: () => {},
  onHowToPlay: () => {},
  onOpenSettings: () => {},
  audioOn: true,
  onToggleAudio: () => {},
  difficulty: 'normal',
  onSelectDifficulty: () => {},
}

beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('StartScreen', () => {
  it('shows the personal best for the selected difficulty', () => {
    localStorage.setItem('hunter_pb_normal', '42')
    render(<StartScreen {...baseProps} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('hides the personal best line when none is stored', () => {
    render(<StartScreen {...baseProps} />)
    expect(screen.queryByText(/personal best/i)).not.toBeInTheDocument()
  })

  it('updates the shown PB when the difficulty prop changes', () => {
    localStorage.setItem('hunter_pb_easy', '10')
    localStorage.setItem('hunter_pb_hardcore', '99')
    const { rerender } = render(<StartScreen {...baseProps} difficulty="easy" />)
    expect(screen.getByText('10')).toBeInTheDocument()
    rerender(<StartScreen {...baseProps} difficulty="hardcore" />)
    expect(screen.getByText('99')).toBeInTheDocument()
  })

  it('marks the active difficulty button with aria-pressed and calls onSelectDifficulty', () => {
    const onSelectDifficulty = vi.fn()
    render(<StartScreen {...baseProps} difficulty="easy" onSelectDifficulty={onSelectDifficulty} />)
    expect(screen.getByRole('button', { name: 'Easy' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Hardcore' }))
    expect(onSelectDifficulty).toHaveBeenCalledWith('hardcore')
  })

  it('reflects the audio state on the toggle button and fires callbacks', () => {
    const onToggleAudio = vi.fn()
    const onPlay = vi.fn()
    const onLeaderboard = vi.fn()
    const onHowToPlay = vi.fn()
    const onOpenSettings = vi.fn()
    render(
      <StartScreen
        {...baseProps}
        audioOn={false}
        onToggleAudio={onToggleAudio}
        onPlay={onPlay}
        onLeaderboard={onLeaderboard}
        onHowToPlay={onHowToPlay}
        onOpenSettings={onOpenSettings}
      />,
    )
    const audioBtn = screen.getByLabelText('Turn sound on')
    expect(audioBtn).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(audioBtn)
    expect(onToggleAudio).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(onPlay).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Leaderboard' }))
    expect(onLeaderboard).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'How to play' }))
    expect(onHowToPlay).toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Settings'))
    expect(onOpenSettings).toHaveBeenCalled()
  })

  it('uses the compact layout when viewport height is under 500px', () => {
    Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true })
    render(<StartScreen {...baseProps} />)
    expect(screen.queryByText(/best played in landscape/i)).not.toBeInTheDocument()
  })

  it('responds to a resize crossing the compact threshold', () => {
    render(<StartScreen {...baseProps} />)
    expect(screen.getByText(/best played in landscape/i)).toBeInTheDocument()
    Object.defineProperty(window, 'innerHeight', { value: 300, configurable: true })
    fireEvent(window, new Event('resize'))
    expect(screen.queryByText(/best played in landscape/i)).not.toBeInTheDocument()
  })
})
