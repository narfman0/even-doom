import {
  VERTS,
  LINEDEFS,
  SIDEDEF_SECTORS,
  SECTOR_LIGHT,
  SECTOR_FLOOR,
  SECTOR_CEIL,
  PLAYER_X,
  PLAYER_Y,
  PLAYER_ANGLE,
  ENEMY_SPAWNS,
  ENEMY_TYPE_HEALTH,
} from '../data/e1m1-data'
import { SPRITES, SPRITE_BY_TYPE, SPRITE_FRAME_DURATION } from '../data/sprite-data'

const FOV = Math.PI / 3
const MOVE_SPEED = 100
const TURN_SPEED = 2.0
// 70-char gradient from doom-ascii: space=transparent/far, $=dense/close
const RAMP = " .'`^\",: ;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"
// 10 distance thresholds for 70-char ramp: index = first threshold exceeded
// Spread across E1M1 range (50–500 units): far=sparse, close=dense
const DIST_STEPS = 10  // how many distance bands we use
const DIST_THRESHOLDS = [10000, 500, 400, 300, 220, 160, 110, 80, 60, 0]
// Unicode block gradient for sprites: space=transparent, then increasing density
const BLOCK_RAMP = [' ', '░', '▒', '▓', '█']
const SPRITE_ASCII_RAMP = " .:-=+*#@"
// 0xFFFF in a linedef's left sidedef slot means "no sidedef" → one-sided solid wall.
const NO_SIDEDEF = 0xffff

const SPRITE_COLS = 8
const SPRITE_ROWS = 12

const ENEMY_MOVE_SPEED = 60
const ENEMY_ATTACK_RANGE = 80
const ENEMY_ATTACK_DAMAGE = 8
const ENEMY_ATTACK_COOLDOWN = 1.5
const SHOOT_DAMAGE = 15
const SHOOT_RANGE = 400
const SHOOT_FOV = (20 * Math.PI) / 180

interface Enemy {
  x: number
  y: number
  health: number
  typeId: number
  alive: boolean
  lastAttackTime: number
}

export class Raycaster {
  private x: number
  private y: number
  private angle: number
  private enemies: Enemy[]
  private playerHealth: number
  private gameTime = 0

  constructor() {
    this.x = PLAYER_X
    this.y = PLAYER_Y
    this.angle = PLAYER_ANGLE
    this.playerHealth = 100

    this.enemies = []
    for (let i = 0; i < ENEMY_SPAWNS.length; i += 3) {
      const typeId = ENEMY_SPAWNS[i + 2]
      const hp = ENEMY_TYPE_HEALTH[typeId] ?? 50
      this.enemies.push({
        x: ENEMY_SPAWNS[i],
        y: ENEMY_SPAWNS[i + 1],
        health: hp,
        typeId,
        alive: true,
        lastAttackTime: -999,
      })
    }
  }

  getPlayerHealth(): number {
    return this.playerHealth
  }

  getEnemies(): Enemy[] {
    return this.enemies
  }

  tick(dt: number): void {
    this.gameTime += dt
    const now = performance.now() / 1000

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue

      const dx = this.x - enemy.x
      const dy = this.y - enemy.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > 1) {
        const nx = dx / dist
        const ny = dy / dist
        enemy.x += nx * ENEMY_MOVE_SPEED * dt
        enemy.y += ny * ENEMY_MOVE_SPEED * dt
      }

