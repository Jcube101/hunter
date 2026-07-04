// personalBest.test.js — Area N of the Session 17 audit.

import { describe, it, expect } from 'vitest'
import { isNewPersonalBest } from './personalBest.js'

describe('isNewPersonalBest', () => {
  it('is true when the score beats the current PB', () => {
    expect(isNewPersonalBest(10, 5)).toBe(true)
  })

  it('is false when the score equals the current PB (not strictly better)', () => {
    expect(isNewPersonalBest(5, 5)).toBe(false)
  })

  it('is false when the score is below the current PB', () => {
    expect(isNewPersonalBest(3, 5)).toBe(false)
  })

  it('a score of 0 is not a PB against the default of 0', () => {
    expect(isNewPersonalBest(0, 0)).toBe(false)
  })

  it('a score of 1 is a new PB against the default of 0', () => {
    expect(isNewPersonalBest(1, 0)).toBe(true)
  })
})
