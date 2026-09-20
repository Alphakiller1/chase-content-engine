[CmdletBinding()]
param(
    [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'ChaseContentEngine'),
    [string[]]$Games = @('CIN@HOU', 'JAX@DEN', 'WSH@DAL', 'PIT@NE'),
    [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$RepoZipUrl = 'https://codeload.github.com/Alphakiller1/chase-content-engine/zip/refs/heads/main'
$TempRoot = Join-Path $env:TEMP ('ChaseBoothInstall-' + [guid]::NewGuid().ToString('N'))
$ZipPath = Join-Path $TempRoot 'chase-content-engine.zip'
$ExtractRoot = Join-Path $TempRoot 'source'

function Write-Step([string]$Message) {
    Write-Host ''
    Write-Host ('==> ' + $Message) -ForegroundColor Cyan
}

function Stop-Install([string]$Message) {
    Write-Host ''
    Write-Host ('INSTALLATION FAILED: ' + $Message) -ForegroundColor Red
    Write-Host 'This window will remain open so the error can be read.' -ForegroundColor Yellow
    throw $Message
}

function Find-Python {
    $Py = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($Py) { return @{ Exe = $Py.Source; Prefix = @('-3') } }
    $Python = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($Python) { return @{ Exe = $Python.Source; Prefix = @() } }
    Stop-Install 'Python 3.11 or newer was not found. Install Python from python.org and enable Add Python to PATH.'
}

try {
    Write-Host 'CHASE ANALYTICS — REDESIGNED BROADCASTING BOOTH' -ForegroundColor Magenta
    Write-Host ('Installing to: ' + $InstallRoot)

    $Node = Get-Command node.exe -ErrorAction SilentlyContinue
    $Npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $Node -or -not $Npm) {
        Stop-Install 'Node.js and npm were not found. Install the current Node.js LTS release from nodejs.org.'
    }
    $Python = Find-Python

    Write-Step 'Downloading the current chase-content-engine main branch'
    New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $ExtractRoot -Force | Out-Null
    Invoke-WebRequest -Uri $RepoZipUrl -OutFile $ZipPath -UseBasicParsing
    Expand-Archive -LiteralPath $ZipPath -DestinationPath $ExtractRoot -Force
    $SourceRoot = Get-ChildItem -LiteralPath $ExtractRoot -Directory | Select-Object -First 1
    if (-not $SourceRoot) { Stop-Install 'The downloaded repository archive was empty.' }

    Write-Step 'Installing the current studio files'
    New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
    Copy-Item -Path (Join-Path $SourceRoot.FullName '*') -Destination $InstallRoot -Recurse -Force

    $VenvPython = Join-Path $InstallRoot '.venv\Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $VenvPython)) {
        Write-Step 'Creating the private Python environment'
        & $Python.Exe @($Python.Prefix) -m venv (Join-Path $InstallRoot '.venv')
        if ($LASTEXITCODE -ne 0) { Stop-Install 'Python could not create the booth environment.' }
    }

    Write-Step 'Installing the content engine'
    & $VenvPython -m pip install --disable-pip-version-check -e $InstallRoot
    if ($LASTEXITCODE -ne 0) { Stop-Install 'The content engine Python package could not be installed.' }

    Write-Step 'Installing the Remotion studio'
    Push-Location (Join-Path $InstallRoot 'video')
    try {
        & $Npm.Source install --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { Stop-Install 'The Remotion studio packages could not be installed.' }
    }
    finally { Pop-Location }

    $PackRoot = Join-Path $InstallRoot 'video\props\pack'
    New-Item -ItemType Directory -Path $PackRoot -Force | Out-Null
    $Built = 0
    foreach ($Game in $Games) {
        if ([string]::IsNullOrWhiteSpace($Game)) { continue }
        Write-Step ('Preparing game graphics: ' + $Game)
        Push-Location $InstallRoot
        try {
            & $VenvPython -m outputs.video_pack --league nfl --game $Game.Trim() --platform reels
            if ($LASTEXITCODE -eq 0) { $Built++ }
            else { Write-Host ('WARNING: ' + $Game + ' could not be prepared. Continuing with the other games.') -ForegroundColor Yellow }
        }
        finally { Pop-Location }
    }

    if ($Built -eq 0 -and -not (Get-ChildItem -LiteralPath $PackRoot -Directory -ErrorAction SilentlyContinue)) {
        Stop-Install 'No game graphics could be prepared. Check the internet connection and try again.'
    }

    Write-Step 'Creating desktop and terminal launchers'
    $StartScript = Join-Path $InstallRoot 'Start-BroadcastBooth.cmd'
    $StartBody = @"
@echo off
title Chase Analytics Broadcasting Booth
cd /d "$InstallRoot"
call "$InstallRoot\booth.bat" %*
if errorlevel 1 (
  echo.
  echo The booth stopped with an error. Leave this window open and copy the message above.
  pause
)
"@
    Set-Content -LiteralPath $StartScript -Value $StartBody -Encoding Ascii

    $Desktop = [Environment]::GetFolderPath('Desktop')
    $DesktopLauncher = Join-Path $Desktop 'Broadcast Booth.cmd'
    Set-Content -LiteralPath $DesktopLauncher -Value ("@echo off`r`ncall `"$StartScript`" %*`r`n") -Encoding Ascii

    $WindowsApps = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps'
    if (Test-Path -LiteralPath $WindowsApps) {
        $Alias = Join-Path $WindowsApps 'booth.cmd'
        Set-Content -LiteralPath $Alias -Value ("@echo off`r`ncall `"$StartScript`" %*`r`n") -Encoding Ascii
    }

    Write-Host ''
    Write-Host 'INSTALLATION COMPLETE' -ForegroundColor Green
    Write-Host ('Installed studio: ' + $InstallRoot)
    Write-Host ('Desktop launcher: ' + $DesktopLauncher)
    Write-Host 'Future launches: double-click Broadcast Booth on the desktop or type booth in a new terminal.'

    if (-not $NoLaunch) {
        Write-Step 'Starting the redesigned broadcasting booth'
        & $StartScript
    }
}
catch {
    Write-Host ''
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host 'Copy the complete message from this window if help is needed.' -ForegroundColor Yellow
    $global:LASTEXITCODE = 1
    return
}
finally {
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