      if (dist < ENEMY_ATTACK_RANGE) {
        if (now - enemy.lastAttackTime >= ENEMY_ATTACK_COOLDOWN) {
          this.playerHealth -= ENEMY_ATTACK_DAMAGE
          enemy.lastAttackTime = now
        }
      }
    }
  }

  private castRay(rayAngle: number): {
    dist: number
    light: number
    isTwoSided: boolean
    upperVoidFrac: number
    lowerVoidFrac: number
    wallNormalDot: number
  } {
    const dx = Math.cos(rayAngle)
    // Doom world Y axis: north = positive Y in WAD, but our angle convention treats
    // 0=east/90=north with screen-style flip handled here.
    const dy = -Math.sin(rayAngle)

    let minT = Infinity
    let hitLight = 128
    let isTwoSided = false
    let upperVoidFrac = 0
    let lowerVoidFrac = 0
    let wallNormalDot = 0

    const numLinedefs = LINEDEFS.length / 4
    for (let i = 0; i < numLinedefs; i++) {
      const v1i = LINEDEFS[i * 4]
      const v2i = LINEDEFS[i * 4 + 1]
      const rightSide = LINEDEFS[i * 4 + 2]
      const leftSide = LINEDEFS[i * 4 + 3]

      const x1 = VERTS[v1i * 2]
      const y1 = VERTS[v1i * 2 + 1]
      const x2 = VERTS[v2i * 2]
      const y2 = VERTS[v2i * 2 + 1]

      const segDx = x2 - x1
      const segDy = y2 - y1
      const denom = dx * segDy - dy * segDx
      if (Math.abs(denom) < 1e-8) continue

      const tx1 = x1 - this.x
      const ty1 = y1 - this.y
      const t = (tx1 * segDy - ty1 * segDx) / denom
      const u = (tx1 * dy - ty1 * dx) / denom

      if (!(t > 0 && u >= 0 && u <= 1 && t < minT)) continue

      if (leftSide !== NO_SIDEDEF) {
        // Two-sided linedef: only render if there's a height transition (portal edge)
        const rSectorIdx = rightSide !== NO_SIDEDEF ? SIDEDEF_SECTORS[rightSide] : -1
        const lSectorIdx = SIDEDEF_SECTORS[leftSide]
        if (rSectorIdx < 0) continue

        const rFloor = SECTOR_FLOOR[rSectorIdx]
        const rCeil = SECTOR_CEIL[rSectorIdx]
        const lFloor = SECTOR_FLOOR[lSectorIdx]
        const lCeil = SECTOR_CEIL[lSectorIdx]

        // Skip if no visible height transition
        if (rFloor === lFloor && rCeil === lCeil) continue

        const wallTotalH = rCeil - rFloor
        if (wallTotalH <= 0) continue

        const openingBottom = Math.max(rFloor, lFloor)
        const openingTop = Math.min(rCeil, lCeil)

        minT = t
        if (rightSide !== NO_SIDEDEF) {
          hitLight = SECTOR_LIGHT[SIDEDEF_SECTORS[rightSide]]
        }
        isTwoSided = true

        if (openingTop <= openingBottom) {
          // Fully blocked
          upperVoidFrac = 0
          lowerVoidFrac = 0
        } else {
          lowerVoidFrac = (openingBottom - rFloor) / wallTotalH
          upperVoidFrac = (rCeil - openingTop) / wallTotalH
        }

        // Compute wall normal for E/W shading
        const wallLen = Math.sqrt(segDx * segDx + segDy * segDy)
        wallNormalDot = wallLen > 0 ? Math.abs(segDy / wallLen) : 0
      } else {
        // One-sided solid wall
        minT = t
        if (rightSide !== NO_SIDEDEF) {
          const sectorIdx = SIDEDEF_SECTORS[rightSide]
          hitLight = SECTOR_LIGHT[sectorIdx]
        }
        isTwoSided = false
        upperVoidFrac = 0
        lowerVoidFrac = 0

        // Compute wall normal for E/W shading (dot with east axis = |segDy / len|)
        const wallLen = Math.sqrt(segDx * segDx + segDy * segDy)
        wallNormalDot = wallLen > 0 ? Math.abs(segDy / wallLen) : 0
      }
    }

    return {
      dist: minT === Infinity ? 10000 : minT,
      light: hitLight,
      isTwoSided,
      upperVoidFrac,
      lowerVoidFrac,
      wallNormalDot,
    }
  }

  renderAscii(cols: number, rows: number): string {
    const SCALE = rows * 64
    const lines: string[] = new Array(rows)
    for (let row = 0; row < rows; row++) lines[row] = ''

    // Cast all rays and store wall distances per column
    const wallDists: number[] = new Array(cols)

    for (let col = 0; col < cols; col++) {
      const rayAngle = this.angle - FOV / 2 + (col / cols) * FOV
      const result = this.castRay(rayAngle)
      const { dist, light, isTwoSided, upperVoidFrac, lowerVoidFrac, wallNormalDot } = result

      const perpDist = Math.abs(dist * Math.cos(rayAngle - this.angle))
      wallDists[col] = perpDist
      const wallH = Math.min(rows, Math.floor(SCALE / (perpDist + 1)))
      const wallTop = Math.floor((rows - wallH) / 2)
      const wallBot = wallTop + wallH

      // Distance-based shading using 70-char doom-ascii gradient
      let distBand = DIST_THRESHOLDS.findIndex(t => perpDist > t)
      if (distBand < 0) distBand = DIST_STEPS - 1
      // Map distBand (0..9) to ramp index (0..69)
      const baseRampIdx = Math.floor((distBand / DIST_STEPS) * RAMP.length)
      // Sector light penalty: dim sectors step back in the ramp
      const lightPenalty = Math.floor((1 - light / 255) * (RAMP.length * 0.15))
      // E/W wall darkening: walls facing east/west get slightly darker (classic Wolf3D technique)
      const ewPenalty = Math.round(wallNormalDot * (RAMP.length * 0.03))
      const rampIdx = Math.max(0, baseRampIdx - lightPenalty - ewPenalty)
      const wallCh = RAMP[rampIdx]

      // Helper to get floor/ceiling char at a given row using same RAMP + distance bands
      const getFcChar = (row: number): string => {
        const distFromHorizon = Math.abs(row - rows / 2) + 0.5
        const floorCeilDist = (rows * 32) / distFromHorizon
        let fcBand = DIST_THRESHOLDS.findIndex(t => floorCeilDist > t)
        if (fcBand < 0) fcBand = DIST_STEPS - 1
        const fcIdx = Math.floor((fcBand / DIST_STEPS) * RAMP.length)
        return RAMP[Math.max(0, fcIdx)]
      }

      // For two-sided portals: compute visible strip heights
      const lowerStripH = isTwoSided ? Math.round(wallH * lowerVoidFrac) : 0
      const upperStripH = isTwoSided ? Math.round(wallH * upperVoidFrac) : 0

      for (let row = 0; row < rows; row++) {
        let ch: string
        if (row < wallTop || row >= wallBot) {
          // Floor/ceiling with distance gradient — denser chars near edges, sparse near horizon
          ch = getFcChar(row)
        } else if (isTwoSided) {
          // Portal strips: render top/bottom step bands; middle is open (show floor/ceiling char)
          const rowInWall = row - wallTop
          const isUpperStrip = upperStripH > 0 && rowInWall < upperStripH
          const isLowerStrip = lowerStripH > 0 && rowInWall >= (wallH - lowerStripH)
          if (isUpperStrip || isLowerStrip) {
            ch = wallCh
          } else {
            // Opening — show floor/ceiling gradient
            ch = getFcChar(row)
          }
        } else {
          ch = wallCh
        }
        lines[row] += ch
      }
    }

    // Build a column-character array for sprite overlay
    const colChars: string[][] = lines.map(line => line.split(''))

    // Render enemy sprites
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue

      const ex = enemy.x - this.x
      const ey = enemy.y - this.y
      // Doom Y flip
      const worldDx = ex
      const worldDy = -ey

      const dist = Math.sqrt(worldDx * worldDx + worldDy * worldDy)
      if (dist < 1) continue

      // Angle of enemy relative to player's view direction
      const enemyAngle = Math.atan2(worldDy, worldDx)
      let relAngle = enemyAngle - this.angle
      // Normalize to [-PI, PI]
      while (relAngle > Math.PI) relAngle -= 2 * Math.PI
      while (relAngle < -Math.PI) relAngle += 2 * Math.PI

      if (Math.abs(relAngle) > FOV / 2) continue

      // Project center column
      const centerCol = Math.floor(((relAngle + FOV / 2) / FOV) * cols)

      const perpDist = dist * Math.cos(relAngle)

      // Get sprite animation frame
      const spriteKey = SPRITE_BY_TYPE[enemy.typeId] ?? 'POSS'
      const frames = SPRITES[spriteKey]

      // Sprite height on screen
      const spriteH = Math.min(rows, Math.floor(SCALE / (perpDist + 1)))
      const spriteTop = Math.floor((rows - spriteH) / 2)

      // Fallback to single-column 'I' if no sprite frames
      if (!frames || frames.length === 0) {
        const spriteBot = spriteTop + spriteH
        if (perpDist < wallDists[centerCol]) {
          for (let row = spriteTop; row < spriteBot; row++) {
            if (row >= 0 && row < rows) {
              colChars[row][centerCol] = 'I'
            }
          }
        }
        continue
      }

      const frame = frames[Math.floor(this.gameTime / SPRITE_FRAME_DURATION) % frames.length]

      // Screen sprite width — preserve aspect ratio
      const spriteScreenW = Math.round(spriteH * (SPRITE_COLS / SPRITE_ROWS))
      const startCol = Math.round(centerCol - spriteScreenW / 2)

      for (let sc = startCol; sc < startCol + spriteScreenW; sc++) {
        if (sc < 0 || sc >= cols) continue
        if (perpDist >= wallDists[sc]) continue

        const spriteSrcCol = Math.floor(((sc - startCol) / spriteScreenW) * SPRITE_COLS)

        for (let sr = spriteTop; sr < spriteTop + spriteH; sr++) {
          if (sr < 0 || sr >= rows) continue
          const spriteSrcRow = Math.floor(((sr - spriteTop) / spriteH) * SPRITE_ROWS)
          const ch = frame[spriteSrcRow]?.[spriteSrcCol] ?? ' '
          if (ch !== ' ') {
            // Remap sprite char luminance to Unicode block elements
            const srcIdx = SPRITE_ASCII_RAMP.indexOf(ch)
            if (srcIdx <= 0) continue  // transparent or not found
            const blockIdx = Math.ceil((srcIdx / (SPRITE_ASCII_RAMP.length - 1)) * (BLOCK_RAMP.length - 1))
            colChars[sr][sc] = BLOCK_RAMP[Math.max(1, blockIdx)]
          }
        }
      }
    }

    // Rebuild lines from column chars
    for (let row = 0; row < rows; row++) {
      lines[row] = colChars[row].join('')
    }

    // HUD strip
    const hp = Math.max(0, this.playerHealth)
    const barFilled = Math.round((hp / 100) * 8)
    const bar = '#'.repeat(barFilled) + ' '.repeat(8 - barFilled)
    const deadCount = this.enemies.filter(e => !e.alive).length
    const hpStr = String(hp).padStart(3, ' ')
    lines.push(`HP:${hpStr} [${bar}] DEAD:${deadCount}`)

    return lines.join('\n')
  }

  moveForward(dt: number): void {
    this.x += Math.cos(this.angle) * MOVE_SPEED * dt
    this.y -= Math.sin(this.angle) * MOVE_SPEED * dt
  }

  moveBack(dt: number): void {
    this.x -= Math.cos(this.angle) * MOVE_SPEED * dt
    this.y += Math.sin(this.angle) * MOVE_SPEED * dt
  }

  turnLeft(dt: number): void {
    this.angle += TURN_SPEED * dt
  }

  turnRight(dt: number): void {
    this.angle -= TURN_SPEED * dt
  }

  shoot(): void {
    let closest: Enemy | null = null
    let closestDist = Infinity

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue

      const ex = enemy.x - this.x
      const ey = enemy.y - this.y
      const dist = Math.sqrt(ex * ex + ey * ey)

      if (dist > SHOOT_RANGE) continue

      // Doom Y flip for angle calculation
      const enemyAngle = Math.atan2(-ey, ex)
      let relAngle = enemyAngle - this.angle
      while (relAngle > Math.PI) relAngle -= 2 * Math.PI
      while (relAngle < -Math.PI) relAngle += 2 * Math.PI

      if (Math.abs(relAngle) <= SHOOT_FOV / 2 && dist < closestDist) {
        closest = enemy
        closestDist = dist
      }
    }

    if (closest) {
      closest.health -= SHOOT_DAMAGE
      if (closest.health <= 0) {
        closest.alive = false
      }
    }
  }
}
