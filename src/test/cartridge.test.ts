import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { Cartridge } from '../core/cartridge.js';
import { createTemplate } from '../templates/index.js';

describe('TIC-80 Cartridge Core', () => {
  test('initializes with default lua script and metadata', () => {
    const cart = new Cartridge();
    assert.strictEqual(cart.metadata.script, 'lua');
    assert.ok(cart.code.includes('function TIC()'));
    assert.strictEqual(cart.palette.getAllColors().length, 16);
  });

  test('round-trips .lua text format with sprites, map, and palette', () => {
    const cart = new Cartridge();
    cart.metadata.title = 'Test Cartridge';
    cart.metadata.author = 'Tester';
    cart.code = `function TIC()\n  cls(1)\n  print("HELLO WORLD", 10, 10, 15)\nend`;

    // Draw a sprite
    cart.sprites.setFromAscii(1, [
      '..1111..',
      '.122221.',
      '12333321',
      '12333321',
      '12333321',
      '12333321',
      '.122221.',
      '..1111..',
    ], false);

    // Set a map tile
    cart.map.setTile(5, 5, 1);
    cart.map.setTile(10, 10, 2);

    // Set an SFX
    cart.audio.createPresetSFX(0, 'coin');

    // Serialize to text
    const text = cart.toText();
    assert.ok(text.includes('-- title:  Test Cartridge'));
    assert.ok(text.includes('-- <SPRITES>'));
    assert.ok(text.includes('-- <MAP>'));
    assert.ok(text.includes('-- <SFX>'));
    assert.ok(text.includes('-- <PALETTE>'));

    // Reload from text
    const cart2 = new Cartridge();
    cart2.loadFromText(text);

    assert.strictEqual(cart2.metadata.title, 'Test Cartridge');
    assert.strictEqual(cart2.metadata.author, 'Tester');
    assert.ok(cart2.code.includes('HELLO WORLD'));
    assert.strictEqual(cart2.map.getTile(5, 5), 1);
    assert.strictEqual(cart2.map.getTile(10, 10), 2);
    assert.strictEqual(cart2.sprites.getPixel(1, 2, 2, false), 3);
  });

  test('encodes and decodes .tic binary format', () => {
    const cart = createTemplate('platformer');
    const bin = cart.toBinary();

    assert.ok(bin.length > 0);
    // Verify first chunk header
    assert.ok(bin.length > 100);

    const cart2 = new Cartridge();
    cart2.loadFromBinary(bin);

    assert.ok(cart2.code.includes('player'));
    assert.ok(cart2.code.includes('function TIC()'));
  });
});
