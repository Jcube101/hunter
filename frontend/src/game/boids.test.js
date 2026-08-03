// boids.test.js — Area A of the Session 17 audit. Pure math, no DOM/canvas.
// Force functions are tested directly; `normalize`/`clampMagnitude`/`maxSpeedFor`
// stay module-private (audit decision D9) and are exercised indirectly through
// separation/alignment/cohesion (normalize) and updateFish (clampMagnitude +
// the speed ramp).

import { describe, it, expect } from 'vitest'
import {
  separation,
  alignment,
  cohesion,
  flee,
  edgeRepulsion,
  anchorForce,
  updateFish,
  updateSchool,
  updateSchoolInto,
  initFish,
} from './boids.js'
import { stepPredator } from './predator.js'
import {
  FISH_BASE_SPEED,
  FISH_FLEE_SPEED,
  INITIAL_VELOCITY_RANGE,
  EDGE_REPULSION_RADIUS,
  EDGE_REPULSION_WEIGHT,
  DIFFICULTY_SETTINGS,
} from '../constants/boids.js'

describe('separation', () => {
  it('steers away from a single close neighbor', () => {
    const fish = { x: 10, y: 0, vx: 0, vy: 0 }
    const other = { x: 5, y: 0, vx: 0, vy: 0 }
    const f = separation(fish, [fish, other], 25, 1.5)
    expect(f.x).toBeCloseTo(1.5) // pushed +x, away from the neighbor at smaller x
    expect(f.y).toBeCloseTo(0)
  })

  it('ignores a neighbor outside the radius', () => {
    const fish = { x: 0, y: 0 }
    const other = { x: 30, y: 0 }
    const f = separation(fish, [fish, other], 25, 1.5)
    expect(f).toEqual({ x: 0, y: 0 })
  })

  it('skips itself even when present in the neighbor list', () => {
    const fish = { x: 0, y: 0 }
    const f = separation(fish, [fish], 25, 1.5)
    expect(f).toEqual({ x: 0, y: 0 })
  })

  it('two symmetric neighbors cancel to zero', () => {
    const fish = { x: 0, y: 0 }
    const left = { x: -5, y: 0 }
    const right = { x: 5, y: 0 }
    const f = separation(fish, [fish, left, right], 25, 1.5)
    expect(f.x).toBeCloseTo(0)
    expect(f.y).toBeCloseTo(0)
  })

  it('a much closer neighbor dominates the resultant direction (1/d^2 weighting)', () => {
    const fish = { x: 0, y: 0 }
    const near = { x: -1, y: 0 } // distance 1
    const far = { x: 0, y: -20 } // distance 20, different axis
    const f = separation(fish, [fish, near, far], 25, 1)
    // Direction should be dominated by the near neighbor's axis (+x).
    expect(f.x).toBeGreaterThan(0.9)
    expect(Math.abs(f.y)).toBeLessThan(0.1)
  })
})

describe('alignment', () => {
  it('returns zero with no neighbors in radius', () => {
    const fish = { x: 0, y: 0 }
    expect(alignment(fish, [fish], 60, 1)).toEqual({ x: 0, y: 0 })
  })

  it('ignores neighbors outside the radius', () => {
    const fish = { x: 0, y: 0 }
    const far = { x: 1000, y: 0, vx: 5, vy: 0 }
    expect(alignment(fish, [fish, far], 60, 1)).toEqual({ x: 0, y: 0 })
  })

  it('steers toward the normalized average heading of in-radius neighbors', () => {
    const fish = { x: 0, y: 0 }
    const a = { x: 10, y: 0, vx: 1, vy: 0 }
    const b = { x: 0, y: 10, vx: 0, vy: 1 }
    const f = alignment(fish, [fish, a, b], 60, 1)
    expect(f.x).toBeCloseTo(Math.SQRT1_2)
    expect(f.y).toBeCloseTo(Math.SQRT1_2)
  })
})

