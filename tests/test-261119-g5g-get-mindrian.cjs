#!/usr/bin/env node
'use strict';

/*
 * Quick 261119-g5g: the get-mindrian installer skill and its catalog entry.
 * =========================================================================
 * WHAT: gates for the one install procedure (SKILL.md in the marketplace repo,
 * at a public raw URL that never moves), its two reference files, the plugin
 * repo AGENT-INSTALL.md pointer, the get-mindrian plugin manifest and README,
 * the catalog entry, and scripts/release-lib/get-mindrian-entry.cjs.
 *
 * Marketplace dir: env MINDRIAN_MARKETPLACE_DIR, else ~/mindrian-marketplace.
 * The skill folder is <dir>/plugins/get-mindrian/skills/get-mindrian.
 *
 * Arms (repeatable --arm <id>; no flag runs all): shape, links, pointer, dashes,
 * commands, principle, safety, detection, lookup, stale, skill, marketplace, entry.
 *
 * Hermetic: temp dirs under os.tmpdir() are removed on exit; the real
 * marketplace repo is only READ (its git status is compared before and after).
 *
 * Exit: 1 on any FAIL; 77 (printed as `ENV GAP: <reason>`) only when the
 * marketplace dir is absent and nothing else failed; else 0. Hyphens only;
 * long dashes are built from char codes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const MDIR = process.env.MINDRIAN_MARKETPLACE_DIR || path.join(os.homedir(), 'mindrian-marketplace');
const REAL_MARKETPLACE = path.join(os.homedir(), 'mindrian-marketplace');
const SKILL_REL = path.join('plugins', 'get-mindrian', 'skills', 'get-mindrian');
const SKILLDIR = path.join(MDIR, SKILL_REL);
const PLUGIN_DIR = path.join(MDIR, 'plugins', 'get-mindrian');
const ENTRY_SCRIPT = path.join(REPO_ROOT, 'scripts', 'release-lib', 'get-mindrian-entry.cjs');
const AGENT_INSTALL = path.join(REPO_ROOT, 'AGENT-INSTALL.md');
const BASE = 'https://raw.githubusercontent.com/jsagir/mindrian-marketplace/master/plugins/get-mindrian/skills/get-mindrian/';
const SKILL_URL = BASE + 'SKILL.md';
const SKILL_FILES = ['SKILL.md', 'references/commands.md', 'references/troubleshooting.md'];
const LONG_DASHES = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']');

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
let envGap = null;

function pass(arm, name) { passed += 1; console.log('PASS: ' + arm + ' ' + name); }
function fail(arm, name, reason) { failed += 1; console.log('FAIL: ' + arm + ' ' + name + ' -- ' + reason); }
function reasonOf(e) {
  if (e && e.name === 'AssertionError' && e.generatedMessage && 'actual' in e) {
    const j = (v) => JSON.stringify(v);
    return 'actual=' + String(j(e.actual)).slice(0, 220) + ' expected=' + String(j(e.expected)).slice(0, 220);
  }
  return e && e.message ? String(e.message).split('\n')[0] : String(e);
}
function check(arm, name, fn) {
  try { fn(); pass(arm, name); } catch (e) { fail(arm, name, reasonOf(e)); }
}

const argv = process.argv.slice(2);
const ARMS = [];
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--arm' && argv[i + 1]) { ARMS.push(argv[i + 1]); i += 1; }
}
const ALL_ARMS = ['shape', 'links', 'pointer', 'dashes', 'commands', 'principle', 'safety', 'detection', 'lookup', 'stale', 'skill', 'marketplace', 'entry'];
const WANT = ARMS.length ? ARMS : ALL_ARMS;
for (const a of WANT) {
  if (!ALL_ARMS.includes(a)) {
    console.log('FAIL: args arm -- unknown arm ' + a);
    console.log('RESULT: PASS=0 FAIL=1');
    process.exit(1);
  }
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't261119-g5g-'));
process.on('exit', () => {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
});
let counter = 0;
function mkTemp(label) {
  counter += 1;
  const d = path.join(TMP, label + '-' + counter);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function marketplaceStatus() {
  if (!fs.existsSync(path.join(REAL_MARKETPLACE, '.git'))) return 'absent';
  const r = spawnSync('git', ['-C', REAL_MARKETPLACE, 'status', '--porcelain'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout : 'unreadable';
}
const MP_STATUS_BEFORE = marketplaceStatus();
const HAVE_MDIR = fs.existsSync(MDIR);

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------
function read(p) { return fs.readFileSync(p, 'utf8'); }
function skillText(rel) {
  const p = path.join(SKILLDIR, rel);
  if (!fs.existsSync(p)) throw new Error('missing skill file ' + p);
  return read(p);
}
function allSkill() { return SKILL_FILES.map((rel) => ({ rel, text: skillText(rel) })); }

// Frontmatter: the lines between the first two "---" lines, one `key: value` per line.
function parseSkill(text) {
  const lines = text.split('\n');
  assert.equal(lines[0], '---', 'SKILL.md does not start with a frontmatter line "---"');
  const end = lines.indexOf('---', 1);
  assert.ok(end > 0, 'SKILL.md frontmatter has no closing "---"');
  const fm = {};
  for (const l of lines.slice(1, end)) {
    const i = l.indexOf(': ');
    if (i > 0) fm[l.slice(0, i).trim()] = l.slice(i + 2).trim();
  }
  return { fm, body: lines.slice(end + 1) };
}
function unquote(v) {
  if (v && v.length >= 2 && ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'"))) return v.slice(1, -1);
  return v;
}
// A section: the lines from its "## " heading to the next "## " heading.
function section(text, headingStart) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith('## ') && l.startsWith(headingStart));
  if (start < 0) throw new Error('no section heading that starts with "' + headingStart + '"');
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith('## ')) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

// ---------------------------------------------------------------------------
// Arms
// ---------------------------------------------------------------------------
function armShape() {
  check('shape', 'SKILL.md has the install.md shape in order after the frontmatter', () => {
    const { body } = parseSkill(skillText('SKILL.md'));
    const nonEmpty = body.map((l, i) => ({ l, i })).filter((x) => x.l.trim());
    assert.ok(nonEmpty.length && nonEmpty[0].l.startsWith('# '), 'the first body line is not an H1');
    const firstH2 = body.findIndex((l) => l.startsWith('## '));
    const quote = body.findIndex((l) => l.startsWith('> '));
    assert.ok(quote >= 0 && quote < firstH2, 'no "> " blockquote line before the first "## "');
    const opening = body.slice(0, 15).some((l) => l.includes('I want you to install MindrianOS for me'));
    assert.ok(opening, 'the opening line is not in the first 15 body lines');
    const iObj = body.indexOf('## OBJECTIVE');
    const iDone = body.indexOf('## DONE WHEN');
    const iTodo = body.indexOf('## TODO');
    assert.ok(iObj >= 0 && iDone > iObj && iTodo > iDone, 'OBJECTIVE, DONE WHEN and TODO are missing or out of order');
    const todo = section(body.join('\n'), '## TODO').split('\n').filter((l) => l.startsWith('- [ ] '));
    assert.ok(todo.length >= 3 && todo.length <= 7, 'TODO has ' + todo.length + ' checkboxes, expected 3 to 7');
    const route0 = body.findIndex((l) => l.startsWith('## 0. Find your route'));
    const firstNpx = body.findIndex((l) => /npx (--yes |-y )?@mindrian_os\/cli/.test(l));
    assert.ok(route0 >= 0, 'no "## 0. Find your route"');
    assert.ok(firstNpx < 0 || firstNpx > route0, 'the first "npx [--yes] @mindrian_os/cli" comes before "## 0. Find your route" (line ' + (firstNpx + 1) + ')');
    assert.ok(nonEmpty[nonEmpty.length - 1].l.startsWith('EXECUTE NOW:'), 'the last non-empty line does not start with "EXECUTE NOW:"');
  });
}

function armLinks() {
  check('links', 'SKILL.md links both references by absolute raw URL', () => {
    const t = skillText('SKILL.md');
    assert.ok(t.includes(BASE + 'references/commands.md'), 'no absolute link to references/commands.md');
    assert.ok(t.includes(BASE + 'references/troubleshooting.md'), 'no absolute link to references/troubleshooting.md');
  });
  check('links', 'every BASE URL in the skill files maps to a file in the skill folder', () => {
    const bad = [];
    const re = new RegExp(BASE.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '([^\\s)`\'"<>]+)', 'g');
    for (const { rel, text } of allSkill()) {
      let m;
      while ((m = re.exec(text)) !== null) {
        const target = m[1].replace(/[.,;:]+$/, '');
        if (!fs.existsSync(path.join(SKILLDIR, target))) bad.push(rel + ' -> ' + target);
      }
    }
    assert.deepEqual(bad, []);
  });
  check('links', 'no skill file links /HEAD/ or /main/ of the marketplace repo', () => {
    const re = /jsagir\/mindrian-marketplace\/(HEAD|main)\//;
    const bad = allSkill().filter(({ text }) => re.test(text)).map(({ rel }) => rel);
    assert.deepEqual(bad, []);
  });
}

function armPointer() {
  check('pointer', 'AGENT-INSTALL.md names SKILL_URL, has fewer than 30 lines, and carries no npx and no curl', () => {
    const t = read(AGENT_INSTALL);
    assert.ok(t.includes(SKILL_URL), 'AGENT-INSTALL.md does not name ' + SKILL_URL);
    const n = t.split('\n').length - (t.endsWith('\n') ? 1 : 0);
    assert.ok(n < 30, 'AGENT-INSTALL.md has ' + n + ' lines');
    assert.ok(!/npx/.test(t), 'AGENT-INSTALL.md contains npx');
    assert.ok(!/curl/.test(t), 'AGENT-INSTALL.md contains curl');
  });
}

function armDashes() {
  check('dashes', 'no long dash in the skill files, READMEs, manifests, pointer, entry script and this test', () => {
    const files = SKILL_FILES.map((rel) => path.join(SKILLDIR, rel)).concat([
      path.join(PLUGIN_DIR, 'README.md'),
      path.join(MDIR, 'README.md'),
      path.join(PLUGIN_DIR, '.claude-plugin', 'plugin.json'),
      path.join(MDIR, '.claude-plugin', 'marketplace.json'),
      AGENT_INSTALL,
      ENTRY_SCRIPT,
      __filename,
    ]);
    const missing = files.filter((f) => !fs.existsSync(f));
    assert.deepEqual(missing, [], 'missing files');
    const bad = files.filter((f) => LONG_DASHES.test(read(f)));
    assert.deepEqual(bad, []);
  });
}

function armCommands() {
  check('commands', 'every /mos:<name> in the skill files has commands/<name>.md', () => {
    const names = new Set();
    for (const { text } of allSkill()) {
      for (const m of text.matchAll(/\/mos:([a-z0-9-]+)/g)) names.add(m[1]);
    }
    const missing = [...names].filter((n) => !fs.existsSync(path.join(REPO_ROOT, 'commands', n + '.md')));
    assert.deepEqual(missing, []);
  });
  check('commands', '"/mos:rooms new" has "## Subcommand: new" in commands/rooms.md', () => {
    const uses = allSkill().some(({ text }) => text.includes('/mos:rooms new'));
    if (!uses) return;
    assert.ok(/^## Subcommand: new\b/m.test(read(path.join(REPO_ROOT, 'commands', 'rooms.md'))), 'commands/rooms.md lacks "## Subcommand: new"');
  });
  check('commands', 'every "claude plugin <sub>" and "claude plugin marketplace <sub>" is a real subcommand', () => {
    const okPlugin = ['install', 'list', 'marketplace', 'update', 'validate', 'details'];
    const okMarket = ['add', 'list', 'update'];
    const bad = [];
    for (const { rel, text } of allSkill()) {
      for (const m of text.matchAll(/\bclaude plugin ([a-z][a-z-]*)/g)) {
        if (!okPlugin.includes(m[1])) bad.push(rel + ': claude plugin ' + m[1]);
      }
      for (const m of text.matchAll(/\bclaude plugin marketplace ([a-z][a-z-]*)/g)) {
        if (!okMarket.includes(m[1])) bad.push(rel + ': claude plugin marketplace ' + m[1]);
      }
    }
    assert.deepEqual(bad, []);
  });
}

function armPrinciple() {
  check('principle', 'route D guides one step at a time and asks what the person sees, and never says "then stop"', () => {
    const d = section(skillText('SKILL.md'), '## Route D');
    assert.ok(/one step at a time/i.test(d), 'route D lacks "one step at a time"');
    assert.ok(/what (you|they) see/i.test(d), 'route D lacks "what you see" or "what they see"');
    assert.ok(!/then stop/i.test(d), 'route D contains "then stop"');
  });
  check('principle', 'no line says "say exactly this"', () => {
    const bad = [];
    for (const { rel, text } of allSkill()) {
      text.split('\n').forEach((l, i) => { if (/say exactly this/i.test(l)) bad.push(rel + ':' + (i + 1)); });
    }
    assert.deepEqual(bad, []);
  });
  check('principle', 'every line with mindrian-os.com/docs/install also says "fallback"', () => {
    const bad = [];
    for (const { rel, text } of allSkill()) {
      text.split('\n').forEach((l, i) => {
        if (l.includes('mindrian-os.com/docs/install') && !/fallback/i.test(l)) bad.push(rel + ':' + (i + 1));
      });
    }
    assert.deepEqual(bad, []);
  });
}

function armSafety() {
  check('safety', 'every line with sudo also says "do not", "never", "no sudo" or "unless"', () => {
    const bad = [];
    for (const { rel, text } of allSkill()) {
      text.split('\n').forEach((l, i) => {
        if (/\bsudo\b/i.test(l) && !/do not|never|no sudo|unless/i.test(l)) bad.push(rel + ':' + (i + 1) + ': ' + l.trim().slice(0, 100));
      });
    }
    assert.deepEqual(bad, []);
  });
}

function armDetection() {
  check('detection', 'section 1 detects the system or asks once', () => {
    const s = section(skillText('SKILL.md'), '## 1. Know the system');
    for (const needle of ['uname', '$PSVersionTable', '/proc/version']) {
      assert.ok(s.includes(needle), 'section 1 lacks ' + needle);
    }
    assert.ok(/ask once/i.test(s), 'section 1 lacks "ask once"');
  });
}

function armLookup() {
  check('lookup', 'section 2 names the official sources, the exact error, and the MindrianOS facts rule', () => {
    const s = section(skillText('SKILL.md'), '## 2. Look things up the right way');
    for (const needle of ['code.claude.com/docs', 'nodejs.org', 'docs.astral.sh/uv', 'python.org', 'exact error', 'MindrianOS facts come only from']) {
      assert.ok(s.includes(needle), 'section 2 lacks "' + needle + '"');
    }
  });
}

function armStale() {
  check('stale', 'no skill file carries a known stale fact', () => {
    const banned = ['22.16', 'Pinecone', 'Neo4j', 'KuzuDB', 'brain-access', 'mindrian-os-plugin/main/install.sh'];
    const bad = [];
    for (const { rel, text } of allSkill()) {
      for (const b of banned) if (text.includes(b)) bad.push(rel + ': ' + b);
    }
    assert.deepEqual(bad, []);
  });
  check('stale', 'SKILL.md says 22.18.0', () => {
    assert.ok(skillText('SKILL.md').includes('22.18.0'), 'SKILL.md lacks 22.18.0');
  });
  check('stale', 'every MINDRIAN_ variable in the skill files has a non-test reader in lib, bin, hooks, scripts or commands', () => {
    const tokens = new Set();
    for (const { text } of allSkill()) for (const m of text.matchAll(/MINDRIAN_[A-Z_]+/g)) tokens.add(m[0]);
    const dirs = ['lib', 'bin', 'hooks', 'scripts', 'commands'].map((d) => path.join(REPO_ROOT, d)).filter((d) => fs.existsSync(d));
    const orphan = [];
    for (const t of tokens) {
      const r = spawnSync('grep', ['-rlF', '--exclude=*.test.*', '--exclude=test-*', '--exclude-dir=node_modules', '--exclude-dir=tests', t, ...dirs], { encoding: 'utf8' });
      if (!(r.stdout || '').trim()) orphan.push(t);
    }
    assert.deepEqual(orphan, []);
  });
}

function armSkill() {
  check('skill', 'frontmatter name and description follow the Agent Skills rules', () => {
    const t = skillText('SKILL.md');
    const { fm } = parseSkill(t);
    assert.equal(fm.name, 'get-mindrian');
    assert.equal(fm.name, path.basename(SKILLDIR), 'name differs from the folder name');
    assert.ok(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fm.name) && fm.name.length <= 64, 'name breaks the pattern or length');
    const d = unquote(fm.description || '');
    assert.ok(d.length >= 1 && d.length <= 1024, 'description length ' + d.length);
    assert.ok(!d.includes('\n'), 'description is not one line');
    const n = t.split('\n').length;
    assert.ok(n < 500, 'SKILL.md has ' + n + ' lines');
  });
  check('skill', 'plugin.json is named get-mindrian and the plugin README names the install line and SKILL_URL', () => {
    const pj = JSON.parse(read(path.join(PLUGIN_DIR, '.claude-plugin', 'plugin.json')));
    assert.equal(pj.name, 'get-mindrian');
    const readme = read(path.join(PLUGIN_DIR, 'README.md'));
    assert.ok(readme.includes('/plugin install get-mindrian --marketplace jsagir/mindrian-marketplace'), 'README lacks the one-step install line');
    assert.ok(readme.includes(SKILL_URL), 'README lacks SKILL_URL');
  });
}

function armMarketplace() {
  check('marketplace', 'marketplace.json keeps mos at 0 and mos-desktop at 1 and carries one get-mindrian entry', () => {
    const m = JSON.parse(read(path.join(MDIR, '.claude-plugin', 'marketplace.json')));
    assert.ok(Array.isArray(m.plugins), 'plugins is not an array');
    assert.equal(m.plugins[0].name, 'mos', 'plugins[0].name');
    assert.equal(m.plugins[1].name, 'mos-desktop', 'plugins[1].name');
    const g = m.plugins.filter((p) => p.name === 'get-mindrian');
    assert.equal(g.length, 1, 'get-mindrian entries: ' + g.length);
    assert.equal(g[0].source, './plugins/get-mindrian');
    const pj = JSON.parse(read(path.join(PLUGIN_DIR, '.claude-plugin', 'plugin.json')));
    assert.equal(g[0].version, pj.version, 'entry version differs from plugin.json version');
  });
}

// Entry script sandboxes
const OTHER = { name: 'other-plugin', description: 'keep me', version: '1.0.0', source: './plugins/other' };
function makeEntrySandbox(opts) {
  const o = opts || {};
  const root = mkTemp('mp');
  fs.mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
  const m = {
    name: 'mindrian-marketplace',
    owner: { name: 'fixture' },
    plugins: [
      { name: 'mos', description: 'fixture', version: '9.9.9', source: { source: 'npm', package: '@mindrian_os/cli', version: '9.9.9' } },
      { name: 'mos-desktop', displayName: 'MindrianOS', description: 'fixture', version: '9.9.9', source: './plugins/mos-desktop' },
      OTHER,
    ],
  };
  if (!o.noManifest) fs.writeFileSync(path.join(root, '.claude-plugin', 'marketplace.json'), JSON.stringify(m, null, 2) + '\n');
  const pdir = path.join(root, 'plugins', 'get-mindrian');
  fs.mkdirSync(path.join(pdir, '.claude-plugin'), { recursive: true });
  if (!o.noPluginJson) fs.writeFileSync(path.join(pdir, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'get-mindrian', version: '0.1.0' }, null, 2) + '\n');
  const sk = path.join(root, SKILL_REL);
  fs.mkdirSync(path.join(sk, 'references'), { recursive: true });
  for (const rel of SKILL_FILES) {
    if (o.missingSkill === rel) continue;
    fs.writeFileSync(path.join(sk, rel), 'fixture\n');
  }
  return root;
}
function runEntry(args) {
  return spawnSync(process.execPath, [ENTRY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 20000 });
}
function outOf(r) { return (r.stdout || '') + (r.stderr || ''); }

function armEntry() {
  check('entry', 'the entry script exists', () => {
    assert.ok(fs.existsSync(ENTRY_SCRIPT), 'missing ' + ENTRY_SCRIPT);
  });
  check('entry', '--check exits 1 when the entry is missing', () => {
    const root = makeEntrySandbox();
    const r = runEntry(['--check', '--marketplace', root]);
    assert.equal(r.status, 1, outOf(r).trim().slice(0, 200));
  });
  check('entry', '--write makes --check exit 0, a second --write is byte-identical, and other entries keep bytes and order', () => {
    const root = makeEntrySandbox();
    const mp = path.join(root, '.claude-plugin', 'marketplace.json');
    const before = JSON.parse(read(mp)).plugins;
    let r = runEntry(['--write', '--marketplace', root]);
    assert.equal(r.status, 0, '--write: ' + outOf(r).trim().slice(0, 200));
    r = runEntry(['--check', '--marketplace', root]);
    assert.equal(r.status, 0, '--check after --write: ' + outOf(r).trim().slice(0, 200));
    const once = read(mp);
    r = runEntry(['--write', '--marketplace', root]);
    assert.equal(r.status, 0, 'second --write');
    assert.equal(read(mp), once, 'second --write changed bytes');
    const after = JSON.parse(once).plugins;
    assert.deepEqual(after.slice(0, before.length).map((p) => JSON.stringify(p, null, 2)), before.map((p) => JSON.stringify(p, null, 2)), 'other entries changed');
    assert.equal(after[after.length - 1].name, 'get-mindrian', 'get-mindrian is not appended at the end');
    assert.equal(after[after.length - 1].version, '0.1.0');
  });
  check('entry', '--write replaces a changed entry in place; --check exits 1 on a changed field', () => {
    const root = makeEntrySandbox();
    const mp = path.join(root, '.claude-plugin', 'marketplace.json');
    runEntry(['--write', '--marketplace', root]);
    const m = JSON.parse(read(mp));
    const idx = m.plugins.findIndex((p) => p.name === 'get-mindrian');
    m.plugins[idx].version = '0.0.1';
    m.plugins.push({ name: 'late', version: '1.0.0', source: './plugins/late', description: 'after' });
    fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
    let r = runEntry(['--check', '--marketplace', root]);
    assert.equal(r.status, 1, 'changed field: ' + outOf(r).trim().slice(0, 200));
    assert.ok(/version/.test(outOf(r)), 'DRIFT output does not name the field');
    r = runEntry(['--write', '--marketplace', root]);
    assert.equal(r.status, 0);
    const m2 = JSON.parse(read(mp));
    assert.equal(m2.plugins.findIndex((p) => p.name === 'get-mindrian'), idx, 'entry moved');
    assert.equal(m2.plugins[m2.plugins.length - 1].name, 'late', 'later entry moved');
    assert.equal(runEntry(['--check', '--marketplace', root]).status, 0);
  });
  check('entry', 'exit 2 names the path when an input is missing', () => {
    const cases = [
      ['marketplace dir', () => path.join(TMP, 'does-not-exist'), 'does-not-exist'],
      ['marketplace.json', () => makeEntrySandbox({ noManifest: true }), 'marketplace.json'],
      ['plugin.json', () => makeEntrySandbox({ noPluginJson: true }), 'plugin.json'],
    ].concat(SKILL_FILES.map((rel) => [rel, () => makeEntrySandbox({ missingSkill: rel }), path.basename(rel)]));
    for (const [label, mk, needle] of cases) {
      for (const mode of ['--check', '--write']) {
        const r = runEntry([mode, '--marketplace', mk()]);
        assert.equal(r.status, 2, label + ' ' + mode + ' exited ' + r.status);
        assert.ok(outOf(r).includes(needle), label + ' ' + mode + ' message does not name ' + needle);
      }
    }
  });
  check('entry', 'live --check against the marketplace dir exits 0', () => {
    const r = runEntry(['--check', '--marketplace', MDIR]);
    assert.equal(r.status, 0, outOf(r).trim().slice(0, 200));
  });
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const ORDER = [
  ['shape', armShape], ['links', armLinks], ['pointer', armPointer], ['dashes', armDashes],
  ['commands', armCommands], ['principle', armPrinciple], ['safety', armSafety], ['detection', armDetection],
  ['lookup', armLookup], ['stale', armStale], ['skill', armSkill], ['marketplace', armMarketplace], ['entry', armEntry],
];
const NEEDS_MDIR = new Set(['shape', 'links', 'dashes', 'commands', 'principle', 'safety', 'detection', 'lookup', 'stale', 'skill', 'marketplace', 'entry']);
for (const [id, fn] of ORDER) {
  if (!WANT.includes(id)) continue;
  if (NEEDS_MDIR.has(id) && !HAVE_MDIR) {
    envGap = 'the marketplace dir ' + MDIR + ' is absent (set MINDRIAN_MARKETPLACE_DIR)';
    console.log('SKIP: ' + id + ' -- ' + envGap);
    continue;
  }
  try { fn(); } catch (e) { fail(id, 'arm crashed', reasonOf(e)); }
}

check('safety', 'the real marketplace repo git status is unchanged', () => {
  assert.equal(marketplaceStatus(), MP_STATUS_BEFORE);
});

console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
if (failed) process.exit(1);
if (envGap) {
  console.log('ENV GAP: ' + envGap);
  process.exit(77);
}
process.exit(0);
