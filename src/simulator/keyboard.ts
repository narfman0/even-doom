import { InputState } from '../core/types'

export class Keyboard {
  private held = new Map<string, ReturnType<typeof setTimeout>>()

  constructor() {
    if (process.stdin.isTTY) process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (key: string) => this.onKey(key))
  }

  private onKey(key: string): void {
    if (key === '' || key === 'q') {
      process.stdout.write('\x1b[?25h\x1b[2J\x1b[H')
      process.exit(0)
    }
    const existing = this.held.get(key)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => this.held.delete(key), 150)
    this.held.set(key, timer)
  }

  getState(): InputState {
    const forward = this.held.has('w') || this.held.has('[A')
    const back = this.held.has('s') || this.held.has('[B')
    const left = this.held.has('a') || this.held.has('[D')
    const right = this.held.has('d') || this.held.has('[C')
    const shoot = this.held.has(' ') || this.held.has('\r')
    return {
      moveForward: forward,
      moveBack: back,
      turnRate: left ? -1.5 : right ? 1.5 : 0,
      shoot,
    }
  }
}
