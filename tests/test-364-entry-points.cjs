#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 08 Task 2 -- the /mos:ignite after-birth offer (ENTRY,
 * SRM364-03). layer: harness
 *
 *   P1  one paragraph headed "Scientific Roadmapping offer (Phase 364, after
 *       birth)." sits after the Door 3 abstraction-gate paragraph and before Door 4
 *   P2  it names /mos:scientific-roadmap --from-hypothesis for Door 3 and
 *       /mos:scientific-roadmap for Researcher arrivals, comes only after the
 *       room is born (after Gate B2), says never auto-run, never replaces B3
 *   P3  the skill mirror is in sync and carries the same paragraph
 *   P4  the twelve ignite-reading tests still pass
 *   P5  the registry, render-coverage and projection gates stay green
 *   P6  the paragraph has no em-dash or en-dash and no grade or praise wording
 *
 * Hermetic: temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME before any repo
 * module loads; spawned legs inherit the sandbox. House rule: hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-entry-pts-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-entry-pts-rooms-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
const C = hygiene.makeChecker('test-364-entry-points');

const HEAD = '**Scientific Roadmapping offer (Phase 364, after birth).**';
const DASH = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');

function read(rel) { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'); }
function paragraph(src) {
  const i = src.indexOf(HEAD);
  if (i === -1) return '';
  const rest = src.slice(i);
  const j = rest.indexOf('\n\n');
  return j === -1 ? rest : rest.slice(0, j);
}
function run(args) {
  const r = spawnSync(process.execPath, args, { cwd: REPO_ROOT, encoding: 'utf8', env: process.env, timeout: 240000 });
  return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
}

const ignite = read('commands/ignite.md');
const para = paragraph(ignite);

// P1
const iHead = ignite.indexOf(HEAD);
const iAbstraction = ignite.indexOf('**Abstraction-level gate (ALWAYS-FIRE');
const iDoor4 = ignite.indexOf('**Door 4 -- Free-Text');
C.check('P1 exactly one offer paragraph', ignite.split(HEAD).length === 2);
C.check('P1 it sits after the abstraction-gate paragraph and before Door 4', iAbstraction !== -1 && iDoor4 !== -1 && iAbstraction < iHead && iHead < iDoor4,
  JSON.stringify([iAbstraction, iHead, iDoor4]));

// P2
C.check('P2 Door 3 arrivals get /mos:scientific-roadmap --from-hypothesis', para.indexOf('/mos:scientific-roadmap --from-hypothesis') !== -1);
C.check('P2 Researcher arrivals get /mos:scientific-roadmap with the role blend named',
  /Researcher/.test(para) && para.indexOf('role_blend={researcher:1.0}') !== -1 && /offered `\/mos:scientific-roadmap`/.test(para));
C.check('P2 it comes only after the room is born (after Gate B2)', /after the room is born \(after Gate B2\)/.test(para));
C.check('P2 it says never auto-run and never replaces the B3 first win', /never auto-run/.test(para) && /never replaces the B3 first win/.test(para));
C.check('P2 Part 8 is stated: nothing from the hypothesis crosses', /Part 8/.test(para) && /nothing from the hypothesis crosses to Brain/.test(para));

// P3
const mirror = run(['scripts/build-skill-mirrors.cjs', '--check']);
C.check('P3 build-skill-mirrors --check exits 0', mirror.code === 0, mirror.out.slice(-300));
const skill = read('skills/ignite/SKILL.md');
C.check('P3 the skill mirror carries the same paragraph', paragraph(skill) === para && para.length > 0);

// P4
const IGNITE_TESTS = [
  'test-204-ignite-wiring-grep', 'test-204-ignite-branch-gate', 'test-b1-reconcile-canonical',
  'test-b1-four-door-contract', 'test-chain-executor-part8-leak', 'test-cv-multiselect-and-engine1',
  'test-267-2-ignite-persona-coverage', 'test-267-2-cr-02-ignite-birth-coordination',
  'test-354-extract-shallow-contract', 'test-hypothesis-family-and-claim', 'test-ignite-on-runchain',
  'test-bch-17-ignite-persona',
];
const failed = [];
IGNITE_TESTS.forEach(function (t) {
  const f = 'tests/' + t + '.cjs';
  if (!fs.existsSync(path.join(REPO_ROOT, f))) { failed.push(t + ' (missing)'); return; }
  const r = run([f]);
  if (r.code !== 0 && r.code !== 77) failed.push(t + ' exit ' + r.code);
});
C.check('P4 the twelve ignite-reading tests pass', failed.length === 0, failed.join('; '));

// P5
const reg = run(['scripts/build-command-registry.cjs', '--check']);
C.check('P5 build-command-registry --check exits 0', reg.code === 0, reg.out.slice(-300));
const rc = run(['scripts/check-render-coverage.cjs']);
C.check('P5 check-render-coverage exits 0', rc.code === 0, rc.out.slice(-300));
const proj = run(['scripts/build-orchestration-projection.cjs', '--check']);
C.check('P5 build-orchestration-projection --check exits 0', proj.code === 0, proj.out.slice(-300));

// P6
C.check('P6 the paragraph has no em-dash or en-dash', para.length > 0 && !DASH.test(para));
C.check('P6 no grade or praise wording', para.length > 0 && !/\b(grade|graded|score|scored|great|excellent|well done|congrat)/i.test(para));
C.check('P6 this test file has no em-dash or en-dash', !DASH.test(fs.readFileSync(__filename, 'utf8')));

process.exit(C.summary());
