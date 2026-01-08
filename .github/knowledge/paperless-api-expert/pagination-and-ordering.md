# Pagination and ordering

## Pagination params
- `page` (default 1)
- `page_size` (default 25)
- `limit` (alias of page_size in some clients)
- `offset` (skip items; not always supported on all endpoints)

## Pagination response fields
- `count`, `next`, `previous`, `results`

## Ordering
- `ordering=created` ascending
- `ordering=-created` descending
- Multiple: `ordering=-created,title`

Common sortable fields:
`id, title, created, added, modified, page_count, correspondent, document_type, storage_path, name, score`
