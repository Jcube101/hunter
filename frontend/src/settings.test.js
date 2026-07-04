// settings.test.js — Area E of the Session 17 audit.
//
// settings.js reads localStorage at MODULE LOAD time (top-level `let audioOn =
// readBool(...)`), so each test needs a fresh module instance to see a fresh
// localStorage state. `vi.resetModules()` + dynamic `import()` gives every
// test its own module graph.

import { describe, it, expect, beforeEach, vi } from 'vitest'

async function freshSettings() {
  vi.resetModules()
  return import('./settings.js')
}

beforeEach(() => {
  localStorage.clear()
})

describe('isAudioOn', () => {
  it('defaults to true when the key is unset', async () => {
    const { isAudioOn } = await freshSettings()
    expect(isAudioOn()).toBe(true)
  })

  it('is false only when the stored value is exactly "false"', async () => {
    localStorage.setItem('hunter_setting_audio', 'false')
    const { isAudioOn } = await freshSettings()
    expect(isAudioOn()).toBe(false)
  })

  it('is true for any stored value other than the literal string "false"', async () => {
    localStorage.setItem('hunter_setting_audio', 'true')
    const { isAudioOn } = await freshSettings()
    expect(isAudioOn()).toBe(true)
  })
})

describe('setAudioOn', () => {
  it('persists the string value and updates the live in-memory value', async () => {
    const { setAudioOn, isAudioOn } = await freshSettings()
    setAudioOn(false)
    expect(isAudioOn()).toBe(false)
    expect(localStorage.getItem('hunter_setting_audio')).toBe('false')
    setAudioOn(true)
    expect(isAudioOn()).toBe(true)
    expect(localStorage.getItem('hunter_setting_audio')).toBe('true')
  })
})

describe('legacy hunter_mute migration', () => {
  it('migrates a legacy muted preference once when the new key is unset', async () => {
    localStorage.setItem('hunter_mute', 'true')
    const { isAudioOn } = await freshSettings()
    expect(isAudioOn()).toBe(false)
    expect(localStorage.getItem('hunter_setting_audio')).toBe('false')
  })

  it('does not migrate when the new key is already set', async () => {
    localStorage.setItem('hunter_setting_audio', 'true')
    localStorage.setItem('hunter_mute', 'true') // legacy mute present but irrelevant now
    const { isAudioOn } = await freshSettings()
    expect(isAudioOn()).toBe(true)
  })
})

describe('cross-tab sync', () => {
  it('updates the cached value on a storage event for the audio key', async () => {
    const { isAudioOn } = await freshSettings()
    expect(isAudioOn()).toBe(true)
    localStorage.setItem('hunter_setting_audio', 'false')
    window.dispatchEvent(new StorageEvent('storage', { key: 'hunter_setting_audio' }))
    expect(isAudioOn()).toBe(false)
  })

  it('ignores storage events for unrelated keys', async () => {
    const { isAudioOn } = await freshSettings()
    localStorage.setItem('hunter_setting_audio', 'false') // simulate another change out-of-band
    window.dispatchEvent(new StorageEvent('storage', { key: 'some_other_key' }))
    // Cached value should NOT have re-read since the event key didn't match.
    expect(isAudioOn()).toBe(true)
  })
})
