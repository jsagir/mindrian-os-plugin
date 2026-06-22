'use strict';
/*
 * Phase 171 - methodology-ingest pipeline test. Asserts the Part 8 boundary
 * gate catches user/venture data, the Neo4j Cypher is parameterized (no raw
 * interpolation), and the Pinecone records are well-formed + flat-scalar.
 * House rule: hyphens only, no em-dashes.
 */
const assert = require('node:assert');
const mi = require('../lib/core/methodology-ingest.cjs');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

const cleanSpec = {
  name: 'Test Diffusion Theory',
  description: 'A generic supply-side theory of how innovations diffuse.',
  methodology_tier: 'pws',
  mos_command: '/mos:analyze-timing',
  author: 'Some Author',
  key_concepts: ['variable A', 'variable B'],
  related_frameworks: ['S-Curve Analysis'],
  tags: ['diffusion', 'adoption'],
  steps: [{ name: 'Step one', description: 'do the first thing' }, { name: 'Step two', description: 'do the second' }],
  cases: [{ name: 'Case Alpha', description: 'a textbook case', fi: 'High', oc: 'Low' }],
  chains_in: ['S-Curve Analysis'],
  chains_out: ['Scenario Planning'],
};

// 1. boundary gate - clean spec passes
const a1 = mi.auditSpecPart8(cleanSpec);
ok('clean spec passes the Part 8 gate', a1.clean === true && a1.violations.length === 0);

// 2. boundary gate - catches each forbidden pattern
ok('catches email', mi.auditSpecPart8({ name: 'X', description: 'contact me at a@b.com' }).clean === false);
ok('catches user-possessive', mi.auditSpecPart8({ name: 'X', description: "this is the user's data" }).clean === false);
ok('catches room id', mi.auditSpecPart8({ name: 'X', description: 'see room:motj-ecosystem' }).clean === false);
ok('catches currency figure', mi.auditSpecPart8({ name: 'X', description: 'revenue was $4,200,000' }).clean === false);

// 3. Cypher is parameterized (injection-safe)
const { cypher, params } = mi.buildFrameworkCypher(cleanSpec);
ok('cypher merges a Framework by $name', cypher.indexOf('MERGE (f:Framework {name:$name})') !== -1);
ok('cypher uses map-merge not interpolation', cypher.indexOf('SET f += $props') !== -1);
ok('params carry the name', params.name === 'Test Diffusion Theory');
ok('params carry steps', params.steps.length === 2 && params.steps[0].props.step_number === 1);
ok('params carry cases', params.cases.length === 1 && params.cases[0].props.fi === 'High');
ok('params carry chains', params.chains_in[0] === 'S-Curve Analysis' && params.chains_out[0] === 'Scenario Planning');
ok('framework name never interpolated into cypher body', cypher.indexOf('Test Diffusion Theory') === -1);

// 4. Pinecone records well-formed
const recs = mi.buildPineconeRecords(cleanSpec);
const ids = recs.map(function (r) { return r._id; });
ok('summary record present', ids.indexOf('framework-test-diffusion-theory') !== -1);
ok('one record per case', ids.indexOf('test-diffusion-theory-case-case-alpha') !== -1);
ok('one record per step', ids.indexOf('test-diffusion-theory-step-1') !== -1 && ids.indexOf('test-diffusion-theory-step-2') !== -1);
ok('every record has content + flat values', recs.every(function (r) {
  return typeof r.content === 'string' && r.content.length > 0 &&
    Object.values(r).every(function (v) {
      return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ||
        (Array.isArray(v) && v.every(function (x) { return typeof x === 'string'; }));
    });
}));

// 5. ingestPlan - 6 steps, gate reflected, fail-closed on dirty spec
const plan = mi.ingestPlan(cleanSpec);
ok('plan has 6 steps', plan.steps.length === 6);
ok('plan gate_clean true for clean spec', plan.gate_clean === true);
ok('plan gate_clean false for dirty spec', mi.ingestPlan({ name: 'X', description: 'a@b.com' }).gate_clean === false);

console.log('\nPASS ' + pass + ' assertions');
