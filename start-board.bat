@echo off
echo Starting Board Server...
echo =====================================
echo To stop the server:
echo 1. Return to this window
echo 2. Press Ctrl + C
echo 3. Or simply close this window
echo =====================================
echo.
start http://localhost:8000
python -m http.server 8000 