#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 199-07 (AS-09) -- the AgentShield PR-gate scan CLI.
 * ==========================================================================
 * A thin CLI over the shipped 199-04 orchestrator
 * (lib/core/security/agentshield-run.cjs). It runs the LOCAL scan across the
 * 5 non-Brain surfaces and enforces BASELINE-DELTA semantics: only a finding
 * that is NOT already recorded in references/security/agentshield-baseline.json
 * fails the gate. Legacy / accepted findings live in the committed baseline and
 * never retroactively block a PR (false positives cannot wedge a legacy PR).
 *
 * Modes (argv/exit-code conventions cloned from scripts/part8-egress-guard-hook.cjs):
 *   (default)          run the scan, diff findings against the baseline, print a
 *                      human-readable report; exit 1 if any NEW finding exists,
 *                      exit 0 otherwise.
 *   --json             machine-readable report on stdout (the report object plus
 *                      the computed newFindings + exitCode); still exits 1 on a
 *                      new finding so CI fails on either invocation.
 *   --write-baseline   overwrite references/security/agentshield-baseline.json
 *                      with the CURRENT scan's findings (an explicit, PR-reviewable
 *                      act, NEVER automatic); exit 0.
 *
 * Part 7 (reuse before build): the scan logic is NOT reimplemented -- it flows
 * through runAgentShieldScan() from 199-04, which itself reuses scanSurface() from
 * 199-03. Part 8 (LOCAL): no network wire opens here; every read is a repo-local
 * tracked file. The baseline is a tracked, PR-reviewed file: any edit to it is as
 * visible in the diff as any other change (T-199-07-02 mitigate).
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only. Pure CJS, zero deps.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const RUN_PATH = path.join(REPO_ROOT, 'lib', 'core', 'security', 'agentshield-run.cjs');
const BASELINE_PATH = path.join(REPO_ROOT, 'references', 'security', 'agentshield-baseline.json');
const BASELINE_REL = 'references/security/agentshield-baseline.json';

// ---------------------------------------------------------------------------
// The stable delta key for a finding: surface + id + ruleId. Two findings that
// share this triple are the SAME accepted/known finding; the baseline stores
// exactly these triples so a legacy finding never retroactively fails the gate.
// ---------------------------------------------------------------------------
function findingKey(f) {
  const o = (f && typeof f === 'object') ? f : {};
  const ruleId = (o.ruleId === null || o.ruleId === undefined) ? 'null' : String(o.ruleId);
  return String(o.surface) + '::' + String(o.id) + '::' + ruleId;
}

// A finding reduced to the committed triple shape (no reason bytes: the baseline
// records WHICH findings are accepted, never echoes matched target content).
function toTriple(f) {
  const o = (f && typeof f === 'object') ? f : {};
  return {
    surface: o.surface,
    id: o.id,
    ruleId: (o.ruleId === null || o.ruleId === undefined) ? null : o.ruleId,
  };
}

// ---------------------------------------------------------------------------
// loadBaseline() -> { keys: Set<string>, count: number }. Tolerant of both a
// bare array of triples and a structured object carrying a `findings` array (the
// shape --write-baseline emits). A missing / malformed baseline means nothing is
// accepted yet: every finding is NEW (fail-closed on delta, the safe default for
// a security gate).
// ---------------------------------------------------------------------------
function loadBaseline() {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  } catch (_e) {
    return { keys: new Set(), count: 0, missing: true };
  }
  let arr = [];
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.findings)) arr = parsed.findings;
  const keys = new Set();
  for (let i = 0; i < arr.length; i++) keys.add(findingKey(arr[i]));
  return { keys: keys, count: arr.length, missing: false };
}

// ---------------------------------------------------------------------------
// runScan() -> the 199-04 orchestrator report over the 5 non-Brain surfaces.
// ---------------------------------------------------------------------------
function runScan() {
  const runAgentShieldScan = require(RUN_PATH).runAgentShieldScan;
  return runAgentShieldScan({});
}

