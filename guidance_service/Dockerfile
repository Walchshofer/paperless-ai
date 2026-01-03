# Guidance Service Dockerfile
# Python Flask service for deterministic JSON extraction via constrained LLM generation

FROM python:3.11-slim

# Install system dependencies including Rust (required for guidance library)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Add Rust to PATH
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create cache directory
RUN mkdir -p /app/cache_data

# Expose port
EXPOSE 8002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8002/health || exit 1

# Environment variables
ENV FLASK_APP=app
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1
ENV GUIDANCE_CACHE_DIR=/app/cache_data

# Run with gunicorn for production
# Use gthread worker class to avoid pickle errors with guidance/LiteLLM
# (threads share memory, avoiding multiprocessing pickle issues)
# 2 workers × 4 threads = 8 concurrent requests
CMD ["python", "-m", "gunicorn", \
     "--bind", "0.0.0.0:8002", \
     "--workers", "2", \
     "--worker-class", "gthread", \
     "--threads", "4", \
     "--timeout", "300", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info", \
     "app:create_app()"]
