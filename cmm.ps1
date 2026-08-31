<#
  Renegade Core Model Manager
  Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
  Licensed under GNU General Public License v3.0 (GPL-3.0)
#>
<#
.SYNOPSIS
  Renegade Core Model Manager - launcher script.

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
  [ValidateSet('start', 'stop', 'restart', 'status', 'update', 'package', 'publish', 'dist', 'scan', 'download', 'check-updates', 'export', 'hf', 'workflows', 'help')]
  [string]$Action = 'start',

  [int]$Port = 5173,
  [int]$ApiPort = 5174,

  [switch]$Headless,
  [switch]$NoWindow,

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = $PSScriptRoot
$PidFile = Join-Path $ProjectRoot '.cmm.pid'

if ($Port -lt 1024 -or $Port -gt 65535) {
  Write-Status '!!' "Invalid Port ($Port). Must be between 1024 and 65535." 'Red'
  exit 1
}
if ($ApiPort -lt 1024 -or $ApiPort -gt 65535) {
  Write-Status '!!' "Invalid ApiPort ($ApiPort). Must be between 1024 and 65535." 'Red'
  exit 1
}

# -- Window Helper for Bringing Existing Window to Foreground -------------
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WindowHelper {
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsIconic(IntPtr hWnd);
}
"@ -ErrorAction SilentlyContinue

function Write-Status {
  param([string]$Icon, [string]$Msg, [string]$Color = 'Cyan')
  Write-Host "  [$Icon] " -NoNewline -ForegroundColor $Color
  Write-Host $Msg
}

function Set-ProcessWindowFocus {
  param([System.Diagnostics.Process]$Proc)
  if ($Proc -and $Proc.MainWindowHandle -and $Proc.MainWindowHandle -ne [IntPtr]::Zero) {
    try {
      # SW_RESTORE = 9, SW_SHOW = 5
      if ([WindowHelper]::IsIconic($Proc.MainWindowHandle)) {
        [WindowHelper]::ShowWindowAsync($Proc.MainWindowHandle, 9) | Out-Null
      } else {
        [WindowHelper]::ShowWindowAsync($Proc.MainWindowHandle, 5) | Out-Null
      }
      [WindowHelper]::SetForegroundWindow($Proc.MainWindowHandle) | Out-Null
      return $true
    } catch { }
  }
  return $false
}

$ProtectedBrowsers = @(
  'firefox', 'firefox-bin', 'chrome', 'googlechrome', 'chromium',
  'brave', 'opera', 'msedge', 'safari', 'vivaldi', 'zen', 'librewolf',
  'waterfox', 'tor', 'explorer', 'powershell', 'pwsh', 'cmd', 'conhost',
  'windowsterminal', 'system', 'svchost', 'taskmgr', 'csrss', 'lsass'
)

function Test-IsSafeToKill([System.Diagnostics.Process]$Proc) {
  if (-not $Proc -or $Proc.HasExited) { return $false }
  if ($Proc.Id -le 4 -or $Proc.Id -eq $PID) { return $false }

  $name = $Proc.ProcessName.ToLower()
  foreach ($prot in $ProtectedBrowsers) {
    if ($name -like "*$prot*") { return $false }
  }

  try {
    $procPath = $Proc.MainModule.FileName.ToLower()
    foreach ($prot in $ProtectedBrowsers) {
      if ($procPath -like "*$prot*") { return $false }
    }
  } catch { }

  # Must be node or electron
  if ($name -eq 'electron' -or $name -eq 'node' -or $name -like '*civitai*') {
    # Check if CommandLine or arguments contain protected browser names
    try {
      $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($Proc.Id)" -ErrorAction SilentlyContinue).CommandLine
      if ($cmd) {
        $cmdLower = $cmd.ToLower()
        foreach ($prot in $ProtectedBrowsers) {
          if ($cmdLower -like "*$prot*") { return $false }
        }
      }
    } catch { }
    return $true
  }

  return $false
}

