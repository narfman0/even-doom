import { Raycaster } from '../core/raycaster'
import { Keyboard } from './keyboard'

const COLS = 58
const ROWS = 24
const FPS = 10
const FRAME_MS = 1000 / FPS

const raycaster = new Raycaster()
const keyboard = new Keyboard()

process.stdout.write('\x1b[?25l')
process.stdout.write('\x1b[2J\x1b[H')

let lastTime = Date.now()

function tick() {
  const now = Date.now()
  const dt = Math.min((now - lastTime) / 1000, 0.1)
  lastTime = now

  const state = keyboard.getState()
  if (state.turnRate > 0) raycaster.turnRight(Math.abs(state.turnRate) * dt)
  else if (state.turnRate < 0) raycaster.turnLeft(Math.abs(state.turnRate) * dt)
  if (state.moveForward) raycaster.moveForward(dt)
  if (state.moveBack) raycaster.moveBack(dt)
  if (state.shoot) raycaster.shoot()
  raycaster.tick(dt)

  const frame = raycaster.renderAscii(COLS, ROWS)
  process.stdout.write('\x1b[H' + frame + '\n[WASD/arrows=move  space=shoot  q=quit]')
}

setInterval(tick, FRAME_MS)
