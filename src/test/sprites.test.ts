import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { SpriteSheet } from '../core/sprites.js';

describe('TIC-80 Sprites & Tiles Engine', () => {
  test('gets and sets individual sprite pixels', () => {
    const sheet = new SpriteSheet();
    sheet.setPixel(0, 3, 4, 11, false);
    assert.strictEqual(sheet.getPixel(0, 3, 4, false), 11);
    assert.strictEqual(sheet.getPixel(0, 0, 0, false), 0);
  });

  test('parses ASCII pixel art with transparent dots and colors', () => {
    const sheet = new SpriteSheet();
    const res = sheet.setFromAscii(5, [
      '..4444..',
      '.4ffff4.',
      '4ffffff4',
      '4ffffff4',
      '4ffffff4',
      '4ffffff4',
      '.4ffff4.',
      '..4444..',
    ], false);

    assert.strictEqual(res.width, 8);
    assert.strictEqual(res.height, 8);
    assert.deepStrictEqual(res.spriteIds, [5]);

    // Check center pixel is 15 (hex 'f')
    assert.strictEqual(sheet.getPixel(5, 3, 3, false), 15);
    // Check corner is 0 (dot '.')
    assert.strictEqual(sheet.getPixel(5, 0, 0, false), 0);
    // Check border is 4
    assert.strictEqual(sheet.getPixel(5, 2, 0, false), 4);
  });

  test('converts sprite to ASCII representation', () => {
    const sheet = new SpriteSheet();
    sheet.setFromAscii(2, [
      '11111111',
      '1......1',
      '1......1',
      '1......1',
      '1......1',
      '1......1',
      '1......1',
      '11111111',
    ], true);

    const ascii = sheet.toAscii(2, true);
    assert.ok(ascii.includes('11111111'));
    assert.ok(ascii.includes('1......1'));
  });

  test('manages 8-bit sprite flags', () => {
    const sheet = new SpriteSheet();
    sheet.setFlag(10, 0, true, false); // flag 0 (e.g. solid)
    sheet.setFlag(10, 3, true, false); // flag 3 (e.g. dangerous)

    assert.strictEqual(sheet.getFlag(10, 0, false), true);
    assert.strictEqual(sheet.getFlag(10, 1, false), false);
    assert.strictEqual(sheet.getFlag(10, 3, false), true);
    assert.strictEqual(sheet.getFlagsByte(10, false), 1 | 8);
  });
});