describe('cohesion', () => {
  it('returns zero with no neighbors in radius', () => {
    const fish = { x: 0, y: 0 }
    expect(cohesion(fish, [fish], 100, 1)).toEqual({ x: 0, y: 0 })
  })

  it('steers toward the centroid of in-radius neighbors', () => {
    const fish = { x: 0, y: 0 }
    const other = { x: 10, y: 0 }
    const f = cohesion(fish, [fish, other], 100, 1)
    expect(f.x).toBeCloseTo(1)
    expect(f.y).toBeCloseTo(0)
  })

  it('is zero when the fish is already at the neighbor centroid', () => {
    const fish = { x: 0, y: 0 }
    const left = { x: -5, y: 0 }
    const right = { x: 5, y: 0 }
    const f = cohesion(fish, [fish, left, right], 100, 1)
    expect(f.x).toBeCloseTo(0)
    expect(f.y).toBeCloseTo(0)
  })
})

describe('flee', () => {
  it('flees away from a predator within radius', () => {
    const fish = { x: 10, y: 0 }
    const predator = { x: 0, y: 0 }
    const f = flee(fish, predator, 20, 3)
    expect(f.x).toBeCloseTo(3)
    expect(f.y).toBeCloseTo(0)
  })

  it('returns zero when the predator is beyond the flee radius', () => {
    const fish = { x: 100, y: 0 }
    const predator = { x: 0, y: 0 }
    expect(flee(fish, predator, 20, 3)).toEqual({ x: 0, y: 0 })
  })

  it('returns zero when there is no predator', () => {
    const fish = { x: 10, y: 0 }
    expect(flee(fish, null, 20, 3)).toEqual({ x: 0, y: 0 })
  })

  it('returns zero when the predator exactly coincides with the fish', () => {
    const fish = { x: 5, y: 5 }
    const predator = { x: 5, y: 5 }
    expect(flee(fish, predator, 20, 3)).toEqual({ x: 0, y: 0 })
  })

  it('is zero exactly at the radius boundary (>=, not >)', () => {
    const fish = { x: 20, y: 0 }
    const predator = { x: 0, y: 0 }
    expect(flee(fish, predator, 20, 3)).toEqual({ x: 0, y: 0 })
  })
})

describe('edgeRepulsion', () => {
  const world = { width: 1000, height: 1000 }

  it('is zero in open water, far from every edge', () => {
    const fish = { x: 500, y: 500 }
    expect(edgeRepulsion(fish, world, 120, 3)).toEqual({ x: 0, y: 0 })
  })

  it('pushes right, away from the left edge', () => {
    const fish = { x: 10, y: 500 }
    const f = edgeRepulsion(fish, world, 120, 1)
    expect(f.x).toBeCloseTo((120 - 10) / 120)
    expect(f.y).toBeCloseTo(0)
  })

  it('pushes left, away from the right edge', () => {
    const fish = { x: 990, y: 500 }
    const f = edgeRepulsion(fish, world, 120, 1)
    expect(f.x).toBeCloseTo(-(120 - 10) / 120)
  })

  it('ramps from zero at the radius to full strength at the wall', () => {
    const atRadius = edgeRepulsion({ x: 120, y: 500 }, world, 120, 1)
    const atWall = edgeRepulsion({ x: 0, y: 500 }, world, 120, 1)
    expect(atRadius.x).toBeCloseTo(0)
    expect(atWall.x).toBeCloseTo(1)
  })

  it('sums both axes in a corner', () => {
    const fish = { x: 10, y: 10 }
    const f = edgeRepulsion(fish, world, 120, 1)
    expect(f.x).toBeGreaterThan(0)
    expect(f.y).toBeGreaterThan(0)
  })
})

describe('anchorForce', () => {
  it('is zero when already at world center', () => {
    const world = { width: 100, height: 100 }
    const fish = { x: 50, y: 50 }
    expect(anchorForce(fish, world, 0.02)).toEqual({ x: 0, y: 0 })
  })

  it('pulls toward center from the top-left quadrant', () => {
    const world = { width: 100, height: 100 }
    const fish = { x: 0, y: 0 }
    const f = anchorForce(fish, world, 1)
    expect(f.x).toBeCloseTo(Math.SQRT1_2)
    expect(f.y).toBeCloseTo(Math.SQRT1_2)
  })

  it('pulls toward center from the bottom-right quadrant (opposite sign)', () => {
    const world = { width: 100, height: 100 }
    const fish = { x: 100, y: 100 }
    const f = anchorForce(fish, world, 1)
    expect(f.x).toBeCloseTo(-Math.SQRT1_2)
    expect(f.y).toBeCloseTo(-Math.SQRT1_2)
  })
})

