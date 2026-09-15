/**
 * TIC-80 Cartridge Static Analysis & Linter
 *
 * Verifies:
 * - Code syntax and structure
 * - TIC() main loop existence
 * - Code size constraints (max 512KB)
 * - Safe sandbox usage (no banned os/io modules)
 * - Resource references (spr, sfx, music, map calls)
 * - TIC-80 API compliance
 */
export const TIC80_API_WHITELIST = new Set([
    'TIC', 'OVR', 'BDR', 'SCN',
    'btn', 'btnp', 'clip', 'cls', 'circ', 'circb', 'elli', 'ellib',
    'exit', 'fget', 'font', 'fset', 'key', 'keyp', 'line', 'map',
    'memcpy', 'memset', 'mget', 'mouse', 'mset', 'music', 'peek',
    'peek1', 'peek2', 'peek4', 'pix', 'pmem', 'poke', 'poke1', 'poke2',
    'poke4', 'print', 'printh', 'rect', 'rectb', 'reset', 'sfx', 'spr',
    'sync', 'time', 'trace', 'tri', 'trib', 'tstamp', 'vbank', 'textri'
]);
export const BANNED_MODULES = [
    'io.', 'os.execute', 'os.remove', 'os.rename', 'os.getenv', 'package.', 'require('
];
export class CartridgeLinter {
    static validate(code, sprites, map, audio) {
        const errors = [];
        const warnings = [];
        const codeBytes = Buffer.byteLength(code, 'utf8');
        // 1. Code size check (512KB is the TIC-80 Pro maximum size)
        if (codeBytes > 512 * 1024) {
            errors.push(`Code size (${(codeBytes / 1024).toFixed(1)} KB) exceeds the TIC-80 512 KB maximum limit.`);
        }
        else if (codeBytes > 64 * 1024) {
            warnings.push(`Code size (${(codeBytes / 1024).toFixed(1)} KB) exceeds 64 KB (standard free TIC-80 limit). It requires TIC-80 Pro.`);
        }
        // 2. Main loop check
        const hasMainLoop = /function\s+TIC\s*\(|TIC\s*=\s*function|def\s+TIC\s*\(/.test(code);
        if (!hasMainLoop) {
            errors.push("Missing required entrypoint function 'TIC()'. TIC-80 calls TIC() 60 times per second to update and draw the game.");
        }
        // 3. Check for banned sandbox functions
        for (const banned of BANNED_MODULES) {
            if (code.includes(banned)) {
                errors.push(`Disallowed standard library call detected: '${banned}'. TIC-80 runs in a strict sandbox without OS/filesystem access.`);
            }
        }
        // 4. Basic bracket balance check
        const openParens = (code.match(/\(/g) || []).length;
        const closeParens = (code.match(/\)/g) || []).length;
        if (openParens !== closeParens) {
            warnings.push(`Mismatched parentheses: ${openParens} opening '(' vs ${closeParens} closing ')'.`);
        }
        const openBraces = (code.match(/\{/g) || []).length;
        const closeBraces = (code.match(/\}/g) || []).length;
        if (openBraces !== closeBraces) {
            warnings.push(`Mismatched braces: ${openBraces} opening '{' vs ${closeBraces} closing '}'.`);
        }
        // 5. Basic Lua function/end block balance check
        const functionCount = (code.match(/\bfunction\b/g) || []).length;
        const ifCount = (code.match(/\bif\b/g) || []).length;
        const forCount = (code.match(/\bfor\b/g) || []).length;
        const whileCount = (code.match(/\bwhile\b/g) || []).length;
        const endCount = (code.match(/\bend\b/g) || []).length;
        const expectedEnds = functionCount + ifCount + forCount + whileCount;
        if (Math.abs(expectedEnds - endCount) > 2) {
            warnings.push(`Potential Lua block syntax issue: found ${expectedEnds} blocks (function/if/for/while) but ${endCount} 'end' statements.`);
        }
        // 6. Check resource references in code
        const sprMatches = code.matchAll(/\bspr\s*\(\s*(\d+)/g);
        for (const match of sprMatches) {
            const sprId = parseInt(match[1], 10);
            if (sprId >= 512) {
                warnings.push(`Sprite ID ${sprId} in 'spr(${sprId}, ...)' exceeds maximum valid sprite index (0-511).`);
            }
        }
        const sfxMatches = code.matchAll(/\bsfx\s*\(\s*(\d+)/g);
        for (const match of sfxMatches) {
            const sfxId = parseInt(match[1], 10);
            if (sfxId >= 64) {
                warnings.push(`SFX ID ${sfxId} in 'sfx(${sfxId}, ...)' exceeds maximum valid SFX index (0-63).`);
            }
        }
        const musicMatches = code.matchAll(/\bmusic\s*\(\s*(\d+)/g);
        for (const match of musicMatches) {
            const trackId = parseInt(match[1], 10);
            if (trackId >= 64) {
                warnings.push(`Music track ID ${trackId} in 'music(${trackId}, ...)' exceeds maximum valid track index (0-63).`);
            }
        }
        // 7. Calculate resource statistics
        let definedTilesCount = 0;
        let definedSpritesCount = 0;
        if (sprites) {
            for (let i = 0; i < 256; i++) {
                const p = sprites.getSpritePixels(i, true);
                if (p.some(v => v !== 0))
                    definedTilesCount++;
            }
            for (let i = 0; i < 256; i++) {
                const p = sprites.getSpritePixels(i, false);
                if (p.some(v => v !== 0))
                    definedSpritesCount++;
            }
        }
        let definedSfxCount = 0;
        let definedPatternsCount = 0;
        let definedTracksCount = 0;
        if (audio) {
            for (let i = 0; i < 64; i++) {
                const s = audio.getSFX(i);
                if (s && s.notes.some(n => n.note >= 0 || n.volume > 0))
                    definedSfxCount++;
                const p = audio.getPattern(i);
                if (p && p.rows.some(r => r.some(c => c.note >= 0)))
                    definedPatternsCount++;
                const t = audio.getTrack(i);
                if (t && t.patterns.some(pt => pt >= 0))
                    definedTracksCount++;
            }
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings,
            stats: {
                codeBytes,
                definedTilesCount,
                definedSpritesCount,
                definedSfxCount,
                definedPatternsCount,
                definedTracksCount,
                hasMainLoop,
            },
        };
    }
}
//# sourceMappingURL=linter.js.map