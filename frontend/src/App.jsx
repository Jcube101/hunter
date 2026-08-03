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
import AttractBackground from './components/AttractBackground.jsx'
import EndScreen from './components/EndScreen.jsx'
import { LeaderboardOverlay } from './components/Leaderboard.jsx'
import PauseScreen from './components/PauseScreen.jsx'
import Tutorial from './components/Tutorial.jsx'
import { Settings } from './components/Settings.jsx'
import { RotationToast } from './components/RotationToast.jsx'
import HUD from './components/HUD.jsx'
import Minimap from './components/Minimap.jsx'

import { useBoids } from './hooks/useBoids.js'
import { useInput } from './hooks/useInput.js'
import { useFullscreen } from './hooks/useFullscreen.js'
import { useGameLoop } from './hooks/useGameLoop.js'
import { useSound } from './hooks/useSound.js'

import { updateCamera, worldToScreen } from './game/camera.js'
import { drawBackground, drawSchool, drawShark, drawMinimap } from './game/renderer.js'
import { spawnParticles, updateParticlesInPlace, drawParticles } from './game/particles.js'
import { stepPredatorInto, resolveCatches } from './game/predator.js'
import { isNewPersonalBest } from './utils/personalBest.js'
import { theme } from './constants/theme.js'
import {
  FISH_COUNT,
  WORLD_WIDTH_MULTIPLIER,
  WORLD_HEIGHT_MULTIPLIER,
  GAME_DURATION,
  SHARK_SPEED,
  DIFFICULTY_SETTINGS,
  DEFAULT_DIFFICULTY,
  SHAKE_FRAMES,
  SHAKE_OFFSET,
  MINIMAP_VIEWPORT_FRACTION,
  GRACE_PERIOD,
  MAX_DEVICE_PIXEL_RATIO,
} from './constants/boids.js'

const DIFFICULTY_KEY = 'hunter_difficulty'
const TUTORIAL_KEY = 'hunter_tutorial_seen'

