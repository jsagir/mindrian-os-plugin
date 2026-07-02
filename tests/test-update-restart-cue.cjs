#!/usr/bin/env node
'use strict';

/*
 * Quick task 20260702-update-restart-cue (F8): after `claude plugin update`
 * swaps installPath under a RUNNING session, the slash-command registry goes
 * stale and commands appear to vanish. This test locks the two shipped
 * defenses:
 *
 *   (a) STALE-REGISTRY SELF-DETECTOR (scripts/sessionstart-post-update-
 *       preflight.cjs Part 7): session version != registered version ->
 *       restart cue emitted (additionalContext + systemMessage), non-blocking.
 *   (b) versions match -> silent no-op (no additionalContext).
 *   (c) malformed / missing installed_plugins.json -> graceful {continue:true},
 *       no throw (never blocks the SessionStart chain).
 *   (d) LOUD RESTART BANNER present at the end of commands/update.md, and the
 *       update flow references the Mindrian logo (mindrian-ascii-logo) so the
 *       mark-then-banner wiring cannot silently drop.
 *
 * Hermetic: drives the preflight as a subprocess with a synthetic HOME (so the
 * real ~/.claude/plugins/installed_plugins.json is never touched) and a
 * synthetic CLAUDE_PLUGIN_ROOT.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const PREFLIGHT = path.join(REPO_ROOT, 'scripts', 'sessionstart-post-update-preflight.cjs');
const UPDATE_MD = path.join(REPO_ROOT, 'commands', 'update.md');
const ACTIVATION = path.join(REPO_ROOT, 'scripts', 'post-update-activation.cjs');

let pass = 0;
let fail = 0;
function assert(label, cond, detail) {
  if (cond) { pass++; console.log('PASS ' + label); }
  else { fail++; console.log('FAIL ' + label + (detail ? '  -> ' + detail : '')); }
}

// -- harness --------------------------------------------------------------

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// Build a synthetic CLAUDE_PLUGIN_ROOT carrying plugin.json version.
function makePluginRoot(version) {
  const root = mkTmp('mos-session-');
  fs.mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'mos', version }) + '\n',
    'utf8'
  );
  return root;
}

// Build a synthetic HOME with installed_plugins.json.
// mode: 'registered' -> valid file with registeredVersion
//       'malformed'   -> non-JSON bytes
//       'missing'     -> no file written
function makeHome(mode, registeredVersion) {
  const home = mkTmp('mos-home-');
  const pluginsDir = path.join(home, '.claude', 'plugins');
  fs.mkdirSync(pluginsDir, { recursive: true });
  const target = path.join(pluginsDir, 'installed_plugins.json');
  if (mode === 'registered') {
    fs.writeFileSync(target, JSON.stringify({
      version: 2,
      plugins: {
        'mos@mindrian-marketplace': [{
          scope: 'user',
          installPath: '/x/.claude/plugins/cache/mindrian-marketplace/mos/' + registeredVersion,
          version: registeredVersion,
        }],
      },
    }, null, 2), 'utf8');
  } else if (mode === 'malformed') {
    fs.writeFileSync(target, '{ this is not valid json ', 'utf8');
  } // 'missing' -> write nothing
  return home;
}

function runPreflight(home, pluginRoot) {
  const env = Object.assign({}, process.env, {
    HOME: home,
    USERPROFILE: home,
    MOS_NO_COLOR: '1',
  });
  if (pluginRoot) env.CLAUDE_PLUGIN_ROOT = pluginRoot;
  else delete env.CLAUDE_PLUGIN_ROOT;
  const res = spawnSync('node', [PREFLIGHT], { encoding: 'utf8', env, timeout: 15000 });
  let json = null;
  try { json = JSON.parse((res.stdout || '').trim()); } catch (_) { /* leave null */ }
  return { status: res.status, stdout: res.stdout, stderr: res.stderr, json, threw: res.error };
}

