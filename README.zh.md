# dsh-plugin-tic80

[![npm version](https://img.shields.io/badge/npm-1.0.0-blue.svg)](https://www.npmjs.com/package/dsh-plugin-tic80)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/dsh-plugin-purple.svg)](https://github.com/deepseek-ai/deepseek-harness)

**dsh-plugin-tic80** 是专为 **DeepSeek Harness (dsh)** 打造的 **TIC-80 幻想计算机全功能生态插件**。

保留 TIC-80 官方控制台的**全部功能**，并通过 DeepSeek Harness 与大语言模型（LLM）实现自然语言交互对话，让 LLM 能够自主编写 TIC-80 的 **代码、音乐（Tracker）、世界地图和精灵（像素艺术）**，并支持本地原生控制台与 Web 实时热重载（Live Studio）运行与测试。

---

## 🌟 核心特性

- 🎮 **保留 TIC-80 全部特性**：
  - 240×136 经典复古分辨率，16 色可定制调色盘。
  - 完整的双 Bank 架构：Bank 0（256 个背景图块 Tiles）+ Bank 1（256 个前景精灵 Sprites），支持多格精灵（16×16、24×24、32×32）及 8 位精灵碰撞/事件标记（Flags）。
  - 240×136 超大世界地图（World Map，共 32,640 单元格）。
  - 4 通道音乐音轨跟踪器（Music Tracker，64 个 Pattern，64 首 Track，速度/节拍控制）。
  - 64 个内置音效（SFX，30 音符包络、音高琶音、16 种波形合成）。
  - 支持 `.lua` 纯文本卡带格式与官方二进制 `.tic` ROM 格式双向无损转换。
- 💬 **对话式 AI 游戏开发**：
  - 为 DeepSeek Harness 提供 13 个类型化模型工具（`dsh-tools`），LLM 可通过对话设计游戏关卡、编写 Lua 逻辑、生成 ASCII 像素画、合成 8-bit 音效并编排复古 BGM。
  - 内置智能 Linter 静态分析引擎，实时检测 Lua 语法、`TIC()` 主循环合规性、512KB 内存限制与越界调用。
- 🚀 **内置嵌入式 UI 与实时热重载**：
  - **DSH 内嵌三栏工作台**：TIC-80 虚拟游戏机直接潜入 DeepSeek Harness Web 页面（左侧为 DSH 侧边栏，**中间栏为 TIC-80 游戏机屏幕**，右侧为 AI 对话栏），无需在多个窗口来回切换。
  - **开箱即用空白卡带**：预置 `cartridge/game.lua` 现成可运行模板并已完整注入 System Prompt，LLM 零等待、第 1 轮对话即可直接编写游戏代码与素材，无需花费轮次重新建工程。
  - **Web Live Studio**：内置 Fengari Lua 5.3 引擎与 WebSocket 实时热更新，LLM 或用户修改任意代码、精灵、地图或音效，中间屏幕即时响应。
  - **Native Desktop Runner**：无缝对接本地 `tic80.exe` 桌面版，支持 Headless CLI 测试与全屏运行。
- 📦 **多格式导出**：
  - 一键导出 `.lua` 源码卡带、`.tic` 二进制 ROM、单文件独立运行的 `.html` 网页游戏。
- 🕹️ **内置经典游戏脚手架**：
  - `minimal`（极简起步）
  - `platformer`（跳跃重力平台跳跃）
  - `sokoban`（经典推箱子关卡）
  - `rpg`（俯视视角冒险与 NPC 对话）
  - `shmup`（太空弹幕射击与星空特效）

---

## 📦 安装与配置

### 在 DeepSeek Harness 中使用

在你的 dsh 配置文件（例如 `cordis.yml` 或 `cordis.patch.yml`）中添加插件：

```yaml
- id: tic80
  name: 'dsh-plugin-tic80'
  config:
    defaultTemplate: minimal   # 可选: minimal, platformer, sokoban, rpg, shmup
    autoRun: true              # 自动启动 Web Live Studio
    webStudioPort: 3088        # Web 预览端口
    cartFilePath: './cart.lua' # 绑定本地卡带文件自动同步
```

也可以通过 dsh CLI 启动：

```bash
dsh --profile web --patch ./cordis.patch.yml
```

### 独立引入开发

```bash
npm install dsh-plugin-tic80
```

```typescript
import { Context } from '@deepseek-ai/cordis';
import * as Tic80Plugin from 'dsh-plugin-tic80';

const ctx = new Context();
ctx.plugin(Tic80Plugin, {
  defaultTemplate: 'platformer',
  autoRun: true,
  webStudioPort: 3088,
});
```

---

## 🛠️ LLM 模型工具清单 (DSH Tools)

插件在 `ctx.tools` 注册了 13 个面向大模型的全功能工具：

| 工具名称 | 功能描述 |
| :--- | :--- |
| `tic80_init` | 从预设模板（minimal/platformer/sokoban/rpg/shmup）初始化卡带项目 |
| `tic80_get_cart` | 查询当前卡带的代码、精灵列表、地图局部或音效音乐状态 |
| `tic80_set_code` | 更新卡带游戏逻辑（Lua/JS），附带静态语法校验与热重载 |
| `tic80_edit_sprite` | 用 ASCII 字符画（如 `.` 为透明，`0`-`f` 为颜色索引）绘制 8×8 或多图块精灵 |
| `tic80_batch_sprites` | 批量绘制一组精灵动画帧或 Tileset |
| `tic80_edit_map` | 在 240×136 地图上放置图块、矩形填充或通过 ASCII 布局图快速铺设关卡 |
| `tic80_create_sfx` | 使用预设（jump/coin/laser/explosion/hit/powerup/blip）或音符包络生成音效 |
| `tic80_compose_music` | 编写 4 通道复古芯片音乐 Pattern，并编排到 Track 音轨 |
| `tic80_set_palette` | 切换调色盘（Sweetie-16、PICO-8、DB16、GameBoy、Cyberpunk）或自定义 RGB |
| `tic80_validate` | 对卡带进行合规性与内存审查，确保能在 TIC-80 环境稳定运行 |
| `tic80_run` | 启动 Web Live Studio（浏览器热重载）或唤起本地 `tic80.exe` 运行 |
| `tic80_export` | 导出为 `.lua` 源码、`.tic` 二进制 ROM、或独立单文件 `.html` |
| `tic80_studio_status` | 查看当前 Live Studio 运行状态、在线玩家及实时运行日志 |

---

## 💡 对话提示词示例

安装插件后，你可以在 DeepSeek Harness 中与 LLM 直接对话：

> **“帮我做一个推箱子游戏，画一个可爱的金发工人精灵，箱子涂成木纹色，设计 3 关地图，并配上推箱子的音效和过关通关音效。”**

LLM 会自动调用：
1. `tic80_init({ template: 'sokoban' })`
2. `tic80_edit_sprite` 用 ASCII 绘制人物和箱子。
3. `tic80_edit_map` 绘制精巧的迷宫关卡。
4. `tic80_create_sfx` 合成推箱子撞击声与通关特效音。
5. `tic80_run({ mode: 'web' })` 打开浏览器并在画布上实时游玩！

---

## 🧪 自动化测试

项目内置 100% 覆盖的核心功能与端到端测试：

```bash
npm test
```

包含：
- 卡带文本解析与二进制 `.tic` 打包测试
- 精灵 ASCII 解析与多格拼接测试
- 地图填充与 ASCII 关卡布局测试
- 音频 SFX 波形与音乐音轨测试
- 静态 Linter 代码审查测试
- 13 个 DSH Tools 完整调用测试
- 本地 `tic80.exe --cli` 真实加载运行测试

---

## 📄 许可证

[MIT License](LICENSE) © 2026 NoodleStormno
