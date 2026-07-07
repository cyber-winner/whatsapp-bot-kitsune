@echo off
setlocal EnableDelayedExpansion
title Celestia Bot - Automated Installer

echo ===================================================
echo   Kitsune / Celestia Bot - Automated Setup
echo ===================================================
echo.

:: Check for Node.js
where node >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [INFO] Node.js is not installed. Downloading Node.js 20.x...
    curl -L -o "%TEMP%\node_installer.msi" "https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi"
    echo [INFO] Installing Node.js quietly...
    msiexec /i "%TEMP%\node_installer.msi" /quiet /qn /norestart
    echo [SUCCESS] Node.js installed.
    set NODE_MISSING=1
)

:: Check for Python
set PYTHON_CMD=python
python --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    set PYTHON_CMD=python3
    python3 --version >nul 2>&1
    IF !ERRORLEVEL! NEQ 0 (
        echo [INFO] Python is not installed. Downloading Python 3.11...
        curl -L -o "%TEMP%\python_installer.exe" "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
        echo [INFO] Installing Python quietly...
        "%TEMP%\python_installer.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_test=0
        echo [SUCCESS] Python installed.
        set PYTHON_MISSING=1
    )
)

IF DEFINED NODE_MISSING (
    echo [ACTION REQUIRED] Node.js was just installed.
    set RESTART_REQ=1
)
IF DEFINED PYTHON_MISSING (
    echo [ACTION REQUIRED] Python was just installed.
    set RESTART_REQ=1
)
IF DEFINED RESTART_REQ (
    echo [ACTION REQUIRED] System paths have been updated. 
    echo Please close this window, wait 10 seconds, and run start_windows.bat again.
    pause
    exit /b
)

echo [INFO] Installing Node.js dependencies...
call npm install

echo [INFO] Setting up Python virtual environment...
%PYTHON_CMD% -m venv .venv
call .venv\Scripts\activate.bat

IF EXIST requirements.txt (
    echo [INFO] Installing Python requirements...
    pip install -r requirements.txt
)

echo [INFO] Launching environment setup (Docker)...
python setup_and_start.py
pause

