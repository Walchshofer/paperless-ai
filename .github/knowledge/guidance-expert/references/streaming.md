# Streaming Options

## Basic Streaming

```python
import asyncio
from guidance import system, user, assistant, gen

async def stream_document_analysis(lm_model, content: str):
    lm = lm_model
    
    with system():
        lm += "Analyze the document and provide real-time updates."
    with user():
        lm += f"Document:\n{content}"
    with assistant():
        lm += "Analysis:\n"
        lm += gen(name="analysis", max_tokens=500, temperature=0.3)
    
    return lm

# Consumer
async def process_streaming_output():
    async for output in stream_document_analysis(ollama_lm, doc_content):
        print(output, end="", flush=True)
```

## Streaming with Callbacks

```python
from typing import Callable, Optional

class StreamingCallback:
    def __init__(self, on_token: Optional[Callable] = None):
        self.on_token = on_token or self._default_handler
        self.buffer = []
    
    def _default_handler(self, token: str):
        print(token, end="", flush=True)
    
    async def process_stream(self, lm_generator):
        async for token in lm_generator:
            self.buffer.append(token)
            self.on_token(token)
        return "".join(self.buffer)

# Custom callback
def custom_callback(token: str):
    print(f"[TOKEN] {repr(token)}")

callback = StreamingCallback(on_token=custom_callback)
```

## Queue-Based Streaming

```python
from queue import Queue
import threading

class QueuedStreamer:
    def __init__(self, timeout: float = 30.0):
        self.out_queue = Queue()
        self.timeout = timeout
    
    def get_next_output(self):
        try:
            value = self.out_queue.get(timeout=self.timeout)
            if value is None:
                raise StopIteration()
            return value
        except:
            raise StopIteration()
    
    def __iter__(self):
        return self
    
    def __next__(self):
        return self.get_next_output()

def stream_then_save(streamer, thread):
    list_out = []
    for out in streamer:
        list_out.append(out)
        yield out
    thread.join()
```

## Streaming with Status Updates

```python
from enum import Enum
from dataclasses import dataclass
from typing import List

class StreamStatus(Enum):
    STARTED = "started"
    PROCESSING = "processing"
    COMPLETE = "complete"
    ERROR = "error"

@dataclass
class StreamEvent:
    status: StreamStatus
    content: str
    token_count: int = 0

async def stream_with_status(lm_model, content: str):
    events: List[StreamEvent] = []
    events.append(StreamEvent(status=StreamStatus.STARTED, content="", token_count=0))
    
    try:
        token_count = 0
        with system():
            lm_model += "Process this document."
        with user():
            lm_model += content
        with assistant():
            result = gen(name="result", max_tokens=1000, temperature=0.3)
            
            for char in str(result):
                token_count += 1
                events.append(StreamEvent(
                    status=StreamStatus.PROCESSING,
                    content=char,
                    token_count=token_count
                ))
                await asyncio.sleep(0.01)
        
        events.append(StreamEvent(status=StreamStatus.COMPLETE, content="", token_count=token_count))
    except Exception as e:
        events.append(StreamEvent(status=StreamStatus.ERROR, content=str(e), token_count=token_count))
    
    return events
```

## Buffered Streaming

```python
from collections import deque
import asyncio

class BufferedStreamer:
    def __init__(self, buffer_size: int = 10):
        self.buffer = deque(maxlen=buffer_size)
        self.lock = asyncio.Lock()
    
    async def add_token(self, token: str):
        async with self.lock:
            self.buffer.append(token)
    
    async def get_buffer(self) -> str:
        async with self.lock:
            content = "".join(self.buffer)
            self.buffer.clear()
            return content
    
    async def stream_and_buffer(self, lm_generator):
        async for token in lm_generator:
            await self.add_token(token)
            if len(self.buffer) >= self.buffer.maxlen:
                buffered = await self.get_buffer()
                await self.process_batch(buffered)
    
    async def process_batch(self, content: str):
        print(f"Processing batch: {len(content)} chars")
```

## Stream Event Consumer

```python
async def process_stream_events():
    events = await stream_with_status(ollama_lm, "Process this...")
    
    for event in events:
        match event.status:
            case StreamStatus.STARTED:
                print("Stream started...")
            case StreamStatus.PROCESSING:
                print(event.content, end="", flush=True)
            case StreamStatus.COMPLETE:
                print("\nStream complete!")
            case StreamStatus.ERROR:
                print(f"Error: {event.content}")
```
