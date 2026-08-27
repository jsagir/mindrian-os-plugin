#!/usr/bin/env node
'use strict';

/*
 * Fake `python3` interpreter used by tests/test-hsi-preflight-remediation.cjs
 * to simulate a machine with NO Python ML deps installed, without requiring
 * real network access or a real pip install.
 *
 * State is a directory of marker files (one per import name) passed via
 * FAKE_PY_STATE_DIR. A dep is "importable" iff <stateDir>/<import-name>.installed
 * exists. `-m pip install ... <pkg-names>` creates the marker for each package
 * (mapped pip-name -> import-name) and exits 0, simulating a successful install
 * without touching the real filesystem or network.
 *
 * Recognized invocations (mirrors exactly what scripts/doctor.cjs's
 * runCheckRsEngine spawns):
 *   -c "import sys; print(sys.version)"   -> probePythonAvailable(): always OK
 *   -c "import <dep>"                     -> probeImport(): OK iff marker exists
 *   -m pip install --user --quiet <pkgs>  -> "installs" (creates markers), exit 0
 */

const fs = require('node:fs');
const path = require('node:path');

const stateDir = process.env.FAKE_PY_STATE_DIR;
if (!stateDir) {
  process.stderr.write('fake-python.cjs: FAKE_PY_STATE_DIR not set\n');
  process.exit(2);
}

// pip package name -> importable module name (mirrors doctor.cjs's pipName map, inverted).
const PIP_TO_IMPORT = {
  requests: 'requests',
  numpy: 'numpy',
  'sentence-transformers': 'sentence_transformers',
  'scikit-learn': 'sklearn',
};

const argv = process.argv.slice(2);

function markerPath(importName) {
  return path.join(stateDir, importName + '.installed');
}

if (argv[0] === '-c') {
  const code = argv[1] || '';
  const versionMatch = /^import sys; print\(sys\.version\)$/.test(code);
  if (versionMatch) {
    process.stdout.write('3.99.0 (fake-python, check-rs-engine test fixture)\n');
    process.exit(0);
  }
  const importMatch = code.match(/^import (\S+)$/);
  if (importMatch) {
    const dep = importMatch[1];
    if (fs.existsSync(markerPath(dep))) {
      process.exit(0);
    }
    process.stderr.write('ModuleNotFoundError: No module named \'' + dep + '\'\n');
    process.exit(1);
  }
  // Unrecognized -c invocation: fail closed, loudly, so a drifted doctor.cjs
  // probe shape gets caught by the test instead of silently passing.
  process.stderr.write('fake-python.cjs: unrecognized -c code: ' + code + '\n');
  process.exit(1);
}

if (argv[0] === '-m' && argv[1] === 'pip' && argv[2] === 'install') {
  const pkgArgs = argv.slice(3).filter(function (a) { return a.indexOf('--') !== 0; });
  fs.mkdirSync(stateDir, { recursive: true });
  for (const pkg of pkgArgs) {
    const importName = PIP_TO_IMPORT[pkg] || pkg;
    fs.writeFileSync(markerPath(importName), 'installed-by-fake-pip\n');
  }
  process.exit(0);
}

process.stderr.write('fake-python.cjs: unrecognized invocation: ' + argv.join(' ') + '\n');
process.exit(1);
