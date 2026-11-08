'use strict';
// Phase 370 contract schema test (RED until plan 370-02 creates data/review-contract.json).
// Arms S1 to S9. Node built-ins only. No network, no Brain call.

const fs = require('fs');
const path = require('path');
const H = require('./helpers/review-contract-370.cjs');

const rep = H.reporter('test-370-contract-schema');

let contract;
try {
  contract = H.realContract();
} catch (e) {
  rep.fatal('cannot read data/review-contract.json (review-contract data file): ' + e.message);
}

function compile(entry, addI) {
  let flags = entry.flags || '';
  if (addI && flags.indexOf('i') === -1) flags += 'i';
  return new RegExp(entry.pattern, flags);
}

rep.arm('S1 top-level keys', () => {
  const need = ['review_contract', 'applies_to', 'sections', 'optional_tail', 'forbidden_headings',
    'forbidden_body_patterns', 'counts', 'limits', 'internal_terms', 'soft_terms'];
  for (const k of need) rep.ok(Object.prototype.hasOwnProperty.call(contract, k), 'missing key ' + k);
  rep.eq(contract.review_contract, 1, 'review_contract must equal 1');
});

rep.arm('S2 sections and optional tail', () => {
  const want = ['Executive Summary', 'Reality Check', 'Faculty Questions', 'Expert Conversations',
    'Research Validation + Reframe', 'Strategic Challenge'];
  rep.ok(Array.isArray(contract.sections), 'sections must be an array');
  rep.eq(contract.sections.length, want.length, 'sections length');
  contract.sections.forEach((s, i) => {
    rep.ok(typeof s.id === 'string' && s.id.length > 0, 'section ' + i + ' needs an id');
    rep.eq(s.heading, want[i], 'section ' + i + ' heading');
  });
  rep.ok(Array.isArray(contract.optional_tail) && contract.optional_tail.length >= 1, 'optional_tail needs an item');
  rep.eq(contract.optional_tail[0].heading, 'For advanced students', 'optional_tail[0].heading');
});

rep.arm('S3 counts', () => {
  const rp = contract.counts && contract.counts.revision_points;
  rep.ok(rp, 'counts.revision_points missing');
  rep.eq(rp.min, 3, 'revision_points.min');
  rep.eq(rp.max, 5, 'revision_points.max');
  rep.eq(rp.under, 'executive_summary', 'revision_points.under');
  const cd = contract.counts && contract.counts.cross_domain_ideas;
  rep.ok(cd, 'counts.cross_domain_ideas missing');
  rep.eq(cd.max, 2, 'cross_domain_ideas.max');
  rep.ok(typeof cd.marker === 'string' && cd.marker.length > 0, 'cross_domain_ideas.marker must be a non-empty string');
});

rep.arm('S4 forbidden headings and body patterns', () => {
  for (const group of ['forbidden_headings', 'forbidden_body_patterns']) {
    rep.ok(Array.isArray(contract[group]), group + ' must be an array');
    for (const e of contract[group]) {
      rep.ok(typeof e.id === 'string' && e.id.length > 0, group + ' entry needs an id');
      rep.ok(typeof e.pattern === 'string', group + ' entry ' + e.id + ' needs a pattern string');
      compile(e, false);
      rep.ok(typeof e.why === 'string' && e.why.trim().length > 0, group + ' entry ' + e.id + ' needs a why');
    }
  }
  const samples = [
    'Tool Analysis: Methodology Scores by Tool',
    'Methodology Score by Tool',
    'Improvement Recommendations Mapped to Agents',
    'Sci-Fi Connection',
    'Visual Synthesis Prompt',
  ];
  for (const s of samples) {
    const hit = contract.forbidden_headings.some((e) => compile(e, true).test(s));
    rep.ok(hit, 'no forbidden_headings entry covers the heading "' + s + '"');
  }
});

