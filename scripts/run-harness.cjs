#!/usr/bin/env node
'use strict';

/*
 * scripts/run-harness.cjs -- Phase 298 (SEED-032, Harness-as-Code) Plans
 * 10 and 11.
 * =====================================================================
 * WHAT THIS IS: the policy runner. It reads `data/harness-policies/` (one
 * hand-authored JSON file per policy, validated against `_schema.json`'s
 * closed vocabularies), runs each policy at its declared tier and rung, and
 * prints (or spawns and reports) the verdict. It also carries the `--room
 * <dir>` Layer 0 convergence scan (plan 298-11, R-04/R-05): a room is
 * converged when a ROOM.md sits in every non-hidden section, its STATE.md
 * `total_entries` matches the on-disk count, the derive queue is empty,
 * zero truth-claim nodes are pending human confirmation, and the
 * `gate-graph-derive-health` policy is not a ghost. This is the one
 * genuinely new artifact in Phase 298 -- everything else in the phase is
 * declaration or thin wrapping around a gate that already runs.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO:
 *   - It never repairs a room. It observes and reports; the ONLY write it
 *     ever makes is `<room>/.mindrian/harness-run.json`, and only when a
 *     `.mindrian` directory already exists in that room -- it never creates
 *     that directory itself, so a run against the committed
 *     `data/harness-fixtures/converged-room` fixture (which deliberately
 *     ships with no `.mindrian/`) writes NOTHING AT ALL.
 *   - It never calls a model, per SEED-062. Zero model calls, zero network
 *     requests, zero Brain-client reference, anywhere in this file.
 *   - It never promotes a rung (R-03, D8). No assignment to `rung` exists
 *     anywhere below; promotion stays a one-line human edit to a policy's own
 *     file, made after reading the `--policy` review this file prints.
 *   - It never opens a room database for writing (D-03a). None of the three
 *     write-path database openers this repo's D-03a source grep checks for
 *     are referenced anywhere in this file; the `--room` branch's only
 *     database door is the READ-ONLY `navigation.openRoomDbReadOnlyForCaller`.
 *
 * EXIT CONVENTION: 0 clean (no blocking policy failed, or a `--room` scan
 * reports converged), 1 a blocking policy failed (or a policy file failed
 * schema validation), or a `--room` scan reports not converged; 2 a scanner
 * or usage fault (an unknown flag, a missing flag value, an unknown
 * `--policy` id, or a `--room` path that does not exist or is not a
 * directory).
 *
 * Canon Part 8 (Graph Boundary): every operation here is a local filesystem
 * read, a local JSON parse, or a local `spawnSync('node', [...])` of a
 * repo-relative script. Zero network, zero egress, ever.
 *
 * EVIDENCE-LOG WRITE, A DOCUMENTED SCOPE BOUNDARY: this phase ships exactly
 * one evidence-log writer (`lib/hmi/voice-style-log.cjs::appendVoiceStyleRow`),
 * and it targets one fixed file (`$MINDRIAN_HOME/voice-style.jsonl`), tagging
 * each row with `policy_id` so multiple policies' evidence coexists there,
 * distinguished on read by that field. A `logged`-rung policy's own declared
 * `evidence_log` path is what the `--policy` review below reads FROM (so a
 * policy whose schema entry points at a different file, e.g.
 * `gate-card-fire.json`'s `$MINDRIAN_HOME/card-fire-intercepts.log`, is read
 * from that path, not from voice-style.jsonl); this runner's own `--check`
 * append always goes through the one shared writer. Building a second,
 * per-path evidence writer is out of scope for this plan (Rule 4 territory,
 * not decided here) and is not needed by anything this plan's tests assert.
 *
 * Split `main()` from the module body (`require.main === module`) so a test
 * can exercise `loadPolicies`, `classifyPolicy`, the tier filter and the
 * report builder in-process without spawning a child process.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { appendVoiceStyleRow, readVoiceStyleRows, evaluatePromotion, mindrianHome } = require('../lib/hmi/voice-style-log.cjs');
const { readQueue } = require('./gsd-graph-derive-sweep.cjs');
const navigation = require('../lib/core/navigation.cjs');
const { findGovernanceCandidates } = require('../lib/core/navigation/governance.cjs');

// GATE_GRAPH_DERIVE_HEALTH_ID: the one policy id the convergence scan checks
// by name for R-05's ghost-refusal rule. Not a magic string re-typed at each
// call site.
const GATE_GRAPH_DERIVE_HEALTH_ID = 'gate-graph-derive-health';

// HARNESS_RUN_REPORT_RELATIVE: the single write target the --room branch is
// ever allowed to touch, and only when `.mindrian` already exists in the
// target room (see scanRoom's own header comment for the fixture reasoning).
const HARNESS_RUN_REPORT_RELATIVE = path.join('.mindrian', 'harness-run.json');

// REQUIRED_POLICY_FIELDS: the eleven common fields every policy file carries,
// per _schema.json's policy_fields. memory-write-policy.json and
// contract-parity-larry.json each carry additional keys beyond these eleven;
// extra keys are never a validation failure, only a MISSING one of these is.
const REQUIRED_POLICY_FIELDS = [
  'id', 'kind', 'runner', 'args', 'rung', 'evidence_log',
  'promotion_rule', 'owner', 'pinned_by', 'applies_to', 'notes',
];

// SPAWN_TIMEOUT_MS: a runaway policy runner must not hang the whole tier
// check forever. 120s mirrors the longest spawnSync timeout already used
// elsewhere in this repo (scripts/check-worktree-hygiene.cjs's git plumbing
// calls).
const SPAWN_TIMEOUT_MS = 120000;

// FINDING_TEXT_CAP: a spawned policy's stdout/stderr excerpt is capped, never
// printed or logged in full -- mirrors VOICE_STYLE_DETAIL_CAP's own reasoning
// (an untrusted script's own output should never write an unbounded amount of
// text to a report or a log).
const FINDING_TEXT_CAP = 500;

// LAST_N_FINDINGS: the `--policy` review prints at most this many of the most
// recent evidence-log rows for the reviewed policy. Named constant per the
// plan's own requirement, not a magic number inlined at the print site.
const LAST_N_FINDINGS = 10;

// MINDRIAN_HOME_TOKEN: the literal placeholder policy files use in their
// `evidence_log` field (e.g. "$MINDRIAN_HOME/voice-style.jsonl"). Never a
// real environment-variable expansion (no shell involved anywhere in this
// file); resolved by simple string substitution against `mindrianHome()`.
const MINDRIAN_HOME_TOKEN = '$MINDRIAN_HOME';

function usage() {
  return [
    'run-harness.cjs -- the harness policy runner (Phase 298, SEED-032).',
    '',
    'Flags:',
    '  --check              run policies and report (default action)',
    '  --tier <t>            restrict --check to policies whose applies_to contains <t>',
    '  --policy <id>         print the promotion review for one policy (never spawns)',
    '  --room <dir>          Layer 0 room convergence check (R-04/R-05); read-only, writes',
    '                        <room>/.mindrian/harness-run.json only when that dir already exists',
    '  --json                emit the --check report as one JSON object',
    '  --root <dir>          operate against <dir> instead of the live repo root (tests use this)',
    '  --help                show this message',
    '',
    'Exit codes: 0 clean, 1 a blocking policy failed (or a policy file failed',
    'validation), 2 a scanner or usage fault.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// loadPolicies(rootDir): reads data/harness-policies/, skipping _schema.json
// and any non-JSON file. Each file is parsed and validated inside its own
// try/catch so ONE malformed or schema-invalid file is reported by name and
// skipped from the run while the overall run still fails (T-298-05). A
// missing directory degrades to an empty policy set with a stated reason,
// never a throw (the "degrade, never throw, on every read" pattern).
// ---------------------------------------------------------------------------
function loadSchemaVocab(rootDir) {
  const schemaPath = path.join(rootDir, 'data', 'harness-policies', '_schema.json');
  try {
    const raw = fs.readFileSync(schemaPath, 'utf8');
    const parsed = JSON.parse(raw);
    const doc = parsed && typeof parsed === 'object' && parsed._doc ? parsed._doc : {};
    return {
      rung: Array.isArray(doc.rung_vocabulary) ? doc.rung_vocabulary : null,
      kind: Array.isArray(doc.kind_vocabulary) ? doc.kind_vocabulary : null,
      appliesTo: Array.isArray(doc.applies_to_vocabulary) ? doc.applies_to_vocabulary : null,
    };
  } catch (_e) {
    // Missing or malformed schema: degrade to "no vocabulary known", which
    // skips those specific validation checks rather than rejecting every
    // policy file outright.
    return { rung: null, kind: null, appliesTo: null };
  }
}

function validatePolicyShape(policy, filename, vocab) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    return { ok: false, reason: 'top-level value is not a JSON object' };
  }
  for (const field of REQUIRED_POLICY_FIELDS) {
    if (!(field in policy)) {
      return { ok: false, reason: 'missing required field "' + field + '"' };
    }
  }
  const expectedId = filename.slice(0, filename.length - '.json'.length);
  if (policy.id !== expectedId) {
    return { ok: false, reason: 'id "' + policy.id + '" does not match filename "' + filename + '"' };
  }
  if (vocab.kind && !vocab.kind.includes(policy.kind)) {
    return { ok: false, reason: 'unknown kind "' + policy.kind + '"' };
  }
  if (vocab.rung && !vocab.rung.includes(policy.rung)) {
    return { ok: false, reason: 'unknown rung "' + policy.rung + '"' };
  }
  if (vocab.appliesTo && Array.isArray(policy.applies_to)) {
    for (const tier of policy.applies_to) {
      if (!vocab.appliesTo.includes(tier)) {
        return { ok: false, reason: 'unknown applies_to member "' + tier + '"' };
      }
    }
  }
  if (policy.runner !== null && typeof policy.runner !== 'string') {
    return { ok: false, reason: 'runner must be null or a string' };
  }
  return { ok: true, reason: null };
}

function loadPolicies(rootDir) {
  const dir = path.join(rootDir, 'data', 'harness-policies');
  if (!fs.existsSync(dir)) {
    return { policies: [], errors: [], reason: 'data/harness-policies/ not found; degrading to an empty policy set' };
  }
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return { policies: [], errors: [], reason: 'could not read data/harness-policies/: ' + (e && e.message ? e.message : e) };
  }
  const vocab = loadSchemaVocab(rootDir);
  const names = entries
    .filter((e) => e.isFile() && e.name.endsWith('.json') && e.name !== '_schema.json')
    .map((e) => e.name)
    .sort();

  const policies = [];
  const errors = [];
  for (const name of names) {
    const fp = path.join(dir, name);
    let raw;
    try {
      raw = fs.readFileSync(fp, 'utf8');
    } catch (eRead) {
      errors.push({ file: name, reason: 'read failure: ' + (eRead && eRead.message ? eRead.message : eRead) });
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (eParse) {
      errors.push({ file: name, reason: 'JSON parse failure: ' + (eParse && eParse.message ? eParse.message : eParse) });
      continue;
    }
    const validation = validatePolicyShape(parsed, name, vocab);
    if (!validation.ok) {
      errors.push({ file: name, reason: validation.reason });
      continue;
    }
    policies.push(parsed);
  }
  return { policies, errors, reason: null };
}

// ---------------------------------------------------------------------------
// resolveRunnerPath / classifyPolicy: the runner_path_rule enforcement
// (T-298-03, elevation of privilege). runner is either null (an honest
// declared ghost) or a repo-relative path resolved against rootDir and
// rejected if it is absolute, contains a parent-directory segment, or
// escapes the repository root once resolved.
// ---------------------------------------------------------------------------
function resolveRunnerPath(policy, rootDir) {
  const runner = policy && policy.runner;
  if (runner === null || runner === undefined) {
    return { ok: false, resolved: null, reason: 'runner is null (declared ghost, honest by design -- nothing to spawn)' };
  }
  if (typeof runner !== 'string') {
    return { ok: false, resolved: null, reason: 'runner is not a string or null' };
  }
  if (path.isAbsolute(runner)) {
    return { ok: false, resolved: null, reason: 'runner path is absolute, rejected by runner_path_rule: ' + runner };
  }
  if (runner.split('/').includes('..')) {
    return { ok: false, resolved: null, reason: 'runner path contains a parent-directory segment, rejected by runner_path_rule: ' + runner };
  }
  const rootResolved = path.resolve(rootDir);
  const resolved = path.resolve(rootResolved, runner);
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
    return { ok: false, resolved: null, reason: 'runner path escapes the repository root, rejected by runner_path_rule: ' + runner };
  }
  if (!fs.existsSync(resolved)) {
    return { ok: false, resolved: null, reason: 'runner file does not exist on disk: ' + runner };
  }
  return { ok: true, resolved, reason: null };
}

// classifyPolicy(policy, rootDir): returns 'ghost' or 'runnable'. A policy is
// a ghost when runner is null OR the resolved runner file does not exist (or
// fails runner_path_rule) -- never counted as passing, never blocking.
function classifyPolicy(policy, rootDir) {
  const r = resolveRunnerPath(policy, rootDir);
  return r.ok ? 'runnable' : 'ghost';
}

// ---------------------------------------------------------------------------
// filterByTier: the tier filter the plan's exports list names explicitly.
// ---------------------------------------------------------------------------
function filterByTier(policies, tier) {
  if (!tier) return policies.slice();
  return policies.filter((p) => Array.isArray(p.applies_to) && p.applies_to.includes(tier));
}

// ---------------------------------------------------------------------------
// evaluatePolicies: the three rung semantics.
//   declared -- report only, never spawned.
//   logged   -- spawn, append exactly one evidence row, never fails the tier
//               regardless of exit status (the LangTalks takeaway 5 policy-
//               violation-vs-transient distinction lives here too: a spawn
//               that fails to START is recorded and the run continues; it
//               never sets blockingFailed regardless of rung, because it is
//               not evidence the POLICY was violated, only that the spawn
//               itself could not start).
//   blocking -- spawn; a non-zero exit status fails the tier (exit 1).
// A ghost is reported as 'ghost' in every case: never counted as passing,
// never blocking, regardless of its declared rung.
// ---------------------------------------------------------------------------
function buildResult(policy, verdict, exitStatus, finding) {
  return { id: policy.id, kind: policy.kind, rung: policy.rung, verdict, exit_status: exitStatus, finding };
}

function buildFindingText(spawnResult) {
  if (spawnResult.status === 0) return 'exit 0';
  const stderrText = (spawnResult.stderr || '').trim();
  const stdoutText = (spawnResult.stdout || '').trim();
  const text = stderrText || stdoutText || 'exit ' + spawnResult.status;
  return text.length > FINDING_TEXT_CAP ? text.slice(0, FINDING_TEXT_CAP) + '...' : text;
}

function appendEvidenceRow(policy, finding) {
  // appendVoiceStyleRow is itself swallow-all (never throws); see the module
  // header. Never blocks the tier evaluation on a diagnostic write.
  appendVoiceStyleRow({ policy_id: policy.id, result: 'fire', detail: finding, session_id: '' });
}

function evaluatePolicies(policies, rootDir) {
  const results = [];
  let blockingFailed = false;

  for (const policy of policies) {
    const cls = classifyPolicy(policy, rootDir);
    if (cls === 'ghost') {
      const detail = resolveRunnerPath(policy, rootDir);
      results.push(buildResult(policy, 'ghost', null, detail.reason || 'runner unavailable'));
      continue;
    }

    if (policy.rung === 'declared') {
      results.push(buildResult(policy, 'declared', null, 'declared rung: report only, not spawned'));
      continue;
    }

    const resolved = resolveRunnerPath(policy, rootDir).resolved;
    const args = Array.isArray(policy.args) ? policy.args : [];
    // spawnSync ALWAYS with an argv array, never a shell string, and the
    // shell option is never enabled (T-298-03). input:'' closes stdin
    // immediately so a runner that reads stdin synchronously (e.g.
    // scripts/check-card-fire.cjs) never hangs waiting for data that will
    // never arrive.
    const spawnResult = spawnSync('node', [resolved].concat(args), {
      encoding: 'utf8',
      input: '',
      timeout: SPAWN_TIMEOUT_MS,
      cwd: rootDir,
    });

    if (spawnResult.error) {
      // The transient class (spawn failed to start): recorded, the run
      // continues, never sets blockingFailed regardless of rung.
      const finding = 'spawn failed to start: ' + spawnResult.error.message;
      if (policy.rung === 'logged') appendEvidenceRow(policy, finding);
      results.push(buildResult(policy, 'fail', null, finding));
      continue;
    }

    const exitStatus = spawnResult.status;
    const finding = buildFindingText(spawnResult);
    const verdict = exitStatus === 0 ? 'pass' : 'fail';

    if (policy.rung === 'logged') {
      appendEvidenceRow(policy, finding);
      results.push(buildResult(policy, verdict, exitStatus, finding));
      // logged never fails the tier, regardless of exit status.
    } else {
      // blocking: a non-zero exit is the policy-violation class and halts
      // the tier verdict with exit 1. No retry, ever (LangTalks takeaway 5).
      results.push(buildResult(policy, verdict, exitStatus, finding));
      if (exitStatus !== 0) blockingFailed = true;
    }
  }

  return { results, blockingFailed };
}

// ---------------------------------------------------------------------------
// The report builder: buildReportObject is the single source the --json
// branch serializes and the text branch summarizes, so the two can never
// disagree about counts.
// ---------------------------------------------------------------------------
function buildCounts(results) {
  const counts = { total: results.length, pass: 0, fail: 0, ghost: 0, declared: 0 };
  for (const r of results) {
    if (r.verdict === 'pass') counts.pass += 1;
    else if (r.verdict === 'fail') counts.fail += 1;
    else if (r.verdict === 'ghost') counts.ghost += 1;
    else if (r.verdict === 'declared') counts.declared += 1;
  }
  return counts;
}

function buildReportObject(tier, results) {
  return { tier: tier || 'all', counts: buildCounts(results), policies: results };
}

function printReport(tier, results, asJson) {
  if (asJson) {
    // Exactly one console.log(JSON.stringify(obj, null, 2)) carrying tier,
    // counts, and the per-policy array. No timestamp or clock-derived field
    // anywhere in this object -- the doctor acceptance point in plan 298-15
    // parses this shape verbatim, so it must stay deterministic.
    console.log(JSON.stringify(buildReportObject(tier, results), null, 2));
    return;
  }
  console.log('run-harness: tier=' + (tier || 'all') + ' policies=' + results.length);
  for (const r of results) {
    console.log(r.id + '  ' + r.rung + '  ' + r.verdict + '  ' + r.finding);
  }
  const counts = buildCounts(results);
  console.log('');
  console.log(
    'Totals: ' + counts.pass + ' pass, ' + counts.fail + ' fail, ' + counts.ghost + ' ghost, ' +
      counts.declared + ' declared, ' + counts.total + ' total.'
  );
}

function runCheckAndReport(rootDir, tier, asJson) {
  const load = loadPolicies(rootDir);
  for (const err of load.errors) {
    console.error('run-harness: policy file ' + err.file + ' invalid: ' + err.reason + ' (skipped)');
  }
  const filtered = filterByTier(load.policies, tier);
  const { results, blockingFailed } = evaluatePolicies(filtered, rootDir);
  printReport(tier, results, asJson);
  process.exit(blockingFailed || load.errors.length > 0 ? 1 : 0);
}

// ---------------------------------------------------------------------------
// --policy <id>: the promotion review. THE PRINTER COMPUTES NOTHING. This
// applies the 2026-07-11 printer-must-match-counter lesson (recorded
// verbatim at lib/core/doctor/card-fire-health-module.cjs:8-10) exactly:
// evaluatePromotion is called ONCE and every number and the verdict below
// come from its single return; this function only formats.
// ---------------------------------------------------------------------------
function resolveEvidenceLogPath(evidenceLog) {
  if (typeof evidenceLog !== 'string' || evidenceLog.length === 0) return null;
  if (evidenceLog === MINDRIAN_HOME_TOKEN || evidenceLog.indexOf(MINDRIAN_HOME_TOKEN + '/') === 0) {
    const rest = evidenceLog.slice(MINDRIAN_HOME_TOKEN.length);
    return path.join(mindrianHome(), rest);
  }
  return evidenceLog;
}

function formatVerdictLine(verdict) {
  // Formatted so a future doctor acceptance point (plan 298-15) can echo
  // this verbatim as its finding suffix, matching the scripts/doctor.cjs
  // PASS/FAIL + '  -- ' + finding idiom at scripts/doctor.cjs:3008-3010.
  const tag = verdict.met ? 'promotion rule MET' : 'promotion rule NOT MET';
  const reasonsText = Array.isArray(verdict.reasons) && verdict.reasons.length ? verdict.reasons.join('; ') : '';
  return reasonsText ? tag + '  -- ' + reasonsText : tag;
}

function runPolicyReview(rootDir, policyId) {
  const load = loadPolicies(rootDir);
  const policy = load.policies.find((p) => p.id === policyId);
  if (!policy) {
    const available = load.policies.map((p) => p.id).sort();
    console.error('run-harness: unknown policy id "' + policyId + '" (available: ' + (available.length ? available.join(', ') : 'none') + ')');
    process.exit(2);
    return;
  }

  const logPath = resolveEvidenceLogPath(policy.evidence_log);
  const logExists = logPath ? fs.existsSync(logPath) : false;
  const allRows = logPath ? readVoiceStyleRows(logPath) : [];
  const rows = allRows.filter((r) => r && typeof r === 'object' && r.policy_id === policy.id);

  // ONE evaluator call. Every count and the verdict below are its return
  // value, formatted, never recomputed.
  const verdict = evaluatePromotion(policy, rows);

  console.log('policy: ' + policy.id + ' (kind ' + policy.kind + ', rung ' + policy.rung + ')');
  if (!logPath) {
    console.log('evidence log: none declared for this policy -- absent log');
  } else if (!logExists) {
    console.log('evidence log: ' + logPath + ' (not found on disk yet -- absent log)');
  } else {
    console.log('evidence log: ' + logPath);
  }
  console.log('window_runs: ' + verdict.window_runs);
  console.log('fires: ' + verdict.fires);
  console.log('true_positives: ' + verdict.true_positives);
  console.log('false_positives: ' + verdict.false_positives);
  console.log('false_positive_rate: ' + (verdict.false_positive_rate === null ? 'null' : verdict.false_positive_rate.toFixed(4)));

  const lastFindings = rows.slice(-LAST_N_FINDINGS);
  console.log('last ' + LAST_N_FINDINGS + ' findings:');
  if (lastFindings.length === 0) {
    console.log('  (none' + (logPath && !logExists ? ' -- evidence log not found on disk yet' : '') + ')');
  } else {
    for (const row of lastFindings) {
      console.log('  ' + (row.timestamp || '') + '  ' + (row.result || 'fire') + '  ' + (row.detail || ''));
    }
  }

  console.log(formatVerdictLine(verdict));
  if (verdict.met && verdict.edit_line) {
    console.log('edit: ' + verdict.edit_line);
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// --room <dir>: the Layer 0 convergence branch (plan 298-11, R-04/R-05).
// Convergence is a SCAN, not a memory -- every check below reads the room's
// own files (and, for zero_proposed_claims, a READ-ONLY door into room.db)
// fresh on every call. The runner never repairs a room (SEED-037 4c is a
// separate, human-gated action) and never regenerates STATE.md, so it never
// self-invalidates against the very timestamp it must not compare.
// ---------------------------------------------------------------------------

// parseRoomStateFrontmatter(roomDir): a minimal line-based reader of the
// STATE.md frontmatter block, pulling exactly the two keys this scan needs.
// `total_entries` (compute-state:259) is the ONLY comparable count.
// `computed` (compute-state:257) is an ISO timestamp -- read here so the
// report can carry it as a freshness stamp, and NEVER compared against
// anything (Pitfall 1). `venture_stage` is deliberately never read at all:
// a scaffold-born room writes Pre-Opportunity while compute-state
// re-derives Investment purely from directory presence, so the two
// structurally disagree on any full scaffold (D-03, Correction 3) and
// comparing it would make every fresh scaffold report non-convergent.
function parseRoomStateFrontmatter(roomDir) {
  try {
    const raw = fs.readFileSync(path.join(roomDir, 'STATE.md'), 'utf8');
    const match = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return { total_entries: null, computed: null };
    let totalEntries = null;
    let computed = null;
    for (const line of match[1].split('\n')) {
      const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
      if (!kv) continue;
      if (kv[1] === 'total_entries') {
        const n = parseInt(kv[2].trim(), 10);
        totalEntries = Number.isNaN(n) ? null : n;
      } else if (kv[1] === 'computed') {
        computed = kv[2].trim();
      }
    }
    return { total_entries: totalEntries, computed };
  } catch (_e) {
    return { total_entries: null, computed: null };
  }
}

// listNonHiddenTopDirs(roomDir): the same section enumeration rule
// compute-state:91 uses (skip anything starting with a dot). Enumerated
// fresh from disk every call -- never the frozen SECTION_NAMES list -- so a
// room that grew a section outside the frozen eleven is still checked.
function listNonHiddenTopDirs(roomDir) {
  let entries;
  try {
    entries = fs.readdirSync(roomDir, { withFileTypes: true });
  } catch (_e) {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
}

// countEntries(roomDir): reproduces compute-state:96 exactly -- top-level
// non-hidden directories only, `*.md` at maxdepth 1, excluding `ROOM.md`,
// never recursed, never counting files at the room root. Returns 13 on the
// committed scaffold-born fixture (Correction 2).
function countEntries(roomDir) {
  let total = 0;
  for (const name of listNonHiddenTopDirs(roomDir)) {
    const sectionDir = path.join(roomDir, name);
    let files;
    try {
      files = fs.readdirSync(sectionDir, { withFileTypes: true });
    } catch (_e) {
      continue;
    }
    for (const f of files) {
      if (!f.isFile()) continue;
      if (!f.name.endsWith('.md')) continue;
      if (f.name === 'ROOM.md') continue;
      total += 1;
    }
  }
  return total;
}

// checkRoomMdPresent(roomDir): every non-hidden top-level directory holds a
// ROOM.md. Enumerated from disk, never the frozen section list.
function checkRoomMdPresent(roomDir) {
  const missing = [];
  for (const name of listNonHiddenTopDirs(roomDir)) {
    if (!fs.existsSync(path.join(roomDir, name, 'ROOM.md'))) missing.push(name);
  }
  return { passed: missing.length === 0, missing };
}

// checkDeriveQueueEmpty(roomDir): reuses readQueue's missing-is-empty
// contract rather than re-reading the queue file (Reuse Before Build).
function checkDeriveQueueEmpty(roomDir) {
  const q = readQueue(roomDir);
  const entries = q && Array.isArray(q.entries) ? q.entries : [];
  return { passed: entries.length === 0, count: entries.length };
}

// countProposedClaims(roomDir): the ONLY database door this branch may use
// is navigation.openRoomDbReadOnlyForCaller (D-03a). Opened inside its own
// try/catch that yields null on any failure (including "no room.db exists",
// which is the committed fixture's own case -- it has no .mindrian/ at
// all); the null handle passes straight to findGovernanceCandidates, which
// is null-handle-safe and returns []. Closed in a finally when non-null.
function countProposedClaims(roomDir) {
  let db = null;
  try {
    db = navigation.openRoomDbReadOnlyForCaller(roomDir);
  } catch (_e) {
    db = null;
  }
  try {
    const candidates = findGovernanceCandidates(db, path.basename(roomDir), {});
    return Array.isArray(candidates) ? candidates.length : 0;
  } finally {
    if (db) {
      try {
        navigation.closeRoomDbForCaller(db);
      } catch (_e2) {
        /* ignore -- a close failure on a read-only handle is not this
           scan's concern */
      }
    }
  }
}