// -- (a) version mismatch -> restart cue emitted --------------------------
(function testMismatch() {
  const home = makeHome('registered', '1.15.1');
  const root = makePluginRoot('1.15.0');
  const r = runPreflight(home, root);
  assert('(a) mismatch: exit 0', r.status === 0, 'status=' + r.status);
  assert('(a) mismatch: parseable envelope', !!r.json, 'stdout=' + JSON.stringify(r.stdout));
  assert('(a) mismatch: continue:true (non-blocking)', !!r.json && r.json.continue === true);
  const ctx = r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.additionalContext;
  assert('(a) mismatch: additionalContext present', !!ctx);
  assert('(a) mismatch: cue names both versions', !!ctx && ctx.includes('1.15.0') && ctx.includes('1.15.1'), ctx);
  assert('(a) mismatch: cue says restart', !!ctx && /restart/i.test(ctx));
  assert('(a) mismatch: systemMessage banner present', !!r.json && typeof r.json.systemMessage === 'string' && /RESTART THIS SESSION/i.test(r.json.systemMessage));
})();

// -- (b) versions match -> silent no-op -----------------------------------
(function testMatch() {
  const home = makeHome('registered', '1.15.1');
  const root = makePluginRoot('1.15.1');
  const r = runPreflight(home, root);
  assert('(b) match: exit 0', r.status === 0, 'status=' + r.status);
  assert('(b) match: continue:true', !!r.json && r.json.continue === true);
  const ctx = r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.additionalContext;
  assert('(b) match: NO restart additionalContext', !ctx, 'ctx=' + ctx);
  assert('(b) match: NO systemMessage', !r.json || r.json.systemMessage === undefined);
})();

// -- (c) malformed / missing installed_plugins.json -> graceful -----------
(function testMalformed() {
  const home = makeHome('malformed');
  const root = makePluginRoot('1.15.0');
  const r = runPreflight(home, root);
  assert('(c1) malformed: exit 0 (no throw)', r.status === 0, 'status=' + r.status + ' stderr=' + r.stderr);
  assert('(c1) malformed: continue:true', !!r.json && r.json.continue === true);
  const ctx = r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.additionalContext;
  assert('(c1) malformed: no stale cue', !ctx);
})();

(function testMissing() {
  const home = makeHome('missing');
  const root = makePluginRoot('1.15.0');
  const r = runPreflight(home, root);
  assert('(c2) missing: exit 0 (no throw)', r.status === 0, 'status=' + r.status + ' stderr=' + r.stderr);
  assert('(c2) missing: continue:true', !!r.json && r.json.continue === true);
})();

// -- (d) banner + logo wiring in commands/update.md -----------------------
(function testBannerGrep() {
  const md = fs.readFileSync(UPDATE_MD, 'utf8');
  assert('(d) update.md: RESTART banner present', /RESTART THIS SESSION NOW/.test(md));
  assert('(d) update.md: banner explains expected/not broken', /EXPECTED\. Nothing is broken/i.test(md));
  // "ends with the banner block": the banner sentinel sits in the final
  // quarter of the file (it is the last section).
  const idx = md.indexOf('RESTART THIS SESSION NOW');
  assert('(d) update.md: banner in final quarter (ends-with)', idx > md.length * 0.6, 'idx=' + idx + ' len=' + md.length);
  // Logo wiring must not silently drop.
  assert('(d) update.md: references mindrian-ascii-logo', /mindrian-ascii-logo/.test(md));
})();

// -- (d') logo wiring in the post-update activation report ----------------
(function testActivationLogo() {
  const src = fs.readFileSync(ACTIVATION, 'utf8');
  assert("(d') activation: references mindrian-ascii-logo", /mindrian-ascii-logo/.test(src));
  assert("(d') activation: emits RESTART banner", /RESTART THIS SESSION NOW/.test(src));
})();

// -- summary --------------------------------------------------------------
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
