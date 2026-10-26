@echo off
rem One-click start for Tackle AI. Double-click this file; close the window to stop
rem everything it started (Node, Ollama and its model runners).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0boot.ps1"
echo.
echo Tackle AI stopped.
pause
