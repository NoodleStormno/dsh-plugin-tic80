import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'node:path';
import * as os from 'node:os';
import { Context } from '@deepseek-ai/cordis';
import * as Tic80Plugin from '../index.js';
describe('Cordis Plugin Lifecycle', () => {
    test('registers dsh-plugin-tic80 in Cordis context', () => {
        const ctx = new Context();
        const registeredTools = [];
        // Mock tools runtime service
        ctx.provide('tools');
        ctx.tools = {
            register(tool) {
                registeredTools.push(tool);
            },
        };
        Tic80Plugin.apply(ctx, {
            defaultTemplate: 'sokoban',
            autoRun: false,
        });
        assert.strictEqual(registeredTools.length, 14);
        assert.strictEqual(Tic80Plugin.name, 'dsh-plugin-tic80');
        assert.deepStrictEqual(Tic80Plugin.inject, ['tools']);
    });
    test('generates system prompt with complete OpenTIC 10 sections', () => {
        const sampleCartPath = path.resolve(process.cwd(), 'cartridge/game.lua');
        const prompt = Tic80Plugin.buildStudioSystemPrompt({
            cartPath: sampleCartPath,
            cartCode: '-- title: Test\nfunction TIC() end\n',
        });
        assert.ok(prompt.includes('### 1. Role Definition'), 'Prompt must contain Section 1 Role Definition');
        assert.ok(prompt.includes('### 2. Environment & Task'), 'Prompt must contain Section 2 Environment');
        assert.ok(prompt.includes('WYSIWYG Paradigm (CRITICAL)'), 'Prompt must contain WYSIWYG directive');
        assert.ok(prompt.includes('### 3. OpenTIC / TIC-80 File Format'), 'Prompt must contain Section 3 File Format');
        assert.ok(prompt.includes('### 4. Communication Rules'), 'Prompt must contain Section 4 Communication Rules');
        assert.ok(prompt.includes('### 5. TIC-80 Built-in APIs'), 'Prompt must contain Section 5 API reference');
        assert.ok(prompt.includes('### 6. WYSIWYG Code Patterns'), 'Prompt must contain Section 6 Code Patterns');
        assert.ok(prompt.includes('### 7. Lua Features in TIC-80'), 'Prompt must contain Section 7 Lua 5.3 features');
        assert.ok(prompt.includes('### 8. Sokoban Example'), 'Prompt must contain Section 8 Sokoban Example');
        assert.ok(prompt.includes('### 9. Platformer Example'), 'Prompt must contain Section 9 Platformer Example');
        assert.ok(prompt.includes('### 10. Key Directives'), 'Prompt must contain Section 10 Key Directives');
        assert.ok(prompt.includes('NO OS LIBRARY'), 'Prompt must explicitly instruct that os library does not exist');
        assert.ok(prompt.includes('nil'), 'Prompt must warn against nil value errors when indexing os');
        assert.ok(prompt.includes(sampleCartPath), 'Prompt must bind active cartridge path');
    });
    test('sokoban template configures 30x17 window-sized rooms auto-detected in left-to-right top-to-bottom order', async () => {
        const { createTemplate } = await import('../templates/index.js');
        const cart = createTemplate('sokoban');
        assert.strictEqual(cart.metadata.title, 'Sokoban Multiverse');
        assert.ok(cart.sprites.getFlag(1, 0, true), 'Wall tile must have solid flag (flag 0)');
        // Check code contains 30x17 window-sized configuration and L-to-R, T-to-B scanner
        assert.ok(cart.code.includes('room_w = 30'));
        assert.ok(cart.code.includes('room_h = 17'));
        assert.ok(cart.code.includes('scan_levels'));
        assert.ok(cart.code.includes('cfg.rooms_y'));
        assert.ok(cart.code.includes('cfg.rooms_x'));
        // Check pre-stamped 30x17 rooms on the world map
        // Room 1 (rx=0, ry=0): ox=0, oy=0
        assert.strictEqual(cart.map.getTile(0, 0), 1, 'Room 1 top-left must be wall');
        assert.strictEqual(cart.map.getTile(13, 8), 5, 'Room 1 must contain player spawn (tile 5)');
        assert.strictEqual(cart.map.getTile(13, 5), 4, 'Room 1 must contain box (tile 4)');
        assert.strictEqual(cart.map.getTile(14, 5), 3, 'Room 1 must contain goal (tile 3)');
        // Room 2 (rx=1, ry=0): ox=30, oy=0
        assert.strictEqual(cart.map.getTile(30, 0), 1, 'Room 2 top-left must be wall');
        assert.strictEqual(cart.map.getTile(45, 9), 5, 'Room 2 must contain player spawn');
        // Room 3 (rx=2, ry=0): ox=60, oy=0
        assert.strictEqual(cart.map.getTile(60, 0), 1, 'Room 3 top-left must be wall');
        assert.strictEqual(cart.map.getTile(75, 9), 5, 'Room 3 must contain player spawn');
    });
    test('resolveWorkspaceDir discovers workspace from workspaceRegistry, env, or fallback', () => {
        // 1. When workspaceRegistry is available
        const mockPath = path.join(os.tmpdir(), 'mock-dsh-workspace');
        const mockCtx = {
            workspaceRegistry: {
                list: () => [{ path: mockPath, title: 'Mock' }],
            },
        };
        const ws1 = Tic80Plugin.resolveWorkspaceDir(mockCtx);
        assert.strictEqual(ws1, path.resolve(mockPath));
        // 2. When DSH_WORKSPACE env is set
        const origEnv = process.env.DSH_WORKSPACE;
        try {
            const testWs = path.resolve(os.tmpdir());
            process.env.DSH_WORKSPACE = testWs;
            const ws2 = Tic80Plugin.resolveWorkspaceDir({});
            assert.strictEqual(ws2, testWs);
        }
        finally {
            process.env.DSH_WORKSPACE = origEnv;
        }
    });
    test('resolveCartridgePath resolves relative to workspace and avoids plugin package source', () => {
        const ws = path.join(os.tmpdir(), 'custom-workspace');
        // When configPath is provided
        const cart1 = Tic80Plugin.resolveCartridgePath(ws, 'games/puzzle.lua');
        assert.strictEqual(cart1, path.resolve(ws, 'games/puzzle.lua'));
        // Default target path when no existing file
        const cartDefault = Tic80Plugin.resolveCartridgePath(ws);
        assert.strictEqual(cartDefault, path.resolve(ws, 'cartridge/game.lua'));
        assert.ok(!cartDefault.includes('dsh-plugin-tic80'), 'Cartridge path must NOT point to plugin source directory');
    });
    test('sanitizeForDshPrompt escapes {{ and }} to prevent malformed prompt variable reference crashes', () => {
        const codeWithNestedTables = `
local dirs = {{0, -1}, {0, 1}, {-1, 0}, {1, 0}}
local matrix = {{{1, 2}}, {{3, 4}}}
`;
        const prompt = Tic80Plugin.buildStudioSystemPrompt({
            cartPath: 'C:\\test\\game.lua',
            cartCode: codeWithNestedTables,
        });
        // Must not contain any literal {{ or }}
        assert.strictEqual(prompt.includes('{{'), false, 'Prompt must not contain literal {{');
        assert.strictEqual(prompt.includes('}}'), false, 'Prompt must not contain literal }}');
        // Verify against DSH's exact system prompt interpolate() validator
        const GROUP_AT = /^\{\{([^{}]*)\}\}/;
        let text = prompt;
        let last = 0;
        for (let open = text.indexOf('{{'); open >= 0; open = text.indexOf('{{', last)) {
            const group = GROUP_AT.exec(text.slice(open));
            if (group === null) {
                if (text.indexOf('}}', open + 2) >= 0) {
                    assert.fail(`DSH system-prompt engine would throw on: ${text.slice(open, open + 20)}`);
                }
            }
            last = open + 2;
        }
    });
});
//# sourceMappingURL=plugin.test.js.map