/**
 * Pre-built TIC-80 Game Templates
 * 
 * Provides complete starting templates with code, sprites, maps, and sound effects:
 * - minimal: Barebones clean starter
 * - platformer: Jump, gravity, physics & collision
 * - sokoban: Puzzle box pusher
 * - rpg: Top-down adventure with NPC dialogue
 * - shmup: Space shoot'em up with bullets and starfield
 */

import { Cartridge } from '../core/cartridge.js';

export function createTemplate(templateName: string): Cartridge {
  const name = templateName.toLowerCase();
  const cart = new Cartridge();

  switch (name) {
    case 'platformer': {
      cart.metadata = {
        title: 'Retro Platformer',
        author: 'TIC-80 Assistant',
        desc: 'A jump & run platformer with physics',
        script: 'lua',
        input: 'gamepad',
      };

      // Player sprite (bank 1, id 1) - cute retro adventurer
      cart.sprites.setFromAscii(1, [
        '..4444..',
        '.4ffff4.',
        '.f4444f.',
        '.ffffff.',
        '.333333.',
        '33999933',
        '.399993.',
        '.39..93.',
      ], false);

      // Block/Ground tile (bank 0, id 1)
      cart.sprites.setFromAscii(1, [
        'eeeeeeee',
        'e666666e',
        'e666666e',
        'e666666e',
        'e666666e',
        'e666666e',
        'e666666e',
        'eeeeeeee',
      ], true);

      // Coin tile (bank 0, id 2)
      cart.sprites.setFromAscii(2, [
        '..4444..',
        '.4ffff4.',
        '4f4444f4',
        '4f4ff4f4',
        '4f4ff4f4',
        '4f4444f4',
        '.4ffff4.',
        '..4444..',
      ], true);

      // SFX 0: Jump, SFX 1: Coin
      cart.audio.createPresetSFX(0, 'jump');
      cart.audio.createPresetSFX(1, 'coin');

      cart.code = `-- title:   Retro Platformer
-- author:  TIC-80 Assistant
-- desc:    A jump & run platformer with physics
-- script:  lua
-- input:   gamepad

local player = {
  x = 24, y = 80, vx = 0, vy = 0,
  w = 8, h = 8, grounded = false,
  facing = 0, score = 0
}

local gravity = 0.25
local jump_force = -3.8
local max_fall = 4.5

local platforms = {
  {x = 0,   y = 120, w = 240, h = 16},
  {x = 50,  y = 96,  w = 48,  h = 8},
  {x = 130, y = 72,  w = 56,  h = 8},
  {x = 60,  y = 48,  w = 40,  h = 8},
  {x = 160, y = 36,  w = 50,  h = 8}
}

local coins = {
  {x = 64, y = 84, active = true},
  {x = 150, y = 60, active = true},
  {x = 76, y = 36, active = true},
  {x = 180, y = 24, active = true}
}

local function AABB(x1, y1, w1, h1, x2, y2, w2, h2)
  return x1 < x2 + w2 and x1 + w1 > x2 and
         y1 < y2 + h2 and y1 + h1 > y2
end

local function update()
  -- Horizontal input
  if btn(2) then player.vx = -1.5; player.facing = 1
  elseif btn(3) then player.vx = 1.5; player.facing = 0
  else player.vx = player.vx * 0.8 end

  -- Jump input
  if btnp(4) and player.grounded then
    player.vy = jump_force
    player.grounded = false
    sfx(0)
  end

  -- Apply Gravity
  player.vy = player.vy + gravity
  if player.vy > max_fall then player.vy = max_fall end

  -- Move X & Collide
  player.x = player.x + player.vx
  for _, p in ipairs(platforms) do
    if AABB(player.x, player.y, player.w, player.h, p.x, p.y, p.w, p.h) then
      if player.vx > 0 then player.x = p.x - player.w
      elseif player.vx < 0 then player.x = p.x + p.w end
      player.vx = 0
    end
  end

  -- Move Y & Collide
  player.y = player.y + player.vy
  player.grounded = false
  for _, p in ipairs(platforms) do
    if AABB(player.x, player.y, player.w, player.h, p.x, p.y, p.w, p.h) then
      if player.vy > 0 then
        player.y = p.y - player.h
        player.grounded = true
      elseif player.vy < 0 then
        player.y = p.y + p.h
      end
      player.vy = 0
    end
  end

  -- Coin pickup
  for _, c in ipairs(coins) do
    if c.active and AABB(player.x, player.y, player.w, player.h, c.x, c.y, 8, 8) then
      c.active = false
      player.score = player.score + 100
      sfx(1)
    end
  end

  -- Boundary
  if player.x < 0 then player.x = 0 end
  if player.x > 240 - player.w then player.x = 240 - player.w end
  if player.y > 136 then player.x, player.y, player.vy = 24, 80, 0 end
end

function TIC()
  update()

  cls(13) -- Sky background

  -- Draw platforms
  for _, p in ipairs(platforms) do
    rect(p.x, p.y, p.w, p.h, 6)
    rectb(p.x, p.y, p.w, p.h, 7)
  end

  -- Draw coins
  for _, c in ipairs(coins) do
    if c.active then
      spr(2, c.x, c.y, 0)
    end
  end

  -- Draw player
  spr(1, player.x, player.y, 0, 1, player.facing)

  -- UI
  print("SCORE: " .. player.score, 4, 4, 15)
  print("ARROWS: MOVE  Z: JUMP", 100, 4, 14)
end
`;
      break;
    }

    case 'sokoban': {
      cart.metadata = {
        title: 'Sokoban Multiverse',
        author: 'TIC-80 Assistant',
        desc: 'Multi-room Sokoban puzzle with window-sized stages (30x17) auto-detected in L-to-R, T-to-B order',
        script: 'lua',
        input: 'gamepad',
      };

      // Bank 0: Map Tiles
      // Tile 1: Solid Brick Wall (Flag 0 = Solid)
      cart.sprites.setFromAscii(1, [
        '88888888',
        '8eeeeee8',
        '8ebbbbe8',
        '8ebbbbe8',
        '8ebbbbe8',
        '8ebbbbe8',
        '8eeeeee8',
        '88888888',
      ], true);
      cart.sprites.setFlag(1, 0, true, true);

      // Tile 2: Interior Floor
      cart.sprites.setFromAscii(2, [
        '00000000',
        '0eeeeee0',
        '0e0000e0',
        '0e0000e0',
        '0e0000e0',
        '0e0000e0',
        '0eeeeee0',
        '00000000',
      ], true);

      // Tile 3: Goal / Target Plate
      cart.sprites.setFromAscii(3, [
        '00000000',
        '00bbbb00',
        '0beeeeb0',
        '0be44eb0',
        '0be44eb0',
        '0beeeeb0',
        '00bbbb00',
        '00000000',
      ], true);

      // Tile 4: Box Spawn Tile
      cart.sprites.setFromAscii(4, [
        '44444444',
        '4ffffff4',
        '4f4444f4',
        '4f4ee4f4',
        '4f4ee4f4',
        '4f4444f4',
        '4ffffff4',
        '44444444',
      ], true);

      // Tile 5: Player Spawn Tile
      cart.sprites.setFromAscii(5, [
        '..3333..',
        '.3ffff3.',
        '3f3333f3',
        '3ffffff3',
        '.bbbbbb.',
        'bb9999bb',
        '.b9999b.',
        '.9....9.',
      ], true);

      // Tile 6: Box on Goal Spawn Tile
      cart.sprites.setFromAscii(6, [
        'bbbbbbbb',
        'bffffffb',
        'bfbbbbfe',
        'bfbeebfe',
        'bfbeebfe',
        'bfbbbbfe',
        'bffffffb',
        'bbbbbbbb',
      ], true);

      // Bank 1: Dynamic Entities
      // Sprite 1: Player
      cart.sprites.setFromAscii(1, [
        '..3333..',
        '.3ffff3.',
        '3f3333f3',
        '3ffffff3',
        '.bbbbbb.',
        'bb9999bb',
        '.b9999b.',
        '.9....9.',
      ], false);

      // Sprite 2: Normal Box
      cart.sprites.setFromAscii(2, [
        '44444444',
        '4ffffff4',
        '4f4444f4',
        '4f4ee4f4',
        '4f4ee4f4',
        '4f4444f4',
        '4ffffff4',
        '44444444',
      ], false);

      // Sprite 3: Solved Box on Goal
      cart.sprites.setFromAscii(3, [
        'bbbbbbbb',
        'bffffffb',
        'bfbbbbfe',
        'bfbeebfe',
        'bfbeebfe',
        'bfbbbbfe',
        'bffffffb',
        'bbbbbbbb',
      ], false);

      // Sound Effects
      cart.audio.createPresetSFX(0, 'blip');     // Step
      cart.audio.createPresetSFX(1, 'hit');      // Push
      cart.audio.createPresetSFX(2, 'powerup');  // Win
      cart.audio.createPresetSFX(3, 'blip');     // Blocked

      // Helper to stamp a 30x17 room into the world map
      const stampRoom = (ox: number, oy: number, layout: string[]) => {
        const legend: Record<string, number> = {
          '#': 1, // Wall
          '.': 2, // Floor
          '*': 3, // Goal
          '$': 4, // Box
          '@': 5, // Player
          '&': 6, // Box on Goal
          ' ': 0, // Void
        };
        for (let r = 0; r < 17; r++) {
          const rowStr = layout[r] || '';
          for (let c = 0; c < 30; c++) {
            const ch = rowStr[c] || '#';
            cart.map.setTile(ox + c, oy + r, legend[ch] ?? 1);
          }
        }
      };

      // Room 1 (rx=0, ry=0): Stage 1 - 2 Boxes, 2 Goals
      stampRoom(0, 0, [
        '##############################',
        '##############################',
        '##############################',
        '##############################',
        '###########........###########',
        '###########..$*....###########',
        '###########..#.....###########',
        '###########..$*....###########',
        '###########..@.....###########',
        '###########........###########',
        '##############################',
        '##############################',
        '##############################',
        '##############################',
        '##############################',
        '##############################',
        '##############################',
      ]);

      // Room 2 (rx=1, ry=0): Stage 2 - 4 Boxes, 4 Goals
      stampRoom(30, 0, [
        '##############################',
        '##############################',
        '##############################',
        '##########..........##########',
        '##########...#..#...##########',
        '##########...$..$...##########',
        '##########...*..*...##########',
        '##########....$$....##########',
        '##########....**....##########',
        '##########.....@....##########',
        '##########..........##########',
        '##############################',
        '##############################',
        '##############################',
        '##############################',
        '##############################',
        '##############################',
      ]);

      // Room 3 (rx=2, ry=0): Stage 3 - Corridor Tactics
      stampRoom(60, 0, [
        '##############################',
        '##############################',
        '##############################',
        '#########............#########',
        '#########....#..#....#########',
        '#########..$.*..*.$..#########',
        '#########....#..#....#########',
        '#########..*.$..$.*..#########',
        '#########....#..#....#########',
        '#########......@.....#########',
        '#########............#########',
        '##############################',
        '##############################',
        '##############################',
        '##############################',
        '##############################',
        '##############################',
      ]);

      cart.code = `--------------------------------------------------------------------
-- CONFIG: Tunable gameplay parameters at the very top
--------------------------------------------------------------------
cfg = {
  room_w = 30,              -- Width of one room in tiles (240px / 8)
  room_h = 17,              -- Height of one room in tiles (136px / 8)
  rooms_x = 8,              -- Max rooms horizontally on 240-wide map
  rooms_y = 8,              -- Max rooms vertically on 136-high map

  -- Tile IDs (Bank 0 - Map layer)
  t_wall = 1,               -- Solid wall
  t_floor = 2,              -- Interior floor
  t_goal = 3,               -- Target / Goal plate
  t_box = 4,                -- Box entity spawn
  t_player = 5,             -- Player entity spawn
  t_box_on_goal = 6,        -- Box starting on target

  -- Sprite IDs (Bank 1 - Entity layer)
  spr_player = 1,           -- Player sprite
  spr_box = 2,              -- Normal box sprite
  spr_box_done = 3,         -- Box on target sprite

  -- Gameplay Feel & Controls
  solid_flag = 0,           -- Sprite flag 0 is solid wall
  slide_speed = 0.45,       -- Smooth movement visual interpolation
  repeat_delay = 14,        -- Frames before auto-repeat movement
  repeat_rate = 6,          -- Frames between repeated moves
  max_undo = 64,            -- Max undo history
  auto_next_delay = 60,     -- Frames to celebrate before auto-next

  -- Sound Effects
  sfx_step = 0,
  sfx_push = 1,
  sfx_win = 2,
  sfx_block = 3,
}

--------------------------------------------------------------------
-- STATE
--------------------------------------------------------------------
local levels = {}           -- Auto-detected 30x17 room list
local level_no = 1          -- Active level index (1-based)
local player = {gx = 0, gy = 0, vx = 0, vy = 0}
local boxes = {}            -- Active boxes {gx, gy, vx, vy}
local history = {}          -- Undo stack
local erased = {}           -- Spawn tiles converted to floors
local steps = 0
local pushes = 0
local cleared = false
local clear_timer = 0
local hold_dir = -1
local hold_time = 0

--------------------------------------------------------------------
-- AUTO-DETECTION: Scans map rooms from left-to-right, top-to-bottom
--------------------------------------------------------------------
local function scan_levels()
  levels = {}
  for ry = 0, cfg.rooms_y - 1 do
    for rx = 0, cfg.rooms_x - 1 do
      local ox = rx * cfg.room_w
      local oy = ry * cfg.room_h
      local has_player = false
      local box_count = 0
      local goal_count = 0

      for y = 0, cfg.room_h - 1 do
        for x = 0, cfg.room_w - 1 do
          local t = mget(ox + x, oy + y)
          if t == cfg.t_player then has_player = true end
          if t == cfg.t_box or t == cfg.t_box_on_goal then box_count = box_count + 1 end
          if t == cfg.t_goal or t == cfg.t_box_on_goal then goal_count = goal_count + 1 end
        end
      end

      -- Valid room if it contains boxes and goals
      if box_count > 0 and goal_count > 0 then
        table.insert(levels, {
          rx = rx, ry = ry,
          ox = ox, oy = oy,
          box_count = box_count,
          has_player = has_player,
          name = string.format("ROOM %d-%d", rx + 1, ry + 1)
        })
      end
    end
  end
end

--------------------------------------------------------------------
-- LEVEL LOADING & RESTORATION
--------------------------------------------------------------------
local function restore_map()
  for i = 1, #erased do
    local e = erased[i]
    mset(e.mx, e.my, e.t)
  end
  erased = {}
end

local function box_at(x, y)
  for i = 1, #boxes do
    local b = boxes[i]
    if b.gx == x and b.gy == y then return b, i end
  end
  return nil
end

local function is_on_goal(b)
  local rm = levels[level_no]
  return mget(rm.ox + b.gx, rm.oy + b.gy) == cfg.t_goal
end

local function load_level(idx)
  restore_map()
  if #levels == 0 then return end

  level_no = (idx - 1) % #levels + 1
  local rm = levels[level_no]

  boxes = {}
  player = nil
  history = {}
  steps = 0
  pushes = 0
  cleared = false
  clear_timer = 0

  for y = 0, cfg.room_h - 1 do
    for x = 0, cfg.room_w - 1 do
      local mx, my = rm.ox + x, rm.oy + y
      local t = mget(mx, my)
      if t == cfg.t_player then
        player = {gx = x, gy = y, vx = x, vy = y}
        table.insert(erased, {mx = mx, my = my, t = t})
        mset(mx, my, cfg.t_floor)
      elseif t == cfg.t_box then
        table.insert(boxes, {gx = x, gy = y, vx = x, vy = y})
        table.insert(erased, {mx = mx, my = my, t = t})
        mset(mx, my, cfg.t_floor)
      elseif t == cfg.t_box_on_goal then
        table.insert(boxes, {gx = x, gy = y, vx = x, vy = y})
        table.insert(erased, {mx = mx, my = my, t = t})
        mset(mx, my, cfg.t_goal)
      end
    end
  end

  if not player then
    for y = 1, cfg.room_h - 2 do
      for x = 1, cfg.room_w - 2 do
        local t = mget(rm.ox + x, rm.oy + y)
        if t == cfg.t_floor and not box_at(x, y) then
          player = {gx = x, gy = y, vx = x, vy = y}
          break
        end
      end
      if player then break end
    end
    if not player then player = {gx = 1, gy = 1, vx = 1, vy = 1} end
  end
end

--------------------------------------------------------------------
-- MOVEMENT & COLLISION
--------------------------------------------------------------------
local function is_walkable(x, y)
  local rm = levels[level_no]
  if x < 0 or x >= cfg.room_w or y < 0 or y >= cfg.room_h then return false end
  local t = mget(rm.ox + x, rm.oy + y)
  if t == cfg.t_wall or fget(t, cfg.solid_flag) then return false end
  return true
end

local function check_win()
  if #boxes == 0 then return false end
  for i = 1, #boxes do
    if not is_on_goal(boxes[i]) then return false end
  end
  return true
end

local function move(dx, dy)
  if cleared then return end
  local nx, ny = player.gx + dx, player.gy + dy
  if not is_walkable(nx, ny) then
    sfx(cfg.sfx_block)
    return
  end

  local b, b_idx = box_at(nx, ny)
  local pushed_box = nil

  if b then
    local bx, by = b.gx + dx, b.gy + dy
    if not is_walkable(bx, by) or box_at(bx, by) then
      sfx(cfg.sfx_block)
      return
    end
    pushed_box = {idx = b_idx, from_gx = b.gx, from_gy = b.gy}
    b.gx, b.gy = bx, by
    pushes = pushes + 1
    sfx(cfg.sfx_push)
  else
    sfx(cfg.sfx_step)
  end

  table.insert(history, {
    player = {gx = player.gx, gy = player.gy},
    box = pushed_box,
  })
  if #history > cfg.max_undo then table.remove(history, 1) end

  player.gx, player.gy = nx, ny
  steps = steps + 1

  if check_win() then
    cleared = true
    clear_timer = 0
    sfx(cfg.sfx_win)
  end
end

local function undo()
  if #history == 0 or cleared then return end
  local h = table.remove(history)
  player.gx, player.gy = h.player.gx, h.player.gy
  if h.box then
    local b = boxes[h.box.idx]
    if b then
      b.gx, b.gy = h.box.from_gx, h.box.from_gy
      pushes = math.max(0, pushes - 1)
    end
  end
  steps = math.max(0, steps - 1)
  sfx(cfg.sfx_step)
end

--------------------------------------------------------------------
-- INPUT HANDLING
--------------------------------------------------------------------
local function handle_input()
  local dirs = {
    [0] = {0, -1},  -- Up
    [1] = {0, 1},   -- Down
    [2] = {-1, 0},  -- Left
    [3] = {1, 0},   -- Right
  }

  local pressed_dir = -1
  for d = 0, 3 do
    if btn(d) then pressed_dir = d break end
  end

  if pressed_dir ~= -1 then
    if pressed_dir ~= hold_dir then
      hold_dir = pressed_dir
      hold_time = 0
      local d = dirs[pressed_dir]
      move(d[1], d[2])
    else
      hold_time = hold_time + 1
      if hold_time >= cfg.repeat_delay and (hold_time - cfg.repeat_delay) % cfg.repeat_rate == 0 then
        local d = dirs[pressed_dir]
        move(d[1], d[2])
      end
    end
  else
    hold_dir = -1
    hold_time = 0
  end

  -- [Z] Undo, [X] Restart, [A] Next room, [S] Prev room
  if btnp(4) or keyp(26) then undo() end
  if btnp(5) or keyp(18) then load_level(level_no) end
  if btnp(6) then load_level(level_no + 1) end
  if btnp(7) then load_level(level_no - 1) end
end

--------------------------------------------------------------------
-- INIT & MAIN LOOP
--------------------------------------------------------------------
scan_levels()
load_level(1)

function TIC()
  handle_input()

  -- Visual interpolation
  player.vx = player.vx + (player.gx - player.vx) * cfg.slide_speed
  player.vy = player.vy + (player.gy - player.vy) * cfg.slide_speed
  for i = 1, #boxes do
    local b = boxes[i]
    b.vx = b.vx + (b.gx - b.vx) * cfg.slide_speed
    b.vy = b.vy + (b.gy - b.vy) * cfg.slide_speed
  end

  cls(0)

  local rm = levels[level_no]
  if rm then
    -- 1. Full-screen 30x17 room map (240x136 pixels)
    map(rm.ox, rm.oy, cfg.room_w, cfg.room_h, 0, 0)

    -- 2. Draw boxes
    for i = 1, #boxes do
      local b = boxes[i]
      local px = math.floor(b.vx * 8)
      local py = math.floor(b.vy * 8)
      local spr_id = is_on_goal(b) and cfg.spr_box_done or cfg.spr_box
      spr(spr_id, px, py, 0)
    end

    -- 3. Draw player
    local px = math.floor(player.vx * 8)
    local py = math.floor(player.vy * 8)
    spr(cfg.spr_player, px, py, 0)

    -- 4. Top HUD bar
    rect(0, 0, 240, 9, 0)
    line(0, 9, 240, 9, 14)
    local info = string.format("%s (%d/%d)  STEPS:%d  PUSH:%d", rm.name, level_no, #levels, steps, pushes)
    print(info, 4, 2, 12, true, 1, true)
    print("[Z]UNDO [X]RETRY", 160, 2, 13, true, 1, true)

    -- 5. Victory celebration & auto-next stage
    if cleared then
      clear_timer = clear_timer + 1
      rect(50, 52, 140, 28, 0)
      rectb(50, 52, 140, 28, 11)
      print("STAGE CLEARED!", 78, 58, 11, true, 1, false)
      print("AUTO-ADVANCING...", 74, 68, 12, true, 1, true)

      if clear_timer >= cfg.auto_next_delay then
        if level_no < #levels then
          load_level(level_no + 1)
        else
          rect(40, 48, 160, 36, 0)
          rectb(40, 48, 160, 36, 11)
          print("ALL STAGES COMPLETED!", 54, 56, 11, true, 1, false)
          print("PRESS [X] TO PLAY AGAIN", 58, 68, 12, true, 1, true)
          if btnp(5) then load_level(1) end
        end
      end
    end
  else
    print("NO SOKOBAN ROOMS FOUND ON MAP", 30, 60, 6)
    print("USE F3 MAP EDITOR TO DRAW 30x17 ROOMS", 20, 72, 12)
  end
end
`;
      break;
    }

    case 'shmup': {
      cart.metadata = {
        title: 'Star Striker',
        author: 'TIC-80 Assistant',
        desc: 'Vertical scrolling arcade space shooter',
        script: 'lua',
        input: 'gamepad',
      };

      cart.audio.createPresetSFX(0, 'laser');
      cart.audio.createPresetSFX(1, 'explosion');

      cart.code = `-- title:   Star Striker
-- author:  TIC-80 Assistant
-- desc:    Vertical scrolling arcade space shooter
-- script:  lua
-- input:   gamepad

local stars = {}
for i = 1, 40 do
  table.insert(stars, {
    x = math.random(0, 239),
    y = math.random(0, 135),
    speed = math.random(1, 3),
    color = math.random(13, 15)
  })
end

local player = {x = 116, y = 110, speed = 2, cooldown = 0, score = 0}
local bullets = {}
local enemies = {}
local spawn_timer = 0

function TIC()
  -- Player Movement
  if btn(0) and player.y > 10 then player.y = player.y - player.speed end
  if btn(1) and player.y < 124 then player.y = player.y + player.speed end
  if btn(2) and player.x > 10 then player.x = player.x - player.speed end
  if btn(3) and player.x < 222 then player.x = player.x + player.speed end

  -- Shooting
  if player.cooldown > 0 then player.cooldown = player.cooldown - 1 end
  if btn(4) and player.cooldown == 0 then
    table.insert(bullets, {x = player.x + 3, y = player.y - 2})
    player.cooldown = 10
    sfx(0)
  end

  -- Enemy Spawning
  spawn_timer = spawn_timer + 1
  if spawn_timer > 40 then
    table.insert(enemies, {x = math.random(20, 220), y = -10, vy = math.random(1, 2)})
    spawn_timer = 0
  end

  -- Update Bullets
  for i = #bullets, 1, -1 do
    local b = bullets[i]
    b.y = b.y - 4
    if b.y < -5 then table.remove(bullets, i) end
  end

  -- Update Enemies & Collision
  for i = #enemies, 1, -1 do
    local e = enemies[i]
    e.y = e.y + e.vy
    local dead = false
    for j = #bullets, 1, -1 do
      local b = bullets[j]
      if math.abs(b.x - e.x) < 8 and math.abs(b.y - e.y) < 8 then
        dead = true
        table.remove(bullets, j)
        break
      end
    end
    if dead then
      player.score = player.score + 50
      sfx(1)
      table.remove(enemies, i)
    elseif e.y > 140 then
      table.remove(enemies, i)
    end
  end

  cls(0)

  -- Draw Stars
  for _, s in ipairs(stars) do
    pix(s.x, s.y, s.color)
    s.y = (s.y + s.speed) % 136
  end

  -- Draw Bullets
  for _, b in ipairs(bullets) do
    rect(b.x, b.y, 2, 4, 11)
  end

  -- Draw Enemies
  for _, e in ipairs(enemies) do
    circ(e.x, e.y, 4, 2)
    line(e.x - 6, e.y - 2, e.x + 6, e.y - 2, 3)
  end

  -- Draw Player Ship
  tri(player.x + 4, player.y - 4, player.x, player.y + 6, player.x + 8, player.y + 6, 10)

  print("SCORE: " .. player.score, 4, 4, 15)
end
`;
      break;
    }

    case 'minimal':
    default: {
      cart.metadata = {
        title: 'Minimal TIC-80 Starter',
        author: 'AI Agent',
        desc: 'A clean starter project',
        script: 'lua',
        input: 'gamepad',
      };

      cart.code = `-- title:   Minimal TIC-80 Starter
-- author:  AI Agent
-- desc:    A clean starter project
-- script:  lua
-- input:   gamepad

local t = 0

function TIC()
  t = t + 1
  cls(13)

  local x = 120 + math.cos(t * 0.05) * 40
  local y = 68 + math.sin(t * 0.05) * 20

  circ(x, y, 12, 11)
  circb(x, y, 12, 12)

  print("TIC-80 READY", 92, 64, 15)
  print("TIME: " .. t, 4, 4, 14)
end
`;
      break;
    }
  }

  return cart;
}
