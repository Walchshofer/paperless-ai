# Visual RAG Sidecar Dockerfile
# ==============================
#
# Provides visual document retrieval using ColQwen2/ColPali via Byaldi.
# Requires NVIDIA GPU with 12GB+ VRAM.
#
# Build: docker build -t visual-rag:local .
# Run:   docker run --gpus all -p 8001:8001 visual-rag:local

# Use NVIDIA CUDA base image with Python
# Updated from deprecated 12.1.0-cudnn8 to supported 12.4.1-cudnn
FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Set Python environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# PyTorch CUDA memory configuration for GPU sharing with Ollama
ENV PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
# Flash Attention compilation settings
ENV MAX_JOBS=4
ENV TORCH_CUDA_ARCH_LIST="8.0;8.6;8.9;9.0"

# Hugging Face cache directory (will be mounted as volume)
# Note: TRANSFORMERS_CACHE is deprecated, HF_HOME is the standard
ENV HF_HOME=/root/.cache/huggingface

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 \
    python3-pip \
    python3.10-dev \
    build-essential \
    # CUDA development tools for flash-attention compilation (required)
    cuda-toolkit-12-4 \
    ninja-build \
    # Poppler for PDF to image conversion (required by Byaldi)
    poppler-utils \
    # Additional image processing libraries
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    # Cleanup
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set Python 3.10 as default
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1 \
    && update-alternatives --install /usr/bin/pip pip /usr/bin/pip3 1

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Create app directory
WORKDIR /app

# Install PyTorch with CUDA support first (large download, cache separately)
# Install PyTorch with CUDA 12.4 support
RUN pip install --no-cache-dir \
    torch==2.2.0 \
    torchvision==0.17.0 \
    --index-url https://download.pytorch.org/whl/cu124

# Copy requirements and install dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt
# Install flash-attention separately with no-build-isolation flag
# This ensures proper CUDA compilation for ColQwen3
RUN pip install --no-cache-dir --no-build-isolation flash-attn>=2.4.0

# Copy application code
COPY main.py /app/

# Create directories for indices and cache
RUN mkdir -p /data/indices /root/.cache/huggingface

# Expose the service port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')" || exit 1

# Run the application
# Note: Using single worker since GPU model can't be shared across processes
CMD ["python", "main.py"]
