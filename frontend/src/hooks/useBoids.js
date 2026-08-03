// useBoids.js — owns the simulation state (fish + predator) as refs.
//
// State lives in refs, never React state, so the game loop can mutate it every
// frame without re-rendering (CONTRIBUTING.md "Game loop"). The actual math
// lives in game/boids.js; this hook is just stateful glue.

import { useRef, useCallback } from 'react'
import { initFish, updateSchoolInto } from '../game/boids.js'

function makeBuffer(length) {
  const buf = new Array(length)
  for (let i = 0; i < length; i++) buf[i] = { x: 0, y: 0, vx: 0, vy: 0 }
  return buf
}

export function useBoids() {
  const fishRef = useRef([])
  // O11: the tick's OUTPUT lands here and is swapped with fishRef.current —
  // ping-ponging two arrays/object-sets instead of allocating a fresh one
  // every tick. See boids.js's updateFishInto/updateSchoolInto header comment
  // for why this (double buffering), not same-array in-place mutation, is the
  // safe way to eliminate this allocation.
  const bufferRef = useRef([])
  const predatorRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, angle: 0 })
  const worldRef = useRef({ width: 0, height: 0 })

  // Build the school clustered at world center (count from constants).
  const init = useCallback((count, world) => {
    worldRef.current = world
    fishRef.current = initFish(count, world)
    bufferRef.current = makeBuffer(count)
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
    const fish = fishRef.current
    let buffer = bufferRef.current
    // A catch shrank the school since the last tick (App.jsx assigns
    // resolveCatches' survivors directly into fishRef.current, outside this
    // hook) — rebuild the buffer to match rather than reallocating every
    // tick. This only runs on a catch, not every frame.
    if (buffer.length !== fish.length) buffer = makeBuffer(fish.length)

    updateSchoolInto(buffer, fish, predatorRef.current, worldRef.current, dt, fleeWeight, fleeRadius)
    bufferRef.current = fish // this tick's input becomes next tick's buffer
    fishRef.current = buffer
    return fishRef.current
  }, [])

  // Remove a caught fish by index; returns the updated array.
  const catchFish = useCallback((index) => {
    fishRef.current = fishRef.current.filter((_, i) => i !== index)
    return fishRef.current
  }, [])

  return { fishRef, predatorRef, worldRef, init, update, catchFish }
}
