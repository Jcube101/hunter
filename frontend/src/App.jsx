// App.jsx — screen router + game orchestrator.
//
// Screen states: start -> playing -> paused -> end. The <canvas> is always
// mounted (behind the UI) so input listeners and its 2D context persist across
// state changes; React screens render as overlays on top of it.
//
// The game loop (onFrameUpdate/onFrameDraw) runs entirely on refs and the
// canvas — it never calls setState except on meaningful events (catch -> score,
// each whole second -> timer). This is the React/Canvas boundary from SPEC.md.

import { useCallback, useEffect, useRef, useState } from 'react'

import StartScreen from './components/StartScreen.jsx'
import EndScreen from './components/EndScreen.jsx'
import PauseScreen from './components/PauseScreen.jsx'
import HUD from './components/HUD.jsx'
import Minimap from './components/Minimap.jsx'

import { useBoids } from './hooks/useBoids.js'
import { useInput } from './hooks/useInput.js'
import { useFullscreen } from './hooks/useFullscreen.js'
import { useGameLoop } from './hooks/useGameLoop.js'
import { useSound } from './hooks/useSound.js'

import { updateCamera } from './game/camera.js'
import { drawBackground, drawFish, drawShark, drawMinimap, drawJoystick } from './game/renderer.js'
import { spawnParticles, updateParticles, drawParticles } from './game/particles.js'
import { theme } from './constants/theme.js'
import {
  FISH_COUNT_MOBILE,
  FISH_COUNT_DESKTOP,
  MOBILE_BREAKPOINT,
  WORLD_WIDTH_MULTIPLIER,
  WORLD_HEIGHT_MULTIPLIER,
  GAME_DURATION,
  DIFFICULTY_SPEEDS,
  DEFAULT_DIFFICULTY,
  HITBOX_RADIUS,
  SHARK_MOUTH_OFFSET,
  SHAKE_FRAMES,
  SHAKE_OFFSET,
  ROTATION_VELOCITY_THRESHOLD,
  MINIMAP_VIEWPORT_FRACTION,
  GRACE_PERIOD,
} from './constants/boids.js'

const PB_KEY = 'hunter_pb'
const DIFFICULTY_KEY = 'hunter_difficulty'

