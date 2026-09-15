import { test, describe, after } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Cartridge } from '../core/cartridge.js';
import { WebStudioServer } from '../runner/web-runner.js';
import { createTic80Tools } from '../tools/index.js';
describe('DeepSeek Harness TIC-80 Tools Suite', () => {
    const cart = new Cartridge();
    const studio = new WebStudioServer();
    const toolCtx = {
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
        const initTool = toolMap.get('tic80_init');
        const res = await initTool.execute({
            template: 'platformer',
            title: 'My Platformer Game',
            author: 'Tester',
        }, {});
        assert.strictEqual(res.success, true);
        assert.strictEqual(toolCtx.cartridge.metadata.title, 'My Platformer Game');
        assert.ok(toolCtx.cartridge.code.includes('player'));
    });
    test('tic80_set_code updates game code with validation', async () => {
        const setCodeTool = toolMap.get('tic80_set_code');
        const newCode = `
function TIC()
  cls(12)
  print("UPDATED CODE", 80, 60, 0)
end
`;
        const res = await setCodeTool.execute({ code: newCode }, {});
        assert.strictEqual(res.success, true);
        assert.strictEqual(toolCtx.cartridge.code.trim(), newCode.trim());
        assert.strictEqual(res.validation.valid, true);
    });
    test('tic80_edit_sprite draws pixel art from ASCII', async () => {
        const editSpriteTool = toolMap.get('tic80_edit_sprite');
        const res = await editSpriteTool.execute({
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
        }, {});
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.spriteId, 5);
        assert.strictEqual(res.flags, 5);
        assert.ok(res.asciiPreview.includes('3ffff3'));
    });
    test('tic80_batch_sprites updates multiple sprites', async () => {
        const batchTool = toolMap.get('tic80_batch_sprites');
        const res = await batchTool.execute({
            sprites: [
                { id: 10, asciiArt: '11111111\n11111111', flags: 1 },
                { id: 11, asciiArt: '22222222\n22222222', flags: 2 },
            ],
        }, {});
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.updatedCount, 2);
    });
    test('tic80_edit_map sets tiles and fills areas', async () => {
        const editMapTool = toolMap.get('tic80_edit_map');
        const res = await editMapTool.execute({
            x: 10,
            y: 10,
            tileId: 4,
            fillRect: { w: 5, h: 3, tileId: 2 },
        }, {});
        assert.strictEqual(res.success, true);
        assert.strictEqual(toolCtx.cartridge.map.getTile(10, 10), 2);
    });
    test('tic80_edit_map handles nested fillRect coordinates and aliases', async () => {
        const editMapTool = toolMap.get('tic80_edit_map');
        const res = await editMapTool.execute({
            fillRect: { x: 5, y: 15, width: 10, height: 2, tileId: 8 },
        }, {});
        assert.strictEqual(res.success, true);
        assert.strictEqual(toolCtx.cartridge.map.getTile(5, 15), 8);
        assert.strictEqual(toolCtx.cartridge.map.getTile(14, 16), 8);
        assert.strictEqual(toolCtx.cartridge.map.getTile(4, 15), 0);
        assert.ok(res.preview.length > 0);
    });
    test('tic80_edit_map places batch tiles and converts pixel coordinates', async () => {
        const editMapTool = toolMap.get('tic80_edit_map');
        const res = await editMapTool.execute({
            unit: 'pixels',
            tiles: [
                { x: 16, y: 24, tileId: 9 }, // 16px -> col 2, 24px -> row 3
            ],
        }, {});
        assert.strictEqual(res.success, true);
        assert.strictEqual(toolCtx.cartridge.map.getTile(2, 3), 9);
    });
    test('tic80_create_sfx synthesizes sound effect', async () => {
        const sfxTool = toolMap.get('tic80_create_sfx');
        const res = await sfxTool.execute({
            id: 2,
            preset: 'laser',
            speed: 3,
        }, {});
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.sfxId, 2);
        assert.strictEqual(res.preset, 'laser');
    });
    test('tic80_compose_music arranges pattern and assigns to track', async () => {
        const musicTool = toolMap.get('tic80_compose_music');
        const res = await musicTool.execute({
            patternId: 1,
            channel0: ['C-4', 'E-4', 'G-4'],
            trackId: 0,
            tempo: 140,
        }, {});
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.patternId, 1);
        assert.strictEqual(res.trackId, 0);
    });
    test('tic80_set_palette updates active colors', async () => {
        const palTool = toolMap.get('tic80_set_palette');
        const res = await palTool.execute({ preset: 'cyberpunk' }, {});
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.preset, 'cyberpunk');
        assert.strictEqual(res.colors.length, 16);
    });
    test('tic80_validate audits game constraints', async () => {
        const valTool = toolMap.get('tic80_validate');
        const res = await valTool.execute({}, {});
        assert.strictEqual(res.valid, true);
        assert.strictEqual(res.stats.hasMainLoop, true);
    });
    test('tic80_export exports files to directory', async () => {
        const expTool = toolMap.get('tic80_export');
        const exportDir = path.resolve(process.cwd(), 'test_export');
        const res = await expTool.execute({
            format: 'all',
            outputDir: exportDir,
            filename: 'my_test_game',
        }, {});
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.files.length, 3);
        assert.ok(res.files.some((f) => f.endsWith('.lua')));
        assert.ok(res.files.some((f) => f.endsWith('.tic')));
        assert.ok(res.files.some((f) => f.endsWith('.html')));
        // Cleanup
        await fs.rm(exportDir, { recursive: true, force: true });
    });
    test('tic80_run launches web live studio and reports status', async () => {
        const runTool = toolMap.get('tic80_run');
        const statusTool = toolMap.get('tic80_studio_status');
        const runRes = await runTool.execute({ mode: 'web', port: 3095 }, {});
        assert.strictEqual(runRes.success, true);
        assert.strictEqual(runRes.mode, 'web');
        assert.ok(runRes.url.includes('3095'));
        const statusRes = await statusTool.execute({}, {});
        assert.strictEqual(statusRes.running, true);
        assert.strictEqual(statusRes.port, 3095);
        await studio.stop();
    });
    test('tic80_set_code saves to boundFilePath with exactly one metadata header and no duplicate growth', async () => {
        const testBoundPath = path.resolve(process.cwd(), 'temp_test_bound.lua');
        toolCtx.boundFilePath = testBoundPath;
        const setCodeTool = toolMap.get('tic80_set_code');
        const payloadWithHeader = `-- title:  Test Runner
-- author: AI Dev
-- desc:   Testing header idempotency
-- script: lua
-- input:  gamepad

function TIC()
  cls(1)
  print("STABLE HEADER", 10, 10, 15)
end
`;
        // First write
        const res1 = await setCodeTool.execute({ code: payloadWithHeader }, {});
        assert.strictEqual(res1.success, true);
        assert.strictEqual(res1.metadata.title, 'Test Runner');
        const content1 = await fs.readFile(testBoundPath, 'utf8');
        const titleCount1 = (content1.match(/-- title:/g) || []).length;
        assert.strictEqual(titleCount1, 1, 'First write must contain exactly 1 title header');
        const size1 = Buffer.byteLength(content1);
        // Second write with the exact content from disk (simulating model reading file and calling set_code)
        const res2 = await setCodeTool.execute({ code: content1 }, {});
        assert.strictEqual(res2.success, true);
        const content2 = await fs.readFile(testBoundPath, 'utf8');
        const titleCount2 = (content2.match(/-- title:/g) || []).length;
        assert.strictEqual(titleCount2, 1, 'Second write must not duplicate headers');
        const size2 = Buffer.byteLength(content2);
        assert.strictEqual(size2, size1, `File size should be unchanged (got ${size1} -> ${size2})`);
        // Cleanup
        await fs.rm(testBoundPath, { force: true });
        toolCtx.boundFilePath = undefined;
    });
});
//# sourceMappingURL=tools.test.js.map