function Get-RunningProcs {
  $running = @()
  $seenPids = [System.Collections.Generic.HashSet[int]]::new()

  # 1. Check stored PID file with strict verification
  if (Test-Path $PidFile) {
    $storedPids = Get-Content $PidFile -ErrorAction SilentlyContinue | ForEach-Object { [int]$_ }
    foreach ($procId in $storedPids) {
      if ($procId -gt 4 -and $seenPids.Add($procId)) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc -and (Test-IsSafeToKill $proc)) {
          $running += $proc
        }
      }
    }
  }

  # 2. Check network ports 5173 ($Port) and 5174 ($ApiPort) in LISTEN state only
  $portHolders = Get-NetTCPConnection -LocalPort $Port, $ApiPort -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
  if ($portHolders) {
    foreach ($ph in $portHolders) {
      if ($ph -gt 4 -and $seenPids.Add($ph)) {
        $proc = Get-Process -Id $ph -ErrorAction SilentlyContinue
        if ($proc -and (Test-IsSafeToKill $proc)) {
          $running += $proc
        }
      }
    }
  }

  # 3. Check any Electron processes associated with this workspace
  $electronProcs = Get-Process -Name 'electron' -ErrorAction SilentlyContinue
  foreach ($ep in $electronProcs) {
    try {
      if ($ep.Path -like "*$ProjectRoot*" -or $ep.Path -like "*node_modules\electron*") {
        if ($seenPids.Add($ep.Id) -and (Test-IsSafeToKill $ep)) {
          $running += $ep
        }
      }
    } catch { }
  }

  return $running
}

function Stop-App {
  $procs = Get-RunningProcs
  if ($procs.Count -eq 0) {
    Write-Status '!' 'No running Renegade Core Model Manager processes found.' 'Yellow'
    return $false
  }

  Write-Status 'x' "Stopping $($procs.Count) process(es)..." 'Red'
  foreach ($p in $procs) {
    try {
      if (Test-IsSafeToKill $p) {
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        Write-Status 'ok' "Killed PID $($p.Id) ($($p.ProcessName))" 'DarkGray'
      }
    }
    catch {
      Write-Status '!!' "Failed to kill PID $($p.Id): $_" 'Red'
    }
  }

  if (Test-Path $PidFile) {
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
  }
  Write-Status 'ok' 'Application stopped.' 'Green'
  return $true
}

