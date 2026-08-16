@echo off
echo Starting RentGuard servers...

start "Backend (5000)" cmd /k "cd /d %~dp0backend && npm run dev"
start "AI Service (8000)" cmd /k "cd /d %~dp0ai-service && venv\Scripts\activate && uvicorn main:app --reload --port 8000"
start "Frontend (5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo All three servers are starting in separate windows.
echo   Backend   → http://localhost:5000
echo   AI Service → http://localhost:8000
echo   Frontend  → http://localhost:5173
echo.