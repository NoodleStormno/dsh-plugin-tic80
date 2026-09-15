/**
 * DeepSeek Harness Plugin: dsh-plugin-tic80
 *
 * An all-in-one TIC-80 fantasy console plugin for DeepSeek Harness (dsh).
 * Retains 100% of TIC-80 console capabilities while empowering LLM agents
 * to converse, design, code, draw pixel art, compose chiptunes, construct world maps,
 * and test games with live hot reload.
 */
import { Context } from '@deepseek-ai/cordis';
import { buildStudioSystemPrompt, TIC80_SYSTEM_PROMPT } from './prompts/index.js';
export { buildStudioSystemPrompt, TIC80_SYSTEM_PROMPT };
declare module '@deepseek-ai/cordis' {
    interface Events {
        'dispose'(): void;
    }
}
export declare const name = "dsh-plugin-tic80";
export declare const inject: string[];
export interface Tic80PluginConfig {
    /** Default game genre template to initialize if no cart is loaded */
    defaultTemplate?: 'minimal' | 'platformer' | 'sokoban' | 'rpg' | 'shmup';
    /** Automatically start the Web Live Studio server on boot */
    autoRun?: boolean;
    /** Port for the Web Live Studio server (default 3088) */
    webStudioPort?: number;
    /** Optional file path to automatically sync/bind cartridge to */
    cartFilePath?: string;
}
export declare function apply(ctx: Context, config?: Tic80PluginConfig): void;
export * from './core/index.js';
export * from './runner/index.js';
export * from './templates/index.js';
export * from './tools/index.js';
//# sourceMappingURL=index.d.ts.map