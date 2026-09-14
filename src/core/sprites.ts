/**
 * TIC-80 Sprites & Tiles Engine
 * 
 * Supports:
 * - 256 Tiles (bank 0, id 0..255)
 * - 256 Sprites (bank 1, id 0..255)
 * - 8x8 pixel matrix (0-15 color indices)
 * - Multi-tile sprites (16x16, 24x24, 32x32)
 * - ASCII art generator & parser (e.g. LLM generated pixel art)
 * - Hex chunk encoder & decoder
 * - 8-bit Sprite flags
 */

import { SPRITE_SIZE, SPRITES_PER_BANK, TOTAL_SPRITES } from './types.js';

export interface SpriteInfo {
  id: number;
  isTile: boolean; // true = bank 0 (tiles), false = bank 1 (sprites)
  pixels: number[]; // 64 entries, values 0-15
  flags: number; // 0-255
}

export class SpriteSheet {
  // 512 sprites * 64 pixels = 32768 pixels total
  // Index 0..255: Tiles (bank 0)
  // Index 256..511: Sprites (bank 1)
  private pixels: Uint8Array = new Uint8Array(TOTAL_SPRITES * 64);
  private flags: Uint8Array = new Uint8Array(TOTAL_SPRITES);

  getPixel(spriteId: number, x: number, y: number, isTile: boolean = false): number {
    const globalId = (isTile ? 0 : 256) + (spriteId & 0xff);
    if (x < 0 || x >= SPRITE_SIZE || y < 0 || y >= SPRITE_SIZE) return 0;
    return this.pixels[globalId * 64 + y * SPRITE_SIZE + x] & 0x0f;
  }

  setPixel(spriteId: number, x: number, y: number, color: number, isTile: boolean = false) {
    const globalId = (isTile ? 0 : 256) + (spriteId & 0xff);
    if (x < 0 || x >= SPRITE_SIZE || y < 0 || y >= SPRITE_SIZE) return;
    this.pixels[globalId * 64 + y * SPRITE_SIZE + x] = color & 0x0f;
  }

  getSpritePixels(spriteId: number, isTile: boolean = false): number[] {
    const globalId = (isTile ? 0 : 256) + (spriteId & 0xff);
    const start = globalId * 64;
    return Array.from(this.pixels.subarray(start, start + 64));
  }

  setSpritePixels(spriteId: number, pixels: number[] | Uint8Array, isTile: boolean = false) {
    const globalId = (isTile ? 0 : 256) + (spriteId & 0xff);
    const start = globalId * 64;
    for (let i = 0; i < 64 && i < pixels.length; i++) {
      this.pixels[start + i] = pixels[i] & 0x0f;
    }
  }

  getFlag(spriteId: number, flagIndex: number, isTile: boolean = false): boolean {
    const globalId = (isTile ? 0 : 256) + (spriteId & 0xff);
    return ((this.flags[globalId] >> (flagIndex & 7)) & 1) === 1;
  }

  setFlag(spriteId: number, flagIndex: number, value: boolean, isTile: boolean = false) {
    const globalId = (isTile ? 0 : 256) + (spriteId & 0xff);
    if (value) {
      this.flags[globalId] |= (1 << (flagIndex & 7));
    } else {
      this.flags[globalId] &= ~(1 << (flagIndex & 7));
    }
  }

  getFlagsByte(spriteId: number, isTile: boolean = false): number {
    const globalId = (isTile ? 0 : 256) + (spriteId & 0xff);
    return this.flags[globalId];
  }

  setFlagsByte(spriteId: number, flags: number, isTile: boolean = false) {
    const globalId = (isTile ? 0 : 256) + (spriteId & 0xff);
    this.flags[globalId] = flags & 0xff;
  }

