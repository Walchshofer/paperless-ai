# Core Concepts & Architecture

## Model Immutability

Guidance treats language models as immutable objects. Each operation creates a new state.

```python
import guidance
from guidance import models, system, user, assistant, gen

lm = models.OpenAI("gpt-4o-mini")

# Each operation creates NEW state
lm1 = lm + "Hello"          # New state
lm2 = lm + "Goodbye"        # Different new state
lm3 = lm1 + " World"        # Builds on lm1

# Both exist independently
print(lm1)    # "Hello World"
print(lm2)    # "Goodbye"
```

**Key principle**: Never try to modify in place. Always capture the return value.

## Chat Context Management

Use context blocks for multi-turn conversations:

```python
from guidance import system, user, assistant, gen

with system():
    lm = lm_model + "You are a helpful document management expert."

with user():
    lm += "How do I organize files?"

with assistant():
    lm += gen(name="response", max_tokens=200)

# Continue conversation
with user():
    lm += "Can you provide specific folder structures?"

with assistant():
    lm += gen(name="followup", max_tokens=300)
```

## Performance Optimizations

Guidance optimizes through:

| Optimization | Description |
|--------------|-------------|
| Token fast-forwarding | Predictable tokens inserted without forward passes |
| KV cache reuse | Incremental generation reuses computation |
| Constrained generation | Ensures valid output without fallback processing |

## Generation Parameters

```python
# Deterministic (classification/extraction)
gen(name="result", temperature=0.0, max_tokens=50)

# Low randomness (most tasks)
gen(name="result", temperature=0.3, max_tokens=100)

# Moderate randomness (summaries)
gen(name="result", temperature=0.7, max_tokens=200)

# Stop sequences
gen(name="result", max_tokens=500, stop=["---", "END", "\n\n"])
```

## Prompt Boundaries & Token Healing

Guidance handles tokenization artifacts automatically:

```python
# These generate correctly despite tokenization differences
lm + "Link: <a href=\"http:" + gen(max_tokens=20)
lm + "List: [" + gen(max_tokens=10)
lm + 'JSON: {"key": "' + gen(max_tokens=20)
```

## @guidance Decorator

Create reusable guidance functions:

```python
from guidance import guidance

@guidance
def extract_fields(lm, document: str):
    """Custom guidance function"""
    with system():
        lm += "Extract specific fields from documents."
    with user():
        lm += f"Extract from:\n{document}"
    with assistant():
        lm += "- Name: " + gen(name="name", max_tokens=30, stop="\n")
        lm += "\n- Date: " + gen(name="date", max_tokens=15, stop="\n")
    return lm

# Usage
result = model + extract_fields(document_content)
print(result["name"], result["date"])
```

## Stateless Functions

For composable grammars:

```python
@guidance(stateless=True)
def extract_email(lm):
    return lm + regex(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

@guidance(stateless=True)
def extract_phone(lm):
    return lm + regex(r"\+?1?\d{9,15}")
```

## Accessing Generated Values

Generated content is stored by name and accessible via dictionary syntax:

```python
with assistant():
    lm += "Type: " + gen(name="doc_type", max_tokens=20)
    lm += "\nPriority: " + select(options=["High", "Medium", "Low"], name="priority")

# Access results
doc_type = lm["doc_type"]
priority = lm["priority"]
```