// scanRoom(roomDir, policies, rootDir): the report builder. `policies` is
// the already-loaded policy set (loadPolicies(rootDir).policies) so this
// function re-implements no policy loading; `rootDir` is passed through to
// classifyPolicy for the gate-graph-derive-health ghost check, since a
// runner path is always resolved relative to the POLICY root, never the
// room being scanned (these differ under --root in the ghost-refusal test).
// `converged` is true only when every check passes AND derive_health_declared
// is true AND the derive queue is empty (R-05: a ghost derive-health gate is
// the missing-information error class -- refuse converged:true, name the
// ghost, never retry).
function scanRoom(roomDir, policies, rootDir) {
  const effectiveRoot = rootDir || roomDir;
  const findings = [];

  const roomMd = checkRoomMdPresent(roomDir);
  if (!roomMd.passed) {
    findings.push('room_md_present: missing ROOM.md in ' + roomMd.missing.join(', '));
  }

  const frontmatter = parseRoomStateFrontmatter(roomDir);
  const onDisk = countEntries(roomDir);
  const entryCountMatches = frontmatter.total_entries !== null && frontmatter.total_entries === onDisk;
  if (!entryCountMatches) {
    findings.push(
      'entry_count_matches: STATE.md total_entries=' + String(frontmatter.total_entries) + ' vs on-disk=' + onDisk
    );
  }

  const queueCheck = checkDeriveQueueEmpty(roomDir);
  if (!queueCheck.passed) {
    findings.push('derive_queue_empty: ' + queueCheck.count + ' entries pending in the derive queue');
  }

  const proposedCount = countProposedClaims(roomDir);
  const zeroProposedClaims = proposedCount === 0;
  if (!zeroProposedClaims) {
    findings.push('zero_proposed_claims: ' + proposedCount + ' proposed truth-claim node(s) pending human confirmation');
  }

  const derivePolicy = Array.isArray(policies) ? policies.find((p) => p.id === GATE_GRAPH_DERIVE_HEALTH_ID) : undefined;
  let deriveHealthDeclared = false;
  if (!derivePolicy) {
    findings.push('derive_health_declared: policy "' + GATE_GRAPH_DERIVE_HEALTH_ID + '" is not loaded');
  } else {
    deriveHealthDeclared = classifyPolicy(derivePolicy, effectiveRoot) === 'runnable';
    if (!deriveHealthDeclared) {
      const detail = resolveRunnerPath(derivePolicy, effectiveRoot);
      findings.push(
        'derive_health_declared: "' + GATE_GRAPH_DERIVE_HEALTH_ID + '" is a ghost (' + (detail.reason || 'runner unavailable') + ')'
      );
    }
  }

  const checks = {
    room_md_present: roomMd.passed,
    entry_count_matches: entryCountMatches,
    derive_queue_empty: queueCheck.passed,
    zero_proposed_claims: zeroProposedClaims,
    derive_health_declared: deriveHealthDeclared,
  };

  const converged =
    Object.keys(checks).every((k) => checks[k] === true) && deriveHealthDeclared && queueCheck.passed;

  // Deterministic key order (no timestamp, no duration, no clock-derived
  // value anywhere in this object) so two consecutive runs against an
  // unchanged room serialize byte-identically (R-04's headline proof).
  return {
    room: roomDir,
    converged,
    checks,
    total_entries_declared: frontmatter.total_entries,
    total_entries_on_disk: onDisk,
    computed_stamp: frontmatter.computed,
    findings,
  };
}