rep.arm('S5 internal terms and soft terms', () => {
  rep.ok(Array.isArray(contract.internal_terms) && contract.internal_terms.length > 0, 'internal_terms must be a non-empty array');
  for (const e of contract.internal_terms) {
    rep.ok(typeof e.term === 'string' && e.term.length > 0, 'internal_terms entry needs a term');
    rep.ok(typeof e.pattern === 'string', 'internal_terms entry ' + e.term + ' needs a pattern');
    compile(e, false);
    rep.ok(typeof e.why === 'string' && e.why.trim().length > 0, 'internal_terms entry ' + e.term + ' needs a why');
  }
  for (const s of ['MCP', 'Neo4j', 'Brain', 'Theo']) {
    rep.ok(contract.internal_terms.some((e) => compile(e, false).test(s)), 'no internal_terms entry matches "' + s + '"');
  }
  const st = contract.soft_terms;
  rep.ok(st && ['strict', 'exempt_if_in_source', 'compound_only'].indexOf(st.policy) !== -1, 'soft_terms.policy must be strict, exempt_if_in_source or compound_only');
  rep.ok(Array.isArray(st.terms), 'soft_terms.terms must be an array');
  for (const t of ['database', 'graph']) rep.ok(st.terms.indexOf(t) !== -1, 'soft_terms.terms must include ' + t);
});

rep.arm('S6 limits guard', () => {
  const lim = contract.limits;
  rep.ok(lim && typeof lim === 'object' && !Array.isArray(lim), 'limits must be an object');
  const allowed = ['body_words_max', 'reflection_questions_max', 'cross_domain_under', 'limits_source'];
  let numeric = false;
  for (const k of Object.keys(lim)) {
    rep.ok(allowed.indexOf(k) !== -1, 'limits key not allowed: ' + k);
    if (typeof lim[k] === 'number') numeric = true;
  }
  if (numeric) {
    rep.ok(typeof lim.limits_source === 'string' && lim.limits_source.indexOf('370-DECISION.md O2') === 0,
      'a numeric limit needs limits_source starting with "370-DECISION.md O2"');
  }
});

// S7: every NEVER_SAY_TERMS entry is classified. A new entry makes the arm fail until it is classified.
const COVERED = ['MCP', 'SQLite', 'room.db', 'Brain', 'graph engine']; // backend names: need an internal_terms entry
const GENERATED = ['brain_*', 'tool id', 'script path', 'plugin file path', 'run id', 'leaf id', 'lane letter',
  'shape code', 'verdict code']; // ids and paths: covered by the generated tiers (H3, H4), not hand-kept
const CHAT_ONLY = {
  server: 'plain word with a high false-positive rate (370-CONTEXT: stays off the denylist)',
  index: 'plain word with a high false-positive rate (370-CONTEXT: stays off the denylist)',
  hook: 'plain word with a high false-positive rate (370-CONTEXT: stays off the denylist)',
  database: 'soft term, governed by the soft_terms policy and not by internal_terms',
  'navigation engine': 'chat-only product phrase; not named by the review contract decisions',
  'error code': 'chat-only phrase about replies, not a name in a review body',
  'egress guard': 'chat-only phrase about replies, not a name in a review body',
  SUPERSEDES: 'graph edge word, chat-only; not named by the review contract decisions',
  'engine score': 'chat-only phrase about replies, not a name in a review body',
  'Tier 0': 'chat-only phrase; move it to the covered list to promote it',
};
rep.arm('S7 NEVER_SAY_TERMS drift', () => {
  const { NEVER_SAY_TERMS } = require(path.join(H.ROOT, 'lib', 'hmi', 'larry-reply-checks.cjs'));
  rep.ok(Array.isArray(NEVER_SAY_TERMS) && NEVER_SAY_TERMS.length > 0, 'NEVER_SAY_TERMS must be a non-empty array');
  const unclassified = [];
  for (const term of NEVER_SAY_TERMS) {
    if (COVERED.indexOf(term) !== -1) {
      const hit = contract.internal_terms.some((e) => compile(e, false).test(term));
      rep.ok(hit, 'NEVER_SAY_TERMS entry "' + term + '" is a backend name but no internal_terms entry covers it');
    } else if (GENERATED.indexOf(term) !== -1) {
      // covered by the generated denylist tiers; plan 370-02 tests that side
    } else if (Object.prototype.hasOwnProperty.call(CHAT_ONLY, term)) {
      rep.ok(CHAT_ONLY[term].length > 0, 'chat-only exemption needs a reason');
    } else {
      unclassified.push(term);
    }
  }
  rep.ok(unclassified.length === 0, 'unclassified NEVER_SAY_TERMS entries (classify them in this test): ' + unclassified.join(', '));
});

