/**
 * TIC-80 Cartridge Complete Model & Bidirectional Serializer
 *
 * Supports:
 * - Plain text cartridge (.lua, .js, .moon, etc.)
 * - Binary cartridge (.tic format with typed chunks)
 * - Safe asset boundary preservation
 * - Static analysis & validation
 */
import { ChunkType } from './types.js';
import { Palette } from './palette.js';
import { SpriteSheet } from './sprites.js';
import { WorldMap } from './map.js';
import { AudioManager } from './audio.js';
import { CartridgeLinter } from './linter.js';
export class Cartridge {
    metadata = {
        title: 'Untitled TIC-80 Game',
        author: 'AI Agent',
        desc: 'Created with dsh-plugin-tic80',
        script: 'lua',
        input: 'gamepad',
    };
    code = `function TIC()
  cls(13)
  spr(1, 100, 60, 0)
  print("HELLO TIC-80!", 84, 80, 15)
end
`;
    palette = new Palette();
    sprites = new SpriteSheet();
    map = new WorldMap();
    audio = new AudioManager();
    constructor(initialCode) {
        if (initialCode) {
            this.code = initialCode;
        }
    }
    // ==========================================
    // Text Cartridge (.lua) Parser & Serializer
    // ==========================================
    /**
     * Parse a text cartridge (.lua) into this Cartridge instance.
     */
    loadFromText(content) {
        const lines = content.split(/\r?\n/);
        let inCode = true;
        let currentTag = null;
        const codeLines = [];
        // Reset components
        this.metadata = { script: 'lua' };
        this.sprites = new SpriteSheet();
        this.map = new WorldMap();
        this.audio = new AudioManager();
        this.palette = new Palette();
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            // Check for opening tags like "-- <TILES>"
            const tagOpenMatch = trimmed.match(/^--\s*<([A-Za-z0-9_]+)>/);
            if (tagOpenMatch) {
                inCode = false;
                currentTag = tagOpenMatch[1].toUpperCase();
                continue;
            }
            // Check for closing tags like "-- </TILES>"
            const tagCloseMatch = trimmed.match(/^--\s*<\/([A-Za-z0-9_]+)>/);
            if (tagCloseMatch) {
                currentTag = null;
                continue;
            }
            if (inCode) {
                // Parse metadata tags at top of file
                const metaMatch = trimmed.match(/^--\s*([a-zA-Z0-9_-]+):\s*(.*)$/);
                if (metaMatch && codeLines.length === 0) {
                    const key = metaMatch[1].toLowerCase();
                    const val = metaMatch[2].trim();
                    this.metadata[key] = val;
                }
                else {
                    codeLines.push(line);
                }
            }
            else if (currentTag) {
                // Parse asset tags
                switch (currentTag) {
                    case 'TILES':
                        this.sprites.loadFromChunkLine(line, true);
                        break;
                    case 'SPRITES':
                        this.sprites.loadFromChunkLine(line, false);
                        break;
                    case 'MAP':
                        this.map.loadFromChunkLine(line);
                        break;
                    case 'PALETTE': {
                        const hexMatch = trimmed.match(/^--\s*(?:000:)?([0-9a-fA-F]{48})/);
                        if (hexMatch) {
                            this.palette.loadFromChunkHex(hexMatch[1]);
                        }
                        break;
                    }
                    case 'FLAGS':
                        this.sprites.loadFromFlagsLine(line);
                        break;
                    case 'WAVES':
                        this.audio.loadFromWavesLine(line);
                        break;
                    case 'SFX':
                        this.audio.loadFromSFXLine(line);
                        break;
                }
            }
        }
        this.code = codeLines.join('\n').trimStart();
    }
    /**
     * Serialize this Cartridge to a standard TIC-80 text cartridge (.lua).
     */
    toText() {
        const parts = [];
        // 1. Metadata Header
        if (this.metadata.title)
            parts.push(`-- title:  ${this.metadata.title}`);
        if (this.metadata.author)
            parts.push(`-- author: ${this.metadata.author}`);
        if (this.metadata.desc)
            parts.push(`-- desc:   ${this.metadata.desc}`);
        parts.push(`-- script: ${this.metadata.script || 'lua'}`);
        if (this.metadata.input)
            parts.push(`-- input:  ${this.metadata.input}`);
        if (this.metadata.saveid)
            parts.push(`-- saveid: ${this.metadata.saveid}`);
        parts.push('');
        // 2. Pure Game Code
        parts.push(this.code.trim());
        parts.push('');
        // 3. Asset Sections (strictly bounded by comments)
        const tilesLines = this.sprites.toChunkLines(true);
        if (tilesLines.length > 0) {
            parts.push('-- <TILES>');
            parts.push(...tilesLines);
            parts.push('-- </TILES>');
            parts.push('');
        }
        const spritesLines = this.sprites.toChunkLines(false);
        if (spritesLines.length > 0) {
            parts.push('-- <SPRITES>');
            parts.push(...spritesLines);
            parts.push('-- </SPRITES>');
            parts.push('');
        }
        const mapLines = this.map.toChunkLines();
        if (mapLines.length > 0) {
            parts.push('-- <MAP>');
            parts.push(...mapLines);
            parts.push('-- </MAP>');
            parts.push('');
        }
        const wavesLines = this.audio.toWavesChunkLines();
        if (wavesLines.length > 0) {
            parts.push('-- <WAVES>');
            parts.push(...wavesLines);
            parts.push('-- </WAVES>');
            parts.push('');
        }
        const sfxLines = this.audio.toSFXChunkLines();
        if (sfxLines.length > 0) {
            parts.push('-- <SFX>');
            parts.push(...sfxLines);
            parts.push('-- </SFX>');
            parts.push('');
        }
        const patternsLines = this.audio.toPatternsChunkLines();
        if (patternsLines.length > 0) {
            parts.push('-- <PATTERNS>');
            parts.push(...patternsLines);
            parts.push('-- </PATTERNS>');
            parts.push('');
        }
        const tracksLines = this.audio.toTracksChunkLines();
        if (tracksLines.length > 0) {
            parts.push('-- <TRACKS>');
            parts.push(...tracksLines);
            parts.push('-- </TRACKS>');
            parts.push('');
        }
        const flagsLines = this.sprites.toFlagsChunkLines();
        if (flagsLines.length > 0) {
            parts.push('-- <FLAGS>');
            parts.push(...flagsLines);
            parts.push('-- </FLAGS>');
            parts.push('');
        }
        // Palette is always exported
        parts.push('-- <PALETTE>');
        parts.push(`-- 000:${this.palette.toChunkHex()}`);
        parts.push('-- </PALETTE>');
        parts.push('');
        return parts.join('\n');
    }
    // ==========================================
    // Binary Cartridge (.tic) Parser & Serializer
    // ==========================================
    /**
     * Serialize into binary .tic cartridge format.
     */
    toBinary() {
        const chunks = [];
        // Helper to create a TIC-80 binary chunk
        const addChunk = (type, bank, data) => {
            if (data.length === 0)
                return;
            const header = new Uint8Array(4);
            header[0] = (type & 0x1f) | ((bank & 0x07) << 5);
            header[1] = data.length & 0xff;
            header[2] = (data.length >> 8) & 0xff;
            header[3] = 0; // reserved
            const chunk = new Uint8Array(4 + data.length);
            chunk.set(header, 0);
            chunk.set(data, 4);
            chunks.push(chunk);
        };
        // 1. CHUNK_CODE (type 5)
        const codeBuf = Buffer.from(this.code, 'utf8');
        addChunk(ChunkType.CODE, 0, codeBuf);
        // 2. CHUNK_TILES (type 1) - bank 0 tiles (256 * 64 pixels = 8192 bytes)
        const rawPixels = this.sprites.getRawPixels();
        const tilesPacked = new Uint8Array(8192);
        for (let i = 0; i < 8192; i++) {
            tilesPacked[i] = (rawPixels[i * 2] & 0x0f) | ((rawPixels[i * 2 + 1] & 0x0f) << 4);
        }
        addChunk(ChunkType.TILES, 0, tilesPacked);
        // 3. CHUNK_SPRITES (type 2) - bank 1 sprites (256 * 64 pixels = 8192 bytes)
        const spritesPacked = new Uint8Array(8192);
        const spriteOffset = 256 * 64;
        for (let i = 0; i < 8192; i++) {
            spritesPacked[i] = (rawPixels[spriteOffset + i * 2] & 0x0f) | ((rawPixels[spriteOffset + i * 2 + 1] & 0x0f) << 4);
        }
        addChunk(ChunkType.SPRITES, 0, spritesPacked);
        // 4. CHUNK_MAP (type 4)
        const rawMap = this.map.getRawData();
        addChunk(ChunkType.MAP, 0, rawMap);
        // 5. CHUNK_PALETTE (type 12) - 16 * 3 = 48 bytes
        const paletteBuf = new Uint8Array(48);
        const colors = this.palette.getAllColors();
        for (let i = 0; i < 16; i++) {
            paletteBuf[i * 3] = colors[i].r;
            paletteBuf[i * 3 + 1] = colors[i].g;
            paletteBuf[i * 3 + 2] = colors[i].b;
        }
        addChunk(ChunkType.PALETTE, 0, paletteBuf);
        // 6. CHUNK_FLAGS (type 6) - 512 bytes
        const rawFlags = this.sprites.getRawFlags();
        addChunk(ChunkType.FLAGS, 0, rawFlags);
        // 7. CHUNK_WAVEFORM (type 10) - 16 * 16 bytes = 256 bytes
        const rawWaves = this.audio.getRawWaveforms();
        const wavesPacked = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            wavesPacked[i] = (rawWaves[i * 2] & 0x0f) | ((rawWaves[i * 2 + 1] & 0x0f) << 4);
        }
        addChunk(ChunkType.WAVEFORM, 0, wavesPacked);
        // Calculate total size and assemble
        const totalSize = chunks.reduce((acc, c) => acc + c.length, 0);
        const result = new Uint8Array(totalSize);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return result;
    }
    /**
     * Load from binary .tic cartridge format.
     */
    loadFromBinary(buffer) {
        let offset = 0;
        while (offset + 4 <= buffer.length) {
            const b0 = buffer[offset];
            const type = (b0 & 0x1f);
            const bank = (b0 >> 5) & 0x07;
            const size = buffer[offset + 1] | (buffer[offset + 2] << 8);
            offset += 4;
            if (offset + size > buffer.length)
                break;
            const payload = buffer.subarray(offset, offset + size);
            offset += size;
            switch (type) {
                case ChunkType.CODE:
                    this.code = Buffer.from(payload).toString('utf8');
                    break;
                case ChunkType.TILES: {
                    const rawPixels = this.sprites.getRawPixels();
                    for (let i = 0; i < payload.length && (i * 2 + 1) < 16384; i++) {
                        rawPixels[i * 2] = payload[i] & 0x0f;
                        rawPixels[i * 2 + 1] = (payload[i] >> 4) & 0x0f;
                    }
                    break;
                }
                case ChunkType.SPRITES: {
                    const rawPixels = this.sprites.getRawPixels();
                    const baseOffset = 256 * 64;
                    for (let i = 0; i < payload.length && (i * 2 + 1) < 16384; i++) {
                        rawPixels[baseOffset + i * 2] = payload[i] & 0x0f;
                        rawPixels[baseOffset + i * 2 + 1] = (payload[i] >> 4) & 0x0f;
                    }
                    break;
                }
                case ChunkType.MAP:
                    this.map.loadRawData(payload);
                    break;
                case ChunkType.PALETTE:
                    for (let i = 0; i < 16 && (i * 3 + 2) < payload.length; i++) {
                        this.palette.setColor(i, {
                            r: payload[i * 3],
                            g: payload[i * 3 + 1],
                            b: payload[i * 3 + 2],
                        });
                    }
                    break;
                case ChunkType.FLAGS:
                    this.sprites.loadRawFlags(payload);
                    break;
                case ChunkType.WAVEFORM: {
                    const rawWaves = this.audio.getRawWaveforms();
                    for (let i = 0; i < payload.length && (i * 2 + 1) < 512; i++) {
                        rawWaves[i * 2] = payload[i] & 0x0f;
                        rawWaves[i * 2 + 1] = (payload[i] >> 4) & 0x0f;
                    }
                    break;
                }
            }
        }
    }
    // ==========================================
    // Validation
    // ==========================================
    validate() {
        return CartridgeLinter.validate(this.code, this.sprites, this.map, this.audio);
    }
}
//# sourceMappingURL=cartridge.js.map