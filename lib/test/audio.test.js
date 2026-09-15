import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { AudioManager, parseNoteString, formatNote } from '../core/audio.js';
describe('TIC-80 Audio Engine', () => {
    test('parses and formats musical notes', () => {
        const parsedC4 = parseNoteString('C-4');
        assert.deepStrictEqual(parsedC4, { note: 0, octave: 4 });
        const parsedFs5 = parseNoteString('F#5');
        assert.deepStrictEqual(parsedFs5, { note: 6, octave: 5 });
        const empty = parseNoteString('---');
        assert.deepStrictEqual(empty, { note: -1, octave: 0 });
        assert.strictEqual(formatNote(0, 4), 'C-4');
        assert.strictEqual(formatNote(6, 5), 'F#5');
    });
    test('synthesizes preset sound effects', () => {
        const audio = new AudioManager();
        const jumpSfx = audio.createPresetSFX(0, 'jump');
        assert.strictEqual(jumpSfx.id, 0);
        assert.ok(jumpSfx.notes.some(n => n.volume > 0));
        const coinSfx = audio.createPresetSFX(1, 'coin');
        assert.strictEqual(coinSfx.id, 1);
        assert.strictEqual(coinSfx.notes[0].note, 11); // B
        assert.strictEqual(coinSfx.notes[2].note, 4); // E
    });
    test('composes music patterns across 4 channels', () => {
        const audio = new AudioManager();
        audio.composePattern(0, {
            channel0: ['C-4', 'E-4', 'G-4', 'C-5'],
            channel1: ['C-2', '---', 'G-2', '---'],
        }, 1);
        const pat = audio.getPattern(0);
        assert.ok(pat);
        assert.strictEqual(pat.rows[0][0].note, 0); // C
        assert.strictEqual(pat.rows[0][0].octave, 4);
        assert.strictEqual(pat.rows[1][0].note, 4); // E
        assert.strictEqual(pat.rows[0][1].note, 0); // C
        assert.strictEqual(pat.rows[0][1].octave, 2);
    });
});
//# sourceMappingURL=audio.test.js.map