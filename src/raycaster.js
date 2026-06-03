import { VERTS, LINEDEFS, SIDEDEF_SECTORS, SECTOR_LIGHT, PLAYER_X, PLAYER_Y, PLAYER_ANGLE, } from './e1m1-data';
const FOV = Math.PI / 3;
const MOVE_SPEED = 100;
const TURN_SPEED = 2.0;
const RAMP = ' .:;+*#@';
// 0xFFFF in a linedef's left sidedef slot means "no sidedef" → one-sided solid wall.
const NO_SIDEDEF = 0xffff;
export class Raycaster {
    constructor() {
        this.x = PLAYER_X;
        this.y = PLAYER_Y;
        this.angle = PLAYER_ANGLE;
    }
    castRay(rayAngle) {
        const dx = Math.cos(rayAngle);
        // Doom world Y axis: north = positive Y in WAD, but our angle convention treats
        // 0=east/90=north with screen-style flip handled here.
        const dy = -Math.sin(rayAngle);
        let minT = Infinity;
        let hitLight = 128;
        const numLinedefs = LINEDEFS.length / 4;
        for (let i = 0; i < numLinedefs; i++) {
            const v1i = LINEDEFS[i * 4];
            const v2i = LINEDEFS[i * 4 + 1];
            const rightSide = LINEDEFS[i * 4 + 2];
            const leftSide = LINEDEFS[i * 4 + 3];
            if (leftSide !== NO_SIDEDEF)
                continue;
            const x1 = VERTS[v1i * 2];
            const y1 = VERTS[v1i * 2 + 1];
            const x2 = VERTS[v2i * 2];
            const y2 = VERTS[v2i * 2 + 1];
            const segDx = x2 - x1;
            const segDy = y2 - y1;
            const denom = dx * segDy - dy * segDx;
            if (Math.abs(denom) < 1e-8)
                continue;
            const tx1 = x1 - this.x;
            const ty1 = y1 - this.y;
            const t = (tx1 * segDy - ty1 * segDx) / denom;
            const u = (tx1 * dy - ty1 * dx) / denom;
            if (t > 0 && u >= 0 && u <= 1 && t < minT) {
                minT = t;
                if (rightSide !== NO_SIDEDEF) {
                    const sectorIdx = SIDEDEF_SECTORS[rightSide];
                    hitLight = SECTOR_LIGHT[sectorIdx];
                }
            }
        }
        return { dist: minT === Infinity ? 10000 : minT, light: hitLight };
    }
    renderAscii(cols, rows) {
        const SCALE = rows * 64;
        const lines = new Array(rows);
        for (let row = 0; row < rows; row++)
            lines[row] = '';
        for (let col = 0; col < cols; col++) {
            const rayAngle = this.angle - FOV / 2 + (col / cols) * FOV;
            const { dist, light } = this.castRay(rayAngle);
            const perpDist = Math.abs(dist * Math.cos(rayAngle - this.angle));
            const wallH = Math.min(rows, Math.floor(SCALE / (perpDist + 1)));
            const wallTop = Math.floor((rows - wallH) / 2);
            const wallBot = wallTop + wallH;
            const lightF = light / 255;
            const rampIdx = Math.floor(lightF * (RAMP.length - 1));
            const wallCh = RAMP[rampIdx];
            for (let row = 0; row < rows; row++) {
                let ch;
                if (row < wallTop || row >= wallBot) {
                    ch = row < rows / 2 ? '.' : ',';
                }
                else {
                    ch = wallCh;
                }
                lines[row] += ch;
            }
        }
        return lines.join('\n');
    }
    moveForward(dt) {
        this.x += Math.cos(this.angle) * MOVE_SPEED * dt;
        this.y -= Math.sin(this.angle) * MOVE_SPEED * dt;
    }
    moveBack(dt) {
        this.x -= Math.cos(this.angle) * MOVE_SPEED * dt;
        this.y += Math.sin(this.angle) * MOVE_SPEED * dt;
    }
    turnLeft(dt) {
        this.angle += TURN_SPEED * dt;
    }
    turnRight(dt) {
        this.angle -= TURN_SPEED * dt;
    }
    shoot() { }
}
