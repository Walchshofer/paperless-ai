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

# 2. Install native TomoroAI dependencies
RUN pip install --no-cache-dir transformers==4.57.3 autoawq==0.2.9 \
    auto-round==0.9.2 flash-attn --no-build-isolation

# 3. Install retrieval acceleration
RUN pip install --no-cache-dir fast-plaid fastkmeans qwen-vl-utils

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

RUN mkdir -p /data/indices

EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
