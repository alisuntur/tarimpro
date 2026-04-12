@echo off
setlocal

set "ROOT=%~dp0"
set "PYTHON_EXE=%ROOT%.venv\Scripts\python.exe"

if not exist "%PYTHON_EXE%" (
    set "PYTHON_EXE=python"
)

echo TarimPro gelistirme sunuculari baslatiliyor...
echo Backend:  http://127.0.0.1:8000/docs
echo Frontend: http://127.0.0.1:5173/
echo.

start "TarimPro Backend" cmd /k "cd /d ""%ROOT%backend"" && ""%PYTHON_EXE%"" -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"
start "TarimPro Frontend" cmd /k "cd /d ""%ROOT%frontend"" && npm run dev -- --host 127.0.0.1 --port 5173"

echo Iki ayri terminal acildi. Kapatmak icin ilgili terminalde Ctrl+C kullanabilirsin.
endlocal