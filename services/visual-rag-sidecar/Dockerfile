# 1. Use the Developer image (contains nvcc and headers required for flash-attn)
FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Optimize for RTX 3090 Ti (Ampere SM86)
ENV PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
ENV TORCH_CUDA_ARCH_LIST="8.6"
ENV MAX_JOBS=4
# prefer prebuilt wheels when available
ENV FLASH_ATTENTION_FORCE_BUILD=FALSE

# Set environment variables
ENV HF_HOME=/root/.cache/huggingface
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 \
    python3-pip \
    python3-dev \
    build-essential \
    ninja-build \
    poppler-utils \
    libgl1-mesa-glx \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set Python 3.10 as default
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1 \
    && update-alternatives --install /usr/bin/pip pip /usr/bin/pip3 1

WORKDIR /app

# 2. Install PyTorch + Build Prereqs FIRST
# flash-attn requires torch, ninja, and packaging to be present in the environment BEFORE it builds
RUN pip install --no-cache-dir \
    torch==2.6.0 \
    --index-url https://download.pytorch.org/whl/cu124

RUN pip install --no-cache-dir ninja packaging setuptools wheel

# 3. CRITICAL: Install engine from source to support Qwen2.5-VL backbone
RUN set -eux; \
    echo "Installing Colpali engine from source (Qwen2.5 support)"; \
    pip install --no-cache-dir --upgrade git+https://github.com/illuin-tech/colpali.git; \
    echo "Installing Byaldi wrapper, transformers, autoawq and flash-attn support"; \
    pip install --no-cache-dir --upgrade "byaldi>=0.0.7" "transformers>=4.46.0" autoawq flash-attn; \
    python - <<'PY'
import pkgutil, sys
print('COLPALI_PRESENT', pkgutil.find_loader('colpali') is not None)
for m in ('byaldi','autoawq'):
    try:
        mod = __import__(m)
        print(m.upper(), getattr(mod, '__version__', 'unknown'))
    except Exception as e:
        print(m.upper() + '_IMPORT_FAIL', e)
PY

# 4. Copy requirements and install
COPY paperless-ai/services/visual-rag-sidecar/requirements.txt /app/requirements.txt
# Add optional retrieval speed optimizations
RUN pip install --no-cache-dir --no-deps fast-plaid fastkmeans
RUN pip install --no-cache-dir -r /app/requirements.txt

# 4. Install Flash Attention with Automatic ABI Detection (v0.7.2)
RUN set -eux; \
    # 1. Detect the ABI required by your installed torch==2.6.0
    ABI=$(python -c "import torch; print('TRUE' if torch._C._GLIBCXX_USE_CXX11_ABI else 'FALSE')"); \
    echo "Detected Torch ABI: $ABI"; \
    \
    # 2. Construct the v0.7.2 URL (Optimized for Torch 2.6 + CUDA 12.4)
    WHEEL_URL="https://github.com/mjun0812/flash-attention-prebuild-wheels/releases/download/v0.7.2/flash_attn-2.7.4.post1%2Bcu124torch2.6cxx11abi${ABI}-cp310-cp310-linux_x86_64.whl"; \
    \
    # 3. Download and Install
    if wget -q --spider "$WHEEL_URL"; then \
        echo "Installing optimized v0.7.2 wheel: $WHEEL_URL"; \
        pip install --no-cache-dir "$WHEEL_URL"; \
    else \
        echo "Wheel not found, trying simplified fallback"; \
        FALLBACK_URL="https://github.com/mjun0812/flash-attention-prebuild-wheels/releases/download/v0.7.2/flash_attn-2.7.4.post1%2Bcu124torch2.6-cp310-cp310-linux_x86_64.whl"; \
        pip install --no-cache-dir "$FALLBACK_URL" || pip install --no-cache-dir --no-build-isolation flash-attn==2.7.4.post1; \
    fi

# Final smoke test: Fails build if the symbol error persists
RUN python - <<'PY'
import torch, sys
try:
    import flash_attn
    from flash_attn import flash_attn_interface
    print(f'✅ SYSTEM READY: Torch={torch.__version__} ABI={getattr(torch._C, "_GLIBCXX_USE_CXX11_ABI", False)} FA={getattr(flash_attn,"__version__","unknown")}')
except Exception as e:
    print('FLASH_ATTENTION_IMPORT_FAIL', e)
    raise
PY

COPY paperless-ai/services/visual-rag-sidecar/main.py /app/main.py
# Normalize line endings (remove CR) and verify syntax at build time to avoid
# packaging IndentationError in the container (fails fast on build if bad).
RUN sed -i 's/\r$//' /app/main.py && python -m py_compile /app/main.py
RUN mkdir -p /data/indices /root/.cache/huggingface

EXPOSE 8001
CMD ["python", "main.py"]
