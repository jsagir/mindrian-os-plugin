#!/usr/bin/env node
'use strict';

/*
 * scripts/run-harness.cjs -- Phase 298 (SEED-032, Harness-as-Code) Plan 10.
 * =====================================================================
 * WHAT THIS IS: the policy runner. It reads `data/harness-policies/` (one
 * hand-authored JSON file per policy, validated against `_schema.json`'s
 * closed vocabularies), runs each policy at its declared tier and rung, and
 * prints (or spawns and reports) the verdict. This is the one genuinely new
 * artifact in Phase 298 -- everything else in the phase is declaration or
 * thin wrapping around a gate that already runs.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO:
 *   - It never repairs a room. It observes and reports; it writes nothing to
 *     a room at all in this plan (the single `<room>/.mindrian/harness-run.json`
 *     write lands with the `--room` convergence branch in plan 298-11).
 *   - It never calls a model, per SEED-062. Zero model calls, zero network
 *     requests, zero Brain-client reference, anywhere in this file.
 *   - It never promotes a rung (R-03, D8). No assignment to `rung` exists
 *     anywhere below; promotion stays a one-line human edit to a policy's own
 *     file, made after reading the `--policy` review this file prints.
 *   - It never opens a room database for writing (D-03a). None of the three
 *     write-path database openers this repo's D-03a source grep checks for
 *     are referenced anywhere in this file, and that stays true from this
 *     first commit even though the `--room` branch that would need a
 *     READ-ONLY door lands in plan 298-11, not here.
 *
 * EXIT CONVENTION: 0 clean (no blocking policy failed), 1 a blocking policy
 * failed (or a policy file failed schema validation), 2 a scanner or usage
 * fault (an unknown flag, a missing flag value, an unknown `--policy` id, or
 * the not-yet-implemented `--room` branch).
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
    '  --room <dir>          room convergence check (NOT YET IMPLEMENTED -- plan 298-11)',
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
// main(): argv switch loop copied in shape from check-worktree-hygiene.cjs
// (lines 396-448) -- unknown-flag and missing-value exit 2, --check an
// explicit no-op default. --room is accepted now (stable flag surface from
// the start) but prints a not-yet-implemented notice and exits 2 until plan
// 298-11 lands the branch.
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
    console.error(
      'run-harness: --room convergence branch is not yet implemented (lands in plan 298-11); received ' + roomDir
    );
    process.exit(2);
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
  main,
};

if (require.main === module) {
  main();
}
