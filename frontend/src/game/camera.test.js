// camera.test.js — Area C of the Session 17 audit. Pure math, no DOM/canvas.

import { describe, it, expect } from 'vitest'
import { updateCamera, worldToScreen, screenToWorld } from './camera.js'

describe('updateCamera', () => {
  it('centers the predator when far from every edge', () => {
    const predator = { x: 500, y: 500 }
    const world = { width: 2000, height: 2000 }
    const viewport = { width: 800, height: 600 }
    const cam = updateCamera(predator, world, viewport)
    expect(cam.x).toBe(500 - 400)
    expect(cam.y).toBe(500 - 300)
  })

  it('clamps to zero at the top-left world edge', () => {
    const predator = { x: 10, y: 10 }
    const world = { width: 2000, height: 2000 }
    const viewport = { width: 800, height: 600 }
    const cam = updateCamera(predator, world, viewport)
    expect(cam.x).toBe(0)
    expect(cam.y).toBe(0)
  })

  it('clamps to world-viewport at the bottom-right world edge', () => {
    const predator = { x: 1990, y: 1990 }
    const world = { width: 2000, height: 2000 }
    const viewport = { width: 800, height: 600 }
    const cam = updateCamera(predator, world, viewport)
    expect(cam.x).toBe(2000 - 800)
    expect(cam.y).toBe(2000 - 600)
  })

  it('clamps to 0 when the world is smaller than the viewport', () => {
    const predator = { x: 50, y: 50 }
    const world = { width: 100, height: 100 }
    const viewport = { width: 800, height: 600 }
    const cam = updateCamera(predator, world, viewport)
    expect(cam.x).toBe(0)
    expect(cam.y).toBe(0)
  })

  it('carries the viewport size through unchanged', () => {
    const cam = updateCamera({ x: 0, y: 0 }, { width: 500, height: 500 }, { width: 300, height: 200 })
    expect(cam.width).toBe(300)
    expect(cam.height).toBe(200)
  })
})

describe('worldToScreen / screenToWorld', () => {
  it('are exact inverses of each other', () => {
    const camera = { x: 120, y: 45, width: 800, height: 600 }
    const world = { x: 530, y: 210 }
    const screen = worldToScreen(world.x, world.y, camera)
    const back = screenToWorld(screen.x, screen.y, camera)
    expect(back.x).toBeCloseTo(world.x)
    expect(back.y).toBeCloseTo(world.y)
  })

  it('worldToScreen subtracts the camera offset', () => {
    const camera = { x: 100, y: 50 }
    expect(worldToScreen(150, 80, camera)).toEqual({ x: 50, y: 30 })
  })

  it('screenToWorld adds the camera offset (matches useInput usage)', () => {
    const camera = { x: 100, y: 50 }
    expect(screenToWorld(50, 30, camera)).toEqual({ x: 150, y: 80 })
  })
})
