@echo off
rem Recording booth — same as: chase-content booth --sport nfl
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is required for the recording booth.
  echo Install the current LTS release from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if not exist "%~dp0video\node_modules" (
  echo First launch: installing the video studio dependencies...
  pushd "%~dp0video"
  call npm install
  if errorlevel 1 (
    popd
    echo ERROR: The video studio dependencies could not be installed.
    pause
    exit /b 1
  )
  popd
)

set "PY=%~dp0.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=%USERPROFILE%\crawl_env\Scripts\python.exe"
if not exist "%PY%" set "PY=python"
"%PY%" -m outputs.content_engine booth %*
echo.
pause
