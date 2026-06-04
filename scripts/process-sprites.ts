import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

const WAD_PATH = resolve(process.cwd(), 'doom1.wad')
const OUT_PATH = resolve(process.cwd(), 'src/data/sprite-data.ts')
mkdirSync(dirname(OUT_PATH), { recursive: true })

const SPRITE_COLS = 8
const SPRITE_ROWS = 12
const ASCII_RAMP = " .'`^\",: ;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"

function sqrtGamma(v: number): number {
  return Math.round(Math.sqrt(v / 255) * 255)
}

interface Lump {
  offset: number
  size: number
  name: string
}

function readLumpName(buf: Buffer, offset: number): string {
  let name = ''
  for (let i = 0; i < 8; i++) {
    const c = buf[offset + i]
    if (c === 0) break
    name += String.fromCharCode(c)
  }
  return name
}

function parseDirectory(buf: Buffer): Lump[] {
  const numLumps = buf.readInt32LE(4)
  const dirOffset = buf.readInt32LE(8)
  const lumps: Lump[] = []
  for (let i = 0; i < numLumps; i++) {
    const base = dirOffset + i * 16
    lumps.push({
      offset: buf.readInt32LE(base),
      size: buf.readInt32LE(base + 4),
      name: readLumpName(buf, base + 8),
    })
  }
  return lumps
}

function loadPalette(wad: Buffer, lumps: Lump[]): number[] {
  const playpal = lumps.find(l => l.name === 'PLAYPAL')
  if (!playpal) throw new Error('PLAYPAL lump not found')
  const palette: number[] = []
  for (let i = 0; i < 256; i++) {
    const base = playpal.offset + i * 3
    palette.push(wad[base], wad[base + 1], wad[base + 2])
  }
  return palette
}

function parsePatch(wad: Buffer, lump: Lump, palette: number[]): number[][] {
  const off = lump.offset
  const width = wad.readUInt16LE(off)
  const height = wad.readUInt16LE(off + 2)

  // Initialize pixels to -1 (transparent)
  const pixels: number[][] = []
  for (let y = 0; y < height; y++) {
    pixels.push(new Array(width).fill(-1))
  }

  // Read column offsets (uint32LE each)
  for (let col = 0; col < width; col++) {
    let colOff = wad.readUInt32LE(off + 8 + col * 4)
    // Parse posts in this column
    while (true) {
      const topdelta = wad[off + colOff]
      if (topdelta === 0xff) break
      colOff++
      const length = wad[off + colOff]
      colOff++
      colOff++ // padding byte
      for (let i = 0; i < length; i++) {
        const paletteIdx = wad[off + colOff]
        colOff++
        const y = topdelta + i
        if (y >= 0 && y < height) {
          const r = palette[paletteIdx * 3]
          const g = palette[paletteIdx * 3 + 1]
          const b = palette[paletteIdx * 3 + 2]
          // Luminance via perceptual weighting
          pixels[y][col] = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
        }
      }
      colOff++ // trailing padding byte
    }
  }

  return pixels
}

function downsample(pixels: number[][], patchWidth: number, patchHeight: number): string[] {
  const rows: string[] = []
  for (let sy = 0; sy < SPRITE_ROWS; sy++) {
    let row = ''
    for (let sx = 0; sx < SPRITE_COLS; sx++) {
      const srcX = Math.floor((sx / SPRITE_COLS) * patchWidth)
      const srcY = Math.floor((sy / SPRITE_ROWS) * patchHeight)
      const lum = pixels[srcY]?.[srcX] ?? -1
      if (lum < 0) {
        row += ' '
      } else {
        const corrected = sqrtGamma(lum)
        row += ASCII_RAMP[Math.floor((corrected / 255) * (ASCII_RAMP.length - 1))]
      }
    }
    rows.push(row)
  }
  return rows
}

const wad = readFileSync(WAD_PATH)
const lumps = parseDirectory(wad)
const palette = loadPalette(wad, lumps)

const SPRITE_PREFIXES = ['POSS', 'SPOS', 'TROO', 'SARG', 'BOSS', 'HEAD', 'SKUL']

// Build a lookup map for lumps by name for quick access
const lumpByName = new Map<string, Lump>()
for (const lump of lumps) {
  lumpByName.set(lump.name, lump)
}

const spriteData: Record<string, string[][]> = {}

for (const prefix of SPRITE_PREFIXES) {
  const frames: string[][] = []

  // Find all lumps matching {prefix}[A-Z]1 (angle 1, exact name length = 6)
  // Names are like POSSA1, POSSB1, etc.
  const matchingLumps: Array<{ letter: string; lump: Lump }> = []

  for (const lump of lumps) {
    const name = lump.name
    // Must be exactly 6 chars: 4 prefix + 1 frame letter + 1 angle digit
    if (name.length !== 6) continue
    if (!name.startsWith(prefix)) continue
    const frameLetter = name[4]
    const angleDigit = name[5]
    // Only angle 1 facing camera, frame letter must be A-Z
    if (angleDigit !== '1') continue
    if (frameLetter < 'A' || frameLetter > 'Z') continue

    matchingLumps.push({ letter: frameLetter, lump })
  }

  // Sort by frame letter
  matchingLumps.sort((a, b) => a.letter.localeCompare(b.letter))

  for (const { lump } of matchingLumps) {
    if (lump.size === 0) continue
    try {
      const pixels = parsePatch(wad, lump, palette)
      const patchWidth = wad.readUInt16LE(lump.offset)
      const patchHeight = wad.readUInt16LE(lump.offset + 2)
      const frameRows = downsample(pixels, patchWidth, patchHeight)
      frames.push(frameRows)
    } catch (e) {
      console.warn(`Failed to parse sprite ${lump.name}: ${e}`)
    }
  }

  console.log(`${prefix}: ${frames.length} frames found`)
  spriteData[prefix] = frames
}

// Serialize sprite data
function serializeFrames(frames: string[][]): string {
  if (frames.length === 0) return '[]'
  const frameStrs = frames.map(frame => {
    const rowStrs = frame.map(row => JSON.stringify(row))
    return `    [\n      ${rowStrs.join(',\n      ')}\n    ]`
  })
  return `[\n${frameStrs.join(',\n')}\n  ]`
}

const spriteEntries = SPRITE_PREFIXES.map(prefix => {
  return `  ${prefix}: ${serializeFrames(spriteData[prefix] ?? [])}`
}).join(',\n')

const out = `// Auto-generated by scripts/process-sprites.ts — do not edit
// Each sprite: array of frames, each frame: array of ${SPRITE_ROWS} rows (each ${SPRITE_COLS} chars wide)
export const SPRITES: Record<string, string[][]> = {
${spriteEntries}
}

export const SPRITE_BY_TYPE: Record<number, string> = {
  3004: 'POSS',
  9: 'SPOS',
  65: 'CPOS',
  3001: 'TROO',
  3002: 'SARG',
  58: 'SARG',
  3003: 'BOSS',
  3005: 'HEAD',
  3006: 'SKUL',
}

// seconds per animation frame
export const SPRITE_FRAME_DURATION = 0.15
`

writeFileSync(OUT_PATH, out)
console.log(`Wrote ${OUT_PATH}`)
