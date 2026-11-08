'use strict';
// Phase 370 denylist-from-disk test (RED until plan 370-02 creates lib/core/review-contract.cjs).
// Arms D1 to D7. The denylist for agents, commands and tool ids is GENERATED from disk at check
// time; no name and no count may be frozen in the module. Node built-ins only. No network.

const fs = require('fs');
const path = require('path');
const H = require('./helpers/review-contract-370.cjs');

const rep = H.reporter('test-370-denylist-from-disk');
const M = H.requireModule(rep);

function labels(dl) {
  return dl.entries.map((e) => e.label);
}
function hasLabel(dl, label) {
  return labels(dl).indexOf(label) !== -1;
}
function liveAgents(root) {
  const dir = path.join(root, 'agents');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => {
    const m = /^name:\s*(.+)$/m.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
    return String(m ? m[1] : f.replace(/\.md$/, '')).trim();
  });
}
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
}

let repoA;
let repoB;
rep.arm('setup temp repos', () => {
  repoA = H.mkTmpRepo({
    agents: ['zeta-planner', 'omega'],
    commands: ['/mos:zeta-run', '/mos:omega-run'],
    tools: ['zeta_probe', 'omega_probe'],
  });
  repoB = H.mkTmpRepo({ agents: ['omega'], commands: [], tools: [] });
});

rep.arm('D1 generated entries and counts on a temp repo', () => {
  const dl = M.buildDenylist({ repoRoot: repoA });
  for (const l of ['zeta-planner', 'Zeta Planner Agent', 'Omega Agent', 'mos:zeta-run', 'zeta_probe']) {
    rep.ok(hasLabel(dl, l), 'missing generated label: ' + l);
  }
  const byLabel = (l) => dl.entries.find((e) => e.label === l);
  rep.eq(byLabel('Zeta Planner Agent').class, 'agent_name', 'class of the agent label');
  rep.eq(byLabel('mos:zeta-run').class, 'command', 'class of the command label');
  rep.eq(byLabel('zeta_probe').class, 'tool_id', 'class of the tool label');
  rep.eq(JSON.stringify(dl.counts), JSON.stringify({ agents: 2, commands: 2, tools: 2 }), 'counts');
});

rep.arm('D2 the list shrinks on a smaller temp repo', () => {
  const dl = M.buildDenylist({ repoRoot: repoB });
  for (const l of ['zeta-planner', 'Zeta Planner Agent', 'mos:zeta-run', 'zeta_probe']) {
    rep.ok(!hasLabel(dl, l), 'label should be gone: ' + l);
  }
  rep.ok(hasLabel(dl, 'Omega Agent'), 'Omega Agent should remain');
  rep.eq(dl.counts.agents, 1, 'counts.agents');
});

rep.arm('D3 checkReview follows repoRoot', () => {
  const text = H.wrap('Look at Zeta Planner Agent first.\n\nThen mos:zeta-run once.\n\nThen zeta_probe last.');
  const a = M.checkReview(text, { repoRoot: repoA });
  rep.ok(H.findV(a, 'internal_name', 'agent_name').length >= 1, 'repo A should flag the agent phrase');
  rep.ok(H.findV(a, 'internal_name', 'command').length >= 1, 'repo A should flag the command');
  rep.ok(H.findV(a, 'internal_name', 'tool_id').length >= 1, 'repo A should flag the tool id');
  const b = M.checkReview(text, { repoRoot: repoB });
  rep.eq(H.findV(b, 'internal_name', 'tool_id').length, 0, 'repo B must not flag zeta_probe');
});

rep.arm('D4 counts on the real repo equal the disk', () => {
  const dl = M.buildDenylist({ repoRoot: H.ROOT });
  const agents = fs.readdirSync(path.join(H.ROOT, 'agents')).filter((f) => f.endsWith('.md')).length;
  const cmds = JSON.parse(fs.readFileSync(path.join(H.ROOT, 'data', 'command-registry.json'), 'utf8')).commands.length;
  const tools = JSON.parse(fs.readFileSync(path.join(H.ROOT, 'data', 'mcp-tool-connectors.json'), 'utf8')).connectors.length;
  rep.eq(dl.counts.agents, agents, 'counts.agents');
  rep.eq(dl.counts.commands, cmds, 'counts.commands');
  rep.eq(dl.counts.tools, tools, 'counts.tools');
  rep.ok(hasLabel(dl, 'Grading Agent'), 'missing label Grading Agent');
  rep.ok(hasLabel(dl, 'mos:grade'), 'missing label mos:grade');
});

rep.arm('D5 single-word and hyphenated agent names', () => {
  const repo = H.mkTmpRepo({ agents: ['research', 'framework-runner'], commands: [], tools: [] });
  const dl = M.buildDenylist({ repoRoot: repo });
  rep.ok(hasLabel(dl, 'Research Agent'), 'missing Title form Research Agent');
  rep.ok(!hasLabel(dl, 'research') && !hasLabel(dl, 'Research'), 'the bare word research must not be a label');
  rep.ok(hasLabel(dl, 'framework-runner'), 'missing kebab form');
  rep.ok(hasLabel(dl, 'Framework Runner Agent'), 'missing Title form');
  const res = M.checkReview(H.wrap('The research was careful and the grading was fair.'), { repoRoot: H.ROOT });
  rep.eq(JSON.stringify(res.violations), '[]', 'bare words research and grading must not be flagged');
  rep.ok(res.ok === true, 'a plain sentence must pass');
});

rep.arm('D6 no frozen names or counts in the module source', () => {
  const src = stripComments(fs.readFileSync(path.join(H.ROOT, H.MODULE_REL), 'utf8'));
  const bad = [];
  for (const name of liveAgents(H.ROOT)) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('[\'"]' + esc + '[\'"]').test(src)) bad.push('agent ' + name);
  }
  const dl = M.buildDenylist({ repoRoot: H.ROOT });
  for (const n of [dl.counts.agents, dl.counts.commands, dl.counts.tools]) {
    if (new RegExp('(?<![\\w.])' + n + '(?![\\w.])').test(src)) bad.push('count ' + n);
  }
  rep.ok(bad.length === 0, 'frozen in module: ' + bad.join(', '));
});

rep.arm('D7 the module does not require brain-client', () => {
  const src = stripComments(fs.readFileSync(path.join(H.ROOT, H.MODULE_REL), 'utf8'));
  rep.ok(!/require\(\s*['"`][^'"`]*brain[^'"`]*['"`]/i.test(src), 'module requires a path that contains brain');
});

rep.done();
