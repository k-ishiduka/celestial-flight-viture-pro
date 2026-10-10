@echo off
cd /d "%~dp0outputs"
where py >nul 2>nul && (py -3 launch.py) || (python launch.py)
pause
