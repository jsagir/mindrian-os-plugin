#!/usr/bin/env node
'use strict';
// scripts/forward-fork-scenarios-359.cjs -- Phase 359-05 (FORK359-09, SPEC R9,
// D-11, D-12, N-2, N-4, N-5, RESEARCH Findings 8-12, Pitfalls 6-9, Pattern 5).
//
// Dev-only R9 forward-measurement harness. It is NEVER imported by lib/ or
// hooks/ (a tripwire leg in tests/test-359-forward-harness.cjs asserts this),
// it is NOT part of CI, and it spends money ONLY on an explicit --arm run
// after navigator approval -- which is plans 10 and 11, not this plan. This
// plan (359-05) proves every piece of this file offline: preflight refusals,
// --dry-run (which invokes `claude` only for `--version`), --parse over
// canned streams, and --evaluate over synthetic rows. No paid `claude -p`
// call is ever made by this plan or its tests.
//
// SHAPE NOTE (provisional): the stream-json event shapes this file parses
// (system/init, system/hook_event with hook_event_name SessionStart|Stop,
// user, assistant with text/tool_use content blocks, result with
// total_cost_usd/duration_ms/subtype) are this plan's best-effort reading of
// the documented contract (RESEARCH Findings 8-9, hooks.md, headless.md,
// cli-reference). They are PROVISIONAL until the plan-10 smoke run confirms
// or corrects them against a real `claude -p --include-hook-events` stream.
// If the smoke run finds a different shape, only parseRun's event-matching
// needs to change; buildRunCommand, preflight and evaluate do not depend on
// the exact shape.
//
// House rule: hyphens only, no em-dashes anywhere.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');
const SCENARIOS_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'forward-fork-scenarios-359.json');
const PROBE_SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'fork359-permission-probe.cjs');
const FORK_DECLARATION_PATH = path.join(REPO_ROOT, 'lib', 'core', 'fork-declaration.cjs');

// Default results home: OUTSIDE the repo, gitignored-and-then-some (it is not
// even inside the tree). Raw streams and results never land in git (D-11,
// T-359-25).
const DEFAULT_RESULTS_DIR = path.join(os.homedir(), '.cache', 'mindrian-dev', '359-forward');

const MODEL = 'claude-sonnet-5';
const DEFAULT_PER_RUN_CAP_USD = 0.40;
const DEFAULT_TOTAL_CAP_USD = 60;
// N-5 / D-12: projections pad by 25% over the naive runs x cost-per-run
// multiplication, so a preflight refusal triggers before the batch itself
// would blow the cap on a slightly-higher-than-expected run.
const PROJECTION_SAFETY_FACTOR = 1.25;
const MIN_CLAUDE_VERSION = [2, 1, 259];
// RESEARCH Pattern 5: kill a run after 300s rather than let a stuck headless
// session run forever inside a sequential batch.
const RUN_TIMEOUT_MS = 300000;

// RESEARCH Finding 11 / Pitfall 7: the cold-start MODE_ROUTING card's three
// options, read from scripts/session-start at run time when possible so a
// prose-wording change there does not silently stop being recognized; this
// literal triple is the known-good fallback the regex extraction degrades to
// (scripts/session-start :754 at the time this file was written).
const MODE_MENU_FALLBACK_LABELS = ['Just Talk', 'Explore + Capture', 'Build a Room'];

// ---------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

/**
 * loadScenarios(customPath) -- reads and JSON-parses the forward scenario
 * fixture (or a caller-supplied path, used by the offline test to point at
 * a scratch copy). Never caches (dev-only, called rarely).
 */
