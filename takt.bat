@echo off
setlocal
cd /d "%~dp0"
title TAKT
echo.
echo  Starting TAKT...
echo  Leave this window open. Close it to stop.
echo.
python "%~dp0server.py" %*
if errorlevel 1 (
  echo.
  echo  TAKT exited with an error.
  pause
)
endlocal
