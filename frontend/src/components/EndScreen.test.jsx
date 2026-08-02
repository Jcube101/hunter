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

function setOnline(online) {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true })
}

afterEach(() => {
  vi.unstubAllGlobals()
  setOnline(true) // reset to jsdom's default so other test files aren't affected
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

  // Session 21 implements the A6 split this test used to just pin: "fetch
  // failed" and "offline" are now distinguished via navigator.onLine. This
  // case is ONLINE but the fetch itself failed (server hiccup, CORS, etc.) —
  // that's a transient error, so the personal-best fallback still applies.
  // See the offline-specific tests below for the other branch.
  it('online but the preview fetch fails: falls back to the personal-best rule', async () => {
    setDesktop()
    setOnline(true)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    render(
      <EndScreen score={3} personalBest={3} isNewPB onPlayAgain={() => {}} onMenu={() => {}} difficulty="easy" />,
    )
    expect(await screen.findByPlaceholderText('Your name')).toBeInTheDocument()
  })

  describe('offline (ROADMAP A6 — submission is a dead end, not a fallback)', () => {
    it('never shows the name input, even when the score is a new personal best', async () => {
      setDesktop()
      setOnline(false)
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
      render(
        <EndScreen score={99} personalBest={99} isNewPB onPlayAgain={() => {}} onMenu={() => {}} difficulty="easy" />,
      )
      // Let the (failing) preview fetch settle so this isn't just the loading state.
      await waitFor(() => expect(screen.getByText(/top scores/i)).toBeInTheDocument())
      expect(screen.queryByPlaceholderText('Your name')).not.toBeInTheDocument()
    })

    it('shows a clear offline message instead of the submit prompt', async () => {
      setDesktop()
      setOnline(false)
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
      render(
        <EndScreen score={5} personalBest={0} isNewPB={false} onPlayAgain={() => {}} onMenu={() => {}} difficulty="easy" />,
      )
      expect(await screen.findByText(/offline/i)).toBeInTheDocument()
    })

    it('never attempts a POST', async () => {
      setDesktop()
      setOnline(false)
      const fn = vi.fn().mockRejectedValue(new Error('offline'))
      vi.stubGlobal('fetch', fn)
      render(
        <EndScreen score={5} personalBest={0} isNewPB={false} onPlayAgain={() => {}} onMenu={() => {}} difficulty="easy" />,
      )
      await screen.findByText(/offline/i)
      expect(fn.mock.calls.some(([, opts]) => opts && opts.method === 'POST')).toBe(false)
    })

    it('still shows the personal-best flourish — it is purely local and does not depend on connectivity', async () => {
      setDesktop()
      setOnline(false)
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
      render(
        <EndScreen score={99} personalBest={99} isNewPB onPlayAgain={() => {}} onMenu={() => {}} difficulty="easy" />,
      )
      expect(await screen.findByText(/new personal best/i)).toBeInTheDocument()
    })

    it('retries the preview fetch when connectivity returns', async () => {
      setDesktop()
      setOnline(false)
      const fn = vi.fn().mockRejectedValue(new Error('offline'))
      vi.stubGlobal('fetch', fn)
      render(
        <EndScreen score={5} personalBest={0} isNewPB={false} onPlayAgain={() => {}} onMenu={() => {}} difficulty="easy" />,
      )
      await screen.findByText(/offline/i)
      expect(fn).toHaveBeenCalledTimes(1) // initial (failed) preview fetch

      setOnline(true)
      fireEvent(window, new Event('online'))

      await waitFor(() => expect(fn).toHaveBeenCalledTimes(2)) // retried on reconnect
      expect(screen.queryByText(/offline/i)).not.toBeInTheDocument()
    })

    // Session 22 Bug 2. A fetch made while genuinely offline can stay pending
    // for a long time before the browser actually rejects it — it isn't an
    // instant failure. If the player reconnects before that rejection
    // arrives, loadPreview() runs again and can succeed FIRST; the original
    // request's rejection then lands AFTER, and without a staleness guard it
    // would flip status back to 'error' right after it was correctly set to
    // 'ready'. That reproduces exactly what was observed: "Couldn't load
    // scores" persisting despite Full Leaderboard (a fresh fetch) working
    // fine — the network was healthy the whole time.
    it('a stale offline rejection arriving AFTER a successful reconnect fetch does not clobber the loaded board', async () => {
      setDesktop()
      setOnline(false)

      let rejectFirst
      let resolveSecond
      const firstCall = new Promise((_, reject) => {
        rejectFirst = reject
      })
      const secondCall = new Promise((resolve) => {
        resolveSecond = resolve
      })
      const responses = [firstCall, secondCall]
      const fn = vi.fn(() => responses.shift())
      vi.stubGlobal('fetch', fn)

      render(
        <EndScreen score={5} personalBest={0} isNewPB={false} onPlayAgain={() => {}} onMenu={() => {}} difficulty="easy" />,
      )
      await screen.findByText(/offline/i)
      expect(fn).toHaveBeenCalledTimes(1)

      setOnline(true)
      fireEvent(window, new Event('online'))
      await waitFor(() => expect(fn).toHaveBeenCalledTimes(2))

      // The reconnect fetch succeeds first...
      resolveSecond({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ id: 1, name: 'Alice', score: 3 }]),
      })
      await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

      // ...then the original offline request finally rejects, late.
      rejectFirst(new Error('offline (delayed)'))
      await new Promise((r) => setTimeout(r, 0)) // let the rejection's microtask settle

      expect(screen.queryByText(/couldn.t load scores/i)).not.toBeInTheDocument()
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    it('the submit prompt appears once the board reloads after reconnect, if the score qualifies', async () => {
      setDesktop()
      setOnline(false)
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve([]) }) // empty board -> room to qualify
      vi.stubGlobal('fetch', fn)

      render(
        <EndScreen score={5} personalBest={0} isNewPB={false} onPlayAgain={() => {}} onMenu={() => {}} difficulty="easy" />,
      )
      await screen.findByText(/offline/i)
      expect(screen.queryByPlaceholderText('Your name')).not.toBeInTheDocument()

      setOnline(true)
      fireEvent(window, new Event('online'))

      expect(await screen.findByPlaceholderText('Your name')).toBeInTheDocument()
    })
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
