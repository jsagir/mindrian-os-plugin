#!/usr/bin/env node
'use strict';
/**
 * scripts/skillopt-eval.cjs - Phase 230-06, the INDEPENDENT deterministic eval layer.
 * ================================================================================
 * The guardrails inside Plans 02-04 fire per-unit at run time, INSIDE the scripts
 * being graded. This file is the after-the-fact second layer: it re-derives D3, D4,
 * D5, D6, and the D7 smoke agreement from the artifacts on disk ALONE, so a bug in a
 * pipeline script cannot silently vouch for itself. Same two-layer discipline as
 * huji-eval.cjs over huji-run-one.cjs (a check that re-reads the bytes, never trusts
 * the producer's own tally).
 *
 * Every check is pure deterministic code. ZERO API spend, zero `claude` spawn. The
 * ONLY subprocess is `node lib/core/skillopt-schemas.cjs` (the schema module's own
 * selftest), spawned via process.execPath, never the model.
 *
 * Six checks, each a `--check <name>` subcommand, all bundled under `--suite code`.
 * Each SKIPs cleanly with an explicit SKIP line when its input artifact does not
 * exist yet (file-guarded SKIP doctrine - never a fake PASS):
 *   1. schemas-roundtrip  - the schema module selftest exits 0 AND every emitted JSON
 *                           Schema has no '$schema' meta-ref (CLI-reject guard).
 *   2. reconciliation (D5) - spawned === ok + not_evaluated per unit ledger AND every
 *                            not_evaluated unit carries a reason from the closed vocab.
 *   3. do-no-harm (D3)    - every loop summary parses; a proposed_description implies
 *                           regressed_query_count === 0; a nonzero regression implies
 *                           no proposed_description (blocked-by-regression semantics).
 *   4. write-path (D6)    - no file under out/ resolves (realpath) under skills/,
 *                           scripts/, or lib/; no scratch symlink escapes into them.
 *   5. evidence-quote (D4) - every reported finding's evidence_quote is a verbatim
 *                            substring of the REAL named .cjs, re-read from disk.
 *   6. smoke-replay (D7)  - funnel per-skill verdicts agree with smoke-labels.json
 *                           expected_funnel at >= tolerance; the not_evaluated_probe
 *                           record must have landed not_evaluated.
 *
 * CJS only, switch-case argv router (the gsd-tools.cjs / huji-eval.cjs pattern, no
 * Commander/yargs). No em-dashes (CLAUDE.md HARD RULE). Reuses lib/core/skillopt-schemas.cjs.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  LoopSummarySchema,
  UnitRecordSchema,
  NOT_EVALUATED_REASONS,
  PHASE_OUT_DIR,
  toJsonSchemas,
} = require('../lib/core/skillopt-schemas.cjs');

// anchorEvidence is the exact D4 anti-fabrication anchor Plan 04 shipped; reuse it
// rather than re-implementing the verbatim-substring logic (per that plan's downstream note).
const { anchorEvidence } = require('./skillopt-codereview.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEMA_MODULE = path.join(REPO_ROOT, 'lib', 'core', 'skillopt-schemas.cjs');
const DEFAULT_TOLERANCE = 0.85;

// The forbidden real-repo trees a pipeline write must NEVER resolve into (D6).
const FORBIDDEN_DIRS = ['skills', 'scripts', 'lib'].map((d) => path.join(REPO_ROOT, d));

function loadJson(fp) { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
function exists(fp) { try { fs.accessSync(fp); return true; } catch (_e) { return false; } }

// A skipped result: printed with an explicit SKIP line, never a silent fake PASS.
function skip(reason) { return { ok: true, skipped: true, reason }; }

// ---------------------------------------------------------------------------
// 1. schemas-roundtrip
// ---------------------------------------------------------------------------
// The schema module's own selftest must exit 0, AND toJsonSchemas output must carry
// no '$schema' meta-ref (CLI 2.1.211 rejects draft/2020-12). modulePath is injectable
// so the selftest can point it at a crafted failing module for the FAIL direction.
function checkSchemasRoundtrip(opts) {
  const o = opts || {};
  const modulePath = o.modulePath || SCHEMA_MODULE;
  const res = spawnSync(process.execPath, [modulePath], { encoding: 'utf8', timeout: 60000 });
  if (!res || res.status !== 0) {
    return { ok: false, reason: 'schema selftest exited ' + (res ? res.status : 'null'), detail: res ? String(res.stderr || '').slice(0, 300) : 'no result' };
  }
  // Emit JSON Schema files from the ONE zod source into a hermetic temp dir; assert
  // none still carries a '$schema' key. Only meaningful for the real module.
  if (!o.modulePath) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skillopt-eval-roundtrip-'));
    try {
      const written = toJsonSchemas(tmp);
      for (const [name, fp] of Object.entries(written)) {
        const raw = fs.readFileSync(fp, 'utf8');
        JSON.parse(raw); // must parse cleanly
        if (raw.includes('$schema')) return { ok: false, reason: 'emitted schema ' + name + ' still contains "$schema"' };
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
  return { ok: true, reason: 'schema selftest clean, no $schema meta-ref emitted' };
}

// ---------------------------------------------------------------------------
// 2. reconciliation (D5)
// ---------------------------------------------------------------------------
// One ledger tally: spawned files, ok, not_evaluated, plus any bad-reason units.
function tallyLedger(dir) {
  const t = { present: false, spawned: 0, ok: 0, not_evaluated: 0, other: 0, unparseable: 0, badReason: [] };
  if (!exists(dir)) return t;
  t.present = true;
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch (_e) { return t; }
  for (const f of files) {
    t.spawned += 1;
    let rec = null;
    try { rec = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (_e) { t.unparseable += 1; continue; }
    if (rec.status === 'ok') t.ok += 1;
    else if (rec.status === 'not_evaluated') {
      t.not_evaluated += 1;
      if (!NOT_EVALUATED_REASONS.includes(rec.not_evaluated_reason)) t.badReason.push({ unit_id: rec.unit_id, reason: rec.not_evaluated_reason });
    } else t.other += 1;
  }
  return t;
}

function checkReconciliation(outDir) {
  const dir = outDir || path.join(REPO_ROOT, PHASE_OUT_DIR);
  const ledgers = {
    funnel: path.join(dir, 'funnel', 'units'),
    review: path.join(dir, 'review', 'units'),
  };
  const present = Object.entries(ledgers).filter(([, p]) => exists(p));
  if (present.length === 0) return skip('no unit ledgers under out/funnel/units or out/review/units');

  const rows = [];
  let ok = true;
  for (const [name, p] of present) {
    const t = tallyLedger(p);
    const identity = t.spawned === t.ok + t.not_evaluated && t.other === 0 && t.unparseable === 0;
    const reasonsOk = t.badReason.length === 0;
    if (!identity || !reasonsOk) ok = false;
    rows.push({ ledger: name, spawned: t.spawned, ok: t.ok, not_evaluated: t.not_evaluated, other: t.other, unparseable: t.unparseable, badReason: t.badReason, identity, reasonsOk });
  }
  return { ok, rows };
}

// ---------------------------------------------------------------------------
// 3. do-no-harm (D3)
// ---------------------------------------------------------------------------
function checkDoNoHarm(outDir) {
  const dir = outDir || path.join(REPO_ROOT, PHASE_OUT_DIR);
  const loopDir = path.join(dir, 'loop');
  if (!exists(loopDir)) return skip('no out/loop directory');

  let skillDirs = [];
  try { skillDirs = fs.readdirSync(loopDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch (_e) { skillDirs = []; }
  const summaries = [];
  for (const sd of skillDirs) {
    const sp = path.join(loopDir, sd, 'summary.json');
    if (exists(sp)) summaries.push({ skill: sd, path: sp });
  }
  if (summaries.length === 0) return skip('no loop summaries under out/loop/*/summary.json');

  const violations = [];
  for (const s of summaries) {
    let raw = null;
    try { raw = loadJson(s.path); } catch (_e) { violations.push({ skill: s.skill, reason: 'summary.json unparseable' }); continue; }
    const parsed = LoopSummarySchema.safeParse(raw);
    if (!parsed.success) { violations.push({ skill: s.skill, reason: 'not LoopSummary-valid: ' + JSON.stringify(parsed.error.issues) }); continue; }
    const sum = parsed.data;
    // A proposed diff MUST carry zero regression (the do-no-harm hard gate).
    if (sum.proposed_description != null && sum.regressed_query_count !== 0) {
      violations.push({ skill: s.skill, reason: 'proposed_description with regressed_query_count ' + sum.regressed_query_count + ' (must be 0)' });
    }
    // A nonzero regression MUST appear only blocked (no proposed_description).
    if (sum.regressed_query_count > 0 && sum.proposed_description != null) {
      violations.push({ skill: s.skill, reason: 'nonzero regression must be blocked, but a proposed_description is present' });
    }
  }
  return { ok: violations.length === 0, summaries: summaries.length, violations };
}

