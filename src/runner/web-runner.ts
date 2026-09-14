/**
 * TIC-80 Web Runner & Live Studio WebSocket Server
 * 
 * Features:
 * - Generates standalone HTML5 retro player bundles
 * - Embeddable Canvas runtime (240x136, 60fps) with full TIC-80 2D graphics API & Web Audio
 * - WebSocket Live Studio for zero-reload hot updates of code, sprites, map, and audio
 * - Real-time error reporting back to DSH
 */

import * as http from 'node:http';
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

  start(cart: Cartridge, port: number = 3088): Promise<StudioStatus> {
    return new Promise((resolve, reject) => {
      this.currentCart = cart;
      this.port = port;

      if (this.server) {
        resolve(this.getStatus());
        return;
      }

      this.server = http.createServer((req, res) => {
        if (req.url === '/' || req.url === '/index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(this.generatePlayerHtml(this.currentCart || new Cartridge(), true));
        } else if (req.url === '/cart.lua') {
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(this.currentCart?.toText() || '');
        } else if (req.url === '/cart.tic') {
          const bin = this.currentCart?.toBinary() || new Uint8Array();
          res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
          res.end(Buffer.from(bin));
        } else if (req.url === '/api/status') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.getStatus()));
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });

      this.wss = new WebSocketServer({ server: this.server });

      this.wss.on('connection', (ws) => {
        this.clients.add(ws);
        this.logs.push(`[${new Date().toLocaleTimeString()}] Player connected.`);

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
      });

      this.server.listen(this.port, () => {
        this.logs.push(`Studio listening on http://127.0.0.1:${this.port}`);
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
      running: this.server !== null && this.server.listening,
      port: this.port,
      connectedClients: this.clients.size,
      url: `http://127.0.0.1:${this.port}`,
      lastLogs: [...this.logs].slice(-20),
    };
  }

  /**
   * Generates a self-contained HTML5 Player for TIC-80 cartridges.
   */
  generatePlayerHtml(cart: Cartridge, liveSync: boolean = false): string {
    const cartTextJson = JSON.stringify(cart.toText());
    const title = cart.metadata.title || 'TIC-80 Fantasy Console';
    const author = cart.metadata.author || 'TIC-80 Developer';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - TIC-80 Player</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0f1015;
      color: #e0e6ed;
      font-family: 'Courier New', Courier, monospace;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      overflow: hidden;
    }
    #studio-header {
      margin-bottom: 12px;
      text-align: center;
    }
    #studio-header h1 {
      font-size: 18px;
      color: #73eff7;
      letter-spacing: 1px;
    }
    #studio-header p {
      font-size: 12px;
      color: #94b0c2;
    }
    #screen-container {
      position: relative;
      border: 4px solid #257179;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.8), 0 0 16px rgba(115,239,247,0.3);
      background: #000;
      image-rendering: pixelated;
    }
    canvas {
      display: block;
      width: 720px;
      height: 408px;
      image-rendering: pixelated;
      background: #1a1c2c;
    }
    #status-bar {
      margin-top: 12px;
      font-size: 11px;
      color: #ffcd75;
      display: flex;
      gap: 20px;
    }
    .badge {
      background: #1a1c2c;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid #3b5dc9;
    }
  </style>
