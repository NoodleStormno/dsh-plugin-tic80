@echo off
chcp 65001 >nul
title DeepSeek Harness with TIC-80 Plugin
cd /d "E:\dsh-plugin-tic80"

echo ======================================================================
echo           DeepSeek Harness + TIC-80 游戏开发插件一键启动
echo ======================================================================
echo.

:: 1. 读取桌面上的 DeepSeek API Key
if exist "%USERPROFILE%\Desktop\DeepSeekAPI.txt" (
    set /p DEEPSEEK_API_KEY=<"%USERPROFILE%\Desktop\DeepSeekAPI.txt"
    echo [OK] 已从桌面读取 DeepSeek API Key.
) else (
    echo [WARN] 未找到桌面 DeepSeekAPI.txt，若已配置系统环境变量则会自动读取。
)

:: 2. 检查并清理旧实例占用的 3080 端口（DSH Web 主服务）
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3080" ^| findstr "LISTENING"') do (
    echo [INFO] 检测到 3080 端口被旧进程 (PID %%a) 占用，正在关闭...
    taskkill /F /PID %%a >nul 2>&1
)

:: 3. 检查并清理旧实例占用的 3088 端口（TIC-80 Web Live Studio）
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3088" ^| findstr "LISTENING"') do (
    echo [INFO] 检测到 3088 端口被旧进程 (PID %%a) 占用，正在关闭...
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 >nul

echo.
echo [1/2] 正在启动 DeepSeek Harness Web UI 服务 (http://127.0.0.1:3080)...
echo [2/2] TIC-80 实时运行工作室已挂载 (http://127.0.0.1:3088)...
echo.
echo 启动完成后，浏览器将自动弹出打开 DSH 对话界面。
echo 在界面中直接对话（例如："帮我写一个类似马里奥的跳跃闯关游戏"），
echo LLM 将自动调用 TIC-80 工具集生成代码、像素精灵、地图及音乐，并在 3088 端口实时热重载试玩！
echo.
echo ======================================================================
echo.

npx @deepseek-ai/dsh web
pause
