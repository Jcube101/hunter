// Leaderboard.test.jsx — Area H (+ the qualifies() piece of Area G) of the
// Session 17 audit. Covers the API helpers, the pure qualifies() rule
// (extracted from EndScreen in Session 18), and the LeaderboardList /
// LeaderboardOverlay components. Fetch is stubbed per-test (audit decision D4).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import {
  getLeaderboard,
  postScore,
  cap,
  qualifies,
  LeaderboardList,
  LeaderboardOverlay,
} from './Leaderboard.jsx'

function mockFetchOnce(body, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cap', () => {
  it('capitalizes the first letter', () => {
    expect(cap('easy')).toBe('Easy')
  })

  it('returns an empty string unchanged', () => {
    expect(cap('')).toBe('')
  })
})

describe('getLeaderboard', () => {
  it('builds the correct query URL and returns JSON on 200', async () => {
    const fn = mockFetchOnce([{ id: 1, name: 'Job', score: 5 }])
    const result = await getLeaderboard('easy', 'desktop')
    expect(fn).toHaveBeenCalledWith('/api/leaderboard?difficulty=easy&platform=desktop')
    expect(result).toEqual([{ id: 1, name: 'Job', score: 5 }])
  })

  it('throws on a non-ok response', async () => {
    mockFetchOnce(null, false, 400)
    await expect(getLeaderboard('easy', 'desktop')).rejects.toThrow('GET failed (400)')
  })
})

describe('postScore', () => {
  it('sends JSON with the right method/headers/body and returns JSON on ok', async () => {
    const fn = mockFetchOnce({ status: 'added' }, true, 201)
    const entry = { name: 'Job', score: 5, theme: 'ocean', difficulty: 'easy', platform: 'desktop' }
    const result = await postScore(entry)
    expect(fn).toHaveBeenCalledWith('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
    expect(result).toEqual({ status: 'added' })
  })

  it('throws on a non-ok response', async () => {
    mockFetchOnce(null, false, 422)
    await expect(postScore({})).rejects.toThrow('POST failed (422)')
  })
})

// Freshness (ROADMAP.md Session 19 addendum A13/A7): qualifies() is a pure
// function over whatever `entries` array it's handed — it has no notion of
// where those entries came from or how stale they are. The tests below
// correctly cover the comparison rule itself, but they provide zero
// protection against A7's real concern: a stale/cached board silently
// corrupting the top-10 cutoff this function computes. That's not a gap this
// file can close — "entries must come from a live network fetch, never a
// cache" is a property of the CALLER (EndScreen's loadPreview), not of
// qualifies(), and there is no caching layer to test against yet (no service
// worker exists in the repo — see A14). A test here that fakes "staleness" by
// passing some array and asserting the same comparison outcome would just
// re-test the rule already covered below under a misleading name — false
// assurance, not real coverage. The real freshness test belongs at the
// EndScreen/loadPreview layer once A7's caching work lands (e.g. asserting
// the End screen's leaderboard fetch is always network-only).
describe('qualifies', () => {
  it('qualifies when the board has room (< boardSize entries)', () => {
    expect(qualifies([{ score: 5 }], 1, 10)).toBe(true)
  })

  it('qualifies on a tie with the lowest (last) entry', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({ score: 10 - i })) // 10..1
    expect(qualifies(entries, 1, 10)).toBe(true) // ties the 10th place score
  })

  it('does not qualify when the board is full and the score is below the last entry', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({ score: 10 - i })) // 10..1
    expect(qualifies(entries, 0, 10)).toBe(false)
  })

  it('qualifies when the score beats the last entry', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({ score: 10 - i }))
    expect(qualifies(entries, 50, 10)).toBe(true)
  })
})

describe('LeaderboardList', () => {
  it('shows a loading message', () => {
    render(<LeaderboardList status="loading" entries={[]} limit={10} />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows an error message', () => {
    render(<LeaderboardList status="error" entries={[]} limit={10} />)
    expect(screen.getByText(/couldn.t load scores/i)).toBeInTheDocument()
  })

  it('shows an empty message when ready with no entries', () => {
    render(<LeaderboardList status="ready" entries={[]} limit={10} />)
    expect(screen.getByText(/no scores yet/i)).toBeInTheDocument()
  })

  it('renders rank, name, and score for ready entries', () => {
    const entries = [
      { id: 1, name: 'Alice', score: 20 },
      { id: 2, name: 'Bob', score: 15 },
    ]
    render(<LeaderboardList status="ready" entries={entries} limit={10} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('1')).toBeInTheDocument()
    expect(within(items[0]).getByText('Alice')).toBeInTheDocument()
    expect(within(items[0]).getByText('20')).toBeInTheDocument()
  })

  it('respects the limit (slices the entries)', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({ id: i, name: `P${i}`, score: i }))
    render(<LeaderboardList status="ready" entries={entries} limit={3} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })
})

describe('LeaderboardOverlay', () => {
  it('defaults to the given difficulty and the viewer platform, then fetches', async () => {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true })
    const fn = mockFetchOnce([])
    render(<LeaderboardOverlay difficulty="hardcore" onClose={() => {}} />)
    await waitFor(() =>
      expect(fn).toHaveBeenCalledWith('/api/leaderboard?difficulty=hardcore&platform=desktop'),
    )
    expect(screen.getByRole('button', { name: 'Hardcore' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Desktop' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('refetches when the difficulty tab changes', async () => {
    const fn = mockFetchOnce([])
    render(<LeaderboardOverlay difficulty="normal" platform="desktop" onClose={() => {}} />)
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Easy' }))
    await waitFor(() =>
      expect(fn).toHaveBeenCalledWith('/api/leaderboard?difficulty=easy&platform=desktop'),
    )
  })

  it('refetches when the platform toggle changes', async () => {
    const fn = mockFetchOnce([])
    render(<LeaderboardOverlay difficulty="normal" platform="desktop" onClose={() => {}} />)
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Mobile' }))
    await waitFor(() =>
      expect(fn).toHaveBeenCalledWith('/api/leaderboard?difficulty=normal&platform=mobile'),
    )
  })

  it('closes on click-outside but not on a click inside the panel', async () => {
    mockFetchOnce([])
    const onClose = vi.fn()
    const { container } = render(
      <LeaderboardOverlay difficulty="normal" platform="desktop" onClose={onClose} />,
    )
    await waitFor(() => screen.getByText('Leaderboard'))
    fireEvent.click(screen.getByText('Leaderboard')) // inside the panel (stopPropagation)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(container.firstChild) // the backdrop itself
    expect(onClose).toHaveBeenCalled()
  })
})
