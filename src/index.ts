import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  OsEventTypeList,
  ImuReportPace,
} from '@evenrealities/even_hub_sdk'
import { Raycaster } from './raycaster'
import { Controls } from './controls'

const CONTAINER_ID_GAME = 1

// 58×24 fits within the 2000-char upgrade limit (58 * 24 + 23 newlines = 1415 chars)
const ASCII_COLS = 58
const ASCII_ROWS = 24

const TARGET_FPS = 10
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS

async function main() {
  const bridge = await waitForEvenAppBridge()

  const gameContainer = new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: 576,
    height: 288,
    borderWidth: 0,
    paddingLength: 0,
    containerID: CONTAINER_ID_GAME,
    containerName: 'game',
    content: 'Loading...',
    isEventCapture: 1,
  })

  await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({
      containerTotalNum: 1,
      textObject: [gameContainer],
    })
  )

  async function pushText(content: string) {
    await bridge.textContainerUpgrade({ containerID: CONTAINER_ID_GAME, content } as any)
  }

  await pushText('DOOM')
  await new Promise(resolve => setTimeout(resolve, 800))

  const raycaster = new Raycaster()
  const controls = new Controls()

  let lastTime = Date.now()
  let running = true

  function tick() {
    if (!running) return

    const now = Date.now()
    const dt = Math.min((now - lastTime) / 1000, 0.1)
    lastTime = now

    const state = controls.getState()

    if (state.turnRate !== 0) {
      if (state.turnRate > 0) {
        raycaster.turnRight(Math.abs(state.turnRate) * dt)
      } else {
        raycaster.turnLeft(Math.abs(state.turnRate) * dt)
      }
    }

    if (state.moveForward) raycaster.moveForward(dt)
    if (state.moveBack) raycaster.moveBack(dt)
    if (state.shoot) raycaster.shoot()

    const ascii = raycaster.renderAscii(ASCII_COLS, ASCII_ROWS)
    pushText(ascii).catch(console.error)
  }

  setInterval(tick, FRAME_INTERVAL_MS)

  await bridge.imuControl(true, ImuReportPace.P200)

  bridge.onEvenHubEvent((event) => {
    const sys = event.sysEvent

    if (!sys) return

    if (sys.imuData) {
      const { x, y, z } = sys.imuData
      controls.onImu(x ?? 0, y ?? 0, z ?? 0)
      return
    }

    if (sys.eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
      controls.onScrollUp()
    } else if (sys.eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      controls.onScrollDown()
    } else if (sys.eventType === OsEventTypeList.CLICK_EVENT) {
      controls.onTap()
    } else if (sys.eventType === OsEventTypeList.FOREGROUND_ENTER_EVENT) {
      running = true
    } else if (sys.eventType === OsEventTypeList.FOREGROUND_EXIT_EVENT) {
      running = false
    }
  })
}

main().catch(console.error)