// ---------------------------------------------------------------------------
// writeBaseline(report) -- overwrite the committed baseline with the current
// scan's findings, reduced to triples. Explicit, PR-reviewable act.
// ---------------------------------------------------------------------------
function writeBaseline(report) {
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const triples = findings.map(toTriple);
  const doc = {
    schema_version: '1.0',
    artifact_kind: 'agentshield-baseline',
    note: 'Committed known/accepted AgentShield findings. The PR-gate CLI '
      + '(scripts/agentshield-scan-cli.cjs) fails ONLY on a finding whose '
      + 'surface+id+ruleId triple is NOT in this list (baseline-delta mode). '
      + 'Regenerate ONLY via `node scripts/agentshield-scan-cli.cjs '
      + '--write-baseline`; every change is PR-reviewable in the diff.',
    generated_at: new Date().toISOString(),
    generator: '199-07 agentshield-scan-cli --write-baseline',
    findings: triples,
  };
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  return triples.length;
}

// ---------------------------------------------------------------------------
// computeDelta(report, baseline) -> the findings NOT present in the baseline.
// ---------------------------------------------------------------------------
function computeDelta(report, baseline) {
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const out = [];
  for (let i = 0; i < findings.length; i++) {
    if (!baseline.keys.has(findingKey(findings[i]))) out.push(findings[i]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Human-readable report to stdout.
// ---------------------------------------------------------------------------
function printHumanReport(report, baseline, newFindings) {
  const lines = [];
  lines.push('AgentShield scan -- baseline-delta gate');
  lines.push('  scannedAt:     ' + (report.scannedAt || 'n/a'));
  lines.push('  baseline:      ' + BASELINE_REL
    + (baseline.missing ? ' (MISSING -- every finding treated as new)' : ' (' + baseline.count + ' accepted)'));
  lines.push('  totalFlagged:  ' + (report.totalFlagged || 0));
  lines.push('  totalAmbiguous:' + (report.totalAmbiguous || 0));
  lines.push('');
  lines.push('  per-surface:');
  const surfaces = report.surfaces || {};
  const names = Object.keys(surfaces);
  if (names.length === 0) {
    lines.push('    (no surfaces gathered)');
  } else {
    for (let i = 0; i < names.length; i++) {
      const s = surfaces[names[i]] || {};
      lines.push('    ' + names[i] + ': ' + (s.verdict || 'clean') + ' (' + (s.findingCount || 0) + ')');
    }
  }
  lines.push('');
  if (newFindings.length === 0) {
    lines.push('  NEW findings (not in baseline): none');
    lines.push('');
    lines.push('PASS: no new findings beyond the committed baseline. Gate exit 0.');
  } else {
    lines.push('  NEW findings (not in baseline): ' + newFindings.length);
    for (let i = 0; i < newFindings.length; i++) {
      const f = newFindings[i];
      lines.push('    - [' + f.surface + '] ' + f.id + ' ruleId=' + (f.ruleId == null ? 'null' : f.ruleId));
      if (f.reason) lines.push('        reason: ' + f.reason);
    }
    lines.push('');
    lines.push('FAIL: ' + newFindings.length + ' new finding(s) not in the baseline. Gate exit 1.');
    lines.push('If a finding is a reviewed, accepted case, re-seed the baseline with');
    lines.push('  node scripts/agentshield-scan-cli.cjs --write-baseline');
    lines.push('and commit the diff (an explicit, PR-reviewable act).');
  }
  process.stdout.write(lines.join('\n') + '\n');
}

// ---------------------------------------------------------------------------
// main.
// ---------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.indexOf('--json') !== -1;
  const doWrite = argv.indexOf('--write-baseline') !== -1;

  const report = runScan();

  if (doWrite) {
    const n = writeBaseline(report);
    const msg = {
      wrote: BASELINE_REL,
      findingCount: n,
      scannedAt: report.scannedAt,
    };
    if (asJson) {
      process.stdout.write(JSON.stringify(msg) + '\n');
    } else {
      process.stdout.write('Wrote ' + BASELINE_REL + ' with ' + n
        + ' finding(s) from the current scan.\n');
    }
    process.exit(0);
  }

  const baseline = loadBaseline();
  const newFindings = computeDelta(report, baseline);
  const exitCode = newFindings.length > 0 ? 1 : 0;

  if (asJson) {
    process.stdout.write(JSON.stringify({
      scannedAt: report.scannedAt,
      surfaces: report.surfaces,
      totalFlagged: report.totalFlagged,
      totalAmbiguous: report.totalAmbiguous,
      findings: report.findings,
      baselineCount: baseline.count,
      baselineMissing: !!baseline.missing,
      newFindings: newFindings,
      exitCode: exitCode,
    }) + '\n');
  } else {
    printHumanReport(report, baseline, newFindings);
  }
  process.exit(exitCode);
}

main();
