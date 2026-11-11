@echo off
setlocal
cd /d "%~dp0.."
echo.
echo ============================================
echo  INFINITE RACE - LOCAL AUTO-COMBINER
echo ============================================
echo.
where node >nul 2>&1
if errorlevel 1 (
 echo Install Node.js from https://nodejs.org/
 pause
 exit /b 1
)
where ollama >nul 2>&1
if errorlevel 1 (
 echo Install Ollama from https://ollama.com/download
 pause
 exit /b 1
)
echo.
echo First-time model install: ollama pull gemma3:4b
echo Opening the local dashboard...
start "Infinite Race Auto-Combiner" cmd /k "node tools\local-recipe-dashboard.mjs"
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:38417"
echo The generator runs in the other Command Prompt window.
echo Close that window to stop the local service. Saved recipes stay on disk.
