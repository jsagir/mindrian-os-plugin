#!/usr/bin/env node
'use strict';

// Phase 95.6 D-03(a) -- release-gate data-integrity assertion. Owning plan: 95.6-02.
// GREEN immediately once the skills/mullins-scaffold/SKILL.md backfill lands (this plan).
//
// Every skills/*/ directory MUST contain a SKILL.md, else install.sh's
// skill-loop (pre-95.6-03) aborts under `set -euo pipefail`. (The bug that
// broke Gary Laben's install 2026-05-08/09; see docs/testers/gary-laben/FEEDBACK.md.)
// The contract fix that makes install.sh tolerant of a missing SKILL.md is 95.6-03;
// this test guards the *data* invariant so the warning never has to fire on a canonical install.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');

const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const missing = dirs.filter((name) => !fs.existsSync(path.join(SKILLS_DIR, name, 'SKILL.md')));

assert.deepStrictEqual(
  missing,
  [],
  'skills/ directories missing SKILL.md (will abort install.sh skill-loop): ' + JSON.stringify(missing),
);

console.log('PASS: all ' + dirs.length + ' skills have SKILL.md');
process.exit(0);