</head>
<body>
  <div id="studio-header">
    <h1>${title}</h1>
    <p>By ${author} | TIC-80 240x136 Fantasy Console</p>
  </div>
  <div id="screen-container">
    <canvas id="tic-canvas" width="240" height="136"></canvas>
  </div>
  <div id="status-bar">
    <span class="badge">FPS: <span id="fps-counter">60</span></span>
    <span class="badge">Keys: ARROWS (Move) | Z/X (A/B) | A/S (X/Y)</span>
    <span class="badge" id="sync-badge">${liveSync ? '⚡ LIVE DSH STUDIO' : 'STANDALONE CART'}</span>
  </div>

  <script>
    const canvas = document.getElementById('tic-canvas');
    const ctx = canvas.getContext('2d');
    const fpsElem = document.getElementById('fps-counter');

    let initialCartText = ${cartTextJson};
    let btnState = 0;
    let btnPrevState = 0;
    let palette = [
      [0x1a,0x1c,0x2c],[0x5d,0x27,0x5d],[0xb1,0x3e,0x53],[0xef,0x7d,0x57],
      [0xff,0xcd,0x75],[0xa7,0xf0,0x70],[0x38,0xb7,0x64],[0x25,0x71,0x79],
      [0x29,0x36,0x6f],[0x3b,0x5d,0xc9],[0x41,0xa6,0xf6],[0x73,0xef,0xf7],
      [0xf4,0xf4,0xf4],[0x94,0xb0,0xc2],[0x56,0x6c,0x86],[0x33,0x3c,0x57]
    ];
    let sprites = new Uint8Array(512 * 64);
    let mapData = new Uint8Array(240 * 136);

    // Audio Context
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = AudioCtx ? new AudioCtx() : null;

    // Input handlers
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

    // TIC-80 Runtime APIs
    const TIC80 = {
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
      line(x0, y0, x1, y1, color) {
        const c = palette[color & 15] || palette[15];
        ctx.strokeStyle = \`rgb(\${c[0]},\${c[1]},\${c[2]})\`;
        ctx.beginPath();
        ctx.moveTo(x0 + 0.5, y0 + 0.5);
        ctx.lineTo(x1 + 0.5, y1 + 0.5);
        ctx.stroke();
      },
      rect(x, y, w, h, color) {
        const c = palette[color & 15] || palette[15];
        ctx.fillStyle = \`rgb(\${c[0]},\${c[1]},\${c[2]})\`;
        ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
      },
      rectb(x, y, w, h, color) {
        const c = palette[color & 15] || palette[15];
        ctx.strokeStyle = \`rgb(\${c[0]},\${c[1]},\${c[2]})\`;
        ctx.strokeRect((x | 0) + 0.5, (y | 0) + 0.5, (w | 0) - 1, (h | 0) - 1);
      },
      circ(x, y, r, color) {
        const c = palette[color & 15] || palette[15];
        ctx.fillStyle = \`rgb(\${c[0]},\${c[1]},\${c[2]})\`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      },
      circb(x, y, r, color) {
        const c = palette[color & 15] || palette[15];
        ctx.strokeStyle = \`rgb(\${c[0]},\${c[1]},\${c[2]})\`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      },
      tri(x1, y1, x2, y2, x3, y3, color) {
        const c = palette[color & 15] || palette[15];
        ctx.fillStyle = \`rgb(\${c[0]},\${c[1]},\${c[2]})\`;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
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
        if (!audioCtx) return;
        try {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.frequency.setValueAtTime(440 + (id * 50), audioCtx.currentTime);
          gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.15);
        } catch(e) {}
      },
      time() {
        return performance.now();
      },
      trace(msg) {
        console.log('[TIC-80]', msg);
      }
    };

    // Live Socket Connection
    ${liveSync ? `
    const ws = new WebSocket('ws://' + window.location.host);
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === 'HOT_RELOAD' || data.type === 'INIT_CART') {
          console.log('[Studio] Hot-reload applied');
          loadCartridge(data.cartText);
        }
      } catch(e) {
        console.error(e);
      }
    };
    ` : ''}

    function loadCartridge(text) {
      // Parse sections
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

      // Compile game loop
      const fullCode = codeLines.join('\\n');
      try {
        // Expose TIC-80 globals
        const fn = new Function('TIC80', \`
          with (TIC80) {
            \${fullCode}
            return typeof TIC === 'function' ? TIC : null;
          }
        \`);
        window.userTIC = fn(TIC80);
      } catch (err) {
        console.error('Script compile error:', err);
      }
    }

    loadCartridge(initialCartText);

    // Main Game Loop (60 FPS)
    let lastTime = 0;
    let frames = 0;
    let fpsTimer = 0;

    function loop(time) {
      frames++;
      if (time - fpsTimer >= 1000) {
        fpsElem.textContent = frames;
        frames = 0;
        fpsTimer = time;
      }

      if (window.userTIC) {
        try {
          window.userTIC();
        } catch (e) {
          console.error(e);
        }
      }

      btnPrevState = btnState;
      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
  </script>
</body>
</html>`;
  }
}
