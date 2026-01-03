# Functions, Tools & Grammars

## Basic Function Definition

```python
from guidance import guidance, system, user, assistant, gen

@guidance
def extract_fields(lm, document: str):
    with system():
        lm += "Extract specific fields from documents."
    with user():
        lm += f"Extract from:\n{document}"
    with assistant():
        lm += "Fields found:\n"
        lm += "- Name: " + gen(name="name", max_tokens=30, stop="\n")
        lm += "\n- Date: " + gen(name="date", max_tokens=15, stop="\n")
        lm += "\n- Amount: " + gen(name="amount", max_tokens=15)
    return lm

# Usage
result = ollama_lm + extract_fields(document_content)
print(result["name"], result["date"], result["amount"])
```

## Tool Definition with Pydantic

```python
from guidance import Tool, gen
from pydantic import BaseModel

class DocumentLookupParams(BaseModel):
    document_id: str
    field_type: str = "metadata"

def lookup_document(document_id: str, field_type: str = "metadata"):
    docs = {
        "DOC001": {"type": "Invoice", "date": "2024-01-15"},
    }
    return f"Document {document_id}: {docs.get(document_id, {}).get(field_type, 'Not found')}"

# Create tool from callable
doc_lookup_tool = Tool.from_callable(
    lookup_document,
    name="lookup_document",
    description="Lookup document information from DMS by ID"
)
```

## Tool from Regex Pattern

```python
email_pattern = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"

def validate_email(email: str):
    return f"Valid email found: {email}"

email_tool = Tool.from_regex(
    pattern=email_pattern,
    callable=validate_email,
    name="email_extractor",
    description="Extract and validate email addresses"
)
```

## Using Tools in Generation

```python
@guidance
def document_with_tools(lm, doc_id: str):
    with system():
        lm += "You are a document retrieval assistant."
    with user():
        lm += f"Get information for {doc_id}"
    with assistant():
        lm += gen(
            name="result",
            tools=[doc_lookup_tool],
            max_tokens=100
        )
    return lm
```

## Composable Grammar Functions

```python
from guidance import guidance, select, gen, regex
from guidance.library import one_or_more, capture, with_temperature

@guidance(stateless=True)
def _extract_email(lm):
    return lm + regex(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

@guidance(stateless=True)
def _extract_phone(lm):
    return lm + regex(r"\+?1?\d{9,15}")

@guidance(stateless=True)
def _extract_date(lm):
    return lm + regex(r"\d{1,2}[-/]\d{1,2}[-/]\d{2,4}")

@guidance(stateless=True)
def extract_contact_info(lm, temperature: float = 0.0):
    with with_temperature(temperature=temperature):
        lm += "Email: " + _extract_email() + "\n"
        lm += "Phone: " + _extract_phone() + "\n"
        lm += "Date: " + _extract_date()
    return lm
```

## Conditional Logic

```python
from guidance import guidance, select, gen, if_, else_

@guidance
def document_classification_with_logic(lm, content: str):
    with system():
        lm += "You are a document classifier."
    with user():
        lm += f"Classify this document:\n{content}"
    with assistant():
        doc_type = gen(
            name="doc_type",
            regex="(Invoice|Contract|Report|Memo|Other)",
            max_tokens=10
        )
        lm += f"Type: {doc_type}"
        
        with if_(lm, lambda lm: "Invoice" in lm["doc_type"]):
            lm += "\nAction: Route to Accounting"
        
        with elif_(lm, lambda lm: "Contract" in lm["doc_type"]):
            lm += "\nAction: Route to Legal"
        
        with else_(lm):
            lm += "\nAction: Route to General Filing"
    
    return lm
```

## Common Regex Patterns

| Field | Pattern |
|-------|---------|
| Email | `r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"` |
| Phone | `r"\+?1?\d{9,15}"` |
| Date | `r"\d{1,2}[-/]\d{1,2}[-/]\d{2,4}"` |
| Amount | `r"\$?[\d,]+\.?\d*"` |
| UUID | `r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"` |
| URL | `r"https?://[^\s]+"` |

## Structured JSON Output

```python
from guidance import json as guidance_json

@guidance
def structured_generation(lm, prompt: str, schema: dict):
    with user():
        lm += prompt
    with assistant():
        lm += guidance_json(schema=schema, name="output")
    return lm

# Usage
schema = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "age": {"type": "integer"}
    }
}
result = model + structured_generation("Extract person info", schema)
```

## Multi-Role Analysis

```python
@guidance
def multi_role_analysis(lm, query: str):
    with system():
        lm += """You are an expert document management system.
        Analyze documents with precision and clarity."""
    with user():
        lm += f"Please analyze: {query}"
    with assistant():
        lm += "I'll analyze this in steps:\n"
        lm += "1. Document Type: " + gen(name="doc_type", max_tokens=20, stop="\n")
        lm += "\n2. Key Information: " + gen(name="key_info", max_tokens=100, stop="\n")
        lm += "\n3. Recommended Action: " + gen(name="action", max_tokens=50)
    return lm
```