function Ensure-NodeInstalled {
  $nodeCmd = Get-Command 'node' -ErrorAction SilentlyContinue
  $npmCmd = Get-Command 'npm' -ErrorAction SilentlyContinue
  $npxCmd = Get-Command 'npx' -ErrorAction SilentlyContinue

  if (-not $nodeCmd -or -not $npmCmd -or -not $npxCmd) {
    Write-Status '!' 'Node.js runtime was not detected on this system.' 'Yellow'
    Write-Host ''
    Write-Host '  Renegade Core Model Manager requires Node.js (v20+ LTS recommended).' -ForegroundColor Yellow
    Write-Host ''

    $installed = $false
    # Check if winget is available
    $wingetCmd = Get-Command 'winget' -ErrorAction SilentlyContinue
    if ($wingetCmd) {
      Write-Status '>>' 'Attempting automatic Node.js installation via Windows Package Manager (winget)...' 'Cyan'
      try {
        & winget install --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
        if ($LASTEXITCODE -eq 0) {
          $installed = $true
        }
      } catch {
        Write-Status '!!' "Winget installation encountered an issue: $_" 'Red'
      }
    }

    # If winget was not available or failed, download and run official MSI installer from nodejs.org
    if (-not $installed) {
      Write-Status '>>' 'Downloading official Node.js LTS installer from nodejs.org...' 'Cyan'
      $tempMsi = Join-Path $env:TEMP 'node-lts-installer.msi'
      try {
        $nodeDownloadUrl = 'https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi'
        Invoke-WebRequest -Uri $nodeDownloadUrl -OutFile $tempMsi -UseBasicParsing
        Write-Status '>>' 'Running Node.js installer (passive mode)...' 'Cyan'
        $installerProc = Start-Process msiexec.exe -ArgumentList "/i `"$tempMsi`" /passive /norestart" -PassThru -Wait
        if ($installerProc.ExitCode -eq 0) {
          $installed = $true
        }
      } catch {
        Write-Status '!!' "Failed downloading Node.js installer: $_" 'Red'
        Write-Host ''
        Write-Host '  Please download and install Node.js manually from: https://nodejs.org/' -ForegroundColor Cyan
        throw 'Node.js is required to run Renegade Core Model Manager.'
      }
    }

    # Refresh current PowerShell session environment PATH
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machinePath;$userPath"

    $recheck = Get-Command 'node' -ErrorAction SilentlyContinue
    if ($recheck) {
      $nodeVer = & node -v
      Write-Status 'ok' "Node.js environment verified ($nodeVer)!" 'Green'
    } else {
      Write-Status '!' 'Node.js was installed. If commands fail, please restart your PowerShell terminal.' 'Yellow'
    }
  }

  # Check if project dependencies (node_modules) are installed
  $nodeModulesDir = Join-Path $ProjectRoot 'node_modules'
  if (-not (Test-Path $nodeModulesDir)) {
    Write-Status '>>' 'node_modules not found. Installing project dependencies (npm install)...' 'Cyan'
    Push-Location $ProjectRoot
    try {
      & npm install
      if ($LASTEXITCODE -ne 0) {
        throw 'npm install failed.'
      }
      Write-Status 'ok' 'Dependencies installed successfully.' 'Green'
    } finally {
      Pop-Location
    }
  }
}

function Check-GitUpdates {
  # Check if release mode is forced or configured in src/version.ts
  if ($env:CMM_RELEASE_BUILD -eq 'true' -or $env:NODE_ENV -eq 'production') {
    return
  }
  $versionFile = Join-Path $ProjectRoot 'src\version.ts'
  if (Test-Path $versionFile) {
    $versionContent = Get-Content $versionFile -Raw
    if ($versionContent -match 'IS_DEV_BUILD:\s*false') {
      return
    }
  }

  if (Test-Path (Join-Path $ProjectRoot '.git')) {
    try {
      $localSha = (git rev-parse --short HEAD 2>$null)
      $remoteOutput = (git ls-remote --heads origin main 2>$null)
      if ($remoteOutput) {
        $fullSha = ($remoteOutput.Split("`t")[0]).Trim()
        $remoteSha = if ($fullSha.Length -ge 7) { $fullSha.Substring(0, 7) } else { $fullSha }
        if ($remoteSha -and $localSha -and ($remoteSha -ne $localSha)) {
          Write-Host ''
          Write-Status '!' "DEVELOPMENT UPDATE: Newer commit available on GitHub ($remoteSha)!" 'Yellow'
          Write-Host "      Current Local Commit : $localSha" -ForegroundColor Cyan
          Write-Host "      Latest GitHub Commit : $remoteSha (main branch)" -ForegroundColor Green
          Write-Host '      Note: You are running an active development version (not a tagged release).' -ForegroundColor Yellow
          Write-Host '      Run .\cmm.ps1 update or git pull to update your development copy.' -ForegroundColor Yellow
          Write-Host ''
        }
      }
    } catch { }
  }
}

function Update-App {
  if (-not (Test-Path (Join-Path $ProjectRoot '.git'))) {
    Write-Status '!!' 'This installation is not a Git clone. Cannot update automatically.' 'Red'
    Write-Host '  To update standalone builds, download the latest development release from GitHub.' -ForegroundColor Yellow
    return
  }

  Write-Status '>>' 'Pulling latest development updates from GitHub (git pull origin main)...' 'Cyan'
  Push-Location $ProjectRoot
  try {
    & git pull origin main
    if ($LASTEXITCODE -ne 0) {
      throw 'git pull failed.'
    }
    Write-Status 'ok' 'Git repository updated successfully.' 'Green'

    Ensure-NodeInstalled
    Write-Status '>>' 'Rebuilding application...' 'Cyan'
    & npm run build
    if ($LASTEXITCODE -ne 0) {
      throw 'Build failed.'
    }
    Write-Status 'ok' 'Update complete! You can now launch with .\cmm.ps1 start' 'Green'
  }
  finally {
    Pop-Location
  }
}

