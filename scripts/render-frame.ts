import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { Raycaster } from '../src/core/raycaster'

const COLS = 80
const ROWS = 30
const CHAR_W = 7
const CHAR_H = 9
const FONT_SIZE = 10

const outDir = resolve(process.cwd(), 'dist')
mkdirSync(outDir, { recursive: true })

function renderAndSave(
  x: number,
  y: number,
  angle: number,
  filename: string,
  label: string,
  gameTime = 0,
): void {
  const raycaster = new Raycaster()
  raycaster['x'] = x
  raycaster['y'] = y
  raycaster['angle'] = angle
  raycaster['gameTime'] = gameTime

  const ascii = raycaster.renderAscii(COLS, ROWS)
  console.log(`\n--- ${label} ---`)
  console.log(ascii)
  console.log('---')

  const lines = ascii.split('\n')
  const totalLines = lines.length
  const canvasW = COLS * CHAR_W
  const canvasH = totalLines * CHAR_H

  const canvas = createCanvas(canvasW, canvasH)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, canvasW, canvasH)

  ctx.fillStyle = '#00ff41'
  ctx.font = `${FONT_SIZE}px 'DejaVu Sans Mono', 'Courier New', monospace`
  ctx.textBaseline = 'top'

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (let j = 0; j < line.length; j++) {
      ctx.fillText(line[j], j * CHAR_W, i * CHAR_H)
    }
  }

  const outPath = resolve(outDir, filename)
  const buffer = canvas.toBuffer('image/png')
  writeFileSync(outPath, buffer)
  console.log(`Saved ${outPath}`)
}

function renderCloseup(filename: string, label: string, gameTime: number): void {
  const camX = 384, camY = -3418, camAngle = -2.8555
  const raycaster = new Raycaster()
  raycaster['x'] = camX
  raycaster['y'] = camY
  raycaster['angle'] = camAngle
  raycaster['gameTime'] = gameTime

  // Place first living enemy 60 units directly ahead of the camera
  const enemies = raycaster.getEnemies()
  const e = enemies[0]
  e.x = camX + Math.cos(camAngle) * 60
  e.y = camY - Math.sin(camAngle) * 60  // Doom Y flip
  e.alive = true
  e.typeId = 9  // Sergeant (SARG)

  const ascii = raycaster.renderAscii(COLS, ROWS)
  console.log(`\n--- ${label} ---`)
  console.log(ascii)
  console.log('---')

  const lines = ascii.split('\n')
  const canvasW = COLS * CHAR_W
  const canvasH = lines.length * CHAR_H
  const canvas = createCanvas(canvasW, canvasH)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, canvasW, canvasH)
  ctx.fillStyle = '#00ff41'
  ctx.font = `${FONT_SIZE}px 'DejaVu Sans Mono', 'Courier New', monospace`
  ctx.textBaseline = 'top'
  for (let i = 0; i < lines.length; i++) {
    for (let j = 0; j < lines[i].length; j++) {
      ctx.fillText(lines[i][j], j * CHAR_W, i * CHAR_H)
    }
  }
  const outPath = resolve(outDir, filename)
  writeFileSync(outPath, canvas.toBuffer('image/png'))
  console.log(`Saved ${outPath}`)
}

// Enemy-facing view (Sergeant at ~384, -3418)
renderAndSave(384, -3418, -2.8555, 'frame.png', 'Enemy-facing view')

// Spawn-angle view (player spawn in hangar — use actual spawn angle)
renderAndSave(1056, -3616, 4.71238898038469, 'frame-spawn.png', 'Spawn view (hangar)')

// Close-up: camera at enemy-facing pos, enemy teleported 60 units ahead (animation frame 0)
renderCloseup('frame-closeup.png', 'Sergeant close-up anim frame 0', 0)

// Same, animation frame 3 (mid-walk cycle)
renderCloseup('frame-anim.png', 'Sergeant close-up anim frame 3', 3 * 0.15)