export default function App() {
  const [screen, setScreen] = useState('start') // start | playing | paused | end
  // First-play tutorial overlay (shown over the start screen). Auto-shows once
  // on first visit; re-triggerable via the start screen's "How to play" link.
  const [showTutorial, setShowTutorial] = useState(
    () => localStorage.getItem(TUTORIAL_KEY) !== 'true',
  )
  const [showSettings, setShowSettings] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const stateRef = useRef('start')
  const setGameState = useCallback((s) => {
    stateRef.current = s
    setScreen(s)
  }, [])

  // Difficulty scales fish flee behavior (not shark speed). Persisted; the flee
  // settings are locked into fleeSettingsRef at game start so they can't change
  // mid-game.
  const [difficulty, setDifficulty] = useState(() => {
    const stored = localStorage.getItem(DIFFICULTY_KEY)
    return stored && DIFFICULTY_SETTINGS[stored] ? stored : DEFAULT_DIFFICULTY
  })
  const selectDifficulty = useCallback((d) => {
    if (!DIFFICULTY_SETTINGS[d]) return
    setDifficulty(d)
    localStorage.setItem(DIFFICULTY_KEY, d)
  }, [])
  const fleeSettingsRef = useRef(DIFFICULTY_SETTINGS[DEFAULT_DIFFICULTY])
  // Round's difficulty, locked at game start — same reasoning as
  // fleeSettingsRef, and required for the same structural reason (Session 22
  // Bug 1): onFrameUpdate is memoized once for the component's whole
  // lifetime (movePredator/tickBoids never change identity), so endGame —
  // called from inside it — closes over whichever `difficulty` existed on
  // the FIRST render, forever. Reading difficultyRef.current instead (set
  // fresh in startGame, which DOES track live difficulty via its own deps)
  // avoids that stale-closure read entirely, rather than trying to widen
  // onFrameUpdate's deps and fight its memoization.
  const difficultyRef = useRef(difficulty)
  // Glow on fleeing fish is permanent (Session 15 removed the toggle) — the
  // renderer applies it unconditionally, so there's no glow state here.

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
  // DPR is clamped (ROADMAP.md O8) — the art is flat fills, not fine detail,
  // so a DPR above MAX_DEVICE_PIXEL_RATIO buys negligible visual quality for
  // a large pixel-count cost on high-DPR phones.
  const sizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO)
    const cssW = canvas.offsetWidth || window.innerWidth
    const cssH = canvas.offsetHeight || window.innerHeight
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    dprRef.current = dpr
    viewportRef.current = { width: cssW, height: cssH }
  }, [])

  // --- Predator movement -----------------------------------------------------
  // Math lives in game/predator.js (extracted Session 18 for unit testing) —
  // this is just ref glue, identical to the previous inline implementation.
  // Mutates predatorRef.current in place (ROADMAP.md O11) instead of
  // allocating a new object every frame; safe because nothing reads a
  // pre-move snapshot of the predator later in the same tick (tickBoids runs
  // AFTER this and is meant to see the post-move position, exactly as
  // before, when this replaced predatorRef.current outright).
  const movePredator = useCallback((dt) => {
    stepPredatorInto(predatorRef.current, predatorRef.current, inputPosRef.current, worldRef.current, dt)
  }, [predatorRef, worldRef, inputPosRef])

  // --- Per-frame update ------------------------------------------------------
  // dt = frame-normalized delta (motion), dtSeconds = wall-clock (timer).
  const onFrameUpdate = useCallback((dt, dtSeconds) => {
    movePredator(dt)
    tickBoids(dt, fleeSettingsRef.current.FLEE_WEIGHT, fleeSettingsRef.current.FLEE_RADIUS)

    cameraRef.current = updateCamera(predatorRef.current, worldRef.current, viewportRef.current)

    // Catch detection (disabled during the spawn grace period — Fix 3).
    // Math lives in game/predator.js (extracted Session 18 for unit testing).
    if (!graceRef.current) {
      const { survivors, caught } = resolveCatches(fishRef.current, predatorRef.current)
      if (caught.length > 0) {
        for (const f of caught) {
          particlesRef.current = particlesRef.current.concat(spawnParticles(f.x, f.y))
        }
        scoreRef.current += caught.length
        fishRef.current = survivors
        shakeRef.current = SHAKE_FRAMES
        soundRef.current.playCatch() // after grace (catch block is grace-gated)
        setDisplayScore(scoreRef.current) // event-driven state sync
      }
    }

    // Mutates + compacts particlesRef.current in place (ROADMAP.md O11)
    // instead of allocating a new array and a spread-copied object per
    // particle every frame; each particle's advance only reads its own
    // previous state, so unlike boids there's no snapshot-ordering hazard.
    updateParticlesInPlace(particlesRef.current, dt)

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
    drawSchool(ctx, fishRef.current, cam, predatorRef.current, fleeSettingsRef.current.FLEE_RADIUS)
    const ss = worldToScreen(predatorRef.current.x, predatorRef.current.y, cam)
    drawShark(ctx, ss.x, ss.y, predatorRef.current.angle)
    drawParticles(ctx, particlesRef.current, cam)
    ctx.restore()

    // Minimap on its own canvas (no shake).
    const mm = minimapRef.current
    if (mm) {
      drawMinimap(mm.getContext('2d'), fishRef.current, predatorRef.current, worldRef.current, theme)
    }
  }, [fishRef, predatorRef, worldRef])

  const { start, stop } = useGameLoop(onFrameUpdate, onFrameDraw)

  // --- Game lifecycle --------------------------------------------------------
  const startGame = useCallback(async () => {
    soundRef.current.playAmbient() // unlock audio inside the Play gesture, start ambient

    // Lock the difficulty's fish-flee settings for this game (selector is
    // start-screen only). Shark speed is constant (SHARK_SPEED) in all modes.
    fleeSettingsRef.current = DIFFICULTY_SETTINGS[difficulty]
    // Lock the difficulty itself too — endGame() reads this ref rather than
    // the live `difficulty` state (Bug 1 — see difficultyRef's declaration).
    difficultyRef.current = difficulty

    await enter() // fullscreen + landscape lock (best effort)

    sizeCanvas() // HiDPI backing store + viewportRef (CSS pixels)
    const vp = viewportRef.current

    const world = {
      width: vp.width * WORLD_WIDTH_MULTIPLIER,
      height: vp.height * WORLD_HEIGHT_MULTIPLIER,
    }
    const count = FISH_COUNT[difficulty]
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

  // Ambient keeps looping seamlessly across start <-> playing <-> paused; only a
  // game-over stops it (endGame). So pause/resume/quit don't touch the ambient.
  function pauseGame() {
    stop()
    setGameState('paused')
  }

  const resumeGame = useCallback(async () => {
    await enter()
    setGameState('playing')
    start()
  }, [enter, start, setGameState])

  const quitGame = useCallback(() => {
    stop()
    exit()
    setGameState('start')
  }, [stop, exit, setGameState])

  function endGame() {
    stop()
    exit()
    soundRef.current.stopAmbient()
    // Per-difficulty PB — modes are incomparable, so each has its own key. The
    // old global hunter_pb is retired (never read or written). Default 0, so a
    // score only counts as a new PB when it beats the matching difficulty's best.
    // Reads difficultyRef, NOT the live `difficulty` state — see its
    // declaration for why (Session 22 Bug 1: endGame is called from a
    // permanently-memoized closure that would otherwise freeze `difficulty`
    // at whatever it was on App's first render).
    const pbKey = `hunter_pb_${difficultyRef.current}`
    const currentPB = parseInt(localStorage.getItem(pbKey) || '0', 10)
    const score = scoreRef.current
    const isNewPB = isNewPersonalBest(score, currentPB)
    if (isNewPB) localStorage.setItem(pbKey, String(score))
    // Game-over tone always; on a new PB, follow it with a congrats sting.
    soundRef.current.playEnd()
    if (isNewPB) setTimeout(() => soundRef.current.playCongrats(), 800)
    setEndData({ score, personalBest: isNewPB ? score : currentPB, isNewPB })
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

  // Pause on visibilitychange, independent of the fullscreen-exit pause above
  // (ROADMAP.md O21/A2). The fullscreen path is the only mobile pause trigger
  // today, and it depends on the back/app-switch gesture firing
  // `fullscreenchange` — true in a browser tab, not guaranteed in a real
  // `standalone` PWA session where the app may already be fullscreen or the
  // gesture may background it directly. visibilitychange fires either way, so
  // this is a second, independent path to the same pauseGame(), not a
  // replacement — whichever fires first wins; the other is then a no-op
  // (pauseGame only acts while stateRef.current === 'playing'). It also
  // shrinks A2's exposure: if the round is paused before a giant frame gap
  // can occur, the dtSeconds clamp (useGameLoop.js) never needs to fire.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && stateRef.current === 'playing') pauseGame()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
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

  // Ambient loop on the start screen (and seamlessly onward — playAmbient never
  // restarts a loop that's already running). Fires on every entry to 'start'.
  useEffect(() => {
    if (screen === 'start') soundRef.current.playAmbient()
  }, [screen])

  // Autoplay unlock: browsers block audio before any user gesture, so a fresh
  // page load can't start the ambient on its own. The first interaction anywhere
  // resumes it (idempotent — playAmbient no-ops if already playing or audio off).
  useEffect(() => {
    const unlock = () => soundRef.current.playAmbient()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

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
        joystickRef,
        fleeSettingsRef,
        sharkSpeed: SHARK_SPEED,
      }
    }
  }, [predatorRef, fishRef, worldRef, inputPosRef])

  const isGameView = screen === 'playing' || screen === 'paused'

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Always-mounted game canvas (keeps its 2D context + listeners across
          screens), but hidden whenever we're not actively playing/paused so the
          frozen game never shows behind the start/end/tutorial overlays. The
          body's navy (#0a1628) backs those screens. */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full"
        style={{ visibility: isGameView ? 'visible' : 'hidden' }}
      />

      {isGameView && <Minimap ref={minimapRef} width={minimapSize.width} height={minimapSize.height} />}
      {screen === 'playing' && (
        <HUD score={displayScore} timeLeft={displayTime} difficulty={difficulty} />
      )}

      {/* Attract mode — autonomous Boids sim behind the start-screen UI. Mounted
          only on the start screen, so it stops on play and restarts on return.
          Rendered before StartScreen so it layers underneath (pointer-events-none). */}
      {screen === 'start' && <AttractBackground />}
      {screen === 'start' && (
        <StartScreen
          onPlay={startGame}
          onLeaderboard={() => setShowLeaderboard(true)}
          onHowToPlay={() => setShowTutorial(true)}
          onOpenSettings={() => setShowSettings(true)}
          audioOn={sound.audioOn}
          onToggleAudio={sound.toggleAudio}
          difficulty={difficulty}
          onSelectDifficulty={selectDifficulty}
        />
      )}
      {/* Leaderboard overlay — start screen (opened by the Leaderboard button). */}
      {screen === 'start' && showLeaderboard && (
        <LeaderboardOverlay difficulty={difficulty} onClose={() => setShowLeaderboard(false)} />
      )}
      {/* Portrait rotation hint — start screen only, touch + portrait, once/session. */}
      {screen === 'start' && <RotationToast />}
      {/* Settings — over the start screen, below the tutorial (z-order). */}
      {screen === 'start' && showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          audioOn={sound.audioOn}
          onToggleAudio={sound.toggleAudio}
        />
      )}
      {/* First-play tutorial — over the start screen only (top of the stack). */}
      {screen === 'start' && showTutorial && (
        <Tutorial onDone={() => setShowTutorial(false)} />
      )}
      {screen === 'paused' && (
        <PauseScreen
          onResume={resumeGame}
          onQuit={quitGame}
          audioOn={sound.audioOn}
          onToggleAudio={sound.toggleAudio}
        />
      )}
      {screen === 'end' && (
        <EndScreen
          score={endData.score}
          personalBest={endData.personalBest}
          isNewPB={endData.isNewPB}
          difficulty={difficulty}
          onPlayAgain={startGame}
          onMenu={quitGame}
        />
      )}
    </div>
  )
}
