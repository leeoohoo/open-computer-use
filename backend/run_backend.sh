#!/bin/bash

echo "Starting Coasty Python Backend..."
echo

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "Virtual environment created."
    echo
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install/upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo "Installing requirements..."
pip install -r requirements.txt

# Copy .env.example to .env if it doesn't exist
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "Creating .env file from .env.example..."
        cp .env.example .env
        echo "Please configure your .env file with proper values!"
        echo
    fi
fi

# Run the backend server
echo
echo "Starting FastAPI server on http://localhost:8001"
echo "API Documentation available at http://localhost:8001/docs"
echo
python main.py