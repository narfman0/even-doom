# even-doom

A Wolfenstein-style raycaster running inside an EvenHub plugin for Even G2 smart glasses. The 3D scene is rendered in real time and converted to ASCII art, then pushed to the lens display at ~10 fps. No WAD files, no external assets — the raycaster and map are entirely self-contained TypeScript.

## Controls

| Input | Action |
|---|---|
| Tilt head left/right (IMU) | Turn left / right |
| Scroll ring up | Move forward (200ms burst) |
| Scroll ring down | Move back (200ms burst) |
| Single tap | Shoot |

## Build

Place `doom1.wad` (Doom shareware WAD) in the project root, then:

```sh
npm install && npm run build
```

The `prebuild` script automatically runs `scripts/process-wad.ts`, which extracts E1M1 geometry from `doom1.wad` and writes `src/e1m1-data.ts`. The WAD itself is not bundled — only the processed TypeScript constants. Output lands in `dist/`.

## Unit tests

```sh
npm test
```

Tests cover `frameToAscii` (output dimensions, luminance-to-character mapping) and `Controls` (IMU turn rate, move/shoot set and reset timing). No EvenHub runtime is needed — tests run in Node.

## Dev server workflow

```sh
npm run dev
```

Vite starts on `http://localhost:5173`. In EvenHub developer mode, point the custom plugin URL at your machine's LAN IP (not `localhost`):

```
http://192.168.1.x:5173
```

Your phone and dev machine must be on the same LAN (or Tailscale). Source changes hot-reload automatically.

## Sideload via EvenHub

1. Build (`npm run build`) or start the dev server (`npm run dev`)
2. EvenHub app → Settings → Developer mode → Enable
3. Add a custom plugin:
   - **Dev**: enter the Vite dev server URL (`http://192.168.1.x:5173`)
   - **Release**: serve `dist/` with any static file server and enter its URL
4. Open the plugin from the EvenHub app menu or glasses menu

## Architecture

The plugin runs entirely inside the EvenHub WebView — no server required.

- **`src/raycaster.ts`** — Wolfenstein-style DDA raycaster. Renders a 320×160 `ImageData` with distance-shaded walls on a 16×16 hardcoded map.
- **`src/ascii.ts`** — Converts `ImageData` to a 58×24 ASCII string using BT.601 luminance and a density ramp (`' .:;+*#@'`). At 58 cols × 24 rows the output is ~1415 chars, well within the 2000-char EvenHub upgrade limit.
- **`src/controls.ts`** — Maps IMU x-axis to turn rate and ring gestures to timed move/shoot pulses.
- **`src/index.ts`** — EvenHub bridge: creates the startup container, runs the game loop at 10 fps via `setInterval`, wires IMU events after startup.

## EvenHub SDK constraints

| Constraint | Limit |
|---|---|
| Canvas size | 576 × 288 px |
| Text content (upgrade) | Max 2000 chars |
| `createStartUpPageContainer` | Call once only |
| Event capture | Exactly one container may have `isEventCapture=1` |
| IMU pace `P200` | ~200ms between IMU samples |
