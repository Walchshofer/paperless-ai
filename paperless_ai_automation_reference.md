
# Comprehensive Paperless-ngx API Documentation for AI Automation

I've gathered detailed API documentation to help you build AI-powered automation for Paperless-ngx. Here's everything you need:

---

## 📋 API Overview & Setup

### API Versioning
Always specify the API version in your requests to ensure compatibility:

* **Header:** `Accept: application/json; version=9`
* **Latest:** Version 9
* **Deprecation:** Version 1 year+ deprecation period
* **Check Version:** Check server version with custom headers `X-Api-Version` and `X-Version`

### Authentication Methods

#### Token Authentication (Recommended for AI/Automation)

```python
import requests

# Get token
response = requests.post('http://paperless-instance/api/token/', json={
    'username': 'your_username',
    'password': 'your_password'
})
token = response.json()['token']

# Use token in requests
headers = {
    'Authorization': f'Token {token}',
    'Accept': 'application/json; version=9'
}

```

#### Other Methods

* **Basic Authentication:** `Authorization: Basic base64(username:password)`
* **Session Authentication:** (Web UI only)
* **Remote User Authentication:** (SSO via reverse proxy)

---

## 🔍 Core Endpoints for AI Automation

### 1. Document Retrieval & Search

**Get All Documents (with filtering)**

```http
GET /api/documents/?query=search_term&page=1
GET /api/documents/?more_like_id=123
GET /api/documents/?custom_field_query=["field_name", "exact", "value"]

```

**Response Structure:**

```json
{
  "count": 31,
  "next": "http://localhost:8000/api/documents/?page=2",
  "previous": null,
  "results": [
    {
      "id": 123,
      "title": "Document Title",
      "content": "Document content text...",
      "correspondent": 1,
      "document_type": 2,
      "storage_path": 3,
      "tags": [1, 2, 3],
      "custom_fields": [...],
      "created": "2023-10-27",
      "__search_hit__": {
        "score": 0.343,
        "highlights": "text <span class=\"match\">Match</span> text",
        "rank": 23
      }
    }
  ]
}

```

### 2. Document Upload

```python
import requests

# Upload document with metadata
files = {'document': open('file.pdf', 'rb')}
data = {
    'title': 'My Document',
    'created': '2023-10-27',
    'correspondent': 1,   # ID of correspondent
    'document_type': 2,   # ID of document type
    'storage_path': 3,    # ID of storage path
    'tags': [1, 2],       # List of tag IDs
    'custom_fields': {
        'field_id_1': 'value1',
        'field_id_2': 'value2'
    }
}

response = requests.post(
    'http://paperless-instance/api/documents/post_document/',
    files=files,
    data=data,
    headers={'Authorization': f'Token {token}'}
)
task_id = response.json()['task_id']

```

### 3. Bulk Document Operations

```python
# Add tag to multiple documents
payload = {
    'documents': [1, 2, 3],
    'method': 'add_tag',
    'parameters': {'tag': 30}
}

# Set correspondent
payload = {
    'documents': [4, 5, 6],
    'method': 'set_correspondent',
    'parameters': {'correspondent': 15}
}

# Set document type
payload = {
    'documents': [7, 8, 9],
    'method': 'set_document_type',
    'parameters': {'document_type': 20}
}

# Modify custom fields
payload = {
    'documents': [32],
    'method': 'modify_custom_fields',
    'parameters': {
        'add_custom_fields': {
            'cf_1': 'value1',
            'cf_2': 'value2'
        },
        'remove_custom_fields': ['cf_3']
    }
}

# Reprocess documents
payload = {
    'documents': [19, 20, 21],
    'method': 'reprocess'
}

# Merge documents
payload = {
    'documents': [26, 27, 28],
    'method': 'merge',
    'parameters': {
        'metadata_document_id': 26,
        'delete_originals': True
    }
}

# Delete documents
payload = {
    'documents': [16, 17, 18],
    'method': 'delete'
}

# Execute Request
response = requests.post(
    'http://paperless-instance/api/documents/bulk_edit/',
    json=payload,
    headers={'Authorization': f'Token {token}', 'Accept': 'application/json; version=9'}
)

```

### 4. Custom Field Filtering (AI-Ready)

**Exact match**
`GET /api/documents/?custom_field_query=["customer", "exact", "bob"]`

**Range queries (dates, numbers)**
`GET /api/documents/?custom_field_query=["due", "range", ["2024-08-01", "2024-09-01"]]`

**In operator (for select fields)**
`GET /api/documents/?custom_field_query=["favorite_animal", "in", ["cat", "dog"]]`

**Boolean queries**
`GET /api/documents/?custom_field_query=["answered", "exact", true]`

**Check for null/empty**
`GET /api/documents/?custom_field_query=["OR", [["address", "isnull", true], ["address", "exact", ""]]]`

**Field existence check**
`GET /api/documents/?custom_field_query=["foo", "exists", false]`

**Document links**
`GET /api/documents/?custom_field_query=["references", "contains", [3, 7]]`

### 5. Search Autocomplete

```http
GET /api/search/autocomplete/?term=inv&limit=10

```

**Response:**

```json
["invoice", "inventory", "invalid", "investment"]

```

---

## 📊 Metadata Endpoints

**Get Metadata**

