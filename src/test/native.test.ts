import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { NativeRunner } from '../runner/native-runner.js';
import { Cartridge } from '../core/cartridge.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('TIC-80 Native Runner CLI Integration', () => {
  test('finds tic80 executable and executes headless CLI command', async (t) => {
    const exe = NativeRunner.findExecutable();
    if (!exe) {
      t.skip('tic80 native executable not available in environment');
      return;
    }

    const tempCartPath = path.resolve(process.cwd(), 'test_native.lua');
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
    assert.ok(!res.stderr.includes('TIC-80 PRO is needed for text files'), 'PRO version must support .lua text carts without pro restriction error');
    await fs.rm(tempCartPath, { force: true });
  });

  test('verifies TIC-80 PRO executes .lua cartridge and exports .tic', async (t) => {
    const exe = NativeRunner.findExecutable();
    if (!exe) {
      t.skip('tic80 native executable not available in environment');
      return;
    }

    const tempCartPath = path.resolve(process.cwd(), 'test_pro_load.lua');
    const tempTicPath = path.resolve(process.cwd(), 'test_pro_out.tic');
    const cart = new Cartridge();
    cart.code = `function TIC()\n  trace("PRO_LUA_OK")\n  exit()\nend\n`;
    await fs.writeFile(tempCartPath, cart.toText(), 'utf8');

    const res = await NativeRunner.run({
      cartPath: tempCartPath,
      cli: true,
      commands: [`save ${tempTicPath}`, 'exit'],
      timeoutMs: 4000,
    });

    assert.strictEqual(res.success, true);
    await fs.rm(tempCartPath, { force: true });
    await fs.rm(tempTicPath, { force: true });
  });
});
