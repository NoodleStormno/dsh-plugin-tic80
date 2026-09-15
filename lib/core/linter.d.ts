/**
 * TIC-80 Cartridge Static Analysis & Linter
 *
 * Verifies:
 * - Code syntax and structure
 * - TIC() main loop existence
 * - Code size constraints (max 512KB)
 * - Safe sandbox usage (no banned os/io modules)
 * - Resource references (spr, sfx, music, map calls)
 * - TIC-80 API compliance
 */
import { CartridgeValidationResult } from './types.js';
import { SpriteSheet } from './sprites.js';
import { WorldMap } from './map.js';
import { AudioManager } from './audio.js';
export declare const TIC80_API_WHITELIST: Set<string>;
export declare const BANNED_MODULES: string[];
export declare class CartridgeLinter {
    static validate(code: string, sprites?: SpriteSheet, map?: WorldMap, audio?: AudioManager): CartridgeValidationResult;
}
//# sourceMappingURL=linter.d.ts.map