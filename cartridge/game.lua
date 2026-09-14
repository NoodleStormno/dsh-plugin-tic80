-- title:  TIC-80 Game
-- author: DeepSeek & User
-- desc:   Created with DeepSeek Harness
-- script: lua
-- input:  gamepad

-- title:   Sokoban
-- author:  DeepSeek & User
-- desc:    Sokoban with auto-detected levels and auto-advance
-- script:  lua
-- input:   gamepad

--------------------------------------------------------------------
-- CONFIG - all gameplay tuning values live here (tweak freely)
--------------------------------------------------------------------
-- HOW LEVELS WORK (no code change needed to add one):
--   1. Stamp the MARKER tile (id 7) anywhere on the map -> that cell is
--      the level's anchor; the playable room is the window that starts
--      right below it: (x, y+1) .. (x+w-1, y+h).
--   2. Draw the room inside that window: wall / floor / goal tiles and
--      exactly one player tile + one or more crate tiles.
--   3. Levels are AUTO-DETECTED by scanning the map for markers, in
--      top-to-bottom, left-to-right order. Clearing one loads the next.
local cfg = {
  map_w = 10, map_h = 8,      -- level window size in tiles
  scr_x = 80, scr_y = 32,     -- where the window is drawn (pixels)

  -- Tile IDs (Bank 0 - drawn in the TIC-80 tile editor)
  t_wall   = 1,   -- solid block (sprite flag 0)
  t_floor  = 2,
  t_goal   = 3,
  t_box    = 4,   -- crate: placed on the map, becomes an entity at load
  t_player = 5,   -- player: placed on the map, becomes an entity at load
  t_boxok  = 6,   -- crate resting on a goal (drawn instead of t_box)
  t_marker = 7,   -- level anchor (never drawn)

  -- Gameplay feel
  solid_flag   = 0,     -- sprite flag index meaning "solid"
  repeat_delay = 14,    -- frames held before auto-repeat
  repeat_rate  = 6,     -- frames between auto-repeats
  slide        = 0.45,  -- visual smoothing (0 = snap, 1 = never arrives)
  max_undo     = 64,
  win_delay    = 90,    -- frames the CLEAR banner shows before auto-next

  -- Sound effects
  sfx_push = 0, sfx_win = 1, sfx_block = 2,
}

--------------------------------------------------------------------
-- STATE
--------------------------------------------------------------------
local player     = {gx = 0, gy = 0, vx = 0, vy = 0}  -- grid + visual pos
local boxes      = {}                                -- {gx,gy,vx,vy}
local history    = {}                                -- undo stack
local erased     = {}                                -- map cells we cleared
local levels     = {}                                -- auto-detected windows
local level_no   = 1                                 -- current level (1-based)
local moves      = 0
local cleared    = false
local clear_wait = 0                                 -- frames until auto-next
local empty_skip = 0                                 -- guards broken levels

local function cur()
  return levels[level_no] or {x = 0, y = 0, w = cfg.map_w, h = cfg.map_h}
end

--------------------------------------------------------------------
-- MAP HELPERS (the map is the single source of truth)
--------------------------------------------------------------------
local function walkable(x, y)
  local lv = cur()
  if x < 0 or y < 0 or x >= lv.w or y >= lv.h then return false end
  local t = mget(lv.x + x, lv.y + y)
  if t == cfg.t_wall or fget(t, cfg.solid_flag) then return false end
  return true
end

local function box_at(x, y)
  for i = 1, #boxes do
    local b = boxes[i]
    if b.gx == x and b.gy == y then return b end
  end
end

local function on_goal(x, y)
  local lv = cur()
  return mget(lv.x + x, lv.y + y) == cfg.t_goal
end

