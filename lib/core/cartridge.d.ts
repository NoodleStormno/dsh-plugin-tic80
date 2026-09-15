/**
 * TIC-80 Cartridge Complete Model & Bidirectional Serializer
 *
 * Supports:
 * - Plain text cartridge (.lua, .js, .moon, etc.)
 * - Binary cartridge (.tic format with typed chunks)
 * - Safe asset boundary preservation
 * - Static analysis & validation
 */
import { CartridgeMetadata, CartridgeValidationResult } from './types.js';
import { Palette } from './palette.js';
import { SpriteSheet } from './sprites.js';
import { WorldMap } from './map.js';
import { AudioManager } from './audio.js';
export declare class Cartridge {
    metadata: CartridgeMetadata;
    code: string;
    palette: Palette;
    sprites: SpriteSheet;
    map: WorldMap;
    audio: AudioManager;
    constructor(initialCode?: string);
    /**
     * Parse a text cartridge (.lua) into this Cartridge instance.
     */
    loadFromText(content: string): void;
    /**
     * Serialize this Cartridge to a standard TIC-80 text cartridge (.lua).
     */
    toText(): string;
    /**
     * Serialize into binary .tic cartridge format.
     */
    toBinary(): Uint8Array;
    /**
     * Load from binary .tic cartridge format.
     */
    loadFromBinary(buffer: Uint8Array): void;
    validate(): CartridgeValidationResult;
}
//# sourceMappingURL=cartridge.d.ts.map