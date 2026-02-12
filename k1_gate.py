#!/usr/bin/env python3
"""
k1_gate.py — Python mandatory pre-deploy gate (single-file)

RULES:
- Deploy is allowed ONLY after running:  python k1_gate.py
- You MUST attach proof artifacts produced by this script:
  - gate_report.json
  - file_err.txt
- If this script exits NON-ZERO => DEPLOY IS FORBIDDEN.

ORDER (cannot be skipped):
1) create/activate venv
2) install locked deps (pip-sync OR poetry install)
3) ruff format --check AND ruff check
4) mypy typecheck
5) pytest
6) pip-audit security scan
7) produce gate_report.json and file_err.txt

Optional env toggles (safe defaults):
- K1_FIX=1                 -> attempt auto-fix (ruff format + ruff --fix) then re-check
- K1_BRANCH_CLEAN=1        -> cleanup merged local git branches (never deletes remote branches)
- K1_RUN_PLAYWRIGHT=1      -> run Playwright E2E marker if you have it configured (pytest -m e2e)
"""

from __future__ import annotations

import json
import os
import platform
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

ROOT = Path(__file__).resolve().parent
ART_REPORT = ROOT / "gate_report.json"
ART_LOG = ROOT / "file_err.txt"
VENV_DIR = ROOT / ".venv"


@dataclass
class StepResult:
    name: str
    ok: bool
    skipped: bool
    cmd: List[str]
    cwd: str
    exit_code: int
    seconds: float
    note: str


def _now() -> float:
    return time.time()


def _write_log_append(text: str) -> None:
    ART_LOG.parent.mkdir(parents=True, exist_ok=True)
    with ART_LOG.open("a", encoding="utf-8", errors="replace") as f:
        f.write(text)