// printRoomReport: text or --json, mirroring printReport's own asJson branch.
function printRoomReport(report, asJson) {
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log('run-harness --room ' + report.room);
  console.log('converged: ' + report.converged);
  console.log('checks:');
  for (const key of Object.keys(report.checks)) {
    console.log('  ' + key + ': ' + report.checks[key]);
  }
  console.log('total_entries: declared=' + report.total_entries_declared + ' on_disk=' + report.total_entries_on_disk);
  console.log('computed_stamp: ' + report.computed_stamp);
  if (report.findings.length) {
    console.log('findings:');
    for (const f of report.findings) console.log('  - ' + f);
  }
}

// maybeWriteRoomReport(roomDir, report): the single write this branch is
// ever allowed to make, and ONLY when a `.mindrian` directory already
// exists in the room. The runner never creates that directory itself (the
// forbidden write-path opener named in this file's header comment would do
// that on first touch, and D-03a forbids calling it here). The committed
// data/harness-fixtures/converged-room fixture deliberately ships with no
// `.mindrian/`, so a run against it writes NOTHING AT ALL -- which is
// exactly what keeps `git status --porcelain
// data/harness-fixtures/converged-room` empty after every run.
function maybeWriteRoomReport(roomDir, report) {
  const mindrianDir = path.join(roomDir, '.mindrian');
  let mindrianExists = false;
  try {
    mindrianExists = fs.statSync(mindrianDir).isDirectory();
  } catch (_e) {
    mindrianExists = false;
  }
  if (!mindrianExists) return false;
  try {
    fs.writeFileSync(path.join(mindrianDir, 'harness-run.json'), JSON.stringify(report, null, 2) + '\n');
    return true;
  } catch (_e) {
    return false;
  }
}