describe('updateFish', () => {
  const world = { width: 200, height: 200 } // fish placed at center (100,100)

  it('returns a new object and does not mutate the input', () => {
    const fish = { x: 100, y: 100, vx: 1, vy: 0 }
    const snapshot = { ...fish }
    const result = updateFish(fish, [fish], null, world, 1)
    expect(result).not.toBe(fish)
    expect(fish).toEqual(snapshot)
  })

  it('scales the position advance by dt (velocity unaffected)', () => {
    const fish = { x: 100, y: 100, vx: 1, vy: 0 }
    const dt1 = updateFish(fish, [fish], null, world, 1)
    const dt2 = updateFish(fish, [fish], null, world, 2)
    expect(dt2.x - fish.x).toBeCloseTo(2 * (dt1.x - fish.x))
  })

  it('clamps speed to FISH_BASE_SPEED with no predator in range', () => {
    // Large initial velocity should be clamped down to the base speed.
    const fish = { x: 100, y: 100, vx: 50, vy: 0 }
    const result = updateFish(fish, [fish], null, world, 1)
    const speed = Math.hypot(result.vx, result.vy)
    expect(speed).toBeCloseTo(FISH_BASE_SPEED, 1)
  })

  it('ramps toward FISH_FLEE_SPEED as the predator closes to contact', () => {
    const fish = { x: 100, y: 100, vx: 50, vy: 0 }
    const predator = { x: 100.1, y: 100 } // essentially touching
    const result = updateFish(fish, [fish], predator, world, 1)
    const speed = Math.hypot(result.vx, result.vy)
    expect(speed).toBeCloseTo(FISH_FLEE_SPEED, 1)
  })

  it('flee dominates when the predator is within range (default weight 3.0)', () => {
    const fish = { x: 100, y: 100, vx: 0, vy: 0 }
    const predator = { x: 95, y: 100 } // 5px away, well within FLEE_RADIUS
    const result = updateFish(fish, [fish], predator, world, 1)
    // Fish should move away from the predator (+x), not toward world center
    // (which is where it already is, so anchor contributes ~0 anyway).
    expect(result.vx).toBeGreaterThan(0)
  })

  it('a custom fleeRadius overrides the FLEE_RADIUS default', () => {
    const fish = { x: 100, y: 100, vx: 0, vy: 0 }
    const predator = { x: 100 - 95, y: 100 } // distance 95
    // Default FLEE_RADIUS (100) => within range => flee active => faster.
    const withDefault = updateFish(fish, [fish], predator, world, 1)
    // Easy's radius (90) => 95 is outside => flee inactive => base speed only.
    const withEasyRadius = updateFish(fish, [fish], predator, world, 1, 2.5, 90)
    const speedDefault = Math.hypot(withDefault.vx, withDefault.vy)
    const speedEasy = Math.hypot(withEasyRadius.vx, withEasyRadius.vy)
    expect(speedDefault).toBeGreaterThan(speedEasy)
    expect(speedEasy).toBeCloseTo(0, 5) // no forces at all triggered, held still
  })
})

