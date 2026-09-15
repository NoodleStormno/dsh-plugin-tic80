/**
 * TIC-80 World Map Engine
 *
 * Grid: 240 x 136 tiles (32,640 tiles)
 * Values: 0-255 (tile IDs referencing Bank 0)
 * Format: 2 hex characters per tile (480 hex chars per line in <MAP> chunk)
 */
export declare class WorldMap {
    private tiles;
    getTile(x: number, y: number): number;
    setTile(x: number, y: number, tileId: number): void;
    fillRect(x: number, y: number, w: number, h: number, tileId: number): void;
    copyRect(srcX: number, srcY: number, w: number, h: number, dstX: number, dstY: number): void;
    /**
     * Load map area from an ASCII diagram.
     * Preserves column indentation (spaces) and row positions without destructive trimming.
     */
    loadFromAscii(startX: number, startY: number, asciiRows: string[] | string, legend: Record<string, number>): {
        width: number;
        height: number;
        startX: number;
        startY: number;
    };
    /**
     * Render a map region as an ASCII diagram with reverse legend.
     */
    toAscii(x?: number, y?: number, w?: number, h?: number, reverseLegend?: Record<number, string>): string;
    toChunkLines(): string[];
    loadFromChunkLine(line: string): void;
    getRawData(): Uint8Array;
    loadRawData(buffer: Uint8Array): void;
}
//# sourceMappingURL=map.d.ts.map