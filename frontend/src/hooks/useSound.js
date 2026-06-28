// useSound.js — HTML5 Audio playback from real mp3 files (no Tone.js).
//
// Four assets in public/audio/: a looping underwater ambient, a bubble-pop catch
// sound, a game-over tone, and a congrats sting for a new personal best. A mute
// toggle (persisted in localStorage) gates everything.
//
// Browser autoplay policy: the ambient must first .play() inside a user gesture
// (the Play tap → App.startGame → playAmbient), which unlocks audio for the page.

import { useRef, useState, useEffect, useCallback } from 'react'

const MUTE_KEY = 'hunter_mute'

const AMBIENT_VOLUME = 0.3
const CATCH_VOLUME = 0.5
const END_VOLUME = 0.7
const CONGRATS_VOLUME = 0.7

export function useSound() {
  const ambientRef = useRef(null)
  // muted is React state (so the start-screen icon re-renders) mirrored into a
  // ref (so the rAF-triggered SFX callbacks read it without re-subscribing).
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === 'true')
  const mutedRef = useRef(muted)
  mutedRef.current = muted

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

  const playAmbient = useCallback(() => {
    if (mutedRef.current || !ambientRef.current) return
    ambientRef.current.currentTime = 0
    ambientRef.current.play().catch(() => {})
  }, [])

  const stopAmbient = useCallback(() => {
    const a = ambientRef.current
    if (!a) return
    a.pause()
    a.currentTime = 0
  }, [])

  // Fire-and-forget one-shot: a fresh Audio element so overlapping catches don't
  // cut each other off.
  const playOneShot = useCallback((src, volume) => {
    if (mutedRef.current) return
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

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      mutedRef.current = next
      localStorage.setItem(MUTE_KEY, String(next))
      if (next && ambientRef.current) ambientRef.current.pause()
      return next
    })
  }, [])

  const isMuted = useCallback(() => mutedRef.current, [])

  // Dev-only probe for Playwright (stripped from production builds).
  useEffect(() => {
    if (import.meta.env.DEV) {
      window.__hunterAudio = {
        muted: () => mutedRef.current,
        ambientPaused: () => (ambientRef.current ? ambientRef.current.paused : true),
      }
    }
  }, [])

  return { playAmbient, stopAmbient, playCatch, playEnd, playCongrats, muted, toggleMute, isMuted }
}
