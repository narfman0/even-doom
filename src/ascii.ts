// Density ramp: index 0 = brightest (white), last = darkest (black)
const RAMP = ' .:;+*#@'

export function frameToAscii(imageData: ImageData, cols: number, rows: number): string {
  const { data, width, height } = imageData
  const cellW = width / cols
  const cellH = height / rows
  const lines: string[] = []

  for (let row = 0; row < rows; row++) {
    let line = ''
    for (let col = 0; col < cols; col++) {
      const x0 = Math.floor(col * cellW)
      const y0 = Math.floor(row * cellH)
      const x1 = Math.min(width, Math.floor((col + 1) * cellW))
      const y1 = Math.min(height, Math.floor((row + 1) * cellH))

      let totalLuminance = 0
      let count = 0

      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const base = (py * width + px) * 4
          const r = data[base]
          const g = data[base + 1]
          const b = data[base + 2]
          // BT.601 luminance approximation
          totalLuminance += 0.299 * r + 0.587 * g + 0.114 * b
          count++
        }
      }

      const avg = count > 0 ? totalLuminance / count : 0
      // avg is 0–255; map to RAMP index (bright → sparse chars, dark → dense chars)
      const rampIdx = Math.min(RAMP.length - 1, Math.floor((avg / 255) * RAMP.length))
      // Invert so brighter pixels get lighter (less dense) characters
      const charIdx = RAMP.length - 1 - rampIdx
      line += RAMP[charIdx]
    }
    lines.push(line)
  }

  return lines.join('\n')
}
