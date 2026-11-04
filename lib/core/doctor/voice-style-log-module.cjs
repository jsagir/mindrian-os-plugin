'use strict';
/*
 * lib/core/doctor/voice-style-log-module.cjs -- Phase 298-08 (D-04, R-03).
 *
 * A cadence:always, fix_supported:false, flag:null doctor module.
 *
 * WHAT IT DOES: reports the voice-style evidence count since the last
 * release, plus the promotion verdict per voice policy it finds rows for.
 * Mirrors `lib/core/doctor/card-fire-health-module.cjs` one for one, with
 * one deliberate divergence stated below.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it never fails, never warns, never
 * promotes, and never repairs. It never computes a count or a rate itself --
 * `lib/hmi/voice-style-log.cjs::evaluatePromotion` computes the verdict
 * ONCE, and this module only formats what that function returned (the
 * 2026-07-11 printer-must-match-counter lesson, `card-fire-health-
 * module.cjs:8-10`). It never opens a policy file for anything beyond a
 * best-effort promotion_rule read; a missing policy file (the normal state
 * until plan 298-09 lands `data/harness-policies/`) is not an error -- the
 * evaluator itself reports the rule as missing.
 *
 * Canon Part 8 (Graph Boundary): every check is LOCAL -- file reads under
 * ~/.mindrian, a require of the sibling voice-style-log module, and a
 * best-effort read of a policy file under data/harness-policies/. ZERO
 * network.
 *
 * THE ONE DIVERGENCE FROM THE ANALOG (D-04): card-fire-health can return
 * `warn` when it finds an instrument defect. This module NEVER returns
 * `warn` and NEVER returns `error` -- `status` is the literal string `ok`
 * on every path, including a missing log, malformed lines, zero rows, and a
 * met promotion rule. This is deliberate: `buildAcceptanceChecklist`
 * (`scripts/doctor.cjs:1605-1612`) marks every acceptance-point entry
 * `severity: 'blocker'`, so a module that could return `warn` here would be
 * one accidental wiring mistake away from blocking a release over an
 * informational count. Putting this in a MODULE (never an acceptance
 * point) is exactly why D-04 exists.
 *
 * Phase 369.6-06 (D-18): the detail text also reports violations per evaluated turn, per policy and
 * per template version (computeRates of the log module computes them; this module only formats),
 * names a policy whose newest-version rate is above its previous-version rate (a RATE RISING
 * action line), and says how many rows were written before the first evaluated-turn row (those
 * rows have no denominator). The status stays ok on every one of these paths.
 *
 * Contract: check(ctx) -> { status: 'ok', detail: string, action_lines? }.
 * No fix export (fix_supported:false; the contract-parity gate enforces the
 * two-way declaration).
 */

const fs = require('node:fs');
const path = require('node:path');
const voiceStyleLog = require('../../hmi/voice-style-log.cjs');

// policiesDir(): the closed policy directory (data/harness-policies/,
// plan 298-09). Exported for hermetic tests via the ctx.policies_dir seam
// below, mirroring the ctx.log_path idiom at card-fire-health-module.cjs:51.
function policiesDir() {
  return path.join(__dirname, '..', '..', '..', 'data', 'harness-policies');
}

// loadPolicy(dir, policyId): best-effort read of <dir>/<policyId>.json. A
// missing or malformed file is NOT an error here -- it degrades to a bare
// { id: policyId } object, and evaluatePromotion itself reports the
// promotion_rule as missing (its own, already-covered contract). Never
// throws.
function loadPolicy(dir, policyId) {
  try {
    const fp = path.join(dir, policyId + '.json');
    if (!fs.existsSync(fp)) return { id: policyId };
    const raw = fs.readFileSync(fp, 'utf8');
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : { id: policyId };
  } catch (_e) {
    return { id: policyId };
  }
}

// resolveCurrentVersion(): best-effort read of the repo version stamp,
// mirroring voice-style-log.cjs's own resolveVersion(). Never throws.
function resolveCurrentVersion() {
  try {
    const { readRepoVersion } = require('../repo-version.cjs');
    const result = readRepoVersion();
    return typeof result.version === 'string' ? result.version : 'unknown';
  } catch (_e) {
    return 'unknown';
  }
}

// pct(rate) -- format a rate from computeRates. null (no evaluated turn) reads "n/a", never 0.
function pct(rate) {
  return rate === null || rate === undefined ? 'n/a' : (Math.round(rate * 10000) / 100) + '%';
}

// orderVersions(versionStarts) -- template versions oldest first. A version with a numeric name
// sorts numerically; otherwise by the earliest row timestamp. 'unversioned' is never ordered.
function orderVersions(versionStarts) {
  const names = Object.keys(versionStarts).filter((v) => v !== 'unversioned');
  const allNumeric = names.every((v) => /^\d+(\.\d+)*$/.test(v));
  if (allNumeric) {
    return names.sort((a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d !== 0) return d;
      }
      return 0;
    });
  }
  return names.sort((a, b) => versionStarts[a] - versionStarts[b]);
}

