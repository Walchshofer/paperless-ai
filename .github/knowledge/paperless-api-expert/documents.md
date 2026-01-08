# Documents

## List documents
- **GET** `/api/documents/`
- Pagination fields: `count`, `next`, `previous`, `results`

### Common query params
- `query={search_term}` full-text search
- `more_like_id={id}` similar docs
- `page={n}` (default 1)
- `page_size={n}` (default 25)
- `custom_field_query=[...]` custom field filter (JSON array)
- `ordering=-created` sort (prefix `-` for desc)

## Get document
- **GET** `/api/documents/{id}/`

## Update document metadata
- **PATCH** `/api/documents/{id}/`

## Delete document
- **DELETE** `/api/documents/{id}/`

## Upload (consume) document
- **POST** `/api/documents/post_document/`  
- Content type: `multipart/form-data`

### Multipart fields
- `document` (file, required)
- `title` (string)
- `created` (string) — may be date-only or datetime depending on API version/config
- `correspondent` (int)
- `document_type` (int)
- `storage_path` (int)
- `tags` (repeatable int fields)
- `archive_serial_number` (string)
- `custom_fields` (object/array)

### Upload response
Returns a `task_id` (async ingestion).

## Download (binary)
- **GET** `/api/documents/{id}/download/` (commonly available; confirm in your instance)
- Client must use binary mode (axios `arraybuffer`).
