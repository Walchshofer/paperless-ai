# --- Stage 1: Builder ---
FROM nvidia/cuda:12.6.3-cudnn-devel-ubuntu22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive
ENV TORCH_CUDA_ARCH_LIST="8.6"
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3-pip python3-dev build-essential ninja-build git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Install PyTorch first
RUN pip install --no-cache-dir \
    torch==2.6.0+cu124 \
    torchvision==0.21.0+cu124 \
    --index-url https://download.pytorch.org/whl/cu124 \
    --extra-index-url https://pypi.org/simple

RUN pip install --no-cache-dir setuptools wheel packaging psutil

# Install ALL Python dependencies BEFORE compiling flash-attn
# This ensures flash-attn is compiled against the final PyTorch version
RUN pip install --no-cache-dir \
    "uvicorn[standard]==0.40.0" \
    "fastapi==0.128.0" \
    "qdrant-client[grpc]>=1.16.0" \
    "transformers==4.57.3" \
    "tokenizers==0.22.2" \
    "regex" \
    "sentencepiece" \
    "protobuf" \
    "scipy" \
    "accelerate>=0.30.0" \
    "numpy==1.26.4" \
    "pydantic==2.12.5" \
    "pdf2image==1.17.0" \
    "Pillow==11.0.0" \
    "python-dotenv==1.2.1" \
    "prometheus-fastapi-instrumentator>=7.0.0"

# Compile flash-attn LAST, after all other deps are installed
RUN pip install --no-cache-dir "flash-attn==2.7.4.post1" --no-build-isolation

# --- Stage 2: Runtime ---
FROM nvidia/cuda:12.6.3-cudnn-runtime-ubuntu22.04 AS runtime

ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/root/.cache/huggingface
ENV PYTHONPATH=/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3-pip poppler-utils libgl1-mesa-glx libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy ALL site-packages from builder (includes correctly compiled flash-attn)
COPY --from=builder /usr/local/lib/python3.10/dist-packages /usr/local/lib/python3.10/dist-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Install ONLY packages that don't have native extensions and won't touch PyTorch
# Use --no-deps to prevent any dependency resolution that could break things
RUN pip install --no-cache-dir --no-deps \
    "fast-plaid" \
    "fastkmeans" \
    "qwen-vl-utils" \
    "autoawq==0.2.9" \
    "auto-round==0.9.2" \
    "byaldi>=0.0.7"

COPY main.py .

ENV QDRANT_HOST=qdrant
ENV QDRANT_PORT=6333
ENV INDEX_DIR=/data/indices
VOLUME ["/data/indices"]

EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]