// ---------------------------------------------------------------------------
// 4. write-path (D6)
// ---------------------------------------------------------------------------
// Does a resolved realpath land under skills/, scripts/, or lib/? Returns the
// forbidden dir it escaped into, or null. Boundary-safe (never a bare prefix match).
function resolvesUnderForbidden(realpath) {
  for (const dir of FORBIDDEN_DIRS) {
    if (realpath === dir || realpath.startsWith(dir + path.sep)) return dir;
  }
  return null;
}

// Walk every entry under root. Symlinks are checked (via realpath) but NEVER followed
// as directories, so a node_modules symlink is a single realpath check, not a descent.
function walkEntries(root) {
  const files = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch (_e) { continue; }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isSymbolicLink()) { files.push(full); continue; }
      if (e.isDirectory()) { stack.push(full); continue; }
      files.push(full);
    }
  }
  return files;
}

function checkWritePath(outDir) {
  const dir = outDir || path.join(REPO_ROOT, PHASE_OUT_DIR);
  if (!exists(dir)) return skip('no out/ directory');

  const offenders = [];
  let scanned = 0;
  for (const full of walkEntries(dir)) {
    scanned += 1;
    let rp;
    try { rp = fs.realpathSync(full); } catch (_e) { continue; } // broken symlink: cannot resolve into a real tree
    const escaped = resolvesUnderForbidden(rp);
    if (escaped) offenders.push({ path: path.relative(REPO_ROOT, full), resolves_to: path.relative(REPO_ROOT, rp), under: path.relative(REPO_ROOT, escaped) });
  }
  return { ok: offenders.length === 0, scanned, offenders };
}

