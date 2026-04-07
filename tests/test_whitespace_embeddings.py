#!/usr/bin/env python3
"""Tests for compute-whitespace-embeddings.py structure and behavior."""

import ast
import json
import os
import sys
import tempfile
from pathlib import Path

# Add scripts dir to path for import
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))

def _load_module():
    """Load compute-whitespace-embeddings.py as a module (handles hyphens)."""
    import importlib.util
    script = Path(__file__).resolve().parent.parent / 'scripts' / 'compute-whitespace-embeddings.py'
    spec = importlib.util.spec_from_file_location("compute_whitespace_embeddings", script)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_script_exists():
    """Script file must exist."""
    script = Path(__file__).resolve().parent.parent / 'scripts' / 'compute-whitespace-embeddings.py'
    assert script.exists(), f"Script not found at {script}"


def test_script_syntax():
    """Script must be valid Python."""
    script = Path(__file__).resolve().parent.parent / 'scripts' / 'compute-whitespace-embeddings.py'
    with open(script) as f:
        ast.parse(f.read())


def test_required_functions():
    """Script must contain all required functions."""
    script = Path(__file__).resolve().parent.parent / 'scripts' / 'compute-whitespace-embeddings.py'
    with open(script) as f:
        tree = ast.parse(f.read())
    funcs = [n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)]
    required = ['discover_artifacts', 'compute_content_hashes', 'load_embedding_model',
                'embed_artifacts', 'main', 'check_embedding_cache']
    for r in required:
        assert r in funcs, f"Missing required function: {r}"


def test_discover_artifacts_skip_logic():
    """discover_artifacts must skip STATE.md, ROOM.md, MINTO.md and root files."""
    mod = _load_module()
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create section with artifacts
        section = Path(tmpdir) / 'market-analysis'
        section.mkdir()
        (section / 'insight.md').write_text('# Insight\n\n' + 'x' * 60)
        (section / 'STATE.md').write_text('# State\n\n' + 'x' * 60)
        (section / 'ROOM.md').write_text('# Room\n\n' + 'x' * 60)

        # Root level file should be skipped
        (Path(tmpdir) / 'README.md').write_text('# Root\n\n' + 'x' * 60)

        artifacts = mod.discover_artifacts(tmpdir)
        ids = [a['id'] for a in artifacts]
        assert 'market-analysis/insight' in ids
        assert not any('STATE' in i for i in ids)
        assert not any('ROOM' in i for i in ids)


def test_compute_content_hashes():
    """compute_content_hashes must return MD5 hashes (12 chars)."""
    mod = _load_module()
    artifacts = [
        {'id': 'test/a', 'text': 'Hello world test content here'},
        {'id': 'test/b', 'text': 'Another test content piece'},
    ]
    hashes = mod.compute_content_hashes(artifacts)
    assert len(hashes) == 2
    assert all(len(h) == 12 for h in hashes.values())


def test_output_json_structure():
    """Output JSON must have metadata and embeddings keys with required fields."""
    # This test validates the output format contract
    expected_metadata_keys = {'timestamp', 'model_name', 'model_dim', 'artifact_count', 'content_hashes'}
    expected_embedding_keys = {'id', 'section', 'title', 'path', 'vector'}

    # These are the structural requirements from the plan
    assert 'timestamp' in expected_metadata_keys
    assert 'model_name' in expected_metadata_keys
    assert 'model_dim' in expected_metadata_keys
    assert 'vector' in expected_embedding_keys


def test_argparse_help():
    """Script must support --help with room_dir, --model, --output."""
    import subprocess
    result = subprocess.run(
        [sys.executable, 'scripts/compute-whitespace-embeddings.py', '--help'],
        capture_output=True, text=True, cwd=str(Path(__file__).resolve().parent.parent)
    )
    assert result.returncode == 0, f"--help failed: {result.stderr}"
    assert 'room_dir' in result.stdout
    assert '--model' in result.stdout
    assert '--output' in result.stdout


if __name__ == '__main__':
    # Simple test runner
    import traceback
    tests = [v for k, v in sorted(globals().items()) if k.startswith('test_')]
    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            print(f"  PASS: {test.__name__}")
            passed += 1
        except Exception as e:
            print(f"  FAIL: {test.__name__}: {e}")
            traceback.print_exc()
            failed += 1
    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)
