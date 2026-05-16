#!/usr/bin/env node
/*
 * Phase 121.5-08 Plan -- soft-alias-runner unit tests.
 *
 * Behavior contract (per plan):
 *   T1: softAliasRun({from, to, args}) returns a JSON envelope with the
 *       redirect target, the deprecation note, the args, and ok: true.
 *   T2: The deprecation note follows Larry voice: starts with "Deprecated. "
 *       and names the new command, and mentions v1.14.0 removal.
 *   T3: NO em-dash characters (U+2014) anywhere in the deprecation note.
 *   T4: softAliasRun({from, to, args}) returns {redirect, args, ok: true}
 *       shape suitable for the LLM to act on.
 *   T8a: commands/mos.md exists.
 *   T8b: commands/mos.md declares body_shape: E (Action Report).
 *   T9: Each of the 5 soft-alias stub commands (heal, query, organize,
 *       hmi-status, visualize) carries the "Deprecated" body marker AND
 *       names the canonical target.
 *   T10a: commands/diagnostics.md carries the "Renamed" rename note + names
 *       /mos:fingerprint as the v1.14.0 target.
 *   T10b: diagnostics.md frontmatter has renaming_to: fingerprint.
 *
 * No em-dash check covers every soft-alias stub body.
 *
 * Hermetic: reads only the live repo files via fs.readFileSync. No network,
 * no spawn (the runner's emitForLLM uses process.stdout, but we test
 * softAliasRun directly).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RUNNER = require(path.join(REPO_ROOT, 'scripts', 'soft-alias-runner.cjs'));

let pass = 0;
let fail = 0;
const failures = [];

function assert(cond, name, detail) {
  if (cond) {
    pass++;
    console.log('PASS  ' + name);
  } else {
    fail++;
    failures.push(name + (detail ? ' -- ' + detail : ''));
    console.log('FAIL  ' + name + (detail ? ' -- ' + detail : ''));
  }
}

// --- T1: redirect target + JSON envelope shape ---
{
  const r = RUNNER.softAliasRun({ from: 'heal', to: 'doctor --heal-room', args: ['--dry-run'] });
  assert(r && typeof r === 'object', 'T1: returns an object', JSON.stringify(r));
  assert(r.redirect === '/mos:doctor --heal-room', 'T1: redirect is /mos:doctor --heal-room', r.redirect);
  assert(Array.isArray(r.args) && r.args[0] === '--dry-run', 'T1: args list preserved', JSON.stringify(r.args));
  assert(r.ok === true, 'T1: ok=true');
  assert(typeof r.deprecation_note === 'string' && r.deprecation_note.length > 0, 'T1: deprecation_note non-empty');
}

// --- T2: Larry voice: starts with "Deprecated. " + names new command + v1.14.0 ---
{
  const r = RUNNER.softAliasRun({ from: 'query', to: 'graph', args: [] });
  assert(r.deprecation_note.indexOf('Deprecated. ') === 0, 'T2: starts with "Deprecated. "', r.deprecation_note);
  assert(r.deprecation_note.indexOf('/mos:graph') >= 0, 'T2: names the new command (/mos:graph)', r.deprecation_note);
  assert(/v1\.14\.0/.test(r.deprecation_note), 'T2: mentions v1.14.0 removal', r.deprecation_note);
}

// --- T3: NO em-dash anywhere in the note ---
{
  const samples = [
    RUNNER.softAliasRun({ from: 'heal', to: 'doctor --heal-room', args: [] }),
    RUNNER.softAliasRun({ from: 'query', to: 'graph', args: [] }),
    RUNNER.softAliasRun({ from: 'organize', to: 'rooms organize', args: [] }),
    RUNNER.softAliasRun({ from: 'hmi-status', to: 'doctor --ui-compliance --json', args: [] }),
    RUNNER.softAliasRun({ from: 'visualize', to: 'dashboard --mermaid', args: [] }),
  ];
  for (const r of samples) {
    assert(r.deprecation_note.indexOf('—') < 0,
      'T3: no em-dash in note (from=' + (r && r.redirect) + ')',
      r.deprecation_note);
  }
}

// --- T4: shape is consumable by LLM ---
{
  const r = RUNNER.softAliasRun({ from: 'organize', to: 'rooms organize', args: ['propose'] });
  const keys = Object.keys(r).sort();
  const required = ['args', 'deprecation_note', 'ok', 'redirect'];
  for (const k of required) {
    assert(keys.indexOf(k) >= 0, 'T4: envelope has key "' + k + '"', JSON.stringify(keys));
  }
}

// --- T8: commands/mos.md exists + body_shape: E ---
{
  const mosPath = path.join(REPO_ROOT, 'commands', 'mos.md');
  assert(fs.existsSync(mosPath), 'T8a: commands/mos.md exists', mosPath);
  if (fs.existsSync(mosPath)) {
    const body = fs.readFileSync(mosPath, 'utf8');
    // Accept body_shape: E OR body_shape: E (Action Report) form
    assert(/^body_shape:\s*E(\s|$|\b)/m.test(body), 'T8b: declares body_shape: E', body.slice(0, 400));
    assert(/state-aware router/i.test(body), 'T8c: body mentions "state-aware router"');
    assert(body.indexOf('—') < 0, 'T8d: NO em-dash in commands/mos.md');
  }
}

// --- T9: 5 soft-alias stubs carry "Deprecated" + name their canonical target ---
{
  const stubs = [
    { file: 'commands/heal.md', target: '/mos:doctor --heal-room' },
    { file: 'commands/query.md', target: '/mos:graph' },
    { file: 'commands/organize.md', target: '/mos:rooms organize' },
    { file: 'commands/hmi-status.md', target: '/mos:doctor --ui-compliance' },
    { file: 'commands/visualize.md', target: '/mos:dashboard --mermaid' },
  ];
  for (const s of stubs) {
    const p = path.join(REPO_ROOT, s.file);
    const body = fs.readFileSync(p, 'utf8');
    assert(/Deprecated/.test(body), 'T9: ' + s.file + ' body has "Deprecated"', body.slice(0, 200));
    assert(body.indexOf(s.target) >= 0, 'T9: ' + s.file + ' names target ' + s.target);
    assert(body.indexOf('—') < 0, 'T9: ' + s.file + ' has no em-dash');
    assert(/^deprecated:\s*true/m.test(body), 'T9: ' + s.file + ' frontmatter deprecated: true');
  }
}

// --- T10: diagnostics.md is a RENAME (not fold) to /mos:fingerprint ---
{
  const p = path.join(REPO_ROOT, 'commands', 'diagnostics.md');
  const body = fs.readFileSync(p, 'utf8');
  assert(/Renamed/.test(body), 'T10a: diagnostics.md body has "Renamed"');
  assert(body.indexOf('/mos:fingerprint') >= 0, 'T10b: diagnostics.md names /mos:fingerprint');
  assert(/^renaming_to:\s*fingerprint/m.test(body), 'T10c: diagnostics.md frontmatter renaming_to: fingerprint');
  assert(body.indexOf('—') < 0, 'T10d: diagnostics.md has no em-dash');
}

console.log('');
console.log('soft-alias.test.cjs: ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) {
  console.log('FAILURES:');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
process.exit(0);
