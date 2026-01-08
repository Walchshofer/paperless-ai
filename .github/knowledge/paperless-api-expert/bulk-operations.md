# Bulk Document Operations

## Endpoint
- **POST** `/api/documents/bulk_edit/`

## Request shape
```json
{
  "documents": [123, 456],
  "method": "add_tag",
  "parameters": { "tag": 789 }
}
```

## Response shape
```json
{
  "details": [
    { "id": 123, "status": "success", "message": "..." },
    { "id": 456, "status": "error", "message": "..." }
  ]
}
```

## Supported methods and parameters
- `set_correspondent` → `{ "correspondent": <int> }`
- `set_document_type` → `{ "document_type": <int> }`
- `set_storage_path` → `{ "storage_path": <int> }`
- `add_tag` → `{ "tag": <int> }`
- `remove_tag` → `{ "tag": <int> }`
- `modify_tags` → `{ "add_tags": [..], "remove_tags": [..] }`
- `delete` → `{}` / omitted parameters
- `reprocess` → `{}` / omitted parameters
- `set_permissions` → `{ "set_permissions": <object>, "owner": <int>, "merge": <bool> }`
- `edit_pdf` → `{ "doc_ids": [...], "operations": [...] }`
- `merge` → `{ "metadata_document_id": <int>, "delete_originals": <bool> }`
- `split` → `{ "pages": [...], "delete_originals": <bool> }`
- `rotate` → `{ "degrees": <int> }`
- `delete_pages` → `{ "pages": [..] }`
- `modify_custom_fields` → `{ "add_custom_fields": ..., "remove_custom_fields": ... }`

## Operational constraints (recommended)
- Throttle bulk calls to ~1 request/second to reduce 429 risk.
- Always inspect `details[]` for per-document outcomes.