  /**
   * Parse ASCII Art representation into a sprite or multi-tile sprite.
   * Format example (8x8):
   *   ..1111..
   *   .122221.
   *   12333321
   *   ...
   * Character mapping:
   *   '.' or ' ' -> 0 (transparent)
   *   '0'-'9'    -> 0-9
   *   'a'-'f' / 'A'-'F' -> 10-15
   *   custom character mapping supported via charMap parameter.
   */
  setFromAscii(
    startSpriteId: number,
    asciiLines: string[] | string,
    isTile: boolean = false,
    charMap?: Record<string, number>
  ): { width: number; height: number; spriteIds: number[] } {
    const lines = Array.isArray(asciiLines) ? asciiLines : asciiLines.trim().split(/\r?\n/);
    const cleanedLines = lines.map(l => l.trim()).filter(l => l.length > 0);
    if (cleanedLines.length === 0) return { width: 0, height: 0, spriteIds: [] };

    const height = cleanedLines.length;
    const width = Math.max(...cleanedLines.map(l => l.length));

    // Calculate how many 8x8 tiles we need horizontally & vertically
    const tilesX = Math.ceil(width / 8);
    const tilesY = Math.ceil(height / 8);

    const defaultCharMap: Record<string, number> = {
      '.': 0, ' ': 0, '_': 0,
      '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
      '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
      'a': 10, 'b': 11, 'c': 12, 'd': 13, 'e': 14, 'f': 15,
      'A': 10, 'B': 11, 'C': 12, 'D': 13, 'E': 14, 'F': 15,
      ...charMap,
    };

    const usedSpriteIds: number[] = [];

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        // In TIC-80, sprites in a sheet are 16 sprites per row
        const currentSpriteId = startSpriteId + ty * 16 + tx;
        if (currentSpriteId >= SPRITES_PER_BANK) break;
        usedSpriteIds.push(currentSpriteId);

        const tilePixels = new Array(64).fill(0);
        for (let py = 0; py < 8; py++) {
          const srcY = ty * 8 + py;
          for (let px = 0; px < 8; px++) {
            const srcX = tx * 8 + px;
            if (srcY < height && srcX < cleanedLines[srcY].length) {
              const ch = cleanedLines[srcY][srcX];
              tilePixels[py * 8 + px] = defaultCharMap[ch] !== undefined ? defaultCharMap[ch] : 0;
            }
          }
        }
        this.setSpritePixels(currentSpriteId, tilePixels, isTile);
      }
    }

    return { width, height, spriteIds: usedSpriteIds };
  }

  /**
   * Convert an 8x8 sprite to ASCII representation for easy visualization.
   */
  toAscii(spriteId: number, isTile: boolean = false, emptyChar: string = '.'): string {
    const pixels = this.getSpritePixels(spriteId, isTile);
    const rows: string[] = [];
    for (let y = 0; y < 8; y++) {
      let row = '';
      for (let x = 0; x < 8; x++) {
        const val = pixels[y * 8 + x];
        row += val === 0 ? emptyChar : val.toString(16);
      }
      rows.push(row);
    }
    return rows.join('\n');
  }

  /**
   * Export section chunk lines for text format (.lua)
   * Bank 0 (tiles): <TILES>
   * Bank 1 (sprites): <SPRITES>
   */
  toChunkLines(isTile: boolean): string[] {
    const lines: string[] = [];
    const baseId = isTile ? 0 : 256;

    for (let id = 0; id < SPRITES_PER_BANK; id++) {
      const globalId = baseId + id;
      const start = globalId * 64;
      const spriteData = this.pixels.subarray(start, start + 64);
      
      // Only serialize non-empty sprites to keep cart compact
      let isEmpty = true;
      for (let i = 0; i < 64; i++) {
        if (spriteData[i] !== 0) {
          isEmpty = false;
          break;
        }
      }
      if (!isEmpty) {
        let hex = '';
        for (let i = 0; i < 64; i++) {
          hex += (spriteData[i] & 0x0f).toString(16);
        }
        const idStr = id.toString().padStart(3, '0');
        lines.push(`-- ${idStr}:${hex}`);
      }
    }
    return lines;
  }

  /**
   * Export <FLAGS> chunk lines
   */
  toFlagsChunkLines(): string[] {
    const lines: string[] = [];
    // 512 sprites flags, stored as hex lines
    for (let i = 0; i < TOTAL_SPRITES; i += 32) {
      let row = '';
      let hasData = false;
      for (let j = 0; j < 32 && (i + j) < TOTAL_SPRITES; j++) {
        const f = this.flags[i + j];
        if (f !== 0) hasData = true;
        row += f.toString(16).padStart(2, '0');
      }
      if (hasData) {
        const idStr = i.toString().padStart(3, '0');
        lines.push(`-- ${idStr}:${row}`);
      }
    }
    return lines;
  }

  /**
   * Load sprite data from text line: "-- 001:0123..."
   */
  loadFromChunkLine(line: string, isTile: boolean) {
    const match = line.match(/--\s*(\d+):([0-9a-fA-F]+)/);
    if (!match) return;
    const id = parseInt(match[1], 10);
    const hex = match[2];
    if (id < 0 || id >= SPRITES_PER_BANK) return;

    const pixels: number[] = [];
    for (let i = 0; i < hex.length && i < 64; i++) {
      pixels.push(parseInt(hex[i], 16));
    }
    this.setSpritePixels(id, pixels, isTile);
  }

  /**
   * Load flags from text line: "-- 000:0102..."
   */
  loadFromFlagsLine(line: string) {
    const match = line.match(/--\s*(\d+):([0-9a-fA-F]+)/);
    if (!match) return;
    const startId = parseInt(match[1], 10);
    const hex = match[2];
    for (let i = 0; i < hex.length && (startId + i / 2) < TOTAL_SPRITES; i += 2) {
      const val = parseInt(hex.substring(i, i + 2), 16);
      this.flags[startId + Math.floor(i / 2)] = val;
    }
  }

  getRawPixels(): Uint8Array {
    return this.pixels;
  }

  getRawFlags(): Uint8Array {
    return this.flags;
  }

  loadRawPixels(buffer: Uint8Array) {
    const len = Math.min(buffer.length, this.pixels.length);
    this.pixels.set(buffer.subarray(0, len));
  }

  loadRawFlags(buffer: Uint8Array) {
    const len = Math.min(buffer.length, this.flags.length);
    this.flags.set(buffer.subarray(0, len));
  }
}
