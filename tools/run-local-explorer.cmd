@echo off
setlocal
cd /d "%~dp0.."
echo.
echo =====================================
echo   INFINITE RACE LOCAL AI EXPLORER
echo =====================================
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is missing. Install the LTS version from https://nodejs.org/
  pause
  exit /b 1
)
where ollama >nul 2>&1
if errorlevel 1 (
  echo Ollama is missing. Install it from https://ollama.com/download
  pause
  exit /b 1
)
echo Use this ONE TIME to install your local model:
echo     ollama pull gemma3:4b
echo.
echo Want something smaller and faster but less clever? Use:
echo     ollama pull gemma3:1b
echo.
echo Default: 300 additional recipes. Change it with --max=1000
echo.
node tools\local-recipe-explorer.mjs --model=gemma3:4b --max=300
echo.
echo Your discoveries were saved to local-recipes.jsonl
pause
