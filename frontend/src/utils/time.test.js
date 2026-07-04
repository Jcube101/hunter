// time.test.js — Area R of the Session 17 audit (formatTime, extracted from HUD.jsx).

import { describe, it, expect } from 'vitest'
import { formatTime } from './time.js'

describe('formatTime', () => {
  it('formats a whole minute', () => {
    expect(formatTime(60)).toBe('1:00')
  })

  it('pads single-digit seconds', () => {
    expect(formatTime(5)).toBe('0:05')
  })

  it('formats zero as 0:00', () => {
    expect(formatTime(0)).toBe('0:00')
  })

  it('clamps negative input to 0:00', () => {
    expect(formatTime(-5)).toBe('0:00')
  })

  it('formats minutes and seconds together', () => {
    expect(formatTime(125)).toBe('2:05')
  })

  it('rounds fractional seconds up (ceil)', () => {
    expect(formatTime(9.2)).toBe('0:10')
  })
})
