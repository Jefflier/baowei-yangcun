@echo off
rem Defense of the Sheep Village (fan remake) - local launcher
rem Starts the no-cache dev server and opens the game in your default browser.
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo [!] Python not found in PATH. Opening index.html directly instead...
  start "" "%~dp0index.html"
  exit /b
)

echo Starting local server: http://127.0.0.1:8123/
start "TDServer" /min cmd /c "python tools\devserver.py 8123"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8123/index.html"
echo.
echo Game opened in your browser.
echo To stop the server, close the window titled "TDServer".
timeout /t 6 >nul