// ---------------------------------------------------------------------------
// 5. evidence-quote (D4)
// ---------------------------------------------------------------------------
function checkEvidenceQuotes(outDir) {
  const dir = outDir || path.join(REPO_ROOT, PHASE_OUT_DIR);
  const findingsPath = path.join(dir, 'review', 'findings.json');
  if (!exists(findingsPath)) return skip('no out/review/findings.json');

  let findings = null;
  try { findings = loadJson(findingsPath); } catch (_e) { return { ok: false, reason: 'findings.json unparseable' }; }
  if (!Array.isArray(findings)) return { ok: false, reason: 'findings.json is not an array' };

  const violations = [];
  for (const f of findings) {
    const abs = path.isAbsolute(f.file) ? f.file : path.join(REPO_ROOT, f.file);
    let fileText = null;
    try { fileText = fs.readFileSync(abs, 'utf8'); } catch (_e) { violations.push({ file: f.file, reason: 'named .cjs not readable' }); continue; }
    const anchor = anchorEvidence(f, fileText);
    if (!anchor.ok) violations.push({ file: f.file, reason: 'evidence_quote not verbatim (' + anchor.reason + ')', quote: String(f.evidence_quote).slice(0, 120) });
  }
  return { ok: violations.length === 0, findings: findings.length, violations };
}

