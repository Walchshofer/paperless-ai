# --- Stage 1: Builder ---
FROM nvidia/cuda:12.6.3-cudnn-devel-ubuntu22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive
# Optimization: Target only your GPU architecture (8.6 = RTX 30-series / Ampere)
ENV TORCH_CUDA_ARCH_LIST="8.6"
ENV PYTHONUNBUFFERED=1

# Install essential system dependencies for building SciPy/Numpy and Flash Attention
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3-pip python3-dev build-essential ninja-build git \
    libopenblas-dev liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Pre-install build tools
RUN pip install --no-cache-dir setuptools wheel packaging

# SINGLE-SHOT INSTALL: 
# Groups all packages to resolve dependencies once. 
# Explicitly uses cu124 wheels as they are currently the stable target for Torch 2.8.0.
RUN pip install --no-cache-dir \
    --index-url https://download.pytorch.org/whl/cu124 \
    --extra-index-url https://pypi.org/simple \
    "torch==2.8.0" \
    "torchvision==0.23.0" \
    "uvicorn[standard]==0.40.0" \
    "fastapi==0.128.0" \
    "qdrant-client>=1.16.0" \
    "grpcio>=1.63.0" \
    "transformers==4.57.3" \
    "tokenizers==0.22.2" \
    "regex" \
    "sentencepiece" \
    "protobuf>=5.26.1,<6.0.0" \
    "scipy>=1.13.0" \
    "accelerate>=0.30.0" \
    "numpy==1.26.4" \
    "pydantic==2.12.5" \
    "pdf2image==1.17.0" \
    "Pillow==11.0.0" \
    "python-dotenv==1.2.1" \
    "prometheus-fastapi-instrumentator>=7.0.0" \
    "fast-plaid" \
    "fastkmeans" \
    "qwen-vl-utils" \
    "autoawq==0.2.9" \
    "auto-round==0.9.2" \
    "byaldi>=0.0.7" \
    psutil

# FLASH-ATTN: Hardware-specific compilation must happen after Torch is installed.
# Use many cores for native builds (WSL2 now gives you 32 CPUs)
ENV MAX_JOBS=10
RUN pip install --no-cache-dir "flash-attn==2.7.4.post1" --no-build-isolation

# --- Stage 2: Runtime ---
FROM nvidia/cuda:12.6.3-cudnn-runtime-ubuntu22.04 AS runtime

ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/root/.cache/huggingface
# Ensure the runtime can find the builder's compiled dist-packages
ENV PYTHONPATH=/usr/local/lib/python3.10/dist-packages:/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3-pip python3.10-dev poppler-utils libgl1-mesa-glx libglib2.0-0 \
    gcc g++ build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Efficiently transfer only the compiled environment
COPY --from=builder /usr/local/lib/python3.10/dist-packages /usr/local/lib/python3.10/dist-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY main.py .

ENV QDRANT_HOST=qdrant
ENV QDRANT_PORT=6333
ENV INDEX_DIR=/data/indices
VOLUME ["/data/indices"]

EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]