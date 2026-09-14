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
export enum ChunkType {
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
  DEFAULT = 17,
}

export interface CartridgeMetadata {
  title?: string;
  author?: string;
  desc?: string;
  script?: string; // lua, js, wren, moon, fennel, squirrel
  input?: string; // gamepad, mouse, keyboard
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
  note: number; // 0-11 (C, C#, D, D#, E, F, F#, G, G#, A, A#, B) or -1 for empty
  octave: number; // 1-8
  volume: number; // 0-15
  wave: number; // 0-15 (waveform index)
  arpeggio: number; // 0-15
}

export interface SFXData {
  id: number;
  notes: SFXNote[];
  speed: number; // tick duration
  reverse?: boolean;
  pitch?: number;
}

export interface ChannelRow {
  note: number; // 0-11, or -1 for empty
  octave: number; // 1-8
  sfx: number; // 0-63, or -1
  volume: number; // 0-15
}

export interface PatternData {
  id: number;
  rows: ChannelRow[][]; // 64 rows, each has 4 channels
}

export interface TrackData {
  id: number;
  patterns: number[]; // 16 frame pattern IDs
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
