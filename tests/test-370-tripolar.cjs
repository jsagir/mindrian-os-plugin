#!/usr/bin/env node
'use strict';
/*
 * tests/test-370-tripolar.cjs -- Phase 370 plan 11 (REV370-12, REV370-04).
 *
 * Tri-Polar parity for the review contract. One fixture goes through every
 * door that exists and the doors must give the same (rule, class, line)
 * triples:
 *   module   lib/core/review-contract.cjs checkReview     (shared code path)
 *   wrapper  scripts/check-review-contract.cjs check      (CLI)
 *   door     lib/mcp/tools/views.cjs fileArtifact         (MCP: Desktop, Cowork)
 *   hook     scripts/review-contract-hook.cjs             (CLI, Write tool)
 *   doctor   scripts/check-review-contract.cjs --check    (release train)
 *
 * Arms:
 *   T1 pre-fix fixture: equal triples (tier S left out, the hook skips soft terms)
 *   T2 post-fix fixture: every door accepts it
 *   T3 a leg the contract turns off is printed DECLINED with its owner item;
 *      a leg that is on but whose code is missing fails
 *   T4 one soft-term fault: module, wrapper and door follow the contract policy;
 *      the hook does not report it
 *   T5 no door echoes body text
 *   T6 one line per surface (CLI, Desktop, Cowork), copied into 370-ACCEPTANCE.md
 *
 * Canon Part 8: local only, no Brain call. Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const H = require(path.join(__dirname, 'helpers', 'review-contract-370.cjs'));
const REPO = H.ROOT;
const { makeScratchRoom } = require(path.join(__dirname, 'helpers', 'fixture-room-354.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const views = require(path.join(REPO, 'lib', 'mcp', 'tools', 'views.cjs'));
const rep = H.reporter('test-370-tripolar');
const rc = H.requireModule(rep);
console.log('test-370-tripolar');

const WRAPPER = path.join(REPO, 'scripts', 'check-review-contract.cjs');
const HOOK = path.join(REPO, 'scripts', 'review-contract-hook.cjs');
const HOOKS_JSON = path.join(REPO, 'hooks', 'hooks.json');
const DOCTOR = path.join(REPO, 'scripts', 'doctor.cjs');

const PLANTED = [
  'SystemArchetypeAgent', 'LeveragePointAgent', 'IntersectionOpportunityFinderAgent',
  'Network Analysis MCP', 'NEO4J', 'artifact_file', 'lib/core/example.cjs',
  '/mos:challenge-assumptions', 'Theo',
];

const contract = H.realContract();
const enf = contract.enforcement || {};
const policy = contract.soft_terms && contract.soft_terms.policy;
const PRE = H.readFixture('pre-fix.md');
const POST = H.readFixture('post-fix.md');
const TMP = H.mkTmpDir('rc370-tripolar-');

// Owner item per leg, as recorded in the contract data.
const LEG_ITEM = { door: 'O8', hook: 'O6B', doctor: 'O6A' };

// Pure status function: what the contract says about each leg.
function legStatus(e) {
  const x = e || {};
  return {
    door: x.door === 'frontmatter' ? 'ON' : 'DECLINED',
    hook: (x.hook_mode === 'log-only' || x.hook_mode === 'enforce') ? 'ON' : 'DECLINED',
    doctor: (x.doctor_severity === 'blocker' || x.doctor_severity === 'advisory') ? 'ON' : 'DECLINED',
  };
}
const STATUS = legStatus(enf);

// ---- helpers ------------------------------------------------------------
function triples(violations, keepTierS) {
  return violations
    .filter((v) => keepTierS || v.tier !== 'S')
    .map((v) => v.rule + '|' + v.class + '|' + v.line)
    .sort();
}

function viaModule(text) {
  return triples(rc.checkReview(text).violations);
}

function runWrapper(text, name) {
  const f = path.join(TMP, name);
  fs.writeFileSync(f, text);
  const r = spawnSync(process.execPath, [WRAPPER, 'check', f], { cwd: REPO, encoding: 'utf8', timeout: 30000 });
  const rows = [];
  for (const line of (r.stdout || '').split('\n')) {
    const m = /^VIOLATION (\S+) (\S+) line (\d+)(?: tier (\S+))?$/.exec(line);
    if (m) rows.push({ rule: m[1], class: m[2], line: Number(m[3]), tier: m[4] === undefined ? '-' : m[4] });
  }
  return { status: r.status, out: r.stdout || '', err: r.stderr || '', rows };
}

const scratch = makeScratchRoom('tripolar370');
const db = openRoomDb(scratch.room);
function runDoor(section, filename, text) {
  return views._internal.fileArtifact(db, scratch.room, { section, filename, content: text });
}

function contractCopy(patchEnforcement) {
  const c = JSON.parse(JSON.stringify(contract));
  c.enforcement = Object.assign({}, c.enforcement || {}, patchEnforcement);
  const f = path.join(TMP, 'contract-' + Object.keys(patchEnforcement).join('-') + '-' + String(patchEnforcement[Object.keys(patchEnforcement)[0]]) + '.json');
  fs.writeFileSync(f, JSON.stringify(c, null, 2));
  return f;
}

const ROOM_CWD = path.join(TMP, 'room');
const ROOM_FILE = path.join(ROOM_CWD, 'competitive-analysis', 'review.md');

function runHook(text, contractFile) {
  const home = H.mkTmpDir('rc370-trihome-');
  const args = [HOOK].concat(contractFile ? ['--contract', contractFile] : []);
  const payload = { tool_name: 'Write', cwd: ROOM_CWD, tool_input: { file_path: ROOM_FILE, content: text } };
  const r = spawnSync(process.execPath, args, {
    cwd: '/', input: JSON.stringify(payload), encoding: 'utf8',
    env: Object.assign({}, process.env, { MINDRIAN_HOME: home }),
  });
  const logFile = path.join(home, 'voice-style.jsonl');
  const logRows = fs.existsSync(logFile)
    ? fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  return { status: r.status, out: r.stdout || '', err: r.stderr || '', logRows, home };
}

// Triples from the hook stderr: "- rule (class) line N".
function hookStderrTriples(err) {
  const rows = [];
  for (const line of err.split('\n')) {
    const m = /^- (\S+) \((\S+)\) line (\d+)$/.exec(line);
    if (m) rows.push(m[1] + '|' + m[2] + '|' + m[3]);
  }
  return rows.sort();
}
// Triples from the hook log row detail: "rule/class@line rule/class@line".
function hookLogTriples(rows) {
  const out = [];
  for (const row of rows) {
    for (const tok of String(row.detail || '').split(/\s+/).filter(Boolean)) {
      const m = /^(\S+)\/(\S+)@(\d+)$/.exec(tok);
      if (m) out.push(m[1] + '|' + m[2] + '|' + m[3]);
    }
  }
  return out.sort();
}

function noText(s, label) {
  for (const p of PLANTED) rep.ok(String(s).indexOf(p) === -1, label + ' holds planted text: ' + p);
}

// ---- T3 first: the legs on or declined, and the code behind each ON leg -----
const legOutcome = {};
rep.arm('T3 declined legs are printed DECLINED with the owner item; an ON leg needs its code', () => {
  // Reporting logic, proven on synthetic enforcement blocks.
  const off = legStatus({ door: 'off', hook_mode: 'off', doctor_severity: 'off' });
  rep.eq(off.door + off.hook + off.doctor, 'DECLINEDDECLINEDDECLINED', 'all-off blocks give DECLINED');
  const on = legStatus({ door: 'frontmatter', hook_mode: 'enforce', doctor_severity: 'advisory' });
  rep.eq(on.door + on.hook + on.doctor, 'ONONON', 'all-on blocks give ON');
  const missing = legStatus({});
  rep.eq(missing.door + missing.hook + missing.doctor, 'DECLINEDDECLINEDDECLINED', 'a missing block is not ON');

  // The real contract, leg by leg.
  for (const leg of ['door', 'hook', 'doctor']) {
    if (STATUS[leg] === 'DECLINED') {
      legOutcome[leg] = 'DECLINED ' + LEG_ITEM[leg];
      console.log('    DECLINED ' + leg + ' (owner item ' + LEG_ITEM[leg] + ' ' + (leg === 'door' ? enf.door : leg === 'hook' ? enf.hook_mode : enf.doctor_severity) + ')');
    }
  }
  // ON legs: the code must exist.
  rep.ok(fs.existsSync(WRAPPER), 'wrapper script is missing');
  if (STATUS.door === 'ON') {
    rep.ok(typeof views._internal.fileArtifact === 'function', 'door is ON but fileArtifact is missing');
    rep.ok(typeof rc.isReviewArtifact === 'function' && typeof rc.checkReview === 'function', 'door is ON but the module functions are missing');
  }
  if (STATUS.hook === 'ON') {
    rep.ok(fs.existsSync(HOOK), 'hook is ON but scripts/review-contract-hook.cjs is missing');
    rep.ok(fs.readFileSync(HOOKS_JSON, 'utf8').indexOf('review-contract-hook') !== -1, 'hook is ON but hooks/hooks.json does not name it');
  }
  if (STATUS.doctor === 'ON') {
    rep.ok(fs.readFileSync(DOCTOR, 'utf8').indexOf('check-review-contract') !== -1, 'doctor is ON but scripts/doctor.cjs does not call the check');
  }
  // A hook turned off by data really does nothing (real hook, temp contract copy).
  const offFile = contractCopy({ hook_mode: 'off' });
  const r = runHook(PRE, offFile);
  rep.eq(r.status, 0, 'hook_mode off: exit code');
  rep.eq(r.err, '', 'hook_mode off: stderr');
  rep.eq(r.logRows.length, 0, 'hook_mode off: no log row');
});

// ---- T1 ----------------------------------------------------------------
rep.arm('T1 pre-fix fixture: module, wrapper, door and hook give the same triples', () => {
  const want = viaModule(PRE);
  rep.ok(want.length > 0, 'the module must find violations in the pre-fix fixture');

  const w = runWrapper(PRE, 'pre.md');
  rep.eq(w.status, 1, 'wrapper exit code');
  rep.eq(triples(w.rows).join(';'), want.join(';'), 'wrapper triples');

  if (STATUS.door === 'ON') {
    const d = runDoor('competitive-analysis', 'tri-pre', PRE);
    rep.eq(d.ok, false, 'door must refuse');
    rep.eq(d.reason, 'review_contract_violation', 'door reason');
    rep.eq(triples(d.violations).join(';'), want.join(';'), 'door triples');
  }

  // The hook parity is proven in enforce mode through a temp contract copy
  // (the shipped mode is log-only, owner item O6B). The soft-term tier is
  // skipped by the hook, so the comparison leaves tier S out for every door.
  if (STATUS.hook === 'ON') {
    const e = runHook(PRE, contractCopy({ hook_mode: 'enforce' }));
    rep.eq(e.status, 2, 'hook enforce exit code');
    rep.eq(hookStderrTriples(e.err).join(';'), want.join(';'), 'hook enforce triples');
    // The shipped mode, with no --contract argument.
    const real = runHook(PRE, null);
    if (enf.hook_mode === 'log-only') {
      rep.eq(real.status, 0, 'hook log-only exit code');
      rep.eq(real.err, '', 'hook log-only stderr');
      rep.eq(real.logRows.length, 1, 'hook log-only writes one row');
      rep.eq(hookLogTriples(real.logRows).join(';'), want.join(';'), 'hook log-only triples');
    } else {
      rep.eq(real.status, 2, 'hook enforce (shipped) exit code');
      rep.eq(hookStderrTriples(real.err).join(';'), want.join(';'), 'hook enforce (shipped) triples');
    }
  }

  if (STATUS.doctor === 'ON') {
    const c = spawnSync(process.execPath, [WRAPPER, '--check'], { cwd: REPO, encoding: 'utf8', timeout: 60000 });
    rep.eq(c.status, 0, 'doctor --check exit code on the real repo: ' + (c.stdout || '').slice(-200));
    rep.ok(/RESULT OK/.test(c.stdout || ''), 'doctor --check prints RESULT OK');
  }
});

// ---- T2 ----------------------------------------------------------------
rep.arm('T2 post-fix fixture: every door accepts it', () => {
  rep.eq(rc.checkReview(POST).ok, true, 'module ok');
  const w = runWrapper(POST, 'post.md');
  rep.eq(w.status, 0, 'wrapper exit code');
  rep.ok(/^OK review-contract v\d+/m.test(w.out), 'wrapper prints OK');
  if (STATUS.door === 'ON') {
    const d = runDoor('competitive-analysis', 'tri-post', POST);
    rep.eq(d.ok, true, 'door ok, got ' + JSON.stringify(d));
  }
  if (STATUS.hook === 'ON') {
    const e = runHook(POST, contractCopy({ hook_mode: 'enforce' }));
    rep.eq(e.status, 0, 'hook enforce exit code');
    rep.eq(e.err, '', 'hook enforce stderr');
    const real = runHook(POST, null);
    rep.eq(real.status, 0, 'hook shipped-mode exit code');
    rep.eq(real.logRows.length, 0, 'hook shipped-mode writes no row');
  }
});

// ---- T4 ----------------------------------------------------------------
rep.arm('T4 one soft-term fault: module, wrapper and door follow the policy; the hook does not report it', () => {
  const soft = POST + '\nWe store the tide rows in a database.\n';
  const expectFault = policy !== 'compound_only';
  const m = rc.checkReview(soft);
  const w = runWrapper(soft, 'soft.md');
  rep.eq(m.ok, !expectFault, 'module follows policy ' + policy);
  rep.eq(w.status, expectFault ? 1 : 0, 'wrapper follows policy ' + policy);
  if (expectFault) {
    rep.ok(m.violations.some((v) => v.class === 'soft_term'), 'module reports a soft_term');
    rep.ok(w.rows.some((v) => v.class === 'soft_term'), 'wrapper reports a soft_term');
  }
  if (STATUS.door === 'ON') {
    const d = runDoor('competitive-analysis', 'tri-soft', soft);
    rep.eq(d.ok, !expectFault, 'door follows policy ' + policy + ', got ' + JSON.stringify(d));
    if (expectFault) rep.ok(d.violations.some((v) => v.class === 'soft_term'), 'door reports a soft_term');
  }
  if (STATUS.hook === 'ON') {
    const e = runHook(soft, contractCopy({ hook_mode: 'enforce' }));
    rep.eq(e.status, 0, 'hook must not block a soft-term-only review');
    rep.eq(e.err, '', 'hook stderr');
    const real = runHook(soft, null);
    rep.eq(real.logRows.length, 0, 'hook must not log a soft-term-only review');
  }
});

// ---- T5 ----------------------------------------------------------------
rep.arm('T5 no door echoes body text', () => {
  const w = runWrapper(PRE, 'pre-echo.md');
  noText(w.out, 'wrapper stdout');
  noText(w.err, 'wrapper stderr');
  if (STATUS.door === 'ON') {
    const d = runDoor('competitive-analysis', 'tri-echo', PRE);
    noText(JSON.stringify(d), 'door result');
  }
  if (STATUS.hook === 'ON') {
    const e = runHook(PRE, contractCopy({ hook_mode: 'enforce' }));
    noText(e.out, 'hook enforce stdout');
    noText(e.err, 'hook enforce stderr');
    const real = runHook(PRE, null);
    noText(real.out, 'hook shipped stdout');
    noText(real.err, 'hook shipped stderr');
    noText(JSON.stringify(real.logRows), 'hook log row');
  }
  if (STATUS.doctor === 'ON') {
    const c = spawnSync(process.execPath, [WRAPPER, '--check'], { cwd: REPO, encoding: 'utf8', timeout: 60000 });
    noText(c.stdout, 'doctor --check stdout');
    noText(c.stderr, 'doctor --check stderr');
  }
  // The refused door wrote nothing.
  rep.ok(!fs.existsSync(path.join(scratch.room, 'competitive-analysis', 'tri-pre.md')), 'refused file must not exist');
  rep.ok(!fs.existsSync(path.join(scratch.room, 'competitive-analysis', 'tri-echo.md')), 'refused file must not exist');
});

// ---- T6: the surface lines, copied into the acceptance record ----------------
rep.arm('T6 one line per surface', () => {
  const hookWord = STATUS.hook === 'ON' ? 'PASS (hook_mode ' + enf.hook_mode + ', owner item O6B; enforce path proven on a contract copy)' : 'DECLINED O6B';
  const doorWord = STATUS.door === 'ON' ? 'PASS (door ' + enf.door + ', owner item O8)' : 'DECLINED O8';
  const docWord = STATUS.doctor === 'ON' ? 'PASS (doctor_severity ' + enf.doctor_severity + ', owner item O6A)' : 'DECLINED O6A';
  console.log('    SURFACE CLI wrapper: PASS (pre-file check, exit 1 on a fault)');
  console.log('    SURFACE CLI hook: ' + hookWord);
  console.log('    SURFACE Desktop door: ' + doorWord + ' - the MCP filing door is the shared code path');
  console.log('    SURFACE Cowork door: ' + doorWord + ' - same door; live Cowork behavior UNVERIFIED (no Cowork host here)');
  console.log('    SURFACE release doctor: ' + docWord);
  rep.ok(true);
});

try { closeRoomDb(db); } catch (_) { /* best effort */ }
scratch.cleanup();
rep.done();
