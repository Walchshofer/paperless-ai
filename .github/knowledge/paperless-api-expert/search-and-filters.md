# Search, autocomplete, and custom field filtering

## Autocomplete
- **GET** `/api/search/autocomplete/`
- Params:
  - `term` (required)
  - `limit` (default 10)
- Response: array of strings

## Full-text search
- **GET** `/api/documents/?query=<term>`

## Similar documents
- **GET** `/api/documents/?more_like_id=<id>`

## Custom field query (JSON array)
Send as query param `custom_field_query=["invoice_total","gte",1000]` (URL-encoded).

### Operators
- `exact` `["customer","exact","bob"]`
- `in` `["animal","in",["cat","dog"]]`
- `isnull` `["address","isnull",true]`
- `exists` `["foo","exists",false]`
- `icontains` `["name","icontains","test"]`
- `istartswith` `["name","istartswith","t"]`
- `iendswith` `["name","iendswith","t"]`
- `gt` `["age","gt",18]`
- `gte` `["age","gte",18]`
- `lt` `["age","lt",65]`
- `lte` `["age","lte",65]`
- `range` `["due","range",["2024-08-01","2024-09-01"]]`
- `contains` `["references","contains",[3,7]]`
