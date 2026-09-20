@echo off
rem Remotion Studio — every composition, no camera.
setlocal
cd /d "%~dp0video"
if not exist node_modules call npm install
call npm run dev
pause
