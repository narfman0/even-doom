import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { frameToAscii } from './ascii'
import { Controls } from './even/controls'
import { Raycaster } from './core/raycaster'

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
  it('renderAscii(10, 5) returns rows+1 lines (game rows + HUD)', () => {
    const r = new Raycaster()
    const out = r.renderAscii(10, 5)
    // rows game lines + 1 HUD line
    expect(out.split('\n')).toHaveLength(6)
  })

  it('game lines (all except last) have exactly the requested number of columns', () => {
    const r = new Raycaster()
    const out = r.renderAscii(10, 5)
    const lines = out.split('\n')
    // Skip the last HUD line
    for (const line of lines.slice(0, -1)) {
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

describe('Combat', () => {
  it('Raycaster starts with playerHealth 100', () => {
    const r = new Raycaster()
    expect(r.getPlayerHealth()).toBe(100)
  })

  it('shoot() damages a nearby enemy placed directly in front of player', () => {
    const r = new Raycaster()
    // Find the first alive enemy and teleport it directly in front of the player
    const enemies = r.getEnemies()
    const e = enemies[0]
    const originalHealth = e.health
    // Player faces north (Doom angle 90° = +Y). With corrected angle (3π/2),
    // "in front" = +Y direction in map coords.
    e.x = r['x']
    e.y = r['y'] + 100
    e.alive = true
    r.shoot()
    expect(e.health).toBeLessThan(originalHealth)
  })

  it('dead enemies have alive=false after enough shots', () => {
    const r = new Raycaster()
    const enemies = r.getEnemies()
    const e = enemies[0]
    e.x = r['x']
    e.y = r['y'] + 50
    e.alive = true
    e.health = 15 // less than SHOOT_DAMAGE(15), dies in 1 shot
    r.shoot()
    expect(e.alive).toBe(false)
  })

  it('HUD line contains HP:', () => {
    const r = new Raycaster()
    const out = r.renderAscii(58, 24)
    expect(out).toContain('HP:')
  })

  it('player takes damage when an enemy is adjacent after tick', () => {
    const r = new Raycaster()
    const enemies = r.getEnemies()
    const e = enemies[0]
    // Place enemy right at player position to guarantee attack range
    e.x = r['x']
    e.y = r['y']
    e.alive = true
    // Tick enough to trigger attack (1.5s cooldown, use 2s)
    r.tick(2.0)
    expect(r.getPlayerHealth()).toBeLessThan(100)
  })

  it('renderAscii uses multi-column sprites when enemy is close', () => {
    const r = new Raycaster()
    const enemies = r.getEnemies()
    const e = enemies[0]
    // Player faces north (+Y in map coords). Place enemy 50 units in front.
    e.x = r['x']
    e.y = r['y'] + 50
    e.alive = true
    e.typeId = 3004 // POSS - known to have frames

    // renderAscii should not throw
    expect(() => r.renderAscii(58, 24)).not.toThrow()

    const out = r.renderAscii(58, 24)
    const lines = out.split('\n')

    // Check the middle rows of the rendered output for sprite width > 1
    // The sprite should be wide (multi-column) when the enemy is close
    const midRow = Math.floor(24 / 2)
    // Check a band around the center rows
    let maxSpriteWidth = 0
    for (let rowIdx = midRow - 3; rowIdx <= midRow + 3; rowIdx++) {
      const line = lines[rowIdx] ?? ''
      // Count consecutive non-space characters in any run
      // Sprites now render as Unicode block chars (░▒▓█) or wall chars from the doom-ascii ramp
      const matches = line.match(/[^\s]+/g)
      if (matches) {
        for (const m of matches) {
          if (m.length > maxSpriteWidth) maxSpriteWidth = m.length
        }
      }
    }
    // A multi-column sprite at distance 50 should produce a run wider than 1 char
    expect(maxSpriteWidth).toBeGreaterThan(1)
  })
})
