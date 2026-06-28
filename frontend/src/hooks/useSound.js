// useSound.js — Tone.js audio. This is the ONLY file that imports Tone.
//
// Three generated sounds: a mid-range ambient underwater burble (while playing,
// audible on phone speakers), a short catch chomp, and a distinct descending
// game-over tone. A mute toggle (persisted in localStorage) gates everything at
// the destination.
//
// The AudioContext must be unlocked inside a user gesture — playAmbient() is
// first called from the Play tap (see App.startGame), which satisfies that.

import { useCallback, useRef, useState } from 'react'
import * as Tone from 'tone'

const MUTE_KEY = 'hunter_mute'
const AMBIENT_LEVEL = 0.12 // linear gain ≈ -18 dB — present on phone speakers, not intrusive
const AMBIENT_FREQ_MIN = 400 // Hz — carrier wavers across this range (mid, phone-audible)
const AMBIENT_FREQ_MAX = 470

export function useSound() {
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === 'true')
  const mutedRef = useRef(muted)
  mutedRef.current = muted

  const nodesRef = useRef(null)

  // Lazily build the audio graph and unlock the context (user-gesture safe).
  const ensureInit = useCallback(async () => {
    if (nodesRef.current) return
    await Tone.start()

    // Ambient: a mid-range underwater "burble". A ~420Hz sine is pulsed by a
    // slow tremolo (rhythmic, watery) with a gentle pitch waver. Mid frequencies
    // carry on small phone speakers, unlike the old ~68Hz sub-bass drone that
    // was inaudible on mobile. Routed through an on/off gain for play/stop.
    const ambientVol = new Tone.Gain(0).toDestination()
    const ambientTrem = new Tone.Tremolo({ frequency: 3.2, depth: 0.85, spread: 0 })
      .connect(ambientVol)
      .start()
    const ambientOsc = new Tone.Oscillator(420, 'sine').connect(ambientTrem)
    ambientOsc.start()
    const ambientLfo = new Tone.LFO({ frequency: 0.15, min: AMBIENT_FREQ_MIN, max: AMBIENT_FREQ_MAX }).start()
    ambientLfo.connect(ambientOsc.frequency)

    // Catch: short percussive chomp.
    const catchSynth = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.02 },
      volume: -9,
    }).toDestination()

    // Game over: descending tone, clearly distinct from the catch.
    const endSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.1 },
      volume: -10,
    }).toDestination()

    nodesRef.current = { ambientVol, catchSynth, endSynth }
    Tone.getDestination().mute = mutedRef.current

    // Dev-only probe for Playwright (stripped from production builds).
    if (import.meta.env.DEV) {
      window.__hunterAudio = {
        state: () => Tone.getContext().state,
        muted: () => Tone.getDestination().mute,
        ambientGain: () => ambientVol.gain.value,
        // Carrier value reads 0 while an LFO drives the param (Web Audio quirk),
        // so report the true emitted midpoint of the LFO waver range instead.
        ambientFreq: () => (AMBIENT_FREQ_MIN + AMBIENT_FREQ_MAX) / 2,
      }
    }
  }, [])

  const playAmbient = useCallback(async () => {
    await ensureInit()
    nodesRef.current.ambientVol.gain.rampTo(AMBIENT_LEVEL, 0.5)
  }, [ensureInit])

  const stopAmbient = useCallback(() => {
    if (nodesRef.current) nodesRef.current.ambientVol.gain.rampTo(0, 0.3)
  }, [])

  const playCatch = useCallback(() => {
    if (nodesRef.current) nodesRef.current.catchSynth.triggerAttackRelease('C2', 0.1)
  }, [])

  const playEnd = useCallback(() => {
    if (!nodesRef.current) return
    const synth = nodesRef.current.endSynth
    const now = Tone.now()
    synth.triggerAttack('A4', now)
    synth.frequency.rampTo('A3', 0.4, now)
    synth.triggerRelease(now + 0.45)
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      localStorage.setItem(MUTE_KEY, String(next))
      // getDestination() is safe before the context starts.
      Tone.getDestination().mute = next
      return next
    })
  }, [])

  return { playAmbient, stopAmbient, playCatch, playEnd, muted, toggleMute }
}
