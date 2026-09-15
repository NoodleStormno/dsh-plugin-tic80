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
import { MAX_SFX, SFX_NOTES_COUNT, MAX_PATTERNS, PATTERN_ROWS, MUSIC_CHANNELS, MAX_TRACKS, TRACK_FRAMES, MAX_WAVEFORMS, WAVEFORM_SIZE, } from './types.js';
export const NOTE_NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
export function parseNoteString(str) {
    const trimmed = str.trim().toUpperCase();
    if (trimmed === '---' || trimmed === '...' || trimmed === '') {
        return { note: -1, octave: 0 };
    }
    const match = trimmed.match(/^([A-G][#\-]?)(\d)$/);
    if (!match)
        return null;
    const name = match[1].length === 1 ? match[1] + '-' : match[1];
    const octave = parseInt(match[2], 10);
    const noteIndex = NOTE_NAMES.indexOf(name);
    if (noteIndex === -1)
        return null;
    return { note: noteIndex, octave };
}
export function formatNote(note, octave) {
    if (note < 0 || note >= 12 || octave < 1)
        return '---';
    return `${NOTE_NAMES[note]}${octave}`;
}
export class AudioManager {
    waveforms = new Uint8Array(MAX_WAVEFORMS * WAVEFORM_SIZE); // 16 * 32 nibbles
    sfxList = [];
    patterns = [];
    tracks = [];
    constructor() {
        this.initDefaultWaveforms();
        this.initEmptyData();
    }
    initDefaultWaveforms() {
        // 0: Sine
        for (let i = 0; i < 32; i++) {
            const v = Math.round((Math.sin((i / 32) * Math.PI * 2) + 1) * 7.5);
            this.waveforms[i] = Math.max(0, Math.min(15, v));
        }
        // 1: Triangle
        for (let i = 0; i < 32; i++) {
            const v = i < 16 ? Math.round((i / 15) * 15) : Math.round(((31 - i) / 15) * 15);
            this.waveforms[32 + i] = v;
        }
        // 2: Sawtooth
        for (let i = 0; i < 32; i++) {
            this.waveforms[64 + i] = Math.round((i / 31) * 15);
        }
        // 3: Square (50% pulse)
        for (let i = 0; i < 32; i++) {
            this.waveforms[96 + i] = i < 16 ? 15 : 0;
        }
        // 4: Pulse (25%)
        for (let i = 0; i < 32; i++) {
            this.waveforms[128 + i] = i < 8 ? 15 : 0;
        }
        // Fill remaining with triangle/pulse harmonics
        for (let w = 5; w < 16; w++) {
            for (let i = 0; i < 32; i++) {
                this.waveforms[w * 32 + i] = (i * w) % 16;
            }
        }
    }
    initEmptyData() {
        this.sfxList = [];
        for (let i = 0; i < MAX_SFX; i++) {
            const notes = [];
            for (let n = 0; n < SFX_NOTES_COUNT; n++) {
                notes.push({ note: -1, octave: 4, volume: 0, wave: 0, arpeggio: 0 });
            }
            this.sfxList.push({ id: i, notes, speed: 6 });
        }
        this.patterns = [];
        for (let i = 0; i < MAX_PATTERNS; i++) {
            const rows = [];
            for (let r = 0; r < PATTERN_ROWS; r++) {
                const channels = [];
                for (let c = 0; c < MUSIC_CHANNELS; c++) {
                    channels.push({ note: -1, octave: 4, sfx: -1, volume: 15 });
                }
                rows.push(channels);
            }
            this.patterns.push({ id: i, rows });
        }
        this.tracks = [];
        for (let i = 0; i < MAX_TRACKS; i++) {
            this.tracks.push({
                id: i,
                patterns: new Array(TRACK_FRAMES).fill(-1),
                tempo: 120,
                speed: 6,
            });
        }
    }
    // --- Waveforms ---
    getWaveform(index) {
        const start = (index & 15) * 32;
        return Array.from(this.waveforms.subarray(start, start + 32));
    }
    setWaveform(index, samples) {
        const start = (index & 15) * 32;
        for (let i = 0; i < 32 && i < samples.length; i++) {
            this.waveforms[start + i] = Math.max(0, Math.min(15, samples[i] & 0x0f));
        }
    }
    // --- SFX ---
    getSFX(id) {
        return this.sfxList[id & 63];
    }
    setSFX(id, data) {
        const sfx = this.sfxList[id & 63];
        if (!sfx)
            return;
        if (data.speed !== undefined)
            sfx.speed = Math.max(1, Math.min(64, data.speed));
        if (data.notes) {
            for (let i = 0; i < SFX_NOTES_COUNT && i < data.notes.length; i++) {
                sfx.notes[i] = { ...data.notes[i] };
            }
        }
    }
    /**
     * Create an SFX from a preset sound type:
     * 'jump', 'coin', 'laser', 'explosion', 'hit', 'powerup', 'blip', 'pickup'
     */
    createPresetSFX(id, presetType) {
        const sfx = this.sfxList[id & 63];
        const type = presetType.toLowerCase();
        // Reset notes
        for (let i = 0; i < SFX_NOTES_COUNT; i++) {
            sfx.notes[i] = { note: -1, octave: 4, volume: 0, wave: 0, arpeggio: 0 };
        }
        switch (type) {
            case 'jump':
                sfx.speed = 3;
                // Rising pitch
                for (let i = 0; i < 10; i++) {
                    sfx.notes[i] = {
                        note: (i * 2) % 12,
                        octave: 3 + Math.floor((i * 2) / 12),
                        volume: 15 - Math.floor(i * 1.2),
                        wave: 1, // triangle/square
                        arpeggio: 0,
                    };
                }
                break;
            case 'coin':
                sfx.speed = 4;
                // B-4 then E-5
                sfx.notes[0] = { note: 11, octave: 4, volume: 15, wave: 3, arpeggio: 0 };
                sfx.notes[1] = { note: 11, octave: 4, volume: 14, wave: 3, arpeggio: 0 };
                sfx.notes[2] = { note: 4, octave: 5, volume: 15, wave: 3, arpeggio: 0 };
                sfx.notes[3] = { note: 4, octave: 5, volume: 13, wave: 3, arpeggio: 0 };
                sfx.notes[4] = { note: 4, octave: 5, volume: 10, wave: 3, arpeggio: 0 };
                sfx.notes[5] = { note: 4, octave: 5, volume: 6, wave: 3, arpeggio: 0 };
                break;
            case 'laser':
                sfx.speed = 2;
                // Rapid falling pitch
                for (let i = 0; i < 12; i++) {
                    sfx.notes[i] = {
                        note: (11 - i) % 12,
                        octave: 5 - Math.floor(i / 6),
                        volume: 15 - i,
                        wave: 2, // sawtooth
                        arpeggio: 0,
                    };
                }
                break;
            case 'explosion':
                sfx.speed = 5;
                // Low pitch, descending noise
                for (let i = 0; i < 16; i++) {
                    sfx.notes[i] = {
                        note: (i * 5) % 12,
                        octave: 1 + (i % 2),
                        volume: Math.max(0, 15 - i),
                        wave: 4, // noise-like pulse
                        arpeggio: (i * 3) % 16,
                    };
                }
                break;
            case 'hit':
                sfx.speed = 2;
                sfx.notes[0] = { note: 2, octave: 4, volume: 15, wave: 3, arpeggio: 0 };
                sfx.notes[1] = { note: 0, octave: 3, volume: 12, wave: 2, arpeggio: 0 };
                sfx.notes[2] = { note: 9, octave: 2, volume: 8, wave: 2, arpeggio: 0 };
                sfx.notes[3] = { note: 5, octave: 2, volume: 4, wave: 2, arpeggio: 0 };
                break;
            case 'powerup':
                sfx.speed = 3;
                const notes = [0, 4, 7, 11, 0, 4, 7, 12];
                for (let i = 0; i < notes.length; i++) {
                    sfx.notes[i] = {
                        note: notes[i] % 12,
                        octave: 4 + Math.floor(notes[i] / 12),
                        volume: 14,
                        wave: 3,
                        arpeggio: 0,
                    };
                }
                break;
            case 'blip':
            default:
                sfx.speed = 2;
                sfx.notes[0] = { note: 7, octave: 5, volume: 15, wave: 3, arpeggio: 0 };
                sfx.notes[1] = { note: 7, octave: 5, volume: 8, wave: 3, arpeggio: 0 };
                break;
        }
        return sfx;
    }
    // --- Patterns & Music ---
    getPattern(id) {
        return this.patterns[id & 63];
    }
    setPatternRow(patternId, row, channel, data) {
        const pat = this.patterns[patternId & 63];
        if (!pat || row < 0 || row >= PATTERN_ROWS || channel < 0 || channel >= MUSIC_CHANNELS)
            return;
        const cell = pat.rows[row][channel];
        if (data.note !== undefined)
            cell.note = data.note;
        if (data.octave !== undefined)
            cell.octave = data.octave;
        if (data.sfx !== undefined)
            cell.sfx = data.sfx;
        if (data.volume !== undefined)
            cell.volume = data.volume;
    }
    getTrack(id) {
        return this.tracks[id & 63];
    }
    setTrack(id, data) {
        const track = this.tracks[id & 63];
        if (!track)
            return;
        if (data.tempo !== undefined)
            track.tempo = data.tempo;
        if (data.speed !== undefined)
            track.speed = data.speed;
        if (data.patterns) {
            for (let i = 0; i < TRACK_FRAMES && i < data.patterns.length; i++) {
                track.patterns[i] = data.patterns[i];
            }
        }
    }
    /**
     * Compose a pattern using simple note list strings for 4 channels.
     * e.g. { channel0: ["C-4", "E-4", "G-4"], channel1: ["C-2", "---", "C-2"] }
     */
    composePattern(patternId, channels, defaultSfx = 0) {
        const pat = this.patterns[patternId & 63];
        if (!pat)
            return;
        const chLists = [channels.channel0, channels.channel1, channels.channel2, channels.channel3];
        for (let c = 0; c < 4; c++) {
            const list = chLists[c];
            if (!list)
                continue;
            for (let r = 0; r < PATTERN_ROWS && r < list.length; r++) {
                const parsed = parseNoteString(list[r]);
                if (parsed) {
                    this.setPatternRow(patternId, r, c, {
                        note: parsed.note,
                        octave: parsed.octave,
                        sfx: parsed.note >= 0 ? defaultSfx : -1,
                        volume: parsed.note >= 0 ? 15 : 0,
                    });
                }
            }
        }
    }
    // --- Serialization for Text Cart (.lua) ---
    toWavesChunkLines() {
        const lines = [];
        for (let i = 0; i < MAX_WAVEFORMS; i++) {
            const start = i * 32;
            let hex = '';
            for (let j = 0; j < 32; j++) {
                hex += (this.waveforms[start + j] & 0x0f).toString(16);
            }
            const idStr = i.toString().padStart(3, '0');
            lines.push(`-- ${idStr}:${hex}`);
        }
        return lines;
    }
    toSFXChunkLines() {
        const lines = [];
        for (let i = 0; i < MAX_SFX; i++) {
            const sfx = this.sfxList[i];
            let hasData = false;
            for (const n of sfx.notes) {
                if (n.note >= 0 || n.volume > 0) {
                    hasData = true;
                    break;
                }
            }
            if (hasData) {
                // SFX format in TIC-80: 30 notes packed into hex
                let hex = sfx.speed.toString(16).padStart(2, '0');
                for (const n of sfx.notes) {
                    const noteVal = n.note < 0 ? 0 : (n.octave * 12 + n.note);
                    hex += noteVal.toString(16).padStart(2, '0') +
                        (n.volume & 0xf).toString(16) +
                        (n.wave & 0xf).toString(16) +
                        (n.arpeggio & 0xf).toString(16);
                }
                const idStr = i.toString().padStart(3, '0');
                lines.push(`-- ${idStr}:${hex}`);
            }
        }
        return lines;
    }
    toPatternsChunkLines() {
        const lines = [];
        for (let i = 0; i < MAX_PATTERNS; i++) {
            const pat = this.patterns[i];
            let hasData = false;
            for (const row of pat.rows) {
                for (const ch of row) {
                    if (ch.note >= 0) {
                        hasData = true;
                        break;
                    }
                }
            }
            if (hasData) {
                let hex = '';
                for (const row of pat.rows) {
                    for (const ch of row) {
                        const noteVal = ch.note < 0 ? 0 : (ch.octave * 12 + ch.note);
                        const sfxVal = ch.sfx < 0 ? 0 : ch.sfx;
                        hex += noteVal.toString(16).padStart(2, '0') +
                            sfxVal.toString(16).padStart(2, '0') +
                            (ch.volume & 0xf).toString(16);
                    }
                }
                const idStr = i.toString().padStart(3, '0');
                lines.push(`-- ${idStr}:${hex}`);
            }
        }
        return lines;
    }
    toTracksChunkLines() {
        const lines = [];
        for (let i = 0; i < MAX_TRACKS; i++) {
            const t = this.tracks[i];
            let hasData = false;
            for (const p of t.patterns) {
                if (p >= 0) {
                    hasData = true;
                    break;
                }
            }
            if (hasData) {
                let hex = t.tempo.toString(16).padStart(2, '0') + t.speed.toString(16).padStart(2, '0');
                for (const p of t.patterns) {
                    hex += (p < 0 ? 255 : p).toString(16).padStart(2, '0');
                }
                const idStr = i.toString().padStart(3, '0');
                lines.push(`-- ${idStr}:${hex}`);
            }
        }
        return lines;
    }
    loadFromSFXLine(line) {
        const match = line.match(/--\s*(\d+):([0-9a-fA-F]+)/);
        if (!match)
            return;
        const id = parseInt(match[1], 10);
        const hex = match[2];
        if (id < 0 || id >= MAX_SFX)
            return;
        const sfx = this.sfxList[id];
        sfx.speed = parseInt(hex.substring(0, 2), 16) || 6;
        let offset = 2;
        for (let i = 0; i < SFX_NOTES_COUNT && offset + 5 <= hex.length; i++) {
            const noteVal = parseInt(hex.substring(offset, offset + 2), 16);
            const volume = parseInt(hex.substring(offset + 2, offset + 3), 16);
            const wave = parseInt(hex.substring(offset + 3, offset + 4), 16);
            const arpeggio = parseInt(hex.substring(offset + 4, offset + 5), 16);
            offset += 5;
            sfx.notes[i] = {
                note: noteVal === 0 ? -1 : noteVal % 12,
                octave: Math.floor(noteVal / 12) || 4,
                volume,
                wave,
                arpeggio,
            };
        }
    }
    loadFromWavesLine(line) {
        const match = line.match(/--\s*(\d+):([0-9a-fA-F]+)/);
        if (!match)
            return;
        const id = parseInt(match[1], 10);
        const hex = match[2];
        if (id < 0 || id >= MAX_WAVEFORMS)
            return;
        const start = id * 32;
        for (let i = 0; i < 32 && i < hex.length; i++) {
            this.waveforms[start + i] = parseInt(hex[i], 16) & 0x0f;
        }
    }
    loadFromPatternsLine(line) {
        const match = line.match(/--\s*(\d+):([0-9a-fA-F]+)/);
        if (!match)
            return;
        const pid = parseInt(match[1], 10);
        const hex = match[2];
        if (pid < 0 || pid >= MAX_PATTERNS)
            return;
        const pat = this.patterns[pid];
        let offset = 0;
        for (let r = 0; r < PATTERN_ROWS && offset + 5 <= hex.length; r++) {
            for (let ch = 0; ch < MUSIC_CHANNELS && offset + 5 <= hex.length; ch++) {
                const noteVal = parseInt(hex.substring(offset, offset + 2), 16);
                const sfx = parseInt(hex.substring(offset + 2, offset + 4), 16);
                const volume = parseInt(hex.substring(offset + 4, offset + 5), 16);
                offset += 5;
                pat.rows[r][ch] = {
                    note: noteVal === 0 ? -1 : noteVal % 12,
                    octave: Math.floor(noteVal / 12),
                    sfx: sfx === 0 ? -1 : sfx,
                    volume,
                };
            }
        }
    }
    loadFromTracksLine(line) {
        const match = line.match(/--\s*(\d+):([0-9a-fA-F]+)/);
        if (!match)
            return;
        const tid = parseInt(match[1], 10);
        const hex = match[2];
        if (tid < 0 || tid >= MAX_TRACKS)
            return;
        const t = this.tracks[tid];
        t.tempo = parseInt(hex.substring(0, 2), 16) || 120;
        t.speed = parseInt(hex.substring(2, 4), 16) || 6;
        let offset = 4;
        for (let i = 0; i < TRACK_FRAMES && offset + 2 <= hex.length; i++) {
            const p = parseInt(hex.substring(offset, offset + 2), 16);
            t.patterns[i] = p === 255 ? -1 : p;
            offset += 2;
        }
    }
    getRawWaveforms() {
        return this.waveforms;
    }
    loadRawWaveforms(buffer) {
        const len = Math.min(buffer.length, this.waveforms.length);
        this.waveforms.set(buffer.subarray(0, len));
    }
}
//# sourceMappingURL=audio.js.map