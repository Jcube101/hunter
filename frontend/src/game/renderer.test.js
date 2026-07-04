// renderer.test.js — Area U of the Session 17 audit. Per the audit's decision
// D3, pixel-level draw assertions are skipped; this covers only two invariants
// via a minimal ctx spy:
//   - headingOf() (module-private) prefers an explicit `angle` over the
//     vx/vy-derived heading — observed through drawSchool's ctx.rotate calls.
//   - the shark's nose sits at local x = SHARK_MOUTH_OFFSET (28), so the
//     visual front tip lands exactly on the catch point.

import { describe, it, expect, vi } from 'vitest'
import { drawSchool, drawShark } from './renderer.js'
import { SHARK_MOUTH_OFFSET } from '../constants/boids.js'

function makeCtxSpy() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    set shadowBlur(_v) {},
    set shadowColor(_v) {},
    set fillStyle(_v) {},
    set strokeStyle(_v) {},
    set lineWidth(_v) {},
  }
}

describe('headingOf (via drawSchool)', () => {
  it('prefers an explicit numeric angle over the vx/vy-derived heading', () => {
    const ctx = makeCtxSpy()
    const fish = { x: 0, y: 0, vx: 1, vy: 0, angle: Math.PI } // vx/vy says 0, angle says PI
    drawSchool(ctx, [fish], { x: 0, y: 0 }, { x: 1000, y: 1000 }, 10)
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI)
  })

  it('falls back to atan2(vy, vx) when no explicit angle is present', () => {
    const ctx = makeCtxSpy()
    const fish = { x: 0, y: 0, vx: 0, vy: 1 } // moving straight down
    drawSchool(ctx, [fish], { x: 0, y: 0 }, { x: 1000, y: 1000 }, 10)
    expect(ctx.rotate).toHaveBeenCalledWith(Math.atan2(1, 0))
  })
})

describe('drawShark nose/catch-point invariant', () => {
  it('the outline path starts at local x = SHARK_MOUTH_OFFSET, y = 0 (the nose)', () => {
    const ctx = makeCtxSpy()
    drawShark(ctx, 0, 0, 0)
    expect(ctx.moveTo).toHaveBeenCalled()
    const [firstX, firstY] = ctx.moveTo.mock.calls[0]
    expect(firstX).toBe(SHARK_MOUTH_OFFSET)
    expect(firstY).toBe(0)
  })
})
