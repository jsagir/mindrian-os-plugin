#!/usr/bin/env node
'use strict';

/*
 * Phase 110-01 - Brain Context Packet schema validator + drift tripwire.
 *
 * Implements: PACKET-110-01, PACKET-110-02 (CONTEXT D-04 + D-05 + D-06 + D-08).
 *
 * Canon Part 8 (Graph Boundary): data/brain-packet-schema.json is the
 * wire-format contract that makes LOCAL-to-BRAIN leaks structurally hard. Every
 * object node carries additionalProperties:false; a packet with a stray
 * transcript or body field is refused at the wire, not stripped-and-sent. This
 * script is the build/CI tripwire that fails the commit if the schema drifts.
 *
 * Canon Part 7 (Reuse Before Build): mirrors scripts/build-command-registry.cjs
 * verbatim (the Phase 122 generated-checked pattern). Reuses the transitive
 * ajv@8.18.0 already on disk via @modelcontextprotocol/sdk; do NOT add ajv to
 * package.json (CLAUDE.md "What NOT to Use" - ajv is bundled, never direct).
 *
 * Canon Part 9 (Memory Locality): the schema is the typed-packet wire the Brain
 * reasons over. Brain never receives raw memory; it receives shapes this
 * script asserts are well-formed.
 *
 * Usage:
 *   node scripts/build-brain-packet-schema.cjs
 *       Validate the schema. Exit 1 on any failure with a recovery line.
 *       (The schema is hand-maintained; this default run does NOT regenerate
 *       anything - it validates well-formedness + the 12-job closed vocabulary
 *       + recursive additionalProperties:false.)
 *
 *   node scripts/build-brain-packet-schema.cjs --check
 *       Re-validate in memory; same exit semantics. Identical to the default
 *       run today (the schema is the source of truth - nothing to regenerate);
 *       --check exists so the pre-commit hook + Feynman runner can call it
 *       the same way they call scripts/build-command-registry.cjs --check.
 *
 * Test seam: process.env.MINDRIAN_BRAIN_PACKET_SCHEMA overrides the schema path
 * (used by tests/test-brain-packet-schema-check.cjs to point at mangled
 * fixtures). The production path is hard-coded relative to REPO_ROOT.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = process.env.MINDRIAN_BRAIN_PACKET_SCHEMA
  || path.join(REPO_ROOT, 'data', 'brain-packet-schema.json');

// The 12 shipped Brain jobs (CONTEXT D-02 closed vocabulary). Mirrors the
// list in scripts/build-command-registry.cjs SHIPPED_FRAMEWORKS pattern.
// Adding a 13th job requires a CONTEXT amendment + a schema $def + this list.
const SHIPPED_JOBS = Object.freeze([
  'select_methodology',
  'suggest_next_move',
  'detect_contradiction',
  'summarize_neighborhood',
  'classify_room_budding',
  'rank_assumptions',
  'generate_feynman_explanation',
  'strengthen_minto',
  'prepare_investor_brief',
  'opportunity_react',
  'opportunity_reflect',
  'opportunity_rank',
]);

// Allow-listed non-job $defs (the shared building blocks). Keep in sync with
// data/brain-packet-schema.json. Any $def name that is neither a SHIPPED_JOB
// nor in this set is a closed-vocabulary violation.
//
// Phase 125-04 added FrameworkChainHint as a shared $def referenced from
// LocalGraphSummary.properties.framework_chain_hint (optional; carries the
// 1-3 hop Brain Cypher slice per Plan 04 D-04). The 12-job D-02 closed-vocab
// is UNTOUCHED -- FrameworkChainHint is a shared building block, not a job.
const SHARED_DEFS = new Set([
  'PrivacyMode',
  'Origin',
  'FocusNode',
  'ActiveContext',
  'BankedOpportunities',
  'Constraints',
  'ClaimProjection',
  'ContradictionProjection',
  'UnsupportedProjection',
  'RecentChangeProjection',
  'FrameworkChainHint',
  'LocalGraphSummary',
  'BrainResponse',
]);

// ---------------------------------------------------------------------------
// assertAdditionalPropsFalse - recursively walk the schema; any
// { type: 'object', properties: {...} } node missing additionalProperties:false
// is a Canon Part 8 leak surface. Push a precise JSON-pointer-shaped error.
// Skip pure $ref nodes (they have no local type/properties to enforce on).
// ---------------------------------------------------------------------------
function assertAdditionalPropsFalse(node, pathStr, errs) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      assertAdditionalPropsFalse(node[i], pathStr + '/' + i, errs);
    }
    return;
  }
  // Skip pure $ref nodes - they delegate to another schema location.
  if (typeof node.$ref === 'string' && Object.keys(node).length === 1) return;
  if (node.type === 'object' && node.properties && typeof node.properties === 'object') {
    if (node.additionalProperties !== false) {
      errs.push('object schema at ' + pathStr + ' is missing "additionalProperties": false (Canon Part 8 leak-prevention requirement)');
    }
  }
  if (node.$defs && typeof node.$defs === 'object') {
    for (const k of Object.keys(node.$defs)) {
      assertAdditionalPropsFalse(node.$defs[k], pathStr + '/$defs/' + k, errs);
    }
  }
  if (node.properties && typeof node.properties === 'object') {
    for (const k of Object.keys(node.properties)) {
      assertAdditionalPropsFalse(node.properties[k], pathStr + '/properties/' + k, errs);
    }
  }
  if (node.items) {
    if (Array.isArray(node.items)) {
      for (let i = 0; i < node.items.length; i++) {
        assertAdditionalPropsFalse(node.items[i], pathStr + '/items/' + i, errs);
      }
    } else {
      assertAdditionalPropsFalse(node.items, pathStr + '/items', errs);
    }
  }
  // "in" and "out" are the per-job sub-schema keys (not standard JSON Schema
  // keywords; specific to this contract). Recurse explicitly.
  if (node.in) assertAdditionalPropsFalse(node.in, pathStr + '/in', errs);
  if (node.out) assertAdditionalPropsFalse(node.out, pathStr + '/out', errs);
  for (const kw of ['allOf', 'anyOf', 'oneOf']) {
    if (Array.isArray(node[kw])) {
      for (let i = 0; i < node[kw].length; i++) {
        assertAdditionalPropsFalse(node[kw][i], pathStr + '/' + kw + '/' + i, errs);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// checkSchema(strictBuild) - read + parse + ajv compile + 12-job coverage +
// closed-vocabulary check + recursive additionalProperties:false. Returns
// array of error strings; empty array means OK.
// ---------------------------------------------------------------------------
function checkSchema(strictBuild) {
  const errs = [];
  let schema;
  let raw;
  try {
    raw = fs.readFileSync(SCHEMA_PATH, 'utf8');
  } catch (e) {
    return ['data/brain-packet-schema.json is missing or unreadable: ' + e.message];
  }
  try {
    schema = JSON.parse(raw);
  } catch (e) {
    return ['data/brain-packet-schema.json is not valid JSON: ' + e.message];
  }

  // ajv compile under the draft 2020-12 dialect. Ajv2020 is shipped inside the
  // same transitive ajv package (ajv/dist/2020); no new dependency.
  try {
    const Ajv2020 = require('ajv/dist/2020').default || require('ajv/dist/2020');
    new Ajv2020({ allErrors: true, strict: strictBuild ? true : false }).compile(schema);
  } catch (e) {
    errs.push('schema does not compile under ajv (draft 2020-12, strict=' + (strictBuild ? 'true' : 'false') + '): ' + (e && e.message ? e.message : String(e)));
  }

  const defs = (schema && schema.$defs) || {};

  // 12-job coverage + per-job shape sanity.
  for (const job of SHIPPED_JOBS) {
    if (!defs[job]) {
      errs.push('missing $def for shipped job: ' + job);
      continue;
    }
    if (!defs[job].in) errs.push('$def "' + job + '" has no "in" sub-schema');
    if (!defs[job].out) errs.push('$def "' + job + '" has no "out" sub-schema');
    const jobConst = defs[job].in
      && defs[job].in.properties
      && defs[job].in.properties.job;
    if (!jobConst || jobConst.const !== job) {
      errs.push('$def "' + job + '" in.properties.job must be { const: "' + job + '" }');
    }
  }

  // Closed-vocabulary check: every $def name is either a SHIPPED_JOB or a
  // known SHARED_DEF. Unknown names are a Canon Part 8 vocabulary violation.
  for (const name of Object.keys(defs)) {
    if (SHIPPED_JOBS.includes(name)) continue;
    if (SHARED_DEFS.has(name)) continue;
    errs.push('$def "' + name + '" is neither a D-02 job nor a known shared def - closed vocabulary violation');
  }

  // Recursive additionalProperties:false sweep.
  assertAdditionalPropsFalse(schema, '#', errs);

  return errs;
}

// ---------------------------------------------------------------------------
// main()
// ---------------------------------------------------------------------------
function main() {
  const isCheck = process.argv.slice(2).includes('--check');
  const errs = checkSchema(true);
  if (errs.length) {
    console.error(errs.join('\n'));
    console.error('Recovery: fix data/brain-packet-schema.json (the hand-maintained source of truth), then re-run: node scripts/build-brain-packet-schema.cjs --check');
    process.exit(1);
  }
  console.log(isCheck
    ? 'brain-packet-schema: OK'
    : 'brain-packet-schema: OK (validated; nothing to regenerate - the schema is hand-maintained)');
}

if (require.main === module) {
  main();
} else {
  module.exports = { checkSchema, assertAdditionalPropsFalse, SHIPPED_JOBS, SHARED_DEFS };
}
