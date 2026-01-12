Bridge service utilities

This package provides:
- `BridgeState` for runtime state and synchronization primitives
- `config` for environment-driven constants
- `logging` helpers that write to stderr only
- `main` entrypoint with graceful shutdown support

To run the bridge standalone:

    python -c "from services.bridge import main; exit(main.main())"

