// useSound.test.js — Area I of the Session 17 audit.
//
// jsdom's real HTMLAudioElement doesn't implement playback, so `Audio` is
// replaced with a lightweight fake (audit decision D5) that tracks paused
// state and spies on play()/pause(). settings.js caches its audio-on value at
// module-load time, so each test that needs a specific starting value uses
// vi.resetModules() + a dynamic import for a clean module graph (same
// pattern as settings.test.js).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

let createdAudios

function installFakeAudio() {
  createdAudios = []
  class FakeAudio {
    constructor(src) {
      this.src = src
      this.loop = false
      this.volume = 1
      this.paused = true
      this.currentTime = 0
      this.play = vi.fn(() => {
        this.paused = false
        return Promise.resolve()
      })
      this.pause = vi.fn(() => {
        this.paused = true
      })
      createdAudios.push(this)
    }
  }
  vi.stubGlobal('Audio', FakeAudio)
}

async function freshUseSound() {
  vi.resetModules()
  installFakeAudio()
  const mod = await import('./useSound.js')
  return mod.useSound
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useSound', () => {
  it('audioOn initializes from isAudioOn() (default true)', async () => {
    const useSound = await freshUseSound()
    const { result } = renderHook(() => useSound())
    expect(result.current.audioOn).toBe(true)
  })

  it('audioOn initializes false when the stored preference is off', async () => {
    localStorage.setItem('hunter_setting_audio', 'false')
    const useSound = await freshUseSound()
    const { result } = renderHook(() => useSound())
    expect(result.current.audioOn).toBe(false)
  })

  it('playAmbient no-ops when audio is off', async () => {
    localStorage.setItem('hunter_setting_audio', 'false')
    const useSound = await freshUseSound()
    const { result } = renderHook(() => useSound())
    const ambient = createdAudios[0]
    act(() => result.current.playAmbient())
    expect(ambient.play).not.toHaveBeenCalled()
  })

  it('playAmbient plays once when audio is on, and no-ops if already playing', async () => {
    const useSound = await freshUseSound()
    const { result } = renderHook(() => useSound())
    const ambient = createdAudios[0]
    act(() => result.current.playAmbient())
    expect(ambient.play).toHaveBeenCalledTimes(1)
    act(() => result.current.playAmbient()) // already playing (not .paused) -> no-op
    expect(ambient.play).toHaveBeenCalledTimes(1)
  })

  it('stopAmbient pauses the loop', async () => {
    const useSound = await freshUseSound()
    const { result } = renderHook(() => useSound())
    const ambient = createdAudios[0]
    act(() => result.current.playAmbient())
    expect(ambient.paused).toBe(false)
    act(() => result.current.stopAmbient())
    expect(ambient.pause).toHaveBeenCalled()
    expect(ambient.paused).toBe(true)
  })

  it('toggleAudio flips state, persists via localStorage, and pauses/resumes ambient', async () => {
    const useSound = await freshUseSound()
    const { result } = renderHook(() => useSound())
    act(() => result.current.playAmbient()) // start playing first
    const ambient = createdAudios[0]
    expect(ambient.paused).toBe(false)

    act(() => result.current.toggleAudio()) // -> off
    expect(result.current.audioOn).toBe(false)
    expect(localStorage.getItem('hunter_setting_audio')).toBe('false')
    expect(ambient.paused).toBe(true)

    act(() => result.current.toggleAudio()) // -> on
    expect(result.current.audioOn).toBe(true)
    expect(localStorage.getItem('hunter_setting_audio')).toBe('true')
    expect(ambient.paused).toBe(false)
  })

  it('playOneShot (playCatch) is suppressed when audio is off', async () => {
    localStorage.setItem('hunter_setting_audio', 'false')
    const useSound = await freshUseSound()
    const { result } = renderHook(() => useSound())
    const countBefore = createdAudios.length
    act(() => result.current.playCatch())
    expect(createdAudios.length).toBe(countBefore) // no new Audio() constructed
  })

  it('playCatch builds a one-shot Audio with the right src and volume when on', async () => {
    const useSound = await freshUseSound()
    const { result } = renderHook(() => useSound())
    act(() => result.current.playCatch())
    const oneShot = createdAudios[createdAudios.length - 1]
    expect(oneShot.src).toBe('/audio/Bubble_Pop.mp3')
    expect(oneShot.volume).toBe(0.5)
    expect(oneShot.play).toHaveBeenCalled()
  })

  it('playEnd and playCongrats build their respective one-shot assets', async () => {
    const useSound = await freshUseSound()
    const { result } = renderHook(() => useSound())
    act(() => result.current.playEnd())
    expect(createdAudios[createdAudios.length - 1].src).toBe('/audio/Game_Over.mp3')
    act(() => result.current.playCongrats())
    expect(createdAudios[createdAudios.length - 1].src).toBe('/audio/Congrats.mp3')
  })

  it('exposes window.__hunterAudio in DEV with the expected probe shape', async () => {
    const useSound = await freshUseSound()
    renderHook(() => useSound())
    expect(window.__hunterAudio).toBeTruthy()
    expect(typeof window.__hunterAudio.audioOn).toBe('function')
    expect(typeof window.__hunterAudio.ambientPaused).toBe('function')
    expect(typeof window.__hunterAudio.ambientTime).toBe('function')
  })
})
