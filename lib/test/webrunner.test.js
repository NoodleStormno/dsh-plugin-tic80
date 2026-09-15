import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as http from 'node:http';
import { Cartridge } from '../core/cartridge.js';
import { WebStudioServer, resolveVendorFile } from '../runner/web-runner.js';
describe('TIC-80 Web Runner & WASM Server', () => {
    it('resolves official TIC-80 vendor files', () => {
        const jsPath = resolveVendorFile('tic80.js');
        const wasmPath = resolveVendorFile('tic80.wasm');
        assert.ok(jsPath, 'tic80.js should be resolved');
        assert.ok(wasmPath, 'tic80.wasm should be resolved');
    });
    it('generates player HTML with official TIC-80 WASM configuration', () => {
        const server = new WebStudioServer();
        const cart = new Cartridge();
        const html = server.generatePlayerHtml(cart);
        assert.ok(html.includes('id="canvas"'), 'Should contain canvas element');
        assert.ok(html.includes('tic80.wasm'), 'Should reference tic80.wasm');
        assert.ok(html.includes('tic80.js'), 'Should reference tic80.js');
        assert.ok(html.includes('cart.tic'), 'Should configure cartridge cart.tic');
    });
    it('injects official TIC-80 studio pane with cartridge name into DSH index.html', () => {
        const server = new WebStudioServer();
        const baseHtml = '<html><head></head><body><div class="pI_x6G_centerCol"></div></body></html>';
        const injected = server.injectStudioIntoHtml(baseHtml);
        assert.ok(injected.includes('tic80-pane'), 'Should include TIC-80 pane');
        assert.ok(injected.includes('id="tic80-header"'), 'Should include TIC-80 header');
        assert.ok(injected.includes('id="tic80-cart-name"'), 'Should include cartridge name in header');
        assert.ok(!injected.includes('btn-tic-f1'), 'Header should not include redundant F1-F5 switching buttons');
        assert.ok(!injected.includes('btn-tic-esc'), 'Header should not include redundant Esc switching button');
    });
    it('starts standalone server and serves official WASM binary', async () => {
        const server = new WebStudioServer();
        const cart = new Cartridge();
        const testPort = 3096;
        const status = await server.start(cart, testPort);
        assert.strictEqual(status.running, true);
        const wasmCheck = await new Promise((resolve, reject) => {
            http.get(`http://127.0.0.1:${testPort}/vendor/tic80.wasm`, (res) => {
                assert.strictEqual(res.headers['content-type'], 'application/wasm');
                resolve(res.statusCode || 0);
                res.resume();
            }).on('error', reject);
        });
        assert.strictEqual(wasmCheck, 200);
        const jsCheck = await new Promise((resolve, reject) => {
            http.get(`http://127.0.0.1:${testPort}/vendor/tic80.js`, (res) => {
                assert.ok(res.headers['content-type']?.includes('javascript'));
                resolve(res.statusCode || 0);
                res.resume();
            }).on('error', reject);
        });
        assert.strictEqual(jsCheck, 200);
        await server.stop();
    });
});
//# sourceMappingURL=webrunner.test.js.map