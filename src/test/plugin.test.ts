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
});