// ---------------------------------------------------------------------------
// 6. smoke-replay (D7)
// ---------------------------------------------------------------------------
function checkSmokeAgreement(outDir, labelsPath, tolerance) {
  const dir = outDir || path.join(REPO_ROOT, PHASE_OUT_DIR);
  const funnelPath = path.join(dir, 'funnel', 'funnel-results.json');
  if (!exists(funnelPath)) return skip('no out/funnel/funnel-results.json (no live funnel yet)');

  const lp = labelsPath || path.join(REPO_ROOT, PHASE_OUT_DIR, '..', 'smoke-labels.json');
  if (!exists(lp)) return skip('no smoke-labels.json reference at ' + path.relative(REPO_ROOT, lp));

  const tol = typeof tolerance === 'number' ? tolerance : DEFAULT_TOLERANCE;

  let funnel = null;
  let labels = null;
  try { funnel = loadJson(funnelPath); } catch (_e) { return { ok: false, reason: 'funnel-results.json unparseable' }; }
  try { labels = loadJson(lp); } catch (_e) { return { ok: false, reason: 'smoke-labels.json unparseable' }; }
  if (!funnel || !Array.isArray(funnel.skills)) return { ok: false, reason: 'funnel-results.json has no skills array' };
  if (!Array.isArray(labels)) return { ok: false, reason: 'smoke-labels.json is not an array' };

  const verdictBySkill = new Map(funnel.skills.map((s) => [s.skill, s.verdict]));

  const table = [];
  let matches = 0;
  let comparable = 0;
  let probeOk = true;
  let probeChecked = false;
  for (const label of labels) {
    if (label.role === 'not_evaluated_probe') {
      probeChecked = true;
      const v = verdictBySkill.get(label.skill);
      const landed = v === 'not_evaluated';
      if (!landed) probeOk = false;
      table.push({ skill: label.skill, role: label.role, expected: 'not_evaluated', actual: v == null ? '(absent)' : v, match: landed });
      continue;
    }
    if (label.expected_funnel == null) continue; // WS2-only labels carry no funnel expectation
    const v = verdictBySkill.get(label.skill);
    if (v == null) { table.push({ skill: label.skill, role: label.role, expected: label.expected_funnel, actual: '(absent)', match: false }); comparable += 1; continue; }
    comparable += 1;
    const match = v === label.expected_funnel;
    if (match) matches += 1;
    table.push({ skill: label.skill, role: label.role, expected: label.expected_funnel, actual: v, match });
  }

  const agreement = comparable > 0 ? matches / comparable : null;
  const agreementOk = agreement != null && agreement >= tol;
  const mismatches = table.filter((r) => !r.match);
  // A labeled not_evaluated_probe MUST land not_evaluated (probeOk); probe presence
  // itself is not required, but when present it is part of the D7 gate (wired to D5).
  const ok = agreementOk && probeOk;
  return { ok, tolerance: tol, agreement, matches, comparable, probeChecked, probeOk, table, mismatches };
}

// ---------------------------------------------------------------------------
// Check registry (real-data runners over the current PHASE_OUT_DIR).
// ---------------------------------------------------------------------------
const CHECKS = {
  'schemas-roundtrip': (outDir) => checkSchemasRoundtrip({}),
  'reconciliation': (outDir) => checkReconciliation(outDir),
  'do-no-harm': (outDir) => checkDoNoHarm(outDir),
  'write-path': (outDir) => checkWritePath(outDir),
  'evidence-quote': (outDir) => checkEvidenceQuotes(outDir),
  'smoke-replay': (outDir, o) => checkSmokeAgreement(outDir, null, o && o.tolerance),
};
const CHECK_NAMES = Object.keys(CHECKS);

