import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { CartridgeLinter } from '../core/linter.js';
describe('TIC-80 Cartridge Linter', () => {
    test('passes for standard valid game loop', () => {
        const code = `
function TIC()
  cls(0)
  spr(1, 10, 10, 0)
  print("HELLO", 20, 20)
end
`;
        const res = CartridgeLinter.validate(code);
        assert.strictEqual(res.valid, true);
        assert.strictEqual(res.errors.length, 0);
        assert.strictEqual(res.stats.hasMainLoop, true);
    });
    test('reports error when TIC() entrypoint is missing', () => {
        const code = `
function update()
  print("NO TIC ENTRY")
end
`;
        const res = CartridgeLinter.validate(code);
        assert.strictEqual(res.valid, false);
        assert.ok(res.errors.some(e => e.includes("Missing required entrypoint function 'TIC()'")));
    });
    test('reports error when disallowed system libraries are called', () => {
        const code = `
function TIC()
  io.open("test.txt", "w")
end
`;
        const res = CartridgeLinter.validate(code);
        assert.strictEqual(res.valid, false);
        assert.ok(res.errors.some(e => e.includes('Disallowed standard library call')));
    });
});
//# sourceMappingURL=linter.test.js.map