function Start-App {
  Ensure-NodeInstalled
  # Check for Git development updates
  Check-GitUpdates

  # Check if already running or if ports 5173/5174 are in use
  $existing = Get-RunningProcs
  if ($existing.Count -gt 0) {
    # Check if any running process has a visible GUI window to bring to the front
    foreach ($p in $existing) {
      if (Set-ProcessWindowFocus $p) {
        Write-Status 'ok' "Renegade Core Model Manager is already running (PID $($p.Id)). Active window brought to front." 'Green'
        return
      }
    }

    # If port is occupied but no visible window exists (orphaned ghost process), stop and auto-restart cleanly
    Write-Status '!' "Port $Port/5174 is in use by an orphaned process without an active window. Auto-cleaning orphaned process and starting fresh..." 'Yellow'
    Stop-App | Out-Null
    Start-Sleep -Seconds 1
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
  $env:API_PORT = "$ApiPort"
  $env:VITE_DEV_SERVER_URL = "http://localhost:$Port"
  $viteArgs = @('vite', '--port', "$Port", '--host', '127.0.0.1')
  $viteProc = Start-Process -FilePath 'npx.cmd' `
    -ArgumentList $viteArgs `
    -WorkingDirectory $ProjectRoot `
    -PassThru -WindowStyle Hidden

  Start-Sleep -Seconds 2

  # 3) Start Electron App (or run headless)
  $localElectron = Join-Path $ProjectRoot "node_modules\electron\dist\electron.exe"
  $electronExe = if (Test-Path $localElectron) { $localElectron } else { 'npx.cmd' }
  $electronArgs = if (Test-Path $localElectron) {
    if ($Headless -or $NoWindow) { @('.', '--headless') } else { @('.') }
  } else {
    if ($Headless -or $NoWindow) { @('electron', '.', '--headless') } else { @('electron', '.') }
  }

  if ($Headless -or $NoWindow) {
    Write-Status '>>' 'Starting Electron in headless background mode...' 'Magenta'
    $env:HEADLESS = "true"
    $electronProc = Start-Process -FilePath $electronExe `
      -ArgumentList $electronArgs `
      -WorkingDirectory $ProjectRoot `
      -PassThru -WindowStyle Hidden
  } else {
    Write-Status '>>' 'Launching Electron app window...' 'Magenta'
    $env:HEADLESS = "false"
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $electronExe
    $startInfo.Arguments = ($electronArgs -join ' ')
    $startInfo.WorkingDirectory = $ProjectRoot
    $startInfo.UseShellExecute = $true
    $electronProc = [System.Diagnostics.Process]::Start($startInfo)
  }

  # Save PIDs
  $pidsToSave = @()
  if ($viteProc -and -not $viteProc.HasExited) { $pidsToSave += $viteProc.Id }
  if ($electronProc -and -not $electronProc.HasExited) { $pidsToSave += $electronProc.Id }
  if ($pidsToSave.Count -gt 0) {
    $pidsToSave | Set-Content $PidFile
  }

  Write-Host ''
  Write-Status 'ok' 'Renegade Core Model Manager is running!' 'Green'
  Write-Host ''
  Write-Host "    Web / Browser UI : http://localhost:$Port" -ForegroundColor DarkGray
  Write-Host "    HTTP API Bridge  : http://localhost:$ApiPort" -ForegroundColor DarkGray
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
    Write-Status '-' 'Renegade Core Model Manager is not running.' 'Yellow'
  }
  else {
    Write-Status '+' "Renegade Core Model Manager is running ($($procs.Count) processes):" 'Green'
    foreach ($p in $procs) {
      Write-Host "      PID $($p.Id)  -  $($p.ProcessName)" -ForegroundColor DarkGray
    }
  }
}

# -- Banner ----------------------------------------------------------------

function Invoke-AppPackage {
  Ensure-NodeInstalled
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
Write-Host '  |   Renegade Core Model Manager   |' -ForegroundColor Magenta
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
  'update' {
    Update-App
  }
  'package' {
    Invoke-AppPackage
  }
  'publish' {
    Invoke-AppPackage
  }
  'dist' {
    Invoke-AppPackage
  }
  default {
    Ensure-NodeInstalled
    $cliScript = Join-Path $ProjectRoot 'bin\cmm.js'
    $allCliArgs = @($Action) + $RemainingArgs
    & node $cliScript @allCliArgs
  }
}