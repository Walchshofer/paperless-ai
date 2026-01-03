# LiteLLM & Ollama Integration

## Installation

```bash
pip install guidance litellm

# For CUDA acceleration
pip install guidance[litellm] torch --index-url https://download.pytorch.org/whl/cu118
```

## LiteLLM Configuration with Ollama

```python
import guidance
from guidance.models import LiteLLM

litellm_config = {
    "model_name": "llama2",
    "litellm_params": {
        "model": "ollama/llama2",
        "api_base": "http://192.168.x.x:11434/v1",  # Windows machine IP
        "api_key": "ollama",  # Ollama doesn't require actual key
    }
}

ollama_lm = guidance.models.experimental.LiteLLM(
    model_description=litellm_config,
    echo=False,
    max_tokens=2048
)
```

## Docker Container Setup

### Dockerfile
```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y build-essential git && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "app.py"]
```

### requirements.txt
```
guidance>=0.3.0
litellm>=1.0.0
fastapi>=0.100.0
pydantic>=2.0.0
python-dotenv>=1.0.0
```

## Network Configuration

### Windows Ollama Setup
```bash
# Set environment variable before starting Ollama
OLLAMA_HOST=0.0.0.0:11434
ollama serve
```

### Container to Windows Connection
```python
import os

WINDOWS_HOST_IP = os.getenv("WINDOWS_HOST_IP", "host.docker.internal")
OLLAMA_PORT = os.getenv("OLLAMA_PORT", "11434")

ollama_endpoint = f"http://{WINDOWS_HOST_IP}:{OLLAMA_PORT}/v1"

litellm_config = {
    "model_name": "llama2",
    "litellm_params": {
        "model": "ollama/llama2",
        "api_base": ollama_endpoint,
        "api_key": "ollama",
    }
}
```

## Model Selection

### Thinking Models (Complex Reasoning)
```python
thinking_models = {
    "deepseek-r1": "ollama/deepseek-r1",  # Best for complex reasoning
    "mistral": "ollama/mistral",           # Good for analysis
}
```

### Instruction Models (Precise Tasks)
```python
instruction_models = {
    "neural-chat": "ollama/neural-chat",   # Instruction following
    "llama2": "ollama/llama2",             # General purpose
    "orca": "ollama/orca-mini",            # Small, efficient
}
```

## vLLM Server Alternative

```bash
vllm serve model_name \
    --host 0.0.0.0 \
    --port 8000 \
    --enable-prefix-caching \
    --guided-decoding-backend guidance \
    --max-model-len 16384
```

```python
vllm_config = {
    "model_name": "model",
    "litellm_params": {
        "model": "hosted_vllm/model_name",
        "api_base": "http://192.168.x.x:8000/v1",
        "api_key": "VLLM_API_KEY",
    }
}
```

## Docker Compose

```yaml
version: '3.8'
services:
  dms-guidance:
    build: .
    container_name: dms-guidance-app
    ports:
      - "8000:8000"
    environment:
      - WINDOWS_HOST_IP=host.docker.internal
      - OLLAMA_PORT=11434
    networks:
      - dms-network
    depends_on:
      - ollama

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    environment:
      - OLLAMA_HOST=0.0.0.0:11434
    volumes:
      - ollama_data:/root/.ollama
    networks:
      - dms-network

volumes:
  ollama_data:

networks:
  dms-network:
    driver: bridge
```

## Troubleshooting

### Connection Refused
```python
# Use host.docker.internal (Docker for Windows/Mac)
api_base = "http://host.docker.internal:11434/v1"

# Or use host IP address (Linux)
api_base = "http://192.168.x.x:11434/v1"

# Verify Ollama listening on all interfaces
# Windows: set OLLAMA_HOST=0.0.0.0:11434
```

### Timeout Issues
```python
# Increase timeout
import asyncio

async with asyncio.timeout(60):
    result = await process_document()
```

### Memory Issues
```bash
# Use quantized models
ollama pull model:q4_0

# Increase Docker memory limit
# docker-compose.yml: mem_limit: 4g
```