* `GET /api/tags/` | `GET /api/tags/{id}/`
* `GET /api/correspondents/` | `GET /api/correspondents/{id}/`
* `GET /api/document_types/` | `GET /api/document_types/{id}/`
* `GET /api/storage_paths/` | `GET /api/storage_paths/{id}/`
* `GET /api/custom_fields/` | `GET /api/custom_fields/{id}/`

**Create/Update Metadata**

```python
# Create new tag
response = requests.post(
    'http://paperless-instance/api/tags/',
    json={'name': 'Invoice', 'color': '#FF0000'},
    headers=headers
)

# Update correspondent
response = requests.patch(
    'http://paperless-instance/api/correspondents/{id}/',
    json={'name': 'Updated Name'},
    headers=headers
)

```

---

## 🔐 Permissions Management

**Bulk Edit Objects with Permissions**

```python
payload = {
    'objects': [1, 2, 3],
    'object_type': 'tags',  # or 'correspondents', 'document_types', 'storage_paths'
    'operation': 'set_permissions',
    'permissions': {
        'view': {'users': [1], 'groups': [2]},
        'change': {'users': [3]}
    },
    'merge': True  # Merge with existing permissions
}

response = requests.post(
    'http://paperless-instance/api/bulk_edit_objects/',
    json=payload,
    headers=headers
)

```

---

## 🤖 AI Automation Use Cases

### Use Case 1: Intelligent Document Classification

```python
# 1. Get untagged documents
response = requests.get(
    'http://paperless-instance/api/documents/?custom_field_query=["tags", "exact", ""]',
    headers=headers
)
docs = response.json()['results']

# 2. Process with AI (your classification model)
for doc in docs:
    # AI model analyzes content
    predicted_tags = ai_classifier.predict(doc['content'])
    predicted_correspondent = ai_correspondent_model.predict(doc['content'])
    
    # 3. Apply changes via bulk edit
    payload = {
        'documents': [doc['id']],
        'method': 'modify_tags',
        'parameters': {
            'add_tags': predicted_tags
        }
    }
    requests.post(
        'http://paperless-instance/api/documents/bulk_edit/',
        json=payload,
        headers=headers
    )

```

### Use Case 2: Automated Document Ingestion with AI Processing

```python
def process_document_with_ai(file_path, ai_model):
    # Extract text from document
    text = extract_text(file_path)
    
    # AI analysis
    analysis = ai_model.analyze(text)
    
    # Upload with AI-determined metadata
    files = {'document': open(file_path, 'rb')}
    data = {
        'title': analysis['title'],
        'correspondent': analysis['correspondent_id'],
        'document_type': analysis['doc_type_id'],
        'tags': analysis['tag_ids'],
        'created': analysis['date'],
        'custom_fields': analysis['custom_fields']
    }
    
    response = requests.post(
        'http://paperless-instance/api/documents/post_document/',
        files=files,
        data=data,
        headers=headers
    )
    return response.json()['task_id']

```

### Use Case 3: Smart Custom Field Population

```python
# Find documents with empty custom fields
response = requests.get(
    'http://paperless-instance/api/documents/?custom_field_query=["invoice_amount", "isnull", true]',
    headers=headers
)

for doc in response.json()['results']:
    # AI extracts data from document
    extracted_amount = ai_ocr.extract_amount(doc['id'])
    extracted_due_date = ai_ocr.extract_due_date(doc['id'])
    
    # Update custom fields
    payload = {
        'documents': [doc['id']],
        'method': 'modify_custom_fields',
        'parameters': {
            'add_custom_fields': {
                'invoice_amount': extracted_amount,
                'due_date': extracted_due_date
            }
        }
    }
    requests.post(
        'http://paperless-instance/api/documents/bulk_edit/',
        json=payload,
        headers=headers
    )

```

### Use Case 4: Intelligent Document Organization

```python
# Get recent documents
response = requests.get(
    'http://paperless-instance/api/documents/?ordering=-created&limit=50',
    headers=headers
)

for doc in response.json()['results']:
    # AI suggests storage path and correspondent
    suggested_storage = ai_org.get_storage_path(doc)
    suggested_correspondent = ai_org.get_correspondent(doc)
    
    # Bulk update with AI suggestions
    requests.post(
        'http://paperless-instance/api/documents/bulk_edit/',
        json={
            'documents': [doc['id']],
            'method': 'set_storage_path',
            'parameters': {'storage_path': suggested_storage}
        },
        headers=headers
    )

```

---

## 📈 API Version Changelog (Important for AI Integration)

* **v9:** Document `created` field is now a date (not datetime)
* **v8:** Document notes user field is simplified
* **v7:** Custom field select options return as array of objects
* **v6:** Task acknowledgement endpoint moved
* **v5:** Bulk deletion methods added
* **v4:** Workflows introduced (consumption templates refactored)
* **v3:** Permissions endpoints added
* **v2:** Tag color support added

---

## ⚙️ Performance Tips for AI Automation

1. **Use pagination for large queries:**
`GET /api/documents/?page=1&page_size=100`
2. **Batch operations:**
Process multiple documents in single requests via `bulk_edit`.
3. **Cache metadata:**
Store correspondent/tag/type IDs locally to avoid repeated lookups.
4. **Use appropriate filtering:**
Narrow searches with `custom_field_query` before processing.
5. **Handle task IDs:**
Document uploads return async task IDs for status tracking.

> This API documentation gives you complete control to build sophisticated AI automation workflows.
