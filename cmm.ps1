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
  [ValidateSet('start', 'stop', 'restart', 'status')]
  [string]$Action = 'start',

  [int]$Port = 5173
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
  if ($procs.Count -eq 0) {
    Write-Status '!' 'No running CivitAI Model Manager processes found.' 'Yellow'
    return $false
  }

  Write-Status 'x' "Stopping $($procs.Count) process(es)..." 'Red'
  foreach ($p in $procs) {
    try {
      Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
      Write-Status 'ok' "Killed PID $($p.Id)" 'DarkGray'
    }
    catch {
      Write-Status '!!' "Failed to kill PID $($p.Id): $_" 'Red'
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
  Write-Status '>>' 'Building project (tsc + vite)...' 'Cyan'
  Push-Location $ProjectRoot
  try {
    $buildOutput = & npm run build 2>&1
    if ($LASTEXITCODE -ne 0) {
      Write-Status '!!' 'Build failed! Check for TypeScript / Vite errors.' 'Red'
      Write-Host ($buildOutput | Out-String) -ForegroundColor DarkGray
      Pop-Location
      return
    }
    Write-Status 'ok' 'Build succeeded.' 'Green'
  }
  catch {
    Write-Status '!!' "Build error: $_" 'Red'
    Pop-Location
    return
  }

  # 2) Start Vite dev server
  Write-Status '>>' "Starting Vite dev server on port $Port..." 'Cyan'
  $viteProc = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList "/c npx vite --port $Port" `
    -WorkingDirectory $ProjectRoot `
    -PassThru -WindowStyle Hidden

  # Give Vite a moment to spin up
  Start-Sleep -Seconds 3

  # 3) Start Electron
  Write-Status '>>' 'Launching Electron app...' 'Magenta'
  $electronProc = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c npx electron .' `
    -WorkingDirectory $ProjectRoot `
    -PassThru -WindowStyle Hidden

  # Save PIDs
  @($viteProc.Id, $electronProc.Id) | Set-Content $PidFile

  Write-Host ''
  Write-Status 'ok' 'CivitAI Model Manager is running!' 'Green'
  Write-Host ''
  Write-Host "    Vite     : http://localhost:$Port  (PID $($viteProc.Id))" -ForegroundColor DarkGray
  Write-Host "    Electron : PID $($electronProc.Id)" -ForegroundColor DarkGray
  Write-Host "    PID file : $PidFile" -ForegroundColor DarkGray
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
}
