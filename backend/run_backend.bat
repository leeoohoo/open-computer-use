@echo off
echo Starting Coasty Python Backend...
echo.

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    echo Virtual environment created.
    echo.
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install/upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip

REM Install requirements
echo Installing requirements...
pip install -r requirements.txt

REM Copy .env.example to .env if it doesn't exist
if not exist ".env" (
    if exist ".env.example" (
        echo Creating .env file from .env.example...
        copy .env.example .env
        echo Please configure your .env file with proper values!
        echo.
    )
)

REM Run the backend server
echo.
echo Starting FastAPI server on http://localhost:8001
echo API Documentation available at http://localhost:8001/docs
echo.
python main.py