function printResult(name, r) {
  if (r.skipped) { console.log('SKIP  ' + name + '  (' + r.reason + ')'); return; }
  if (r.ok) { console.log('PASS  ' + name + (r.reason ? '  (' + r.reason + ')' : '')); return; }
  console.log('FAIL  ' + name + (r.reason ? '  (' + r.reason + ')' : ''));
  for (const v of (r.violations || [])) console.log('    violation: ' + (v.skill || v.file || '') + ' - ' + v.reason);
  for (const o of (r.offenders || [])) console.log('    escape: ' + o.path + ' -> ' + o.resolves_to + ' (under ' + o.under + ')');
  for (const row of (r.rows || [])) if (!row.identity || !row.reasonsOk) console.log('    ledger ' + row.ledger + ': spawned=' + row.spawned + ' ok=' + row.ok + ' ne=' + row.not_evaluated + ' other=' + row.other + ' unparseable=' + row.unparseable + ' badReason=' + JSON.stringify(row.badReason));
  for (const m of (r.mismatches || [])) console.log('    mismatch: ' + m.skill + ' (' + m.role + ') expected ' + m.expected + ' got ' + m.actual);
}

// Print the smoke agreement table (every skill, naming each mismatch).
function printSmokeTable(r) {
  if (r.skipped || !r.table) return;
  console.log('  smoke agreement: ' + (r.agreement == null ? 'n/a' : (r.agreement * 100).toFixed(1) + '%') + ' (tolerance ' + (r.tolerance * 100).toFixed(0) + '%), probe ' + (r.probeChecked ? (r.probeOk ? 'landed not_evaluated' : 'DID NOT land not_evaluated') : 'not labeled'));
  for (const row of r.table) console.log('    ' + (row.match ? 'ok ' : 'XX ') + row.skill + '  expected ' + row.expected + '  got ' + row.actual);
}

