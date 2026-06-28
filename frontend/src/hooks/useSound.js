// useSound.js — Tone.js audio. This is the ONLY file that imports Tone.
//
// Three generated sounds: a light, airy ambient shimmer (while playing, audible
// on phone speakers, non-haunting), a short catch chomp, and a distinct
// descending game-over tone. A mute toggle (persisted in localStorage) gates
// everything at the destination.
//
// The AudioContext must be unlocked inside a user gesture — playAmbient() is
// first called from the Play tap (see App.startGame), which satisfies that.

import { useCallback, useRef, useState } from 'react'
import * as Tone from 'tone'

const MUTE_KEY = 'hunter_mute'
const AMBIENT_LEVEL = 0.1 // linear gain ≈ -20 dB — light, present, not intrusive
const AMBIENT_FREQ = 700 // Hz — airy mid-high "shimmer" (phone-audible, non-haunting)

export function useSound() {
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === 'true')
  const mutedRef = useRef(muted)
  mutedRef.current = muted

  const nodesRef = useRef(null)

  // Lazily build the audio graph and unlock the context (user-gesture safe).
  const ensureInit = useCallback(async () => {
    if (nodesRef.current) return
    await Tone.start()

    // Ambient: a light, airy "shimmer". A steady ~700Hz triangle with a slow,
    // shallow amplitude breathe — NO fast tremolo (the old tremolo'd burble
    // sounded haunting). Gentle and atmospheric, suggests water without being
    // eerie, and carries on small phone speakers. Routed through an on/off gain.
    //   osc -> breathe (LFO multiplier 0.7..1.0) -> ambientVol (0..AMBIENT_LEVEL)
    const ambientVol = new Tone.Gain(0).toDestination()
    const ambientBreathe = new Tone.Gain(1).connect(ambientVol)
    const ambientOsc = new Tone.Oscillator(AMBIENT_FREQ, 'triangle').connect(ambientBreathe)
    ambientOsc.start()
    const ambientLfo = new Tone.LFO({ frequency: 0.25, min: 0.7, max: 1.0 }).start()
    ambientLfo.connect(ambientBreathe.gain)

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
        // No LFO drives the oscillator frequency now, so this reads correctly.
        ambientFreq: () => ambientOsc.frequency.value,
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
