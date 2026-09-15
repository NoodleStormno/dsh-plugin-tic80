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

  test('strips leading metadata tags when setting code and updates metadata', () => {
    const cart = new Cartridge();
    const rawCodeWithHeaders = `-- title:  Super Runner
-- author: Alice
-- desc:   Endless runner game
-- script: lua
-- input:  gamepad

function TIC()
  cls(0)
  print("RUNNING", 10, 10, 14)
end
`;
    cart.setCode(rawCodeWithHeaders);

    assert.strictEqual(cart.metadata.title, 'Super Runner');
    assert.strictEqual(cart.metadata.author, 'Alice');
    assert.strictEqual(cart.metadata.desc, 'Endless runner game');
    assert.strictEqual(cart.metadata.script, 'lua');
    assert.strictEqual(cart.metadata.input, 'gamepad');

    // Code itself should NOT contain leading metadata tags
    assert.ok(!cart.code.includes('-- title:'));
    assert.ok(!cart.code.includes('-- author:'));
    assert.ok(cart.code.startsWith('function TIC()'));

    // toText() should output exactly ONE metadata header
    const text = cart.toText();
    const titleMatches = text.match(/-- title:/g);
    assert.strictEqual(titleMatches?.length, 1);
  });

  test('maintains strict byte-for-byte idempotency on repeated setCode(toText())', () => {
    const cart = createTemplate('sokoban');
    const text1 = cart.toText();

    // Call setCode with full serialized text (including header)
    cart.setCode(text1);
    const text2 = cart.toText();
    assert.strictEqual(text2, text1, 'First round-trip should be identical');
    assert.strictEqual(Buffer.byteLength(text2), Buffer.byteLength(text1));

    // Call setCode repeatedly 5 times
    for (let i = 0; i < 5; i++) {
      cart.setCode(cart.toText());
    }
    const textFinal = cart.toText();
    assert.strictEqual(textFinal, text1, 'Repeated setCode should not grow or duplicate headers');
    assert.strictEqual(Buffer.byteLength(textFinal), Buffer.byteLength(text1));
  });

  test('cleans up stacked duplicate metadata headers from corrupted files', () => {
    const cart = new Cartridge();
    const corruptMultiHeader = `-- title:  Old Title
-- author: Old Author
-- desc:   Old Desc
-- script: lua
-- input:  gamepad

-- title:  New Title
-- author: New Author
-- desc:   New Desc
-- script: lua
-- input:  gamepad

function TIC()
  cls(1)
end
`;
    cart.loadFromText(corruptMultiHeader);

    // Metadata should have the latest parsed values
    assert.strictEqual(cart.metadata.title, 'New Title');
    assert.strictEqual(cart.metadata.author, 'New Author');
    assert.strictEqual(cart.code.trim(), 'function TIC()\n  cls(1)\nend');

    const serialized = cart.toText();
    const titleMatches = serialized.match(/-- title:/g);
    assert.strictEqual(titleMatches?.length, 1, 'Should only contain exactly 1 title header after cleaning');
  });
});