// ---------------------------------------------------------------------------
// --selftest: PASS + FAIL fixture directions for every check (twelve total).
// ---------------------------------------------------------------------------
function runSelftest() {
  const assert = require('node:assert');
  const baseOut = path.join(REPO_ROOT, PHASE_OUT_DIR);
  fs.mkdirSync(baseOut, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(baseOut, '.selftest-eval-'));
  const mkUnit = (dir, id, rec) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify(rec, null, 2)); };

  try {
    // ---- 1. schemas-roundtrip ----
    assert.strictEqual(checkSchemasRoundtrip({}).ok, true, 'schemas-roundtrip PASS: the real module selftest is clean');
    const badModule = path.join(tmp, 'bad-schema.cjs');
    fs.writeFileSync(badModule, 'process.exit(1);\n');
    assert.strictEqual(checkSchemasRoundtrip({ modulePath: badModule }).ok, false, 'schemas-roundtrip FAIL: a module that exits nonzero fails');

    // ---- 2. reconciliation (D5) ----
    const recOk = path.join(tmp, 'recok', 'funnel', 'units');
    mkUnit(recOk, 'funnel-a-0', { unit_id: 'funnel-a-0', kind: 'funnel', model: 'claude-sonnet-4-5', session_id: null, total_cost_usd: null, exit: 0, status: 'ok', not_evaluated_reason: null, error_issues: null, payload: null });
    mkUnit(recOk, 'funnel-b-0', { unit_id: 'funnel-b-0', kind: 'funnel', model: 'claude-sonnet-4-5', session_id: null, total_cost_usd: null, exit: null, status: 'not_evaluated', not_evaluated_reason: 'timeout', error_issues: null, payload: null });
    assert.strictEqual(checkReconciliation(path.join(tmp, 'recok')).ok, true, 'reconciliation PASS: spawned == ok + not_evaluated, reasons in vocab');
    const recBad = path.join(tmp, 'recbad', 'review', 'units');
    mkUnit(recBad, 'review-a', { unit_id: 'review-a', kind: 'review', model: 'claude-opus-4-8', session_id: null, total_cost_usd: null, exit: 0, status: 'ok', not_evaluated_reason: null, error_issues: null, payload: null });
    fs.writeFileSync(path.join(recBad, 'review-corrupt.json'), '{ not valid json <<<');
    assert.strictEqual(checkReconciliation(path.join(tmp, 'recbad')).ok, false, 'reconciliation FAIL: an unparseable unit breaks the identity');
    // A not_evaluated unit with an OUT-OF-VOCAB reason also fails (bypasses schema by raw write).
    const recBadReason = path.join(tmp, 'recreason', 'funnel', 'units');
    mkUnit(recBadReason, 'funnel-x-0', { unit_id: 'funnel-x-0', kind: 'funnel', model: 'm', session_id: null, total_cost_usd: null, exit: null, status: 'not_evaluated', not_evaluated_reason: 'gremlins', error_issues: null, payload: null });
    assert.strictEqual(checkReconciliation(path.join(tmp, 'recreason')).ok, false, 'reconciliation FAIL: a not_evaluated reason outside the closed vocab fails');

    // ---- 3. do-no-harm (D3) ----
    const dnhOk = path.join(tmp, 'dnhok', 'loop', 'sA');
    fs.mkdirSync(dnhOk, { recursive: true });
    fs.writeFileSync(path.join(dnhOk, 'summary.json'), JSON.stringify({ skill: 'sA', iterations_run: 1, best_iteration: 1, selected_by: 'validation_pass_rate', baseline_validation_rate: 0.5, best_validation_rate: 0.8, regressed_query_count: 0, converged: true, proposed_description: 'better desc' }));
    assert.strictEqual(checkDoNoHarm(path.join(tmp, 'dnhok')).ok, true, 'do-no-harm PASS: a proposed diff with zero regression is clean');
    const dnhBad = path.join(tmp, 'dnhbad', 'loop', 'sB');
    fs.mkdirSync(dnhBad, { recursive: true });
    fs.writeFileSync(path.join(dnhBad, 'summary.json'), JSON.stringify({ skill: 'sB', iterations_run: 2, best_iteration: 1, selected_by: 'validation_pass_rate', baseline_validation_rate: 0.5, best_validation_rate: 0.9, regressed_query_count: 2, converged: true, proposed_description: 'regressing desc' }));
    assert.strictEqual(checkDoNoHarm(path.join(tmp, 'dnhbad')).ok, false, 'do-no-harm FAIL: a proposed diff with nonzero regression is blocked');

    // ---- 4. write-path (D6) ----
    const wpOk = path.join(tmp, 'wpok', 'out');
    fs.mkdirSync(path.join(wpOk, 'report'), { recursive: true });
    fs.writeFileSync(path.join(wpOk, 'report', 'report.json'), '{}');
    assert.strictEqual(checkWritePath(wpOk).ok, true, 'write-path PASS: a plain out file resolves under out');
    const wpBad = path.join(tmp, 'wpbad', 'out', 'scratch', 'x');
    fs.mkdirSync(wpBad, { recursive: true });
    // A symlink that escapes into the real skills/ tree must be caught by realpath.
    try { fs.symlinkSync(path.join(REPO_ROOT, 'skills'), path.join(wpBad, 'skills-link')); } catch (_e) { /* symlink unsupported -> predicate-only fallback below */ }
    const wpBadRes = checkWritePath(path.join(tmp, 'wpbad', 'out'));
    assert.strictEqual(wpBadRes.ok, false, 'write-path FAIL: a symlink resolving into skills/ is an escape');
    // Predicate itself: a crafted realpath under scripts/ is forbidden; one under out is not.
    assert.ok(resolvesUnderForbidden(path.join(REPO_ROOT, 'scripts', 'x.cjs')), 'write-path predicate: scripts/ is forbidden');
    assert.strictEqual(resolvesUnderForbidden(path.join(REPO_ROOT, '.planning', 'x')), null, 'write-path predicate: an out-side path is allowed');

    // ---- 5. evidence-quote (D4) ----
    const eqOk = path.join(tmp, 'eqok', 'review');
    fs.mkdirSync(eqOk, { recursive: true });
    // A verbatim line from a REAL .cjs (read at selftest time, like Plan 04's anchor test).
    const realFile = 'scripts/check-card-fire.cjs';
    const realText = fs.readFileSync(path.join(REPO_ROOT, realFile), 'utf8');
    const realLine = realText.split('\n').find((l) => l.trim().length > 20 && !l.trim().startsWith('*'));
    fs.writeFileSync(path.join(eqOk, 'findings.json'), JSON.stringify([{ skill: 'x', file: realFile, severity: 'medium', claim: 'c', evidence_quote: realLine, verdict: 'confirmed', refutation_attempt: 'r' }]));
    assert.strictEqual(checkEvidenceQuotes(path.join(tmp, 'eqok')).ok, true, 'evidence-quote PASS: a verbatim line from the real .cjs anchors');
    const eqBad = path.join(tmp, 'eqbad', 'review');
    fs.mkdirSync(eqBad, { recursive: true });
    fs.writeFileSync(path.join(eqBad, 'findings.json'), JSON.stringify([{ skill: 'x', file: realFile, severity: 'medium', claim: 'c', evidence_quote: realLine + ' ZZZ-paraphrase-not-in-file', verdict: 'confirmed', refutation_attempt: 'r' }]));
    assert.strictEqual(checkEvidenceQuotes(path.join(tmp, 'eqbad')).ok, false, 'evidence-quote FAIL: a paraphrased quote is not verbatim');

    // ---- 6. smoke-replay (D7) ----
    const labels = [
      { skill: 'doctor', role: 'clear_fire', expected_funnel: 'pass', expected_ws2: null, notes: 'x' },
      { skill: 'find-connections', role: 'near_miss_pair', expected_funnel: 'flagged', expected_ws2: null, notes: 'x' },
      { skill: 'rooms', role: 'ws2_defect', expected_funnel: null, expected_ws2: 'finding_expected', notes: 'x' },
      { skill: 'splash', role: 'not_evaluated_probe', expected_funnel: 'not_evaluated', expected_ws2: null, notes: 'x' },
    ];
    const labelsPath = path.join(tmp, 'smoke-labels.json');
    fs.writeFileSync(labelsPath, JSON.stringify(labels));
    // PASS: every labeled verdict agrees + the probe landed not_evaluated.
    const srOk = path.join(tmp, 'srok', 'funnel');
    fs.mkdirSync(srOk, { recursive: true });
    fs.writeFileSync(path.join(srOk, 'funnel-results.json'), JSON.stringify({ skills: [
      { skill: 'doctor', verdict: 'pass' }, { skill: 'find-connections', verdict: 'flagged' }, { skill: 'splash', verdict: 'not_evaluated' },
    ] }));
    const srOkRes = checkSmokeAgreement(path.join(tmp, 'srok'), labelsPath, 0.85);
    assert.strictEqual(srOkRes.ok, true, 'smoke-replay PASS: full agreement + probe landed not_evaluated');
    assert.strictEqual(srOkRes.agreement, 1, 'smoke-replay PASS: agreement 100%');
    // FAIL: agreement below tolerance (doctor mislabeled as flagged) AND probe absorbed as pass.
    const srBad = path.join(tmp, 'srbad', 'funnel');
    fs.mkdirSync(srBad, { recursive: true });
    fs.writeFileSync(path.join(srBad, 'funnel-results.json'), JSON.stringify({ skills: [
      { skill: 'doctor', verdict: 'flagged' }, { skill: 'find-connections', verdict: 'pass' }, { skill: 'splash', verdict: 'pass' },
    ] }));
    const srBadRes = checkSmokeAgreement(path.join(tmp, 'srbad'), labelsPath, 0.85);
    assert.strictEqual(srBadRes.ok, false, 'smoke-replay FAIL: agreement below tolerance and probe not landed');
    assert.ok(srBadRes.mismatches.length >= 1, 'smoke-replay FAIL: mismatches are named for the table');

    // SKIP behavior: an empty out dir skips every artifact-guarded check cleanly.
    const emptyOut = path.join(tmp, 'empty');
    fs.mkdirSync(emptyOut, { recursive: true });
    assert.strictEqual(checkReconciliation(emptyOut).skipped, true, 'SKIP: no ledgers -> reconciliation skips');
    assert.strictEqual(checkDoNoHarm(emptyOut).skipped, true, 'SKIP: no loop dir -> do-no-harm skips');
    assert.strictEqual(checkEvidenceQuotes(emptyOut).skipped, true, 'SKIP: no findings.json -> evidence-quote skips');
    assert.strictEqual(checkSmokeAgreement(emptyOut, labelsPath).skipped, true, 'SKIP: no funnel-results.json -> smoke-replay skips');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log('OK - skillopt-eval self-test passed: six checks, twelve PASS/FAIL fixture directions, plus clean SKIP guards.');
}

