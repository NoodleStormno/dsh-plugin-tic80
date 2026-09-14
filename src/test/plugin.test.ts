import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { Context } from '@deepseek-ai/cordis';
import * as Tic80Plugin from '../index.js';

describe('Cordis Plugin Lifecycle', () => {
  test('registers dsh-plugin-tic80 in Cordis context', () => {
    const ctx = new Context();
    const registeredTools: any[] = [];

    // Mock tools runtime service
    ctx.provide('tools');
    ctx.tools = {
      register(tool: any) {
        registeredTools.push(tool);
      },
    } as any;

    Tic80Plugin.apply(ctx, {
      defaultTemplate: 'sokoban',
      autoRun: false,
    });

    assert.strictEqual(registeredTools.length, 13);
    assert.strictEqual(Tic80Plugin.name, 'dsh-plugin-tic80');
    assert.deepStrictEqual(Tic80Plugin.inject, ['tools']);
  });

  test('generates system prompt with complete OpenTIC 10 sections', () => {
    const prompt = Tic80Plugin.buildStudioSystemPrompt({
      cartPath: 'E:/dsh-plugin-tic80/cartridge/game.lua',
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
    assert.ok(prompt.includes('E:/dsh-plugin-tic80/cartridge/game.lua'), 'Prompt must bind active cartridge path');
  });
});
