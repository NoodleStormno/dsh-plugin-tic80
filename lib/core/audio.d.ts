/**
 * TIC-80 Sound & Music Tracker Engine
 *
 * Includes:
 * - 16 Waveforms (32 nibbles each)
 * - 64 SFX (30 notes each: note, octave, volume, wave, arpeggio, speed)
 * - 64 Patterns (64 rows x 4 channels)
 * - 64 Music Tracks (16 frames, tempo, speed)
 * - SFX preset synthesizer (jump, coin, laser, explosion, hit, powerup, etc.)
 * - Note parser (e.g. "C-4", "F#5")
 */
import { SFXData, PatternData, TrackData, ChannelRow } from './types.js';
export declare const NOTE_NAMES: string[];
export declare function parseNoteString(str: string): {
    note: number;
    octave: number;
} | null;
export declare function formatNote(note: number, octave: number): string;
export declare class AudioManager {
    private waveforms;
    private sfxList;
    private patterns;
    private tracks;
    constructor();
    private initDefaultWaveforms;
    private initEmptyData;
    getWaveform(index: number): number[];
    setWaveform(index: number, samples: number[]): void;
    getSFX(id: number): SFXData | undefined;
    setSFX(id: number, data: Partial<SFXData>): void;
    /**
     * Create an SFX from a preset sound type:
     * 'jump', 'coin', 'laser', 'explosion', 'hit', 'powerup', 'blip', 'pickup'
     */
    createPresetSFX(id: number, presetType: string): SFXData;
    getPattern(id: number): PatternData | undefined;
    setPatternRow(patternId: number, row: number, channel: number, data: Partial<ChannelRow>): void;
    getTrack(id: number): TrackData | undefined;
    setTrack(id: number, data: Partial<TrackData>): void;
    /**
     * Compose a pattern using simple note list strings for 4 channels.
     * e.g. { channel0: ["C-4", "E-4", "G-4"], channel1: ["C-2", "---", "C-2"] }
     */
    composePattern(patternId: number, channels: {
        channel0?: string[];
        channel1?: string[];
        channel2?: string[];
        channel3?: string[];
    }, defaultSfx?: number): void;
    toWavesChunkLines(): string[];
    toSFXChunkLines(): string[];
    toPatternsChunkLines(): string[];
    toTracksChunkLines(): string[];
    loadFromSFXLine(line: string): void;
    loadFromWavesLine(line: string): void;
    loadFromPatternsLine(line: string): void;
    loadFromTracksLine(line: string): void;
    getRawWaveforms(): Uint8Array;
    loadRawWaveforms(buffer: Uint8Array): void;
}
//# sourceMappingURL=audio.d.ts.map