// ---------------------------------------------------------------------------
// --suite code: run all six over the real out dir. SKIP printed per missing input;
// exit nonzero only on a real FAIL (never on a SKIP).
// ---------------------------------------------------------------------------
function runSuiteCode(outDir, o) {
  console.log('=== skillopt-eval --suite code (deterministic, zero API spend) ===');
  let fails = 0;
  let skips = 0;
  for (const name of CHECK_NAMES) {
    const r = CHECKS[name](outDir, o);
    printResult(name, r);
    if (name === 'smoke-replay') printSmokeTable(r);
    if (r.skipped) skips += 1;
    else if (!r.ok) fails += 1;
  }
  console.log('roll-up: ' + (CHECK_NAMES.length - fails - skips) + ' PASS, ' + fails + ' FAIL, ' + skips + ' SKIP of ' + CHECK_NAMES.length + ' checks');
  process.exit(fails > 0 ? 1 : 0);
}

function runCheck(name, outDir, o) {
  if (!CHECK_NAMES.includes(name)) { console.error('Unknown --check ' + name + ' (known: ' + CHECK_NAMES.join(', ') + ')'); process.exit(2); }
  const r = CHECKS[name](outDir, o);
  printResult(name, r);
  if (name === 'smoke-replay') printSmokeTable(r);
  process.exit(r.skipped ? 0 : (r.ok ? 0 : 1));
}

