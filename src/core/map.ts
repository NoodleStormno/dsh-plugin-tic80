/**
 * TIC-80 World Map Engine
 * 
 * Grid: 240 x 136 tiles (32,640 tiles)
 * Values: 0-255 (tile IDs referencing Bank 0)
 * Format: 2 hex characters per tile (480 hex chars per line in <MAP> chunk)
 */

import { MAP_WIDTH, MAP_HEIGHT } from './types.js';

export class WorldMap {
  private tiles: Uint8Array = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);

  getTile(x: number, y: number): number {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return 0;
    return this.tiles[y * MAP_WIDTH + x];
  }

  setTile(x: number, y: number, tileId: number) {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return;
    this.tiles[y * MAP_WIDTH + x] = tileId & 0xff;
  }

  fillRect(x: number, y: number, w: number, h: number, tileId: number) {
    for (let r = 0; r < h; r++) {
      const cy = y + r;
      if (cy < 0 || cy >= MAP_HEIGHT) continue;
      for (let c = 0; c < w; c++) {
        const cx = x + c;
        if (cx < 0 || cx >= MAP_WIDTH) continue;
        this.tiles[cy * MAP_WIDTH + cx] = tileId & 0xff;
      }
    }
  }

  copyRect(srcX: number, srcY: number, w: number, h: number, dstX: number, dstY: number) {
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
   * Example:
   *   ########
   *   #......#
   *   #..P...#
   *   ########
   * legend: { '#': 1, '.': 0, 'P': 2 }
   */
  loadFromAscii(
    startX: number,
    startY: number,
    asciiRows: string[] | string,
    legend: Record<string, number>
  ): { width: number; height: number } {
    const rows = Array.isArray(asciiRows) ? asciiRows : asciiRows.trim().split(/\r?\n/);
    const cleaned = rows.map(r => r.trim()).filter(r => r.length > 0);
    if (cleaned.length === 0) return { width: 0, height: 0 };

    const height = cleaned.length;
    const width = Math.max(...cleaned.map(r => r.length));

    for (let r = 0; r < height; r++) {
      const y = startY + r;
      if (y >= MAP_HEIGHT) break;
      for (let c = 0; c < cleaned[r].length; c++) {
        const x = startX + c;
        if (x >= MAP_WIDTH) break;
        const ch = cleaned[r][c];
        const tileId = legend[ch] !== undefined ? legend[ch] : 0;
        this.setTile(x, y, tileId);
      }
    }

    return { width, height };
  }

  /**
   * Render a map region as an ASCII diagram with reverse legend.
   */
  toAscii(
    x: number = 0,
    y: number = 0,
    w: number = 30,
    h: number = 17,
    reverseLegend?: Record<number, string>
  ): string {
    const defaultLegend: Record<number, string> = {
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

    const lines: string[] = [];
    for (let r = 0; r < h; r++) {
      const cy = y + r;
      if (cy >= MAP_HEIGHT) break;
      let line = '';
      for (let c = 0; c < w; c++) {
        const cx = x + c;
        if (cx >= MAP_WIDTH) break;
        const tile = this.getTile(cx, cy);
        line += legend[tile] || (tile < 16 ? tile.toString(16) : '?');
      }
      lines.push(line);
    }
    return lines.join('\n');
  }

  toChunkLines(): string[] {
    const lines: string[] = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      let hasData = false;
      let hex = '';
      const rowStart = y * MAP_WIDTH;
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = this.tiles[rowStart + x];
        if (tile !== 0) hasData = true;
        hex += tile.toString(16).padStart(2, '0');
      }
      if (hasData) {
        const rowStr = y.toString().padStart(3, '0');
        lines.push(`-- ${rowStr}:${hex}`);
      }
    }
    return lines;
  }

  loadFromChunkLine(line: string) {
    const match = line.match(/--\s*(\d+):([0-9a-fA-F]+)/);
    if (!match) return;
    const y = parseInt(match[1], 10);
    const hex = match[2];
    if (y < 0 || y >= MAP_HEIGHT) return;

    const rowStart = y * MAP_WIDTH;
    for (let i = 0; i < hex.length && (i / 2) < MAP_WIDTH; i += 2) {
      const tileId = parseInt(hex.substring(i, i + 2), 16);
      this.tiles[rowStart + Math.floor(i / 2)] = tileId;
    }
  }

  getRawData(): Uint8Array {
    return this.tiles;
  }

  loadRawData(buffer: Uint8Array) {
    const len = Math.min(buffer.length, this.tiles.length);
    this.tiles.set(buffer.subarray(0, len));
  }
}
