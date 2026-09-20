@echo off
rem Update chase-content-engine from GitHub, install studio dependencies, and launch.
setlocal
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo ERROR: Git is not available in this terminal.
  echo Open Git Bash or install Git for Windows, then run this file again.
  pause
  exit /b 1
)

echo Updating Chase Content Engine...
git pull --ff-only origin main
if errorlevel 1 (
  echo.
  echo ERROR: The update could not be applied. Your local files were not overwritten.
  pause
  exit /b 1
)

echo.
echo Starting the redesigned broadcasting booth...
call "%~dp0booth.bat" %*
