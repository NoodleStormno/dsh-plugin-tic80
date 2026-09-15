/**
 * TIC-80 Native Runner
 * 
 * Interacts with the official TIC-80 desktop binary (Windows/Linux/macOS).
 * Executes carts, runs headless test commands, captures stdout/stderr, and supports exports.
 */

import { spawn, execSync, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Cartridge } from '../core/cartridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface NativeRunOptions {
  tic80Path?: string;
  cartPath: string;
  cli?: boolean;
  commands?: string[];
  fullscreen?: boolean;
  scale?: number;
  timeoutMs?: number;
}

export interface NativeRunResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export class NativeRunner {
  static findExecutable(explicitPath?: string): string | null {
    if (explicitPath && fs.existsSync(explicitPath)) {
      return explicitPath;
    }

    const binName = process.platform === 'win32' ? 'tic80.exe' : 'tic80';
    const candidatePaths = [
      path.resolve(process.cwd(), binName),
      path.resolve(process.cwd(), 'vendor/bin', binName),
      path.resolve(__dirname, '../../vendor/bin', binName),
      path.resolve(__dirname, '../../', binName),
      path.resolve(__dirname, '../vendor/bin', binName),
    ];

    if (process.platform === 'win32') {
      candidatePaths.push(
        'C:/Program Files/TIC-80/tic80.exe',
        path.resolve(process.env.USERPROFILE || '', 'Downloads/tic80.exe')
      );
    } else {
      candidatePaths.push(
        '/usr/local/bin/tic80',
        '/usr/bin/tic80'
      );
    }

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) return p;
    }

    // Check system PATH
    try {
      const whichCmd = process.platform === 'win32' ? 'where tic80' : 'which tic80';
      const found = execSync(whichCmd, { stdio: 'pipe' }).toString().trim().split(/\r?\n/)[0];
      if (found && fs.existsSync(found)) return found;
    } catch {
      // not in PATH
    }

    return null;
  }

  static run(options: NativeRunOptions): Promise<NativeRunResult> {
    return new Promise((resolve) => {
      const exePath = this.findExecutable(options.tic80Path);
      if (!exePath) {
        resolve({
          success: false,
          stdout: '',
          stderr: 'TIC-80 executable not found. Please install TIC-80 or specify its path.',
          exitCode: -1,
        });
        return;
      }

      let finalCartPath = options.cartPath;
      let tempTicPath: string | null = null;

      if (options.cartPath.endsWith('.lua')) {
        try {
          const content = fs.readFileSync(options.cartPath, 'utf8');
          const cart = new Cartridge();
          cart.loadFromText(content);
          tempTicPath = options.cartPath.replace(/\.lua$/i, '_auto.tic');
          fs.writeFileSync(tempTicPath, cart.toBinary());
          finalCartPath = tempTicPath;
        } catch {
          // ignore
        }
      }

      const cartDir = path.dirname(path.resolve(finalCartPath));
      const cartFile = path.basename(finalCartPath);

      const args: string[] = [`--fs=${cartDir}`];
      if (options.cli) args.push('--cli');
      if (options.fullscreen) args.push('--fullscreen');
      if (options.scale) args.push(`--scale=${options.scale}`);

      const cmds = [`load ${cartFile}`];
      if (options.commands && options.commands.length > 0) {
        cmds.push(...options.commands);
      }
      args.push(`--cmd=${cmds.join(' & ')}`);

      const timeout = options.timeoutMs || 10000;
      let stdout = '';
      let stderr = '';
      let proc: ChildProcess;

      try {
        proc = spawn(exePath, args, {
          windowsHide: options.cli ?? false,
          stdio: 'pipe',
        });
      } catch (err: any) {
        resolve({
          success: false,
          stdout: '',
          stderr: `Failed to spawn TIC-80: ${err.message}`,
          exitCode: -1,
        });
        return;
      }

      const timer = setTimeout(() => {
        try {
          proc.kill('SIGTERM');
        } catch {
          // ignore
        }
      }, timeout);

      proc.stdout?.on('data', (d) => {
        stdout += d.toString();
      });

      proc.stderr?.on('data', (d) => {
        stderr += d.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (tempTicPath && fs.existsSync(tempTicPath)) {
          try { fs.unlinkSync(tempTicPath); } catch {}
        }
        resolve({
          success: code === 0 || code === null,
          stdout,
          stderr,
          exitCode: code,
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          stdout,
          stderr: err.message,
          exitCode: -1,
        });
      });
    });
  }
}
