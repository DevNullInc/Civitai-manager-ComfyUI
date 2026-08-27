@echo off
setlocal
cd /d "%~dp0"

title CivitAI Model Manager

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cmm.ps1" %*
set EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% neq 0 (
    echo.
    echo [!] Application exited with code %EXIT_CODE%
    echo Press any key to close this window...
    pause >nul
)

exit /b %EXIT_CODE%
