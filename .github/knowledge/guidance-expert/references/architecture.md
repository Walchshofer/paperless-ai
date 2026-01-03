# Guidance System Architecture

## Component Overview

The Guidance system consists of four components that work as **siblings orchestrated by Guidance**, not nested wrappers.

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR APPLICATION                     │
│              (Guidance Templates + Code)                │
└────────────────────────┬────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│                 GUIDANCE FRAMEWORK                       │
│            (Orchestrates all components)                │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ Constraint  │  │   Model     │  │    Template     │ │
│  │  Registry   │  │   Router    │  │    Executor     │ │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
└─────────┼────────────────┼──────────────────┼──────────┘
          │                │                  │
          ↓                ↓                  │
┌─────────────────┐  ┌─────────────────┐      │
│ LogitBiasEngine │  │     LiteLLM     │      │
│   (gRPC:50051)  │  │ (Protocol Abs.) │      │
│                 │  │                 │      │
│ - Token valid.  │  │ - Ollama        │      │
│ - Bias compute  │  │ - OpenAI        │      │
│ - FSM/regex     │  │ - Anthropic     │      │
│ - Caching       │  │ - etc.          │      │
└─────────────────┘  └────────┬────────┘      │
                              │               │
                              ↓               │
                    ┌─────────────────┐       │
                    │     Ollama      │       │
                    │  (HTTP:11434)   │◄──────┘
                    │                 │
                    │ - Model serving │
                    │ - GPU inference │
                    │ - Logit output  │
                    └─────────────────┘
```

## The Four Layers

### Layer 1: Ollama (Model Server)
- **Port**: 11434 (HTTP)
- **Role**: GPU inference, neural network forward passes
- **Output**: Raw logits (token probabilities)
- **Backend**: llama.cpp
- **Scaling**: Vertical (GPU-bound)

```python
# Direct Ollama (no constraints)
curl http://localhost:11434/api/generate \
  -d '{"model": "mistral", "prompt": "Generate SSN: "}'
# Result: "ABC-XY-123" (INVALID - Ollama doesn't understand constraints)
```

### Layer 2B: LiteLLM (Protocol Abstraction)
- **Location**: Embedded in Guidance
- **Role**: Translates Guidance calls to provider APIs
- **Providers**: Ollama, OpenAI, Anthropic, etc.
- **Benefit**: Swap providers without code changes

```python
# LiteLLM abstracts the provider
lm = models.from_litellm("ollama/mistral")  # Ollama
lm = models.from_litellm("openai/gpt-4")    # OpenAI
lm = models.from_litellm("anthropic/claude") # Anthropic
# Same Guidance code works with all!
```

### Layer 2A: LogitBiasEngine (Constraint Enforcement)
- **Port**: 50051 (gRPC)
- **Role**: Validates tokens against constraints
- **Capabilities**: Regex→FSM, JSON schema, grammar
- **Scaling**: Horizontal (CPU-bound)

```python
# BiasEngine validates constraints
POST gRPC://localhost:50051/ComputeBiases
{
  "regex_pattern": "[0-9]{3}-[0-9]{2}-[0-9]{4}",
  "generated_text": "",
  "vocab_size": 50257
}
# Response: {token_biases: {...}, valid_tokens: [...]}
```

### Layer 3: Guidance (Orchestration)
- **Location**: Your application
- **Role**: Coordinates all components
- **API**: @guidance decorator, gen(), select(), json()

```python
@guidance
def generate_ssn(lm):
    lm += "SSN: "
    lm += gen(regex=r"[0-9]{3}-[0-9]{2}-[0-9]{4}", name="ssn")
    return lm

# Guidance orchestrates:
# 1. Query BiasEngine for valid tokens
# 2. Request inference from Ollama via LiteLLM
# 3. Apply biases to logits
# 4. Sample guaranteed-valid token
```

## Data Flow: Token-by-Token

```
For each token to generate:

1. GUIDANCE: "What tokens are valid for constraint X?"
       │
       ↓
2. BIASENGINE: Computes biases {token_id: bias_value}
       │
       ↓
3. GUIDANCE: "Generate next token"
       │
       ↓
4. LITELLM: Routes to Ollama
       │
       ↓
5. OLLAMA: Returns logits[vocab_size]
       │
       ↓
