/**
 * TIC-80 16-color Palette Manager & Presets
 */
import { PALETTE_COLORS } from './types.js';
export const SWEETIE_16 = [
    { r: 0x1a, g: 0x1c, b: 0x2c }, // 0: Black/Deep Navy
    { r: 0x5d, g: 0x27, b: 0x5d }, // 1: Dark Purple
    { r: 0xb1, g: 0x3e, b: 0x53 }, // 2: Crimson
    { r: 0xef, g: 0x7d, b: 0x57 }, // 3: Orange
    { r: 0xff, g: 0xcd, b: 0x75 }, // 4: Yellow
    { r: 0xa7, g: 0xf0, b: 0x70 }, // 5: Light Green
    { r: 0x38, g: 0xb7, b: 0x64 }, // 6: Green
    { r: 0x25, g: 0x71, b: 0x79 }, // 7: Dark Cyan
    { r: 0x29, g: 0x36, b: 0x6f }, // 8: Dark Blue
    { r: 0x3b, g: 0x5d, b: 0xc9 }, // 9: Blue
    { r: 0x41, g: 0xa6, b: 0xf6 }, // 10: Light Blue
    { r: 0x73, g: 0xef, b: 0xf7 }, // 11: Cyan
    { r: 0xf4, g: 0xf4, b: 0xf4 }, // 12: White
    { r: 0x94, g: 0xb0, b: 0xc2 }, // 13: Light Gray
    { r: 0x56, g: 0x6c, b: 0x86 }, // 14: Dark Gray
    { r: 0x33, g: 0x3c, b: 0x57 }, // 15: Dark Slate
];
export const PICO_8 = [
    { r: 0x00, g: 0x00, b: 0x00 }, // 0: Black
    { r: 0x1d, g: 0x2b, b: 0x53 }, // 1: Dark Blue
    { r: 0x7e, g: 0x25, b: 0x53 }, // 2: Dark Purple
    { r: 0x00, g: 0x87, b: 0x51 }, // 3: Dark Green
    { r: 0xab, g: 0x52, b: 0x36 }, // 4: Brown
    { r: 0x5f, g: 0x57, b: 0x4f }, // 5: Dark Gray
    { r: 0xc2, g: 0xc3, b: 0xc7 }, // 6: Light Gray
    { r: 0xff, g: 0xf1, b: 0xe8 }, // 7: White
    { r: 0xff, g: 0x00, b: 0x4d }, // 8: Red
    { r: 0xff, g: 0xa3, b: 0x00 }, // 9: Orange
    { r: 0xff, g: 0xec, b: 0x27 }, // 10: Yellow
    { r: 0x00, g: 0xe4, b: 0x36 }, // 11: Green
    { r: 0x29, g: 0xad, b: 0xff }, // 12: Blue
    { r: 0x83, g: 0x76, b: 0x9c }, // 13: Lavender
    { r: 0xff, g: 0x77, b: 0xa8 }, // 14: Pink
    { r: 0xff, g: 0xcc, b: 0xaa }, // 15: Peach
];
export const DB16 = [
    { r: 0x14, g: 0x0c, b: 0x1c },
    { r: 0x44, g: 0x24, b: 0x34 },
    { r: 0x30, g: 0x34, b: 0x6d },
    { r: 0x4e, g: 0x4a, b: 0x4e },
    { r: 0x85, g: 0x4c, b: 0x30 },
    { r: 0x34, g: 0x65, b: 0x24 },
    { r: 0xd0, g: 0x46, b: 0x48 },
    { r: 0x75, g: 0x71, b: 0x61 },
    { r: 0x59, g: 0x7d, b: 0xce },
    { r: 0xd2, g: 0x7d, b: 0x2c },
    { r: 0x85, g: 0x95, b: 0xa1 },
    { r: 0x6d, g: 0xaa, b: 0x2c },
    { r: 0xd2, g: 0xaa, b: 0x99 },
    { r: 0x6d, g: 0xc2, b: 0xca },
    { r: 0xda, g: 0xd4, b: 0x5e },
    { r: 0xde, g: 0xee, b: 0xd6 },
];
export const GAMEBOY_16 = [
    { r: 0x08, g: 0x18, b: 0x20 },
    { r: 0x18, g: 0x28, b: 0x30 },
    { r: 0x20, g: 0x38, b: 0x40 },
    { r: 0x28, g: 0x48, b: 0x50 },
    { r: 0x34, g: 0x68, b: 0x56 },
    { r: 0x40, g: 0x78, b: 0x60 },
    { r: 0x50, g: 0x88, b: 0x68 },
    { r: 0x60, g: 0x98, b: 0x70 },
    { r: 0x70, g: 0xa8, b: 0x78 },
    { r: 0x80, g: 0xb8, b: 0x78 },
    { r: 0x88, g: 0xc0, b: 0x70 },
    { r: 0x98, g: 0xc8, b: 0x68 },
    { r: 0xa8, g: 0xd0, b: 0x60 },
    { r: 0xb8, g: 0xd8, b: 0x58 },
    { r: 0xc8, g: 0xe0, b: 0x50 },
    { r: 0xe0, g: 0xf8, b: 0xd0 },
];
export const CYBERPUNK_16 = [
    { r: 0x05, g: 0x05, b: 0x10 },
    { r: 0x1b, g: 0x0a, b: 0x2a },
    { r: 0x3c, g: 0x00, b: 0x40 },
    { r: 0x72, g: 0x00, b: 0x5f },
    { r: 0xb5, g: 0x00, b: 0x67 },
    { r: 0xf7, g: 0x25, b: 0x85 },
    { r: 0x72, g: 0x09, b: 0xb7 },
    { r: 0x3a, g: 0x0c, b: 0xa3 },
    { r: 0x43, g: 0x61, b: 0xee },
    { r: 0x4c, g: 0xc9, b: 0xf0 },
    { r: 0x00, g: 0xf5, b: 0xd4 },
    { r: 0x7b, g: 0x2c, b: 0xbf },
    { r: 0x9d, g: 0x4e, b: 0xdd },
    { r: 0xe0, g: 0xaa, b: 0xff },
    { r: 0xff, g: 0xff, b: 0xff },
    { r: 0x10, g: 0x10, b: 0x18 },
];
export const PALETTE_PRESETS = {
    sweetie16: SWEETIE_16,
    pico8: PICO_8,
    db16: DB16,
    gameboy: GAMEBOY_16,
    cyberpunk: CYBERPUNK_16,
};
export class Palette {
    colors;
    constructor(colors) {
        this.colors = colors ? colors.slice(0, PALETTE_COLORS) : SWEETIE_16.map(c => ({ ...c }));
        while (this.colors.length < PALETTE_COLORS) {
            this.colors.push({ r: 0, g: 0, b: 0 });
        }
    }
    getColor(index) {
        return this.colors[index & 0xf] || { r: 0, g: 0, b: 0 };
    }
    setColor(index, color) {
        if (index >= 0 && index < PALETTE_COLORS) {
            this.colors[index] = {
                r: Math.max(0, Math.min(255, color.r)),
                g: Math.max(0, Math.min(255, color.g)),
                b: Math.max(0, Math.min(255, color.b)),
            };
        }
    }
    getHex(index) {
        const c = this.getColor(index);
        return `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`;
    }
    setFromPreset(presetName) {
        const preset = PALETTE_PRESETS[presetName.toLowerCase().replace(/[^a-z0-9]/g, '')];
        if (preset) {
            this.colors = preset.map(c => ({ ...c }));
            return true;
        }
        return false;
    }
    /** Convert to TIC-80 <PALETTE> section 48-char hex format (16 * 3 bytes) */
    toChunkHex() {
        let hex = '';
        for (let i = 0; i < PALETTE_COLORS; i++) {
            const c = this.colors[i];
            hex += c.r.toString(16).padStart(2, '0') +
                c.g.toString(16).padStart(2, '0') +
                c.b.toString(16).padStart(2, '0');
        }
        return hex;
    }
    /** Load from TIC-80 48-char hex string */
    loadFromChunkHex(hex) {
        const clean = hex.replace(/[^0-9a-fA-F]/g, '');
        for (let i = 0; i < PALETTE_COLORS && i * 6 + 6 <= clean.length; i++) {
            const r = parseInt(clean.substring(i * 6, i * 6 + 2), 16);
            const g = parseInt(clean.substring(i * 6 + 2, i * 6 + 4), 16);
            const b = parseInt(clean.substring(i * 6 + 4, i * 6 + 6), 16);
            this.setColor(i, { r, g, b });
        }
    }
    findClosestColor(r, g, b) {
        let closestIndex = 0;
        let minDistance = Infinity;
        for (let i = 0; i < PALETTE_COLORS; i++) {
            const c = this.colors[i];
            // Weighted Euclidean color distance
            const dr = r - c.r;
            const dg = g - c.g;
            const db = b - c.b;
            const dist = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
            if (dist < minDistance) {
                minDistance = dist;
                closestIndex = i;
            }
        }
        return closestIndex;
    }
    getAllColors() {
        return this.colors.map(c => ({ ...c }));
    }
    clone() {
        return new Palette(this.getAllColors());
    }
}
//# sourceMappingURL=palette.js.map