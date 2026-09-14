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
        title: 'Sokoban Warehouse',
        author: 'TIC-80 Assistant',
        desc: 'Classic puzzle game pushing boxes into targets',
        script: 'lua',
        input: 'gamepad',
      };

      // Player sprite
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

      // Box sprite
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

      cart.audio.createPresetSFX(0, 'hit');
      cart.audio.createPresetSFX(1, 'powerup');

      cart.code = `-- title:   Sokoban Warehouse
-- author:  TIC-80 Assistant
-- desc:    Classic puzzle game pushing boxes into targets
-- script:  lua
-- input:   gamepad

local grid = 12
local ox, oy = 72, 20
local steps = 0

-- 0:Floor, 1:Wall, 2:Target
local map_data = {
  1,1,1,1,1,1,1,1,
  1,0,0,0,0,0,0,1,
  1,0,2,0,0,0,0,1,
  1,0,0,0,0,0,0,1,
  1,0,0,0,0,0,0,1,
  1,1,1,1,0,0,2,1,
  1,1,1,1,1,1,1,1
}
local mw, mh = 8, 7

local player = {x = 3, y = 3}
local boxes = { {x = 4, y = 3}, {x = 5, y = 4} }

local function get_tile(x, y)
  if x < 1 or x > mw or y < 1 or y > mh then return 1 end
  return map_data[(y - 1) * mw + x]
end

local function get_box(x, y)
  for _, b in ipairs(boxes) do
    if b.x == x and b.y == y then return b end
  end
  return nil
end

local function check_win()
  for _, b in ipairs(boxes) do
    if get_tile(b.x, b.y) ~= 2 then return false end
  end
  return true
end

local function move(dx, dy)
  local nx, ny = player.x + dx, player.y + dy
  if get_tile(nx, ny) == 1 then return end

  local b = get_box(nx, ny)
  if b then
    local bx, by = b.x + dx, b.y + dy
    if get_tile(bx, by) == 1 or get_box(bx, by) then return end
    b.x, b.y = bx, by
    sfx(0)
  end

  player.x, player.y = nx, ny
  steps = steps + 1
  if check_win() then sfx(1) end
end

function TIC()
  if btnp(0) then move(0, -1) end
  if btnp(1) then move(0, 1) end
  if btnp(2) then move(-1, 0) end
  if btnp(3) then move(1, 0) end

  cls(0)

  -- Draw Map
  for y = 1, mh do
    for x = 1, mw do
      local t = get_tile(x, y)
      local px = ox + (x - 1) * grid
      local py = oy + (y - 1) * grid
      if t == 1 then
        rect(px, py, grid, grid, 14)
        rectb(px, py, grid, grid, 15)
      elseif t == 2 then
        circ(px + grid // 2, py + grid // 2, 3, 6)
      end
    end
  end

  -- Draw Boxes
  for _, b in ipairs(boxes) do
    local px = ox + (b.x - 1) * grid
    local py = oy + (b.y - 1) * grid
    local is_target = get_tile(b.x, b.y) == 2
    rect(px + 1, py + 1, grid - 2, grid - 2, is_target and 5 or 4)
    rectb(px + 1, py + 1, grid - 2, grid - 2, 12)
  end

  -- Draw Player
  local px = ox + (player.x - 1) * grid
  local py = oy + (player.y - 1) * grid
  circ(px + grid // 2, py + grid // 2, 4, 11)

  print("STEPS: " .. steps, 4, 4, 12)
  if check_win() then
    print("STAGE CLEARED!", 84, 110, 11)
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