6. GUIDANCE: adjusted_logits = logits + biases
       │
       ↓
7. GUIDANCE: Samples from adjusted_logits
       │
       ↓
8. RESULT: Token is GUARANTEED valid
```

## Deployment Options

### Option 1: Single Machine (Development)
```
┌─────────────────────────────────────────┐
│ Your Machine                            │
│ ├─ Ollama (localhost:11434)            │
│ ├─ BiasEngine (localhost:50051)        │
│ └─ Your App (Guidance templates)       │
└─────────────────────────────────────────┘
```

### Option 2: Multi-Container (Docker Compose)
```yaml
services:
  ollama:
    image: ollama/ollama
    ports: ["11434:11434"]
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
  
  bias-engine:
    image: guidance:bias-engine
    ports: ["50051:50051"]
  
  app:
    build: .
    environment:
      - OLLAMA_HOST=ollama:11434
      - BIAS_ENGINE_HOST=bias-engine:50051
```

### Option 3: Kubernetes (Production)
```
Node Pool 1 (GPU): Ollama
├─ 1 replica (GPU-bottleneck)
├─ A100 80GB
└─ Service: ollama:11434

Node Pool 2 (CPU): BiasEngine  
├─ 2-10 replicas (HPA)
├─ 4-8 cores, 4-16GB RAM each
└─ Service: bias-engine:50051

Node Pool 3 (General): App
├─ 2-20 replicas (HPA)
├─ 1-2 cores, 2-4GB RAM each
└─ Ingress: app.example.com
```

## Network Topology

```
┌──────────────────────────────────────────────────────────┐
│                     INTERNAL NETWORK                     │
│                                                          │
│  Your App ──────────────────────────────────────────┐   │
│     │                                               │   │
│     ├── gRPC ──→ BiasEngine (50051)                │   │
│     │            "What tokens match [A-Z]+?"        │   │
│     │            ← {token_biases}                   │   │
│     │                                               │   │
│     └── HTTP ──→ LiteLLM ──→ Ollama (11434)        │   │
│                  "Generate next token"              │   │
│                  ← logits[50257]                    │   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Why This Architecture?

### Problem: Direct Ollama Has No Constraints
```python
# Without Guidance + BiasEngine
response = requests.post("http://localhost:11434/api/generate", {
    "model": "mistral",
    "prompt": "Generate SSN: "
})
# Result: "ABC-XY-123" (INVALID!)
# Ollama doesn't know what SSN format is
```

### Solution: Guidance Orchestrates Constraints
```python
# With Guidance + BiasEngine + LiteLLM
lm = models.from_litellm("ollama/mistral")
result = lm + f"SSN: {gen(regex=r'[0-9]{3}-[0-9]{2}-[0-9]{4}')}"
# Result: "123-45-6789" (GUARANTEED VALID!)
```

## Component Responsibilities

| Component | Does | Does NOT |
|-----------|------|----------|
| **Ollama** | GPU inference, logits | Understand constraints |
| **LiteLLM** | Protocol translation | Validate tokens |
| **BiasEngine** | Token validation, biases | Run models |
| **Guidance** | Orchestration, templates | Serve models |

## Scaling Strategy

| Load Increase | Traditional | With BiasEngine |
|---------------|-------------|-----------------|
| 2x | GPU upgrade (2x cost) | Add CPU pod (0.2x) |
| 5x | New machine (5x cost) | Add 4 CPU pods (1x) |
| 10x | Major infra (10x cost) | Add 8 CPU pods (1.5x) |

Key insight: **Constraint validation is CPU-bound**, model inference is GPU-bound. Scale them independently!

## Quick Reference

```python
# Complete setup
from guidance import models, gen, select
from guidance.engines import LogitBiasEngine
from guidance.ipc import GrpcBiasServer

# 1. Start BiasEngine (CPU container)
engine = LogitBiasEngine(tokenizer)
server = GrpcBiasServer(engine, port=50051)
server.start()

# 2. Connect to Ollama via LiteLLM
lm = models.from_litellm("ollama/mistral")

# 3. Use constraints (BiasEngine validates)
result = lm + f"Email: {gen(regex=r'[a-z]+@[a-z]+\.[a-z]+')}"
# GUARANTEED valid email format!
```