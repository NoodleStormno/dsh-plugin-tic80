/**
 * TIC-80 Native Runner
 *
 * Interacts with the official TIC-80 desktop binary (Windows/Linux/macOS).
 * Executes carts, runs headless test commands, captures stdout/stderr, and supports exports.
 */
import { spawn, execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Cartridge } from '../core/cartridge.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export class NativeRunner {
    static findExecutable(explicitPath) {
        if (explicitPath && fs.existsSync(explicitPath)) {
            return explicitPath;
        }
        const binName = process.platform === 'win32' ? 'tic80.exe' : 'tic80';
        const candidatePaths = [
            path.resolve(__dirname, '../../vendor/bin', binName),
            path.resolve(__dirname, '../vendor/bin', binName),
            path.resolve(process.cwd(), 'vendor/bin', binName),
        ];
        if (process.platform === 'win32') {
            candidatePaths.push('C:/Program Files/TIC-80/tic80.exe', path.resolve(process.env.USERPROFILE || '', 'Downloads/tic80.exe'), path.resolve(process.env.USERPROFILE || '', 'Downloads/tic80-win/tic80.exe'));
        }
        else {
            candidatePaths.push('/usr/local/bin/tic80', '/usr/bin/tic80');
        }
        for (const p of candidatePaths) {
            if (fs.existsSync(p))
                return p;
        }
        // Check system PATH
        try {
            const whichCmd = process.platform === 'win32' ? 'where tic80' : 'which tic80';
            const found = execSync(whichCmd, { stdio: 'pipe' }).toString().trim().split(/\r?\n/)[0];
            if (found && fs.existsSync(found))
                return found;
        }
        catch {
            // not in PATH
        }
        return null;
    }
    static parseErrors(output) {
        const errorLines = [];
        const lines = output.split(/\r?\n/);
        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line)
                continue;
            if (line.toLowerCase().startsWith('error:') ||
                line.toLowerCase().includes('file downloading error') ||
                line.toLowerCase().includes('cart loading error') ||
                line.toLowerCase().includes('project loading error') ||
                line.toLowerCase().includes('file not found') ||
                line.toLowerCase().includes('unknown command') ||
                line.toLowerCase().includes('syntax error') ||
                line.toLowerCase().includes('runtime error') ||
                line.includes('attempt to index') ||
                line.includes('attempt to call') ||
                /\[string\s+".*"\]:\d+:/.test(line)) {
                errorLines.push(line);
            }
        }
        return errorLines;
    }
    static run(options) {
        return new Promise((resolve) => {
            const exePath = this.findExecutable(options.tic80Path);
            if (!exePath) {
                resolve({
                    success: false,
                    stdout: '',
                    stderr: 'TIC-80 executable not found. Please install TIC-80 or specify its path.',
                    output: 'TIC-80 executable not found. Please install TIC-80 or specify its path.',
                    errors: ['TIC-80 executable not found.'],
                    exitCode: -1,
                });
                return;
            }
            let finalCartPath = options.cartPath || null;
            let tempTicPath = null;
            // Determine filesystem root directory for TIC-80 (--fs=...)
            let fsDir;
            if (options.workspaceDir && fs.existsSync(options.workspaceDir)) {
                fsDir = path.resolve(options.workspaceDir);
            }
            else if (finalCartPath) {
                fsDir = path.dirname(path.resolve(finalCartPath));
            }
            else {
                fsDir = process.cwd();
            }
            // Convert .lua cartridge to .tic on the fly so standard TIC-80 can load it
            if (finalCartPath && finalCartPath.endsWith('.lua')) {
                try {
                    if (fs.existsSync(finalCartPath)) {
                        const content = fs.readFileSync(finalCartPath, 'utf8');
                        const cart = new Cartridge();
                        cart.loadFromText(content);
                        tempTicPath = path.resolve(fsDir, `_auto_${Date.now() % 100000}.tic`);
                        fs.writeFileSync(tempTicPath, cart.toBinary());
                        finalCartPath = tempTicPath;
                    }
                }
                catch {
                    // ignore fallback
                }
            }
            const args = [`--fs=${fsDir}`];
            if (options.cli)
                args.push('--cli');
            if (options.fullscreen)
                args.push('--fullscreen');
            if (options.scale)
                args.push(`--scale=${options.scale}`);
            const cmds = [];
            const hasUserCommands = options.commands && options.commands.length > 0;
            const firstUserCmd = hasUserCommands ? options.commands[0].trim() : '';
            const alreadyLoads = firstUserCmd.startsWith('load ');
            if (finalCartPath && !alreadyLoads) {
                const relCart = path.relative(fsDir, finalCartPath);
                cmds.push(`load ${relCart}`);
            }
            if (hasUserCommands) {
                cmds.push(...options.commands);
            }
            // Ensure CLI mode terminates instead of waiting for stdin
            if (options.cli) {
                const hasExit = cmds.some(c => c.trim() === 'exit' || c.trim().endsWith('& exit'));
                if (!hasExit) {
                    cmds.push('exit');
                }
            }
            if (cmds.length > 0) {
                args.push(`--cmd=${cmds.join(' & ')}`);
            }
            const timeout = options.timeoutMs || 10000;
            let stdout = '';
            let stderr = '';
            let proc;
            try {
                proc = spawn(exePath, args, {
                    cwd: fsDir,
                    windowsHide: options.cli ?? false,
                    stdio: 'pipe',
                });
            }
            catch (err) {
                if (tempTicPath && fs.existsSync(tempTicPath)) {
                    try {
                        fs.unlinkSync(tempTicPath);
                    }
                    catch { }
                }
                resolve({
                    success: false,
                    stdout: '',
                    stderr: `Failed to spawn TIC-80: ${err.message}`,
                    output: `Failed to spawn TIC-80: ${err.message}`,
                    errors: [`Failed to spawn TIC-80: ${err.message}`],
                    exitCode: -1,
                });
                return;
            }
            const timer = setTimeout(() => {
                try {
                    proc.kill('SIGTERM');
                }
                catch {
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
                    try {
                        fs.unlinkSync(tempTicPath);
                    }
                    catch { }
                }
                const fullOutput = (stdout + (stderr ? '\n' + stderr : '')).trim();
                const errors = NativeRunner.parseErrors(fullOutput);
                const hasErrors = errors.length > 0;
                resolve({
                    success: (code === 0 || code === null) && !hasErrors,
                    stdout,
                    stderr,
                    output: fullOutput,
                    errors,
                    exitCode: code,
                });
            });
            proc.on('error', (err) => {
                clearTimeout(timer);
                if (tempTicPath && fs.existsSync(tempTicPath)) {
                    try {
                        fs.unlinkSync(tempTicPath);
                    }
                    catch { }
                }
                resolve({
                    success: false,
                    stdout,
                    stderr: err.message,
                    output: (stdout + '\n' + err.message).trim(),
                    errors: [err.message],
                    exitCode: -1,
                });
            });
        });
    }
}
//# sourceMappingURL=native-runner.js.map