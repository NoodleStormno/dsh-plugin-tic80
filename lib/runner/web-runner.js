/**
 * TIC-80 Web Runner & Live Studio WebSocket Server
 *
 * Features:
 * - Direct embedding inside DeepSeek Harness Web UI (Middle column: TIC-80, Right column: Chat)
 * - Standalone HTML5 retro player with real Lua 5.3 execution via Fengari
 * - WebSocket Live Studio for zero-reload hot updates of code, sprites, map, and audio
 * - Real-time error reporting and console logging back to DSH
 */
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { WebSocketServer, WebSocket } from 'ws';
import { Cartridge } from '../core/cartridge.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
export function resolveVendorFile(fileName) {
    const candidates = [
        path.resolve(process.cwd(), 'vendor/tic80-web', fileName),
        path.resolve(__dirname, '../../vendor/tic80-web', fileName),
        path.resolve(__dirname, '../vendor/tic80-web', fileName),
        path.resolve(process.cwd(), 'node_modules/dsh-plugin-tic80/vendor/tic80-web', fileName),
    ];
    for (const c of candidates) {
        if (fs.existsSync(c))
            return c;
    }
    return null;
}
export function resolveFengariWeb() {
    try {
        const resolved = require.resolve('fengari-web/dist/fengari-web.js');
        if (fs.existsSync(resolved))
            return resolved;
    }
    catch { }
    const fallbacks = [
        path.resolve(process.cwd(), 'node_modules/fengari-web/dist/fengari-web.js'),
        path.resolve(__dirname, '../../node_modules/fengari-web/dist/fengari-web.js'),
        path.resolve(__dirname, '../node_modules/fengari-web/dist/fengari-web.js'),
    ];
    for (const p of fallbacks) {
        if (fs.existsSync(p))
            return p;
    }
    return null;
}
export class WebStudioServer {
    server = null;
    wss = null;
    clients = new Set();
    currentCart = null;
    logs = [];
    errors = [];
    port = 3088;
    boundToHost = false;
    /**
     * Bind TIC-80 Studio directly into the DeepSeek Harness Host WebServer.
     * This enables the embedded middle-column player on the main DSH port (e.g. 3080).
     */
    bindToServer(webServer, cart) {
        this.currentCart = cart;
        this.boundToHost = true;
        if (!this.wss) {
            this.wss = new WebSocketServer({ noServer: true });
            this.wss.on('connection', (ws) => this.handleWsConnection(ws));
        }
        // 1. Register HTTP prefix route: /tic80
        webServer.register({
            kind: 'prefix',
            path: '/tic80',
            handler: async (req, res) => {
                const rawPath = new URL(req.url ?? '/', 'http://x').pathname;
                if (rawPath === '/tic80' || rawPath === '/tic80/' || rawPath === '/tic80/index.html') {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(this.generatePlayerHtml(this.currentCart || new Cartridge(), true));
                }
                else if (rawPath === '/tic80/vendor/tic80.js') {
                    const filePath = resolveVendorFile('tic80.js');
                    if (filePath && fs.existsSync(filePath)) {
                        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
                        res.end(fs.readFileSync(filePath));
                    }
                    else {
                        res.writeHead(404);
                        res.end('tic80.js not found');
                    }
                }
                else if (rawPath === '/tic80/vendor/tic80.wasm') {
                    const filePath = resolveVendorFile('tic80.wasm');
                    if (filePath && fs.existsSync(filePath)) {
                        res.writeHead(200, {
                            'Content-Type': 'application/wasm',
                            'Cache-Control': 'public, max-age=3600'
                        });
                        res.end(fs.readFileSync(filePath));
                    }
                    else {
                        res.writeHead(404);
                        res.end('tic80.wasm not found');
                    }
                }
                else if (rawPath === '/tic80/vendor/fengari-web.js') {
                    const fengariFile = resolveFengariWeb();
                    if (fengariFile && fs.existsSync(fengariFile)) {
                        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
                        res.end(fs.readFileSync(fengariFile));
                    }
                    else {
                        res.writeHead(404);
                        res.end('fengari-web.js not found');
                    }
                }
                else if (rawPath === '/tic80/cart.lua') {
                    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end(this.currentCart?.toText() || '');
                }
                else if (rawPath === '/tic80/cart.tic') {
                    const bin = this.currentCart?.toBinary() || new Uint8Array();
                    const isDownload = req.url && req.url.includes('download=1');
                    const headers = {
                        'Content-Type': 'application/octet-stream',
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                    };
                    if (isDownload) {
                        headers['Content-Disposition'] = 'attachment; filename="game.tic"';
                    }
                    res.writeHead(200, headers);
                    res.end(Buffer.from(bin));
                }
                else if (rawPath === '/tic80/api/status') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(this.getStatus()));
                }
                else {
                    res.writeHead(404);
                    res.end('Not Found');
                }
            }
        });
        // 2. Register WebSocket Upgrade: /tic80-ws
        webServer.registerUpgrade({
            path: '/tic80-ws',
            handler: (req, socket, head) => {
                this.wss?.handleUpgrade(req, socket, head, (ws) => {
                    this.handleWsConnection(ws);
                });
            }
        });
        // 3. Inject TIC-80 Embedded Pane into DSH index.html
        webServer.tapIndex((html) => this.injectStudioIntoHtml(html));
        this.logs.push('[WebStudio] Bound seamlessly to DSH WebServer (/tic80 & /tic80-ws)');
    }
    handleWsConnection(ws) {
        this.clients.add(ws);
        this.logs.push(`[${new Date().toLocaleTimeString()}] Live Studio Player connected.`);
        // Send initial cart state
        if (this.currentCart) {
            ws.send(JSON.stringify({
                type: 'INIT_CART',
                cartText: this.currentCart.toText(),
                meta: this.currentCart.metadata,
            }));
        }
        ws.on('message', (msg) => {
            try {
                const data = JSON.parse(msg.toString());
                if (data.type === 'LOG' || data.type === 'ERROR') {
                    this.logs.push(`[${data.type}] ${data.message}`);
                    if (this.logs.length > 50)
                        this.logs.shift();
                    if (data.type === 'ERROR') {
                        this.errors.push(String(data.message));
                        if (this.errors.length > 30)
                            this.errors.shift();
                    }
                }
            }
            catch {
                // ignore
            }
        });
        ws.on('close', () => {
            this.clients.delete(ws);
        });
    }
    /**
     * Start standalone HTTP & WS server on specified port (fallback / external mode)
     */
    start(cart, port = 3088) {
        return new Promise((resolve, reject) => {
            this.currentCart = cart;
            this.port = port;
            if (this.server) {
                resolve(this.getStatus());
                return;
            }
            this.server = http.createServer((req, res) => {
                const url = req.url || '/';
                if (url === '/' || url === '/index.html') {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(this.generatePlayerHtml(this.currentCart || new Cartridge(), true));
                }
                else if (url === '/vendor/tic80.js' || url === '/tic80/vendor/tic80.js') {
                    const filePath = resolveVendorFile('tic80.js');
                    if (filePath && fs.existsSync(filePath)) {
                        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
                        res.end(fs.readFileSync(filePath));
                    }
                    else {
                        res.writeHead(404);
                        res.end('tic80.js not found');
                    }
                }
                else if (url === '/vendor/tic80.wasm' || url === '/tic80/vendor/tic80.wasm') {
                    const filePath = resolveVendorFile('tic80.wasm');
                    if (filePath && fs.existsSync(filePath)) {
                        res.writeHead(200, {
                            'Content-Type': 'application/wasm',
                            'Cache-Control': 'public, max-age=3600'
                        });
                        res.end(fs.readFileSync(filePath));
                    }
                    else {
                        res.writeHead(404);
                        res.end('tic80.wasm not found');
                    }
                }
                else if (url === '/vendor/fengari-web.js' || url === '/tic80/vendor/fengari-web.js') {
                    const fengariFile = resolveFengariWeb();
                    if (fengariFile && fs.existsSync(fengariFile)) {
                        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
                        res.end(fs.readFileSync(fengariFile));
                    }
                    else {
                        res.writeHead(404);
                        res.end('fengari-web not found');
                    }
                }
                else if (url === '/cart.lua') {
                    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end(this.currentCart?.toText() || '');
                }
                else if (url === '/cart.tic' || url.startsWith('/cart.tic?') || url === '/tic80/cart.tic' || url.startsWith('/tic80/cart.tic?')) {
                    const bin = this.currentCart?.toBinary() || new Uint8Array();
                    const isDownload = url.includes('download=1');
                    const headers = {
                        'Content-Type': 'application/octet-stream',
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                    };
                    if (isDownload) {
                        headers['Content-Disposition'] = 'attachment; filename="game.tic"';
                    }
                    res.writeHead(200, headers);
                    res.end(Buffer.from(bin));
                }
                else if (url === '/api/status') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(this.getStatus()));
                }
                else {
                    res.writeHead(404);
                    res.end('Not Found');
                }
            });
            this.wss = new WebSocketServer({ server: this.server });
            this.wss.on('connection', (ws) => this.handleWsConnection(ws));
            this.server.listen(this.port, () => {
                const addr = this.server?.address();
                if (addr && typeof addr === 'object') {
                    this.port = addr.port;
                }
                this.logs.push(`Standalone Studio listening on http://127.0.0.1:${this.port}`);
                resolve(this.getStatus());
            });
            this.server.on('error', (err) => {
                reject(err);
            });
        });
    }
    broadcastUpdate(cart, updateType) {
        this.currentCart = cart;
        const payload = JSON.stringify({
            type: 'HOT_RELOAD',
            updateType,
            cartText: cart.toText(),
            meta: cart.metadata,
        });
        for (const ws of this.clients) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(payload);
            }
        }
    }
    stop() {
        return new Promise((resolve) => {
            for (const ws of this.clients) {
                ws.close();
            }
            this.clients.clear();
            if (this.wss) {
                this.wss.close();
                this.wss = null;
            }
            if (this.server) {
                this.server.close(() => {
                    this.server = null;
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    getRecentErrors() {
        return [...this.errors];
    }
    clearErrors() {
        this.errors = [];
    }
    getStatus() {
        return {
            running: this.boundToHost || (this.server !== null && this.server.listening),
            port: this.port,
            connectedClients: this.clients.size,
            url: this.boundToHost ? `/tic80/` : `http://127.0.0.1:${this.port}`,
            lastLogs: [...this.logs].slice(-20),
            recentErrors: [...this.errors].slice(-10),
        };
    }
    /**
     * Inject TIC-80 Studio Pane directly into DSH's index.html
     * This creates the 3-column layout:
     * Left: DSH Sidebar | Middle: TIC-80 Virtual Console | Right: DSH Chat
     */
    injectStudioIntoHtml(html) {
        const injectedCode = `
<!-- DSH-PLUGIN-TIC80 EMBEDDED STUDIO -->
<style id="dsh-tic80-embedded-style">
  /* Force center column into row flex so Middle is TIC-80 and Right is Chat */
  .pI_x6G_centerCol {
    display: flex !important;
    flex-direction: row !important;
    width: 100% !important;
    height: 100% !important;
    overflow: hidden !important;
    position: relative !important;
  }

  /* TIC-80 Virtual Game Studio (Middle Column) */
  #tic80-pane {
    flex: 1 1 0% !important;
    min-width: 420px !important;
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    background: #0b0c13 !important;
    border-right: 1px solid var(--dsw-alias-border-l3, #212534) !important;
    position: relative !important;
    z-index: 5 !important;
    box-sizing: border-box !important;
  }

  #tic80-header {
    height: 38px !important;
    min-height: 38px !important;
    background: #12141d !important;
    border-bottom: 1px solid #212534 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: flex-start !important;
    padding: 0 14px !important;
    color: #e2e8f0 !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    font-size: 13px !important;
  }

  .tic80-header-left {
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
  }

  .tic80-badge {
    background: #161b2b !important;
    color: #73eff7 !important;
    font-weight: 600 !important;
    font-size: 11.5px !important;
    padding: 3px 8px !important;
    border-radius: 4px !important;
    border: 1px solid #257179 !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    letter-spacing: 0.5px !important;
  }

  .tic80-dot {
    width: 7px !important;
    height: 7px !important;
    border-radius: 50% !important;
    background: #38b764 !important;
    box-shadow: 0 0 6px #38b764 !important;
    animation: tic80-pulse 2s infinite !important;
  }

  @keyframes tic80-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
  }

  #tic80-viewport {
    flex: 1 !important;
    width: 100% !important;
    height: 100% !important;
    position: relative !important;
    background: #08090d !important;
  }

  #tic80-iframe {
    width: 100% !important;
    height: 100% !important;
    border: none !important;
    display: block !important;
    background: #08090d !important;
  }

  #tic80-footer {
    height: 28px !important;
    min-height: 28px !important;
    background: #10121a !important;
    border-top: 1px solid #212534 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 0 12px !important;
    font-size: 10.5px !important;
    color: #8892b0 !important;
    font-family: monospace !important;
    white-space: nowrap !important;
    overflow-x: auto !important;
    scrollbar-width: none !important;
  }

  /* Draggable Resizer Splitter between TIC-80 and Chat */
  #tic80-splitter {
    width: 6px !important;
    cursor: col-resize !important;
    background: #181c28 !important;
    border-left: 1px solid #212534 !important;
    border-right: 1px solid #212534 !important;
    transition: background 0.15s !important;
    z-index: 10 !important;
    user-select: none !important;
  }
  #tic80-splitter:hover, #tic80-splitter.dragging {
    background: #41a6f6 !important;
  }

  /* Right Column: DSH Conversation / Chat */
  .pI_x6G_centerCol > *:not(#tic80-pane):not(#tic80-splitter) {
    flex: 0 0 460px !important;
    width: 460px !important;
    min-width: 360px !important;
    max-width: 760px !important;
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    background: var(--dsw-alias-bg-base, #13141f) !important;
  }
</style>

<script id="dsh-tic80-embedded-script">
  (function() {
    let cachedPane = null;
    let cachedSplitter = null;

    function mountTic80Studio() {
      const centerCol = document.querySelector('.pI_x6G_centerCol');
      if (!centerCol) return false;

      if (cachedPane && centerCol.contains(cachedPane)) {
        return true;
      }

      if (!cachedPane) {
        // 1. Create TIC-80 Studio Pane once
        cachedPane = document.createElement('div');
        cachedPane.id = 'tic80-pane';
        cachedPane.innerHTML = \`
          <div id="tic80-header">
            <div class="tic80-header-left">
              <span class="tic80-badge"><span class="tic80-dot"></span>TIC-80</span>
              <span id="tic80-cart-name" style="color:#e2e8f0; font-size:12px; font-weight:600; font-family:monospace;">game.lua</span>
            </div>
          </div>
          <div id="tic80-viewport">
            <iframe id="tic80-iframe" src="/tic80/" allow="autoplay"></iframe>
          </div>
          <div id="tic80-footer">
            <span>🎮 TIC-80 虚拟电脑 | Esc 终端 | F1代码 F2精灵 F3地图 F4音效 F5音乐</span>
            <span>⚡ 方向键 / WASD 移动 | Z / X 交互 | Ctrl+R 运行</span>
          </div>
        \`;

        // 2. Create Splitter Bar once
        cachedSplitter = document.createElement('div');
        cachedSplitter.id = 'tic80-splitter';

        // 3. Drag Resizer
        let isDragging = false;
        cachedSplitter.onmousedown = (e) => {
          isDragging = true;
          cachedSplitter.classList.add('dragging');
          document.body.style.cursor = 'col-resize';
          const iframe = document.getElementById('tic80-iframe');
          if (iframe) iframe.style.pointerEvents = 'none';
          e.preventDefault();
        };

        window.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          const chatCol = centerCol.querySelector('*:not(#tic80-pane):not(#tic80-splitter)');
          if (chatCol) {
            const centerRect = centerCol.getBoundingClientRect();
            const newChatWidth = Math.max(340, Math.min(850, centerRect.right - e.clientX));
            chatCol.style.width = newChatWidth + 'px';
            chatCol.style.flex = '0 0 ' + newChatWidth + 'px';
          }
        });

        window.addEventListener('mouseup', () => {
          if (isDragging) {
            isDragging = false;
            cachedSplitter.classList.remove('dragging');
            document.body.style.cursor = '';
            const iframe = document.getElementById('tic80-iframe');
            if (iframe) iframe.style.pointerEvents = 'auto';
          }
        });
      }

      // Insert cached elements into centerCol
      centerCol.insertBefore(cachedSplitter, centerCol.firstChild);
      centerCol.insertBefore(cachedPane, cachedSplitter);
      return true;
    }

    function ensureMounted() {
      const centerCol = document.querySelector('.pI_x6G_centerCol');
      if (centerCol && (!cachedPane || !centerCol.contains(cachedPane))) {
        mountTic80Studio();
      }
    }

    ensureMounted();
    setInterval(ensureMounted, 1000);

    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      if (!debounceTimer) {
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          ensureMounted();
        }, 300);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  })();
</script>
`;
        // Inject before closing </body>
        if (html.includes('</body>')) {
            return html.replace('</body>', `${injectedCode}\n</body>`);
        }
        return html + injectedCode;
    }
    /**
     * Generates the official TIC-80 WebAssembly HTML5 player bundle running inside the iframe.
     * Utilizes the authentic TIC-80 WASM engine with full CLI, F1-F5 editors, and game execution.
     */
    generatePlayerHtml(cart, liveSync = false) {
        const cartTextJson = JSON.stringify(cart.toText());
        const title = cart.metadata.title || 'TIC-80 官方完整版';
        const cartUrl = liveSync ? '/tic80/cart.tic' : '/cart.tic';
        const wasmUrl = liveSync ? '/tic80/vendor/tic80.wasm' : '/vendor/tic80.wasm';
        const jsUrl = liveSync ? '/tic80/vendor/tic80.js' : '/vendor/tic80.js';
        const wsPath = liveSync ? '/tic80-ws' : '/';
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background: #000;
      color: #e2e8f0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: monospace;
    }

    #tic80-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
      padding: 6px;
    }

    .canvas-container {
      position: relative;
      width: 100%;
      max-width: 820px;
      aspect-ratio: 256 / 144;
      max-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
      border: 3px solid #141724;
      border-radius: 4px;
      box-shadow: 0 4px 30px rgba(0,0,0,0.9), 0 0 20px rgba(65, 166, 246, 0.2);
    }

    #canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: block;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      outline: none;
      background: #000;
    }

    #loading-cover {
      position: absolute;
      inset: 0;
      background: #090a10;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      z-index: 50;
      color: #73eff7;
      font-family: monospace;
      font-size: 13px;
      transition: opacity 0.25s ease;
      cursor: pointer;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #232d44;
      border-top-color: #73eff7;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    #toast {
      position: absolute;
      top: 10px;
      right: 12px;
      background: rgba(32, 92, 99, 0.95);
      border: 1px solid #73eff7;
      color: #ffffff;
      padding: 5px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      z-index: 100;
      display: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }
  </style>
</head>
<body>
  <div id="tic80-wrapper">
    <div class="canvas-container">
      <div id="loading-cover">
        <div class="spinner"></div>
        <div>TIC-80 官方虚拟电脑启动中...</div>
      </div>
      <canvas id="canvas" oncontextmenu="event.preventDefault()" tabindex="1"></canvas>
      <div id="toast">⚡ 热重载已同步</div>
      <div id="error-banner" style="display:none; position:absolute; bottom:0; left:0; right:0; background:rgba(180,20,30,0.92); color:#fff; padding:6px 12px; font-size:11px; z-index:90; border-top:1px solid #f87171; white-space:pre-wrap; word-break:break-all; box-shadow:0 -2px 10px rgba(0,0,0,0.5);"></div>
    </div>
  </div>

  <script>
    const initialCartText = ${cartTextJson};
    const canvas = document.getElementById('canvas');
    const loadingCover = document.getElementById('loading-cover');
    const toast = document.getElementById('toast');
    const errorBanner = document.getElementById('error-banner');

    function showToast(msg) {
      if (!toast) return;
      toast.textContent = msg;
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 2000);
    }

    function showErrorBanner(msg) {
      if (!errorBanner) return;
      errorBanner.textContent = '❌ ' + msg;
      errorBanner.style.display = 'block';
    }

    function hideLoading() {
      if (loadingCover && loadingCover.style.display !== 'none') {
        loadingCover.style.opacity = '0';
        setTimeout(() => {
          loadingCover.style.display = 'none';
        }, 200);
      }
    }

    // Safety timeout to ensure loading cover is never stuck
    setTimeout(hideLoading, 1500);
    if (loadingCover) loadingCover.addEventListener('click', hideLoading);
    document.addEventListener('keydown', hideLoading, { once: true });
    canvas.addEventListener('click', () => { canvas.focus(); hideLoading(); });

    window.addEventListener('error', function(e) {
      const msg = e.message || (e.error ? e.error.message : String(e));
      showErrorBanner(msg);
      try { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'ERROR', message: msg })); } catch(err){}
    });

    // Dispatch keyboard event to canvas and window for SDL
    window.sendKey = function(key, code, keyCode, ctrl = false) {
      canvas.focus();
      const down = new KeyboardEvent('keydown', {
        key: key,
        code: code,
        keyCode: keyCode,
        which: keyCode,
        ctrlKey: ctrl,
        bubbles: true,
        cancelable: true
      });
      canvas.dispatchEvent(down);
      window.dispatchEvent(down);

      setTimeout(() => {
        const up = new KeyboardEvent('keyup', {
          key: key,
          code: code,
          keyCode: keyCode,
          which: keyCode,
          ctrlKey: ctrl,
          bubbles: true,
          cancelable: true
        });
        canvas.dispatchEvent(up);
        window.dispatchEvent(up);
      }, 60);
    };

    window.addEventListener('message', (e) => {
      if (!e.data) return;
      if (e.data.type === 'SEND_KEY') {
        window.sendKey(e.data.key, e.data.code, e.data.keyCode, e.data.ctrl);
      } else if (e.data.type === 'RELOAD_CART') {
        window.location.reload();
      }
    });

    // Emscripten Module configuration for official TIC-80
    var Module = {
      canvas: canvas,
      arguments: ['${cartUrl}'],
      locateFile: function(path, prefix) {
        if (path.endsWith('.wasm')) return '${wasmUrl}';
        return prefix + path;
      },
      print: function(text) {
        console.log('[TIC-80]', text);
        try { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'LOG', message: text })); } catch(e){}
      },
      printErr: function(text) {
        console.warn('[TIC-80 ERR]', text);
        if (text && !text.includes('deprecated') && !text.includes('pre-main prep')) {
          showErrorBanner(text);
        }
        try { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'ERROR', message: text })); } catch(e){}
      },
      setStatus: function(text) {
        if (text) console.log('[TIC-80 Status]', text);
        if (!text || text === 'Running...') {
          hideLoading();
        }
      },
      preRun: [
        function(mod) {
          mod = mod || Module;
          mod.ENV = mod.ENV || {};
          mod.ENV.SDL_EMSCRIPTEN_KEYBOARD_ELEMENT = '#canvas';
        }
      ],
      onRuntimeInitialized: function() {
        console.log('[TIC-80 WASM] Runtime initialized');
        hideLoading();
        canvas.focus();
      },
      postRun: [
        function() {
          console.log('[TIC-80 WASM] PostRun callback executed');
          hideLoading();
          canvas.focus();
        }
      ]
    };

    // WebSocket for Live Hot Reload from DSH tools
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = wsProtocol + '//' + window.location.host + '${wsPath}';
    let ws = null;
    let loadedCartHash = null;

    function hashString(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return hash;
    }

    loadedCartHash = hashString(initialCartText);

    function connectWs() {
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => console.log('[TIC-80 WASM] Connected to Live Hot-Reload');
        ws.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            if (data.type === 'INIT_CART') {
              // Initial connection handshake - NEVER reload on INIT_CART!
              console.log('[TIC-80 WASM] Initial cart registered via WS');
              if (data.cartText) {
                loadedCartHash = hashString(data.cartText);
              }
              return;
            }

            if (data.type === 'HOT_RELOAD') {
              // Only reload if the cart content has actually changed!
              if (data.cartText) {
                const newHash = hashString(data.cartText);
                if (newHash === loadedCartHash) {
                  console.log('[TIC-80 WASM] Hot-reload skipped: cart content identical');
                  return;
                }
                loadedCartHash = newHash;
              }

              console.log('[TIC-80 WASM] Hot-reload received:', data.updateType || 'ALL');
              showToast('⚡ 卡带热更新已生效 (' + (data.updateType || 'ALL') + ')');

              setTimeout(() => {
                window.location.reload();
              }, 300);
            }
          } catch(e) {
            console.error(e);
          }
        };
        ws.onclose = () => {
          setTimeout(connectWs, 3000);
        };
      } catch(e) {
        setTimeout(connectWs, 3000);
      }
    }
    connectWs();
  </script>
  <script src="${jsUrl}"></script>
</body>
</html>`;
    }
}
//# sourceMappingURL=web-runner.js.map