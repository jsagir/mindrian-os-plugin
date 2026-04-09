'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Will fail until module is created
const { extractOpportunities, opportunityHash, OPPORTUNITY_SCHEMA_FIELDS } = require('../lib/core/opportunity-extractor.cjs');

describe('OPPORTUNITY_SCHEMA_FIELDS', () => {
  it('contains all 9 required fields', () => {
    assert.equal(OPPORTUNITY_SCHEMA_FIELDS.length, 9);
    const expected = ['problem', 'mirror_solution', 'domain', 'evidence', 'source_framework', 'knight_position', 'confidence', 'created', 'status'];
    assert.deepStrictEqual(OPPORTUNITY_SCHEMA_FIELDS, expected);
  });
});

describe('opportunityHash', () => {
  it('returns consistent hash for same problem statement', () => {
    const h1 = opportunityHash('Missing structural coverage in market-analysis');
    const h2 = opportunityHash('Missing structural coverage in market-analysis');
    assert.equal(h1, h2);
  });

  it('returns different hashes for different problems', () => {
    const h1 = opportunityHash('Missing structural coverage in market-analysis');
    const h2 = opportunityHash('Contradiction between team and financials');
    assert.notEqual(h1, h2);
  });

  it('normalizes whitespace and case', () => {
    const h1 = opportunityHash('Missing  structural   coverage');
    const h2 = opportunityHash('missing structural coverage');
    assert.equal(h1, h2);
  });

  it('returns a hex string', () => {
    const h = opportunityHash('test problem');
    assert.match(h, /^[0-9a-f]+$/);
  });
});

describe('extractOpportunities', () => {
  it('returns empty array for empty input', () => {
    const result = extractOpportunities([], 'diagnose', '/tmp/room');
    assert.deepStrictEqual(result, []);
  });

  it('converts GAP insight to opportunity with uncertainty knight_position', () => {
    const insights = [{
      type: 'gap',
      subtype: 'structural',
      section: 'market-analysis',
      confidence: 'HIGH',
      message: 'No competitive landscape section found'
    }];
    const result = extractOpportunities(insights, 'diagnose', '/tmp/room');
    assert.equal(result.length, 1);
    const opp = result[0];
    assert.equal(opp.knight_position, 'uncertainty');
    assert.equal(opp.confidence, 0.8);
    assert.equal(opp.source_framework, 'diagnose');
    assert.equal(opp.status, 'banked');
    assert.ok(opp.problem.includes('structural'));
    assert.ok(opp.problem.includes('market-analysis'));
    assert.ok(opp.mirror_solution);
    assert.ok(opp.domain);
    assert.ok(opp.evidence);
    assert.ok(opp.created);
    // All schema fields present
    for (const field of OPPORTUNITY_SCHEMA_FIELDS) {
      assert.ok(opp[field] !== undefined, `Missing field: ${field}`);
    }
  });

  it('converts CONVERGE insight to opportunity with risk knight_position', () => {
    const insights = [{
      type: 'convergence',
      term: 'sustainability',
      count: 4,
      confidence: 'MEDIUM',
      message: 'Theme appears across 4 sections'
    }];
    const result = extractOpportunities(insights, 'lean-canvas', '/tmp/room');
    assert.equal(result.length, 1);
    const opp = result[0];
    assert.equal(opp.knight_position, 'risk');
    assert.equal(opp.confidence, 0.5);
    assert.equal(opp.source_framework, 'lean-canvas');
    assert.ok(opp.problem.includes('sustainability'));
    assert.ok(opp.mirror_solution.includes('4'));
  });

  it('converts CONTRADICT insight to opportunity with mixed knight_position', () => {
    const insights = [{
      type: 'contradiction',
      section: 'problem-definition',
      section2: 'financial-model',
      confidence: 'HIGH',
      message: 'Revenue model contradicts stated mission'
    }];
    const result = extractOpportunities(insights, 'find-bottlenecks', '/tmp/room');
    assert.equal(result.length, 1);
    const opp = result[0];
    assert.equal(opp.knight_position, 'mixed');
    assert.equal(opp.confidence, 0.8);
    assert.ok(opp.problem.includes('problem-definition'));
    assert.ok(opp.problem.includes('financial-model'));
    assert.ok(opp.domain.includes('problem-definition'));
  });

  it('maps confidence HIGH->0.8, MEDIUM->0.5, LOW->0.3', () => {
    const make = (conf) => [{
      type: 'gap', subtype: 'semantic', section: 'test', confidence: conf, message: 'test'
    }];
    assert.equal(extractOpportunities(make('HIGH'), 'x', '/tmp')[0].confidence, 0.8);
    assert.equal(extractOpportunities(make('MEDIUM'), 'x', '/tmp')[0].confidence, 0.5);
    assert.equal(extractOpportunities(make('LOW'), 'x', '/tmp')[0].confidence, 0.3);
  });

  it('falls back to parseFloat for numeric confidence strings', () => {
    const insights = [{
      type: 'gap', subtype: 'adjacent', section: 'test', confidence: '0.65', message: 'test'
    }];
    assert.equal(extractOpportunities(insights, 'x', '/tmp')[0].confidence, 0.65);
  });

  it('handles multiple insights in one call', () => {
    const insights = [
      { type: 'gap', subtype: 'structural', section: 's1', confidence: 'HIGH', message: 'm1' },
      { type: 'convergence', term: 't1', count: 3, confidence: 'MEDIUM', message: 'm2' },
      { type: 'contradiction', section: 's2', section2: 's3', confidence: 'LOW', message: 'm3' },
    ];
    const result = extractOpportunities(insights, 'diagnose', '/tmp/room');
    assert.equal(result.length, 3);
  });
});
