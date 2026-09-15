/**
 * TIC-80 16-color Palette Manager & Presets
 */
import { RGBColor } from './types.js';
export declare const SWEETIE_16: RGBColor[];
export declare const PICO_8: RGBColor[];
export declare const DB16: RGBColor[];
export declare const GAMEBOY_16: RGBColor[];
export declare const CYBERPUNK_16: RGBColor[];
export declare const PALETTE_PRESETS: Record<string, RGBColor[]>;
export declare class Palette {
    private colors;
    constructor(colors?: RGBColor[]);
    getColor(index: number): RGBColor;
    setColor(index: number, color: RGBColor): void;
    getHex(index: number): string;
    setFromPreset(presetName: string): boolean;
    /** Convert to TIC-80 <PALETTE> section 48-char hex format (16 * 3 bytes) */
    toChunkHex(): string;
    /** Load from TIC-80 48-char hex string */
    loadFromChunkHex(hex: string): void;
    findClosestColor(r: number, g: number, b: number): number;
    getAllColors(): RGBColor[];
    clone(): Palette;
}
//# sourceMappingURL=palette.d.ts.map