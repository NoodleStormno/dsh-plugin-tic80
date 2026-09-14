/**
 * DeepSeek Harness Plugin: dsh-plugin-tic80
 * 
 * An all-in-one TIC-80 fantasy console plugin for DeepSeek Harness (dsh).
 * Retains 100% of TIC-80 console capabilities while empowering LLM agents
 * to converse, design, code, draw pixel art, compose chiptunes, construct world maps,
 * and test games with live hot reload.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
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
  /** Automatically start the Web Live Studio standalone server (port 3088) */
  autoRun?: boolean;
  /** Port for the Web Live Studio server (default 3088) */
  webStudioPort?: number;
  /** Optional file path to automatically sync/bind cartridge to */
  cartFilePath?: string;
}

export function apply(ctx: Context, config: Tic80PluginConfig = {}) {
  // 1. Resolve default blank cartridge file
  const defaultCartPath = config.cartFilePath 
    ? path.resolve(config.cartFilePath)
    : path.resolve('E:/dsh-plugin-tic80/cartridge/game.lua');

  let initialCart: Cartridge;
  if (fs.existsSync(defaultCartPath)) {
    try {
      const fileContent = fs.readFileSync(defaultCartPath, 'utf8');
      initialCart = new Cartridge();
      initialCart.loadFromText(fileContent);
    } catch {
      initialCart = createTemplate(config.defaultTemplate || 'minimal');
    }
  } else {
    initialCart = createTemplate(config.defaultTemplate || 'minimal');
    try {
      fs.mkdirSync(path.dirname(defaultCartPath), { recursive: true });
      fs.writeFileSync(defaultCartPath, initialCart.toText(), 'utf8');
    } catch {
      // ignore
    }
  }

  const studio = new WebStudioServer();

  const toolCtx: ToolContext = {
    cartridge: initialCart,
    studio,
    boundFilePath: defaultCartPath,
  };

  // 2. Register all 13 TIC-80 model tools
  const tools = createTic80Tools(toolCtx);
  for (const tool of tools) {
    ctx.tools.register(tool);
  }

  // 3. Bind TIC-80 Studio directly to DSH WebServer (port 3080)
  // This enables the embedded middle-column game screen inside DSH Web UI!
  (ctx as any).inject(['webServer'], (serverCtx: any) => {
    try {
      studio.bindToServer(serverCtx.webServer, toolCtx.cartridge);
      ((ctx as any).logger?.info || console.log)('[dsh-plugin-tic80] Embedded TIC-80 studio mounted into DSH Web UI (/tic80)');
    } catch (err: any) {
      ((ctx as any).logger?.error || console.error)(`[dsh-plugin-tic80] Failed to bind to DSH WebServer: ${err.message}`);
    }
  });

  // 4. Inject embedded TIC-80 workspace context & template into System Prompt
  (ctx as any).inject(['systemPrompt'], (promptCtx: any) => {
    try {
      const order = promptCtx.systemPrompt.getSectionOrder?.('USER_INSTRUCTIONS') ?? 40;
      promptCtx.systemPrompt.section({
        name: 'tic80:embedded-studio',
        order,
        text: () => {
          const cartCode = toolCtx.cartridge.toText();
          return [
            '## 🎮 TIC-80 Embedded Workspace & Real-Time Studio',
            '- The TIC-80 virtual fantasy console is EMBEDDED DIRECTLY IN THE MIDDLE COLUMN of the user interface (240x136 @ 60 FPS, Sweetie-16).',
            '- The active cartridge is ALREADY RUNNING at `' + defaultCartPath + '`.',
            '- DO NOT run `tic80_init` or `tic80_get_cart` to initialize or inspect the project — everything is already initialized and live.',
            '- In Turn 1, IMMEDIATELY call `tic80_set_code`, `tic80_edit_sprite`, `tic80_create_sfx`, or `tic80_edit_map` to fulfill the user\'s game request.',
            '- Edits made via tools hot-reload immediately into the middle-column game console via WebSocket.',
            '',
            '### 📜 Current Active Cartridge Template (Loaded):',
            '```lua',
            cartCode,
            '```',
          ].join('\n');
        }
      });
    } catch {
      // ignore
    }
  });

  // 4. Standalone Web Live Studio server on port 3088 (optional / fallback)
  if (config.autoRun) {
    const port = config.webStudioPort || 3088;
    studio.start(toolCtx.cartridge, port).catch((err) => {
      ((ctx as any).logger?.error || console.error)(`Failed to auto-start TIC-80 Live Studio on port ${port}: ${err.message}`);
    });
  }

  // 5. Clean up when plugin is unloaded / disposed
  (ctx as any).on('dispose', async () => {
    await studio.stop();
  });
}

// Re-export public APIs
export * from './core/index.js';
export * from './runner/index.js';
export * from './templates/index.js';
export * from './tools/index.js';
