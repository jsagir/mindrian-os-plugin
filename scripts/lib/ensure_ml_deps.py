#!/usr/bin/env python3
"""
ensure_ml_deps.py - Auto-install Python ML dependencies for MindrianOS whitespace pipeline.

Called by compute-whitespace-*.py and fetch-brain-baseline.py at entry, before the
real imports. Detects missing deps and auto-installs via pip3 install --user.
First run is ~30 seconds, subsequent runs are instant.

Added in v1.10.9 (plan 85-10, 2026-04-15) in response to Lawrence Aronhime Mac QA
(LAWRENCE-001) where Python 3.9.6 stock lacked numpy, scikit-learn, sentence-transformers
and the whitespace pipeline crashed with ImportError.

Usage in a calling script:
    from ensure_ml_deps import ensure
    ensure(["numpy", "scikit-learn", "sentence-transformers"])
    import numpy as np
    import sklearn
    import sentence_transformers
"""

import importlib
import subprocess
import sys

# pip package name -> importable module name (they differ for some deps)
PIP_TO_MODULE = {
    "numpy": "numpy",
    "scikit-learn": "sklearn",
    "sentence-transformers": "sentence_transformers",
}


def _check_imports(pip_names):
    """Return list of pip package names whose import fails."""
    missing = []
    for pip_name in pip_names:
        module_name = PIP_TO_MODULE.get(pip_name, pip_name)
        try:
            importlib.import_module(module_name)
        except ImportError:
            missing.append(pip_name)
    return missing


def ensure(pip_names):
    """
    Ensure the given pip packages are importable. Auto-install missing ones
    via pip3 install --user. Called before real imports at script entry.
    """
    missing = _check_imports(pip_names)
    if not missing:
        return

    print("", file=sys.stderr)
    print("MindrianOS: installing required Python dependencies (one-time, ~30 seconds)", file=sys.stderr)
    print("  Missing: " + ", ".join(missing), file=sys.stderr)
    print("  Installing to user site-packages via pip3 install --user", file=sys.stderr)

    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--user", "--quiet"] + missing,
            capture_output=True,
            text=True,
            timeout=300,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        print("", file=sys.stderr)
        print("MindrianOS: auto-install failed: " + str(e), file=sys.stderr)
        print("", file=sys.stderr)
        print("Install manually with:", file=sys.stderr)
        print("  pip3 install --user " + " ".join(missing), file=sys.stderr)
        print("", file=sys.stderr)
        sys.exit(1)

    if result.returncode != 0:
        print("", file=sys.stderr)
        print("MindrianOS: pip install exited " + str(result.returncode), file=sys.stderr)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        print("", file=sys.stderr)
        print("Install manually with:", file=sys.stderr)
        print("  pip3 install --user " + " ".join(missing), file=sys.stderr)
        print("", file=sys.stderr)
        sys.exit(1)

    # Invalidate import caches and retry
    importlib.invalidate_caches()
    still_missing = _check_imports(pip_names)
    if still_missing:
        print("", file=sys.stderr)
        print("MindrianOS: pip install succeeded but imports still fail: " + ", ".join(still_missing), file=sys.stderr)
        print("This may be a Python version mismatch. Try upgrading Python to 3.10+.", file=sys.stderr)
        print("", file=sys.stderr)
        sys.exit(1)

    print("MindrianOS: dependencies installed successfully, continuing...", file=sys.stderr)
    print("", file=sys.stderr)
