// EndScreen.test.jsx — Area G of the Session 17 audit: the leaderboard
// qualification/submit-trigger wiring (component-level; the pure rule itself
// is tested in Leaderboard.test.jsx as qualifies()).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EndScreen from './EndScreen.jsx'

function fetchMock({ getBody = [], postOk = true } = {}) {
  const fn = vi.fn((url, opts) => {
    if (opts && opts.method === 'POST') {
      return Promise.resolve({
        ok: postOk,
        status: postOk ? 201 : 422,
        json: () => Promise.resolve({ status: 'added' }),
      })
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(getBody) })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function setDesktop() {
  Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('EndScreen submit-qualification wiring', () => {
  it('shows the submit prompt when the board has room', async () => {
    setDesktop()
    fetchMock({ getBody: [] })
    render(
      <EndScreen score={5} personalBest={0} isNewPB={false} difficulty="easy" onPlayAgain={() => {}} onMenu={() => {}} />,
    )
    expect(await screen.findByPlaceholderText('Your name')).toBeInTheDocument()
  })

  it('hides the submit prompt when the board is full and the score does not qualify', async () => {
    setDesktop()
    const full = Array.from({ length: 10 }, (_, i) => ({ id: i, name: `P${i}`, score: 10 - i }))
    fetchMock({ getBody: full })
    render(
      <EndScreen score={0} personalBest={0} isNewPB={false} difficulty="easy" onPlayAgain={() => {}} onMenu={() => {}} />,
    )
    await waitFor(() => expect(screen.getByText(/top scores/i)).toBeInTheDocument())
    expect(screen.queryByPlaceholderText('Your name')).not.toBeInTheDocument()
  })

  it('a tying score against the 10th place still qualifies', async () => {
    setDesktop()
    const full = Array.from({ length: 10 }, (_, i) => ({ id: i, name: `P${i}`, score: 10 - i })) // 10..1
    fetchMock({ getBody: full })
    render(
      <EndScreen score={1} personalBest={0} isNewPB={false} difficulty="easy" onPlayAgain={() => {}} onMenu={() => {}} />,
    )
    expect(await screen.findByPlaceholderText('Your name')).toBeInTheDocument()
  })

  it('falls back to the personal-best rule when the preview fetch fails', async () => {
    setDesktop()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    render(
      <EndScreen score={3} personalBest={3} isNewPB onPlayAgain={() => {}} onMenu={() => {}} difficulty="easy" />,
    )
    expect(await screen.findByPlaceholderText('Your name')).toBeInTheDocument()
  })

  it('does not show the submit prompt while the preview is still loading', () => {
    setDesktop()
    // Never-resolving fetch — component stays in the 'loading' state.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(
      <EndScreen score={5} personalBest={0} isNewPB={false} difficulty="easy" onPlayAgain={() => {}} onMenu={() => {}} />,
    )
    expect(screen.queryByPlaceholderText('Your name')).not.toBeInTheDocument()
  })

  it('hides the submit prompt after a successful submit and shows the confirmation', async () => {
    setDesktop()
    fetchMock({ getBody: [] })
    render(
      <EndScreen score={5} personalBest={0} isNewPB={false} difficulty="easy" onPlayAgain={() => {}} onMenu={() => {}} />,
    )
    const input = await screen.findByPlaceholderText('Your name')
    await userEvent.type(input, 'Job')
    fireEvent.click(screen.getByRole('button', { name: /add to leaderboard/i }))
    expect(await screen.findByText(/added to leaderboard/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Your name')).not.toBeInTheDocument()
  })

  it('submits with the real device platform, never a viewed board', async () => {
    setDesktop() // player's real device is desktop
    const fn = fetchMock({ getBody: [] })
    render(
      <EndScreen score={5} personalBest={0} isNewPB={false} difficulty="easy" onPlayAgain={() => {}} onMenu={() => {}} />,
    )
    const input = await screen.findByPlaceholderText('Your name')
    await userEvent.type(input, 'Job')
    fireEvent.click(screen.getByRole('button', { name: /add to leaderboard/i }))
    await waitFor(() => {
      const postCall = fn.mock.calls.find(([, opts]) => opts && opts.method === 'POST')
      expect(postCall).toBeTruthy()
      const body = JSON.parse(postCall[1].body)
      expect(body.platform).toBe('desktop')
      expect(body.name).toBe('Job')
    })
  })

  it('disables the submit button while the name is blank', async () => {
    setDesktop()
    fetchMock({ getBody: [] })
    render(
      <EndScreen score={5} personalBest={0} isNewPB={false} difficulty="easy" onPlayAgain={() => {}} onMenu={() => {}} />,
    )
    await screen.findByPlaceholderText('Your name')
    expect(screen.getByRole('button', { name: /add to leaderboard/i })).toBeDisabled()
  })

  it('a successful submit refreshes the preview (second GET fetch)', async () => {
    setDesktop()
    const fn = fetchMock({ getBody: [] })
    render(
      <EndScreen score={5} personalBest={0} isNewPB={false} difficulty="easy" onPlayAgain={() => {}} onMenu={() => {}} />,
    )
    const input = await screen.findByPlaceholderText('Your name')
    await userEvent.type(input, 'Job')
    fireEvent.click(screen.getByRole('button', { name: /add to leaderboard/i }))
    await waitFor(() => {
      const getCalls = fn.mock.calls.filter(([, opts]) => !opts || !opts.method)
      expect(getCalls.length).toBeGreaterThanOrEqual(2) // initial preview + post-submit refresh
    })
  })
})
