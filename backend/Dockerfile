# Python Backend Dockerfile
FROM python:3.11-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies (filter out Windows-only packages)
RUN pip install --no-cache-dir --upgrade pip && \
    grep -viE '^(pywin32|pywinauto|comtypes|pygetwindow|mouseinfo|pymsgbox|pyscreeze|pyautogui|pyrect)==' requirements.txt > requirements-linux.txt && \
    pip install --no-cache-dir -r requirements-linux.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 backend && \
    chown -R backend:backend /app

# Switch to non-root user
USER backend

# Expose the backend port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8001/api/health || exit 1

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=8001

# Run the application
CMD ["python", "main.py"]