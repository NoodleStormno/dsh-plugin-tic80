/**
 * TIC-80 World Map Engine
 *
 * Grid: 240 x 136 tiles (32,640 tiles)
 * Values: 0-255 (tile IDs referencing Bank 0)
 * Format: 2 hex characters per tile (480 hex chars per line in <MAP> chunk)
 */
import { MAP_WIDTH, MAP_HEIGHT } from './types.js';
export class WorldMap {
    tiles = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
    getTile(x, y) {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT)
            return 0;
        return this.tiles[y * MAP_WIDTH + x];
    }
    setTile(x, y, tileId) {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT)
            return;
        this.tiles[y * MAP_WIDTH + x] = tileId & 0xff;
    }
    fillRect(x, y, w, h, tileId) {
        x = Math.floor(x);
        y = Math.floor(y);
        w = Math.floor(w);
        h = Math.floor(h);
        if (w < 0) {
            x = x + w + 1;
            w = -w;
        }
        if (h < 0) {
            y = y + h + 1;
            h = -h;
        }
        for (let r = 0; r < h; r++) {
            const cy = y + r;
            if (cy < 0 || cy >= MAP_HEIGHT)
                continue;
            for (let c = 0; c < w; c++) {
                const cx = x + c;
                if (cx < 0 || cx >= MAP_WIDTH)
                    continue;
                this.tiles[cy * MAP_WIDTH + cx] = tileId & 0xff;
            }
        }
    }
    copyRect(srcX, srcY, w, h, dstX, dstY) {
        srcX = Math.floor(srcX);
        srcY = Math.floor(srcY);
        w = Math.floor(w);
        h = Math.floor(h);
        dstX = Math.floor(dstX);
        dstY = Math.floor(dstY);
        const temp = new Uint8Array(w * h);
        for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) {
                temp[r * w + c] = this.getTile(srcX + c, srcY + r);
            }
        }
        for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) {
                this.setTile(dstX + c, dstY + r, temp[r * w + c]);
            }
        }
    }
    /**
     * Load map area from an ASCII diagram.
     * Preserves column indentation (spaces) and row positions without destructive trimming.
     */
    loadFromAscii(startX, startY, asciiRows, legend) {
        startX = Math.floor(startX);
        startY = Math.floor(startY);
        let rows;
        if (Array.isArray(asciiRows)) {
            rows = asciiRows.map(String);
        }
        else {
            const raw = String(asciiRows).split(/\r?\n/);
            // Remove only initial/trailing empty newline rows
            while (raw.length > 0 && raw[0].trim().length === 0)
                raw.shift();
            while (raw.length > 0 && raw[raw.length - 1].trim().length === 0)
                raw.pop();
            rows = raw;
        }
        if (rows.length === 0)
            return { width: 0, height: 0, startX, startY };
        const height = rows.length;
        const width = Math.max(...rows.map(r => r.length));
        for (let r = 0; r < height; r++) {
            const y = startY + r;
            if (y < 0)
                continue;
            if (y >= MAP_HEIGHT)
                break;
            const rowStr = rows[r];
            for (let c = 0; c < rowStr.length; c++) {
                const x = startX + c;
                if (x < 0)
                    continue;
                if (x >= MAP_WIDTH)
                    break;
                const ch = rowStr[c];
                if (legend[ch] !== undefined) {
                    this.setTile(x, y, legend[ch]);
                }
            }
        }
        return { width, height, startX, startY };
    }
    /**
     * Render a map region as an ASCII diagram with reverse legend.
     */
    toAscii(x = 0, y = 0, w = 30, h = 17, reverseLegend) {
        const defaultLegend = {
            0: '.',
            1: '#',
            2: '$',
            3: '@',
            4: '*',
            5: '+',
            6: '=',
            7: '!',
        };
        const legend = { ...defaultLegend, ...reverseLegend };
        const lines = [];
        for (let r = 0; r < h; r++) {
            const cy = y + r;
            if (cy >= MAP_HEIGHT)
                break;
            let line = '';
            for (let c = 0; c < w; c++) {
                const cx = x + c;
                if (cx >= MAP_WIDTH)
                    break;
                const tile = this.getTile(cx, cy);
                line += legend[tile] || (tile < 16 ? tile.toString(16) : '?');
            }
            lines.push(line);
        }
        return lines.join('\n');
    }
    toChunkLines() {
        const lines = [];
        for (let y = 0; y < MAP_HEIGHT; y++) {
            let hasData = false;
            let hex = '';
            const rowStart = y * MAP_WIDTH;
            for (let x = 0; x < MAP_WIDTH; x++) {
                const tile = this.tiles[rowStart + x];
                if (tile !== 0)
                    hasData = true;
                // In TIC-80 official specification (BinarySections[MAP].flip = true):
                // Low nibble is output first, followed by high nibble
                const low = (tile & 0x0f).toString(16);
                const high = ((tile >> 4) & 0x0f).toString(16);
                hex += low + high;
            }
            if (hasData) {
                const rowStr = y.toString().padStart(3, '0');
                lines.push(`-- ${rowStr}:${hex}`);
            }
        }
        return lines;
    }
    loadFromChunkLine(line) {
        const match = line.match(/--\s*(\d+):([0-9a-fA-F]+)/);
        if (!match)
            return;
        const y = parseInt(match[1], 10);
        const hex = match[2];
        if (y < 0 || y >= MAP_HEIGHT)
            return;
        const rowStart = y * MAP_WIDTH;
        for (let i = 0; i < hex.length && (i / 2) < MAP_WIDTH; i += 2) {
            // In TIC-80 official specification: first hex character is low nibble, second is high nibble
            const low = parseInt(hex[i], 16);
            const high = parseInt(hex[i + 1] || '0', 16);
            const tileId = (high << 4) | low;
            this.tiles[rowStart + Math.floor(i / 2)] = tileId;
        }
    }
    getRawData() {
        return this.tiles;
    }
    loadRawData(buffer) {
        const len = Math.min(buffer.length, this.tiles.length);
        this.tiles.set(buffer.subarray(0, len));
    }
}
//# sourceMappingURL=map.js.map