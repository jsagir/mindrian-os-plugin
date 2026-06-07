#!/usr/bin/env node
'use strict';

/**
 * Phase 143.3-01 -- OPEN-1 dispatch-framework-map drift test.
 *
 * The dispatch-framework map (data/dispatch-framework-map.json) is the WFL-01
 * translation layer: it turns the raw sensor `dispatch` handle (a human handle,
 * sometimes even a raw 'mos:research' slug) into the EXACT framework name the
 * resolver keys on. A slug leaking through would break resolution and could
 * carry an unscoped handle (threat T-143.3-03, spoofing).
 *
 * This test asserts (mirroring tests/test-reach-ids-drift.cjs's drift idiom --
 * a data file pinned against a frozen source):
 *   1. every mapped value (skip the _note key) is present in
 *      data/framework-names.json (the FEEDS_INTO-linked allowlist UNION
 *      curated_extras) -- a fake framework fails CI;
 *   2. NO mapped value is a slug (does not start with "mos:" or contain
 *      "/mos:") -- a smuggled slug fails CI;
 *   3. "mos:research" maps to exactly "Hypothesis-Driven Problem Solving"
 *      (the OPEN-1 canonical example).
 *
 * House rule: hyphens only, no em-dashes. Exit 0 on PASS, non-zero on FAIL.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const MAP_PATH = path.join(REPO_ROOT, 'data', 'dispatch-framework-map.json');
const FW_NAMES_PATH = path.join(REPO_ROOT, 'data', 'framework-names.json');

let failures = 0;
function check(cond, msg) {
  if (cond) {
    process.stdout.write('  ok  ' + msg + '\n');
  } else {
    process.stderr.write('  FAIL  ' + msg + '\n');
    failures += 1;
  }
}

const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
const allow = JSON.parse(fs.readFileSync(FW_NAMES_PATH, 'utf8'));

// Read the allowlist from the EXPLICIT framework_names + curated_extras keys
// (the live shape), NOT Object.values().flat() -- the catch-all would accept a
// name smuggled in as the snapshot_note / date prose, a latent Part-8 hole.
const names = Array.isArray(allow)
  ? allow
  : (Array.isArray(allow.framework_names) ? allow.framework_names : []).concat(
      Array.isArray(allow.curated_extras) ? allow.curated_extras : []
    );
const allowSet = new Set(names);

const handles = Object.keys(map).filter((k) => k !== '_note');

// 1. every mapped value resolves to a real framework name in the allowlist.
for (const h of handles) {
  const fw = map[h];
  check(
    typeof fw === 'string' && allowSet.has(fw),
    'mapped value resolves to a framework-names.json entry: "' + h + '" -> "' + fw + '"'
  );
}

// 2. no slug leaks through (value side).
for (const h of handles) {
  const fw = String(map[h]);
  check(
    !fw.startsWith('mos:') && !fw.includes('/mos:'),
    'no slug in mapped value for handle "' + h + '"'
  );
}

// 3. the OPEN-1 canonical translation.
check(
  map['mos:research'] === 'Hypothesis-Driven Problem Solving',
  '"mos:research" maps to exactly "Hypothesis-Driven Problem Solving"'
);

if (failures > 0) {
  process.stderr.write('dispatch-framework-map drift: ' + failures + ' FAILURE(S)\n');
  process.exit(1);
}
process.stdout.write('dispatch-framework-map drift: PASS (' + handles.length + ' handles)\n');
process.exit(0);
