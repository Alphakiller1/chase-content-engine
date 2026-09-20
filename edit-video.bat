@echo off
rem EDIT MY VIDEO - drag a recording onto this file, or double-click
rem it to edit the newest video in video\footage\.
setlocal
cd /d "%~dp0video"
node scripts\edit.mjs %*
echo.
pause
