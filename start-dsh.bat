@echo off
title DeepSeek Harness with TIC-80 Plugin
cd /d "E:\dsh-plugin-tic80"

:: 1. Read DeepSeek API Key from Desktop
if exist "%USERPROFILE%\Desktop\DeepSeekAPI.txt" (
    set /p DEEPSEEK_API_KEY=<"%USERPROFILE%\Desktop\DeepSeekAPI.txt"
    echo [INFO] Loaded DeepSeek API Key from Desktop.
)

:: 2. If port 3080 is already occupied by a previous dsh instance, terminate it automatically
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3080" ^| findstr "LISTENING"') do (
    echo [INFO] Port 3080 is occupied by previous instance (PID %%a). Restarting...
    taskkill /F /PID %%a >nul 2>&1
    timeout /t 1 >nul
)

echo [INFO] Starting DeepSeek Harness Web UI with TIC-80 Plugin...
echo [INFO] Web UI: http://127.0.0.1:3080
echo [INFO] TIC-80 Studio: http://127.0.0.1:3088
echo.

npx @deepseek-ai/dsh web --patch "E:\dsh-plugin-tic80\cordis.patch.yml"
pause
