/**
 * TIC-80 Cartridge Exporter
 *
 * Exports cartridges to:
 * - .lua (Plain text source cartridge)
 * - .tic (Binary ROM cartridge)
 * - .html (Standalone playable web game)
 */
import { Cartridge } from '../core/cartridge.js';
export interface ExportOptions {
    format: 'lua' | 'tic' | 'html' | 'all';
    outputDir: string;
    filename?: string;
}
export interface ExportResult {
    format: string;
    files: string[];
}
export declare class CartridgeExporter {
    static export(cart: Cartridge, options: ExportOptions): Promise<ExportResult>;
}
//# sourceMappingURL=exporter.d.ts.map