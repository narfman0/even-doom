import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { frameToAscii } from './ascii'
import { Controls } from './controls'
import { Raycaster } from './raycaster'

function makeImageData(width: number, height: number, fillRgb: [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fillRgb[0]
    data[i * 4 + 1] = fillRgb[1]
    data[i * 4 + 2] = fillRgb[2]
    data[i * 4 + 3] = 255
  }
  return { data, width, height } as ImageData
}

describe('frameToAscii', () => {
  it('returns correct number of rows and columns', () => {
    const img = makeImageData(320, 160, [128, 128, 128])
    const result = frameToAscii(img, 58, 24)
    const lines = result.split('\n')
    expect(lines).toHaveLength(24)
    for (const line of lines) {
      expect(line).toHaveLength(58)
    }
  })

  it('maps a fully bright (white) image to light/sparse characters', () => {
    const img = makeImageData(320, 160, [255, 255, 255])
    const result = frameToAscii(img, 58, 24)
    // White pixels should map to space (the lightest character)
    expect(result.replace(/\n/g, '')).toBe(' '.repeat(58 * 24))
  })

  it('maps a fully dark (black) image to a dense character', () => {
    const img = makeImageData(320, 160, [0, 0, 0])
    const result = frameToAscii(img, 58, 24)
    const chars = result.replace(/\n/g, '')
    // All characters should be the densest in the ramp '@'
    expect(chars).toBe('@'.repeat(58 * 24))
  })

  it('brighter pixels produce a less dense character than darker pixels', () => {
    const bright = makeImageData(10, 10, [200, 200, 200])
    const dark = makeImageData(10, 10, [30, 30, 30])
    const ramp = ' .:;+*#@'

    const brightChar = frameToAscii(bright, 1, 1)
    const darkChar = frameToAscii(dark, 1, 1)

    expect(ramp.indexOf(brightChar)).toBeLessThan(ramp.indexOf(darkChar))
  })

  it('handles non-square cell sizes without throwing', () => {
    const img = makeImageData(576, 288, [100, 100, 100])
    expect(() => frameToAscii(img, 58, 24)).not.toThrow()
  })
})

describe('Controls', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initial state has zero turnRate and all actions false', () => {
    const c = new Controls()
    const s = c.getState()
    expect(s.turnRate).toBe(0)
    expect(s.moveForward).toBe(false)
    expect(s.moveBack).toBe(false)
    expect(s.shoot).toBe(false)
  })

  it('positive IMU x sets a positive turnRate', () => {
    const c = new Controls()
    c.onImu(0.5, 0, 0)
    expect(c.getState().turnRate).toBeGreaterThan(0)
  })

  it('negative IMU x sets a negative turnRate', () => {
    const c = new Controls()
    c.onImu(-0.5, 0, 0)
    expect(c.getState().turnRate).toBeLessThan(0)
  })

  it('IMU x within dead zone gives zero turnRate', () => {
    const c = new Controls()
    c.onImu(0.03, 0, 0)
    expect(c.getState().turnRate).toBe(0)
  })

  it('onScrollUp sets moveForward true immediately', () => {
    const c = new Controls()
    c.onScrollUp()
    expect(c.getState().moveForward).toBe(true)
  })

  it('onScrollUp resets moveForward after 200ms', () => {
    const c = new Controls()
    c.onScrollUp()
    vi.advanceTimersByTime(200)
    expect(c.getState().moveForward).toBe(false)
  })

  it('onScrollDown sets moveBack true immediately', () => {
    const c = new Controls()
    c.onScrollDown()
    expect(c.getState().moveBack).toBe(true)
  })

  it('onScrollDown resets moveBack after 200ms', () => {
    const c = new Controls()
    c.onScrollDown()
    vi.advanceTimersByTime(200)
    expect(c.getState().moveBack).toBe(false)
  })

  it('onTap sets shoot true immediately', () => {
    const c = new Controls()
    c.onTap()
    expect(c.getState().shoot).toBe(true)
  })

  it('onTap resets shoot after 100ms', () => {
    const c = new Controls()
    c.onTap()
    vi.advanceTimersByTime(100)
    expect(c.getState().shoot).toBe(false)
  })

  it('getState returns a copy not a reference', () => {
    const c = new Controls()
    const s1 = c.getState()
    s1.turnRate = 99
    expect(c.getState().turnRate).toBe(0)
  })
})

describe('Raycaster', () => {
  it('renderAscii(10, 5) returns a string with 4 newlines (5 rows)', () => {
    const r = new Raycaster()
    const out = r.renderAscii(10, 5)
    expect(out.split('\n')).toHaveLength(5)
  })

  it('each line has exactly the requested number of columns', () => {
    const r = new Raycaster()
    const out = r.renderAscii(10, 5)
    for (const line of out.split('\n')) {
      expect(line).toHaveLength(10)
    }
  })

  it('output contains non-space characters from spawn', () => {
    const r = new Raycaster()
    const out = r.renderAscii(58, 24)
    expect(/[^\s]/.test(out)).toBe(true)
  })

  it('moveForward changes the rendered view', () => {
    const r = new Raycaster()
    const before = r.renderAscii(58, 24)
    r.moveForward(0.5)
    const after = r.renderAscii(58, 24)
    expect(after).not.toBe(before)
  })

  it('moveBack changes the rendered view', () => {
    const r = new Raycaster()
    const before = r.renderAscii(58, 24)
    r.moveBack(0.5)
    const after = r.renderAscii(58, 24)
    expect(after).not.toBe(before)
  })

  it('turnLeft changes the rendered view', () => {
    const r = new Raycaster()
    const before = r.renderAscii(58, 24)
    r.turnLeft(0.5)
    const after = r.renderAscii(58, 24)
    expect(after).not.toBe(before)
  })

  it('turnRight changes the rendered view', () => {
    const r = new Raycaster()
    const before = r.renderAscii(58, 24)
    r.turnRight(0.5)
    const after = r.renderAscii(58, 24)
    expect(after).not.toBe(before)
  })

  it('turning 180 degrees produces a different view than spawn', () => {
    const r = new Raycaster()
    const before = r.renderAscii(58, 24)
    r.turnLeft(Math.PI / 2.0)  // turnSpeed=2 rad/s, so PI/2 rad of turn
    const after = r.renderAscii(58, 24)
    expect(after).not.toBe(before)
  })

  it('shoot does not throw', () => {
    const r = new Raycaster()
    expect(() => r.shoot()).not.toThrow()
  })
})
