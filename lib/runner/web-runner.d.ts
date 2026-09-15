/**
 * TIC-80 Web Runner & Live Studio WebSocket Server
 *
 * Features:
 * - Direct embedding inside DeepSeek Harness Web UI (Middle column: TIC-80, Right column: Chat)
 * - Standalone HTML5 retro player with real Lua 5.3 execution via Fengari
 * - WebSocket Live Studio for zero-reload hot updates of code, sprites, map, and audio
 * - Real-time error reporting and console logging back to DSH
 */
import { Cartridge } from '../core/cartridge.js';
export interface StudioStatus {
    running: boolean;
    port: number;
    connectedClients: number;
    url: string;
    lastLogs: string[];
}
export declare function resolveVendorFile(fileName: string): string | null;
export declare function resolveFengariWeb(): string | null;
export declare class WebStudioServer {
    private server;
    private wss;
    private clients;
    private currentCart;
    private logs;
    private port;
    private boundToHost;
    /**
     * Bind TIC-80 Studio directly into the DeepSeek Harness Host WebServer.
     * This enables the embedded middle-column player on the main DSH port (e.g. 3080).
     */
    bindToServer(webServer: any, cart: Cartridge): void;
    private handleWsConnection;
    /**
     * Start standalone HTTP & WS server on specified port (fallback / external mode)
     */
    start(cart: Cartridge, port?: number): Promise<StudioStatus>;
    broadcastUpdate(cart: Cartridge, updateType: 'CODE' | 'SPRITES' | 'MAP' | 'AUDIO' | 'PALETTE' | 'ALL'): void;
    stop(): Promise<void>;
    getStatus(): StudioStatus;
    /**
     * Inject TIC-80 Studio Pane directly into DSH's index.html
     * This creates the 3-column layout:
     * Left: DSH Sidebar | Middle: TIC-80 Virtual Console | Right: DSH Chat
     */
    injectStudioIntoHtml(html: string): string;
    /**
     * Generates the official TIC-80 WebAssembly HTML5 player bundle running inside the iframe.
     * Utilizes the authentic TIC-80 WASM engine with full CLI, F1-F5 editors, and game execution.
     */
    generatePlayerHtml(cart: Cartridge, liveSync?: boolean): string;
}
//# sourceMappingURL=web-runner.d.ts.map