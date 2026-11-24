#!/usr/bin/env node
'use strict';
// Phase 400 plan 14 (RL-05, T-400-48): the per-turn path never reaches the decision relay.
//   F1 no non-comment line under lib/ or hooks/ names decision-relay, services/, build-relay-release-requests or
//      operator-release-run; no file under lib/ requires a path under services/; the scan holds more than 20 files.
//   F2 mutation control: a scratch file under lib/ that names services/decision-relay is caught, then removed.
// The 399 fence (test-399-advisor-fence FN2) is not edited; this test is the 400 sibling. Hyphens only.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '..');
const NAMES = [/decision-relay/, /services\//, /build-relay-release-requests/, /operator-release-run/];
const REQUIRE_SERVICES = /require\s*\(\s*['"`][^'"`]*services\//;

let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) { pass += 1; console.log('PASS: ' + name); } else { fail += 1; console.log('FAIL: ' + name + (detail ? ' (' + detail + ')' : '')); }
}

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

function isComment(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('#');
}

// Returns { files, hits } over every text file under lib/ and hooks/. A file holding a NUL byte is binary and skipped.
function scan() {
  const files = walk(path.join(REPO, 'lib'), []).concat(walk(path.join(REPO, 'hooks'), []));
  const hits = [];
  let scanned = 0;
  for (const f of files) {
    let buf;
    try { buf = fs.readFileSync(f); } catch (_e) { continue; }
    if (buf.indexOf(0) !== -1) continue;
    scanned += 1;
    const rel = path.relative(REPO, f);
    const lines = buf.toString('utf8').split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (rel.startsWith('lib' + path.sep) && REQUIRE_SERVICES.test(line)) hits.push(rel + ':' + (i + 1) + ' requires services/');
      if (isComment(line)) continue;
      for (const re of NAMES) if (re.test(line)) hits.push(rel + ':' + (i + 1) + ' names ' + re.source);
    }
  }
  return { files: scanned, hits };
}

const f1 = scan();
check('F1 lib/ and hooks/ never name the relay or its client, lib/ never requires services/; scan > 20 files (' + f1.files + ')',
  f1.hits.length === 0 && f1.files > 20, f1.hits.slice(0, 10).join('; '));

const probe = path.join(REPO, 'lib', '.fence-probe-400-14-' + crypto.randomBytes(4).toString('hex') + '.cjs');
try {
  fs.writeFileSync(probe, "'use strict';\nconst relay = require('../services/decision-relay/relay.cjs');\nmodule.exports = relay;\n");
  const f2 = scan();
  const rel = path.relative(REPO, probe);
  const caught = f2.hits.filter((h) => h.startsWith(rel + ':'));
  check('F2 mutation control: a scratch lib/ file naming services/decision-relay is caught', caught.length >= 2, JSON.stringify(caught));
} finally {
  fs.rmSync(probe, { force: true });
}
check('F2b the scratch file is removed', !fs.existsSync(probe), probe);

console.log('--- test-400-relay-fence ---');
console.log('PASS: ' + pass + ' FAIL: ' + fail);
process.exit(fail === 0 ? 0 : 1);
