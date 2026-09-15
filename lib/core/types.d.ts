/**
 * TIC-80 Type Definitions and Constants
 *
 * TIC-80 is a fantasy computer for making, playing and sharing tiny games.
 * Screen: 240x136 pixels, 16 color palette.
 * Memory: 8 banks, 256 tiles + 256 sprites per bank, 240x136 map, 64 SFX, 64 music patterns.
 */
export declare const SCREEN_WIDTH = 240;
export declare const SCREEN_HEIGHT = 136;
export declare const SPRITE_SIZE = 8;
export declare const SPRITES_PER_BANK = 256;
export declare const TOTAL_SPRITES = 512;
export declare const MAP_WIDTH = 240;
export declare const MAP_HEIGHT = 136;
export declare const MAX_SFX = 64;
export declare const SFX_NOTES_COUNT = 30;
export declare const MAX_PATTERNS = 64;
export declare const PATTERN_ROWS = 64;
export declare const MUSIC_CHANNELS = 4;
export declare const MAX_TRACKS = 64;
export declare const TRACK_FRAMES = 16;
export declare const MAX_WAVEFORMS = 16;
export declare const WAVEFORM_SIZE = 32;
export declare const PALETTE_COLORS = 16;
/** TIC-80 binary chunk IDs (Official Specification) */
export declare enum ChunkType {
    DUMMY = 0,
    TILES = 1,
    SPRITES = 2,
    COVER = 3,
    MAP = 4,
    CODE = 5,
    FLAGS = 6,
    SAMPLES = 9,
    WAVEFORM = 10,
    PALETTE = 12,
    MUSIC = 14,
    PATTERNS = 15,
    DEFAULT = 17
}
export interface CartridgeMetadata {
    title?: string;
    author?: string;
    desc?: string;
    script?: string;
    input?: string;
    saveid?: string;
    version?: string;
    [key: string]: string | undefined;
}
export interface RGBColor {
    r: number;
    g: number;
    b: number;
}
export interface SFXNote {
    note: number;
    octave: number;
    volume: number;
    wave: number;
    arpeggio: number;
}
export interface SFXData {
    id: number;
    notes: SFXNote[];
    speed: number;
    reverse?: boolean;
    pitch?: number;
}
export interface ChannelRow {
    note: number;
    octave: number;
    sfx: number;
    volume: number;
}
export interface PatternData {
    id: number;
    rows: ChannelRow[][];
}
export interface TrackData {
    id: number;
    patterns: number[];
    tempo: number;
    speed: number;
}
export interface CartridgeValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    stats: {
        codeBytes: number;
        definedTilesCount: number;
        definedSpritesCount: number;
        definedSfxCount: number;
        definedPatternsCount: number;
        definedTracksCount: number;
        hasMainLoop: boolean;
    };
}
//# sourceMappingURL=types.d.ts.map