function usage() {
  console.error([
    'Usage: node scripts/skillopt-eval.cjs <mode>',
    '  --selftest                        PASS+FAIL fixtures for every check (zero spawn)',
    '  --check <' + CHECK_NAMES.join('|') + '>',
    '  --suite code [--tolerance <0..1>] [--out DIR]',
  ].join('\n'));
}

function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--selftest')) { runSelftest(); return; }

  let outDir = path.join(REPO_ROOT, PHASE_OUT_DIR);
  const outIdx = args.indexOf('--out');
  if (outIdx >= 0 && args[outIdx + 1]) outDir = path.resolve(args[outIdx + 1]);

  let tolerance = DEFAULT_TOLERANCE;
  const tIdx = args.indexOf('--tolerance');
  if (tIdx >= 0 && args[tIdx + 1]) { const t = parseFloat(args[tIdx + 1]); if (!Number.isNaN(t)) tolerance = t; }
  const o = { tolerance };

  const suiteIdx = args.indexOf('--suite');
  if (suiteIdx >= 0 && args[suiteIdx + 1] === 'code') { runSuiteCode(outDir, o); return; }
  if (suiteIdx >= 0) { console.error('Unknown --suite ' + args[suiteIdx + 1] + ' (only "code")'); process.exit(2); }

  const checkIdx = args.indexOf('--check');
  if (checkIdx >= 0 && args[checkIdx + 1]) { runCheck(args[checkIdx + 1], outDir, o); return; }

  usage();
  process.exit(2);
}

module.exports = {
  checkReconciliation,
  checkDoNoHarm,
  checkWritePath,
  checkEvidenceQuotes,
  checkSmokeAgreement,
  checkSchemasRoundtrip,
  resolvesUnderForbidden,
  tallyLedger,
};

if (require.main === module) {
  main(process.argv);
}
