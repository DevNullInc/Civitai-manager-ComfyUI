<#
  CivitAI Model Manager - ComfyUI Edition
  Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
  Licensed under GNU General Public License v3.0 (GPL-3.0)
#>
<#
.SYNOPSIS
  CivitAI Model Manager - launcher script.

.DESCRIPTION
  Start, stop, or restart the Electron app from the terminal.

.PARAMETER Action
  The action to perform: start, stop, restart, status (default: start)

.PARAMETER Port
  Vite dev-server port (default: 5173)

.EXAMPLE
  .\cmm.ps1 start
  .\cmm.ps1 start -Port 3000
  .\cmm.ps1 stop
  .\cmm.ps1 restart
  .\cmm.ps1 status
#>

param(
  [Parameter(Position = 0)]
  [ValidateSet('start', 'stop', 'restart', 'status', 'package', 'dist')]
  [string]$Action = 'start',

  [int]$Port = 5173,

  [switch]$Headless,
  [switch]$NoWindow
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = $PSScriptRoot
$PidFile = Join-Path $ProjectRoot '.cmm.pid'

# -- Helpers ---------------------------------------------------------------

function Write-Status {
  param([string]$Icon, [string]$Msg, [string]$Color = 'Cyan')
  Write-Host "  [$Icon] " -NoNewline -ForegroundColor $Color
  Write-Host $Msg
}

function Get-RunningProcs {
  if (Test-Path $PidFile) {
    $storedPids = Get-Content $PidFile | ForEach-Object { [int]$_ }
    $running = @()
    foreach ($procId in $storedPids) {
      try {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc -and -not $proc.HasExited) {
          $running += $proc
        }
      }
      catch { }
    }
    return $running
  }
  return @()
}

function Stop-App {
  $procs = Get-RunningProcs
  $portHolders = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

  $allPids = @()
  foreach ($p in $procs) { $allPids += $p.Id }
  if ($portHolders) {
    foreach ($ph in $portHolders) {
      if ($ph -notin $allPids -and $ph -gt 0) { $allPids += $ph }
    }
  }

  if ($allPids.Count -eq 0) {
    Write-Status '!' 'No running CivitAI Model Manager processes found.' 'Yellow'
    return $false
  }

  Write-Status 'x' "Stopping $($allPids.Count) process(es)..." 'Red'
  foreach ($pidToKill in $allPids) {
    try {
      Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
      Write-Status 'ok' "Killed PID $pidToKill" 'DarkGray'
    }
    catch {
      Write-Status '!!' "Failed to kill PID $($pidToKill): $_" 'Red'
    }
  }

  if (Test-Path $PidFile) {
    Remove-Item $PidFile -Force
  }
  Write-Status 'ok' 'Application stopped.' 'Green'
  return $true
}

