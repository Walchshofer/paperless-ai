## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Model artifacts policy

## Environment variables (local development)

- Keep `docker-compose.env` (repo root) as the authoritative source of truth for multi-container runs.
- To generate a legacy-compatible `.env` (for older `docker-compose` clients on Windows) run:

```bash
npm run env:sync  # generates ./ .env from docker-compose.env (or creates a safe CI fallback)
```

- To validate your environment locally:

```bash
npm run env:validate  # runs Python validator (scripts/validate_env_py.py)
```


Do not commit model binaries or Hugging Face cache artifacts to the repository. The canonical locations for runtime model caches are volumes or external storage (for example, Docker volumes like `visual_model_cache` or an artifact store).

- If you need to include small model metadata or pointers, add them to `docs/` and **do not** commit actual weights.
- The path `models/hf/` is blocked and must not be committed; a pre-commit hook and CI check will enforce this.
- If you accidentally committed large files, contact the maintainers; we may rewrite history to remove them.
