/**
 * TIC-80 Cartridge Exporter
 *
 * Exports cartridges to:
 * - .lua (Plain text source cartridge)
 * - .tic (Binary ROM cartridge)
 * - .html (Standalone playable web game)
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { WebStudioServer } from './web-runner.js';
export class CartridgeExporter {
    static async export(cart, options) {
        await fs.mkdir(options.outputDir, { recursive: true });
        const baseName = options.filename || cart.metadata.title?.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'cart';
        const files = [];
        if (options.format === 'lua' || options.format === 'all') {
            const luaPath = path.join(options.outputDir, `${baseName}.lua`);
            await fs.writeFile(luaPath, cart.toText(), 'utf8');
            files.push(luaPath);
        }
        if (options.format === 'tic' || options.format === 'all') {
            const ticPath = path.join(options.outputDir, `${baseName}.tic`);
            await fs.writeFile(ticPath, cart.toBinary());
            files.push(ticPath);
        }
        if (options.format === 'html' || options.format === 'all') {
            const htmlPath = path.join(options.outputDir, `${baseName}.html`);
            const studio = new WebStudioServer();
            const htmlContent = studio.generatePlayerHtml(cart, false);
            await fs.writeFile(htmlPath, htmlContent, 'utf8');
            files.push(htmlPath);
        }
        return {
            format: options.format,
            files,
        };
    }
}
//# sourceMappingURL=exporter.js.map