// Session 22 Bug 3: fish were observed escaping world bounds on-device under
// sustained flee-vs-wall pressure (predator cornering a fish against an
// edge). Two-layer fix: retune edgeRepulsion so it actually wins that fight
// (see constants/boids.js), plus a hard positional clamp in updateFish as a
// backstop that holds regardless of tuning. These tests cover both layers.
describe('updateFish — world-bounds clamp (Session 22 Bug 3)', () => {
  const world = { width: 200, height: 200 }

  // A huge INCOMING vx/vy doesn't itself threaten the wall — clampMagnitude
  // already caps speed to maxSpeedFor() (at most FISH_FLEE_SPEED) before the
  // position update ever sees it, regardless of how large the summed forces
  // were. What the hard clamp actually guards against is a large `dt`
  // (frame-rate stall) turning even a normal, already-speed-capped velocity
  // into a big single-frame position jump — the real game loop caps dt at 3,
  // but this clamp holds unconditionally, independent of that cap.
  it('clamps position to the left/top edge and zeros the offending velocity component under a frame-rate stall', () => {
    const fish = { x: 5, y: 5, vx: -9999, vy: -9999 } // speed-clamped before the position step
    const result = updateFish(fish, [fish], null, world, 100) // large dt — stall
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
    expect(result.vx).toBe(0)
    expect(result.vy).toBe(0)
  })

  it('clamps position to the right/bottom edge and zeros the offending velocity component under a frame-rate stall', () => {
    const fish = { x: 195, y: 195, vx: 9999, vy: 9999 }
    const result = updateFish(fish, [fish], null, world, 100)
    expect(result.x).toBe(world.width)
    expect(result.y).toBe(world.height)
    expect(result.vx).toBe(0)
    expect(result.vy).toBe(0)
  })

  it('holds even with dt beyond the real game loop\'s cap of 3, proving it does not depend on that cap', () => {
    const fish = { x: 5, y: 100, vx: -9999, vy: 0 }
    const result = updateFish(fish, [fish], null, world, 10)
    expect(result.x).toBe(0)
  })

  it('corrects a fish that is already out of bounds (e.g. from a future spawn/tuning bug), not just one approaching the edge', () => {
    const fish = { x: -500, y: -500, vx: 0, vy: 0 }
    const result = updateFish(fish, [fish], null, world, 1)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
  })

  it('does not clamp a fish that is legitimately in bounds and moving normally', () => {
    const fish = { x: 100, y: 100, vx: 1, vy: 0 }
    const result = updateFish(fish, [fish], null, world, 1)
    expect(result.x).toBeGreaterThan(0)
    expect(result.x).toBeLessThan(world.width)
  })
})

// Tuning invariant, not a specific-value check: this encodes the actual
// property that caused Bug 3, so a future retune that reintroduces the
// imbalance fails a fast unit test instead of only surfacing on a real
// device. Flee is a constant-strength force within its radius (doesn't ramp
// down near a wall), so edgeRepulsion — which ramps from 0 up to
// EDGE_REPULSION_WEIGHT — can only turn a fish around before it reaches the
// wall if its peak exceeds the worst-case FLEE_WEIGHT across all
// difficulties, with margin for inertia and the smaller flocking forces.
describe('edge repulsion tuning invariant (Session 22 Bug 3)', () => {
  it('EDGE_REPULSION_WEIGHT exceeds the worst-case difficulty FLEE_WEIGHT with margin', () => {
    const worstCaseFleeWeight = Math.max(
      ...Object.values(DIFFICULTY_SETTINGS).map((d) => d.FLEE_WEIGHT),
    )
    expect(EDGE_REPULSION_WEIGHT).toBeGreaterThan(worstCaseFleeWeight * 1.25)
  })
})

