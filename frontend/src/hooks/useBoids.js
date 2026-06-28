// useBoids.js — owns the simulation state (fish + predator) as refs.
//
// State lives in refs, never React state, so the game loop can mutate it every
// frame without re-rendering (CONTRIBUTING.md "Game loop"). The actual math
// lives in game/boids.js; this hook is just stateful glue.

import { useRef, useCallback } from 'react'
import { initFish, updateSchool } from '../game/boids.js'

export function useBoids() {
  const fishRef = useRef([])
  const predatorRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, angle: 0 })
  const worldRef = useRef({ width: 0, height: 0 })

  // Build the school clustered at world center (count from constants).
  const init = useCallback((count, world) => {
    worldRef.current = world
    fishRef.current = initFish(count, world)
    predatorRef.current = {
      x: world.width / 2,
      y: world.height / 2,
      vx: 0,
      vy: 0,
      angle: 0,
    }
  }, [])

  // Run one simulation tick using the current predator (set by App each frame).
  // `dt` is the frame-normalized delta; `fleeWeight`/`fleeRadius` come from the
  // selected difficulty (App locks them at game start). Returns the updated array.
  const update = useCallback((dt = 1, fleeWeight, fleeRadius) => {
    fishRef.current = updateSchool(
      fishRef.current,
      predatorRef.current,
      worldRef.current,
      dt,
      fleeWeight,
      fleeRadius,
    )
    return fishRef.current
  }, [])

  // Remove a caught fish by index; returns the updated array.
  const catchFish = useCallback((index) => {
    fishRef.current = fishRef.current.filter((_, i) => i !== index)
    return fishRef.current
  }, [])

  return { fishRef, predatorRef, worldRef, init, update, catchFish }
}