function Start-App {
  # Check if already running
  $existing = Get-RunningProcs
  if ($existing.Count -gt 0) {
    $pids = ($existing | ForEach-Object { $_.Id }) -join ', '
    Write-Status '!' "App already running (PIDs: $pids). Use 'restart' to bounce it." 'Yellow'
    return
  }

  # 1) Build
  Write-Status '>>' 'Building project...' 'Cyan'
  Push-Location $ProjectRoot

  try {
    # 1) Build renderer with Vite first
    Write-Status '>>' 'Building renderer process with Vite...' 'DarkGray'
    $rendererBuild = npx vite build --base ./ --emptyOutDir false 2>&1
    $rendererExitCode = $LASTEXITCODE
    
    if ($rendererExitCode -ne 0) {
      Write-Status '!!' 'Renderer build failed!' 'Red'
      Write-Host ''
      Write-Host '  Vite output:' -ForegroundColor Yellow
      Write-Host '  ' -NoNewline
      Write-Host ($rendererBuild -join "`n  ") -ForegroundColor Red
      Pop-Location
      return
    }
    Write-Status 'ok' 'Renderer built successfully.' 'Green'

    # 2) Build main process (Electron entry point) after Vite
    Write-Status '>>' 'Building Electron main process...' 'DarkGray'
    $mainBuildOutput = npx tsc --project tsconfig.main.json --listEmittedFiles 2>&1
    $mainBuildExitCode = $LASTEXITCODE
    
    if ($mainBuildExitCode -ne 0) {
      Write-Status '!!' 'Main process TypeScript compilation FAILED!' 'Red'
      Write-Host ''
      Write-Host '  TypeScript errors:' -ForegroundColor Yellow
      Write-Host '  ' -NoNewline
      Write-Host ($mainBuildOutput -join "`n  ") -ForegroundColor Red
      Pop-Location
      return
    }
    Write-Status 'ok' 'TypeScript compilation succeeded.' 'Green'
    
    # Verify main process entry point exists
    $expectedMainFile = "dist/main/index.js"
    if (-not (Test-Path $expectedMainFile)) {
      Write-Status '!!' "Main entry point NOT FOUND: $expectedMainFile" 'Red'
      Pop-Location
      return
    }
    Write-Status 'ok' "Main process entry point verified: $expectedMainFile" 'Green'
  }
  catch {
    Write-Status '!!' "Unexpected build error: $_" 'Red'
    Write-Host ''
    Write-Host '  Stack trace:' -ForegroundColor DarkGray
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray
    Pop-Location
    return
  }

  # 2) Start Vite dev server (for browser access)
  Write-Status '>>' "Starting Vite server on port $Port..." 'Cyan'
  $env:PORT = "$Port"
  $env:VITE_DEV_SERVER_URL = "http://localhost:$Port"
  $viteProc = Start-Process -FilePath 'npx.cmd' `
    -ArgumentList "vite --port $Port --host 127.0.0.1" `
    -WorkingDirectory $ProjectRoot `
    -PassThru -WindowStyle Hidden

  Start-Sleep -Seconds 2

  # 3) Start Electron App (or run headless)
  if ($Headless -or $NoWindow) {
    Write-Status '>>' 'Starting Electron in headless background mode...' 'Magenta'
    $env:HEADLESS = "true"
    $electronProc = Start-Process -FilePath 'npx.cmd' `
      -ArgumentList 'electron . --headless' `
      -WorkingDirectory $ProjectRoot `
      -PassThru -WindowStyle Hidden
  } else {
    Write-Status '>>' 'Launching Electron app window...' 'Magenta'
    $env:HEADLESS = "false"
    $electronProc = Start-Process -FilePath 'npx.cmd' `
      -ArgumentList 'electron .' `
      -WorkingDirectory $ProjectRoot `
      -PassThru -WindowStyle Hidden
  }

  # Save PIDs
  $pidsToSave = @()
  if ($viteProc -and -not $viteProc.HasExited) { $pidsToSave += $viteProc.Id }
  if ($electronProc -and -not $electronProc.HasExited) { $pidsToSave += $electronProc.Id }
  if ($pidsToSave.Count -gt 0) {
    $pidsToSave | Set-Content $PidFile
  }

  Write-Host ''
  Write-Status 'ok' 'CivitAI Model Manager is running!' 'Green'
  Write-Host ''
  Write-Host "    Web / Browser UI : http://localhost:$Port" -ForegroundColor DarkGray
  if ($Headless -or $NoWindow) {
    Write-Host "    Mode             : Headless / Web-only" -ForegroundColor DarkGray
  } else {
    Write-Host "    Electron App     : PID $($electronProc.Id)" -ForegroundColor DarkGray
  }
  Write-Host "    PID file         : $PidFile" -ForegroundColor DarkGray
  Write-Host ''
  Write-Host '    Use  .\cmm.ps1 stop     to shut down' -ForegroundColor DarkGray
  Write-Host '    Use  .\cmm.ps1 restart  to restart' -ForegroundColor DarkGray
  Write-Host ''

  Pop-Location
}

function Show-Status {
  $procs = Get-RunningProcs
  if ($procs.Count -eq 0) {
    Write-Status '-' 'CivitAI Model Manager is not running.' 'Yellow'
  }
  else {
    Write-Status '+' "CivitAI Model Manager is running ($($procs.Count) processes):" 'Green'
    foreach ($p in $procs) {
      Write-Host "      PID $($p.Id)  -  $($p.ProcessName)" -ForegroundColor DarkGray
    }
  }
}

# -- Banner ----------------------------------------------------------------

function Package-App {
  Write-Status '>>' 'Building production assets...' 'Cyan'
  
  Write-Status '>>' 'Building renderer process with Vite...' 'Cyan'
  npx vite build --base ./ --emptyOutDir false
  if ($LASTEXITCODE -ne 0) {
    throw 'Vite build failed.'
  }
  Write-Status 'ok' 'Renderer built successfully.' 'Green'

  Write-Status '>>' 'Building Electron main process...' 'Cyan'
  npx tsc --project tsconfig.main.json
  if ($LASTEXITCODE -ne 0) {
    throw 'TypeScript main process compilation failed.'
  }
  Write-Status 'ok' 'TypeScript compilation succeeded.' 'Green'

  Write-Status '>>' 'Packaging standalone Windows binary with electron-builder...' 'Cyan'
  npx electron-builder --win portable nsis
  if ($LASTEXITCODE -ne 0) {
    throw 'electron-builder packaging failed.'
  }

  Write-Status 'ok' 'Standalone binary packaged successfully!' 'Green'
  Write-Host ''
  Write-Host '  Release Binaries in ./release/' -ForegroundColor Green
  if (Test-Path (Join-Path $ProjectRoot 'release')) {
    Get-ChildItem -Path (Join-Path $ProjectRoot 'release') -Filter '*.exe' | ForEach-Object {
      Write-Host "    - $($_.Name)  ($([Math]::Round($_.Length / 1MB, 2)) MB)" -ForegroundColor Cyan
    }
  }
  Write-Host ''
}

# -- Banner ----------------------------------------------------------------

Write-Host ''
Write-Host '  +----------------------------------------------+' -ForegroundColor Magenta
Write-Host '  |   CivitAI Model Manager - ComfyUI Edition   |' -ForegroundColor Magenta
Write-Host '  +----------------------------------------------+' -ForegroundColor Magenta
Write-Host ''

# -- Dispatch --------------------------------------------------------------

switch ($Action) {
  'start' {
    Start-App
  }
  'stop' {
    Stop-App | Out-Null
  }
  'restart' {
    Write-Status '>>' 'Restarting application...' 'Cyan'
    Stop-App | Out-Null
    Start-Sleep -Seconds 1
    Start-App
  }
  'status' {
    Show-Status
  }
  'package' {
    Package-App
  }
  'dist' {
    Package-App
  }
}