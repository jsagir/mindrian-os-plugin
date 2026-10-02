'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 366 plan 15 (D-09, D-04): the Theo lateral-path lane, a governed and audited
 * planner evidence lane. Connections recall (perspectives/connections-recall.cjs)
 * stays offline and only proposes pairs; this lane is the ONE place the check that
 * asks Theo whether two canon frameworks connect is allowed to run, and it runs
 * only under a RUN grant that names provider theo and the approved pair hash.
 *
 * For every researchable theo leaf of the plan:
 *   1. both slot terms must be in the canon snapshot (verification-stamp
 *      loadFrameworkNames), else the leaf is skipped and counted, never sent;
 *   2. grants.validateTheoCall must pass (no grant, wrong room, revoked, expired,
 *      reversioned, provider not named, pair hash not approved, cap exceeded); the
 *      first failure stops the lane with that reason and zero further calls;
 *   3. the call goes through the 355 stamp producer, verificationStamp.stampFinding,
 *      which sends canon names only (the Part 8 guard's known find-connections
 *      shape) and degrades to a typed unverified stamp on any failure;
 *   4. one closed audit row is appended (provider theo, the pair as canonA|canonB);
 *   5. the stamp is recorded under pairKey(a, b) in <run home>/theo-lane.json, which
 *      the one filer (filing-stamped.stampForPair) reads, so a filed pair carries
 *      Theo's real stamp.
 *
 * A verified stamp (a lateral path) maps the leaf to 'settled'; anything else to
 * 'unresolved'. The lane never throws on a Theo failure.
 *
 * Canon Part 8: only canon framework names cross the wire, never room text. The
 * audit row, the run file and the stamps hold canon names and node ids only.
 * Hyphens only. No em-dash.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const grants = require('./grants.cjs');
const families = require('./families.cjs');
const auditLedger = require('./audit-ledger.cjs');
const egressPolicy = require('./egress-policy.cjs');
const filingStamped = require('./filing-stamped.cjs');
const verificationStamp = require('../verification-stamp.cjs');

const STATE_DIR = path.join('.mindrian', 'research-runs');
const LANE_FAMILY = 'concept-evidence/v1';
const DEFAULT_TEMPLATE = 'connections';
const RUN_ID_SAFE = /^[A-Za-z0-9._-]+$/;
// reasons where Theo itself answered but no usable lateral path came back
const NO_PATH_REASONS = Object.freeze(['no_path_within_3_hops', 'co_sourced_only', 'no_lateral_relation', 'endpoint_unresolved']);

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function list(v) { return Array.isArray(v) ? v : []; }
function iso(ms) { return new Date(ms).toISOString(); }

// theoLeavesOf(plan) -> the researchable theo leaves that carry two clean slot terms.
function theoLeavesOf(plan) {
  return list(plan && plan.leaves).filter(function (l) { return grants.theoLeafSlots(l) !== null; });
}

function atomicWriteJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid + '-' + crypto.randomBytes(3).toString('hex');
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

// laneFileFor(roomDir, runId) -> the absolute theo-lane.json path inside the room, or null.
function laneFileFor(roomDir, runId) {
  if (typeof runId !== 'string' || !RUN_ID_SAFE.test(runId) || runId === '.' || runId === '..') return null;
  return path.join(path.resolve(roomDir), STATE_DIR, runId, filingStamped.THEO_LANE_FILE);
}

// readLane(file) -> the stamps already recorded for this run, or {} (never throws).
function readLane(file) {
  try {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (isObj(doc) && doc.schema === filingStamped.THEO_LANE_SCHEMA && isObj(doc.stamps)) return doc.stamps;
  } catch (_e) { /* absent or malformed: start clean */ }
  return {};
}

// outcomeOf(stamp) -> { outcome, failure_class } for the audit row.
function outcomeOf(stamp) {
  if (stamp.path) return { outcome: 'ok', failure_class: null };
  if (stamp.backend === 'theo' && NO_PATH_REASONS.indexOf(stamp.reason) !== -1) return { outcome: 'empty_valid', failure_class: null };
  return { outcome: 'failed', failure_class: typeof stamp.reason === 'string' ? stamp.reason : 'unknown_error' };
}

/*
 * runTheoLane(roomDir, run, plan, deps) -> Promise<{
 *   calls, skipped, reask_reason, audit_failure, stop_reason, verdictByLeaf, checks, lane_file
 * }>
 *   run:  { run_id, grant, now?, deadlineMs?, policy? }  (grant is the active grant the run holds;
 *         policy is the loaded egress policy, read from the room when absent; with the theo line
 *         off the lane makes zero calls and every leaf reports egress_line_off, 366-17)
 *   deps: { callTool? }  (injected in tests; absent means the one wire door inside the stamp producer)
 *   checks: [{ leaf_id, canon_a, canon_b, outcome, verification, reason, hops }] for the evidence card
 */