rep.arm('S8 no dash characters in the contract file', () => {
  const raw = fs.readFileSync(path.join(H.ROOT, H.CONTRACT_REL), 'utf8');
  rep.ok(raw.indexOf(H.EM) === -1, 'contract file holds U+2014');
  rep.ok(raw.indexOf(H.EN) === -1, 'contract file holds U+2013');
});

// S9: no hand-kept term shadows a generated name (agent, command or tool id read from disk).
function liveNames(root) {
  const names = new Set();
  const agentsDir = path.join(root, 'agents');
  for (const f of fs.readdirSync(agentsDir)) {
    if (!f.endsWith('.md')) continue;
    const m = /^name:\s*(.+)$/m.exec(fs.readFileSync(path.join(agentsDir, f), 'utf8'));
    names.add(String(m ? m[1] : f.replace(/\.md$/, '')).trim().toLowerCase());
  }
  const cmds = JSON.parse(fs.readFileSync(path.join(root, 'data', 'command-registry.json'), 'utf8')).commands;
  for (const c of cmds) {
    const bare = String(c.command).replace(/^\//, '').toLowerCase();
    names.add(bare);
    names.add(bare.replace(/^mos:/, ''));
  }
  const tools = JSON.parse(fs.readFileSync(path.join(root, 'data', 'mcp-tool-connectors.json'), 'utf8')).connectors;
  for (const t of tools) names.add(String(t.surface).replace(/^mcp:/, '').toLowerCase());
  return names;
}
function shadowed(c, names) {
  const out = [];
  for (const e of c.internal_terms) {
    const t = String(e.term).replace(/^\//, '').toLowerCase();
    if (names.has(t)) out.push(e.term);
  }
  return out;
}

rep.arm('S9 no hand-kept term equals a generated name', () => {
  const names = liveNames(H.ROOT);
  rep.ok(names.size > 0, 'could not read any live name from disk');
  const bad = shadowed(contract, names);
  rep.ok(bad.length === 0, 'hand-kept internal_terms equal a generated name: ' + bad.join(', '));
  // Self-check: a clone that holds a generated agent name must trip the detector.
  const firstAgent = fs.readdirSync(path.join(H.ROOT, 'agents')).filter((f) => f.endsWith('.md'))[0].replace(/\.md$/, '');
  const clone = JSON.parse(JSON.stringify(contract));
  clone.internal_terms.push({ term: firstAgent, pattern: firstAgent, flags: '', why: 'self-check clone' });
  const tripped = shadowed(clone, names);
  rep.ok(tripped.indexOf(firstAgent) !== -1, 'self-check clone did not trip the arm for agent ' + firstAgent);
  // Self-check 2: a command written with a leading slash and upper case must trip it too.
  const firstCmd = JSON.parse(fs.readFileSync(path.join(H.ROOT, 'data', 'command-registry.json'), 'utf8')).commands[0].command;
  const clone2 = JSON.parse(JSON.stringify(contract));
  clone2.internal_terms.push({ term: firstCmd.toUpperCase(), pattern: 'x', flags: '', why: 'self-check clone' });
  rep.ok(shadowed(clone2, names).length >= 1, 'self-check clone did not trip the arm for command ' + firstCmd);
});

rep.done();
