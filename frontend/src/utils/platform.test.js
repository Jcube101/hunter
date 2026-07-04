// platform.test.js — Area F of the Session 17 audit.

import { describe, it, expect, afterEach } from 'vitest'
import { isTouchDevice, getPlatform } from './platform.js'

function setMaxTouchPoints(value) {
  Object.defineProperty(navigator, 'maxTouchPoints', { value, configurable: true })
}

afterEach(() => {
  setMaxTouchPoints(0)
})

describe('isTouchDevice', () => {
  it('is true when navigator.maxTouchPoints > 0', () => {
    setMaxTouchPoints(5)
    expect(isTouchDevice()).toBe(true)
  })

  it('is false when navigator.maxTouchPoints is 0', () => {
    setMaxTouchPoints(0)
    expect(isTouchDevice()).toBe(false)
  })
})

describe('getPlatform', () => {
  it('returns "mobile" for a touch device', () => {
    setMaxTouchPoints(1)
    expect(getPlatform()).toBe('mobile')
  })

  it('returns "desktop" for a non-touch device', () => {
    setMaxTouchPoints(0)
    expect(getPlatform()).toBe('desktop')
  })
})
