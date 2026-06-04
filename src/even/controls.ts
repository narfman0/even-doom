import { InputState } from '../core/types'

const IMU_DEAD_ZONE = 0.05
const IMU_TURN_SCALE = 3.0

export class Controls {
  private state: InputState = {
    turnRate: 0,
    moveForward: false,
    moveBack: false,
    shoot: false,
  }

  onImu(x: number, _y: number, _z: number): void {
    const clamped = Math.abs(x) < IMU_DEAD_ZONE ? 0 : x
    this.state.turnRate = clamped * IMU_TURN_SCALE
  }

  onScrollUp(): void {
    this.state.moveForward = true
    setTimeout(() => { this.state.moveForward = false }, 200)
  }

  onScrollDown(): void {
    this.state.moveBack = true
    setTimeout(() => { this.state.moveBack = false }, 200)
  }

  onTap(): void {
    this.state.shoot = true
    setTimeout(() => { this.state.shoot = false }, 100)
  }

  getState(): InputState {
    return { ...this.state }
  }
}
