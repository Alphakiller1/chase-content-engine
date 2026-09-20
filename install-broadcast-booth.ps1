[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$PackageUrl = 'https://raw.githubusercontent.com/Alphakiller1/chase-content-engine/main/downloads/Chase-NFL-Broadcasting-Booth-Portable.zip'
$ExpectedSha256 = 'C2CC6B02EF4D736D4DC7B17440B7FC5B0D90D965F746A16D6EBF43CEBFAB9A42'
$DownloadRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'ChaseNFLBoothDownload'
$ZipPath = Join-Path $DownloadRoot 'Chase-NFL-Broadcasting-Booth-Portable.zip'
$ExtractPath = Join-Path $DownloadRoot 'package'

Write-Host 'CHASE ANALYTICS BROADCASTING BOOTH' -ForegroundColor Magenta
Write-Host 'Downloading the portable installer from GitHub...'

New-Item -ItemType Directory -Path $DownloadRoot -Force | Out-Null
if (Test-Path -LiteralPath $ExtractPath) {
    Remove-Item -LiteralPath $ExtractPath -Recurse -Force
}

Invoke-WebRequest -Uri $PackageUrl -OutFile $ZipPath -UseBasicParsing

$ActualSha256 = (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash
if ($ActualSha256 -ne $ExpectedSha256) {
    throw 'The downloaded installer did not pass its integrity check. Delete the download and try again.'
}

Write-Host 'Download verified. Extracting the installer...'
Expand-Archive -LiteralPath $ZipPath -DestinationPath $ExtractPath -Force

$Installer = Join-Path $ExtractPath 'Install-BroadcastBooth.ps1'
if (-not (Test-Path -LiteralPath $Installer)) {
    throw "The installer was not found at $Installer"
}

Write-Host 'Starting installation...'
& powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $Installer
if ($LASTEXITCODE -ne 0) {
    throw "Broadcasting Booth installation failed with exit code $LASTEXITCODE."
}

Write-Host ''
Write-Host 'INSTALLATION COMPLETE' -ForegroundColor Green
Write-Host 'Close this terminal, open a new PowerShell window, and type: booth'