async function runTheoLane(roomDir, run, plan, deps) {
  const r = isObj(run) ? run : {};
  const d = isObj(deps) ? deps : {};
  const nowMs = Number.isFinite(r.now) ? r.now : Date.now();
  const roomId = grants.roomIdFor(roomDir);
  const canon = verificationStamp.loadFrameworkNames();
  const out = { calls: 0, skipped: 0, reask_reason: null, audit_failure: null, stop_reason: null, verdictByLeaf: {}, checks: [], lane_file: null };
  const stamps = {};
  const memo = {};
  const templateId = isObj(plan && plan.origin) && typeof plan.origin.template_id === 'string' ? plan.origin.template_id : DEFAULT_TEMPLATE;

  const leaves = theoLeavesOf(plan);
  const policy = r.policy ? r.policy : egressPolicy.loadEgressPolicy(roomDir, { offline: r.offline === true });
  const lineOn = egressPolicy.lineAllowed(policy, 'theo');
  for (let i = 0; i < leaves.length; i += 1) {
    const leaf = leaves[i];
    // 0. the declared egress line (366-17): off means no canon check, no call, no audit row
    if (!lineOn) {
      out.skipped += 1;
      out.verdictByLeaf[leaf.id] = 'unresolved';
      out.checks.push({ leaf_id: leaf.id, canon_a: null, canon_b: null, outcome: 'skipped', verification: null, reason: 'egress_line_off', hops: null });
      continue;
    }
    const sl = grants.theoLeafSlots(leaf);
    const term = sl.term;
    const term2 = sl.term2;
    // 1. canon names only: a slot outside the canon snapshot is never sent
    if (!canon.has(term) || !canon.has(term2) || term === term2) {
      out.skipped += 1;
      out.verdictByLeaf[leaf.id] = 'unresolved';
      out.checks.push({ leaf_id: leaf.id, canon_a: null, canon_b: null, outcome: 'skipped', verification: null, reason: 'not_canon_name', hops: null });
      continue;
    }
    // 2. consent: the first failing reason stops the lane with zero further calls
    const pairQ = grants.theoPairQ(term, term2);
    const pairHash = families.qHash(pairQ);
    const verdict = grants.validateTheoCall({ pair_hash: pairHash, slot_terms: [term, term2] }, r.grant, { room_id: roomId, now: nowMs, calls_used: out.calls });
    if (!verdict.ok) { out.reask_reason = verdict.reason; out.stop_reason = 'reask'; break; }
    if (Number.isFinite(r.deadlineMs) && Date.now() >= r.deadlineMs) { out.stop_reason = 'time'; break; }

    // 3. one stamped call per distinct canon pair (a repeat reads the earlier stamp)
    let stamp = memo[pairQ];
    if (!stamp) {
      const t0 = Date.now();
      try {
        stamp = await verificationStamp.stampFinding({ fromHandle: term, toHandle: term2 }, { callTool: d.callTool });
      } catch (_e) {
        stamp = verificationStamp.Stamp.parse({ verification: 'unverified', backend: 'unavailable', direction: 'none', judge: 'none', reason: 'backend_unavailable' });
      }
      const latency = Date.now() - t0;
      memo[pairQ] = stamp;
      out.calls += 1;
      // 4. one closed audit row per call
      const oc = outcomeOf(stamp);
      const audit = auditLedger.appendAudit(roomDir, {
        ts: iso(Date.now()),
        run_id: String(r.run_id),
        grant_id: String(r.grant.grant_id),
        grant_version: r.grant.version,
        q: pairQ,
        q_hash: pairHash,
        template_id: templateId,
        family: LANE_FAMILY,
        part8_verdict: 'pass',
        provider: grants.THEO_PROVIDER,
        filters: {},
        pagination: { per_page: 1, page: 1 },
        fallback_used: false,
        origin_ref: String(r.run_id) + '/' + leaf.id,
        result_ids: [],
        content_hashes: [],
        outcome: oc.outcome,
        failure_class: oc.failure_class,
        count: oc.outcome === 'failed' ? null : (stamp.path ? 1 : 0),
        cost_usd: null,
        remaining_usd: null,
        x_query: null,
        latency_ms: latency,
      }, { policy: policy });
      if (!audit.ok) { out.audit_failure = audit.reason; out.stop_reason = 'audit'; break; }
    }

    // 5. record the stamp for the one filer, and the leaf verdict for the roll-up
    const oc2 = outcomeOf(stamp);
    if (isObj(leaf.pair) && typeof leaf.pair.a === 'string' && typeof leaf.pair.b === 'string') {
      stamps[filingStamped.pairKey(leaf.pair.a, leaf.pair.b)] = stamp;
    }
    out.verdictByLeaf[leaf.id] = stamp.path ? 'settled' : 'unresolved';
    out.checks.push({
      leaf_id: leaf.id,
      canon_a: term,
      canon_b: term2,
      outcome: oc2.outcome,
      verification: stamp.verification,
      reason: stamp.reason || null,
      hops: stamp.path && Array.isArray(stamp.path.edges) ? stamp.path.edges.length : null,
    });
  }

  // leaves the lane never reached stay unresolved, never silently supported
  leaves.forEach(function (leaf) { if (out.verdictByLeaf[leaf.id] === undefined) out.verdictByLeaf[leaf.id] = 'unresolved'; });

  if (Object.keys(stamps).length > 0) {
    const file = laneFileFor(roomDir, r.run_id);
    if (file) {
      const merged = Object.assign({}, readLane(file));
      Object.keys(stamps).forEach(function (k) { merged[k] = JSON.parse(JSON.stringify(stamps[k])); });
      try {
        atomicWriteJson(file, { schema: filingStamped.THEO_LANE_SCHEMA, stamps: merged });
        out.lane_file = path.relative(path.resolve(roomDir), file).split(path.sep).join('/');
      } catch (_e) { out.lane_file = null; }
    }
  }
  return out;
}

module.exports = {
  runTheoLane: runTheoLane,
  theoLeavesOf: theoLeavesOf,
};
