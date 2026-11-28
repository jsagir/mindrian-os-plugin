#!/usr/bin/env node
'use strict';

// Phase 401 plan F1 (quick 261127-f1a): rule F1 (frontmatter split) and rule B
// (body bytes) over the 255 surface files. Each leg prints `ok: <id> <text>`
// or `FAIL: <id> <text>`; a leg never skips. The rules live in
// scripts/check-frontmatter-split.cjs and tools/401/body-bytes-proof.cjs; this
// test requires them and copies no rule.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const split = require('../scripts/check-frontmatter-split.cjs');
const proof = require('../tools/401/body-bytes-proof.cjs');
const brainCodemod = require('../tools/401/brain-name-codemod.cjs');
const grantsCodemod = require('../tools/401/tool-grants-codemod.cjs');
const grants = require('../scripts/check-tool-grants.cjs');
const mirrors = require('../scripts/build-skill-mirrors.cjs');

let passed = 0;
let failed = 0;
function leg(id, text, fn) {
  let msg = null;
  try {
    msg = fn();
  } catch (e) {
    msg = 'threw: ' + (e && e.message ? e.message : String(e));
  }
  if (msg) {
    failed += 1;
    process.stdout.write('FAIL: ' + id + ' ' + text + ' -- ' + msg + '\n');
  } else {
    passed += 1;
    process.stdout.write('ok: ' + id + ' ' + text + '\n');
  }
}

const FILES = split.listSurfaceFiles(ROOT);
const TEXT = {};
const BUF = {};
for (const f of FILES) {
  BUF[f.rel] = fs.readFileSync(path.join(ROOT, f.rel));
  TEXT[f.rel] = BUF[f.rel].toString('utf8');
}
const FIXTURE = grants.readFixture(ROOT) || { sets: {}, host: {}, pending: {} };

function inPending(rel) {
  return Object.prototype.hasOwnProperty.call(FIXTURE.pending || {}, rel);
}

const TRANSFORMS = [
  ['brain-name-codemod', (t) => brainCodemod.transform(t).text],
  ['tool-grants-codemod', (t, rel) => grantsCodemod.transform(t, { inPending: inPending(rel) }).text],
  ['rewriteText', (t) => split.rewriteText(t).text],
];

leg('T1', 'no surface file holds a triple dash between its fences', () => {
  const per = { commands: 0, skills: 0, agents: 0 };
  const sample = [];
  for (const f of FILES) {
    const off = split.findOffenders(TEXT[f.rel]);
    if (off.length) {
      per[f.cls] += 1;
      for (const o of off) if (sample.length < 10) sample.push(f.rel + ':' + o.line);
    }
  }
  const n = per.commands + per.skills + per.agents;
  return n ? n + ' files offend (commands ' + per.commands + ', skills ' + per.skills + ', agents ' + per.agents + '); first: ' + sample.join(' ') : null;
});

leg('T2', 'the host view equals the text between the fences in each file', () => {
  const bad = [];
  for (const f of FILES) {
    if (split.hostFrontmatter(TEXT[f.rel]) !== split.betweenFences(TEXT[f.rel])) bad.push(f.rel);
  }
  return bad.length ? bad.length + ' files differ; first: ' + bad.slice(0, 5).join(' ') : null;
});

leg('T3', 'gray-matter parses each file; description is a string; key count equals column-0 key lines', () => {
  let matter;
  try {
    matter = require('gray-matter');
  } catch (_) {
    return 'ENV GAP: gray-matter not resolvable';
  }
  const bad = [];
  for (const f of FILES) {
    const b = split.frontmatterBounds(TEXT[f.rel]);
    if (!b) { bad.push(f.rel + ' (no fences)'); continue; }
    let parsed;
    try {
      parsed = matter(TEXT[f.rel], { cache: false });
    } catch (e) {
      bad.push(f.rel + ' (parse: ' + e.message.split('\n')[0] + ')');
      continue;
    }
    if (typeof parsed.data.description !== 'string') bad.push(f.rel + ' (description)');
    const keyLines = b.lines.slice(1, b.fmEnd).filter((l) => /^[A-Za-z_][A-Za-z0-9_-]*\s*:/.test(l)).length;
    if (Object.keys(parsed.data).length !== keyLines) bad.push(f.rel + ' (keys ' + Object.keys(parsed.data).length + ' vs ' + keyLines + ')');
  }
  return bad.length ? bad.length + ' files: ' + bad.slice(0, 5).join(' ') : null;
});