function checkInner(ctx) {
  const c = ctx || {};
  // Test seam: ctx.log_path wins; otherwise the MINDRIAN_HOME-resolved
  // default (exactly the card-fire-health-module.cjs:51 idiom).
  const logPath = typeof c.log_path === 'string' ? c.log_path : voiceStyleLog.voiceStyleLogPath();
  // Test seam: ctx.policies_dir wins; otherwise the real data/harness-
  // policies/ directory (which may not exist yet -- loadPolicy degrades
  // safely either way).
  const policiesDirPath = typeof c.policies_dir === 'string' ? c.policies_dir : policiesDir();

  // readVoiceStyleRows already degrades a missing file or a malformed line
  // to "dropped" -- this module computes nothing further on top of it.
  const rows = voiceStyleLog.readVoiceStyleRows(logPath);

  if (rows.length === 0) {
    return { status: 'ok', detail: 'voice-style-log: no evidence rows yet (no violations logged)' };
  }

  const currentVersion = resolveCurrentVersion();
  // Reports the count since the last release by filtering on the version
  // stamp -- a filter and a length, never a rate or a verdict.
  const sinceRelease = rows.filter((r) => r && r.version === currentVersion).length;

  // Group rows by policy_id (a plain partition, not a count of TP/FP).
  const byPolicy = new Map();
  for (const row of rows) {
    const pid = row && typeof row.policy_id === 'string' ? row.policy_id : '';
    if (!pid) continue;
    // 369.6-06: a denominator row counts evaluated turns; it is not a policy fire.
    if (pid === voiceStyleLog.DENOMINATOR_POLICY_ID) continue;
    if (!byPolicy.has(pid)) byPolicy.set(pid, []);
    byPolicy.get(pid).push(row);
  }

  const summaries = [];
  const actionLines = [];
  for (const [policyId, policyRows] of byPolicy) {
    const policy = loadPolicy(policiesDirPath, policyId);
    // The ONE evaluator call. This module formats verdict.* fields; it
    // never re-derives true_positives / false_positives / the rate itself.
    const verdict = voiceStyleLog.evaluatePromotion(policy, policyRows);
    const rateText = verdict.false_positive_rate === null ? 'unreviewed' : verdict.false_positive_rate;
    summaries.push(
      policyId + ': ' + verdict.fires + ' fire(s) since window start, rate ' + rateText +
        ', ' + (verdict.met ? 'MET' : 'not met') +
        (verdict.reasons.length > 0 ? ' (' + verdict.reasons[0] + ')' : '')
    );
    if (verdict.met && verdict.edit_line) {
      actionLines.push(policyId + ' promotion ready -- apply: ' + verdict.edit_line);
    }
  }

  // 369.6-06 (D-18): rates per policy and template version. computeRates does the arithmetic.
  const rates = voiceStyleLog.computeRates(rows);
  const versionStarts = {};
  const denominatorTs = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const tv = typeof row.template_version === 'string' && row.template_version ? row.template_version : 'unversioned';
    const t = Number.isFinite(row.ts) ? row.ts : 0;
    if (versionStarts[tv] === undefined || t < versionStarts[tv]) versionStarts[tv] = t;
    if (row.policy_id === voiceStyleLog.DENOMINATOR_POLICY_ID && t > 0) denominatorTs.push(t);
  }
  const ordered = orderVersions(versionStarts);
  const rateParts = [];
  for (const policyId of Object.keys(rates).sort()) {
    const perVersion = rates[policyId];
    const bits = [];
    for (const tv of ordered.concat(perVersion.unversioned ? ['unversioned'] : [])) {
      const cell = perVersion[tv];
      if (!cell) continue;
      bits.push((tv === 'unversioned' ? '' : 'v') + tv + ' ' + cell.violations + '/' + cell.evaluated + ' (' + pct(cell.rate) + ')');
    }
    if (bits.length > 0) rateParts.push(policyId + ' ' + bits.join(', '));
    // Newest version against the previous one, when both have a measured rate.
    if (ordered.length >= 2) {
      const newest = perVersion[ordered[ordered.length - 1]];
      const previous = perVersion[ordered[ordered.length - 2]];
      if (newest && previous && newest.rate !== null && previous.rate !== null && newest.rate > previous.rate) {
        actionLines.push(
          'RATE RISING: ' + policyId + ' v' + ordered[ordered.length - 1] + ' ' + pct(newest.rate) +
            ' is above v' + ordered[ordered.length - 2] + ' ' + pct(previous.rate) + ' (violations per evaluated turn)'
        );
      }
    }
  }
  let denominatorNote;
  if (denominatorTs.length === 0) {
    denominatorNote = 'no denominator yet (no evaluated-turn row)';
  } else {
    const first = Math.min.apply(null, denominatorTs);
    const before = rows.filter((r) => r && r.policy_id !== voiceStyleLog.DENOMINATOR_POLICY_ID && Number.isFinite(r.ts) && r.ts < first).length;
    denominatorNote = before > 0
      ? before + ' row(s) have no denominator before ' + new Date(first).toISOString().slice(0, 10)
      : 'denominator since ' + new Date(first).toISOString().slice(0, 10);
  }

  const detail =
    'voice-style-log: ' + rows.length + ' row(s) total, ' + sinceRelease + ' since ' + currentVersion +
    (summaries.length > 0 ? ' -- ' + summaries.join('; ') : '') +
    ' -- rates (violations/evaluated turns): ' + (rateParts.length > 0 ? rateParts.join('; ') : 'none') +
    ' -- ' + denominatorNote;

  const result = { status: 'ok', detail: detail };
  if (actionLines.length > 0) result.action_lines = actionLines;
  return result;
}

// check(ctx) -- 369.6-06: status is ok on every path, a thrown fault included (a warn or an error
// here would be read as a release blocker by the acceptance roll-up; see the header).
function check(ctx) {
  try {
    return checkInner(ctx);
  } catch (e) {
    return { status: 'ok', detail: 'voice-style-log: report unavailable (' + (e && e.message ? String(e.message).slice(0, 80) : 'fault') + ')' };
  }
}

module.exports = {
  check,
  // exported for hermetic tests:
  voiceStyleLogPath: voiceStyleLog.voiceStyleLogPath,
};
