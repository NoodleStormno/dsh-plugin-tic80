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
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { Cartridge } from './core/cartridge.js';
import { createTemplate } from './templates/index.js';
import { WebStudioServer } from './runner/web-runner.js';
import { createTic80Tools } from './tools/index.js';
import { buildStudioSystemPrompt, TIC80_SYSTEM_PROMPT } from './prompts/index.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export { buildStudioSystemPrompt, TIC80_SYSTEM_PROMPT };
export const name = 'dsh-plugin-tic80';
export const inject = ['tools'];
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
export function resolveWorkspaceDir(ctx) {
    const pluginRoot = path.resolve(__dirname, '..');
    // 1. Check Cordis WorkspaceRegistry service
    try {
        if (ctx?.workspaceRegistry?.list) {
            const list = ctx.workspaceRegistry.list();
            if (Array.isArray(list) && list.length > 0 && list[0]?.path) {
                const candidate = path.resolve(list[0].path);
                if (candidate !== pluginRoot) {
                    return candidate;
                }
            }
        }
    }
    catch {
        // ignore
    }
    // 2. Check environment variables
    const envWs = process.env.DSH_WORKSPACE || process.env.WORKSPACE_DIR;
    if (envWs && fs.existsSync(envWs)) {
        const candidate = path.resolve(envWs);
        if (candidate !== pluginRoot) {
            return candidate;
        }
    }
    // 3. Inspect DSH global storage: ~/.dsh/storages/workspace.json
    try {
        const homedir = os.homedir();
        const wsJsonPath = path.join(homedir, '.dsh', 'storages', 'workspace.json');
        if (fs.existsSync(wsJsonPath)) {
            const data = JSON.parse(fs.readFileSync(wsJsonPath, 'utf8'));
            const activeId = data?.global?.workspaceIds?.[0];
            if (activeId && data?.tables?.workspaces?.[activeId]?.path) {
                const candidate = path.resolve(data.tables.workspaces[activeId].path);
                if (fs.existsSync(candidate) && candidate !== pluginRoot) {
                    return candidate;
                }
            }
        }
    }
    catch {
        // ignore
    }
    // 4. Fallback to process.cwd()
    return path.resolve(process.cwd());
}
/**
 * Resolve the target cartridge file path within the active workspace.
 */
export function resolveCartridgePath(workspaceDir, configPath) {
    if (configPath) {
        return path.isAbsolute(configPath) ? configPath : path.resolve(workspaceDir, configPath);
    }
    // In workspaceDir, look for existing game cartridges
    const candidates = [
        path.resolve(workspaceDir, 'cartridge/game.lua'),
        path.resolve(workspaceDir, 'game.lua'),
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) {
            return c;
        }
    }
    // Default target path in workspace if none exist yet
    return path.resolve(workspaceDir, 'cartridge/game.lua');
}
export function apply(ctx, config = {}) {
    // 1. Resolve workspace and bound cartridge file path
    const workspaceDir = resolveWorkspaceDir(ctx);
    const defaultCartPath = resolveCartridgePath(workspaceDir, config.cartFilePath);
    let initialCart;
    if (fs.existsSync(defaultCartPath)) {
        try {
            const fileContent = fs.readFileSync(defaultCartPath, 'utf8');
            initialCart = new Cartridge();
            initialCart.loadFromText(fileContent);
        }
        catch {
            initialCart = createTemplate(config.defaultTemplate || 'sokoban');
        }
    }
    else {
        // If not existing in workspace, seed from plugin's template/seed file (as read-only source)
        const seedCandidates = [
            path.resolve(__dirname, '../cartridge/game.lua'),
            path.resolve(__dirname, '../../cartridge/game.lua'),
        ];
        const seedFile = seedCandidates.find(p => fs.existsSync(p));
        if (seedFile) {
            try {
                const seedContent = fs.readFileSync(seedFile, 'utf8');
                initialCart = new Cartridge();
                initialCart.loadFromText(seedContent);
            }
            catch {
                initialCart = createTemplate(config.defaultTemplate || 'sokoban');
            }
        }
        else {
            initialCart = createTemplate(config.defaultTemplate || 'sokoban');
        }
        // Write initial cartridge to the user's workspace target
        try {
            fs.mkdirSync(path.dirname(defaultCartPath), { recursive: true });
            fs.writeFileSync(defaultCartPath, initialCart.toText(), 'utf8');
        }
        catch {
            // ignore
        }
    }
    const studio = new WebStudioServer();
    const toolCtx = {
        cartridge: initialCart,
        studio,
        boundFilePath: defaultCartPath,
        getWorkspaceDir: () => resolveWorkspaceDir(ctx),
    };
    // 2. Register all 13 TIC-80 model tools
    const tools = createTic80Tools(toolCtx);
    for (const tool of tools) {
        ctx.tools.register(tool);
    }
    // 3. Bind TIC-80 Studio directly to DSH WebServer (port 3080)
    // This enables the embedded middle-column game screen inside DSH Web UI!
    ctx.inject(['webServer'], (serverCtx) => {
        try {
            studio.bindToServer(serverCtx.webServer, toolCtx.cartridge);
            (ctx.logger?.info || console.log)('[dsh-plugin-tic80] Embedded TIC-80 studio mounted into DSH Web UI (/tic80)');
        }
        catch (err) {
            (ctx.logger?.error || console.error)(`[dsh-plugin-tic80] Failed to bind to DSH WebServer: ${err.message}`);
        }
    });
    // 4. Inject embedded TIC-80 workspace context & template into System Prompt
    ctx.inject(['systemPrompt'], (promptCtx) => {
        try {
            const order = promptCtx.systemPrompt.getSectionOrder?.('USER_INSTRUCTIONS') ?? 40;
            promptCtx.systemPrompt.section({
                name: 'tic80:embedded-studio',
                order,
                text: () => {
                    const cartCode = toolCtx.cartridge.toText();
                    return buildStudioSystemPrompt({
                        cartPath: toolCtx.boundFilePath || defaultCartPath,
                        cartCode,
                    });
                }
            });
        }
        catch {
            // ignore
        }
    });
    // 4. Standalone Web Live Studio server on port 3088 (optional / fallback)
    if (config.autoRun) {
        const port = config.webStudioPort || 3088;
        studio.start(toolCtx.cartridge, port).catch((err) => {
            (ctx.logger?.error || console.error)(`Failed to auto-start TIC-80 Live Studio on port ${port}: ${err.message}`);
        });
    }
    // 5. Clean up when plugin is unloaded / disposed
    ctx.on('dispose', async () => {
        await studio.stop();
    });
}
// Re-export public APIs
export * from './core/index.js';
export * from './runner/index.js';
export * from './templates/index.js';
export * from './tools/index.js';
//# sourceMappingURL=index.js.map