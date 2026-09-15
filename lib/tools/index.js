/**
 * DeepSeek Harness Model-Facing Tools for TIC-80
 *
 * Registered via ctx.tools.register(defineTool(...))
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { createTemplate } from '../templates/index.js';
import { NativeRunner } from '../runner/native-runner.js';
import { CartridgeExporter } from '../runner/exporter.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
export function createTic80Tools(toolCtx) {
    const tools = [];
    const getWorkspaceDir = () => {
        return toolCtx.getWorkspaceDir ? toolCtx.getWorkspaceDir() : process.cwd();
    };
    // Helper to sync changes to studio and disk
    const syncChanges = async (updateType) => {
        if (toolCtx.studio.getStatus().running) {
            toolCtx.studio.broadcastUpdate(toolCtx.cartridge, updateType);
        }
        if (toolCtx.boundFilePath) {
            try {
                await fs.writeFile(toolCtx.boundFilePath, toolCtx.cartridge.toText(), 'utf8');
            }
            catch {
                // ignore
            }
        }
    };
    // 1. tic80_init
    tools.push(defineTool({
        name: 'tic80_init',
        description: 'Initialize a new TIC-80 game project with an optional genre template (minimal, platformer, sokoban, rpg, shmup).',
        parameters: {
            template: {
                type: 'string',
                description: 'Template genre: minimal, platformer, sokoban, rpg, or shmup',
            },
            title: {
                type: 'string',
                description: 'Title of the game',
            },
            author: {
                type: 'string',
                description: 'Author name',
            },
            script: {
                type: 'string',
                description: 'Scripting language: lua, js, moon, or wren (default: lua)',
            },
            filePath: {
                type: 'string',
                description: 'Optional local file path to bind for auto-saving (.lua)',
            },
        },
        output: {
            schema: { type: 'json' },
            render: (_args, val) => [{ type: 'text', text: JSON.stringify(val, null, 2) }],
        },
        async execute(args) {
            const templateName = args.template || 'minimal';
            toolCtx.cartridge = createTemplate(templateName);
            if (args.title)
                toolCtx.cartridge.metadata.title = args.title;
            if (args.author)
                toolCtx.cartridge.metadata.author = args.author;
            if (args.script)
                toolCtx.cartridge.metadata.script = args.script;
            if (args.filePath) {
                toolCtx.boundFilePath = path.isAbsolute(args.filePath)
                    ? args.filePath
                    : path.resolve(getWorkspaceDir(), args.filePath);
                await fs.mkdir(path.dirname(toolCtx.boundFilePath), { recursive: true });
                await fs.writeFile(toolCtx.boundFilePath, toolCtx.cartridge.toText(), 'utf8');
            }
            await syncChanges('ALL');
            const validation = toolCtx.cartridge.validate();
            return JSON.parse(JSON.stringify({
                success: true,
                message: `Cartridge initialized with '${templateName}' template.`,
                metadata: toolCtx.cartridge.metadata,
                stats: validation.stats,
                boundFilePath: toolCtx.boundFilePath || null,
            }));
        },
    }));
    // 2. tic80_get_cart
    tools.push(defineTool({
        name: 'tic80_get_cart',
        description: 'Inspect the current TIC-80 cartridge: code, sprites, map regions, SFX, music, or palette.',
        parameters: {
            includeCode: { type: 'boolean', description: 'Include game code' },
            includeSprites: { type: 'boolean', description: 'Include summary of defined sprites/tiles' },
            includeMap: { type: 'boolean', description: 'Include map ASCII overview' },
            includeAudio: { type: 'boolean', description: 'Include SFX and music track list' },
            includePalette: { type: 'boolean', description: 'Include 16-color palette' },
            spriteId: { type: 'integer', description: 'Inspect specific sprite ID in ASCII' },
            isTile: { type: 'boolean', description: 'Whether spriteId refers to Bank 0 tiles (default false)' },
            mapRegion: {
                type: 'object',
                description: 'Inspect specific map region: { x, y, w, h }',
                additionalProperties: true,
            },
        },
        output: {
            schema: { type: 'json' },
            render: (_args, val) => [{ type: 'text', text: JSON.stringify(val, null, 2) }],
        },
        async execute(args) {
            const cart = toolCtx.cartridge;
            const res = {
                metadata: cart.metadata,
                stats: cart.validate().stats,
            };
            if (args.includeCode) {
                res.code = cart.code;
            }
            if (args.includePalette) {
                res.palette = cart.palette.getAllColors().map((c, i) => ({
                    id: i,
                    hex: cart.palette.getHex(i),
                    rgb: c,
                }));
            }
            if (args.spriteId !== undefined) {
                res.sprite = {
                    id: args.spriteId,
                    isTile: args.isTile ?? false,
                    ascii: cart.sprites.toAscii(args.spriteId, args.isTile ?? false),
                    flags: cart.sprites.getFlagsByte(args.spriteId, args.isTile ?? false),
                };
            }
            if (args.includeMap || args.mapRegion) {
                const region = args.mapRegion || { x: 0, y: 0, w: 30, h: 17 };
                const rx = Number(region.x) || 0;
                const ry = Number(region.y) || 0;
                const rw = Number(region.w) || 30;
                const rh = Number(region.h) || 17;
                res.mapAscii = cart.map.toAscii(rx, ry, rw, rh);
            }
            if (args.includeAudio) {
                const definedSfx = [];
                for (let i = 0; i < 64; i++) {
                    const sfx = cart.audio.getSFX(i);
                    if (sfx && sfx.notes.some(n => n.note >= 0 || n.volume > 0)) {
                        definedSfx.push({ id: i, speed: sfx.speed });
                    }
                }
                res.sfx = definedSfx;
            }
            return JSON.parse(JSON.stringify(res));
        },
    }));
    // 3. tic80_set_code
    tools.push(defineTool({
        name: 'tic80_set_code',
        description: 'Update the TIC-80 game code (Lua/JS) with automatic syntax linting and hot reload.',
        parameters: {
            code: {
                type: 'string',
                required: true,
                description: 'New game code (retaining TIC() main loop)',
            },
            validate: {
                type: 'boolean',
                description: 'Whether to run static lint checks (default: true)',
            },
        },
        output: {
            schema: { type: 'json' },
            render: (_args, val) => [{ type: 'text', text: JSON.stringify(val, null, 2) }],
        },
        async execute(args) {
            toolCtx.cartridge.setCode(args.code);
            const validation = args.validate !== false ? toolCtx.cartridge.validate() : null;
            await syncChanges('CODE');
            return JSON.parse(JSON.stringify({
                success: true,
                message: 'Game code updated and synced.',
                codeBytes: Buffer.byteLength(toolCtx.cartridge.code, 'utf8'),
                metadata: toolCtx.cartridge.metadata,
                boundFilePath: toolCtx.boundFilePath || null,
                validation,
            }));
        },
    }));
    // 4. tic80_edit_sprite
    tools.push(defineTool({
        name: 'tic80_edit_sprite',
        description: 'Draw or edit an 8x8 or multi-tile sprite using ASCII pixel art (e.g. "." for transparent, "0"-"f" for color index) or hex data.',
        parameters: {
            id: {
                type: 'integer',
                required: true,
                description: 'Sprite ID (0-255)',
            },
            isTile: {
                type: 'boolean',
                description: 'True for Bank 0 background tiles, False for Bank 1 sprites (default: false)',
            },
            asciiArt: {
                type: 'string',
                description: 'ASCII pixel art rows (8x8 or multi-tile). E.g.:\n..4444..\n.4ffff4.\n4f4444f4\n...',
            },
            hexData: {
                type: 'string',
                description: '64-character hexadecimal pixel data',
            },
            flags: {
                type: 'integer',
                description: '8-bit sprite flags byte (0-255)',
            },
        },
        output: {
            schema: { type: 'json' },
            render: (_args, val) => [{ type: 'text', text: JSON.stringify(val, null, 2) }],
        },
        async execute(args) {
            const isTile = args.isTile ?? false;
            const id = args.id & 255;
            if (args.asciiArt) {
                toolCtx.cartridge.sprites.setFromAscii(id, args.asciiArt, isTile);
            }
            else if (args.hexData) {
                const pixels = [];
                for (let i = 0; i < args.hexData.length && i < 64; i++) {
                    pixels.push(parseInt(args.hexData[i], 16));
                }
                toolCtx.cartridge.sprites.setSpritePixels(id, pixels, isTile);
            }
            if (args.flags !== undefined) {
                toolCtx.cartridge.sprites.setFlagsByte(id, args.flags, isTile);
            }
            await syncChanges('SPRITES');
            return JSON.parse(JSON.stringify({
                success: true,
                spriteId: id,
                isTile,
                asciiPreview: toolCtx.cartridge.sprites.toAscii(id, isTile),
                flags: toolCtx.cartridge.sprites.getFlagsByte(id, isTile),
            }));
        },
    }));
    // 5. tic80_batch_sprites
    tools.push(defineTool({
        name: 'tic80_batch_sprites',
        description: 'Batch create or update multiple sprites or tiles in one operation.',
        parameters: {
            sprites: {
                type: 'array',
                required: true,
                description: 'Array of sprite objects: [{ id, isTile, asciiArt, flags }]',
            },
        },
        output: {
            schema: { type: 'json' },
            render: (_args, val) => [{ type: 'text', text: JSON.stringify(val, null, 2) }],
        },
        async execute(args) {
            const list = args.sprites;
            let updatedCount = 0;
            for (const item of list) {
                if (typeof item.id !== 'number')
                    continue;
                const isTile = Boolean(item.isTile);
                if (item.asciiArt) {
                    toolCtx.cartridge.sprites.setFromAscii(item.id, item.asciiArt, isTile);
                    updatedCount++;
                }
                if (item.flags !== undefined) {
                    toolCtx.cartridge.sprites.setFlagsByte(item.id, item.flags, isTile);
                }
            }
            await syncChanges('SPRITES');
            return {
                success: true,
                updatedCount,
            };
        },
    }));
    // 6. tic80_edit_map
    tools.push(defineTool({
        name: 'tic80_edit_map',
        description: 'Edit the 240x136 TIC-80 world map by setting tiles, filling rectangles, placing batch tiles, or loading ASCII diagrams. Tile grid: 240 cols x 136 rows. Screen 0 is (0..29, 0..16). 1 tile = 8x8 pixels.',
        parameters: {
            x: { type: 'number', description: 'Tile X coordinate (0-239, default 0). For Screen 0: 0-29. In pixels if unit="pixels".' },
            y: { type: 'number', description: 'Tile Y coordinate (0-135, default 0). For Screen 0: 0-16. In pixels if unit="pixels".' },
            tileId: { type: 'integer', description: 'Tile ID (0-255) to place at (x, y).' },
            tiles: {
                type: 'array',
                description: 'Batch tiles to set: [{ x, y, tileId }] or [[x, y, tileId]].',
                items: { type: 'object', additionalProperties: true },
            },
            fillRect: {
                type: 'object',
                description: 'Fill rectangle or array of rectangles: { x?, y?, w, h, tileId } (aliases: startX, startY, width, height, tile). Coordinates default to top-level x, y if omitted.',
                additionalProperties: true,
            },
            asciiMap: {
                type: 'object',
                description: 'Load diagram: { x?, y?, asciiRows: string | string[], legend: { "#": 1, ".": 0 } }',
                additionalProperties: true,
            },
            unit: {
                type: 'string',
                enum: ['tiles', 'pixels'],
                description: 'Coordinate unit: "tiles" (default, 1 tile = 8x8 px) or "pixels" (auto-divided by 8).',
            },
            clear: {
                type: 'boolean',
                description: 'If true, clears the entire map with tile 0 before applying edits.',
            },
        },
        output: {
            schema: { type: 'json' },
            render: (_args, val) => [{ type: 'text', text: JSON.stringify(val, null, 2) }],
        },
        async execute(args) {
            const map = toolCtx.cartridge.map;
            const isPixels = args.unit === 'pixels' || args.pixelCoords === true;
            const toTileCoord = (val, defaultVal = 0) => {
                if (val === undefined || val === null)
                    return defaultVal;
                const num = Number(val);
                if (isNaN(num))
                    return defaultVal;
                return isPixels ? Math.floor(num / 8) : Math.floor(num);
            };
            const toTileDim = (val, defaultVal = 1) => {
                if (val === undefined || val === null)
                    return defaultVal;
                const num = Number(val);
                if (isNaN(num))
                    return defaultVal;
                return isPixels ? Math.max(1, Math.round(num / 8)) : Math.floor(num);
            };
            if (args.clear) {
                map.fillRect(0, 0, 240, 136, 0);
            }
            // Resolve top-level coordinates (if specified)
            const hasTopX = args.x !== undefined || args.tileX !== undefined || args.col !== undefined || args.column !== undefined || args.startX !== undefined;
            const hasTopY = args.y !== undefined || args.tileY !== undefined || args.row !== undefined || args.startY !== undefined;
            const topX = hasTopX ? toTileCoord(args.x ?? args.tileX ?? args.col ?? args.column ?? args.startX, 0) : undefined;
            const topY = hasTopY ? toTileCoord(args.y ?? args.tileY ?? args.row ?? args.startY, 0) : undefined;
            let minX = 240, maxX = -1, minY = 136, maxY = -1;
            let tilesPlaced = 0;
            const recordBounds = (x, y, w = 1, h = 1) => {
                const x1 = Math.min(x, x + w - 1);
                const x2 = Math.max(x, x + w - 1);
                const y1 = Math.min(y, y + h - 1);
                const y2 = Math.max(y, y + h - 1);
                minX = Math.min(minX, Math.max(0, x1));
                maxX = Math.max(maxX, Math.min(239, x2));
                minY = Math.min(minY, Math.max(0, y1));
                maxY = Math.max(maxY, Math.min(135, y2));
            };
            // 1. Single tile placement
            if (args.tileId !== undefined || args.tile !== undefined) {
                const tx = topX ?? 0;
                const ty = topY ?? 0;
                const tid = (args.tileId ?? args.tile) & 0xff;
                map.setTile(tx, ty, tid);
                recordBounds(tx, ty, 1, 1);
                tilesPlaced++;
            }
            // 2. Batch tiles array
            if (Array.isArray(args.tiles)) {
                for (const rawItem of args.tiles) {
                    if (Array.isArray(rawItem)) {
                        const tx = toTileCoord(rawItem[0], topX ?? 0);
                        const ty = toTileCoord(rawItem[1], topY ?? 0);
                        const tid = Number(rawItem[2] ?? 0) & 0xff;
                        map.setTile(tx, ty, tid);
                        recordBounds(tx, ty, 1, 1);
                        tilesPlaced++;
                    }
                    else if (typeof rawItem === 'object' && rawItem !== null) {
                        const item = rawItem;
                        const ix = item.x ?? item.tileX ?? item.col ?? item.column ?? topX ?? 0;
                        const iy = item.y ?? item.tileY ?? item.row ?? topY ?? 0;
                        const tx = toTileCoord(ix, topX ?? 0);
                        const ty = toTileCoord(iy, topY ?? 0);
                        const tid = Number(item.tileId ?? item.tile ?? item.id ?? 0) & 0xff;
                        map.setTile(tx, ty, tid);
                        recordBounds(tx, ty, 1, 1);
                        tilesPlaced++;
                    }
                }
            }
            // 3. fillRect (support single object or array of objects)
            if (args.fillRect) {
                const rectList = Array.isArray(args.fillRect) ? args.fillRect : [args.fillRect];
                for (const frItem of rectList) {
                    if (typeof frItem !== 'object' || frItem === null)
                        continue;
                    const fr = frItem;
                    const rx = fr.x ?? fr.tileX ?? fr.col ?? fr.column ?? fr.startX ?? topX ?? 0;
                    const ry = fr.y ?? fr.tileY ?? fr.row ?? fr.startY ?? topY ?? 0;
                    const tx = toTileCoord(rx, 0);
                    const ty = toTileCoord(ry, 0);
                    let w;
                    if (fr.w !== undefined || fr.width !== undefined || fr.cols !== undefined) {
                        w = toTileDim(fr.w ?? fr.width ?? fr.cols, 1);
                    }
                    else if (fr.x2 !== undefined || fr.endX !== undefined || fr.right !== undefined) {
                        const ex = toTileCoord(fr.x2 ?? fr.endX ?? fr.right, tx);
                        w = ex >= tx ? ex - tx + 1 : ex - tx - 1;
                    }
                    else {
                        w = 1;
                    }
                    let h;
                    if (fr.h !== undefined || fr.height !== undefined || fr.rows !== undefined) {
                        h = toTileDim(fr.h ?? fr.height ?? fr.rows, 1);
                    }
                    else if (fr.y2 !== undefined || fr.endY !== undefined || fr.bottom !== undefined) {
                        const ey = toTileCoord(fr.y2 ?? fr.endY ?? fr.bottom, ty);
                        h = ey >= ty ? ey - ty + 1 : ey - ty - 1;
                    }
                    else {
                        h = 1;
                    }
                    const tid = Number(fr.tileId ?? fr.tile ?? fr.id ?? 0) & 0xff;
                    map.fillRect(tx, ty, w, h, tid);
                    recordBounds(tx, ty, w, h);
                    tilesPlaced += Math.abs(w * h);
                }
            }
            // 4. asciiMap
            if (args.asciiMap) {
                const amList = Array.isArray(args.asciiMap) ? args.asciiMap : [args.asciiMap];
                for (const amItem of amList) {
                    if (typeof amItem !== 'object' || amItem === null)
                        continue;
                    const am = amItem;
                    const ax = am.x ?? am.tileX ?? am.col ?? am.column ?? am.startX ?? topX ?? 0;
                    const ay = am.y ?? am.tileY ?? am.row ?? am.startY ?? topY ?? 0;
                    const tx = toTileCoord(ax, 0);
                    const ty = toTileCoord(ay, 0);
                    const rows = am.asciiRows ?? am.rows ?? am.diagram;
                    const legend = am.legend ?? am.mapping;
                    if (rows && legend) {
                        const res = map.loadFromAscii(tx, ty, rows, legend);
                        recordBounds(res.startX, res.startY, res.width, res.height);
                        tilesPlaced += res.width * res.height;
                    }
                }
            }
            await syncChanges('MAP');
            // Smart preview: calculate 30x17 screen view containing modified area
            const focusX = minX <= maxX ? minX : (topX ?? 0);
            const focusY = minY <= maxY ? minY : (topY ?? 0);
            const screenCol = Math.floor(Math.max(0, focusX) / 30);
            const screenRow = Math.floor(Math.max(0, focusY) / 17);
            const previewX = Math.max(0, Math.min(210, screenCol * 30));
            const previewY = Math.max(0, Math.min(119, screenRow * 17));
            return JSON.parse(JSON.stringify({
                success: true,
                message: `Map updated (${tilesPlaced} tiles placed/filled).`,
                screen: { col: screenCol, row: screenRow },
                bounds: minX <= maxX ? { minX, minY, maxX, maxY } : undefined,
                previewScreen: { x: previewX, y: previewY, w: 30, h: 17 },
                preview: map.toAscii(previewX, previewY, 30, 17),
            }));
        },
    }));
    // 7. tic80_create_sfx
    tools.push(defineTool({
        name: 'tic80_create_sfx',
        description: 'Create or synthesize a sound effect (SFX) using presets (jump, coin, laser, explosion, hit, powerup, blip) or note parameters.',
        parameters: {
            id: { type: 'integer', required: true, description: 'SFX ID (0-63)' },
            preset: {
                type: 'string',
                description: 'Preset sound type: jump, coin, laser, explosion, hit, powerup, or blip',
            },
            speed: { type: 'integer', description: 'SFX playback speed (1-64 ticks)' },
        },
        output: {
            schema: { type: 'json' },
            render: (_args, val) => [{ type: 'text', text: JSON.stringify(val, null, 2) }],
        },
        async execute(args) {
            const id = args.id & 63;
            if (args.preset) {
                toolCtx.cartridge.audio.createPresetSFX(id, args.preset);
            }
            if (args.speed) {
                toolCtx.cartridge.audio.setSFX(id, { speed: args.speed });
            }
            await syncChanges('AUDIO');
            const sfx = toolCtx.cartridge.audio.getSFX(id);
            return JSON.parse(JSON.stringify({
                success: true,
                sfxId: id,
                preset: args.preset || null,
                speed: sfx?.speed || 6,
            }));
        },
    }));
    // 8. tic80_compose_music
    tools.push(defineTool({
        name: 'tic80_compose_music',
        description: 'Compose tracker music patterns and sequence them into music tracks across 4 channels.',
        parameters: {
            patternId: { type: 'integer', required: true, description: 'Pattern ID (0-63)' },
            channel0: { type: 'array', description: 'Channel 0 notes list (e.g. ["C-4", "E-4", "G-4", "---"])' },
            channel1: { type: 'array', description: 'Channel 1 notes list' },
            channel2: { type: 'array', description: 'Channel 2 notes list' },
            channel3: { type: 'array', description: 'Channel 3 notes list' },
            defaultSfx: { type: 'integer', description: 'Default instrument SFX ID (0-63)' },
            trackId: { type: 'integer', description: 'Optional track ID to assign pattern to' },
            tempo: { type: 'integer', description: 'Track tempo (default: 120)' },
        },
        output: {
            schema: { type: 'json' },
            render: (_args, val) => [{ type: 'text', text: JSON.stringify(val, null, 2) }],
        },
        async execute(args) {
            const pid = args.patternId & 63;
            toolCtx.cartridge.audio.composePattern(pid, {
                channel0: args.channel0,
                channel1: args.channel1,
                channel2: args.channel2,
                channel3: args.channel3,
            }, args.defaultSfx ?? 0);
            if (args.trackId !== undefined) {
                const tid = args.trackId & 63;
                const track = toolCtx.cartridge.audio.getTrack(tid);
                if (track) {
                    track.patterns[0] = pid;
                    if (args.tempo)
                        track.tempo = args.tempo;
                }
            }
            await syncChanges('AUDIO');
            return JSON.parse(JSON.stringify({
                success: true,
                patternId: pid,
                trackId: args.trackId ?? null,
                message: 'Music composed and assigned.',
            }));
        },
    }));
    // 9. tic80_set_palette
    tools.push(defineTool({
        name: 'tic80_set_palette',
        description: 'Customize the TIC-80 16-color palette using presets (sweetie16, pico8, db16, gameboy, cyberpunk) or RGB hex values.',
        parameters: {
            preset: {
                type: 'string',
                description: 'Palette preset: sweetie16, pico8, db16, gameboy, or cyberpunk',
            },
            chunkHex: {
                type: 'string',
                description: '48-character TIC-80 palette hex string',
            },
        },
        output: {
            schema: { type: 'json' },
            render: (_args, val) => [{ type: 'text', text: JSON.stringify(val, null, 2) }],
        },
        async execute(args) {
            if (args.preset) {
                toolCtx.cartridge.palette.setFromPreset(args.preset);
            }
            else if (args.chunkHex) {
                toolCtx.cartridge.palette.loadFromChunkHex(args.chunkHex);
            }
            await syncChanges('PALETTE');
            return JSON.parse(JSON.stringify({
                success: true,
                preset: args.preset || null,
                colors: toolCtx.cartridge.palette.getAllColors().map((c, i) => ({
                    index: i,
                    hex: toolCtx.cartridge.palette.getHex(i),
                })),
            }));
        },
    }));
    // 10. tic80_validate
    tools.push(defineTool({
        name: 'tic80_validate',
        description: 'Perform static lint analysis on the cartridge: syntax, TIC() main loop, code size (<512KB), and API compliance.',
        parameters: {},
        output: {
            schema: { type: 'json' },
            render: (_args, val) => [{ type: 'text', text: JSON.stringify(val, null, 2) }],
        },
        async execute() {
            const report = toolCtx.cartridge.validate();
            return JSON.parse(JSON.stringify(report));
        },
    }));
    // 11. tic80_run
    tools.push(defineTool({
        name: 'tic80_run',
        description: 'Run the current cartridge in the Web Live Studio (with live hot reload) or launch native desktop TIC-80.',
        parameters: {
            mode: {
                type: 'string',
                description: "'web' for live in-browser studio, or 'native' for desktop TIC-80 exe (default: 'web')",
            },
            port: {
                type: 'integer',
                description: 'Port for Web Studio (default: 3088)',
            },
            commands: {
                type: 'array',
                description: "Commands for native runner (e.g. ['run', 'exit'])",
            },
        },
        output: {
            schema: { type: 'json' },
            render: (_args, val) => [{ type: 'text', text: JSON.stringify(val, null, 2) }],
        },
        async execute(args) {
            const mode = args.mode || 'web';
            if (mode === 'web') {
                const port = args.port || 3088;
                const status = await toolCtx.studio.start(toolCtx.cartridge, port);
                return JSON.parse(JSON.stringify({
                    success: true,
                    mode: 'web',
                    url: status.url,
                    message: `Web Live Studio active at ${status.url}. Open in browser to play and test!`,
                    status,
                }));
            }
            else {
                // Native runner
                const tempCartPath = path.resolve(getWorkspaceDir(), 'temp_run.lua');
                await fs.writeFile(tempCartPath, toolCtx.cartridge.toText(), 'utf8');
                const res = await NativeRunner.run({
                    cartPath: tempCartPath,
                    cli: true,
                    commands: args.commands || ['load temp_run.lua', 'run', 'exit'],
                    timeoutMs: 5000,
                });
                return JSON.parse(JSON.stringify({
                    success: res.success,
                    mode: 'native',
                    stdout: res.stdout,
                    stderr: res.stderr,
                    exitCode: res.exitCode,
                }));
            }
        },
    }));
    // 12. tic80_export
    tools.push(defineTool({
        name: 'tic80_export',
        description: 'Export the cartridge to disk as .lua, .tic, or standalone HTML5 playable game.',
        parameters: {
            format: {
                type: 'string',
                description: "'lua', 'tic', 'html', or 'all' (default: 'all')",
            },
            outputDir: {
                type: 'string',
                description: 'Destination directory path (default: ./export)',
            },
            filename: {
                type: 'string',
                description: 'Base file name (without extension)',
            },
        },
        output: {
            schema: { type: 'json' },
            render: (_args, val) => [{ type: 'text', text: JSON.stringify(val, null, 2) }],
        },
        async execute(args) {
            const outputDir = args.outputDir
                ? (path.isAbsolute(args.outputDir) ? args.outputDir : path.resolve(getWorkspaceDir(), args.outputDir))
                : path.resolve(getWorkspaceDir(), 'export');
            const format = args.format || 'all';
            const result = await CartridgeExporter.export(toolCtx.cartridge, {
                format,
                outputDir,
                filename: args.filename,
            });
            return JSON.parse(JSON.stringify({
                success: true,
                ...result,
            }));
        },
    }));
    // 13. tic80_studio_status
    tools.push(defineTool({
        name: 'tic80_studio_status',
        description: 'Get real-time status of the Web Live Studio, connected players, and execution logs.',
        parameters: {},
        output: {
            schema: { type: 'json' },
            render: (_args, val) => [{ type: 'text', text: JSON.stringify(val, null, 2) }],
        },
        async execute() {
            return JSON.parse(JSON.stringify(toolCtx.studio.getStatus()));
        },
    }));
    return tools;
}
//# sourceMappingURL=index.js.map