--------------------------------------------------------------------
-- LEVEL AUTO-DETECTION: scan the whole map once for marker tiles
--------------------------------------------------------------------
local function scan_levels()
  levels = {}
  for my = 0, 135 do
    for mx = 0, 239 do
      if mget(mx, my) == cfg.t_marker then
        levels[#levels + 1] = {x = mx, y = my + 1, w = cfg.map_w, h = cfg.map_h}
      end
    end
  end
end

--------------------------------------------------------------------
-- LEVEL LOADING: entities come straight from the map, then are erased
--------------------------------------------------------------------
local function load_level(idx)
  local n = #levels
  if n == 0 then return end

  for i = 1, #erased do                       -- restore previous erasures
    local e = erased[i]
    mset(e.mx, e.my, e.t)
  end
  erased, boxes, history = {}, {}, {}
  moves, cleared, clear_wait = 0, false, 0

  level_no = (idx - 1) % n + 1                -- wrap around forever
  local lv = levels[level_no]

  for y = 0, lv.h - 1 do
    for x = 0, lv.w - 1 do
      local mx, my = lv.x + x, lv.y + y
      local t = mget(mx, my)
      if t == cfg.t_box then
        boxes[#boxes + 1] = {gx = x, gy = y, vx = x, vy = y}
        erased[#erased + 1] = {mx = mx, my = my, t = t}
        mset(mx, my, cfg.t_floor)
      elseif t == cfg.t_player then
        player.gx, player.gy, player.vx, player.vy = x, y, x, y
        erased[#erased + 1] = {mx = mx, my = my, t = t}
        mset(mx, my, cfg.t_floor)
      end
    end
  end
  if #boxes > 0 then empty_skip = 0 end
end

--------------------------------------------------------------------
-- RULES
--------------------------------------------------------------------
local function push_undo()
  local snap = {px = player.gx, py = player.gy, bx = {}}
  for i = 1, #boxes do snap.bx[i] = {boxes[i].gx, boxes[i].gy} end
  history[#history + 1] = snap
  if #history > cfg.max_undo then table.remove(history, 1) end
end

local function undo()
  local s = history[#history]
  if not s then return end
  history[#history] = nil
  player.gx, player.gy = s.px, s.py
  for i = 1, #boxes do
    if s.bx[i] then boxes[i].gx, boxes[i].gy = s.bx[i][1], s.bx[i][2] end
  end
  if moves > 0 then moves = moves - 1 end
  cleared, clear_wait = false, 0
end

local function is_win()
  if #boxes == 0 then return false end
  for i = 1, #boxes do
    if not on_goal(boxes[i].gx, boxes[i].gy) then return false end
  end
  return true
end

local function try_move(dx, dy)
  if cleared then return end
  local nx, ny = player.gx + dx, player.gy + dy

  if not walkable(nx, ny) then sfx(cfg.sfx_block) return end

  local b = box_at(nx, ny)
  if b then
    local bx, by = nx + dx, ny + dy
    if not walkable(bx, by) or box_at(bx, by) then
      sfx(cfg.sfx_block) return
    end
    push_undo()
    b.gx, b.gy = bx, by
    sfx(cfg.sfx_push)
  else
    push_undo()
  end

  player.gx, player.gy = nx, ny
  moves = moves + 1

  if is_win() then                     -- level solved -> arm auto-advance
    cleared = true
    clear_wait = cfg.win_delay
    sfx(cfg.sfx_win)
  end
end

--------------------------------------------------------------------
-- RENDER
--------------------------------------------------------------------
local function slide_to(e)
  e.vx = e.vx + (e.gx - e.vx) * cfg.slide
  e.vy = e.vy + (e.gy - e.vy) * cfg.slide
  if math.abs(e.gx - e.vx) < 0.01 then e.vx = e.gx end
  if math.abs(e.gy - e.vy) < 0.01 then e.vy = e.gy end
end

local function draw()
  cls(0)
  local lv = cur()
  map(lv.x, lv.y, lv.w, lv.h, cfg.scr_x, cfg.scr_y)

  for i = 1, #boxes do
    local b = boxes[i]
    local id = on_goal(b.gx, b.gy) and cfg.t_boxok or cfg.t_box
    spr(id, cfg.scr_x + b.vx * 8, cfg.scr_y + b.vy * 8, 0)
  end
  spr(cfg.t_player, cfg.scr_x + player.vx * 8, cfg.scr_y + player.vy * 8, 0)

  local done = 0
  for i = 1, #boxes do if on_goal(boxes[i].gx, boxes[i].gy) then done = done + 1 end end

  print("SOKOBAN", 3, 3, 12)
  print("LEVEL " .. level_no .. "/" .. #levels, 3, 13, 15)
  print("MOVES " .. moves, 3, 23, 15)
  print("UNDO  " .. #history, 3, 33, 13)
  print("CRATE " .. done .. "/" .. #boxes, 3, 103, 11)
  print("TOTAL " .. #levels .. " LEVELS", 3, 113, 13)
  print("X UNDO  R RESET", 138, 127, 13)

  if cleared then
    rect(56, 46, 128, 44, 0)
    rectb(56, 46, 128, 44, 4)
    if level_no >= #levels then
      print("ALL LEVELS CLEAR!", 62, 56, 4)
      print("WRAP TO LEVEL 1", 70, 68, 11)
    else
      print("LEVEL " .. level_no .. " CLEAR!", 66, 56, 4)
      print("NEXT IN " .. math.max(1, math.ceil(clear_wait / 60)) .. "s", 84, 68, 11)
    end
    print("Z: SKIP NOW", 82, 80, 15)
  end
end

--------------------------------------------------------------------
-- MAIN LOOP
--------------------------------------------------------------------
function BOOT()
  fset(cfg.t_wall, cfg.solid_flag, true)
  scan_levels()                       -- auto-detect every level on the map
  load_level(1)
end

function TIC()
  if cleared then
    clear_wait = clear_wait - 1
    if clear_wait <= 0 or btnp(4) or btnp(6) or keyp(26) then
      load_level(level_no + 1)        -- auto-advance to the next level
    end
  elseif #boxes == 0 then
    -- defensive: a level with no crates is skipped (bounded, never loops)
    if empty_skip < #levels then
      empty_skip = empty_skip + 1
      load_level(level_no + 1)
    end
  else
    local h, p = cfg.repeat_delay, cfg.repeat_rate
    if btnp(0, h, p) or keyp(23, h, p) then try_move(0, -1) end   -- up   / W
    if btnp(1, h, p) or keyp(19, h, p) then try_move(0, 1)  end   -- down / S
    if btnp(2, h, p) or keyp(1,  h, p) then try_move(-1, 0) end   -- left / A
    if btnp(3, h, p) or keyp(4,  h, p) then try_move(1, 0)  end   -- right/ D
    if btnp(5) or keyp(26) then undo() end                        -- X / Z
  end

  if keyp(18) then load_level(level_no) end                       -- R = retry level
  if keyp(27) then exit() end                                     -- ESC

  slide_to(player)
  for i = 1, #boxes do slide_to(boxes[i]) end
  draw()
end

-- <TILES>
-- 001:ffffffffddddfdddddddfdddffffffffdddfdddddddfddddffffffffffffffff
-- 002:fffffffffff8fffffffffffffffffffffffff8ffffffffffffff8fffffffffff
-- 003:ffffffffff4444fff44ff44ff4ffff4ff4ffff4ff44ff44fff4444ffffffffff
-- 004:2222222223333332234444322343343223433432234444322333333222222222
-- 005:000ff00000ffff000f4cc4f00fccccf00fccccf000cccc000fccccf000f00f00
-- 006:2222222226666662267777622676676226766762267777622666666222222222
-- 007:0011110001222210122332211233332112333321122332210122221000111100
-- </TILES>

-- <MAP>
-- 003:000000000000000000007000000000000000000000000000000000000000000000000000000000007000000000000000000070000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
-- 004:000000000000000000001010101010101010101000000000000000000000000000000000000000001010101010101010101010101010101010101010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
-- 005:000000000000000000001020202020202020201000000000000000000000000000000000000000001020202020202020201010203030302020202010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
-- 006:000000000000000000001020202020202020201000000000000000000000000000000000000000001030202040402030201010202020202020202010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
-- 007:000000000000000000001020204040202020201000000000000000000000000000000000000000001020202020202020201010202040404020202010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
-- 008:000000000000000000001020202020202020201000000000000000000000000000000000000000001020202020202020201010202020202020202010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
-- 009:000000000000000000001020202020205020201000000000000000000000000000000000000000001020202020202020201010202020202050202010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
-- 010:000000000000000000001020302020202030201000000000000000000000000000000000000000001020202020502020201010202020202020202010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
-- 011:000000000000000000001010101010101010101000000000000000000000000000000000000000001010101010101010101010101010101010101010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
-- </MAP>

-- <WAVES>
-- 000:89acdeefffeedca98653211000112356
-- 001:0123456789abcdeffedcba9876543210
-- 002:00112233445566778899aabbccddeeff
-- 003:ffffffffffffffff0000000000000000
-- 004:ffffffff000000000000000000000000
-- 005:05af49e38d27c16b05af49e38d27c16b
-- 006:06c28e4a06c28e4a06c28e4a06c28e4a
-- 007:07e5c3a18f6d4b2907e5c3a18f6d4b29
-- 008:08080808080808080808080808080808
-- 009:092b4d6f81a3c5e7092b4d6f81a3c5e7
-- 010:0a4e82c60a4e82c60a4e82c60a4e82c6
-- 011:0b61c72d83e94fa50b61c72d83e94fa5
-- 012:0c840c840c840c840c840c840c840c84
-- 013:0da741eb852fc9630da741eb852fc963
-- 014:0eca86420eca86420eca86420eca8642
-- 015:0fedcba9876543210fedcba987654321
-- </WAVES>

-- <SFX>
-- 000:0232f3024c20218201d4200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
-- 001:0330e3034e3037e303be3030e3034e3037e303ce3000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
-- 002:0243f304383000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
-- </SFX>

-- <FLAGS>
-- 000:0001000000000000000000000000000000000000000000000000000000000000
-- </FLAGS>

-- <PALETTE>
-- 000:1a1c2c5d275db13e53ef7d57ffcd75a7f07038b76425717929366f3b5dc941a6f673eff7f4f4f494b0c2566c86333c57
-- </PALETTE>