export default function App() {
  const [screen, setScreen] = useState('start') // start | playing | paused | end
  const stateRef = useRef('start')
  const setGameState = useCallback((s) => {
    stateRef.current = s
    setScreen(s)
  }, [])

  // Difficulty (shark speed only). Persisted; locked into sharkSpeedRef at game
  // start so it can't change mid-game.
  const [difficulty, setDifficulty] = useState(() => {
    const stored = localStorage.getItem(DIFFICULTY_KEY)
    return stored && DIFFICULTY_SPEEDS[stored] ? stored : DEFAULT_DIFFICULTY
  })
  const selectDifficulty = useCallback((d) => {
    if (!DIFFICULTY_SPEEDS[d]) return
    setDifficulty(d)
    localStorage.setItem(DIFFICULTY_KEY, d)
  }, [])
  const sharkSpeedRef = useRef(DIFFICULTY_SPEEDS[DEFAULT_DIFFICULTY])

  // Canvas + minimap elements
  const canvasRef = useRef(null)
  const minimapRef = useRef(null)
  const cameraRef = useRef(null)
  const [minimapSize, setMinimapSize] = useState({ width: 0, height: 0 })
  const dprRef = useRef(1) // devicePixelRatio — HiDPI backing-store scale
  const viewportRef = useRef({ width: 0, height: 0 }) // viewport in CSS pixels

  // Simulation state (refs). `tickBoids` advances the school one frame using
  // the current predator (already updated by movePredator each frame).
  const { fishRef, predatorRef, worldRef, init, update: tickBoids } = useBoids()

  // Game refs that must not trigger re-renders each frame
  const scoreRef = useRef(0)
  const timeLeftRef = useRef(GAME_DURATION)
  const lastSecondRef = useRef(GAME_DURATION)
  const particlesRef = useRef([])
  const shakeRef = useRef(0)
  // Catches are disabled during a brief grace period at game start (Fix 3).
  const graceRef = useRef(true)
  const graceTimerRef = useRef(null)

  // HUD display state (synced only on events)
  const [displayScore, setDisplayScore] = useState(0)
  const [displayTime, setDisplayTime] = useState(GAME_DURATION)

  // End-screen data
  const [endData, setEndData] = useState({ score: 0, personalBest: 0, isNewPB: false })

  // Input + fullscreen
  const { inputPosRef, joystickRef } = useInput(canvasRef, cameraRef)
  const handleFullscreenExit = useCallback(() => {
    // System/back-gesture fullscreen exit during play -> pause.
    if (stateRef.current === 'playing') pauseGame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const { enter, exit } = useFullscreen(handleFullscreenExit)

  // Sound (HTML5 Audio). Kept in a ref so the rAF loop can trigger SFX without
  // re-subscribing; the lifecycle handlers use it too.
  const sound = useSound()
  const soundRef = useRef(sound)
  soundRef.current = sound

  // Size the main canvas backing store for HiDPI: CSS pixels * devicePixelRatio.
  // The 2D context is scaled (in onFrameDraw) so all drawing + game coordinates
  // stay in CSS pixels. Re-run on init and on any resize / fullscreen change.
  const sizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const cssW = canvas.offsetWidth || window.innerWidth
    const cssH = canvas.offsetHeight || window.innerHeight
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    dprRef.current = dpr
    viewportRef.current = { width: cssW, height: cssH }
  }, [])

  // --- Predator movement -----------------------------------------------------
  const movePredator = useCallback((dt) => {
    const p = predatorRef.current
    const world = worldRef.current
    const input = inputPosRef.current

    let vx = 0
    let vy = 0
    if (input && input.isJoystick) {
      // Joystick (mobile): velocity ∝ stick displacement. |dx,dy| in [0,1], so
      // the shark crawls near center and hits full speed at the rim.
      vx = input.dx * sharkSpeedRef.current * dt
      vy = input.dy * sharkSpeedRef.current * dt
    } else {
      // Mouse (desktop): move toward the world-space target, never overshoot.
      const target = input || { x: p.x, y: p.y }
      const dx = target.x - p.x
      const dy = target.y - p.y
      const dist = Math.hypot(dx, dy)
      if (dist > 0) {
        const step = Math.min(sharkSpeedRef.current * dt, dist)
        vx = (dx / dist) * step
        vy = (dy / dist) * step
      }
    }

    let nx = p.x + vx
    let ny = p.y + vy
    // Hard stop at world bounds (GDD.md): zero the velocity that hit the wall.
    if (nx < 0) { nx = 0; vx = 0 } else if (nx > world.width) { nx = world.width; vx = 0 }
    if (ny < 0) { ny = 0; vy = 0 } else if (ny > world.height) { ny = world.height; vy = 0 }

    let angle = p.angle
    if (Math.hypot(vx, vy) > ROTATION_VELOCITY_THRESHOLD) angle = Math.atan2(vy, vx)

    predatorRef.current = { x: nx, y: ny, vx, vy, angle }
  }, [predatorRef, worldRef, inputPosRef])

  // --- Per-frame update ------------------------------------------------------
  // dt = frame-normalized delta (motion), dtSeconds = wall-clock (timer).
  const onFrameUpdate = useCallback((dt, dtSeconds) => {
    movePredator(dt)
    tickBoids(dt)

    cameraRef.current = updateCamera(predatorRef.current, worldRef.current, viewportRef.current)

    // Catch detection (disabled during the spawn grace period — Fix 3).
    if (!graceRef.current) {
      const p = predatorRef.current
      const mouthX = p.x + Math.cos(p.angle) * SHARK_MOUTH_OFFSET
      const mouthY = p.y + Math.sin(p.angle) * SHARK_MOUTH_OFFSET
      const survivors = []
      let caughtAny = false
      for (const f of fishRef.current) {
        if (Math.hypot(mouthX - f.x, mouthY - f.y) < HITBOX_RADIUS) {
          particlesRef.current = particlesRef.current.concat(spawnParticles(f.x, f.y))
          scoreRef.current += 1
          caughtAny = true
        } else {
          survivors.push(f)
        }
      }
      if (caughtAny) {
        fishRef.current = survivors
        shakeRef.current = SHAKE_FRAMES
        soundRef.current.playCatch() // after grace (catch block is grace-gated)
        setDisplayScore(scoreRef.current) // event-driven state sync
      }
    }

    particlesRef.current = updateParticles(particlesRef.current, dt)

    // Timer uses wall-clock seconds (unchanged). Sync display on second boundaries.
    timeLeftRef.current -= dtSeconds
    const whole = Math.max(0, Math.ceil(timeLeftRef.current))
    if (whole !== lastSecondRef.current) {
      lastSecondRef.current = whole
      setDisplayTime(whole)
    }

    if (timeLeftRef.current <= 0 || fishRef.current.length === 0) {
      endGame()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movePredator, tickBoids])

  // --- Per-frame draw --------------------------------------------------------
  const onFrameDraw = useCallback(() => {
    const canvas = canvasRef.current
    const cam = cameraRef.current
    if (!canvas || !cam) return
    const ctx = canvas.getContext('2d')
    const dpr = dprRef.current
    const vp = viewportRef.current

    // Base transform carries the HiDPI scale; all drawing below is in CSS pixels.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, vp.width, vp.height)

    // Background fills the whole viewport first so screen shake never exposes a gap.
    drawBackground(ctx, vp, theme)

    ctx.save()
    if (shakeRef.current > 0) {
      ctx.translate(
        (Math.random() * 2 - 1) * SHAKE_OFFSET,
        (Math.random() * 2 - 1) * SHAKE_OFFSET,
      )
      shakeRef.current -= 1
    }
    drawFish(ctx, fishRef.current, cam, theme)
    drawShark(ctx, predatorRef.current, cam, theme)
    drawParticles(ctx, particlesRef.current, cam)
    ctx.restore()

    // Virtual joystick overlay — mobile only, screen-space (after shake restore
    // so it never jitters). Base transform still carries the HiDPI scale.
    if (vp.width < MOBILE_BREAKPOINT) {
      drawJoystick(ctx, joystickRef.current, vp)
    }

    // Minimap on its own canvas (no shake).
    const mm = minimapRef.current
    if (mm) {
      drawMinimap(mm.getContext('2d'), fishRef.current, predatorRef.current, worldRef.current, theme)
    }
  }, [fishRef, predatorRef, worldRef, joystickRef])

  const { start, stop } = useGameLoop(onFrameUpdate, onFrameDraw)

  // --- Game lifecycle --------------------------------------------------------
  const startGame = useCallback(async () => {
    soundRef.current.playAmbient() // unlock audio inside the Play gesture, start drone

    // Lock the difficulty speed for this game (selector is start-screen only).
    sharkSpeedRef.current = DIFFICULTY_SPEEDS[difficulty]

    await enter() // fullscreen + landscape lock (best effort)

    sizeCanvas() // HiDPI backing store + viewportRef (CSS pixels)
    const vp = viewportRef.current

    const world = {
      width: vp.width * WORLD_WIDTH_MULTIPLIER,
      height: vp.height * WORLD_HEIGHT_MULTIPLIER,
    }
    const count = vp.width < MOBILE_BREAKPOINT ? FISH_COUNT_MOBILE : FISH_COUNT_DESKTOP
    init(count, world)

    // Minimap sized to ~15% viewport width, proportional to world aspect.
    const mmW = Math.round(vp.width * MINIMAP_VIEWPORT_FRACTION)
    const mmH = Math.round(mmW * (world.height / world.width))
    setMinimapSize({ width: mmW, height: mmH })

    // Reset game refs.
    scoreRef.current = 0
    timeLeftRef.current = GAME_DURATION
    lastSecondRef.current = GAME_DURATION
    particlesRef.current = []
    shakeRef.current = 0
    inputPosRef.current = { x: world.width / 2, y: world.height / 2 }
    cameraRef.current = updateCamera(predatorRef.current, world, vp)

    // Spawn grace period: disable catches so the school scatters first (Fix 3).
    graceRef.current = true
    clearTimeout(graceTimerRef.current)
    graceTimerRef.current = setTimeout(() => { graceRef.current = false }, GRACE_PERIOD)

    setDisplayScore(0)
    setDisplayTime(GAME_DURATION)
    setGameState('playing')
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enter, init, start, setGameState, sizeCanvas, difficulty])

  function pauseGame() {
    stop()
    soundRef.current.stopAmbient()
    setGameState('paused')
  }

  const resumeGame = useCallback(async () => {
    await enter()
    soundRef.current.playAmbient()
    setGameState('playing')
    start()
  }, [enter, start, setGameState])

  const quitGame = useCallback(() => {
    stop()
    exit()
    soundRef.current.stopAmbient()
    setGameState('start')
  }, [stop, exit, setGameState])

  function endGame() {
    stop()
    exit()
    soundRef.current.stopAmbient()
    const stored = parseInt(localStorage.getItem(PB_KEY) ?? '-1', 10)
    const prevPB = Number.isNaN(stored) ? -1 : stored
    const score = scoreRef.current
    const isNewPB = score > prevPB
    if (isNewPB) localStorage.setItem(PB_KEY, String(score))
    // Game-over tone always; on a new PB, follow it with a congrats sting.
    soundRef.current.playEnd()
    if (isNewPB) setTimeout(() => soundRef.current.playCongrats(), 800)
    setEndData({ score, personalBest: isNewPB ? score : prevPB, isNewPB })
    setGameState('end')
  }

  // Escape pauses on desktop (also covers the case where fullscreen was denied).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && stateRef.current === 'playing') pauseGame()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-apply HiDPI sizing when the viewport changes (incl. entering/exiting
  // fullscreen). World dimensions stay fixed (GDD.md) — only the backing store
  // and the CSS-pixel viewport used by the camera are refreshed (Fix 2).
  useEffect(() => {
    const onResize = () => {
      if (stateRef.current === 'playing' || stateRef.current === 'paused') sizeCanvas()
    }
    window.addEventListener('resize', onResize)
    document.addEventListener('fullscreenchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      document.removeEventListener('fullscreenchange', onResize)
    }
  }, [sizeCanvas])

  // Dev-only test hook: expose live game refs for browser verification.
  // Vite replaces import.meta.env.DEV with false in production and strips this.
  useEffect(() => {
    if (import.meta.env.DEV) {
      window.__hunter = {
        stateRef,
        scoreRef,
        timeLeftRef,
        shakeRef,
        predatorRef,
        fishRef,
        worldRef,
        cameraRef,
        inputPosRef,
        sharkSpeedRef,
      }
    }
  }, [predatorRef, fishRef, worldRef, inputPosRef])

  const isGameView = screen === 'playing' || screen === 'paused'

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Always-mounted game canvas, behind the UI overlays. */}
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />

      {isGameView && <Minimap ref={minimapRef} width={minimapSize.width} height={minimapSize.height} />}
      {screen === 'playing' && (
        <HUD score={displayScore} timeLeft={displayTime} difficulty={difficulty} />
      )}

      {screen === 'start' && (
        <StartScreen
          onPlay={startGame}
          onLeaderboard={() => {}} // start-screen leaderboard overlay — not in v1
          muted={sound.muted}
          onToggleMute={sound.toggleMute}
          difficulty={difficulty}
          onSelectDifficulty={selectDifficulty}
        />
      )}
      {screen === 'paused' && <PauseScreen onResume={resumeGame} onQuit={quitGame} />}
      {screen === 'end' && (
        <EndScreen
          score={endData.score}
          personalBest={endData.personalBest}
          isNewPB={endData.isNewPB}
          difficulty={difficulty}
          onPlayAgain={startGame}
        />
      )}
    </div>
  )
}
