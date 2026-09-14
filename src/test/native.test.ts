import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { NativeRunner } from '../runner/native-runner.js';
import { Cartridge } from '../core/cartridge.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('TIC-80 Native Runner CLI Integration', () => {
  test('finds tic80 executable and executes headless CLI command', async () => {
    const exe = NativeRunner.findExecutable();
    assert.ok(exe, 'tic80.exe should be discoverable in project root or system');

    const tempCartPath = path.resolve('E:/dsh-plugin-tic80/test_native.lua');
    const cart = new Cartridge();
    cart.code = `function TIC()\n  exit()\nend\n`;
    await fs.writeFile(tempCartPath, cart.toText(), 'utf8');

    const res = await NativeRunner.run({
      cartPath: tempCartPath,
      cli: true,
      commands: ['run', 'exit'],
      timeoutMs: 4000,
    });

    assert.strictEqual(res.success, true);
    await fs.rm(tempCartPath, { force: true });
  });
});
