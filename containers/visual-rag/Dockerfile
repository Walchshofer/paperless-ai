# --- Stage 1: Builder ---
FROM nvidia/cuda:12.6.3-cudnn-devel-ubuntu22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive
ENV TORCH_CUDA_ARCH_LIST="8.6"
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3-pip python3-dev build-essential ninja-build git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

RUN pip install --no-cache-dir \
    torch==2.6.0+cu124 \
    torchvision==0.21.0+cu124 \
    --index-url https://download.pytorch.org/whl/cu124 \
    --extra-index-url https://pypi.org/simple

RUN pip install --no-cache-dir setuptools wheel packaging psutil

# Compile heavy flash-attn in the builder
RUN pip install --no-cache-dir "flash-attn==2.7.4.post1" --no-build-isolation

# --- Stage 2: Runtime ---
FROM nvidia/cuda:12.6.3-cudnn-runtime-ubuntu22.04 AS runtime

ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/root/.cache/huggingface
ENV PYTHONPATH=/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3-pip poppler-utils libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the heavy compiled site-packages from builder
COPY --from=builder /usr/local/lib/python3.10/dist-packages /usr/local/lib/python3.10/dist-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# 1. Install verified "Infrastructure" + "Performance" Stack WITH dependencies. 
# Added fast-plaid and fastkmeans here so they are natively registered in the runtime.
RUN pip install --no-cache-dir \
    "uvicorn[standard]==0.40.0" \
    "fastapi==0.128.0" \
    "qdrant-client[grpc]>=1.7.0" \
    "transformers==4.57.3" \
    "tokenizers==0.22.2" \
    "regex" \
    "fast-plaid" \
    "fastkmeans"

# 2. Install remaining specialized dependencies WITHOUT sub-dependencies.
COPY requirements.txt .
RUN pip install --no-cache-dir --no-deps -r requirements.txt

COPY main.py .

ENV QDRANT_HOST=qdrant
ENV QDRANT_PORT=6333
ENV INDEX_DIR=/data/indices
VOLUME ["/data/indices"]

EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
