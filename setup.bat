@echo off
setlocal DisableDelayedExpansion
rem Cai dat lan dau. --no-pause dung khi chay tu terminal/kiem thu.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows-local.ps1" -Mode Setup
set "BOOKMARKET_RESULT=%ERRORLEVEL%"
if /I not "%~1"=="--no-pause" pause
exit /b %BOOKMARKET_RESULT%
