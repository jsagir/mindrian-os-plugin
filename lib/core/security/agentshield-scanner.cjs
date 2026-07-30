'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 199-03 (AS-01) -- the ONE generalized LOCAL AgentShield scanner engine.
 * ==========================================================================
 * scanSurface(surfaceType, target, opts) is the plugin-wide generalization of
 * the Phase-196 brain-boundary-scan gate. brain_egress is NOT a second scanner;
 * it is one of six registered surfaces that DELEGATES, byte-identical, to the
 * already-shipped part8-egress-guard.classify() (Part 7: reuse before build, no
 * second scanner engine).
 *
 * The six surfaces:
 *   1. brain_egress          -> delegates to part8-egress-guard.classify()
 *   2. mcp_tool_description   \
 *   3. hook_scope              } ONE shared _regexSweep() primitive, parameterized
 *   4. skill_injection         } by references/security/cve-db.json (no private copy)
 *   5. claudemd_permission    /
 *   6. supply_chain          -> a small structured heuristic over the CVE-DB's
 *                               known_bad_packages / typosquat_watchlist / allowlist.
 *
 * Every pattern is READ from references/security/cve-db.json at require time. This
 * file declares NO private per-surface pattern array; a new rule lands in the
 * versioned, PR-reviewed CVE-DB, not here (AS-02, mirrors how rs-egress-prompts.cjs
 * re-exports FORBIDDEN_PATTERNS from the Canon-authoritative source).
 *
 * It is a PURE LOCAL function. It opens ZERO network wire (Part 8): brain_egress
 * inherits classify()'s local-only judge, the regex surfaces match strings, and
 * supply_chain compares names against static lists. The engine treats every target
 * as inert DATA: it never require()s, eval()s, or spawns the scanned content
 * (T-199-03-03 mitigate-by-construction).
 *
 * verdict vocabulary: 'clean' | 'flagged' | 'ambiguous'. Return shape:
 *   { verdict, surface, findings: [{ ruleId, reason }] }  (findings [] when clean).
 *
 * NO em-dashes / en-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 * Pure CJS, zero npm deps at scan time.
 *
 * License: BSL 1.1.
 */

const egressGuard = require('../part8-egress-guard.cjs');
const cveDb = require('../../../references/security/cve-db.json');

// ---------------------------------------------------------------------------
// Require-time defensive guard. Mirrors the rs-egress-prompts.cjs require-time
// guard on FORBIDDEN_PATTERNS: a drifted / malformed rules source is a LOUD
// failure at load, never a silent no-op scan.
// ---------------------------------------------------------------------------
if (!cveDb || typeof cveDb.version !== 'string' || !cveDb.surfaces || typeof cveDb.surfaces !== 'object') {
  throw new Error(
    'agentshield-scanner: cve-db.json is missing version/surfaces; ' +
    'rules-source drift (expected a versioned surfaces map from 199-02)'
  );
}

// The six surfaces the generalized engine covers, frozen for caller introspection.
const SURFACES = Object.freeze([
  'brain_egress',
  'mcp_tool_description',
  'hook_scope',
  'skill_injection',
  'claudemd_permission',
  'supply_chain',
]);

// The four surfaces served by the shared regex-sweep primitive.
const REGEX_SURFACES = new Set([
  'mcp_tool_description',
  'hook_scope',
  'skill_injection',
  'claudemd_permission',
]);

// Bounded reason length (T-199-03-02): reason scalars are rule descriptions, not
// echoed input bytes, but we still clip defensively so no surfaced string is
// unbounded.
const REASON_MAX = 200;
function _clip(s) {
  s = String(s === null || s === undefined ? '' : s);
  return s.length > REASON_MAX ? s.slice(0, REASON_MAX) : s;
}

// ---------------------------------------------------------------------------
// _findRuleById(id) -> the first rule anywhere in the CVE-DB that declares a
// pattern under this id. Backs the CVE-DB "see" cross-reference (a surface may
// reuse a rule defined under another surface without duplicating its regex).
// ---------------------------------------------------------------------------
function _findRuleById(id) {
  const keys = Object.keys(cveDb.surfaces);
  for (let k = 0; k < keys.length; k++) {
    const arr = cveDb.surfaces[keys[k]];
    if (!Array.isArray(arr)) continue;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].id === id && arr[i].pattern) return arr[i];
    }
  }
  return null;
}

// _resolveRule(rule) -> a rule that carries an actual pattern. A rule with a
// "see" reference (no inline pattern) resolves to the referenced rule's pattern,
// keeping the id + description of the referencing entry.
function _resolveRule(rule) {
  if (rule && rule.pattern) return rule;
  if (rule && rule.see) {
    const ref = _findRuleById(rule.see);
    if (ref && ref.pattern) {
      return {
        id: rule.id,
        pattern: ref.pattern,
        flags: ref.flags,
        description: rule.description || ref.description,
      };
    }
  }
  return rule;
}

