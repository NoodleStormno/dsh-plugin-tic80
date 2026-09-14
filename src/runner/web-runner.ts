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
import { WebSocketServer, WebSocket } from 'ws';
import { Cartridge } from '../core/cartridge.js';

export interface StudioStatus {
  running: boolean;
  port: number;
  connectedClients: number;
  url: string;
  lastLogs: string[];
}

export class WebStudioServer {
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private currentCart: Cartridge | null = null;
  private logs: string[] = [];
  private port: number = 3088;
  private boundToHost: boolean = false;

  /**
   * Bind TIC-80 Studio directly into the DeepSeek Harness Host WebServer.
   * This enables the embedded middle-column player on the main DSH port (e.g. 3080).
   */
  bindToServer(webServer: any, cart: Cartridge) {
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
      handler: async (req: any, res: any) => {
        const rawPath = new URL(req.url ?? '/', 'http://x').pathname;

        if (rawPath === '/tic80' || rawPath === '/tic80/' || rawPath === '/tic80/index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(this.generatePlayerHtml(this.currentCart || new Cartridge(), true));
        } else if (rawPath === '/tic80/vendor/fengari-web.js') {
          const possiblePaths = [
            path.resolve('E:/dsh-plugin-tic80/node_modules/fengari-web/dist/fengari-web.js'),
            path.resolve(process.cwd(), 'node_modules/fengari-web/dist/fengari-web.js'),
            path.resolve('E:/dsh-plugin-tic80/node_modules/fengari-web/dist/fengari-web.bundle.js'),
          ];
          let found = false;
          for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
              res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
              res.end(fs.readFileSync(p));
              found = true;
              break;
            }
          }
          if (!found) {
            res.writeHead(404);
            res.end('fengari-web.js not found');
          }
        } else if (rawPath === '/tic80/cart.lua') {
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(this.currentCart?.toText() || '');
        } else if (rawPath === '/tic80/cart.tic') {
          const bin = this.currentCart?.toBinary() || new Uint8Array();
          res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': 'attachment; filename="game.tic"'
          });
          res.end(Buffer.from(bin));
        } else if (rawPath === '/tic80/api/status') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.getStatus()));
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      }
    });

    // 2. Register WebSocket Upgrade: /tic80-ws
    webServer.registerUpgrade({
      path: '/tic80-ws',
      handler: (req: any, socket: any, head: any) => {
        this.wss?.handleUpgrade(req, socket, head, (ws) => {
          this.handleWsConnection(ws);
        });
      }
    });

    // 3. Inject TIC-80 Embedded Pane into DSH index.html
    webServer.tapIndex((html: string) => this.injectStudioIntoHtml(html));

    this.logs.push('[WebStudio] Bound seamlessly to DSH WebServer (/tic80 & /tic80-ws)');
  }

  private handleWsConnection(ws: WebSocket) {
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
          if (this.logs.length > 50) this.logs.shift();
        }
      } catch {
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
  start(cart: Cartridge, port: number = 3088): Promise<StudioStatus> {
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
        } else if (url === '/vendor/fengari-web.js' || url === '/tic80/vendor/fengari-web.js') {
          const fengariFile = path.resolve('E:/dsh-plugin-tic80/node_modules/fengari-web/dist/fengari-web.js');
          if (fs.existsSync(fengariFile)) {
            res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
            res.end(fs.readFileSync(fengariFile));
          } else {
            res.writeHead(404);
            res.end('fengari-web not found');
          }
        } else if (url === '/cart.lua') {
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(this.currentCart?.toText() || '');
        } else if (url === '/cart.tic') {
          const bin = this.currentCart?.toBinary() || new Uint8Array();
          res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
          res.end(Buffer.from(bin));
        } else if (url === '/api/status') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.getStatus()));
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });

      this.wss = new WebSocketServer({ server: this.server });
      this.wss.on('connection', (ws) => this.handleWsConnection(ws));

      this.server.listen(this.port, () => {
        this.logs.push(`Standalone Studio listening on http://127.0.0.1:${this.port}`);
        resolve(this.getStatus());
      });

      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  broadcastUpdate(cart: Cartridge, updateType: 'CODE' | 'SPRITES' | 'MAP' | 'AUDIO' | 'PALETTE' | 'ALL') {
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

  stop(): Promise<void> {
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
      } else {
        resolve();
      }
    });
  }

  getStatus(): StudioStatus {
    return {
      running: this.boundToHost || (this.server !== null && this.server.listening),
      port: this.port,
      connectedClients: this.clients.size,
      url: this.boundToHost ? `/tic80/` : `http://127.0.0.1:${this.port}`,
      lastLogs: [...this.logs].slice(-20),
    };
  }

  /**
   * Inject TIC-80 Studio Pane directly into DSH's index.html
   * This creates the 3-column layout:
   * Left: DSH Sidebar | Middle: TIC-80 Virtual Console | Right: DSH Chat
   */
  injectStudioIntoHtml(html: string): string {
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
    height: 42px !important;
    min-height: 42px !important;
    background: #12141d !important;
    border-bottom: 1px solid #212534 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
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

  .tic80-header-right {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
  }

  .tic80-btn {
    background: #181d2c !important;
    color: #cbd5e1 !important;
    border: 1px solid #2b334a !important;
    border-radius: 5px !important;
    padding: 4px 10px !important;
    font-size: 11.5px !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 5px !important;
    transition: all 0.15s ease !important;
  }

  .tic80-btn:hover {
    background: #232b40 !important;
    color: #ffffff !important;
    border-color: #41a6f6 !important;
  }

  .tic80-btn-primary {
    background: #205c63 !important;
    color: #e0f7fa !important;
    border-color: #38a5b0 !important;
  }
  .tic80-btn-primary:hover {
    background: #28727a !important;
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
    height: 32px !important;
    min-height: 32px !important;
    background: #10121a !important;
    border-top: 1px solid #212534 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 0 12px !important;
    font-size: 11px !important;
    color: #8892b0 !important;
    font-family: monospace !important;
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
    function mountTic80Studio() {
      const centerCol = document.querySelector('.pI_x6G_centerCol');
      if (!centerCol) return false;

      if (document.getElementById('tic80-pane')) {
        return true;
      }

      // 1. Create TIC-80 Studio Pane
      const pane = document.createElement('div');
      pane.id = 'tic80-pane';
      pane.innerHTML = \`
        <div id="tic80-header">
          <div class="tic80-header-left">
            <span class="tic80-badge"><span class="tic80-dot"></span>TIC-80 游戏机</span>
            <span style="color:#94a3b8; font-size:12px; font-family:monospace;">game.lua</span>
          </div>
          <div class="tic80-header-right">
            <button class="tic80-btn tic80-btn-primary" id="btn-tic-restart" title="重启当前卡带">🔄 重置游戏 (F5)</button>
            <button class="tic80-btn" id="btn-tic-mute" title="切换声音">🔊 音效</button>
            <button class="tic80-btn" id="btn-tic-export" title="导出 .TIC 独立文件">💾 导出 .TIC</button>
            <button class="tic80-btn" id="btn-tic-popout" title="新标签页全屏打开">🗔 弹窗</button>
          </div>
        </div>
        <div id="tic80-viewport">
          <iframe id="tic80-iframe" src="/tic80/" allow="autoplay"></iframe>
        </div>
        <div id="tic80-footer">
          <span>🎮 240x136 @ 60 FPS | Sweetie-16</span>
          <span>⚡ 热重载实时生效 | 方向键/WASD 移动 | Z/X 交互</span>
        </div>
      \`;

      // 2. Create Splitter Bar
      const splitter = document.createElement('div');
      splitter.id = 'tic80-splitter';

      // 3. Insert into centerCol
      centerCol.insertBefore(splitter, centerCol.firstChild);
      centerCol.insertBefore(pane, splitter);

      // 4. Wire control buttons
      pane.querySelector('#btn-tic-restart').onclick = () => {
        const iframe = document.getElementById('tic80-iframe');
        if (iframe) iframe.src = iframe.src;
      };

      pane.querySelector('#btn-tic-mute').onclick = () => {
        const iframe = document.getElementById('tic80-iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'TOGGLE_MUTE' }, '*');
        }
      };

      pane.querySelector('#btn-tic-export').onclick = () => {
        window.open('/tic80/cart.tic', '_blank');
      };

      pane.querySelector('#btn-tic-popout').onclick = () => {
        window.open('/tic80/', '_blank');
      };

      // 5. Drag Resizer
      let isDragging = false;
      splitter.onmousedown = (e) => {
        isDragging = true;
        splitter.classList.add('dragging');
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
          splitter.classList.remove('dragging');
          document.body.style.cursor = '';
          const iframe = document.getElementById('tic80-iframe');
          if (iframe) iframe.style.pointerEvents = 'auto';
        }
      });

      return true;
    }

    // Repeated check to survive SPA navigation and React DOM unmounts
    function ensureMounted() {
      const centerCol = document.querySelector('.pI_x6G_centerCol');
      if (centerCol && !document.getElementById('tic80-pane')) {
        mountTic80Studio();
      }
    }

    ensureMounted();
    setInterval(ensureMounted, 300);

    const observer = new MutationObserver(() => {
      ensureMounted();
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
   * Generates the self-contained retro HTML5 player bundle running inside the iframe.
   * Utilizes Fengari for genuine Lua 5.3 execution, HTML5 Canvas 240x136, and Web Audio.
   */
  generatePlayerHtml(cart: Cartridge, liveSync: boolean = false): string {
    const cartTextJson = JSON.stringify(cart.toText());
    const title = cart.metadata.title || 'TIC-80 Fantasy Console';
    const author = cart.metadata.author || 'TIC-80 Developer';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - TIC-80 Console</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background: #090a0f;
      color: #e2e8f0;
      font-family: monospace;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    #screen-frame {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      max-width: 760px;
      height: 100%;
      padding: 10px;
    }

    #canvas-wrapper {
      position: relative;
      border: 6px solid #1c2333;
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.9), 0 0 20px rgba(115,239,247,0.15);
      background: #000;
      image-rendering: pixelated;
      width: 100%;
      max-width: 720px;
      aspect-ratio: 240 / 136;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    canvas {
      width: 100%;
      height: 100%;
      display: block;
      image-rendering: pixelated;
      background: #141724;
    }

    #controls-hint {
      margin-top: 8px;
      display: flex;
      gap: 16px;
      font-size: 11px;
      color: #73eff7;
      text-shadow: 0 0 4px rgba(115,239,247,0.5);
    }

    .key-badge {
      background: #141724;
      border: 1px solid #232d44;
      padding: 2px 6px;
      border-radius: 3px;
      color: #ffcd75;
    }

    #error-overlay {
      display: none;
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(177, 62, 83, 0.95);
      color: #fff;
      padding: 6px 10px;
      font-size: 11px;
      line-height: 1.4;
      max-height: 50%;
      overflow-y: auto;
      z-index: 100;
      border-top: 2px solid #ef7d57;
    }
  </style>
  <script src="/tic80/vendor/fengari-web.js"></script>
</head>
<body>
  <div id="screen-frame">
    <div id="canvas-wrapper">
      <canvas id="tic-canvas" width="240" height="136"></canvas>
      <div id="error-overlay"></div>
    </div>
    <div id="controls-hint">
      <span><span class="key-badge">方向键 / WASD</span> 移动</span>
      <span><span class="key-badge">Z</span> A 键</span>
      <span><span class="key-badge">X</span> B 键</span>
      <span><span class="key-badge">A</span> X 键</span>
      <span><span class="key-badge">S</span> Y 键</span>
    </div>
  </div>

  <script>
    const canvas = document.getElementById('tic-canvas');
    const ctx = canvas.getContext('2d');
    const errOverlay = document.getElementById('error-overlay');

    let initialCartText = ${cartTextJson};
    let btnState = 0;
    let btnPrevState = 0;
    let isMuted = false;

    // Palette (Default Sweetie-16)
    let palette = [
      [0x1a,0x1c,0x2c],[0x5d,0x27,0x5d],[0xb1,0x3e,0x53],[0xef,0x7d,0x57],
      [0xff,0xcd,0x75],[0xa7,0xf0,0x70],[0x38,0xb7,0x64],[0x25,0x71,0x79],
      [0x29,0x36,0x6f],[0x3b,0x5d,0xc9],[0x41,0xa6,0xf6],[0x73,0xef,0xf7],
      [0xf4,0xf4,0xf4],[0x94,0xb0,0xc2],[0x56,0x6c,0x86],[0x33,0x3c,0x57]
    ];
    let sprites = new Uint8Array(512 * 64);
    let mapData = new Uint8Array(240 * 136);

    // Web Audio
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = AudioCtx ? new AudioCtx() : null;

    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'TOGGLE_MUTE') {
        isMuted = !isMuted;
      }
    });

    // Keyboard bindings
    const keyMap = {
      'ArrowUp': 0, 'KeyW': 0,
      'ArrowDown': 1, 'KeyS': 1,
      'ArrowLeft': 2, 'KeyA': 2,
      'ArrowRight': 3, 'KeyD': 3,
      'KeyZ': 4, 'KeyJ': 4,
      'KeyX': 5, 'KeyK': 5,
      'KeyA': 6,
      'KeyS': 7
    };

    window.addEventListener('keydown', e => {
      if (keyMap[e.code] !== undefined) {
        btnState |= (1 << keyMap[e.code]);
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', e => {
      if (keyMap[e.code] !== undefined) {
        btnState &= ~(1 << keyMap[e.code]);
        e.preventDefault();
      }
    });

    // TIC-80 Global Hardware APIs
    window.TIC80 = {
      cls(color = 0) {
        const c = palette[color & 15] || palette[0];
        ctx.fillStyle = \`rgb(\${c[0]},\${c[1]},\${c[2]})\`;
        ctx.fillRect(0, 0, 240, 136);
      },
      pix(x, y, color) {
        if (color !== undefined) {
          const c = palette[color & 15] || palette[0];
          ctx.fillStyle = \`rgb(\${c[0]},\${c[1]},\${c[2]})\`;
          ctx.fillRect(x | 0, y | 0, 1, 1);
        }
      },
      line(x0, y0, x1, y1, color = 15) {
        const c = palette[color & 15] || palette[15];
        ctx.strokeStyle = \`rgb(\${c[0]},\${c[1]},\${c[2]})\`;
        ctx.beginPath();
        ctx.moveTo((x0 | 0) + 0.5, (y0 | 0) + 0.5);
        ctx.lineTo((x1 | 0) + 0.5, (y1 | 0) + 0.5);
        ctx.stroke();
      },
      rect(x, y, w, h, color = 15) {
        const c = palette[color & 15] || palette[15];
        ctx.fillStyle = \`rgb(\${c[0]},\${c[1]},\${c[2]})\`;
        ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
      },
      rectb(x, y, w, h, color = 15) {
        const c = palette[color & 15] || palette[15];
        ctx.strokeStyle = \`rgb(\${c[0]},\${c[1]},\${c[2]})\`;
        ctx.strokeRect((x | 0) + 0.5, (y | 0) + 0.5, (w | 0) - 1, (h | 0) - 1);
      },
      circ(x, y, r, color = 15) {
        const c = palette[color & 15] || palette[15];
        ctx.fillStyle = \`rgb(\${c[0]},\${c[1]},\${c[2]})\`;
        ctx.beginPath();
        ctx.arc(x | 0, y | 0, Math.max(0, r | 0), 0, Math.PI * 2);
        ctx.fill();
      },
      circb(x, y, r, color = 15) {
        const c = palette[color & 15] || palette[15];
        ctx.strokeStyle = \`rgb(\${c[0]},\${c[1]},\${c[2]})\`;
        ctx.beginPath();
        ctx.arc(x | 0, y | 0, Math.max(0, r | 0), 0, Math.PI * 2);
        ctx.stroke();
      },
      tri(x1, y1, x2, y2, x3, y3, color = 15) {
        const c = palette[color & 15] || palette[15];
        ctx.fillStyle = \`rgb(\${c[0]},\${c[1]},\${c[2]})\`;
        ctx.beginPath();
        ctx.moveTo(x1 | 0, y1 | 0);
        ctx.lineTo(x2 | 0, y2 | 0);
        ctx.lineTo(x3 | 0, y3 | 0);
        ctx.closePath();
        ctx.fill();
      },
      spr(id, x, y, colorkey = -1, scale = 1, flip = 0, rotate = 0, w = 1, h = 1) {
        const sprStart = (id & 0x1ff) * 64;
        for (let sy = 0; sy < 8 * h; sy++) {
          for (let sx = 0; sx < 8 * w; sx++) {
            const col = sprites[sprStart + sy * 8 + sx];
            if (col !== undefined && col !== colorkey) {
              const c = palette[col & 15];
              ctx.fillStyle = \`rgb(\${c[0]},\${c[1]},\${c[2]})\`;
              ctx.fillRect((x + sx * scale) | 0, (y + sy * scale) | 0, scale, scale);
            }
          }
        }
      },
      mget(x, y) {
        if (x < 0 || x >= 240 || y < 0 || y >= 136) return 0;
        return mapData[(y | 0) * 240 + (x | 0)];
      },
      mset(x, y, val) {
        if (x >= 0 && x < 240 && y >= 0 && y < 136) {
          mapData[(y | 0) * 240 + (x | 0)] = val & 0xff;
        }
      },
      map(x = 0, y = 0, w = 30, h = 17, sx = 0, sy = 0, colorkey = -1, scale = 1) {
        for (let my = 0; my < h; my++) {
          for (let mx = 0; mx < w; mx++) {
            const tileId = this.mget(x + mx, y + my);
            if (tileId !== 0) {
              this.spr(tileId, sx + mx * 8 * scale, sy + my * 8 * scale, colorkey, scale);
            }
          }
        }
      },
      print(text, x = 0, y = 0, color = 15, fixed = false, scale = 1) {
        const c = palette[color & 15] || palette[15];
        ctx.fillStyle = \`rgb(\${c[0]},\${c[1]},\${c[2]})\`;
        ctx.font = \`\${6 * scale}px monospace\`;
        ctx.fillText(String(text), x, y + 6 * scale);
        return String(text).length * 6 * scale;
      },
      btn(id) {
        return (btnState & (1 << id)) !== 0;
      },
      btnp(id) {
        return ((btnState & (1 << id)) !== 0) && ((btnPrevState & (1 << id)) === 0);
      },
      sfx(id) {
        if (isMuted || !audioCtx) return;
        try {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.frequency.setValueAtTime(440 + (id * 40), audioCtx.currentTime);
          gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.12);
        } catch(e) {}
      },
      music() {},
      time() {
        return performance.now();
      },
      trace(msg) {
        console.log('[TIC-80]', msg);
      }
    };

    // WebSocket live hot reload connection
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = wsProtocol + '//' + window.location.host + '/tic80-ws';
    let ws = null;

    function connectWs() {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => console.log('[Studio] Connected to TIC-80 Live Hot Reload');
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === 'HOT_RELOAD' || data.type === 'INIT_CART') {
            console.log('[Studio] Hot-reload received:', data.updateType || 'ALL');
            loadCartridge(data.cartText);
          }
        } catch(e) {
          console.error(e);
        }
      };
      ws.onclose = () => {
        setTimeout(connectWs, 2000);
      };
    }
    connectWs();

    let luaLoaded = false;

    function loadCartridge(text) {
      errOverlay.style.display = 'none';

      // Parse cartridge sections
      const lines = text.split(/\\r?\\n/);
      let inCode = true;
      let currentTag = null;
      let codeLines = [];

      for (const line of lines) {
        const trimmed = line.trim();
        const tagOpen = trimmed.match(/^--\\s*<([A-Za-z0-9_]+)>/);
        if (tagOpen) { inCode = false; currentTag = tagOpen[1].toUpperCase(); continue; }
        const tagClose = trimmed.match(/^--\\s*<\\/([A-Za-z0-9_]+)>/);
        if (tagClose) { currentTag = null; continue; }

        if (inCode) {
          if (!trimmed.startsWith('--')) codeLines.push(line);
        } else if (currentTag === 'SPRITES' || currentTag === 'TILES') {
          const m = trimmed.match(/^--\\s*(\\d+):([0-9a-fA-F]+)/);
          if (m) {
            const id = parseInt(m[1], 10);
            const hex = m[2];
            const offset = (currentTag === 'TILES' ? 0 : 256) * 64 + id * 64;
            for (let i = 0; i < hex.length && i < 64; i++) {
              sprites[offset + i] = parseInt(hex[i], 16);
            }
          }
        }
      }

      const userLuaCode = codeLines.join('\\n');

      if (window.fengari) {
        try {
          const fw = window.fengari;
          const prelude = \`
            local js = require "js"
            local T = js.global.TIC80

            cls = function(c) T:cls(c or 0) end
            pix = function(x, y, c) T:pix(x or 0, y or 0, c) end
            line = function(x0, y0, x1, y1, c) T:line(x0 or 0, y0 or 0, x1 or 0, y1 or 0, c or 15) end
            rect = function(x, y, w, h, c) T:rect(x or 0, y or 0, w or 0, h or 0, c or 15) end
            rectb = function(x, y, w, h, c) T:rectb(x or 0, y or 0, w or 0, h or 0, c or 15) end
            circ = function(x, y, r, c) T:circ(x or 0, y or 0, r or 0, c or 15) end
            circb = function(x, y, r, c) T:circb(x or 0, y or 0, r or 0, c or 15) end
            tri = function(x1, y1, x2, y2, x3, y3, c) T:tri(x1, y1, x2, y2, x3, y3, c or 15) end
            spr = function(id, x, y, colorkey, scale, flip, rotate, w, h)
              T:spr(id, x, y, colorkey or -1, scale or 1, flip or 0, rotate or 0, w or 1, h or 1)
            end
            mget = function(x, y) return T:mget(x or 0, y or 0) end
            mset = function(x, y, val) T:mset(x or 0, y or 0, val or 0) end
            map = function(x, y, w, h, sx, sy, colorkey, scale, remap)
              T:map(x or 0, y or 0, w or 30, h or 17, sx or 0, sy or 0, colorkey or -1, scale or 1)
            end
            btn = function(id) return T:btn(id or 0) end
            btnp = function(id) return T:btnp(id or 0) end
            sfx = function(id, note, duration, channel, volume, speed)
              T:sfx(id or 0, note or -1, duration or -1, channel or 0, volume or 15, speed or 0)
            end
            music = function(track, frame, row, loop)
              T:music(track or -1, frame or -1, row or -1, loop or true)
            end
            time = function() return T:time() end
            trace = function(msg) T:trace(tostring(msg)) end
            print = function(str, x, y, color, fixed, scale)
              return T:print(tostring(str or ""), x or 0, y or 0, color or 15, fixed or false, scale or 1)
            end
          \`;

          // Execute prelude and user Lua script
          fw.load(prelude)();
          fw.load(userLuaCode)();

          // Execute BOOT if available
          fw.load("if type(BOOT) == 'function' then BOOT() end")();
          luaLoaded = true;
        } catch (err) {
          console.error('Lua Compilation Error:', err);
          showError(err.message || String(err));
        }
      }
    }

    function showError(msg) {
      errOverlay.style.display = 'block';
      errOverlay.textContent = '❌ [TIC-80 LUA ERROR] ' + msg;
    }

    loadCartridge(initialCartText);

    // 60 FPS Animation Frame Loop
    function gameLoop() {
      if (luaLoaded && window.fengari) {
        try {
          window.fengari.load("if type(TIC) == 'function' then TIC() end")();
        } catch(e) {
          showError(e.message || String(e));
        }
      }

      btnPrevState = btnState;
      requestAnimationFrame(gameLoop);
    }
    requestAnimationFrame(gameLoop);
  </script>
</body>
</html>`;
  }
}