leg('T4', 'the new-surface generator writes no triple dash inside frontmatter', () => {
  const gen = require('../scripts/build-new-surface.cjs');
  const spec = {
    kind: 'command', name: 'fixture-surface', connects_to_spine: true, sensor_triggers: ['SENS-01'],
    reach_id: 'context_block', sub_mode: 'fixture-tool', framework: null, posture: 'push_forward',
    hierarchy_rank: 42, filing: 'none', plan_gated: false, web_scope: null, surface: 'F.1',
  };
  const skill = {
    kind: 'skill', name: 'fixture-expert', excluded: true, description: 'A fixture expert lens',
    expert: { name: 'Ada', surname: 'Fixture', hat: 'white', provenance: { runId: 'r1', domainNodeIds: [] } },
  };
  const n1 = split.findOffenders(gen.renderSurface(spec)).length;
  const n2 = split.findOffenders(gen.renderExcludedExpertSkill(skill)).length;
  return n1 || n2 ? 'renderSurface ' + n1 + ' offenders, renderExcludedExpertSkill ' + n2 + ' offenders' : null;
});

leg('T5', 'rewriteLine and rewriteText unit cases', () => {
  const errs = [];
  const eq = (a, b, what) => { if (a !== b) errs.push(what + ': got ' + JSON.stringify(a)); };
  eq(split.rewriteLine('# --- Phase 122 workflow-layer frontmatter ---'), '# == Phase 122 workflow-layer frontmatter ==', 'one-line comment');
  eq(split.rewriteLine('# -----'), '# ==', 'run of 5');
  eq(split.rewriteLine('description: a --- b'), 'description: a --- b', 'key line');
  const two = '---\nname: x\ndescription: y\n# --- block start\n# end of block ---\nk: v\n---\n---\n# --- x ---\nbody\n';
  const r2 = split.rewriteText(two);
  eq(r2.text, '---\nname: x\ndescription: y\n# == block start\n# end of block ==\nk: v\n---\n---\n# --- x ---\nbody\n', 'two-line block and body lines');
  const r3 = split.rewriteText('---\nname: x\ndescription: a --- b\n---\nbody\n');
  if (r3.changed || r3.unfixable.length !== 1) errs.push('unfixable key line not reported');
  const real = TEXT['commands/grade-grant.md'] || TEXT[FILES[0].rel];
  const lines = real.split('\n');
  lines.splice(1, 0, '# --- x ---');
  eq(split.findOffenders(lines.join('\n')).length, 1, 'real file with one injected comment');
  return errs.length ? errs.join('; ') : null;
});

leg('T6', 'rewriteText is idempotent on each of the 255 file texts', () => {
  const bad = [];
  for (const f of FILES) {
    const once = split.rewriteText(TEXT[f.rel]).text;
    const twice = split.rewriteText(once);
    if (twice.changed || twice.text !== once) bad.push(f.rel);
  }
  return bad.length ? bad.length + ' files: ' + bad.slice(0, 5).join(' ') : null;
});