// ---------------------------------------------------------------------------
// _regexSweep(str, rules) -- the ONE generalized loop-first-hit primitive.
//
// This is the SAME loop-first-hit shape as rs-egress-prompts.auditQueryString,
// generalized to an arbitrary rule array (read from cve-db.json) instead of the
// fixed FORBIDDEN_PATTERNS. It walks the rule array in order; the first rule
// whose regex matches wins and is returned as the hit; no match -> clean. This
// is what makes the AgentShield engine a REAL Part-7 generalization of the 196
// gate (one shared primitive) rather than five bolted-on scanners.
// ---------------------------------------------------------------------------
function _regexSweep(str, rules) {
  for (let i = 0; i < rules.length; i++) {
    const rule = _resolveRule(rules[i]);
    if (!rule || !rule.pattern) continue;
    const re = new RegExp(rule.pattern, rule.flags || '');
    if (re.test(str)) {
      return { hit: true, ruleId: rule.id, reason: rule.description };
    }
  }
  return { hit: false };
}

// ---------------------------------------------------------------------------
// brain_egress -- DELEGATE to the shipped Phase-196 classify(), then normalize
// its allow/block/ambiguous verdict into the AgentShield clean/flagged/ambiguous
// vocabulary. A string target is wrapped into the free-form brain_query payload
// shape ({ brain_query_payload }) with the bare 'brain_query' tool name so the
// delegate runs its free-form path exactly as the 196 gate did (byte-identical
// frozen-scalar parity). An object target is passed through untouched.
//
// Phase 239 (BRAIN-01) bare-vs-scoped decision rule: this call reaches
// classify() IN-PROCESS (no hook, no host matcher in between), so it takes
// the BARE tool name, matching the shipped precedent in
// lib/core/bono/persona-research.cjs:208-233 (toolName: 'brain_ask') and
// brain-client.cjs's sendPacket PB8-10 belt (toolName: 'brain_packet'). The
// prior default was the dead scoped-looking literal 'mcp__brain_query',
// which never mattered for classify()'s own verdict (_isFreeFormTool does a
// substring indexOf check that a scoped name also satisfies) but was still
// a fabricated tool name with no live counterpart. Every current invoker of
// scanSurface('brain_egress', ...) is a test fixture omitting opts.toolName
// (lib/core/security/agentshield-scanner.test.cjs,
// lib/core/security/agentshield-adapters.test.cjs,
// tests/agentshield-e2e-smoke.test.cjs); no production orchestrator
// (agentshield-run.cjs, scripts/agentshield-scan-cli.cjs) calls this surface
// today (agentshield-run.cjs's own header comment states brain_egress is
// deliberately NOT gathered/scanned there). This default is nonetheless real
// production code on a real classify() call path, reached whenever any
// future caller passes a string target without opts.toolName -- so a dead
// default here was silently classifying against a fabricated name every
// time it was reached, even though no shipped orchestrator reaches it yet.
//
// A caller MAY still pass the live scoped form explicitly via opts.toolName
// (e.g. mcp__plugin_mos_mindrian-brain__brain_query or
// mcp__mindrian-brain__brain_query) and classify() resolves it identically,
// because _isFreeFormTool's substring check matches 'brain_query' inside
// either form. The bare default here is the correct one for THIS call site
// specifically because it is unauthenticated by any host matcher or hook --
// there is no scope to assert.
// ---------------------------------------------------------------------------
function _scanBrainEgress(target, opts) {
  opts = opts || {};
  let payload;
  let callOpts;
  if (typeof target === 'string') {
    payload = { brain_query_payload: target };
    callOpts = { toolName: opts.toolName || 'brain_query' };
  } else {
    payload = target;
    callOpts = opts;
  }
  const res = egressGuard.classify(payload, callOpts) || {};
  let verdict;
  if (res.verdict === 'block') verdict = 'flagged';
  else if (res.verdict === 'allow') verdict = 'clean';
  else verdict = 'ambiguous';
  const findings = verdict === 'clean'
    ? []
    : [{ ruleId: egressGuard.EGRESS_SURFACE, reason: _clip(res.reason) }];
  return { verdict: verdict, surface: 'brain_egress', findings: findings };
}

