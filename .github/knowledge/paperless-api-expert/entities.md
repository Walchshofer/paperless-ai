# Entities (CRUD endpoints)

All follow the same pattern:
- **GET** list: `/api/<entity>/`
- **POST** create: `/api/<entity>/`
- **GET** detail: `/api/<entity>/{id}/`
- **PATCH** update: `/api/<entity>/{id}/`
- **DELETE** delete: `/api/<entity>/{id}/`

## Correspondents
- Entity: `correspondents`
- Fields: `name`, `match`, `matching_algorithm`, `is_insensitive`, `owner`, `set_permissions`

## Tags
- Entity: `tags`
- Fields: `name`, `color`, `text_color`, `owner`, `set_permissions`

## Document types
- Entity: `document_types`
- Fields: `name`, `owner`, `set_permissions`

## Storage paths
- Entity: `storage_paths`
- Fields: `name`, `path`, `owner`, `set_permissions`

## Custom fields
- Entity: `custom_fields`
- Fields: `name`, `field_type`, `owner`

## Saved views
- Entity: `saved_views`
- Fields: `name`, `show_on_dashboard`, `show_in_sidebar`

## Workflows
- Entity: `workflows`
- Trigger: **POST** `/api/workflows/{id}/trigger/`

## Mail integration
- `mail_accounts`, `mail_rules`
