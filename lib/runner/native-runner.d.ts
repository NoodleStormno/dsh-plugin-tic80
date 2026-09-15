/**
 * TIC-80 Native Runner
 *
 * Interacts with the official TIC-80 desktop binary (Windows/Linux/macOS).
 * Executes carts, runs headless test commands, captures stdout/stderr, and supports exports.
 */
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
export declare class NativeRunner {
    static findExecutable(explicitPath?: string): string | null;
    static run(options: NativeRunOptions): Promise<NativeRunResult>;
}
//# sourceMappingURL=native-runner.d.ts.map