function loadScenarios(customPath) {
  const p = customPath || SCENARIOS_PATH;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadJsonl(p) {
  const text = fs.readFileSync(p, 'utf8');
  return text
    .split('\n')
    .filter(function (line) { return line.trim().length > 0; })
    .map(function (line) { return JSON.parse(line); });
}

function loadResultsRows(p) {
  try {
    return loadJsonl(p);
  } catch (_e) {
    return [];
  }
}

function appendResultRow(resultsPath, row) {
  ensureDir(path.dirname(resultsPath));
  fs.appendFileSync(resultsPath, JSON.stringify(row) + '\n');
}

function parseClaudeVersion(text) {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(String(text || ''));
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function isVersionAtLeast(version, minimum) {
  for (let i = 0; i < 3; i += 1) {
    if (version[i] > minimum[i]) return true;
    if (version[i] < minimum[i]) return false;
  }
  return true;
}

/**
 * getClaudeVersion() -- the ONE real `claude` invocation this file (or its
 * own test suite) is ever allowed to make: `claude --version`. Every other
 * path that would spawn `claude` with the full run arg array is gated behind
 * an explicit, non-dry-run --arm invocation (never exercised by this plan).
 */
function getClaudeVersion() {
  const out = execFileSync('claude', ['--version'], { encoding: 'utf8' });
  return String(out).trim();
}

/**
 * readModeMenuLabels(treeDir) -- reads the cold-start MODE_ROUTING menu
 * labels from <treeDir>/scripts/session-start (a plain regex extraction of
 * the "[N] Label" lines inside the MODE_MENU bash variable), falling back to
 * MODE_MENU_FALLBACK_LABELS on any read or parse failure, or fewer than 3
 * labels found. Used to tell a genuine card apart from the turn-1 cold-start
 * confound (RESEARCH Finding 11).
 */
function readModeMenuLabels(treeDir) {
  try {
    const sessionStartPath = path.join(treeDir || REPO_ROOT, 'scripts', 'session-start');
    const src = fs.readFileSync(sessionStartPath, 'utf8');
    const re = /\[\d\]\s+([A-Za-z][A-Za-z \+]*[A-Za-z])/g;
    const labels = [];
    let m = re.exec(src);
    while (m !== null) {
      labels.push(m[1].trim());
      m = re.exec(src);
    }
    if (labels.length >= 3) return labels.slice(0, 3);
  } catch (_e) {
    // fall through to the known default
  }
  return MODE_MENU_FALLBACK_LABELS.slice();
}

function normalizeLabelForCompare(s) {
  return String(s).trim().toLowerCase();
}

function sameLabelSet(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const sa = a.map(normalizeLabelForCompare).slice().sort();
  const sb = b.map(normalizeLabelForCompare).slice().sort();
  for (let i = 0; i < sa.length; i += 1) {
    if (sa[i] !== sb[i]) return false;
  }
  return true;
}

function countInterceptLogDeclared(logPath) {
  if (!logPath) return 0;
  let text = '';
  try {
    text = fs.readFileSync(logPath, 'utf8');
  } catch (_e) {
    return 0;
  }
  const lines = text.split('\n').filter(function (l) { return l.trim().length > 0; });
  let count = 0;
  for (const line of lines) {
    if (line.indexOf('declared-fork-no-card') !== -1) count += 1;
  }
  return count;
}

/**
 * computeBlockedByDeclaredArm(tree, attempt1Text, sessionId) -- offline
 * corroboration (Pitfall 8): feeds the attempt-1 text through the ARM
 * TREE's own deriveTurnSignals + classifyCardFire + loadRegistry (never this
 * repo's live copy when a tree is given), exactly the way the live Stop hook
 * would, and reports whether the verdict reason is 'declared-fork-no-card'.
 * Wrapped in try/catch and degrades to false on any failure (a missing arm
 * tree, or a pre-R3 tree that has not yet wired the declared arm, must never
 * crash the harness -- it simply reports no offline corroboration).
 */
function computeBlockedByDeclaredArm(tree, attempt1Text, sessionId) {
  try {
    const checkCardFirePath = path.join(tree || REPO_ROOT, 'scripts', 'check-card-fire.cjs');
    const resolved = require.resolve(checkCardFirePath);
    delete require.cache[resolved];
    const checkCardFire = require(resolved);
    const signals = checkCardFire.deriveTurnSignals({
      session_id: sessionId || 'fork359-forward',
      output_text: attempt1Text || '',
      ran_entries: [],
      askuserquestion_fired: false,
      reach_corroborated: false,
    });
    const registry = checkCardFire.loadRegistry();
    const verdict = checkCardFire.classifyCardFire(signals, registry);
    return !!(verdict && verdict.reason === 'declared-fork-no-card');
  } catch (_e) {
    return false;
  }
}

// ---------------------------------------------------------------------
// preflight
// ---------------------------------------------------------------------

/**
 * preflight(opts) -- the N-2/N-5/Pitfall-9 refusal gate. Refuses (returns
 * {ok:false, reason, exitCode:2}) when:
 *   - the model is not exactly 'claude-sonnet-5' (never Fable, N-5)
 *   - HOME's ~/.claude/agents/larry-extended.md resolves to a REAL file
 *     (a shadowed agent, Finding 10 / Pitfall 9)
 *   - the per-run cap is anything other than $0.40
 *   - `claude --version` is older than MIN_CLAUDE_VERSION
 *   - the projected total (plannedRuns x costPerRun x 1.25) exceeds the
 *     total cap (default $60, or meta.caps.total_usd)
 * Never throws; every failure path returns a reason string. opts.getClaudeVersion
 * is an injectable seam for the offline test (never invokes `claude` itself).
 */
function preflight(opts) {
  const o = opts || {};
  const model = o.model || MODEL;

  if (/fable/i.test(model)) {
    return { ok: false, reason: 'model must never be the Fable family (N-5): ' + model, exitCode: 2 };
  }
  if (model !== MODEL) {
    return { ok: false, reason: 'model must be exactly ' + MODEL + ', got: ' + model, exitCode: 2 };
  }

  const homeDir = o.homeDirForCheck || os.homedir();
  const shadowPath = path.join(homeDir, '.claude', 'agents', 'larry-extended.md');
  let shadowIsFile = false;
  try {
    shadowIsFile = fs.statSync(shadowPath).isFile();
  } catch (_e) {
    shadowIsFile = false; // missing, or a dangling symlink, both resolve to false here
  }
  if (shadowIsFile) {
    return {
      ok: false,
      reason: 'shadowed agent: ' + shadowPath + ' resolves to a real file (Finding 10, Pitfall 9)',
      exitCode: 2,
    };
  }

  const perRunCap = typeof o.perRunCapUsd === 'number' ? o.perRunCapUsd : DEFAULT_PER_RUN_CAP_USD;
  if (perRunCap !== DEFAULT_PER_RUN_CAP_USD) {
    return {
      ok: false,
      reason: 'per-run cap must be exactly $' + DEFAULT_PER_RUN_CAP_USD + ', got: $' + perRunCap,
      exitCode: 2,
    };
  }

  let claudeVersionText = '';
  try {
    claudeVersionText = typeof o.getClaudeVersion === 'function' ? o.getClaudeVersion() : getClaudeVersion();
  } catch (e) {
    return {
      ok: false,
      reason: 'could not read `claude --version`: ' + (e && e.message ? e.message : String(e)),
      exitCode: 2,
    };
  }
  const version = parseClaudeVersion(claudeVersionText);
  if (!version || !isVersionAtLeast(version, MIN_CLAUDE_VERSION)) {
    return {
      ok: false,
      reason: 'claude ' + claudeVersionText + ' is older than the required ' + MIN_CLAUDE_VERSION.join('.'),
      exitCode: 2,
    };
  }

  const plannedRuns = typeof o.plannedRuns === 'number' ? o.plannedRuns : 0;
  const costPerRun = typeof o.costPerRunUsd === 'number' ? o.costPerRunUsd : perRunCap;
  const totalCap = typeof o.totalCapUsd === 'number' ? o.totalCapUsd : DEFAULT_TOTAL_CAP_USD;
  const projected = plannedRuns * costPerRun * PROJECTION_SAFETY_FACTOR;
  if (projected > totalCap) {
    return {
      ok: false,
      reason:
        'projected total $' + projected.toFixed(2) + ' exceeds the $' + totalCap + ' cap (' +
        plannedRuns + ' runs x $' + costPerRun + '/run x ' + PROJECTION_SAFETY_FACTOR + ')',
      exitCode: 2,
    };
  }

  return { ok: true, claudeVersion: claudeVersionText, projectedTotalUsd: projected };
}

// ---------------------------------------------------------------------
// buildRunCommand / buildRunEnv / buildProbeConfigJson
// ---------------------------------------------------------------------

/**
 * buildRunCommand(run) -- the arg array for one hermetic run, following
 * RESEARCH Pattern 5 / D-12 exactly. NEVER runs in bare mode and never skips
 * permission checks (T-359-22, keychain auth only). Returns {command, args,
 * cwd} rather than a shell string (no shell is ever invoked -- runOne spawns
 * argv directly).
 */
function buildRunCommand(run) {
  const r = run || {};
  const tree = r.tree || REPO_ROOT;
  const mode = r.mode || 'probe';
  const args = [
    '-p',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-hook-events',
    '--plugin-dir', tree,
    '--agent', 'mos:larry-extended',
    '--model', MODEL,
    '--setting-sources', 'project,local',
    '--max-turns', String(r.maxTurns || 12),
    '--max-budget-usd', String(DEFAULT_PER_RUN_CAP_USD),
    '--no-session-persistence',
  ];
  if (mode === 'probe') {
    const probeConfigPath = r.probeConfigPath || path.join(r.tmpDir || '', 'probe.json');
    args.push('--mcp-config', probeConfigPath, '--permission-prompt-tool', 'mcp__fork359probe__permission');
  }
  return {
    command: 'claude',
    args: args,
    cwd: r.cwd || (r.tmpDir ? path.join(r.tmpDir, 'scratch-359') : undefined),
  };
}

/**
 * buildRunEnv(run) -- the hermetic child env for one run (context block:
 * per-run mkdtemp MINDRIAN_HOME/ROOMS_HOME/ROOT, side-channel and probe-log
 * paths, MINDRIAN_DISABLE_AUTO_REGISTER, MINDRIAN_OPEN_BROWSER_DISABLE,
 * TYPESAFE_API_KEY stripped). HOME is intentionally left UNCHANGED (keychain
 * auth; never bare mode, T-359-22/T-359-23).
 */
function buildRunEnv(run) {
  const r = run || {};
  const tmpDir = r.tmpDir;
  const env = Object.assign({}, process.env);
  delete env.TYPESAFE_API_KEY;
  if (tmpDir) {
    env.MINDRIAN_HOME = path.join(tmpDir, 'home');
    env.MINDRIAN_ROOMS_HOME = path.join(tmpDir, 'rooms');
    env.MINDRIAN_ROOMS_ROOT = path.join(tmpDir, 'rooms');
    env.CARD_FIRE_SIDECHANNEL_PATH = path.join(tmpDir, 'card-fire-reached.json');
    env.FORK359_PROBE_LOG = path.join(tmpDir, 'probe.jsonl');
  }
  env.MINDRIAN_DISABLE_AUTO_REGISTER = '1';
  env.MINDRIAN_OPEN_BROWSER_DISABLE = '1';
  return env;
}

function buildProbeConfigJson(probeScriptPath) {
  return {
    mcpServers: {
      fork359probe: {
        command: 'node',
        args: [probeScriptPath || PROBE_SCRIPT_PATH],
      },
    },
  };
}

/**
 * setupRunTempDir() -- the per-run mkdtemp tree: home/, rooms/scratch-359/
 * (with a minimal Layer-0 ROOM.md so the cold-start MODE_ROUTING card does
 * not confound the fork measurement, Finding 11), and scratch-359/ as the
 * run cwd.
 */
function setupRunTempDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fork359-forward-run-'));
  ensureDir(path.join(tmpDir, 'home'));
  ensureDir(path.join(tmpDir, 'rooms', 'scratch-359'));
  ensureDir(path.join(tmpDir, 'scratch-359'));
  fs.writeFileSync(
    path.join(tmpDir, 'rooms', 'scratch-359', 'ROOM.md'),
    '# scratch-359\n\nA scratch room for the Phase 359 R9 forward run. Not a real venture room.\n'
  );
  return tmpDir;
}

// ---------------------------------------------------------------------
// parseRun
// ---------------------------------------------------------------------

/**
 * parseRun(events, scenario, opts) -- splits the measured turn's attempt 1
 * at the first Stop hook_event (RESEARCH Finding 9), then classifies the
 * run. opts: {tree, mode ('probe'|'text'), interceptLogPath, sessionId, arm,
 * run, sha}.
 *
 * Returns one result row:
 *   {scenario_id, arm, run, sha, mode, poses_fork, card, card_is_mode_menu,
 *    card_options, declared, declared_labels, blocked_by_declared_arm,
 *    intercept_log_declared, split, status, cost_usd, duration_ms}
 *
 * status is 'ok' unless a preflight-shaped runtime problem is detected in
 * the stream itself: 'error_no_card_tool' (probe mode, AskUserQuestion
 * absent from system/init.tools), 'error_wrong_plugin' (not exactly one
 * 'mos' plugin at the expected tree path), 'error_mode_routing' (the
 * cold-start "No room detected" doctrine fired), 'error_budget' (a result
 * event names a budget-exceeded subtype, or its cost is at or over the
 * per-run cap). A budget-hit run is an ERROR, never a miss (RESEARCH
 * Finding 12).
 */
function parseRun(events, scenario, opts) {
  const o = opts || {};
  const tree = o.tree || REPO_ROOT;
  const mode = o.mode || 'probe';
  const evts = Array.isArray(events) ? events : [];

  const row = {
    scenario_id: scenario && scenario.id,
    arm: o.arm,
    run: o.run,
    sha: o.sha,
    mode: mode,
    poses_fork: scenario ? scenario.poses_fork === true : undefined,
    card: false,
    card_is_mode_menu: false,
    card_options: [],
    declared: false,
    declared_labels: undefined,
    blocked_by_declared_arm: false,
    intercept_log_declared: countInterceptLogDeclared(o.interceptLogPath),
    split: null,
    status: 'ok',
    cost_usd: 0,
    duration_ms: 0,
  };

  const initEvent = evts.find(function (e) { return e && e.type === 'system' && e.subtype === 'init'; });
  if (initEvent) {
    const tools = Array.isArray(initEvent.tools) ? initEvent.tools : [];
    if (mode === 'probe' && tools.indexOf('AskUserQuestion') === -1) {
      row.status = 'error_no_card_tool';
      return row;
    }
    const plugins = Array.isArray(initEvent.plugins) ? initEvent.plugins : [];
    const mosPlugins = plugins.filter(function (p) { return p && p.name === 'mos'; });
    const wrongCount = mosPlugins.length !== 1;
    const wrongPath = mosPlugins.length === 1 && !!o.tree && mosPlugins[0].path !== o.tree;
    if (wrongCount || wrongPath) {
      row.status = 'error_wrong_plugin';
      return row;
    }
  }

  const sessionStartEvent = evts.find(function (e) {
    return e && e.type === 'system' && e.subtype === 'hook_event' && e.hook_event_name === 'SessionStart';
  });
  if (
    sessionStartEvent &&
    typeof sessionStartEvent.output === 'string' &&
    sessionStartEvent.output.indexOf('No room detected') !== -1
  ) {
    row.status = 'error_mode_routing';
    return row;
  }

  for (const e of evts) {
    if (e && e.type === 'result') {
      if (typeof e.total_cost_usd === 'number') row.cost_usd = e.total_cost_usd;
      if (typeof e.duration_ms === 'number') row.duration_ms = e.duration_ms;
      const subtype = typeof e.subtype === 'string' ? e.subtype : '';
      if (/budget/i.test(subtype) || row.cost_usd >= DEFAULT_PER_RUN_CAP_USD) {
        row.status = 'error_budget';
        return row;
      }
    }
  }

  const stopIdx = evts.findIndex(function (e) {
    return e && e.type === 'system' && e.subtype === 'hook_event' && e.hook_event_name === 'Stop';
  });
  let attempt1Events;
  if (stopIdx === -1) {
    attempt1Events = evts;
    row.split = 'no-hook-events';
  } else {
    attempt1Events = evts.slice(0, stopIdx);
    row.split = 'stop-hook';
  }

  let askCardFound = false;
  let cardOptions = [];
  let lastAssistantText = '';
  for (const e of attempt1Events) {
    if (!e || e.type !== 'assistant') continue;
    const content = (e.message && Array.isArray(e.message.content)) ? e.message.content : [];
    for (const block of content) {
      if (block && block.type === 'tool_use' && block.name === 'AskUserQuestion') {
        askCardFound = true;
        const questions = (block.input && Array.isArray(block.input.questions)) ? block.input.questions : [];
        const opts2 = [];
        for (const q of questions) {
          const qOpts = (q && Array.isArray(q.options)) ? q.options : [];
          for (const optn of qOpts) {
            if (optn && typeof optn.label === 'string') opts2.push(optn.label);
          }
        }
        cardOptions = opts2;
      }
      if (block && block.type === 'text' && typeof block.text === 'string') {
        lastAssistantText = block.text;
      }
    }
  }

  row.card_options = cardOptions;
  if (askCardFound) {
    const modeMenuLabels = readModeMenuLabels(tree);
    if (sameLabelSet(cardOptions, modeMenuLabels)) {
      row.card_is_mode_menu = true;
    } else {
      row.card = true;
    }
  }

  let declParser = null;
  try {
    const p = path.join(tree, 'lib', 'core', 'fork-declaration.cjs');
    const resolved = require.resolve(p);
    delete require.cache[resolved];
    declParser = require(resolved);
  } catch (_e) {
    // a tree without its own copy (or a bare canned-stream test) falls back
    // to this repo's own parser, never to guessing from text.
    declParser = require(FORK_DECLARATION_PATH);
  }
  const parsed = declParser.parseForkDeclaration(lastAssistantText);
  if (parsed && parsed.declared) {
    row.declared = true;
    row.declared_labels = parsed.labels;
  }

  row.blocked_by_declared_arm = computeBlockedByDeclaredArm(tree, lastAssistantText, o.sessionId);

  return row;
}

// ---------------------------------------------------------------------
// evaluate
// ---------------------------------------------------------------------

/**
 * evaluate(rows, opts) -- floor-guarded pre/post verdict (SPEC R9, N-4
 * vacuity floor, Pitfall 7/8). opts.mode selects how a fork run counts as
 * caught: 'probe' (a non-menu card OR a declaration) or 'text' (a
 * declaration only, N-4 fallback). opts.meta defaults to the scenario
 * fixture's own meta block (vacuity_floor, caps).
 *
 * floor = max(meta.vacuity_floor.min_pre_missed,
 *             ceil(meta.vacuity_floor.min_fraction_of_pre_fork_runs x pre fork runs))
 * outcome:
 *   - pre.missed < floor            -> INCONCLUSIVE (not a pass; below the
 *                                       non-vacuity floor)
 *   - post.missed <= 0.5 x pre.missed AND post.control_declared_blocks === 0
 *                                    -> PASS
 *   - otherwise                     -> FALSIFIED
 *
 * Rows whose status !== 'ok' (budget-hit, wrong-plugin, mode-routing, etc.)
 * are excluded from both the numerator and the denominator, and counted
 * separately under `errors` (RESEARCH Finding 12: a budget-hit run is an
 * ERROR, never a miss).
 *
 * hook_live_proof (Pitfall 8): true when at least one post-arm fork row
 * carries declared:true, card:false (non-menu) and intercept_log_declared >
 * 0 -- proof the hook path is actually live, not merely offline-corroborated.
 */
function evaluate(rows, opts) {
  const o = opts || {};
  const mode = o.mode || 'probe';
  const meta = o.meta || loadScenarios().meta;
  const floorFraction = (meta.vacuity_floor && meta.vacuity_floor.min_fraction_of_pre_fork_runs) || 0.2;
  const floorMin = (meta.vacuity_floor && meta.vacuity_floor.min_pre_missed) || 6;
  const allRows = Array.isArray(rows) ? rows : [];

  function summarizeArm(armRows) {
    const ok = armRows.filter(function (r) { return r.status === 'ok'; });
    const errors = armRows.filter(function (r) { return r.status !== 'ok'; });
    const forkRows = ok.filter(function (r) { return r.poses_fork === true; });
    const controlRows = ok.filter(function (r) { return r.poses_fork === false; });
    const cards = forkRows.filter(function (r) { return r.card === true; });
    const declarations = forkRows.filter(function (r) { return r.declared === true; });
    const missedRows = forkRows.filter(function (r) {
      if (mode === 'text') return r.declared !== true;
      return r.card !== true && r.declared !== true;
    });
    const controlDeclaredBlocks = controlRows.filter(function (r) { return r.blocked_by_declared_arm === true; });
    return {
      fork_runs: forkRows.length,
      control_runs: controlRows.length,
      cards: cards.length,
      declarations: declarations.length,
      missed: missedRows.length,
      missed_ids: missedRows.map(function (r) { return r.scenario_id; }),
      control_declared_blocks: controlDeclaredBlocks.length,
      control_declared_block_ids: controlDeclaredBlocks.map(function (r) { return r.scenario_id; }),
      errors: errors.length,
      error_ids: errors.map(function (r) { return r.scenario_id; }),
    };
  }

  const preRows = allRows.filter(function (r) { return r.arm === 'pre'; });
  const postRows = allRows.filter(function (r) { return r.arm === 'post'; });
  const pre = summarizeArm(preRows);
  const post = summarizeArm(postRows);

  const floor = Math.max(floorMin, Math.ceil(floorFraction * pre.fork_runs));

  const hookLiveProofRows = postRows.filter(function (r) {
    return (
      r.status === 'ok' &&
      r.poses_fork === true &&
      r.declared === true &&
      r.card !== true &&
      (r.intercept_log_declared || 0) > 0
    );
  });

  let outcome;
  if (pre.missed < floor) {
    outcome = 'INCONCLUSIVE';
  } else if (post.missed <= pre.missed * 0.5 && post.control_declared_blocks === 0) {
    outcome = 'PASS';
  } else {
    outcome = 'FALSIFIED';
  }

  return {
    mode: mode,
    floor: floor,
    pre: pre,
    post: post,
    outcome: outcome,
    hook_live_proof: hookLiveProofRows.length > 0,
  };
}

// ---------------------------------------------------------------------
// Arm trees (git archive, RESEARCH Pattern 5 / 357's prepareCodeRoot)
// ---------------------------------------------------------------------

/**
 * resolveShaForArm(arm, opts) -- 'pre' = <r8Sha>^ (the parent commit, i.e.
 * before R8's prose landed) or the explicit --pre-sha override; 'post' =
 * <r8Sha> itself or the explicit --post-sha override.
 */
function resolveShaForArm(arm, opts) {
  const o = opts || {};
  if (arm === 'pre' && o.preSha) return o.preSha;
  if (arm === 'post' && o.postSha) return o.postSha;
  if (o.r8Sha) return arm === 'pre' ? (o.r8Sha + '^') : o.r8Sha;
  throw new Error('resolveShaForArm: need --r8-sha, or both --pre-sha and --post-sha, for arm ' + arm);
}

/**
 * gitArchiveTree(sha, resultsDir) -- `git archive <sha> | tar -x` into a
 * per-sha directory under <resultsDir>/trees/ (reused across runs and
 * scenarios for that sha), with node_modules symlinked from this repo
 * (357's prepareCodeRoot pattern, scripts/replay-card-fire.cjs).
 */
function gitArchiveTree(sha, resultsDir) {
  const treesDir = path.join(resultsDir, 'trees');
  ensureDir(treesDir);
  const dest = path.join(treesDir, String(sha).replace(/[^A-Za-z0-9._-]/g, '_'));
  if (fs.existsSync(dest)) return dest;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fork359-tree-'));
  try {
    const archivePath = path.join(tmp, 'a.tar');
    execFileSync('git', ['archive', '-o', archivePath, sha], { cwd: REPO_ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
    ensureDir(dest);
    execFileSync('tar', ['-xf', archivePath, '-C', dest], { stdio: ['ignore', 'ignore', 'pipe'] });
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }

  const nodeModulesSrc = path.join(REPO_ROOT, 'node_modules');
  if (fs.existsSync(nodeModulesSrc)) {
    try {
      fs.symlinkSync(nodeModulesSrc, path.join(dest, 'node_modules'), 'dir');
    } catch (_e) {
      // best-effort: a missing symlink only breaks a third-party-require path
    }
  }
  return dest;
}

// ---------------------------------------------------------------------
// runOne / runBatch -- the ONLY code paths that ever spawn `claude` for a
// real run. Neither is exercised by this plan's test suite (SPEND BAN);
// they exist, complete and documented, for plans 10 and 11 to call after a
// navigator spend checkpoint.
// ---------------------------------------------------------------------

/**
 * runOne(run) -- spawns claude for one hermetic run: writes each scenario
 * turn as a stream-json user message after the previous turn's `result`
 * event, tees every event to run.streamPath, kills after RUN_TIMEOUT_MS
 * (marking status error_timeout if it had not already finished), then
 * parses the collected events with parseRun. Returns a Promise<row>.
 */
function runOne(run) {
  return new Promise(function (resolve) {
    const cmd = buildRunCommand(run);
    const env = buildRunEnv(run);
    ensureDir(path.dirname(run.streamPath));
    const streamFd = fs.openSync(run.streamPath, 'a');

    const child = spawn(cmd.command, cmd.args, { cwd: cmd.cwd, env: env, stdio: ['pipe', 'pipe', 'pipe'] });

    const events = [];
    let buf = '';
    let turnIndex = 0;
    const turns = (run.scenario && Array.isArray(run.scenario.turns)) ? run.scenario.turns : [];

    function writeNextTurn() {
      if (turnIndex >= turns.length) {
        try { child.stdin.end(); } catch (_e) { /* best-effort */ }
        return;
      }
      const msg = { type: 'user', message: { role: 'user', content: [{ type: 'text', text: turns[turnIndex] }] } };
      try {
        child.stdin.write(JSON.stringify(msg) + '\n');
      } catch (_e) {
        /* the child may have already exited; the close handler below still fires */
      }
      turnIndex += 1;
    }

    child.stdout.on('data', function (chunk) {
      try { fs.writeSync(streamFd, chunk); } catch (_e) { /* best-effort tee */ }
      buf += chunk.toString();
      let idx = buf.indexOf('\n');
      while (idx !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        idx = buf.indexOf('\n');
        if (!line.trim()) continue;
        let evt = null;
        try { evt = JSON.parse(line); } catch (_e) { evt = null; }
        if (evt) {
          events.push(evt);
          if (evt.type === 'result') writeNextTurn();
        }
      }
    });

    let timedOut = false;
    const killTimer = setTimeout(function () {
      timedOut = true;
      try { child.kill('SIGKILL'); } catch (_e) { /* best-effort */ }
    }, RUN_TIMEOUT_MS);

    child.on('close', function () {
      clearTimeout(killTimer);
      try { fs.closeSync(streamFd); } catch (_e) { /* best-effort */ }
      const row = parseRun(events, run.scenario, {
        tree: run.tree,
        mode: run.mode,
        interceptLogPath: run.interceptLogPath,
        arm: run.arm,
        run: run.run,
        sha: run.sha,
      });
      if (timedOut && row.status === 'ok') row.status = 'error_timeout';
      resolve(row);
    });

    writeNextTurn();
  });
}

/**
 * runBatch(scenarios, arms, runsPerScenario, opts) -- sequential, resumable
 * (a (scenario, arm, run) already 'ok' in the results file is skipped; a
 * second consecutive error on the same key is left as ERROR, not retried
 * again); stops before the cumulative spend would exceed
 * opts.totalCapUsd - DEFAULT_PER_RUN_CAP_USD (RESEARCH Finding 12).
 */
async function runBatch(scenarios, arms, runsPerScenario, opts) {
  const o = opts || {};
  const resultsDir = o.resultsDir || DEFAULT_RESULTS_DIR;
  const resultsPath = o.results || path.join(resultsDir, 'results.jsonl');
  ensureDir(path.dirname(resultsPath));

  const existing = loadResultsRows(resultsPath);
  const rowKey = function (r) { return r.scenario_id + '|' + r.arm + '|' + r.run; };
  const okKeys = new Set(existing.filter(function (r) { return r.status === 'ok'; }).map(rowKey));
  let spent = existing.reduce(function (sum, r) { return sum + (r.cost_usd || 0); }, 0);
  const totalCap = typeof o.totalCapUsd === 'number' ? o.totalCapUsd : DEFAULT_TOTAL_CAP_USD;

  for (const arm of arms) {
    const sha = resolveShaForArm(arm, o);
    const tree = gitArchiveTree(sha, resultsDir);
    for (const scenario of scenarios) {
      for (let runIndex = 1; runIndex <= runsPerScenario; runIndex += 1) {
        const key = scenario.id + '|' + arm + '|' + runIndex;
        if (okKeys.has(key)) continue;
        if (spent + DEFAULT_PER_RUN_CAP_USD > totalCap) {
          appendResultRow(resultsPath, {
            scenario_id: scenario.id, arm: arm, run: runIndex, sha: sha, mode: o.mode || 'probe',
            poses_fork: scenario.poses_fork === true, status: 'error_cap_reached',
          });
          continue;
        }

        const tmpDir = setupRunTempDir();
        const mode = o.mode || 'probe';
        const probeConfigPath = path.join(tmpDir, 'probe.json');
        if (mode === 'probe') {
          fs.writeFileSync(probeConfigPath, JSON.stringify(buildProbeConfigJson(PROBE_SCRIPT_PATH)));
        }
        const streamPath = path.join(resultsDir, 'streams', arm, scenario.id + '-' + runIndex + '.jsonl');

        const run = {
          scenario: scenario,
          arm: arm,
          run: runIndex,
          sha: sha,
          mode: mode,
          tree: tree,
          tmpDir: tmpDir,
          cwd: path.join(tmpDir, 'scratch-359'),
          probeConfigPath: probeConfigPath,
          streamPath: streamPath,
          interceptLogPath: path.join(tmpDir, 'home', 'card-fire-intercepts.log'),
        };

        const row = await runOne(run);
        appendResultRow(resultsPath, row);
        spent += row.cost_usd || 0;
      }
    }
  }
  return resultsPath;
}

// ---------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------

function parseArgv(argv) {
  const opts = {};
  const a = argv || [];
  for (let i = 0; i < a.length; i += 1) {
    switch (a[i]) {
      case '--arm': opts.arm = a[i += 1]; break;
      case '--r8-sha': opts.r8Sha = a[i += 1]; break;
      case '--pre-sha': opts.preSha = a[i += 1]; break;
      case '--post-sha': opts.postSha = a[i += 1]; break;
      case '--mode': opts.mode = a[i += 1]; break;
      case '--smoke': opts.smoke = true; break;
      case '--runs': opts.runs = parseInt(a[i += 1], 10); break;
      case '--only': opts.only = a[i += 1]; break;
      case '--results': opts.results = a[i += 1]; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--project': opts.project = true; break;
      case '--cost-per-run': opts.costPerRun = parseFloat(a[i += 1]); break;
      case '--parse': opts.parse = a[i += 1]; break;
      case '--scenario': opts.scenario = a[i += 1]; break;
      case '--tree': opts.tree = a[i += 1]; break;
      case '--evaluate': opts.evaluate = true; break;
      default: break;
    }
  }
  return opts;
}

/**
 * main(argv) -- switch-case CLI router (the repo's gsd-tools.cjs pattern;
 * CONVENTIONS.md, no Commander/yargs). Returns a plain number (sync paths:
 * --parse, --evaluate, --project, --dry-run, a preflight refusal) or a
 * Promise<number> (an actual --arm run, delegated to runBatch). This plan's
 * test suite exercises only the sync, non-spending paths.
 */
function main(argv) {
  const opts = parseArgv(argv || process.argv.slice(2));

  if (opts.parse) {
    const events = loadJsonl(opts.parse);
    const scenarioFile = loadScenarios();
    const scenario = scenarioFile.scenarios.find(function (s) { return s.id === opts.scenario; }) || { id: opts.scenario };
    const row = parseRun(events, scenario, {
      tree: opts.tree || REPO_ROOT,
      mode: opts.mode || 'probe',
    });
    console.log(JSON.stringify(row));
    return 0;
  }

  if (opts.evaluate) {
    const resultsPath = opts.results || path.join(DEFAULT_RESULTS_DIR, 'results.jsonl');
    const rows = loadResultsRows(resultsPath);
    const result = evaluate(rows, { mode: opts.mode || 'probe' });
    console.log(JSON.stringify(result));
    return result.outcome === 'FALSIFIED' ? 1 : 0;
  }

  const scenarioFile = loadScenarios();
  const meta = scenarioFile.meta;

  let scenarios = scenarioFile.scenarios;
  if (opts.only) {
    const ids = new Set(opts.only.split(','));
    scenarios = scenarios.filter(function (s) { return ids.has(s.id); });
  }
  if (opts.smoke) {
    const firstFork = scenarioFile.scenarios.find(function (s) { return s.poses_fork === true; });
    scenarios = firstFork ? [firstFork] : [];
  }

  const runsPerScenario = opts.smoke ? 1 : (opts.runs || meta.runs_per_scenario || 3);
  const arms = (opts.arm === 'both' || !opts.arm) ? ['pre', 'post'] : [opts.arm];
  const plannedRuns = scenarios.length * runsPerScenario * arms.length;
  const costPerRun = opts.costPerRun || DEFAULT_PER_RUN_CAP_USD;
  const totalCapUsd = (meta.caps && meta.caps.total_usd) || DEFAULT_TOTAL_CAP_USD;

  const pf = preflight({
    model: MODEL,
    perRunCapUsd: DEFAULT_PER_RUN_CAP_USD,
    plannedRuns: plannedRuns,
    costPerRunUsd: costPerRun,
    totalCapUsd: totalCapUsd,
  });

  if (!pf.ok) {
    process.stderr.write('[forward-fork-scenarios-359] preflight refused: ' + pf.reason + '\n');
    return pf.exitCode || 2;
  }

  if (opts.project) {
    console.log(JSON.stringify({ planned_runs: plannedRuns, projected_total_usd: pf.projectedTotalUsd }));
    return 0;
  }

  if (opts.dryRun) {
    for (const arm of arms) {
      let sha = '<pending-r8-sha>';
      try { sha = resolveShaForArm(arm, opts); } catch (_e) { /* --dry-run may run before a sha is chosen */ }
      for (const scenario of scenarios) {
        for (let runIndex = 1; runIndex <= runsPerScenario; runIndex += 1) {
          const run = {
            scenario: scenario,
            arm: arm,
            run: runIndex,
            sha: sha,
            mode: opts.mode || 'probe',
            tree: '<tree:' + arm + ':' + sha + '>',
            tmpDir: '<tmp>',
          };
          const cmd = buildRunCommand(run);
          console.log('[dry-run] ' + scenario.id + ' ' + arm + '#' + runIndex + ': ' + cmd.command + ' ' + cmd.args.join(' '));
        }
      }
    }
    return 0;
  }

  // A real, paid --arm run. Preflight has already passed above. This file
  // spends money ONLY here, and this plan never reaches this branch (the
  // SPEND BAN): no test in tests/test-359-forward-harness.cjs calls main()
  // without --dry-run, --parse or --evaluate. Plans 10 and 11 call this
  // exact branch after a navigator spend checkpoint.
  return runBatch(scenarios, arms, runsPerScenario, {
    r8Sha: opts.r8Sha,
    preSha: opts.preSha,
    postSha: opts.postSha,
    mode: opts.mode || 'probe',
    results: opts.results,
    resultsDir: DEFAULT_RESULTS_DIR,
    totalCapUsd: totalCapUsd,
  }).then(function (resultsPath) {
    console.log(JSON.stringify({ results: resultsPath }));
    return 0;
  });
}

if (require.main === module) {
  Promise.resolve(main(process.argv.slice(2)))
    .then(function (code) {
      process.exitCode = code;
    })
    .catch(function (e) {
      process.stderr.write('[forward-fork-scenarios-359] fatal: ' + (e && e.message ? e.message : String(e)) + '\n');
      process.exitCode = 1;
    });
}

module.exports = {
  // Required exports (plan artifact contract)
  preflight: preflight,
  buildRunCommand: buildRunCommand,
  parseRun: parseRun,
  evaluate: evaluate,
  main: main,
  // Additional exports, used by the offline test and by plans 10/11
  buildRunEnv: buildRunEnv,
  buildProbeConfigJson: buildProbeConfigJson,
  setupRunTempDir: setupRunTempDir,
  readModeMenuLabels: readModeMenuLabels,
  sameLabelSet: sameLabelSet,
  countInterceptLogDeclared: countInterceptLogDeclared,
  computeBlockedByDeclaredArm: computeBlockedByDeclaredArm,
  resolveShaForArm: resolveShaForArm,
  gitArchiveTree: gitArchiveTree,
  runOne: runOne,
  runBatch: runBatch,
  loadScenarios: loadScenarios,
  loadJsonl: loadJsonl,
  loadResultsRows: loadResultsRows,
  appendResultRow: appendResultRow,
  parseClaudeVersion: parseClaudeVersion,
  isVersionAtLeast: isVersionAtLeast,
  getClaudeVersion: getClaudeVersion,
  parseArgv: parseArgv,
  REPO_ROOT: REPO_ROOT,
  SCENARIOS_PATH: SCENARIOS_PATH,
  PROBE_SCRIPT_PATH: PROBE_SCRIPT_PATH,
  DEFAULT_RESULTS_DIR: DEFAULT_RESULTS_DIR,
  DEFAULT_PER_RUN_CAP_USD: DEFAULT_PER_RUN_CAP_USD,
  DEFAULT_TOTAL_CAP_USD: DEFAULT_TOTAL_CAP_USD,
  MIN_CLAUDE_VERSION: MIN_CLAUDE_VERSION,
  MODEL: MODEL,
};
