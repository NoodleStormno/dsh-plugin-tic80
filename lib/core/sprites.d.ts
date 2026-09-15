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
export interface SpriteInfo {
    id: number;
    isTile: boolean;
    pixels: number[];
    flags: number;
}
export declare class SpriteSheet {
    private pixels;
    private flags;
    getPixel(spriteId: number, x: number, y: number, isTile?: boolean): number;
    setPixel(spriteId: number, x: number, y: number, color: number, isTile?: boolean): void;
    getSpritePixels(spriteId: number, isTile?: boolean): number[];
    setSpritePixels(spriteId: number, pixels: number[] | Uint8Array, isTile?: boolean): void;
    getFlag(spriteId: number, flagIndex: number, isTile?: boolean): boolean;
    setFlag(spriteId: number, flagIndex: number, value: boolean, isTile?: boolean): void;
    getFlagsByte(spriteId: number, isTile?: boolean): number;
    setFlagsByte(spriteId: number, flags: number, isTile?: boolean): void;
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
    setFromAscii(startSpriteId: number, asciiLines: string[] | string, isTile?: boolean, charMap?: Record<string, number>): {
        width: number;
        height: number;
        spriteIds: number[];
    };
    /**
     * Convert an 8x8 sprite to ASCII representation for easy visualization.
     */
    toAscii(spriteId: number, isTile?: boolean, emptyChar?: string): string;
    /**
     * Export section chunk lines for text format (.lua)
     * Bank 0 (tiles): <TILES>
     * Bank 1 (sprites): <SPRITES>
     */
    toChunkLines(isTile: boolean): string[];
    /**
     * Export <FLAGS> chunk lines
     */
    toFlagsChunkLines(): string[];
    /**
     * Load sprite data from text line: "-- 001:0123..."
     */
    loadFromChunkLine(line: string, isTile: boolean): void;
    /**
     * Load flags from text line: "-- 000:0102..."
     */
    loadFromFlagsLine(line: string): void;
    getRawPixels(): Uint8Array;
    getRawFlags(): Uint8Array;
    loadRawPixels(buffer: Uint8Array): void;
    loadRawFlags(buffer: Uint8Array): void;
}
//# sourceMappingURL=sprites.d.ts.map