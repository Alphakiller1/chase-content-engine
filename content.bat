@echo off
REM Chase Content Engine — chase-content CLI, plus booth via outputs.content_engine
setlocal
set "REPO=%~dp0"
set "PY=%REPO%.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=%USERPROFILE%\crawl_env\Scripts\python.exe"
if not exist "%PY%" set "PY=python"
pushd "%REPO%"
if /I "%~1"=="booth" (
  "%PY%" -m outputs.content_engine %*
) else (
  "%PY%" -m chase_content %*
)
set "RC=%ERRORLEVEL%"
popd
exit /b %RC%
