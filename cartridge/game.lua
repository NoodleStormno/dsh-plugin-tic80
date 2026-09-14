-- title:   TIC-80 Game
-- author:  DeepSeek & User
-- desc:    Created with DeepSeek Harness
-- script:  lua
-- input:   gamepad

-- TIC-80 Standard Ready-to-Play Cartridge
local x = 112
local y = 60
local speed = 2
local score = 0
local t = 0

function BOOT()
  -- Called once when cartridge boots
  trace("TIC-80 Blank Cartridge Loaded!")
end

function TIC()
  -- 60 FPS Main Game Loop
  -- Input checks: 0=Up, 1=Down, 2=Left, 3=Right, 4=A(Z), 5=B(X)
  if btn(0) then y = y - speed end
  if btn(1) then y = y + speed end
  if btn(2) then x = x - speed end
  if btn(3) then x = x + speed end

  -- Keep inside screen bounds (240x136, 8x8 sprite)
  x = math.max(0, math.min(232, x))
  y = math.max(0, math.min(128, y))

  -- Clear screen with color 13 (Dark Blue)
  cls(13)

  -- Draw ground line
  line(0, 130, 239, 130, 15)

  -- Draw player sprite (ID 1, colorkey 0 = transparent)
  spr(1, x, y, 0)

  -- Draw HUD text
  print("TIC-80 READY", 84, 10, 15)
  print("SCORE: " .. score, 10, 10, 11)
  print("MOVE: ARROWS / WASD", 68, 120, 14)

  t = t + 1
end

-- <TILES>
-- 001:000000000077770007ffff7007f00f7007ffff70007777000777777000700700
-- 016:5555555555555555555555555555555555555555555555555555555555555555
-- </TILES>

-- <PALETTE>
-- 000:1a1c2c5d275db13e53ef7d57ffcd75a7f07038b76425717929366f3b5dc941a6f673eff7f4f4f494b0c2566c86333c57
-- </PALETTE>
