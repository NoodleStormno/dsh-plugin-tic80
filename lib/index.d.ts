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
/**
 * Determine the active DSH workspace directory.
 * Priority:
 * 1. ctx.workspaceRegistry.list() -> active workspace entity path
 * 2. Environment variable DSH_WORKSPACE or WORKSPACE_DIR
 * 3. ~/.dsh/storages/workspace.json -> active workspace entry
 * 4. process.cwd()
 *
 * Safety constraint: NEVER return the plugin package's own root (__dirname)
 * as the user's workspace directory!
 */
export declare function resolveWorkspaceDir(ctx?: any): string;
/**
 * Resolve the target cartridge file path within the active workspace.
 */
export declare function resolveCartridgePath(workspaceDir: string, configPath?: string): string;
export declare function apply(ctx: Context, config?: Tic80PluginConfig): void;
export * from './core/index.js';
export * from './runner/index.js';
export * from './templates/index.js';
export * from './tools/index.js';
//# sourceMappingURL=index.d.ts.map