// runRoomConvergence: the --room CLI entry point. Exit 0 converged, 1 not
// converged, 2 a scanner fault (the room path itself does not exist or is
// not a directory, or the scan throws) -- a missing ROOM.md or a queue
// mismatch is NEVER a fault, it is an honest not-converged verdict (exit 1).
function runRoomConvergence(root, roomDir, asJson) {
  let stat;
  try {
    stat = fs.statSync(roomDir);
  } catch (_e) {
    console.error('run-harness: --room directory does not exist: ' + roomDir);
    process.exit(2);
    return;
  }
  if (!stat.isDirectory()) {
    console.error('run-harness: --room path is not a directory: ' + roomDir);
    process.exit(2);
    return;
  }

  const loaded = loadPolicies(root);
  for (const err of loaded.errors) {
    console.error('run-harness: policy file ' + err.file + ' invalid: ' + err.reason + ' (skipped)');
  }

  let report;
  try {
    report = scanRoom(roomDir, loaded.policies, root);
  } catch (e) {
    console.error('run-harness: --room scan faulted: ' + (e && e.message ? e.message : e));
    process.exit(2);
    return;
  }

  printRoomReport(report, asJson);
  maybeWriteRoomReport(roomDir, report);
  process.exit(report.converged ? 0 : 1);
}