// Integration-style: simulate sustained worst-case pressure across many real
// ticks (updateFish, not a re-derivation of it) and confirm the fish never
// leaves world bounds — proving the RETUNED FORCE BALANCE holds in practice,
// not just that the hard clamp catches a violation after the fact. The
// predator repositions every tick to stay just inside fleeRadius on the far
// side, so flee never lets up — the same worst case used to find the new
// tuning values (see constants/boids.js comment).
describe('sustained flee-vs-wall pressure (Session 22 Bug 3, integration)', () => {
  const world = { width: 1000, height: 1000 }

  it('a fish pinned against a wall by constant Hardcore-strength flee pressure stays in bounds', () => {
    const { FLEE_WEIGHT, FLEE_RADIUS } = DIFFICULTY_SETTINGS.hardcore
    let fish = { x: 50, y: 500, vx: 0, vy: 0 }
    for (let i = 0; i < 300; i++) {
      const predator = { x: fish.x + (FLEE_RADIUS - 1), y: 500 }
      fish = updateFish(fish, [fish], predator, world, 1, FLEE_WEIGHT, FLEE_RADIUS)
      expect(fish.x).toBeGreaterThanOrEqual(0)
    }
  })

  it('a fish pinned in a corner by constant Hardcore-strength flee pressure stays in bounds on both axes', () => {
    const { FLEE_WEIGHT, FLEE_RADIUS } = DIFFICULTY_SETTINGS.hardcore
    let fish = { x: 50, y: 50, vx: 0, vy: 0 }
    for (let i = 0; i < 300; i++) {
      const dist = FLEE_RADIUS - 1
      const norm = Math.SQRT1_2 // diagonal unit vector
      const predator = { x: fish.x + dist * norm, y: fish.y + dist * norm }
      fish = updateFish(fish, [fish], predator, world, 1, FLEE_WEIGHT, FLEE_RADIUS)
      expect(fish.x).toBeGreaterThanOrEqual(0)
      expect(fish.y).toBeGreaterThanOrEqual(0)
    }
  })

  it('the fish is turned around by edgeRepulsion well before the hard clamp is needed (tuning holds, not just the backstop)', () => {
    const { FLEE_WEIGHT, FLEE_RADIUS } = DIFFICULTY_SETTINGS.hardcore
    let fish = { x: 50, y: 500, vx: 0, vy: 0 }
    let minX = fish.x
    for (let i = 0; i < 300; i++) {
      const predator = { x: fish.x + (FLEE_RADIUS - 1), y: 500 }
      fish = updateFish(fish, [fish], predator, world, 1, FLEE_WEIGHT, FLEE_RADIUS)
      minX = Math.min(minX, fish.x)
    }
    // A generous buffer above 0 — if this creeps down toward the wall on a
    // future retune, the balance is eroding even though the hard clamp
    // would still technically prevent an escape.
    expect(minX).toBeGreaterThan(EDGE_REPULSION_RADIUS * 0.25)
  })
})

describe('updateSchool', () => {
  // Large world, fish placed near its center — far enough from every wall
  // (EDGE_REPULSION_RADIUS=120) that only separation/cohesion/anchor are in
  // play, keeping the symmetry check below unambiguous.
  const world = { width: 1000, height: 1000 }

  it('returns a new array of the same length without mutating the input', () => {
    const fish = [
      { x: 495, y: 500, vx: 0, vy: 0 },
      { x: 505, y: 500, vx: 0, vy: 0 },
    ]
    const snapshot = fish.map((f) => ({ ...f }))
    const result = updateSchool(fish, null, world, 1)
    expect(result).not.toBe(fish)
    expect(result).toHaveLength(2)
    expect(fish).toEqual(snapshot)
  })

  it('every fish reacts to the same pre-tick snapshot (symmetric separation)', () => {
    const a = { x: 495, y: 500, vx: 0, vy: 0 }
    const b = { x: 505, y: 500, vx: 0, vy: 0 }
    const result = updateSchool([a, b], null, world, 1)
    // Both fish should move apart symmetrically — neither sees the other's
    // already-updated position mid-tick.
    expect(result[0].x).toBeLessThan(a.x)
    expect(result[1].x).toBeGreaterThan(b.x)
  })
})

describe('initFish', () => {
  const world = { width: 1000, height: 800 }

  it('spawns the requested count, clustered near center, within velocity range', () => {
    const count = 25
    const fish = initFish(count, world)
    expect(fish).toHaveLength(count)
    const cx = world.width / 2
    const cy = world.height / 2
    const clusterRadius = Math.min(world.width, world.height) * 0.12
    for (const f of fish) {
      expect(Math.hypot(f.x - cx, f.y - cy)).toBeLessThanOrEqual(clusterRadius + 1e-9)
      expect(Math.abs(f.vx)).toBeLessThanOrEqual(INITIAL_VELOCITY_RANGE)
      expect(Math.abs(f.vy)).toBeLessThanOrEqual(INITIAL_VELOCITY_RANGE)
    }
  })

  it('returns an empty array for count=0', () => {
    expect(initFish(0, world)).toEqual([])
  })
})

