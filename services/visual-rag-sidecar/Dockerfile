FROM nvidia/cuda:12.6.3-cudnn-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TORCH_CUDA_ARCH_LIST="8.6"
ENV HF_HOME=/root/.cache/huggingface
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3-pip python3-dev build-essential ninja-build \
    poppler-utils libgl1-mesa-glx wget git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Install PyTorch built for CUDA 12.4+ compatibility
RUN pip install --no-cache-dir \
    torch==2.6.0+cu124 \
    torchvision==0.21.0+cu124 \
    --index-url https://download.pytorch.org/whl/cu124

# Ensure basic build deps are present so flash-attn's setup.py can import `packaging`
# Reference: https://github.com/Dao-AILab/flash-attention/issues/453
RUN pip install --no-cache-dir --upgrade pip setuptools wheel packaging psutil

# Install flash-attn separately so failures are clearer and packaging is available
# Pin to known-good build for CUDA 12.4+ compatibility
RUN pip install --no-cache-dir "flash-attn==2.7.4.post1" --no-build-isolation

# Install remaining pure-Python dependencies from the canonical requirements file
COPY services/visual-rag-sidecar/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/visual-rag-sidecar/main.py .

# Runtime defaults and index mount
ENV QDRANT_HOST=qdrant
ENV QDRANT_PORT=6333
ENV INDEX_DIR=/data/indices
VOLUME ["/data/indices"]

EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
