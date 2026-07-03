// AttractBackground.jsx — decorative, autonomous Boids simulation drawn BEHIND
// the start screen (roadmap "attract mode"). Purely cosmetic:
//   - no score, no timer, no leaderboard, no personal best, no platform logic
//   - no sound (and browsers block autoplay pre-interaction anyway)
//   - no player input; the shark drives itself (game/attract.js)
//
// Fully self-contained: it owns its own <canvas> + requestAnimationFrame loop and
// never touches the real game's useGameLoop / useBoids / camera, so it can't leak
// into game state. It reuses the pure Boids math (via stepAttract) and the shared
// drawFish/drawShark sprites unchanged.
//
// Lifecycle: mounted only while the start screen is visible (App gates it on
// screen === 'start'), so it stops on play and restarts on return automatically.
// It also pauses itself when the tab is hidden (visibilitychange) to save CPU.
// pointer-events-none guarantees it never intercepts taps meant for the UI.

import { useEffect, useRef } from 'react'
import { theme } from '../constants/theme.js'
import { drawFish, drawShark } from '../game/renderer.js'
import { initAttractFish, initAttractShark, stepAttract } from '../game/attract.js'
import { FLEE_RADIUS } from '../constants/boids.js'

export default function AttractBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')

    // All sim state is local to this effect — never React state, never shared.
    const world = { width: 0, height: 0 }
    let dpr = 1
    let fish = []
    let shark = null
    let raf = 0
    let last = 0
    let running = false

    const size = () => {
      dpr = window.devicePixelRatio || 1
      const w = canvas.offsetWidth || window.innerWidth
      const h = canvas.offsetHeight || window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      world.width = w
      world.height = h
    }

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = theme.background
      ctx.fillRect(0, 0, world.width, world.height)
      const fr2 = FLEE_RADIUS * FLEE_RADIUS
      for (const f of fish) {
        const dx = f.x - shark.x
        const dy = f.y - shark.y
        // No glow ({}) here on purpose — shadowBlur per-fish is the costly path,
        // and this is an idle background where smoothness matters most.
        drawFish(ctx, f.x, f.y, Math.atan2(f.vy, f.vx), dx * dx + dy * dy < fr2, {})
      }
      drawShark(ctx, shark.x, shark.y, shark.angle)
    }

    // Frame-normalized delta (~1.0 at 60Hz, capped at 3), mirroring useGameLoop so
    // motion stays refresh-rate independent and can't spiral after a stall.
    const loop = (now) => {
      if (!running) return
      const elapsed = last ? now - last : 1000 / 60
      last = now
      const dt = Math.min(elapsed / (1000 / 60), 3)
      const stepped = stepAttract(fish, shark, world, dt)
      fish = stepped.fish
      shark = stepped.shark
      draw()
      raf = requestAnimationFrame(loop)
    }

    const startLoop = () => {
      if (running) return
      running = true
      last = 0
      raf = requestAnimationFrame(loop)
    }
    const stopLoop = () => {
      running = false
      cancelAnimationFrame(raf)
    }

    const onResize = () => size() // edges pull strays back in; no reseed needed
    const onVisibility = () => (document.hidden ? stopLoop() : startLoop())

    size()
    fish = initAttractFish(world)
    shark = initAttractShark(world)
    draw() // paint the first frame synchronously so it's present on first paint
    if (!document.hidden) startLoop()

    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopLoop()
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
    />
  )
}
