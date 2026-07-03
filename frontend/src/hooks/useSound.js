// useSound.js — HTML5 Audio playback from real mp3 files.
//
// Four assets in public/audio/: a looping underwater ambient, a bubble-pop catch
// sound, a game-over tone, and a congrats sting for a new personal best.
//
// Audio on/off is the single source of truth in src/settings.js (default ON).
// This hook mirrors it into React state (so the toggle icons re-render) and a ref
// (so the rAF-triggered SFX read it without re-subscribing). When audio is off,
// BOTH the ambient loop and every one-shot SFX are suppressed.
//
// Ambient is seamless: playAmbient() never restarts a loop that's already playing,
// so it carries through the start screen -> gameplay without a gap. Browser
// autoplay policy still requires the first .play() to happen inside a user
// gesture (App wires a one-time first-interaction unlock).

import { useRef, useState, useEffect, useCallback } from 'react'
import { isAudioOn, setAudioOn } from '../settings.js'

const AMBIENT_VOLUME = 0.3
const CATCH_VOLUME = 0.5
const END_VOLUME = 0.7
const CONGRATS_VOLUME = 0.7

export function useSound() {
  const ambientRef = useRef(null)
  // audioOn is React state (so the toggle icons re-render) mirrored into a ref
  // (so the rAF-triggered SFX callbacks read it without re-subscribing).
  const [audioOn, setAudioState] = useState(isAudioOn)
  const audioOnRef = useRef(audioOn)
  audioOnRef.current = audioOn

  // Preload the looping ambient once.
  useEffect(() => {
    const a = new Audio('/audio/Ambient_Loop.mp3')
    a.loop = true
    a.volume = AMBIENT_VOLUME
    ambientRef.current = a
    return () => {
      a.pause()
    }
  }, [])

  // Start the ambient loop IF audio is on and it isn't already playing. Never
  // resets currentTime, so a loop already running (e.g. from the start screen)
  // carries seamlessly into gameplay instead of restarting.
  const playAmbient = useCallback(() => {
    const a = ambientRef.current
    if (!audioOnRef.current || !a || !a.paused) return
    a.play().catch(() => {})
  }, [])

  const stopAmbient = useCallback(() => {
    const a = ambientRef.current
    if (a) a.pause()
  }, [])

  // Fire-and-forget one-shot; suppressed entirely when audio is off.
  const playOneShot = useCallback((src, volume) => {
    if (!audioOnRef.current) return
    const audio = new Audio(src)
    audio.volume = volume
    audio.play().catch(() => {})
  }, [])

  const playCatch = useCallback(() => playOneShot('/audio/Bubble_Pop.mp3', CATCH_VOLUME), [playOneShot])
  const playEnd = useCallback(() => playOneShot('/audio/Game_Over.mp3', END_VOLUME), [playOneShot])
  const playCongrats = useCallback(
    () => playOneShot('/audio/Congrats.mp3', CONGRATS_VOLUME),
    [playOneShot],
  )

  // Toggle audio on/off from any of the three UIs. Persists to the single source
  // of truth and applies immediately: off pauses the ambient now; on resumes it
  // (within the toggle's click gesture, so autoplay is satisfied).
  const toggleAudio = useCallback(() => {
    setAudioState((prev) => {
      const next = !prev
      audioOnRef.current = next
      setAudioOn(next)
      const a = ambientRef.current
      if (!next) {
        if (a) a.pause()
      } else if (a && a.paused) {
        a.play().catch(() => {})
      }
      return next
    })
  }, [])

  const isAudio = useCallback(() => audioOnRef.current, [])

  // Dev-only probe for Playwright (stripped from production builds).
  useEffect(() => {
    if (import.meta.env.DEV) {
      window.__hunterAudio = {
        audioOn: () => audioOnRef.current,
        ambientPaused: () => (ambientRef.current ? ambientRef.current.paused : true),
        ambientTime: () => (ambientRef.current ? ambientRef.current.currentTime : 0),
      }
    }
  }, [])

  return { playAmbient, stopAmbient, playCatch, playEnd, playCongrats, audioOn, toggleAudio, isAudio }
}
