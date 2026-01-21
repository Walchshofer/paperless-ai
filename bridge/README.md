# CODEX-Serena Bridge

Quick reference for starting the CODEX-Serena bridge locally from the repository root.

## Prerequisites ✅
- Python 3.10+ (or the Python version used by this repo)
- A virtual environment named `.venv` in the repository root (recommended)
- Bridge runtime deps installed: `bridge/requirements.txt`

---

## Quick start (Windows)

1. Open a terminal and change to the repository root:

```powershell
cd C:\Users\pwalc\MyApps\paperless-ai
```

2. Create and activate the `.venv` (if you don't have one):

- PowerShell:

```powershell
python -m venv .venv
& .venv\Scripts\Activate.ps1
```

- Command Prompt (cmd.exe):

```cmd
python -m venv .venv
.venv\Scripts\activate.bat
```

- Git Bash or WSL (Linux/macOS):

```bash
python -m venv .venv
# Linux/macOS
source .venv/bin/activate
# On Git Bash on Windows
source .venv/Scripts/activate
```

3. Install the bridge dependencies:

```bash
pip install -r bridge/requirements.txt
```

4. Start the bridge (from the repo root):

```bash
python bridge/codex-serena-bridge.py
```

Useful flags supported by the entrypoint:

- `--print-env` — print effective environment vars to stderr for diagnostics
- `--log-level <LEVEL>` — set `LOG_LEVEL` (e.g., `DEBUG`)
- `--log-file <PATH>` — set `CODEX_BRIDGE_LOG_FILE`

Examples:

```bash
# Print env to stderr
python bridge/codex-serena-bridge.py --print-env

# Start with debug logging and a log file
python bridge/codex-serena-bridge.py --log-level DEBUG --log-file ./logs/codex-bridge.log
```

---

## Notes & troubleshooting ⚠️
- The bridge is normally spawned by CODEX and communicates over STDIO; running it directly is useful for local development and debugging.
- If PowerShell refuses to run `Activate.ps1` because of execution policy, consult PowerShell docs or run with an appropriate execution policy for your user.
- Logs are written to the file configured by the `CODEX_BRIDGE_LOG_FILE` and a brief startup diagnostic is written to `LOG_FILE` on start.

---

If you want this README extended with troubleshooting steps, sample configs, or service supervision examples (systemd / Windows Service / Docker), tell me which you'd like and I will add them.