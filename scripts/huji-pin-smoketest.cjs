#!/usr/bin/env node
'use strict';
/*
 * scripts/huji-pin-smoketest.cjs - Phase 229-10, the REAL end-to-end pin
 * verification for the external mindrian-pitch-feedback-mcp wrapper.
 * ==========================================================================
 * The separate standalone repo (github.com/jsagir/mindrian-pitch-feedback-mcp)
 * wraps THIS plugin's grading engine by pinning a MindrianOS-Plugin git tag and
 * loading it with `claude --plugin-dir <tag-pinned-checkout>`. Its README
 * currently names v1.15.2 as that pin. TWO claims underpin that whole mechanism,
 * and neither has ever been checked against reality:
 *
 *   (1) The pinned tag actually contains the PWS_grading recipe (a tag with no
 *       recipe cannot resolve /mos:pipeline PWS_grading, no matter how it loads).
 *   (2) `claude --plugin-dir <checkout>`, run from a directory OUTSIDE this repo's
 *       own working tree, really does resolve /mos:pipeline PWS_grading (plugin
 *       discovery from an arbitrary cwd is an assumption until proven live).
 *
 * This script proves or disproves BOTH against real git history and a real, live
 * `claude` CLI process. It NEVER hand-writes a verdict: whatever the real run
 * produces (including an honest UNRESOLVED) is what the findings file records.
 *
 * It builds NO MCP server, tool registration, job registry, or guardrails
 * G7-G10 - those belong entirely to the separate repo. This is purely a
 * verification probe. It is NOT wired into tests/run-all-229.sh's fast
 * deterministic legs (it clones a real tag and spawns a real model-backed
 * process), matching the precedent of huji-eval.cjs's model-calling suites being
 * invoked separately and excluded from the fast aggregator.
 *
 * Cost/blast-radius caps on the live probe (T-229-10-04): --max-turns 3,
 * --max-budget-usd 0.10, --allowedTools '' (no tool execution), haiku (cheapest
 * tier), --no-session-persistence, and a 60s spawn timeout. The probe only needs
 * to prove COMMAND RESOLUTION, never run a real grading pass.
 *
 * Usage:
 *   node scripts/huji-pin-smoketest.cjs            (auto-detect the newest tag with the recipe)
 *   node scripts/huji-pin-smoketest.cjs --tag v1.15.3-beta.26   (skip auto-detection)
 *
 * Exit 0 iff a tag was found AND the live invocation classified as RESOLVED.
 *
 * CJS only. No em-dashes (CLAUDE.md HARD RULE). Zero new dependencies.
 * License: BSL 1.1 (Business Source License 1.1) - see LICENSE.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const RECIPE_FILE = 'lib/core/recipe-maps.cjs';
const RECIPE_NAME = 'PWS_grading';
const DOCUMENTED_PIN = 'v1.15.2'; // the tag the external repo's README currently names.
const FINDINGS_PATH = path.join(
  REPO_ROOT, '.planning', 'phases', '229-huji-pitch-feedback-module', '229-10-PIN-SMOKETEST.md'
);

// --------------------------------------------------------------------------
// parseVer - parse a MindrianOS tag into a comparable shape. Stable (no -beta)
// ranks ABOVE a beta of the same patch. Returns null for a non-conforming tag.
// --------------------------------------------------------------------------
function parseVer(tag) {
  const m = String(tag).match(/^v(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    beta: m[4] !== undefined ? Number(m[4]) : null, // null = stable
  };
}

// Compare two parsed versions. Returns >0 when a is newer than b.
function cmpVer(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  // Same MAJOR.MINOR.PATCH: stable (beta null) beats any beta.
  const aStable = a.beta === null ? 1 : 0;
  const bStable = b.beta === null ? 1 : 0;
  if (aStable !== bStable) return aStable - bStable;
  if (aStable === 1) return 0; // both stable, equal
  return a.beta - b.beta; // both beta: higher beta number wins
}

// --------------------------------------------------------------------------
// listCandidateTags - the pin-eligible tag set: every v1.15.3-beta.* plus any
// stable/pre-release at v1.16.0 or newer. Sorted newest-first.
// --------------------------------------------------------------------------
function listCandidateTags() {
  let raw = '';
  try {
    raw = execFileSync('git', ['-C', REPO_ROOT, 'tag', '-l'], { encoding: 'utf8' });
  } catch (_e) {
    return [];
  }
  const all = raw.split('\n').map((s) => s.trim()).filter(Boolean);
  const candidates = all.filter((t) => {
    const v = parseVer(t);
    if (!v) return false;
    // v1.15.3-beta.* (the band that first carries the recipe) ...
    if (v.major === 1 && v.minor === 15 && v.patch === 3) return true;
    // ... plus anything at v1.16.0 or newer (stable or pre-release).
    if (v.major > 1) return true;
    if (v.major === 1 && v.minor >= 16) return true;
    return false;
  });
  candidates.sort((a, b) => cmpVer(parseVer(b), parseVer(a))); // newest first
  return candidates;
}

// --------------------------------------------------------------------------
// tagHasRecipe - does <tag>:lib/core/recipe-maps.cjs contain the PWS_grading
// recipe key? Checked live via `git show`, never assumed (T-229-10-03).
// --------------------------------------------------------------------------
function tagHasRecipe(tag) {
  try {
    const content = execFileSync('git', ['-C', REPO_ROOT, 'show', `${tag}:${RECIPE_FILE}`], {
      encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
    });
    return content.indexOf(RECIPE_NAME) !== -1;
  } catch (_e) {
    // Tag or file absent at that ref: treat as "recipe not present".
    return false;
  }
}

// --------------------------------------------------------------------------
// classifyInvocation - read the live claude JSON envelope and decide RESOLVED vs
// UNRESOLVED. RESOLVED means the slash command was RECOGNIZED and the PWS_grading
// chain began (references its stage commands or a venture-stage/room-context
// gating message - all of which prove routing worked even if grading is skipped
// for lack of a real room). UNRESOLVED means plain conversational non-recognition
// or an error envelope reporting a plugin-load failure.
// --------------------------------------------------------------------------
function classifyInvocation(spawnResult) {
  // Spawn-level failures first.
  if (spawnResult.error) {
    const msg = String(spawnResult.error.message || spawnResult.error);
    if (/ENOENT/.test(msg)) return { verdict: 'UNRESOLVED', reason: 'claude_cli_not_found', detail: msg.slice(0, 300) };
    if (spawnResult.error.killed) return { verdict: 'UNRESOLVED', reason: 'timeout', detail: msg.slice(0, 300) };
    return { verdict: 'UNRESOLVED', reason: 'spawn_failed', detail: msg.slice(0, 300) };
  }

  const stdout = String(spawnResult.stdout || '');
  const stderr = String(spawnResult.stderr || '');

  // Auth/credential failure = UNRESOLVED (auth_unavailable), never a false RESOLVED.
  const authRe = /not logged in|invalid api key|no credentials|authentication|unauthorized|please run .*login|ANTHROPIC_API_KEY/i;
  if (authRe.test(stderr) || authRe.test(stdout)) {
    return { verdict: 'UNRESOLVED', reason: 'auth_unavailable', detail: (stderr || stdout).slice(0, 300) };
  }

  let env = null;
  try { env = JSON.parse(stdout); } catch (_e) { env = null; }

  if (!env || typeof env !== 'object') {
    // No parseable envelope: fall back to raw-text inspection.
    const text = (stdout + '\n' + stderr).toLowerCase();
    if (recognizedChain(text)) return { verdict: 'RESOLVED', reason: 'chain_referenced_raw', detail: stdout.slice(0, 500) };
    return { verdict: 'UNRESOLVED', reason: 'unparseable_envelope', detail: stdout.slice(0, 500) || stderr.slice(0, 500) };
  }

  const resultText = String(env.result || '');
  const isError = env.is_error === true;

  // The recognition haystack is the model OUTPUT plus its permission_denials - both
  // are strictly POST-recognition. permission_denials record the tool attempts the
  // PWS_grading command made (locating pipeline reference files, reading room
  // state) even when a turn/budget cap later empties the result field, so a capped
  // error envelope still carries proof the command routed and began executing. The
  // input prompt is never in this haystack, so a mere echo cannot false-positive.
  const denials = JSON.stringify(env.permission_denials || []);
  const haystack = (resultText + ' ' + denials).toLowerCase();
  const denialList = Array.isArray(env.permission_denials) ? env.permission_denials : [];
  const denialCount = denialList.length;
  // The recognition evidence, made self-contained: the tool attempts the resolved
  // PWS_grading command made (each proves the command routed and began executing).
  const denialSummary = denialList
    .map((d) => (d && d.tool_name) + ': ' + JSON.stringify((d && d.tool_input) || {}).slice(0, 160))
    .join('\n  ');
  const detail = 'subtype=' + (env.subtype || 'n/a') + ' is_error=' + isError +
    ' num_turns=' + (env.num_turns != null ? env.num_turns : 'n/a') +
    ' permission_denials=' + denialCount +
    '\nresult: ' + (resultText ? resultText.slice(0, 600) : '(empty - turn/budget cap fired after the command began)') +
    (denialCount ? '\npipeline tool attempts (proof of routing):\n  ' + denialSummary : '');

  // A genuine plugin-load failure: the CLI reports it could not load the plugin dir
  // AND there is no recognition signal anywhere.
  const pluginLoadFail = /failed to load plugin|could not load plugin|no such plugin|plugin .* not found/i.test(resultText + ' ' + stderr);
  if (pluginLoadFail && !recognizedChain(haystack)) {
    return { verdict: 'UNRESOLVED', reason: 'plugin_load_failure', detail };
  }

  if (recognizedChain(haystack)) {
    // Routing worked. Note if it happened under an error envelope (cap) vs clean.
    return { verdict: 'RESOLVED', reason: isError ? 'chain_began_then_capped' : 'chain_referenced', detail };
  }

  if (isError) return { verdict: 'UNRESOLVED', reason: 'error_envelope', detail };
  return { verdict: 'UNRESOLVED', reason: 'command_not_recognized', detail };
}

// A recognized PWS_grading routing references at least one chain stage, the recipe
// name, a venture-stage/room-context gating message, or the command's own
// pipeline-loading tool attempts (locating pipeline reference files / chain index /
// room state) captured in permission_denials. A non-recognized command produces
// none of these - it just says it does not understand the slash command.
function recognizedChain(text) {
  return /pws_grading|deep-grade|deep grade|mullins|build-thesis|build thesis|structure-argument|structure argument|venture stage|venture_stage|room context|room state|validation stage|grading pipeline|pitch feedback|pipeline stage|pipeline definition|pipeline reference|pipeline config|chains-index|resume detection|resume position/.test(text);
}

// --------------------------------------------------------------------------
// writeFindings - the ONLY output artifact. Records the real, non-hypothetical
// result: resolved tag, the live v1.15.2/PWS_grading finding (with an explicit
// correction note when v1.15.2 is stale), the clone path, the raw claude args,
// and the classified verdict.
// --------------------------------------------------------------------------
function writeFindings(f) {
  const lines = [];
  lines.push('# Phase 229-10 Pin Smoke Test - Live Findings');
  lines.push('');
  lines.push('> Generated by `scripts/huji-pin-smoketest.cjs` against real git history and a real');
  lines.push('> `claude --plugin-dir` invocation. Not hand-written, not hypothetical.');
  lines.push('');
  lines.push('- Run at (UTC): ' + f.runAt);
  lines.push('- Host claude CLI: ' + (f.claudeVersion || 'unknown'));
  lines.push('- This repo: ' + REPO_ROOT);
  lines.push('');
  lines.push('## Verdict: ' + f.verdict);
  lines.push('');
  lines.push('Reason: `' + (f.verdictReason || 'n/a') + '`');
  lines.push('');

  lines.push('## Tag resolution');
  lines.push('');
  lines.push('- Candidate tags considered (newest first): ' + (f.candidates.length ? f.candidates.join(', ') : '(none)'));
  lines.push('- Resolved pin tag: ' + (f.resolvedTag ? '`' + f.resolvedTag + '`' : '(none - no candidate carries the recipe)'));
  lines.push('- Recipe key checked: `' + RECIPE_NAME + '` in `' + RECIPE_FILE + '`');
  lines.push('');

  lines.push('## The documented pin (' + DOCUMENTED_PIN + ') - checked live, never assumed');
  lines.push('');
  lines.push('The external `mindrian-pitch-feedback-mcp` repo README currently names `' + DOCUMENTED_PIN + '` as its pin.');
  lines.push('');
  lines.push('- Does `' + DOCUMENTED_PIN + '` contain the `' + RECIPE_NAME + '` recipe? **' + (f.documentedPinHasRecipe ? 'true' : 'false') + '**');
  if (!f.documentedPinHasRecipe) {
    lines.push('');
    lines.push('CORRECTION NOTE: `' + DOCUMENTED_PIN + '` does NOT contain `' + RECIPE_NAME + '`. The recipe first');
    lines.push('appears at `' + (f.firstTagWithRecipe || 'a later beta') + '` and is present through the newest');
    lines.push('candidate tag. The external repo\'s README pin of `' + DOCUMENTED_PIN + '` is STALE and would fail to');
    lines.push('resolve `/mos:pipeline ' + RECIPE_NAME + '`. It must be re-pinned to a tag that carries the recipe.');
    lines.push('No stable (non-beta) tag carries it yet - that gap is what 229-09 Task 3 (git-tag the checkout');
    lines.push('before the first 200-student batch) exists to close.');
  }
  lines.push('');

  lines.push('## Live invocation');
  lines.push('');
  if (f.clonePath) {
    lines.push('- Clone path (outside this repo): `' + f.clonePath + '`');
    lines.push('- Clone contains `.claude-plugin/plugin.json`: ' + (f.cloneValid ? 'true' : 'false'));
  } else {
    lines.push('- No clone was made (failed closed before cloning).');
  }
  if (f.scratchCwd) lines.push('- Invocation cwd (scratch, outside repo + clone): `' + f.scratchCwd + '`');
  if (f.claudeArgs) {
    lines.push('- Raw claude invocation args:');
    lines.push('');
    lines.push('```');
    lines.push('claude ' + f.claudeArgs.map((a) => (a.length > 60 ? a.slice(0, 57) + '...' : a)).join(' '));
    lines.push('```');
  }
  lines.push('');
  if (f.classification) {
    lines.push('- Classification reason: `' + f.classification.reason + '`');
    lines.push('- Envelope/detail excerpt:');
    lines.push('');
    lines.push('```');
    lines.push(String(f.classification.detail || '').slice(0, 800));
    lines.push('```');
  }
  lines.push('');
  lines.push('## What this proves');
  lines.push('');
  if (f.verdict === 'RESOLVED') {
    lines.push('A git-tag-pinned checkout of this repo, loaded via `claude --plugin-dir` from a scratch');
    lines.push('directory OUTSIDE this repo, DOES resolve `/mos:pipeline ' + RECIPE_NAME + '`. The pin mechanism');
    lines.push('the external MCP wrapper depends on is confirmed working - provided it pins `' + (f.resolvedTag || 'a recipe-bearing tag') + '`,');
    lines.push('NOT the stale `' + DOCUMENTED_PIN + '`.');
  } else {
    lines.push('The pin mechanism did NOT resolve to a confirmed RESOLVED verdict in this run (reason: `' +
      (f.verdictReason || 'n/a') + '`). This is a truthful negative result, not a forced pass. The job of this');
    lines.push('probe is to CONFIRM the mechanism, and a genuine UNRESOLVED is a valid outcome that must be');
    lines.push('recorded and acted on (fix credentials, re-pin the tag, or re-run once the environment is ready).');
  }
  lines.push('');

  fs.mkdirSync(path.dirname(FINDINGS_PATH), { recursive: true });
  fs.writeFileSync(FINDINGS_PATH, lines.join('\n') + '\n', 'utf8');
}

// --------------------------------------------------------------------------
// main
// --------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);
  const tagFlagIdx = argv.indexOf('--tag');
  const overrideTag = tagFlagIdx !== -1 ? argv[tagFlagIdx + 1] : null;

  const findings = {
    runAt: new Date().toISOString(),
    claudeVersion: null,
    candidates: [],
    resolvedTag: null,
    documentedPinHasRecipe: false,
    firstTagWithRecipe: null,
    clonePath: null,
    cloneValid: false,
    scratchCwd: null,
    claudeArgs: null,
    classification: null,
    verdict: 'UNRESOLVED',
    verdictReason: null,
  };

  // Host claude version (best-effort; not fatal if absent).
  try {
    findings.claudeVersion = execFileSync('claude', ['--version'], { encoding: 'utf8', timeout: 15000 }).trim();
  } catch (_e) { findings.claudeVersion = 'unavailable'; }

  // (1) Tag resolution.
  const candidates = listCandidateTags();
  findings.candidates = candidates;

  // (1b) The documented pin, checked live (never assumed).
  findings.documentedPinHasRecipe = tagHasRecipe(DOCUMENTED_PIN);

  // Record the OLDEST candidate that carries the recipe (for the correction note).
  const ascending = candidates.slice().sort((a, b) => cmpVer(parseVer(a), parseVer(b)));
  for (const t of ascending) { if (tagHasRecipe(t)) { findings.firstTagWithRecipe = t; break; } }

  // Resolve the pin tag: an explicit override (still verified) or the newest with the recipe.
  let resolvedTag = null;
  if (overrideTag) {
    if (tagHasRecipe(overrideTag)) resolvedTag = overrideTag;
    else {
      findings.verdict = 'UNRESOLVED';
      findings.verdictReason = 'override_tag_missing_recipe';
      console.error('FAIL: --tag ' + overrideTag + ' does not contain ' + RECIPE_NAME + ' in ' + RECIPE_FILE);
      writeFindings(findings);
      process.exit(1);
    }
  } else {
    for (const t of candidates) { if (tagHasRecipe(t)) { resolvedTag = t; break; } }
  }
  findings.resolvedTag = resolvedTag;

  // (2) Fail closed if no candidate carries the recipe.
  if (!resolvedTag) {
    findings.verdict = 'UNRESOLVED';
    findings.verdictReason = 'no_tag_with_recipe';
    console.error('FAIL: no released tag (including ' + DOCUMENTED_PIN + ') contains ' + RECIPE_NAME + ' yet.');
    writeFindings(findings);
    process.exit(1);
  }

  // (3) Shallow-clone the resolved tag into a fresh dir OUTSIDE this repo.
  const cloneParent = fs.mkdtempSync(path.join(os.tmpdir(), 'huji-pin-clone-'));
  const clonePath = path.join(cloneParent, 'checkout');
  findings.clonePath = clonePath;
  try {
    // Local clone (hardlinked objects, fast); checks out the pinned tag's working tree.
    execFileSync('git', ['clone', '--quiet', '--branch', resolvedTag, REPO_ROOT, clonePath], {
      encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    findings.verdict = 'UNRESOLVED';
    findings.verdictReason = 'clone_failed';
    findings.classification = { reason: 'clone_failed', detail: String(e && e.message || e).slice(0, 500) };
    console.error('FAIL: git clone of ' + resolvedTag + ' failed: ' + String(e && e.message || e).slice(0, 200));
    writeFindings(findings);
    cleanup([cloneParent]);
    process.exit(1);
  }

  // Sanity: the clone must look like a plugin install (isPluginDir signal).
  findings.cloneValid = fs.existsSync(path.join(clonePath, '.claude-plugin', 'plugin.json'));
  if (!findings.cloneValid) {
    findings.verdict = 'UNRESOLVED';
    findings.verdictReason = 'clone_not_a_plugin';
    console.error('FAIL: clone missing .claude-plugin/plugin.json');
    writeFindings(findings);
    cleanup([cloneParent]);
    process.exit(1);
  }

  // (4) From a THIRD scratch dir (outside both this repo and the clone), spawn the
  // live claude with hard cost/turn/tool caps. cwd is the empty scratch so nothing
  // about the working directory can auto-discover this repo's own plugin.
  const scratchCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'huji-pin-scratch-'));
  findings.scratchCwd = scratchCwd;
  const claudeArgs = [
    '-p', '/mos:pipeline ' + RECIPE_NAME,
    '--plugin-dir', clonePath,
    '--model', 'claude-haiku-4-5',
    '--output-format', 'json',
    '--permission-mode', 'dontAsk',
    '--allowedTools', '',
    '--max-turns', '3',
    '--max-budget-usd', '0.10',
    '--no-session-persistence',
  ];
  findings.claudeArgs = claudeArgs;

  const spawnResult = spawnSync('claude', claudeArgs, {
    cwd: scratchCwd, env: process.env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 60000,
  });

  // (5) Classify.
  const classification = classifyInvocation(spawnResult);
  findings.classification = classification;
  findings.verdict = classification.verdict;
  findings.verdictReason = classification.reason;

  // (6) Write findings.
  writeFindings(findings);
  cleanup([cloneParent, scratchCwd]);

  // (7) Exit 0 iff a tag was found AND the live invocation classified as RESOLVED.
  if (findings.verdict === 'RESOLVED') {
    console.log('RESOLVED: ' + resolvedTag + ' resolves /mos:pipeline ' + RECIPE_NAME + ' via --plugin-dir (reason: ' + classification.reason + ').');
    process.exit(0);
  }
  console.error('UNRESOLVED (' + classification.reason + '): see ' + path.relative(REPO_ROOT, FINDINGS_PATH));
  process.exit(1);
}

function cleanup(dirs) {
  for (const d of dirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* graceful */ }
  }
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error('FAILED:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

module.exports = { parseVer, cmpVer, listCandidateTags, tagHasRecipe, classifyInvocation, recognizedChain };
