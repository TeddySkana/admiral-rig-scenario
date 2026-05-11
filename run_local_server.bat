@echo off
cd /d "%~dp0"
echo Starting Skana Admiral's Rig Protection Scenario at http://localhost:8000
python -m http.server 8000
pause
