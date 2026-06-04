# even-doom

A Wolfenstein-style raycaster running inside an EvenHub plugin for Even G2 smart glasses. The 3D scene is rendered in real time and converted to ASCII art, then pushed to the lens display at ~10 fps. No WAD files, no external assets — the raycaster and map are entirely self-contained TypeScript.

Based on the original Doom engine by id Software: https://github.com/id-software/doom

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

## Terminal simulator

Run the raycaster directly in your terminal — no browser, no glasses, no EvenHub required:

```sh
npm run simulator
```

| Key | Action |
|---|---|
| W / ↑ | Move forward |
| S / ↓ | Move back |
| A / ← | Turn left |
| D / → | Turn right |
| Space / Enter | Shoot |
| Q / Ctrl-C | Quit |

## Dev server workflow

```sh
npm run dev
```

Vite starts on `http://localhost:5173`. Use the EvenHub simulator to test locally without glasses:

```sh
evenhub-simulator http://localhost:5173 --automation-port 9898
```

In EvenHub developer mode on a real device, point the custom plugin URL at your machine's LAN IP (not `localhost`):

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

## Architecture and technical reference

See [AGENTS.md](AGENTS.md) for the full architecture, coordinate system notes, linedef structure, EvenHub SDK constraints, and known gaps.
