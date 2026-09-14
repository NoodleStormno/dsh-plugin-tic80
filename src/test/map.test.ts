import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { WorldMap } from '../core/map.js';

describe('TIC-80 World Map Engine', () => {
  test('places and reads individual tiles', () => {
    const map = new WorldMap();
    map.setTile(10, 20, 42);
    assert.strictEqual(map.getTile(10, 20), 42);
    assert.strictEqual(map.getTile(0, 0), 0);
  });

  test('fills rectangular area with tile IDs', () => {
    const map = new WorldMap();
    map.fillRect(5, 5, 10, 4, 3);

    for (let y = 5; y < 9; y++) {
      for (let x = 5; x < 15; x++) {
        assert.strictEqual(map.getTile(x, y), 3);
      }
    }
    assert.strictEqual(map.getTile(4, 5), 0);
    assert.strictEqual(map.getTile(15, 5), 0);
  });

  test('loads map from ASCII layout diagram with legend', () => {
    const map = new WorldMap();
    const diagram = [
      '####',
      '#..#',
      '#.P#',
      '####',
    ];
    map.loadFromAscii(0, 0, diagram, {
      '#': 1,
      '.': 0,
      'P': 2,
    });

    assert.strictEqual(map.getTile(0, 0), 1);
    assert.strictEqual(map.getTile(1, 1), 0);
    assert.strictEqual(map.getTile(2, 2), 2);
    assert.strictEqual(map.getTile(3, 3), 1);
  });

  test('renders map to ASCII diagram', () => {
    const map = new WorldMap();
    map.fillRect(0, 0, 4, 3, 1);
    map.setTile(1, 1, 0);

    const ascii = map.toAscii(0, 0, 4, 3);
    const lines = ascii.split('\n');
    assert.strictEqual(lines.length, 3);
    assert.strictEqual(lines[0], '####');
    assert.strictEqual(lines[1], '#.##');
    assert.strictEqual(lines[2], '####');
  });

  test('loads map from ASCII diagram preserving leading spaces and column coordinates', () => {
    const map = new WorldMap();
    const diagram = [
      '    ####',
      '    #..#',
    ];
    map.loadFromAscii(0, 0, diagram, { '#': 1, '.': 0 });
    assert.strictEqual(map.getTile(0, 0), 0);
    assert.strictEqual(map.getTile(3, 0), 0);
    assert.strictEqual(map.getTile(4, 0), 1);
    assert.strictEqual(map.getTile(5, 0), 1);
  });

  test('serializes and deserializes <MAP> chunk with nibble flip according to TIC-80 spec', () => {
    const map = new WorldMap();
    // tile 1 (0x01): low nibble '1', high nibble '0' -> output "10"
    // tile 16 (0x10): low nibble '0', high nibble '1' -> output "01"
    map.setTile(0, 0, 1);
    map.setTile(1, 0, 16);
    const chunkLines = map.toChunkLines();
    assert.ok(chunkLines.length > 0);
    assert.ok(chunkLines[0].startsWith('-- 000:1001'));

    const map2 = new WorldMap();
    map2.loadFromChunkLine(chunkLines[0]);
    assert.strictEqual(map2.getTile(0, 0), 1);
    assert.strictEqual(map2.getTile(1, 0), 16);
  });

  test('handles float and negative rectangle coordinates gracefully', () => {
    const map = new WorldMap();
    map.fillRect(10.8, 10.2, -5, -3, 7);
    // (10 - 5 + 1) to 10 = cols 6..10; rows 8..10
    assert.strictEqual(map.getTile(6, 8), 7);
    assert.strictEqual(map.getTile(10, 10), 7);
    assert.strictEqual(map.getTile(5, 8), 0);
  });
});