// --- O11 equivalence proof (ROADMAP.md O11) ---------------------------------
//
// updateSchoolInto exists purely as a lower-allocation path for the hot loop
// (see boids.js's header comment on it and useBoids.js). This is not "tests
// pass" — it is an actual trajectory comparison: two independent simulations,
// starting from an IDENTICAL cloned initial state and driven by an IDENTICAL
// scripted predator-input and dt sequence, one using the pure map-based path
// this whole file already tests, the other using the buffer-reusing path.
// Every fish's x/y/vx/vy is compared at checkpoints across several hundred
// ticks, not just at the end, so a divergence that self-corrects (or one that
// only shows up transiently) can't hide. Equality is exact (not tolerance) —
// both paths run the identical arithmetic in the identical order (updateFish
// and updateFishInto are the same expressions, only differing in whether the
// result is returned as a new object or written into `out`), so floating
// point should produce bit-identical results, not merely close ones; asserting
// exact equality is what would actually catch a subtle reordering bug.
describe('updateSchoolInto — equivalence with updateSchool (O11 proof)', () => {
  it('produces identical fish trajectories to the pure updateSchool over 500 ticks of scripted, varying predator movement and dt', () => {
    const world = { width: 2000, height: 1500 }
    const seedFish = initFish(50, world)

    let pureFish = seedFish.map((f) => ({ ...f }))
    let optFish = seedFish.map((f) => ({ ...f }))
    let optBuffer = optFish.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }))

    let purePredator = { x: world.width / 2, y: world.height / 2, vx: 0, vy: 0, angle: 0 }
    let optPredator = { x: world.width / 2, y: world.height / 2, vx: 0, vy: 0, angle: 0 }

    const TICKS = 500
    const CHECK_EVERY = 25

    for (let t = 0; t < TICKS; t++) {
      // Deterministic scripted input (no Math.random) — a joystick vector
      // that sweeps direction over time, so the predator's path (and thus
      // which forces dominate for which fish) varies across the run instead
      // of settling into one static configuration.
      const angle = (t / TICKS) * Math.PI * 6
      const input = { dx: Math.cos(angle), dy: Math.sin(angle), isJoystick: true }
      // Varying dt exercises the frame-rate-independence path identically on
      // both sides too, not just a fixed dt=1.
      const dt = 1 + 0.4 * Math.sin(t * 0.31)

      purePredator = stepPredator(purePredator, input, world, dt)
      optPredator = stepPredator(optPredator, input, world, dt)

      pureFish = updateSchool(pureFish, purePredator, world, dt)
      updateSchoolInto(optBuffer, optFish, optPredator, world, dt)
      const swap = optFish
      optFish = optBuffer
      optBuffer = swap

      if (t % CHECK_EVERY === 0 || t === TICKS - 1) {
        expect(optPredator).toEqual(purePredator)
        for (let i = 0; i < pureFish.length; i++) {
          expect(optFish[i].x, `fish[${i}].x at tick ${t}`).toBe(pureFish[i].x)
          expect(optFish[i].y, `fish[${i}].y at tick ${t}`).toBe(pureFish[i].y)
          expect(optFish[i].vx, `fish[${i}].vx at tick ${t}`).toBe(pureFish[i].vx)
          expect(optFish[i].vy, `fish[${i}].vy at tick ${t}`).toBe(pureFish[i].vy)
        }
      }
    }
  })

  it('does not mutate the fish array passed in as `fish` (only writes into `next`)', () => {
    const world = { width: 1000, height: 1000 }
    const fish = [
      { x: 495, y: 500, vx: 0, vy: 0 },
      { x: 505, y: 500, vx: 0, vy: 0 },
    ]
    const snapshot = fish.map((f) => ({ ...f }))
    const next = fish.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }))
    updateSchoolInto(next, fish, null, world, 1)
    expect(fish).toEqual(snapshot)
  })
})
