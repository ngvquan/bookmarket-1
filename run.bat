@echo off
setlocal DisableDelayedExpansion
rem Khoi dong MongoDB, backend va frontend; giu cua so server de xem loi.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows-local.ps1" -Mode Run
set "BOOKMARKET_RESULT=%ERRORLEVEL%"
if /I not "%~1"=="--no-pause" pause
exit /b %BOOKMARKET_RESULT%
