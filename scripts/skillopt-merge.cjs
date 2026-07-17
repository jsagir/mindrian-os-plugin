#!/usr/bin/env node
'use strict';
/*
 * scripts/skillopt-merge.cjs - Phase 230-06, WS1+WS2 aggregation + terminal human gate.
 * ==========================================================================
 * The LAST step of the pipeline. It reads the on-disk artifacts every prior plan
 * produced (the funnel verdicts, the flagged-skill loop summaries, the WS2 code
 * findings, and the per-spawn unit ledgers) and folds them into ONE honest report:
 *   out/report/report.json        (machine form)
 *   out/report/skillopt-report.md  (the human-readable merged report)
 * Then it STOPS. There is no path in this file that writes to skills/ or scripts/,
 * and no flag that pushes an approved change back onto a real SKILL.md. Turning an
 * approved diff into a real edit is future post-approval work, done by a human OUTSIDE
 * this pipeline (CONTEXT.md Deferred Ideas, CFM4).
 *
 * Two disciplines travel with the merge:
 *   1. Missing-input honesty (T-230-18 / D5). A missing artifact renders a NOT RUN
 *      section, never an empty-implies-clean one. An absent loop directory is a step
 *      that did not run, not a fleet with zero proposed diffs.
 *   2. Reconciliation (T-230-18 / D5). The merge re-derives, from the unit files
 *      themselves, the identity spawned === ok + not_evaluated across every ledger. A
 *      unit file that is unparseable or carries an unexpected status breaks the
 *      identity and the script exits 1 with the delta named. A pipeline cannot vouch
 *      for its own honesty; this is the independent count.
 *
 * Report prose is Feynman-simplified, JTBD-oriented, LTR, no em-dashes (house style,
 * AI-SPEC 1b Regulatory). CJS only, switch-case argv router, reuses lib/core/skillopt-schemas.cjs.
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  LoopSummarySchema,
  CodeFindingSchema,
  UnitRecordSchema,
  NOT_EVALUATED_REASONS,
  PHASE_OUT_DIR,
  assertUnderOut,
} = require('../lib/core/skillopt-schemas.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');

// --------------------------------------------------------------------------
// writeAtomic - write-temp-then-rename (copied from huji-batch.writeAtomic:60-64).
// --------------------------------------------------------------------------
function writeAtomic(filePath, contents) {
  const tmp = filePath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 10);
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, filePath);
}

function safeReadJson(fp) {
  try { return { ok: true, value: JSON.parse(fs.readFileSync(fp, 'utf8')) }; }
  catch (_e) { return { ok: false, value: null }; }
}

function pct(n) {
  if (n == null || Number.isNaN(n)) return 'n/a';
  return (Number(n) * 100).toFixed(1) + '%';
}

function oneLine(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

// --------------------------------------------------------------------------
// readUnitLedger(dir) - parse every <id>.json under a units directory into
// UnitRecords. Returns { spawned, ok, not_evaluated, other, unparseable, records }.
// A file that fails JSON.parse counts as unparseable; a record whose status is
// neither ok nor not_evaluated counts as other. Both break the reconciliation
// identity (the independent D5 count, never trusting the pipeline's own tally).
// --------------------------------------------------------------------------
function readUnitLedger(dir) {
  const out = { spawned: 0, ok: 0, not_evaluated: 0, other: 0, unparseable: 0, records: [] };
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch (_e) { return out; }
  files.sort();
  for (const f of files) {
    out.spawned += 1;
    const r = safeReadJson(path.join(dir, f));
    if (!r.ok || !r.value || typeof r.value !== 'object') { out.unparseable += 1; continue; }
    const rec = r.value;
    if (rec.status === 'ok') out.ok += 1;
    else if (rec.status === 'not_evaluated') out.not_evaluated += 1;
    else { out.other += 1; }
    out.records.push(rec);
  }
  return out;
}

// --------------------------------------------------------------------------
// loadArtifacts(outDir) - read every optional input from disk. A missing input is
// recorded as an explicit absence (present:false), never a synthesized empty-clean.
// --------------------------------------------------------------------------
function loadArtifacts(outDir) {
  const funnelPath = path.join(outDir, 'funnel', 'funnel-results.json');
  const funnelRes = safeReadJson(funnelPath);

  const loopDir = path.join(outDir, 'loop');
  const loopPresent = fs.existsSync(loopDir);
  const loopSummaries = [];
  if (loopPresent) {
    let skillDirs = [];
    try { skillDirs = fs.readdirSync(loopDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch (_e) { skillDirs = []; }
    skillDirs.sort();
    for (const sd of skillDirs) {
      const r = safeReadJson(path.join(loopDir, sd, 'summary.json'));
      if (r.ok && r.value) loopSummaries.push(r.value);
    }
  }

  const findingsRes = safeReadJson(path.join(outDir, 'review', 'findings.json'));
  const findingsRawRes = safeReadJson(path.join(outDir, 'review', 'findings-raw.json'));

  const invRes = safeReadJson(path.join(outDir, 'inventory.json'));

  const funnelUnits = readUnitLedger(path.join(outDir, 'funnel', 'units'));
  const reviewUnits = readUnitLedger(path.join(outDir, 'review', 'units'));

  return {
    funnel: { present: funnelRes.ok, value: funnelRes.ok ? funnelRes.value : null },
    loop: { present: loopPresent, summaries: loopSummaries },
    findings: { present: findingsRes.ok, value: findingsRes.ok ? findingsRes.value : null },
    findingsRaw: { present: findingsRawRes.ok, value: findingsRawRes.ok ? findingsRawRes.value : null },
    inventory: { present: invRes.ok, value: invRes.ok ? invRes.value : null },
    funnelUnits,
    reviewUnits,
  };
}

// --------------------------------------------------------------------------
// reconcile(funnelUnits, reviewUnits) - the independent D5 identity across every
// unit ledger. spawned === ok + not_evaluated must hold; any other/unparseable unit
// breaks it. Returns { ok, spawned, ok_count, not_evaluated, other, unparseable, delta }.
// --------------------------------------------------------------------------
function reconcile(funnelUnits, reviewUnits) {
  const spawned = funnelUnits.spawned + reviewUnits.spawned;
  const okc = funnelUnits.ok + reviewUnits.ok;
  const ne = funnelUnits.not_evaluated + reviewUnits.not_evaluated;
  const other = funnelUnits.other + reviewUnits.other;
  const unparseable = funnelUnits.unparseable + reviewUnits.unparseable;
  const identityHolds = spawned === okc + ne && other === 0 && unparseable === 0;
  return {
    ok: identityHolds,
    spawned, ok_count: okc, not_evaluated: ne, other, unparseable,
    delta: spawned - (okc + ne),
  };
}

// --------------------------------------------------------------------------
// funnelAccuracy(funnelUnits) - fleet trigger-accuracy rate re-derived from the
// funnel unit payloads: over the OK funnel units only (not_evaluated units are
// excluded from BOTH numerator and denominator, D5), the fraction whose payload
// predicted_skill === expected_skill. Returns { rate, matches, comparable }.
// --------------------------------------------------------------------------
function funnelAccuracy(funnelUnits) {
  let matches = 0;
  let comparable = 0;
  for (const rec of funnelUnits.records) {
    if (rec.kind !== 'funnel') continue;
    if (rec.status !== 'ok') continue; // not_evaluated excluded from num AND denom
    const v = rec.payload || {};
    comparable += 1;
    if (v.predicted_skill === v.expected_skill) matches += 1;
  }
  return { rate: comparable > 0 ? matches / comparable : null, matches, comparable };
}

// Sum total_cost_usd across every unit that reported one (funnel + review ledgers).
function totalCost(funnelUnits, reviewUnits) {
  let sum = 0;
  let seen = false;
  for (const rec of [...funnelUnits.records, ...reviewUnits.records]) {
    if (typeof rec.total_cost_usd === 'number') { sum += rec.total_cost_usd; seen = true; }
  }
  return seen ? sum : null;
}

// Every not_evaluated unit across both ledgers, listed by name with its reason
// (AI-SPEC sampling rule: every not_evaluated unit gets eyes).
function notEvaluatedUnits(funnelUnits, reviewUnits) {
  const rows = [];
  for (const rec of [...funnelUnits.records, ...reviewUnits.records]) {
    if (rec.status === 'not_evaluated') {
      rows.push({ unit_id: rec.unit_id, kind: rec.kind, reason: rec.not_evaluated_reason || 'unknown' });
    }
  }
  rows.sort((a, b) => (a.unit_id < b.unit_id ? -1 : a.unit_id > b.unit_id ? 1 : 0));
  return rows;
}

// Baseline (current, shipped) description for a skill from the inventory, if present.
function currentDescription(inventory, skill) {
  if (!Array.isArray(inventory)) return null;
  const rec = inventory.find((r) => r.skill === skill);
  return rec ? rec.description : null;
}

// --------------------------------------------------------------------------
// classifyLoopSummary(summary) - the per-skill WS1 verdict shape for section 2.
//   blocked_by_regression -> 'blocked_by_regression' (a regression blocked the diff)
//   proposed_description present -> 'proposed_diff'
//   converged === false -> 'did_not_converge' (baseline kept, marked honestly)
//   else -> 'unchanged'
// --------------------------------------------------------------------------
function classifyLoopSummary(s) {
  if (s.blocked_by_regression) return 'blocked_by_regression';
  if (s.proposed_description != null) return 'proposed_diff';
  if (s.converged === false) return 'did_not_converge';
  return 'unchanged';
}

// --------------------------------------------------------------------------
// buildReport(artifacts) - the PURE aggregator. Takes loaded artifacts, returns
// { reportJson, reportMd, reconciliation, approvalItems }. No I/O, no process.exit,
// so the selftest drives it with canned fixtures and asserts every section.
// --------------------------------------------------------------------------
function buildReport(artifacts) {
  const a = artifacts;
  const rec = reconcile(a.funnelUnits, a.reviewUnits);
  const acc = funnelAccuracy(a.funnelUnits);
  const cost = totalCost(a.funnelUnits, a.reviewUnits);
  const neUnits = notEvaluatedUnits(a.funnelUnits, a.reviewUnits);

  // --- WS1 funnel verdicts ---
  const funnelSkills = (a.funnel.present && a.funnel.value && Array.isArray(a.funnel.value.skills))
    ? a.funnel.value.skills : [];
  const flaggedCount = funnelSkills.filter((s) => s.verdict === 'flagged').length;
  const notEvalSkillCount = funnelSkills.filter((s) => s.verdict === 'not_evaluated').length;
  const flagRate = funnelSkills.length > 0 ? flaggedCount / funnelSkills.length : null;

  // --- WS2 findings ---
  const reported = (a.findings.present && Array.isArray(a.findings.value)) ? a.findings.value : [];
  const raw = (a.findingsRaw.present && Array.isArray(a.findingsRaw.value)) ? a.findingsRaw.value : [];
  const confirmed = raw.filter((f) => f.verdict === 'confirmed').length;
  const refuted = raw.filter((f) => f.verdict === 'refuted').length;
  const survivalRate = (confirmed + refuted) > 0 ? confirmed / (confirmed + refuted) : null;
  const reportedConfirmed = reported.filter((f) => f.verdict === 'confirmed').length;

  // --- proposed-diff verdicts (drives the approval checklist) ---
  const loopVerdicts = a.loop.summaries.map((s) => ({
    skill: s.skill,
    kind: classifyLoopSummary(s),
    baseline_validation_rate: s.baseline_validation_rate,
    best_validation_rate: s.best_validation_rate,
    regressed_query_count: s.regressed_query_count,
    converged: s.converged,
    proposed_description: s.proposed_description,
    old_description: currentDescription(a.inventory.value, s.skill),
  }));
  const proposedDiffs = loopVerdicts.filter((v) => v.kind === 'proposed_diff');

  // --- approval checklist items: one per proposed diff + one per surviving finding ---
  const approvalItems = [];
  for (const d of proposedDiffs) approvalItems.push({ type: 'description_diff', skill: d.skill });
  for (const f of reported) approvalItems.push({ type: 'code_finding', skill: f.skill, file: f.file, severity: f.severity });

  const metrics = {
    fleet_trigger_accuracy_rate: acc.rate,
    fleet_trigger_accuracy_matches: acc.matches,
    fleet_trigger_accuracy_comparable: acc.comparable,
    flag_rate: flagRate,
    flagged_skills: flaggedCount,
    funnel_skills: funnelSkills.length,
    not_evaluated_rate: rec.spawned > 0 ? rec.not_evaluated / rec.spawned : null,
    not_evaluated_units: rec.not_evaluated,
    spawned_units: rec.spawned,
    confirmed_finding_count: confirmed,
    reported_confirmed_count: reportedConfirmed,
    refuted_finding_count: refuted,
    survival_rate: survivalRate,
    total_cost_usd: cost,
    funnel_not_evaluated_skills: notEvalSkillCount,
  };

  const reportJson = {
    generated: new Date().toISOString(),
    reconciliation: rec,
    metrics,
    ws1: {
      funnel_present: a.funnel.present,
      loop_present: a.loop.present,
      funnel_skills: funnelSkills,
      loop_verdicts: loopVerdicts,
    },
    ws2: {
      review_present: a.findings.present,
      reported_findings: reported,
      refuted_count: refuted,
    },
    not_evaluated_units: neUnits,
    approval_checklist: approvalItems,
    terminal: true,
  };

  const reportMd = renderMarkdown({ a, rec, metrics, funnelSkills, loopVerdicts, proposedDiffs, reported, refuted, neUnits, approvalItems });
  return { reportJson, reportMd, reconciliation: rec, approvalItems };
}

// --------------------------------------------------------------------------
// renderMarkdown - the five-section human report. Every missing input is a NOT RUN
// section (never empty-implies-clean). Ends with the itemized approval checklist and
// the terminal STOP banner. No em-dashes.
// --------------------------------------------------------------------------
function renderMarkdown(ctx) {
  const { a, rec, metrics, funnelSkills, loopVerdicts, proposedDiffs, reported, refuted, neUnits, approvalItems } = ctx;
  const L = [];
  L.push('# MindrianOS Skill Fleet Optimization - Merged Report');
  L.push('');
  L.push('This is a report you APPROVE FROM. Nothing here has been written to any real');
  L.push('SKILL.md or script. Read the proposed changes and the findings, then sign off on');
  L.push('each one by hand. A missing input is shown as NOT RUN, never as a clean result.');
  L.push('');

  // Section 1 - run metrics header.
  L.push('## 1. Run metrics');
  L.push('');
  L.push('| Metric | Value |');
  L.push('| ------ | ----- |');
  L.push('| Fleet trigger-accuracy rate | ' + pct(metrics.fleet_trigger_accuracy_rate) + ' (' + metrics.fleet_trigger_accuracy_matches + '/' + metrics.fleet_trigger_accuracy_comparable + ' comparable funnel verdicts) |');
  L.push('| Flag rate | ' + pct(metrics.flag_rate) + ' (' + metrics.flagged_skills + '/' + metrics.funnel_skills + ' skills sent to the trigger-test loop) |');
  L.push('| Not-evaluated rate | ' + pct(metrics.not_evaluated_rate) + ' (' + metrics.not_evaluated_units + '/' + metrics.spawned_units + ' spawned units) |');
  L.push('| CONFIRMED code findings | ' + metrics.confirmed_finding_count + ' |');
  L.push('| Finding survival rate (confirmed / (confirmed + refuted)) | ' + pct(metrics.survival_rate) + ' (' + metrics.confirmed_finding_count + ' confirmed, ' + metrics.refuted_finding_count + ' refuted) |');
  L.push('| Total run cost | ' + (metrics.total_cost_usd == null ? 'n/a (no cost recorded)' : '$' + metrics.total_cost_usd.toFixed(4)) + ' |');
  L.push('');
  if (proposedDiffs.length) {
    L.push('Per-flagged-skill validation lift:');
    L.push('');
    for (const d of proposedDiffs) {
      L.push('- ' + d.skill + ': validation ' + pct(d.baseline_validation_rate) + ' -> ' + pct(d.best_validation_rate) + ', regressed_query_count ' + d.regressed_query_count);
    }
    L.push('');
  }

  // Section 2 - per-skill WS1 verdicts.
  L.push('## 2. Per-skill trigger verdicts (WS1)');
  L.push('');
  if (!a.funnel.present && !a.loop.present) {
    L.push('NOT RUN - neither the funnel results nor the trigger-test loop produced output.');
    L.push('');
  } else {
    if (!a.funnel.present) {
      L.push('Funnel: NOT RUN (no funnel-results.json).');
      L.push('');
    } else {
      L.push('Funnel verdicts (' + funnelSkills.length + ' skills):');
      L.push('');
      L.push('| Skill | Verdict | Train misses | Low/med confidence | Not-evaluated units |');
      L.push('| ----- | ------- | ------------ | ------------------ | ------------------- |');
      for (const s of funnelSkills) {
        L.push('| ' + s.skill + ' | ' + s.verdict + ' | ' + (s.train_miss_count || 0) + ' | ' + (s.low_conf_count || 0) + ' | ' + (s.not_evaluated_count || 0) + ' |');
      }
      L.push('');
    }
    if (!a.loop.present) {
      L.push('Trigger-test loop: NOT RUN (no loop directory). No description diffs were proposed.');
      L.push('');
    } else {
      L.push('Loop outcomes (' + loopVerdicts.length + ' flagged skills):');
      L.push('');
      for (const v of loopVerdicts) {
        if (v.kind === 'proposed_diff') {
          L.push('### ' + v.skill + ' - PROPOSED DESCRIPTION DIFF');
          L.push('');
          L.push('- Validation pass-rate: ' + pct(v.baseline_validation_rate) + ' -> ' + pct(v.best_validation_rate));
          L.push('- regressed_query_count: ' + v.regressed_query_count + ' (must be 0 to propose)');
          L.push('- converged: ' + v.converged);
          L.push('');
          L.push('Old description:');
          L.push('');
          L.push('> ' + oneLine(v.old_description == null ? '(current description not available in inventory)' : v.old_description));
          L.push('');
          L.push('New description (proposed):');
          L.push('');
          L.push('> ' + oneLine(v.proposed_description));
          L.push('');
        } else if (v.kind === 'blocked_by_regression') {
          L.push('### ' + v.skill + ' - BLOCKED (regression)');
          L.push('');
          L.push('A candidate rewrite raised some numbers but regressed ' + v.regressed_query_count + ' validation query(ies) that used to pass. The do-no-harm gate BLOCKED the diff. No change is proposed; the baseline description is kept.');
          L.push('');
        } else if (v.kind === 'did_not_converge') {
          L.push('### ' + v.skill + ' - did-not-converge');
          L.push('');
          L.push('No iteration beat the baseline validation pass-rate after the loop ran. The baseline description is kept, marked did-not-converge honestly.');
          L.push('');
        } else {
          L.push('### ' + v.skill + ' - unchanged');
          L.push('');
          L.push('The baseline description already passes; no diff is proposed.');
          L.push('');
        }
      }
    }
  }

  // Section 3 - WS2 findings (confirmed + plausible only).
  L.push('## 3. Code-quality findings (WS2)');
  L.push('');
  if (!a.findings.present) {
    L.push('NOT RUN - the code-review workstream produced no findings.json.');
    L.push('');
  } else {
    L.push('Refuted findings (shown as a metric only, dropped from the report): ' + refuted);
    L.push('');
    if (reported.length === 0) {
      L.push('No CONFIRMED or PLAUSIBLE findings survived the adversarial refutation pass.');
      L.push('');
    } else {
      for (const f of reported) {
        L.push('### ' + f.skill + ' / ' + f.file + ' - ' + String(f.verdict).toUpperCase() + ' (' + f.severity + ')');
        L.push('');
        L.push('Claim: ' + oneLine(f.claim));
        L.push('');
        L.push('Verbatim evidence:');
        L.push('');
        L.push('```');
        L.push(String(f.evidence_quote));
        L.push('```');
        L.push('');
        L.push('Refutation attempt (why it could not be refuted): ' + oneLine(f.refutation_attempt));
        L.push('');
      }
    }
  }

  // Section 4 - every not_evaluated unit, by name, with its reason.
  L.push('## 4. Not-evaluated units (every one, by name)');
  L.push('');
  if (neUnits.length === 0) {
    L.push('None. Every spawned unit resolved to a real verdict.');
    L.push('');
  } else {
    L.push('| Unit | Kind | Reason |');
    L.push('| ---- | ---- | ------ |');
    for (const u of neUnits) L.push('| ' + u.unit_id + ' | ' + u.kind + ' | ' + u.reason + ' |');
    L.push('');
  }

  // Section 5 - the terminal itemized approval checklist + STOP banner.
  L.push('## 5. APPROVAL CHECKLIST (terminal, human sign-off required)');
  L.push('');
  if (approvalItems.length === 0) {
    L.push('Nothing to approve: no description diffs were proposed and no findings survived.');
    L.push('');
  } else {
    for (const item of approvalItems) {
      if (item.type === 'description_diff') {
        L.push('- [ ] Approve the proposed description diff for skill: ' + item.skill);
      } else {
        L.push('- [ ] Approve the code finding on ' + item.skill + ' / ' + item.file + ' (severity ' + item.severity + ')');
      }
    }
    L.push('');
  }
  L.push('---');
  L.push('');
  L.push('STOP. This pipeline does not touch any real SKILL.md or script. Real writes happen');
  L.push('only after you check the boxes above by hand, one item at a time, and make the edit');
  L.push('yourself outside this pipeline. There is no auto-write step, by design (CFM4).');
  L.push('');
  return L.join('\n');
}

// --------------------------------------------------------------------------
// runMerge({ outDir }) - load artifacts, build the report, and (unless the
// reconciliation identity is broken) write report.json + skillopt-report.md under
// out/report/ via assertUnderOut + writeAtomic. Returns { reconcileOk, reconciliation,
// reportJson, reportMd, wrote }. Does NOT process.exit; main() enforces the D5 gate.
// --------------------------------------------------------------------------
function runMerge(opts) {
  const o = opts || {};
  const outDir = o.outDir || path.join(REPO_ROOT, PHASE_OUT_DIR);
  const artifacts = loadArtifacts(outDir);
  const built = buildReport(artifacts);
  const rec = built.reconciliation;

  if (!rec.ok) {
    return { reconcileOk: false, reconciliation: rec, reportJson: built.reportJson, reportMd: built.reportMd, wrote: false };
  }

  const reportDir = path.join(outDir, 'report');
  const jsonTarget = path.join(reportDir, 'report.json');
  const mdTarget = path.join(reportDir, 'skillopt-report.md');
  for (const target of [jsonTarget, mdTarget]) {
    const guard = assertUnderOut(target, outDir);
    if (!guard.ok) throw new Error('skillopt-merge: refusing to write outside the out sandbox: ' + target);
  }
  fs.mkdirSync(reportDir, { recursive: true });
  writeAtomic(jsonTarget, JSON.stringify(built.reportJson, null, 2) + '\n');
  writeAtomic(mdTarget, built.reportMd);
  return { reconcileOk: true, reconciliation: rec, reportJson: built.reportJson, reportMd: built.reportMd, wrote: true, jsonTarget, mdTarget };
}

// --------------------------------------------------------------------------
// runSelftest - deterministic fixtures, ZERO spawn, zero API spend. Five fixtures:
//   (a) a not_evaluated funnel unit lands in section 4 AND is excluded from the
//       accuracy numerator and denominator.
//   (b) a refuted finding appears in NO findings section but is counted in survival.
//   (c) a broken-reconciliation fixture (an unparseable unit file) reconcileOk=false.
//   (d) a missing loop dir renders NOT RUN.
//   (e) a LoopSummary with blocked_by_regression renders as blocked, not a diff.
// --------------------------------------------------------------------------
function runSelftest() {
  const assert = require('node:assert');
  const os = require('node:os');
  const baseOut = path.join(REPO_ROOT, PHASE_OUT_DIR);
  fs.mkdirSync(baseOut, { recursive: true });
  const tmpOut = fs.mkdtempSync(path.join(baseOut, '.selftest-merge-'));

  const writeUnit = (dir, id, rec) => {
    fs.mkdirSync(dir, { recursive: true });
    const parsed = UnitRecordSchema.safeParse(rec);
    assert.ok(parsed.success, 'selftest: fixture unit must be schema-valid: ' + JSON.stringify(parsed.success ? '' : parsed.error.issues));
    fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify(rec, null, 2) + '\n');
  };

  try {
    const funnelUnitsDir = path.join(tmpOut, 'funnel', 'units');
    // Two ok funnel units (one match, one miss) + one not_evaluated -> accuracy 1/2.
    writeUnit(funnelUnitsDir, 'funnel-sA-0', {
      unit_id: 'funnel-sA-0', kind: 'funnel', model: 'claude-sonnet-4-5', session_id: 's1', total_cost_usd: 0.01,
      exit: 0, status: 'ok', not_evaluated_reason: null, error_issues: null,
      payload: { query: 'q', predicted_skill: 'sA', expected_skill: 'sA', confidence: 'high', reasoning: 'match' },
    });
    writeUnit(funnelUnitsDir, 'funnel-sB-0', {
      unit_id: 'funnel-sB-0', kind: 'funnel', model: 'claude-sonnet-4-5', session_id: 's2', total_cost_usd: 0.01,
      exit: 0, status: 'ok', not_evaluated_reason: null, error_issues: null,
      payload: { query: 'q', predicted_skill: 'sX', expected_skill: 'sB', confidence: 'high', reasoning: 'miss' },
    });
    writeUnit(funnelUnitsDir, 'funnel-sP-0', {
      unit_id: 'funnel-sP-0', kind: 'funnel', model: 'claude-sonnet-4-5', session_id: null, total_cost_usd: null,
      exit: null, status: 'not_evaluated', not_evaluated_reason: 'induced_probe', error_issues: null, payload: null,
    });

    // A funnel-results.json with a flagged + a pass + the not_evaluated probe skill.
    const funnelDir = path.join(tmpOut, 'funnel');
    fs.writeFileSync(path.join(funnelDir, 'funnel-results.json'), JSON.stringify({
      reconciliation: { spawned: 3, ok: 2, not_evaluated: 1 },
      reconcile_ok: true,
      concurrency: 2,
      skills: [
        { skill: 'sA', verdict: 'pass', train_miss_count: 0, low_conf_count: 0, not_evaluated_count: 0, unit_ids: ['funnel-sA-0'] },
        { skill: 'sB', verdict: 'flagged', train_miss_count: 1, low_conf_count: 0, not_evaluated_count: 0, unit_ids: ['funnel-sB-0'] },
        { skill: 'sP', verdict: 'not_evaluated', train_miss_count: 0, low_conf_count: 0, not_evaluated_count: 1, unit_ids: ['funnel-sP-0'] },
      ],
    }, null, 2) + '\n');

    // Review units: one ok. Findings-raw with confirmed + refuted; findings.json confirmed only.
    const reviewUnitsDir = path.join(tmpOut, 'review', 'units');
    writeUnit(reviewUnitsDir, 'review-x', {
      unit_id: 'review-x', kind: 'review', model: 'claude-opus-4-8', session_id: 's3', total_cost_usd: 0.5,
      exit: 0, status: 'ok', not_evaluated_reason: null, error_issues: null, payload: { file: 'scripts/x.cjs', findings: 2, reported: 1 },
    });
    const reviewDir = path.join(tmpOut, 'review');
    const confirmedFinding = { skill: 'sB', file: 'scripts/x.cjs', severity: 'high', claim: 'real bug', evidence_quote: 'if (x) {', verdict: 'confirmed', refutation_attempt: 'tried, stands' };
    const refutedFinding = { skill: 'sB', file: 'scripts/x.cjs', severity: 'low', claim: 'FALSE POSITIVE about y', evidence_quote: 'var y = 1;', verdict: 'refuted', refutation_attempt: 'the assumed requirement does not hold' };
    fs.writeFileSync(path.join(reviewDir, 'findings-raw.json'), JSON.stringify([confirmedFinding, refutedFinding], null, 2) + '\n');
    fs.writeFileSync(path.join(reviewDir, 'findings.json'), JSON.stringify([confirmedFinding], null, 2) + '\n');

    // --- Run 1: no loop dir yet -> section 2 loop renders NOT RUN (fixture d). ---
    const r1 = runMerge({ outDir: tmpOut });
    assert.strictEqual(r1.reconcileOk, true, 'selftest: clean ledgers reconcile');
    const md1 = r1.reportMd;
    // (a) accuracy 1/2 = 0.5, probe excluded from num AND denom.
    assert.strictEqual(r1.reportJson.metrics.fleet_trigger_accuracy_comparable, 2, 'selftest(a): comparable = 2 ok funnel units, probe excluded');
    assert.strictEqual(r1.reportJson.metrics.fleet_trigger_accuracy_rate, 0.5, 'selftest(a): accuracy = 1/2');
    // (a) the probe unit appears in section 4.
    assert.ok(md1.includes('funnel-sP-0'), 'selftest(a): the not_evaluated probe unit is listed in section 4');
    assert.ok(/## 4\. Not-evaluated units/.test(md1), 'selftest(a): section 4 exists');
    // (b) refuted finding claim is NOT in any findings section, but counted in survival.
    assert.ok(!md1.includes('FALSE POSITIVE about y'), 'selftest(b): a refuted finding never reaches the report');
    assert.ok(md1.includes('real bug'), 'selftest(b): the confirmed finding is reported');
    assert.strictEqual(r1.reportJson.metrics.refuted_finding_count, 1, 'selftest(b): refuted counted as a metric');
    assert.strictEqual(r1.reportJson.metrics.survival_rate, 0.5, 'selftest(b): survival = 1/(1+1)');
    // (d) missing loop dir renders NOT RUN.
    assert.ok(md1.includes('Trigger-test loop: NOT RUN'), 'selftest(d): missing loop dir renders NOT RUN');

    // --- Run 2: add a loop dir with a blocked_by_regression summary (fixture e). ---
    const loopSkillDir = path.join(tmpOut, 'loop', 'sB');
    fs.mkdirSync(loopSkillDir, { recursive: true });
    const blockedSummary = {
      skill: 'sB', iterations_run: 2, best_iteration: 1, selected_by: 'validation_pass_rate',
      baseline_validation_rate: 0.6, best_validation_rate: 0.8, regressed_query_count: 1,
      converged: true, proposed_description: null, blocked_by_regression: true, regressed_queries: ['val-c'],
    };
    assert.ok(LoopSummarySchema.safeParse(blockedSummary).success, 'selftest(e): blocked summary is LoopSummary-valid');
    fs.writeFileSync(path.join(loopSkillDir, 'summary.json'), JSON.stringify(blockedSummary, null, 2) + '\n');
    const r2 = runMerge({ outDir: tmpOut });
    const md2 = r2.reportMd;
    assert.ok(md2.includes('sB - BLOCKED (regression)'), 'selftest(e): blocked_by_regression renders as blocked');
    assert.ok(!/sB - PROPOSED DESCRIPTION DIFF/.test(md2), 'selftest(e): a blocked skill is NOT rendered as a proposed diff');
    // The approval checklist has no description-diff item for the blocked skill (only the finding).
    assert.ok(!md2.includes('Approve the proposed description diff for skill: sB'), 'selftest(e): blocked skill has no approval-diff line');
    assert.ok(md2.includes('Approve the code finding on sB'), 'selftest(e): the surviving finding has an approval line');
    // The STOP banner + itemized checklist header are present.
    assert.ok(md2.includes('APPROVAL CHECKLIST'), 'selftest: the itemized approval checklist header renders');
    assert.ok(/STOP\. This pipeline does not touch any real SKILL\.md/.test(md2), 'selftest: the STOP banner renders');

    // --- Run 3: broken reconciliation via an unparseable unit file (fixture c). ---
    fs.writeFileSync(path.join(reviewUnitsDir, 'review-corrupt.json'), '{ this is not valid json <<<');
    const r3 = runMerge({ outDir: tmpOut });
    assert.strictEqual(r3.reconcileOk, false, 'selftest(c): an unparseable unit file breaks the reconciliation identity');
    assert.strictEqual(r3.wrote, false, 'selftest(c): no report is written when reconciliation fails');
    assert.ok(r3.reconciliation.unparseable >= 1, 'selftest(c): the unparseable count is surfaced');
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }

  console.log('OK - skillopt-merge self-test passed: probe excluded from accuracy + listed in section 4, refuted-excluded-but-counted, missing loop NOT RUN, blocked-not-proposed, reconciliation exit gate, STOP banner + itemized checklist.');
}

// --------------------------------------------------------------------------
// main - switch-case argv router (gsd-tools.cjs pattern), no Commander/yargs.
//   --selftest        run embedded fixtures (zero spawn), exit
//   --out <dir>       out directory (default PHASE_OUT_DIR)
// There is deliberately NO flag that writes an approved change back to a real
// SKILL.md or script. That is human, post-approval, and lives outside this pipeline.
// --------------------------------------------------------------------------
function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--selftest')) { runSelftest(); return; }

  let outDir = path.join(REPO_ROOT, PHASE_OUT_DIR);
  const outIdx = args.indexOf('--out');
  if (outIdx >= 0 && args[outIdx + 1]) outDir = path.resolve(args[outIdx + 1]);

  const r = runMerge({ outDir });
  if (!r.reconcileOk) {
    const rec = r.reconciliation;
    console.error(
      'FATAL skillopt-merge: reconciliation identity violated across the unit ledgers (D5). ' +
        'spawned=' + rec.spawned + ' ok=' + rec.ok_count + ' not_evaluated=' + rec.not_evaluated +
        ' other=' + rec.other + ' unparseable=' + rec.unparseable + ' delta=' + rec.delta + '.'
    );
    process.exit(1);
  }
  console.log('OK skillopt-merge: report written -> ' + path.relative(REPO_ROOT, r.mdTarget));
  console.log('   ' + r.reportJson.approval_checklist.length + ' item(s) awaiting human sign-off. This pipeline stops here; no real SKILL.md or script was touched.');
}

module.exports = {
  runMerge,
  buildReport,
  reconcile,
  readUnitLedger,
  funnelAccuracy,
  classifyLoopSummary,
  loadArtifacts,
};

if (require.main === module) {
  main(process.argv);
}
