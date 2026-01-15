#!/usr/bin/env python3
"""Non-interactive comprehensive validation runner for Bridge v4.0

Runs unit, integration, e2e and stdio tests against local Serena (no interactive prompts)
Generates a markdown report in test/output/.
"""

from __future__ import annotations
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
import shutil
import textwrap
from typing import Dict, List, Optional, Tuple

# Prefer requests for simple HTTP; fallback to urllib
try:
    import requests
except Exception:
    requests = None

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "test" / "output"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SERENA_BASE = os.environ.get("SERENA_BASE", "http://127.0.0.1:9121")


def run_cmd(
    cmd: List[str],
    capture: bool = True,
    check: bool = False,
    env: Optional[Dict[str, str]] = None,
) -> Tuple[int, str]:
    print(f"$ {' '.join(cmd)}")
    result = subprocess.run(cmd, stdout=subprocess.PIPE if capture else None, stderr=subprocess.STDOUT, env=env, text=True)
    if capture:
        print(result.stdout)
    if check and result.returncode != 0:
        raise subprocess.CalledProcessError(result.returncode, cmd, output=result.stdout)
    return result.returncode, result.stdout if capture else ""


def is_serena_up(url: str) -> bool:
    test_url = url.rstrip("/") + "/sse"
    try:
        if requests:
            r = requests.get(test_url, timeout=2)
            return r.status_code == 200
        else:
            from urllib.request import urlopen
            with urlopen(test_url, timeout=2) as f:
                return f.status == 200
    except Exception:
        return False


def main(non_interactive: bool = True) -> int:
    start = datetime.utcnow()
    report_file = OUT_DIR / f"bridge_validation_report_{start.strftime('%Y%m%d_%H%M%S')}.md"

    print("=== Bridge v4.0 Comprehensive Validation ===")
    print()

    # Ensure test stubs not used
    os.environ.pop("BRIDGE_TEST_STUBS", None)
    print("[OK] Test stubs disabled (using real MCP SDK)")

    # Check Serena
    serena_up = is_serena_up(SERENA_BASE)
    if serena_up:
        print(f"[OK] Serena is running at {SERENA_BASE}")
    else:
        print(f"[WARN] Serena is not responding at {SERENA_BASE}")

    # Phase 1: Unit tests
    print("\n[1/6] Running unit tests...")
    unit_code, unit_out = run_cmd([sys.executable, "-m", "pytest", "test/unit/", "-v", "--tb=short", "--junitxml=test/output/unit_results.xml"])

    # Phase 2: Integration tests
    if serena_up:
        print("\n[2/6] Running integration tests...")
        env = os.environ.copy()
        env["SERENA_BASE"] = SERENA_BASE
        integration_code, integration_out = run_cmd([sys.executable, "-m", "pytest", "test/integration/", "-v", "--tb=short", "--junitxml=test/output/integration_results.xml"], env=env)
    else:
        print("\n[2/6] Skipping integration tests because Serena is not running")
        integration_code, integration_out = 2, "Serena not running"

    # Phase 3: E2E tests
    if serena_up:
        print("\n[3/6] Running E2E tests...")
        env = os.environ.copy()
        env["SERENA_BASE"] = SERENA_BASE
        # Set SERENA_E2E so E2E test guards run the suite when Serena is reachable
        env["SERENA_E2E"] = "1"
        e2e_code, e2e_out = run_cmd([sys.executable, "-m", "pytest", "test/e2e/test_serena_e2e.py", "-v", "--tb=short", "--junitxml=test/output/e2e_results.xml"], env=env)
    else:
        print("\n[3/6] Skipping E2E tests because Serena is not running")
        e2e_code, e2e_out = 2, "Serena not running"

    # Phase 4: STDIO test
    print("\n[4/6] Testing STDIO protocol...")
    stdio_code, stdio_out = run_cmd([sys.executable, "bridge/testscripts/test_stdin_lifecycle.py"])

    # Phase 5: CODEX integration (manual)
    print("\n[5/6] CODEX integration: manual verification recommended.\n  Start CODEX and verify 'codex-serena' shows as Connected.")
    # In non-interactive mode, leave CODEX verification neutral (manual) and exclude it from automated success criteria
    codex_verified = None
    if not non_interactive:
        resp = input("CODEX integration verified? (y/n): ")
        codex_verified = resp.strip().lower().startswith("y")

    # Phase 6: Report
    end = datetime.utcnow()
    duration = end - start

    def status(code):
        if code == 0:
            return "PASS"
        if code == 2:
            return "SKIPPED"
        return "FAIL"

    md = textwrap.dedent(f"""
    # Bridge v4.0 Comprehensive Validation Report

    **Date:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC
    **Duration:** {duration.total_seconds():.0f} seconds
    **Serena:** {SERENA_BASE}
    **Bridge Version:** 4.0

    ## Test Execution Summary

    | Test Suite | Status | Exit Code |
    |------------|--------|-----------|
    | Unit Tests | {status(unit_code)} | {unit_code} |
    | Integration Tests | {status(integration_code)} | {integration_code} |
    | E2E Tests | {status(e2e_code)} | {e2e_code} |
    | STDIO Protocol | {status(stdio_code)} | {stdio_code} |
    | CODEX Integration | {(('PASS' if codex_verified is True else ('FAIL' if codex_verified is False else 'MANUAL')))} | Manual |

    ## Overall Result

    {('**ALL TESTS PASSED** - Bridge v4.0 is production-ready' if (unit_code==0 and integration_code==0 and e2e_code==0 and stdio_code==0 and (codex_verified is True or non_interactive)) else '**SOME TESTS FAILED** - Review failures and create fix tickets')}

    ## Detailed Results

    ### Unit Tests
    ```
    {unit_out}
    ```

    ### Integration Tests
    ```
    {integration_out}
    ```

    ### E2E Tests
    ```
    {e2e_out}
    ```

    ### STDIO Protocol Test
    ```
    {stdio_out}
    ```

    ## Next Steps

    {('- Deploy bridge to production\n- Update CODEX configuration\n- Monitor bridge_debug.log for issues\n- Consider changing LOG_LEVEL to INFO for production' if unit_code==0 and integration_code==0 and e2e_code==0 and stdio_code==0 and codex_verified else '- Review test failures\n- Create tickets for bug fixes\n- Re-run validation after fixes')}
    """)

    report_file.write_text(md, encoding="utf8")
    print(f"[OK] Report generated: {report_file}")
    # Print short summary
    print("\n=== Short Summary ===")
    print(f"Unit: {status(unit_code)} ({unit_code})")
    print(f"Integration: {status(integration_code)} ({integration_code})")
    print(f"E2E: {status(e2e_code)} ({e2e_code})")
    print(f"STDIO: {status(stdio_code)} ({stdio_code})")
    def codex_status_label(val):
        return 'PASS' if val is True else ('FAIL' if val is False else 'MANUAL')

    print(f"CODEX Integration: {codex_status_label(codex_verified)}")

    # Compute overall success: in non-interactive mode, CODEX verification is considered manual/neutral
    if non_interactive:
        success = (unit_code == 0 and integration_code == 0 and e2e_code == 0 and stdio_code == 0)
    else:
        success = (unit_code == 0 and integration_code == 0 and e2e_code == 0 and stdio_code == 0 and codex_verified is True)

    return 0 if success else 1


if __name__ == "__main__":
    non_interactive = True
    if "--interactive" in sys.argv or "-i" in sys.argv:
        non_interactive = False
    rc = main(non_interactive=non_interactive)
    sys.exit(rc)
