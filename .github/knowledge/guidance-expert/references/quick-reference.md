# Guidance Quick Reference Card

## Core Imports
```python
from guidance import models, system, user, assistant, gen, select, guidance
from guidance.models import LiteLLM
```

## Generation Functions

| Function | Purpose | Example |
|----------|---------|---------|
| `gen()` | Free-form generation | `gen(name="output", max_tokens=100)` |
| `select()` | Choose from options | `select(options=["A","B","C"], name="choice")` |
| `regex()` | Pattern-constrained | `gen(name="email", regex=r"[a-z]+@[a-z]+\.[a-z]+")` |

## gen() Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | str | None | Key to store result |
| `max_tokens` | int | None | Maximum tokens to generate |
| `temperature` | float | 1.0 | Randomness (0.0=deterministic) |
| `stop` | str/list | None | Stop sequences |
| `regex` | str | None | Regex constraint |
| `tools` | list | None | Available tools |

## Temperature Guide
- `0.0` → Classification, extraction, factual
- `0.3` → Most tasks, balanced
- `0.7` → Creative, summaries
- `1.0` → Maximum creativity

## Common Patterns

### Basic Chat
```python
with system():
    lm += "System prompt"
with user():
    lm += "User message"
with assistant():
    lm += gen(name="response")
```

### Constrained Output
```python
lm += select(options=["Invoice", "Contract", "Report"], name="type")
lm += gen(name="amount", regex=r"\$[\d,]+\.?\d*")
```

### Thinking Model
```python
lm += "<thinking>\n"
lm += gen(name="reasoning", max_tokens=2000, stop="</thinking>")
lm += "\n</thinking>\n"
lm += gen(name="answer", max_tokens=300)
```

### Custom Function
```python
@guidance
def my_func(lm, input: str):
    with user():
        lm += input
    with assistant():
        lm += gen(name="output")
    return lm
```

## Regex Patterns

| Type | Pattern |
|------|---------|
| Email | `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}` |
| Phone | `\+?1?\d{9,15}` |
| Date | `\d{1,2}[-/]\d{1,2}[-/]\d{2,4}` |
| Amount | `\$?[\d,]+\.?\d*` |
| Choice | `(Option1\|Option2\|Option3)` |

## LiteLLM Config Template
```python
config = {
    "model_name": "neural-chat",
    "litellm_params": {
        "model": "ollama/neural-chat",
        "api_base": "http://host.docker.internal:11434/v1",
        "api_key": "ollama",
    }
}
lm = LiteLLM(model_description=config, echo=False)
```

## Model Selection

| Model | Use Case |
|-------|----------|
| `deepseek-r1` | Complex reasoning, analysis |
| `neural-chat` | Instructions, classification |
| `llama2` | General purpose |
| `orca-mini` | Fast, simple tasks |

## Error Handling
```python
try:
    result = await asyncio.wait_for(func(), timeout=30)
except asyncio.TimeoutError:
    result = fallback_value
except Exception:
    await asyncio.sleep(2 ** attempt)  # Exponential backoff
```

## Vector Search (pgvector)
```sql
-- Similarity search
SELECT id, title, 
       (content_vector <-> query_vector) as distance
FROM documents
ORDER BY distance
LIMIT 10;
```

## Common Mistakes

❌ `lm.add_text("...")` → ✅ `lm += "..."`
❌ `lm += gen()` without name → ✅ `lm += gen(name="output")`
❌ High temp for classification → ✅ `temperature=0.0`
❌ No context managers → ✅ `with system/user/assistant():`
❌ Modifying lm in place → ✅ `lm2 = lm + "..."`