// ---------------------------------------------------------------------------
// supply_chain heuristic. Accepts either { name, version } or a "name@version"
// string. Order: known-bad exact -> typosquat watch match (flagged) -> a name
// that IS a watchlist legit or an allowlisted VETTED name (clean) -> otherwise
// ambiguous (fail-closed: an unrecognized package is neither proven safe nor
// proven malicious, mirroring the brain_egress ambiguous posture).
// ---------------------------------------------------------------------------
function _parsePackageTarget(target) {
  if (target && typeof target === 'object') {
    return { name: target.name, version: target.version };
  }
  if (typeof target === 'string') {
    let s = target;
    let scope = '';
    if (s.charAt(0) === '@') { scope = '@'; s = s.slice(1); }
    const at = s.indexOf('@');
    if (at === -1) return { name: scope + s, version: undefined };
    return { name: scope + s.slice(0, at), version: s.slice(at + 1) };
  }
  return { name: undefined, version: undefined };
}

function _scanSupplyChain(target) {
  const sc = cveDb.surfaces.supply_chain || {};
  const parsed = _parsePackageTarget(target);
  const name = parsed.name;
  if (typeof name !== 'string' || name.length === 0) {
    return { verdict: 'ambiguous', surface: 'supply_chain', findings: [] };
  }
  const lname = name.toLowerCase();

  const knownBad = Array.isArray(sc.known_bad_packages) ? sc.known_bad_packages : [];
  for (let i = 0; i < knownBad.length; i++) {
    if (knownBad[i] === name) {
      return {
        verdict: 'flagged',
        surface: 'supply_chain',
        findings: [{ ruleId: 'supply_chain:known_bad', reason: _clip('package ' + name + ' is on the known-bad list') }],
      };
    }
  }

  const watch = Array.isArray(sc.typosquat_watchlist) ? sc.typosquat_watchlist : [];
  for (let i = 0; i < watch.length; i++) {
    const entry = watch[i] || {};
    const names = Array.isArray(entry.watch) ? entry.watch : [];
    for (let j = 0; j < names.length; j++) {
      if (String(names[j]).toLowerCase() === lname) {
        return {
          verdict: 'flagged',
          surface: 'supply_chain',
          findings: [{ ruleId: 'supply_chain:typosquat', reason: _clip('possible typosquat of ' + entry.legit) }],
        };
      }
    }
  }
  // A name that IS a watchlist "legit" entry is the legitimate package it protects.
  for (let i = 0; i < watch.length; i++) {
    const entry = watch[i] || {};
    if (entry.legit && String(entry.legit).toLowerCase() === lname) {
      return { verdict: 'clean', surface: 'supply_chain', findings: [] };
    }
  }

  const allow = Array.isArray(sc.allowlist) ? sc.allowlist : [];
  for (let i = 0; i < allow.length; i++) {
    if (allow[i] && allow[i].name === name && allow[i].disposition === 'VETTED') {
      return { verdict: 'clean', surface: 'supply_chain', findings: [] };
    }
  }

  return { verdict: 'ambiguous', surface: 'supply_chain', findings: [] };
}

// ---------------------------------------------------------------------------
// scanSurface(surfaceType, target, opts) -- the ONE generalized entry point.
//   - brain_egress: delegates to classify() (block->flagged, allow->clean,
//     ambiguous->ambiguous).
//   - the four regex surfaces: run _regexSweep against cveDb.surfaces[surfaceType];
//     first hit -> flagged, no hit -> clean. Never ambiguous. A non-string target
//     throws a TypeError (fail loud, mirrors auditQueryString's input guard).
//   - supply_chain: the structured heuristic above (can return ambiguous).
// ---------------------------------------------------------------------------
function scanSurface(surfaceType, target, opts) {
  if (surfaceType === 'brain_egress') {
    return _scanBrainEgress(target, opts);
  }
  if (surfaceType === 'supply_chain') {
    return _scanSupplyChain(target);
  }
  if (REGEX_SURFACES.has(surfaceType)) {
    if (typeof target !== 'string') {
      throw new TypeError('scanSurface: ' + surfaceType + ' target must be a string; got ' + typeof target);
    }
    const rules = Array.isArray(cveDb.surfaces[surfaceType]) ? cveDb.surfaces[surfaceType] : [];
    const sweep = _regexSweep(target, rules);
    if (sweep.hit) {
      return {
        verdict: 'flagged',
        surface: surfaceType,
        findings: [{ ruleId: sweep.ruleId, reason: _clip(sweep.reason) }],
      };
    }
    return { verdict: 'clean', surface: surfaceType, findings: [] };
  }
  throw new Error('scanSurface: unknown surface type "' + surfaceType + '"');
}

// ---------- Exports ----------
// Only the public entry point plus the frozen surface list (AS-01).
module.exports = {
  scanSurface: scanSurface,
  SURFACES: SURFACES,
};
