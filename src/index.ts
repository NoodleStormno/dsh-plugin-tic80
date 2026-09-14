/**
 * DeepSeek Harness Plugin: dsh-plugin-tic80
 * 
 * An all-in-one TIC-80 fantasy console plugin for DeepSeek Harness (dsh).
 * Retains 100% of TIC-80 console capabilities while empowering LLM agents
 * to converse, design, code, draw pixel art, compose chiptunes, construct world maps,
 * and test games with live hot reload.
 */

import { Context } from '@deepseek-ai/cordis';
import { Cartridge } from './core/cartridge.js';
import { createTemplate } from './templates/index.js';
import { WebStudioServer } from './runner/web-runner.js';
import { createTic80Tools, ToolContext } from './tools/index.js';

declare module '@deepseek-ai/cordis' {
  interface Events {
    'dispose'(): void;
  }
}

export const name = 'dsh-plugin-tic80';
export const inject = ['tools'];

export interface Tic80PluginConfig {
  /** Default starting template when booting the plugin (minimal, platformer, sokoban, rpg, shmup) */
  defaultTemplate?: string;
  /** Automatically start the Web Live Studio server upon plugin launch */
  autoRun?: boolean;
  /** Port for the Web Live Studio server (default 3088) */
  webStudioPort?: number;
  /** Optional file path to automatically sync/bind cartridge to */
  cartFilePath?: string;
}

export function apply(ctx: Context, config: Tic80PluginConfig = {}) {
  const initialTemplate = config.defaultTemplate || 'minimal';
  const initialCart = createTemplate(initialTemplate);
  const studio = new WebStudioServer();

  const toolCtx: ToolContext = {
    cartridge: initialCart,
    studio,
    boundFilePath: config.cartFilePath,
  };

  // Register all 13 TIC-80 model tools
  const tools = createTic80Tools(toolCtx);
  for (const tool of tools) {
    ctx.tools.register(tool);
  }

  // Auto-run Web Live Studio if configured
  if (config.autoRun) {
    const port = config.webStudioPort || 3088;
    studio.start(toolCtx.cartridge, port).catch((err) => {
      ((ctx as any).logger?.error || console.error)(`Failed to auto-start TIC-80 Live Studio on port ${port}: ${err.message}`);
    });
  }

  // Clean up when plugin is unloaded / disposed
  (ctx as any).on('dispose', async () => {
    await studio.stop();
  });
}

// Re-export public APIs
export * from './core/index.js';
export * from './runner/index.js';
export * from './templates/index.js';
export * from './tools/index.js';
