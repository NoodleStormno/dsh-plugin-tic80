import { test, describe, after } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Cartridge } from '../core/cartridge.js';
import { WebStudioServer } from '../runner/web-runner.js';
import { createTic80Tools, ToolContext } from '../tools/index.js';

describe('DeepSeek Harness TIC-80 Tools Suite', () => {
  const cart = new Cartridge();
  const studio = new WebStudioServer();
  const toolCtx: ToolContext = {
    cartridge: cart,
    studio,
  };

  const tools = createTic80Tools(toolCtx);
  const toolMap = new Map(tools.map(t => [t.name, t]));

  after(async () => {
    await studio.stop();
  });

  test('registers all 13 tools', () => {
    assert.strictEqual(tools.length, 13);
    const expected = [
      'tic80_init', 'tic80_get_cart', 'tic80_set_code', 'tic80_edit_sprite',
      'tic80_batch_sprites', 'tic80_edit_map', 'tic80_create_sfx',
      'tic80_compose_music', 'tic80_set_palette', 'tic80_validate',
      'tic80_run', 'tic80_export', 'tic80_studio_status'
    ];
    for (const name of expected) {
      assert.ok(toolMap.has(name), `Missing tool: ${name}`);
    }
  });

  test('tic80_init creates cartridge from template', async () => {
    const initTool = toolMap.get('tic80_init')!;
    const res: any = await initTool.execute({
      template: 'platformer',
      title: 'My Platformer Game',
      author: 'Tester',
    }, {} as any);

    assert.strictEqual(res.success, true);
    assert.strictEqual(toolCtx.cartridge.metadata.title, 'My Platformer Game');
    assert.ok(toolCtx.cartridge.code.includes('player'));
  });

  test('tic80_set_code updates game code with validation', async () => {
    const setCodeTool = toolMap.get('tic80_set_code')!;
    const newCode = `
function TIC()
  cls(12)
  print("UPDATED CODE", 80, 60, 0)
end
`;
    const res: any = await setCodeTool.execute({ code: newCode }, {} as any);
    assert.strictEqual(res.success, true);
    assert.strictEqual(toolCtx.cartridge.code.trim(), newCode.trim());
    assert.strictEqual(res.validation.valid, true);
  });

  test('tic80_edit_sprite draws pixel art from ASCII', async () => {
    const editSpriteTool = toolMap.get('tic80_edit_sprite')!;
    const res: any = await editSpriteTool.execute({
      id: 5,
      isTile: false,
      asciiArt: [
        '..3333..',
        '.3ffff3.',
        '3ffffff3',
        '3ffffff3',
        '3ffffff3',
        '3ffffff3',
        '.3ffff3.',
        '..3333..',
      ].join('\n'),
      flags: 5,
    }, {} as any);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.spriteId, 5);
    assert.strictEqual(res.flags, 5);
    assert.ok(res.asciiPreview.includes('3ffff3'));
  });

  test('tic80_batch_sprites updates multiple sprites', async () => {
    const batchTool = toolMap.get('tic80_batch_sprites')!;
    const res: any = await batchTool.execute({
      sprites: [
        { id: 10, asciiArt: '11111111\n11111111', flags: 1 },
        { id: 11, asciiArt: '22222222\n22222222', flags: 2 },
      ],
    }, {} as any);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.updatedCount, 2);
  });

  test('tic80_edit_map sets tiles and fills areas', async () => {
    const editMapTool = toolMap.get('tic80_edit_map')!;
    const res: any = await editMapTool.execute({
      x: 10,
      y: 10,
      tileId: 4,
      fillRect: { w: 5, h: 3, tileId: 2 },
    }, {} as any);

    assert.strictEqual(res.success, true);
    assert.strictEqual(toolCtx.cartridge.map.getTile(10, 10), 2);
  });

  test('tic80_edit_map handles nested fillRect coordinates and aliases', async () => {
    const editMapTool = toolMap.get('tic80_edit_map')!;
    const res: any = await editMapTool.execute({
      fillRect: { x: 5, y: 15, width: 10, height: 2, tileId: 8 },
    }, {} as any);

    assert.strictEqual(res.success, true);
    assert.strictEqual(toolCtx.cartridge.map.getTile(5, 15), 8);
    assert.strictEqual(toolCtx.cartridge.map.getTile(14, 16), 8);
    assert.strictEqual(toolCtx.cartridge.map.getTile(4, 15), 0);
    assert.ok(res.preview.length > 0);
  });

  test('tic80_edit_map places batch tiles and converts pixel coordinates', async () => {
    const editMapTool = toolMap.get('tic80_edit_map')!;
    const res: any = await editMapTool.execute({
      unit: 'pixels',
      tiles: [
        { x: 16, y: 24, tileId: 9 }, // 16px -> col 2, 24px -> row 3
      ],
    }, {} as any);

    assert.strictEqual(res.success, true);
    assert.strictEqual(toolCtx.cartridge.map.getTile(2, 3), 9);
  });

  test('tic80_create_sfx synthesizes sound effect', async () => {
    const sfxTool = toolMap.get('tic80_create_sfx')!;
    const res: any = await sfxTool.execute({
      id: 2,
      preset: 'laser',
      speed: 3,
    }, {} as any);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.sfxId, 2);
    assert.strictEqual(res.preset, 'laser');
  });

  test('tic80_compose_music arranges pattern and assigns to track', async () => {
    const musicTool = toolMap.get('tic80_compose_music')!;
    const res: any = await musicTool.execute({
      patternId: 1,
      channel0: ['C-4', 'E-4', 'G-4'],
      trackId: 0,
      tempo: 140,
    }, {} as any);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.patternId, 1);
    assert.strictEqual(res.trackId, 0);
  });

  test('tic80_set_palette updates active colors', async () => {
    const palTool = toolMap.get('tic80_set_palette')!;
    const res: any = await palTool.execute({ preset: 'cyberpunk' }, {} as any);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.preset, 'cyberpunk');
    assert.strictEqual(res.colors.length, 16);
  });

  test('tic80_validate audits game constraints', async () => {
    const valTool = toolMap.get('tic80_validate')!;
    const res: any = await valTool.execute({}, {} as any);

    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.stats.hasMainLoop, true);
  });

  test('tic80_export exports files to directory', async () => {
    const expTool = toolMap.get('tic80_export')!;
    const exportDir = path.resolve(process.cwd(), 'test_export');
    const res: any = await expTool.execute({
      format: 'all',
      outputDir: exportDir,
      filename: 'my_test_game',
    }, {} as any);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.files.length, 3);
    assert.ok(res.files.some((f: string) => f.endsWith('.lua')));
    assert.ok(res.files.some((f: string) => f.endsWith('.tic')));
    assert.ok(res.files.some((f: string) => f.endsWith('.html')));

    // Cleanup
    await fs.rm(exportDir, { recursive: true, force: true });
  });

  test('tic80_run launches web live studio and reports status', async () => {
    const runTool = toolMap.get('tic80_run')!;
    const statusTool = toolMap.get('tic80_studio_status')!;

    const runRes: any = await runTool.execute({ mode: 'web', port: 3095 }, {} as any);
    assert.strictEqual(runRes.success, true);
    assert.strictEqual(runRes.mode, 'web');
    assert.ok(runRes.url.includes('3095'));

    const statusRes: any = await statusTool.execute({}, {} as any);
    assert.strictEqual(statusRes.running, true);
    assert.strictEqual(statusRes.port, 3095);

    await studio.stop();
  });
});