leg('T7', 'rule B in memory: no transform changes a body byte', () => {
  const bad = [];
  for (const f of FILES) {
    const inBody = proof.bodyOf(BUF[f.rel]);
    for (const [name, fn] of TRANSFORMS) {
      const out = Buffer.from(fn(TEXT[f.rel], f.rel), 'utf8');
      const outBody = proof.bodyOf(out);
      if (!inBody || !outBody || !inBody.equals(outBody)) bad.push(f.rel + ' (' + name + ')');
    }
  }
  // Arm (a): trap lines in the body. A frontmatter line that is exactly three
  // dashes is the closing fence, and a frontmatter that holds the pending key
  // is never renamed; so the frontmatter of this text holds the comment, the
  // key and the Brain entry, and the body holds all 4 trap forms.
  const trap =
    '---\nname: trap\ndescription: trap text\n# --- x ---\nallowed-tools:\n  - Read\n  - mcp__mindrian-brain__brain_search\n---\n' +
    '# --- x ---\n---\nallowed-tools:\n  - mcp__mindrian-brain__brain_search\npending_tool_grants:\n  - Bash\n';
  const trapBody = proof.bodyOf(Buffer.from(trap));
  for (const [name, fn] of TRANSFORMS) {
    const out = fn(trap, 'commands/trap.md');
    const outBuf = Buffer.from(out);
    const fmIn = trap.slice(0, trap.length - trapBody.length);
    const fmOut = out.slice(0, out.length - (proof.bodyOf(outBuf) || Buffer.alloc(0)).length);
    if (name === 'tool-grants-codemod') {
      const out2 = grantsCodemod.transform(trap, { inPending: true }).text;
      if (out2 === trap) bad.push('arm a: ' + name + ' did not change the frontmatter');
      if (!proof.bodyOf(Buffer.from(out2)).equals(trapBody)) bad.push('arm a: ' + name + ' body');
      continue;
    }
    if (fmOut === fmIn) bad.push('arm a: ' + name + ' did not change the frontmatter');
    if (!proof.bodyOf(outBuf).equals(trapBody)) bad.push('arm a: ' + name + ' body');
  }
  // Arm (b): the proof can fail.
  const a = fs.mkdtempSync(path.join(os.tmpdir(), 't401-a-'));
  const b = fs.mkdtempSync(path.join(os.tmpdir(), 't401-b-'));
  try {
    for (const d of [a, b]) {
      fs.writeFileSync(path.join(d, 'one.md'), '---\nname: one\n---\nbody one\n');
      fs.writeFileSync(path.join(d, 'two.md'), '---\nname: two\n---\nbody two\n');
    }
    fs.writeFileSync(path.join(b, 'two.md'), '---\nname: two\n---\nbody twO\n');
    const read = (d) => (rel) => (fs.existsSync(path.join(d, rel)) ? fs.readFileSync(path.join(d, rel)) : null);
    const r = proof.compareBodies(read(a), read(b), ['one.md', 'two.md']);
    if (r.length !== 1 || r[0].rel !== 'two.md' || r[0].kind !== 'body-differs') bad.push('arm b: ' + JSON.stringify(r));
  } finally {
    fs.rmSync(a, { recursive: true, force: true });
    fs.rmSync(b, { recursive: true, force: true });
  }
  return bad.length ? bad.length + ' findings: ' + bad.slice(0, 5).join(' ') : null;
});

leg('T8', 'rule B for generated mirrors: the mirror body follows the command body', () => {
  const bad = [];
  let n = 0;
  for (const f of FILES) {
    if (f.cls !== 'commands') continue;
    const name = path.basename(f.rel, '.md');
    if (mirrors.SKIP_LIST.includes(name)) continue;
    const mrel = 'skills/' + name + '/SKILL.md';
    if (!BUF[mrel]) continue;
    n += 1;
    let t = TEXT[f.rel];
    for (const [, fn] of TRANSFORMS) t = fn(t, f.rel);
    const exp = mirrors.computeExpectedMirror(Buffer.from(t, 'utf8'), name, BUF[mrel]).buffer;
    const eb = proof.bodyOf(exp);
    const mb = proof.bodyOf(BUF[mrel]);
    if (!eb || !mb || !eb.equals(mb)) bad.push(mrel);
  }
  if (n !== 112) bad.push('mirror count ' + n + ' (expected 112)');
  return bad.length ? bad.length + ' mirrors: ' + bad.slice(0, 5).join(' ') : null;
});

process.stdout.write('test-401-frontmatter-split: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
