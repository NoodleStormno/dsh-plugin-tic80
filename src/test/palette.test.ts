import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { Palette, SWEETIE_16, PICO_8 } from '../core/palette.js';

describe('TIC-80 Palette Manager', () => {
  test('initializes with default Sweetie-16 colors', () => {
    const pal = new Palette();
    assert.deepStrictEqual(pal.getColor(0), SWEETIE_16[0]);
    assert.deepStrictEqual(pal.getColor(15), SWEETIE_16[15]);
  });

  test('switches to presets', () => {
    const pal = new Palette();
    const ok = pal.setFromPreset('pico8');
    assert.strictEqual(ok, true);
    assert.deepStrictEqual(pal.getColor(0), PICO_8[0]);
  });

  test('finds closest color in palette', () => {
    const pal = new Palette();
    // Color 12 is near-white (244, 244, 244)
    const closest = pal.findClosestColor(255, 255, 255);
    assert.strictEqual(closest, 12);
  });

  test('converts to and loads from 96-char hex string', () => {
    const pal = new Palette();
    const hex = pal.toChunkHex();
    assert.strictEqual(hex.length, 96);

    const pal2 = new Palette();
    pal2.loadFromChunkHex(hex);
    assert.deepStrictEqual(pal2.getAllColors(), pal.getAllColors());
  });
});
