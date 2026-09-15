/**
 * TIC-80 Type Definitions and Constants
 *
 * TIC-80 is a fantasy computer for making, playing and sharing tiny games.
 * Screen: 240x136 pixels, 16 color palette.
 * Memory: 8 banks, 256 tiles + 256 sprites per bank, 240x136 map, 64 SFX, 64 music patterns.
 */
export const SCREEN_WIDTH = 240;
export const SCREEN_HEIGHT = 136;
export const SPRITE_SIZE = 8;
export const SPRITES_PER_BANK = 256;
export const TOTAL_SPRITES = 512; // 256 tiles (bank 0) + 256 sprites (bank 1)
export const MAP_WIDTH = 240;
export const MAP_HEIGHT = 136;
export const MAX_SFX = 64;
export const SFX_NOTES_COUNT = 30;
export const MAX_PATTERNS = 64;
export const PATTERN_ROWS = 64;
export const MUSIC_CHANNELS = 4;
export const MAX_TRACKS = 64;
export const TRACK_FRAMES = 16;
export const MAX_WAVEFORMS = 16;
export const WAVEFORM_SIZE = 32; // 32 nibbles (4-bit values: 0-15)
export const PALETTE_COLORS = 16;
/** TIC-80 binary chunk IDs (Official Specification) */
export var ChunkType;
(function (ChunkType) {
    ChunkType[ChunkType["DUMMY"] = 0] = "DUMMY";
    ChunkType[ChunkType["TILES"] = 1] = "TILES";
    ChunkType[ChunkType["SPRITES"] = 2] = "SPRITES";
    ChunkType[ChunkType["COVER"] = 3] = "COVER";
    ChunkType[ChunkType["MAP"] = 4] = "MAP";
    ChunkType[ChunkType["CODE"] = 5] = "CODE";
    ChunkType[ChunkType["FLAGS"] = 6] = "FLAGS";
    ChunkType[ChunkType["SAMPLES"] = 9] = "SAMPLES";
    ChunkType[ChunkType["WAVEFORM"] = 10] = "WAVEFORM";
    ChunkType[ChunkType["PALETTE"] = 12] = "PALETTE";
    ChunkType[ChunkType["MUSIC"] = 14] = "MUSIC";
    ChunkType[ChunkType["PATTERNS"] = 15] = "PATTERNS";
    ChunkType[ChunkType["DEFAULT"] = 17] = "DEFAULT";
})(ChunkType || (ChunkType = {}));
//# sourceMappingURL=types.js.map