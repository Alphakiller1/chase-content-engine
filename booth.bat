@echo off
rem Recording booth — same as: chase-content booth --sport nfl
setlocal
cd /d "%~dp0"
set "PY=%~dp0.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=%USERPROFILE%\crawl_env\Scripts\python.exe"
if not exist "%PY%" set "PY=python"
"%PY%" -m outputs.content_engine booth %*
echo.
pause
