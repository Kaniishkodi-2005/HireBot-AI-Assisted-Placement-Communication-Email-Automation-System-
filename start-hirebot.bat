@echo off
echo Starting HireBot Application...
docker-compose up -d
echo.
echo HireBot is starting up!
echo Frontend: http://localhost:5173
echo Backend: http://localhost:8000
echo.
pause