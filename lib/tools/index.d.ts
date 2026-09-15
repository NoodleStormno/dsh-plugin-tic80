/**
 * DeepSeek Harness Model-Facing Tools for TIC-80
 *
 * Registered via ctx.tools.register(defineTool(...))
 */
import { Cartridge } from '../core/cartridge.js';
import { WebStudioServer } from '../runner/web-runner.js';
export interface ToolContext {
    cartridge: Cartridge;
    studio: WebStudioServer;
    boundFilePath?: string;
    getWorkspaceDir?: () => string;
}
export declare function createTic80Tools(toolCtx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition[];
//# sourceMappingURL=index.d.ts.map