// ---------------------------------------------------------------------------
// main(): argv switch loop copied in shape from check-worktree-hygiene.cjs
// (lines 396-448) -- unknown-flag and missing-value exit 2, --check an
// explicit no-op default. --room dispatches to runRoomConvergence (plan
// 298-11).
// ---------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) {
    console.log(usage());
    process.exit(0);
  }

  let root = path.resolve(__dirname, '..');
  let tier = null;
  let policyId = null;
  let roomDir = null;
  let asJson = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') {
      const value = argv[i + 1];
      if (!value) {
        console.error('run-harness: --root was given with no directory argument');
        process.exit(2);
      }
      root = path.resolve(value);
      i++;
    } else if (a === '--tier') {
      const value = argv[i + 1];
      if (!value) {
        console.error('run-harness: --tier was given with no value argument');
        process.exit(2);
      }
      tier = value;
      i++;
    } else if (a === '--policy') {
      const value = argv[i + 1];
      if (!value) {
        console.error('run-harness: --policy was given with no id argument');
        process.exit(2);
      }
      policyId = value;
      i++;
    } else if (a === '--room') {
      const value = argv[i + 1];
      if (!value) {
        console.error('run-harness: --room was given with no directory argument');
        process.exit(2);
      }
      roomDir = value;
      i++;
    } else if (a === '--json') {
      asJson = true;
    } else if (a === '--check') {
      /* default action, accepted explicitly as a no-op */
    } else {
      console.error('run-harness: unknown flag ' + a + ' (see --help)');
      process.exit(2);
    }
  }

  if (policyId) {
    runPolicyReview(root, policyId);
    return;
  }

  if (roomDir) {
    runRoomConvergence(root, roomDir, asJson);
    return;
  }

  runCheckAndReport(root, tier, asJson);
}

module.exports = {
  loadPolicies,
  classifyPolicy,
  resolveRunnerPath,
  filterByTier,
  evaluatePolicies,
  buildCounts,
  buildReportObject,
  printReport,
  resolveEvidenceLogPath,
  formatVerdictLine,
  countEntries,
  scanRoom,
  main,
};

if (require.main === module) {
  main();
}