def _run(cmd: List[str], cwd: Path, env: Dict[str, str], step_name: str) -> Tuple[int, float, str]:
    start = _now()
    p = subprocess.run(
        cmd,
        cwd=str(cwd),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    elapsed = _now() - start
    out = (p.stdout or "") + (p.stderr or "")
    header = f"\n\n===== STEP: {step_name} =====\nCMD: {' '.join(cmd)}\nCWD: {cwd}\nEXIT: {p.returncode}\n"
    _write_log_append(header + out)
    return p.returncode, elapsed, out


def _is_windows() -> bool:
    return platform.system().lower().startswith("win")


def _venv_python() -> Path:
    if _is_windows():
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"


def _ensure_clean_artifacts() -> None:
    for p in [ART_REPORT, ART_LOG]:
        try:
            if p.exists():
                p.unlink()
        except Exception:
            pass
    _write_log_append("K1_GATE START\n")


def _create_venv(env: Dict[str, str]) -> StepResult:
    name = "1) create/activate venv"
    cmd = [sys.executable, "-m", "venv", str(VENV_DIR)]
    if VENV_DIR.exists() and _venv_python().exists():
        # Reuse existing venv; still treat as ok.
        return StepResult(name=name, ok=True, skipped=False, cmd=cmd, cwd=str(ROOT), exit_code=0, seconds=0.0, note="venv already exists")
    code, secs, _ = _run(cmd, ROOT, env, name)
    ok = code == 0 and _venv_python().exists()
    note = "created" if ok else "failed to create venv"
    return StepResult(name=name, ok=ok, skipped=False, cmd=cmd, cwd=str(ROOT), exit_code=code, seconds=secs, note=note)


def _pip_upgrade(env: Dict[str, str]) -> StepResult:
    name = "1.1) upgrade pip/setuptools/wheel"
    py = str(_venv_python())
    cmd = [py, "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"]
    code, secs, _ = _run(cmd, ROOT, env, name)
    return StepResult(name=name, ok=(code == 0), skipped=False, cmd=cmd, cwd=str(ROOT), exit_code=code, seconds=secs, note="ok" if code == 0 else "pip upgrade failed")


def _detect_lock_strategy() -> Tuple[str, Optional[Path]]:
    # Strategy priority:
    # 1) Poetry: pyproject.toml + poetry.lock
    # 2) Pip-tools: requirements.lock (or requirements.txt + requirements.lock)
    pyproject = ROOT / "pyproject.toml"
    poetry_lock = ROOT / "poetry.lock"
    if pyproject.exists() and poetry_lock.exists():
        return "poetry", poetry_lock

    req_lock = ROOT / "requirements.lock"
    if req_lock.exists():
        return "pip-sync", req_lock

    # Common alternative lock filenames
    req_txt = ROOT / "requirements.txt"
    req_frozen = ROOT / "requirements-frozen.txt"
    if req_frozen.exists():
        return "pip-sync", req_frozen

    # No lock found
    if req_txt.exists():
        return "no-lock-found", req_txt
    return "no-lock-found", None


def _install_locked_deps(env: Dict[str, str]) -> StepResult:
    name = "2) install locked deps (lock-only)"
    py = str(_venv_python())
    strategy, lockfile = _detect_lock_strategy()

    if strategy == "poetry":
        # Use poetry install --sync to match lock
        # Poetry must be available (either in system or in venv). We'll install it in venv if missing.
        cmd_install_poetry = [py, "-m", "pip", "install", "poetry"]
        code1, secs1, _ = _run(cmd_install_poetry, ROOT, env, name + " [install poetry]")
        if code1 != 0:
            return StepResult(name=name, ok=False, skipped=False, cmd=cmd_install_poetry, cwd=str(ROOT), exit_code=code1, seconds=secs1, note="failed to install poetry")

        cmd = [py, "-m", "poetry", "install", "--no-interaction", "--sync"]
        code2, secs2, _ = _run(cmd, ROOT, env, name + " [poetry install --sync]")
        ok = code2 == 0
        return StepResult(name=name, ok=ok, skipped=False, cmd=cmd, cwd=str(ROOT), exit_code=code2, seconds=secs1 + secs2, note=f"strategy=poetry lock={lockfile.name if lockfile else 'unknown'}")

    if strategy == "pip-sync":
        # pip-tools provides pip-sync; we install pip-tools then sync from lock
        if lockfile is None:
            return StepResult(name=name, ok=False, skipped=False, cmd=[], cwd=str(ROOT), exit_code=2, seconds=0.0, note="lockfile missing unexpectedly")
        cmd_install = [py, "-m", "pip", "install", "pip-tools"]
        code1, secs1, _ = _run(cmd_install, ROOT, env, name + " [install pip-tools]")
        if code1 != 0:
            return StepResult(name=name, ok=False, skipped=False, cmd=cmd_install, cwd=str(ROOT), exit_code=code1, seconds=secs1, note="failed to install pip-tools")
        cmd = [py, "-m", "piptools", "sync", str(lockfile)]
        code2, secs2, _ = _run(cmd, ROOT, env, name + " [pip-sync lock]")
        ok = code2 == 0
        return StepResult(name=name, ok=ok, skipped=False, cmd=cmd, cwd=str(ROOT), exit_code=code2, seconds=secs1 + secs2, note=f"strategy=pip-sync lock={lockfile.name}")

    # Strict policy: lock is required.
    note = "FAIL: no lock file found. Create poetry.lock or requirements.lock (pip-tools) and rerun."
    cmd = [py, "-m", "pip", "install", "-r", str(lockfile)] if lockfile else []
    return StepResult(name=name, ok=False, skipped=False, cmd=cmd, cwd=str(ROOT), exit_code=2, seconds=0.0, note=note)


def _maybe_auto_fix(env: Dict[str, str]) -> StepResult:
    name = "2.9) optional auto-fix (ruff format + ruff --fix)"
    if os.getenv("K1_FIX", "0") != "1":
        return StepResult(name=name, ok=True, skipped=True, cmd=[], cwd=str(ROOT), exit_code=0, seconds=0.0, note="skipped (set K1_FIX=1 to enable)")
    py = str(_venv_python())
    # Run ruff format and ruff check --fix (best-effort; if it fails, gate fails)
    cmd1 = [py, "-m", "ruff", "format", "."]
    c1, s1, _ = _run(cmd1, ROOT, env, name + " [ruff format]")
    if c1 != 0:
        return StepResult(name=name, ok=False, skipped=False, cmd=cmd1, cwd=str(ROOT), exit_code=c1, seconds=s1, note="ruff format failed")
    cmd2 = [py, "-m", "ruff", "check", ".", "--fix"]
    c2, s2, _ = _run(cmd2, ROOT, env, name + " [ruff check --fix]")
    ok = (c2 == 0)
    return StepResult(name=name, ok=ok, skipped=False, cmd=cmd2, cwd=str(ROOT), exit_code=c2, seconds=s1 + s2, note="auto-fix attempted")


def _ruff_checks(env: Dict[str, str]) -> List[StepResult]:
    py = str(_venv_python())

    r1_name = "3) ruff format --check"
    cmd1 = [py, "-m", "ruff", "format", "--check", "."]
    c1, s1, _ = _run(cmd1, ROOT, env, r1_name)
    r1 = StepResult(name=r1_name, ok=(c1 == 0), skipped=False, cmd=cmd1, cwd=str(ROOT), exit_code=c1, seconds=s1, note="ok" if c1 == 0 else "format issues")

    r2_name = "3.1) ruff check"
    cmd2 = [py, "-m", "ruff", "check", "."]
    c2, s2, _ = _run(cmd2, ROOT, env, r2_name)
    r2 = StepResult(name=r2_name, ok=(c2 == 0), skipped=False, cmd=cmd2, cwd=str(ROOT), exit_code=c2, seconds=s2, note="ok" if c2 == 0 else "lint issues")
    return [r1, r2]


def _mypy(env: Dict[str, str]) -> StepResult:
    name = "4) mypy typecheck"
    py = str(_venv_python())
    cmd = [py, "-m", "mypy", "."]
    c, s, _ = _run(cmd, ROOT, env, name)
    return StepResult(name=name, ok=(c == 0), skipped=False, cmd=cmd, cwd=str(ROOT), exit_code=c, seconds=s, note="ok" if c == 0 else "type errors")


def _pytest(env: Dict[str, str]) -> StepResult:
    name = "5) pytest"
    py = str(_venv_python())
    cmd = [py, "-m", "pytest", "-q"]
    c, s, _ = _run(cmd, ROOT, env, name)
    return StepResult(name=name, ok=(c == 0), skipped=False, cmd=cmd, cwd=str(ROOT), exit_code=c, seconds=s, note="ok" if c == 0 else "test failures")


def _pip_audit(env: Dict[str, str]) -> StepResult:
    name = "6) pip-audit security scan"
    py = str(_venv_python())
    # prefer module invocation; fallback to pip-audit if needed
    cmd = [py, "-m", "pip_audit"]
    c, s, out = _run(cmd, ROOT, env, name + " [python -m pip_audit]")
    if c == 0:
        return StepResult(name=name, ok=True, skipped=False, cmd=cmd, cwd=str(ROOT), exit_code=c, seconds=s, note="ok")
    # fallback
    cmd2 = ["pip-audit"]
    c2, s2, _ = _run(cmd2, ROOT, env, name + " [pip-audit]")
    ok = (c2 == 0)
    note = "ok" if ok else "vulnerabilities found or tool missing"
    return StepResult(name=name, ok=ok, skipped=False, cmd=cmd2, cwd=str(ROOT), exit_code=c2, seconds=s + s2, note=note)


def _git_branch_cleanup(env: Dict[str, str]) -> StepResult:
    name = "7) branch cleanup (local merged branches)"
    if os.getenv("K1_BRANCH_CLEAN", "0") != "1":
        return StepResult(name=name, ok=True, skipped=True, cmd=[], cwd=str(ROOT), exit_code=0, seconds=0.0, note="skipped (set K1_BRANCH_CLEAN=1 to enable)")

    if shutil.which("git") is None or not (ROOT / ".git").exists():
        return StepResult(name=name, ok=True, skipped=True, cmd=[], cwd=str(ROOT), exit_code=0, seconds=0.0, note="skipped (no git repo)")

    # fetch prune
    cmd1 = ["git", "fetch", "--prune"]
    c1, s1, _ = _run(cmd1, ROOT, env, name + " [git fetch --prune]")
    if c1 != 0:
        return StepResult(name=name, ok=False, skipped=False, cmd=cmd1, cwd=str(ROOT), exit_code=c1, seconds=s1, note="git fetch failed")

    # determine current branch
    cmd_cur = ["git", "rev-parse", "--abbrev-ref", "HEAD"]
    ccur, scur, out = _run(cmd_cur, ROOT, env, name + " [current branch]")
    if ccur != 0:
        return StepResult(name=name, ok=False, skipped=False, cmd=cmd_cur, cwd=str(ROOT), exit_code=ccur, seconds=scur, note="cannot detect current branch")
    current = (out.strip().splitlines()[-1] if out.strip() else "HEAD").strip()

    # list merged branches
    cmd_list = ["git", "branch", "--merged"]
    cl, sl, out2 = _run(cmd_list, ROOT, env, name + " [list merged]")
    if cl != 0:
        return StepResult(name=name, ok=False, skipped=False, cmd=cmd_list, cwd=str(ROOT), exit_code=cl, seconds=sl, note="cannot list merged branches")

    protected = {"main", "master", "develop", current}
    merged = []
    for line in out2.splitlines():
        b = line.replace("*", "").strip()
        if not b:
            continue
        if b in protected:
            continue
        merged.append(b)

    # delete merged (safe delete -d)
    ok_all = True
    total_secs = s1 + scur + sl
    for b in merged:
        cmd_del = ["git", "branch", "-d", b]
        cd, sd, _ = _run(cmd_del, ROOT, env, name + f" [delete {b}]")
        total_secs += sd
        if cd != 0:
            ok_all = False

    note = f"deleted={len(merged)} protected={sorted(list(protected))}"
    return StepResult(name=name, ok=ok_all, skipped=False, cmd=["git", "branch", "-d", "<merged>"], cwd=str(ROOT), exit_code=(0 if ok_all else 1), seconds=total_secs, note=note)


def _playwright_e2e(env: Dict[str, str]) -> StepResult:
    name = "8) Playwright E2E (pytest -m e2e)"
    if os.getenv("K1_RUN_PLAYWRIGHT", "0") != "1":
        return StepResult(name=name, ok=True, skipped=True, cmd=[], cwd=str(ROOT), exit_code=0, seconds=0.0, note="skipped (set K1_RUN_PLAYWRIGHT=1 to enable)")
    py = str(_venv_python())
    # Assumes you tagged E2E with marker 'e2e' and configured Playwright in your project.
    cmd = [py, "-m", "pytest", "-q", "-m", "e2e"]
    c, s, _ = _run(cmd, ROOT, env, name)
    return StepResult(name=name, ok=(c == 0), skipped=False, cmd=cmd, cwd=str(ROOT), exit_code=c, seconds=s, note="ok" if c == 0 else "E2E failures")


def main() -> int:
    _ensure_clean_artifacts()

    env = dict(os.environ)
    env["PYTHONUNBUFFERED"] = "1"

    report: Dict[str, Any] = {
        "tool": "k1_gate.py",
        "started_at_unix": int(_now()),
        "root": str(ROOT),
        "python": sys.executable,
        "platform": platform.platform(),
        "env_flags": {
            "K1_FIX": os.getenv("K1_FIX", "0"),
            "K1_BRANCH_CLEAN": os.getenv("K1_BRANCH_CLEAN", "0"),
            "K1_RUN_PLAYWRIGHT": os.getenv("K1_RUN_PLAYWRIGHT", "0"),
        },
        "steps": [],
        "pass_criteria": {
            "exit_code": 0,
            "zero_test_failures": True,
            "zero_lint_type_errors": True,
            "lock_only_deps": True,
            "reports_saved": True,
        },
    }

    steps: List[StepResult] = []

    # 1) venv
    s = _create_venv(env)
    steps.append(s)
    if not s.ok:
        return _finalize(report, steps, exit_code=1)

    # 1.1) pip upgrade
    s = _pip_upgrade(env)
    steps.append(s)
    if not s.ok:
        return _finalize(report, steps, exit_code=1)

    # 2) locked deps
    s = _install_locked_deps(env)
    steps.append(s)
    if not s.ok:
        return _finalize(report, steps, exit_code=1)

    # optional auto-fix then checks
    steps.append(_maybe_auto_fix(env))

    # 3) ruff checks
    steps.extend(_ruff_checks(env))
    if any((st.name.startswith("3)") or st.name.startswith("3.1)")) and (not st.ok) for st in steps):
        return _finalize(report, steps, exit_code=1)

    # 4) mypy
    s = _mypy(env)
    steps.append(s)
    if not s.ok:
        return _finalize(report, steps, exit_code=1)

    # 5) pytest
    s = _pytest(env)
    steps.append(s)
    if not s.ok:
        return _finalize(report, steps, exit_code=1)

    # 6) pip-audit
    s = _pip_audit(env)
    steps.append(s)
    if not s.ok:
        return _finalize(report, steps, exit_code=1)

    # 7) branch cleanup (optional)
    steps.append(_git_branch_cleanup(env))

    # 8) Playwright E2E (optional)
    steps.append(_playwright_e2e(env))

    return _finalize(report, steps, exit_code=0)


def _finalize(report: Dict[str, Any], steps: List[StepResult], exit_code: int) -> int:
    report["ended_at_unix"] = int(_now())
    report["exit_code"] = exit_code
    report["ok"] = (exit_code == 0)
    report["steps"] = [asdict(s) for s in steps]

    # Summary counts
    report["summary"] = {
        "total": len(steps),
        "ok": sum(1 for s in steps if s.ok and not s.skipped),
        "failed": sum(1 for s in steps if (not s.ok) and (not s.skipped)),
        "skipped": sum(1 for s in steps if s.skipped),
    }

    # Save artifacts
    try:
        ART_REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    except Exception as e:
        _write_log_append(f"\nFAILED TO WRITE gate_report.json: {e}\n")
        # If we cannot write the report, treat as fail
        exit_code = 1
        report["ok"] = False
        report["exit_code"] = exit_code

    _write_log_append("\n\nK1_GATE END\n")
    # Also print a short console summary
    print(f"\nK1_GATE: {'PASS' if exit_code == 0 else 'FAIL'}")
    print(f"- gate_report.json: {ART_REPORT}")
    print(f"- file_err.txt:     {ART_LOG}")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
