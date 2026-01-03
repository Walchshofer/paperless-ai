# DMS Implementation Patterns

## Document Classification

```python
from guidance import guidance, select, gen, system, user, assistant

@guidance
def dms_classification(lm, content: str):
    with system():
        lm += "You are a document routing specialist."
    with user():
        lm += f"Classify this document:\n{content[:500]}"
    with assistant():
        lm += "Document Type: " + select(
            options=["Invoice", "Contract", "Purchase Order", "Report", "Memo", "Other"],
            name="doc_type"
        )
        lm += "\nPriority: " + select(
            options=["High", "Medium", "Low"],
            name="priority"
        )
    return lm
```

## Field Extraction

```python
@guidance
def dms_extraction(lm, content: str):
    with system():
        lm += "Extract structured information from documents."
    with user():
        lm += f"Extract from:\n{content}"
    with assistant():
        lm += "Extracted Information:\n"
        lm += "- Sender/Recipient: " + gen(name="sender", max_tokens=50, stop="\n")
        lm += "\n- Amount: " + gen(name="amount", regex=r"\$?[\d,]+\.?\d*", stop="\n")
        lm += "\n- Date: " + gen(name="date", regex=r"\d{1,2}[-/]\d{1,2}[-/]\d{2,4}", stop="\n")
        lm += "\n- Action Required: " + gen(name="action", max_tokens=100)
    return lm
```

## Deep Analysis (Thinking Model)

```python
@guidance
def dms_analysis(lm, content: str, doc_type: str):
    with system():
        lm += f"Analyze {doc_type} documents thoroughly."
    with user():
        lm += f"Document:\n{content}"
    with assistant():
        if len(content) > 1000:
            lm += "<thinking>\n"
            lm += gen(name="deep_reasoning", max_tokens=2000, stop="</thinking>")
            lm += "\n</thinking>\n"
        
        lm += "Analysis:\n"
        lm += gen(name="key_points", max_tokens=500, temperature=0.3)
        lm += "\nRisk Assessment: " + select(options=["Low", "Medium", "High"], name="risk")
    return lm
```

## Multi-Model Client

```python
from enum import Enum
from typing import Dict

class TaskType(Enum):
    CLASSIFICATION = "classification"
    EXTRACTION = "extraction"
    REASONING = "reasoning"
    SUMMARIZATION = "summarization"
    ANALYSIS = "analysis"
    ROUTING = "routing"

class MultiModelDMSClient:
    def __init__(self):
        self.models: Dict[TaskType, LiteLLM] = {}
        self._initialize_models()
    
    def _initialize_models(self):
        thinking_config = {
            "model_name": "deepseek-r1",
            "litellm_params": {
                "model": "ollama/deepseek-r1",
                "api_base": "http://host.docker.internal:11434/v1",
                "api_key": "ollama",
            }
        }
        instruction_config = {
            "model_name": "neural-chat",
            "litellm_params": {
                "model": "ollama/neural-chat",
                "api_base": "http://host.docker.internal:11434/v1",
                "api_key": "ollama",
            }
        }
        
        self.models[TaskType.REASONING] = LiteLLM(model_description=thinking_config)
        self.models[TaskType.ANALYSIS] = LiteLLM(model_description=thinking_config)
        
        for task_type in [TaskType.CLASSIFICATION, TaskType.EXTRACTION, 
                          TaskType.SUMMARIZATION, TaskType.ROUTING]:
            self.models[task_type] = LiteLLM(model_description=instruction_config)
```

## Document Routing

```python
ROUTING_MAP = {
    "Invoice": "accounting",
    "Contract": "legal",
    "Purchase Order": "procurement",
    "Report": "management",
    "Memo": "general",
    "Other": "inbox"
}

PRIORITY_QUEUE = {"High": 1, "Medium": 2, "Low": 3}

async def route_document(doc_id: str, metadata: DocumentMetadata) -> Dict:
    destination = ROUTING_MAP.get(metadata.document_type, "inbox")
    priority = PRIORITY_QUEUE.get(metadata.priority, 3)
    
    return {
        "document_id": doc_id,
        "routed_to": destination,
        "priority": priority,
        "requires_approval": priority == 1
    }
```

## Approval Workflow

```python
from enum import Enum
from dataclasses import dataclass
from typing import Optional

class ApprovalStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REQUIRES_REVIEW = "requires_review"

@dataclass
class ApprovalRequest:
    document_id: str
    approver: str
    status: ApprovalStatus
    comments: Optional[str] = None

class DocumentWorkflow:
    def __init__(self):
        self.workflow_state: Dict[str, Dict] = {}
    
    async def require_approval(self, doc_id: str, approvers: List[str]) -> Dict:
        self.workflow_state[doc_id]["approvers"] = approvers
        self.workflow_state[doc_id]["status"] = "awaiting_approval"
        return {"document_id": doc_id, "pending_approvals": approvers}
    
    async def process_approval(self, approval: ApprovalRequest) -> Dict:
        workflow = self.workflow_state[approval.document_id]
        workflow["approvals"].append({
            "approver": approval.approver,
            "status": approval.status.value,
            "comments": approval.comments
        })
        
        if approval.status == ApprovalStatus.REJECTED:
            workflow["status"] = "rejected"
        elif all(app["status"] == "approved" for app in workflow["approvals"]):
            workflow["status"] = "approved"
        
        return workflow
```

## Caching Strategy

```python
import hashlib
from typing import Dict

class CachedDMSClient:
    def __init__(self, max_cache_size: int = 1000):
        self.cache: Dict[str, Dict] = {}
        self.max_cache_size = max_cache_size
    
    def _hash_content(self, content: str) -> str:
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    def classify_document_cached(self, content: str) -> str:
        content_hash = self._hash_content(content)
        cache_key = f"classification_{content_hash}"
        
        if cache_key in self.cache:
            return self.cache[cache_key]["result"]
        
        result = self.dms_client.classify_document(content)
        
        if len(self.cache) >= self.max_cache_size:
            oldest_key = next(iter(self.cache))
            del self.cache[oldest_key]
        
        self.cache[cache_key] = {"result": result, "timestamp": datetime.now()}
        return result
```

## Error Handling with Retry

```python
class ResilienceDMSClient:
    def __init__(self, max_retries: int = 3, timeout: float = 30.0):
        self.max_retries = max_retries
        self.timeout = timeout
    
    async def execute_with_retry(self, func, *args, **kwargs):
        last_exception = None
        
        for attempt in range(self.max_retries):
            try:
                result = await asyncio.wait_for(
                    asyncio.to_thread(func, *args, **kwargs),
                    timeout=self.timeout
                )
                return result
            except asyncio.TimeoutError:
                last_exception = Exception(f"Timeout after {self.timeout}s")
            except Exception as e:
                last_exception = e
            
            wait_time = 2 ** attempt
            await asyncio.sleep(wait_time)
        
        raise last_exception
    
    async def classify_with_fallback(self, content: str) -> str:
        try:
            return await self.execute_with_retry(
                self.dms_client.classify_document, content
            )
        except Exception:
            return "Other"  # Fallback
```

## FastAPI Integration

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class DocumentRequest(BaseModel):
    content: str
    title: str

@app.post("/api/documents/process")
async def process_document(request: DocumentRequest):
    try:
        classification_result = classification_model + dms_classification(request.content)
        extraction_result = extraction_model + dms_extraction(request.content)
        
        return {
            "classification": classification_result["doc_type"],
            "priority": classification_result["priority"],
            "extracted_fields": {
                "sender": extraction_result["sender"],
                "amount": extraction_result["amount"],
                "date": extraction_result["date"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```
