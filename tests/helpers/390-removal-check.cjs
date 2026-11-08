'use strict';
// Phase 390 shared removal proof.
// Used by the removal-test template (390-removal-test.template.cjs) and by every later
// tests/test-390-<group>-removed.cjs. It proves three things: a path that must be gone is not
// tracked, no tracked file names the removed thing, and the things that must stay still stay.
// allowNaming may grow only with a reason written in the calling test.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const MAX_BYTES = 5 * 1024 * 1024;
const FILL = 'FILL' + '-ME';
const DEFAULT_ALLOW = ['.planning/', 'CHANGELOG.md'];

function gitTop() {
  const res = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: __dirname, encoding: 'utf8' });
  if (res.status !== 0) throw new Error('git rev-parse failed: ' + (res.stderr || '').trim());
  return res.stdout.trim();
}

function gitTracked(root) {
  const res = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (res.status !== 0) throw new Error('git ls-files failed: ' + (res.stderr || '').trim());
  return res.stdout.split('\n').filter(Boolean);
}

function makeRead(root) {
  const base = path.resolve(root);
  return (rel) => {
    const abs = path.resolve(base, rel);
    // A tracked path must stay inside the repo. Never follow a path outside it.
    if (abs !== base && !abs.startsWith(base + path.sep)) return null;
    try {
      return fs.readFileSync(abs);
    } catch (_) {
      return null;
    }
  };
}

function isAllowed(file, allowNaming) {
  return allowNaming.some((a) => (a.endsWith('/') ? file.startsWith(a) : file === a));
}

function checkRemoval(opts) {
  const o = opts || {};
  const root = o.root || gitTop();
  const tracked = o.tracked || gitTracked(root);
  const read = o.read || makeRead(root);
  const paths = o.paths || [];
  const names = o.names || [];
  const survivors = o.survivors || [];
  const survivorText = o.survivorText || [];
  const allowNaming = o.allowNaming || DEFAULT_ALLOW;
  const self = o.self || null;
  const failures = new Set();
  const trackedSet = new Set(tracked);

  const unfilled =
    paths.includes(FILL) || names.includes(FILL) || survivors.includes(FILL) ||
    survivorText.some((s) => s && (s.path === FILL || s.text === FILL));
  if (unfilled) failures.add('TEMPLATE-NOT-FILLED');
  const realPaths = paths.filter((p) => p !== FILL);
  const realNames = names.filter((n) => n !== FILL);
  const realSurvivors = survivors.filter((s) => s !== FILL);
  const realText = survivorText.filter((s) => s && s.path !== FILL && s.text !== FILL);

  if (!unfilled && realPaths.length === 0 && realNames.length === 0) failures.add('EMPTY-CHECK');

  for (const p of realPaths) {
    if (trackedSet.has(p)) failures.add('TRACKED ' + p);
  }

  let swept = 0;
  if (realNames.length > 0) {
    for (const f of tracked) {
      if (isAllowed(f, allowNaming) || f === self) continue;
      const buf = read(f);
      if (!buf || buf.length > MAX_BYTES || buf.includes(0)) continue;
      swept++;
      const text = buf.toString('utf8');
      for (const n of realNames) {
        if (text.includes(n)) failures.add('NAMED ' + n + ' in ' + f);
      }
    }
  }

  for (const s of realSurvivors) {
    if (!trackedSet.has(s)) failures.add('SURVIVOR-MISSING ' + s);
  }

  for (const st of realText) {
    let ok = false;
    if (trackedSet.has(st.path)) {
      const buf = read(st.path);
      ok = !!buf && buf.toString('utf8').includes(st.text);
    }
    if (!ok) failures.add('SURVIVOR-TEXT-MISSING ' + st.path);
  }

  return {
    failures: Array.from(failures).sort(),
    counts: { paths: realPaths.length, names: realNames.length, survivors: realSurvivors.length + realText.length, swept },
  };
}

module.exports = { checkRemoval, DEFAULT_ALLOW };
