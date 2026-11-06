'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 387 plan 03 -- what each Eureka tool needs from the engine, the probes that tell the causes
 * apart, the uv argument builders and the text classifier.
 *
 * WHAT: eleven functions (plus EXTRA_MARKERS and SYNC_EXTRAS_ALLOWED):
 *   needsForCall(tool, args, env)      the extras, model and Node needs of one tool call
 *   uvRunArgs(root, extras, opts)      the uv arguments of an engine start (safety flags INSIDE them)
 *   uvSyncArgs(extras)                 the uv arguments of the one network step
 *   extrasInstalled(root, env, deps)   which package groups the engine environment holds
 *   nodeStatus(env, deps)              Node.js 22 or newer?
 *   modelHint(env)                     advisory: is a local embedding model on this machine?
 *   checkEngine(root, deps)            the readiness check with a named cause
 *   engineWrites(env), syncHosts(extras)   what setup and runs write, what setup may reach
 *   classifyEngineText(text), startLine(text, ctx)   typed causes from engine and uv text
 *
 * SETUP HAS THREE PARTS and a package sync gives only the first: (1) Python packages (uv sync for the
 * union of extras), (2) a model folder that the person places (the engine never downloads one; a
 * package sync gives no weights), (3) Node.js 22 or newer for some workers.
 *
 * WHY the safety flags are arguments: UV_OFFLINE is not in the child environment allowlist and a
 * plain "uv run" syncs the environment and can reach a package index (Plan 387-01 RCA, 4 of 4
 * argument lists). The run builder passes --no-sync, --offline, --locked and --no-python-downloads
 * unless the host sets MINDRIAN_EUREKA_ALLOW_NETWORK=1.
 *
 * ENGINE READS (read-only, names only, no source copied). Evidence label per cell: plugin-code (read
 * in this repo), engine-read (re-read in the engine folder by the executor of Plan 387-03) or
 * audit-hypothesis (an agent audit claim, not proven). Engine files read, names only:
 *   - pyproject.toml: the extras table and the eureka-mcp script entry
 *   - workflow_handlers.py: the HANDLERS table and every handler that checks the Node.js runtime
 *     (RS workers, Genesis plan, IP-finance detector, weak-signal tail, portfolio dimensions,
 *     opportunity statement, graph-event harvest and the critic worker)
 *   - graph_relations/*, discovery_workflows.py, hsi_interpret_whitespace.py: no encoder, model or
 *     Node reference, so the graph tools need neither a model nor Node
 *   - opportunity_discovery.py and opportunity_pairs/encoders.py: the scout and pair routes load a
 *     local model with downloads off (local_files_only); no Node check
 *   - decision_patterns/*: no encoder, model or Node reference
 * The two audits disagreed about which workers need Node; the handlers above decide.
 *
 * Part 7 (reuse before build): the home and env-object idiom is the one of eureka-engine-resolver.cjs
 * and eureka-deps-resolver.cjs. Part 8: the only processes this module spawns are the probes in
 * checkEngine (uv --version, uv python find, node --version) and nodeStatus (node --version), each
 * with shell false. No network, no Brain, no room text. Tests inject spawnSync and fs fixtures.
 *
 * Every export degrades to a documented default and never throws across the boundary, except the two
 * argument builders, which throw a TypeError on a name outside the allow lists (a caller bug).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const resolver = require('./eureka-engine-resolver.cjs');

const EXTRA_MARKERS = Object.freeze({
  'mcp-server': Object.freeze(['mcp']),
  'modern-encoder': Object.freeze(['sentence_transformers']),
  'reference-encoder': Object.freeze(['torch', 'transformers']),
  hmm: Object.freeze(['pomegranate']),
});
const SYNC_EXTRAS_ALLOWED = Object.freeze(Object.keys(EXTRA_MARKERS));
const ENTRY_DEFAULT = Object.freeze(['eureka-mcp']);
const ENTRY_DOCTOR = Object.freeze(['eureka', 'doctor', '--json']);
const PROBE_TIMEOUT_MS = 10000;

function envObject(env) {
  if (env === undefined) return process.env;
  return env && typeof env === 'object' ? env : {};
}

function str(value) { return typeof value === 'string' && value.trim() ? value : null; }

function homeOf(env) {
  const e = envObject(env);
  return str(e.HOME) || str(e.USERPROFILE) || os.homedir();
}

function encoderExtra(env) {
  return envObject(env).MINDRIAN_EUREKA_RS_ENCODER === 'reference-bert' ? 'reference-encoder' : 'modern-encoder';
}

// ---------------------------------------------------------------------------
// the needs table
// ---------------------------------------------------------------------------

// Tools that call a graph workflow (callEurekaWorkflow, plugin-code). Each is served by a handler in
// graph_relations/*, discovery_workflows.py or hsi_interpret_whitespace.py (engine-read).
const GRAPH_TOOLS = new Set([
  'eureka_graph_analyze', 'eureka_graph_propose_relationships',
  'eureka_graph_find_shared_neighbor_gaps', 'eureka_graph_find_network_holes',
  'eureka_graph_find_community_bridge_pairs', 'eureka_graph_assess_category_edge_patterns',
  'eureka_graph_find_similar_unlinked_items', 'eureka_graph_backtest', 'eureka_graph_compare_topics',
  'eureka_graph_map_neighbourhoods', 'eureka_graph_package_relationships', 'eureka_graph_prepare_artifacts',
  'eureka_graph_rank_paths', 'eureka_graph_score_surprise', 'eureka_hsi_interpret_whitespace',
]);

// Capability ids whose handler function checks the Node.js runtime (engine-read: workflow_handlers.py).
const NODE_CAPABILITY_IDS = new Set([
  'research.extract_experts_from_papers', 'research.score_rs_breakthrough', 'research.classify_rs_pair',
  'research.assess_rs_commercial_case', 'research.preprocess_rs_documents', 'research.analyze_rs_domain_projection',
  'research.score_rs_differential_pair', 'research.assess_rs_pair_set_quality', 'research.generate_rs_query_matrix',
  'research.run_genesis_local_plan', 'research.classify_ip_finance_domain_signals', 'portfolio.classify_weak_signal_tail',
  'portfolio.assess_candidate_dimensions', 'opportunity.prepare_statement', 'opportunity.harvest_graph_events',
  'portfolio.prepare_candidate_critic', 'portfolio.inspect_candidate_grounding', 'portfolio.prepare_critic_rubric',
  'portfolio.evaluate_critic_rubric',
]);

const DECISION_IDS = new Set(['decision.compare_sequence_patterns', 'decision.fit_sequence_patterns']);
const PAIR_IDS = new Set(['opportunity.find_cross_domain_pairs', 'opportunity.synthesize_discovery_signals']);

function cell(extras, model, node, modelLabel, nodeLabel) {
  return {
    extras: extras.slice(), model, node,
    evidence: { extras: 'plugin-code', model: modelLabel || 'audit-hypothesis', node: nodeLabel || 'audit-hypothesis' },
  };
}

function needsForCall(toolName, args, env) {
  try {
    const a = args && typeof args === 'object' ? args : {};
    const tool = String(toolName || '');
    if (GRAPH_TOOLS.has(tool)) return cell(['mcp-server'], 'no', 'no', 'engine-read', 'engine-read');
    if (tool === 'eureka_graph_genesis_plan') return cell(['mcp-server'], 'no', 'yes', 'engine-read', 'engine-read');
    if (tool === 'eureka_graph_opportunity_scout') return cell(['mcp-server', encoderExtra(env)], 'yes', 'no', 'engine-read', 'engine-read');
    if (tool === 'eureka_capability_run' || tool === 'eureka_capability_start') {
      const id = typeof a.capability_id === 'string' ? a.capability_id : '';
      if (DECISION_IDS.has(id)) return cell(['mcp-server', 'hmm'], 'no', 'no', 'engine-read', 'engine-read');
      if (PAIR_IDS.has(id)) return cell(['mcp-server', encoderExtra(env)], 'yes', 'no', 'engine-read', 'engine-read');
      if (id === 'research.run_genesis_local_plan') return cell(['mcp-server'], 'no', 'yes', 'engine-read', 'engine-read');
      if (NODE_CAPABILITY_IDS.has(id)) return cell(['mcp-server'], 'unknown', 'yes', 'audit-hypothesis', 'engine-read');
      if (id.indexOf('graph.') === 0) return cell(['mcp-server'], 'no', 'no', 'engine-read', 'engine-read');
      return cell(['mcp-server'], 'unknown', 'unknown');
    }
    return cell(['mcp-server'], 'unknown', 'unknown');
  } catch (_error) {
    return cell(['mcp-server'], 'unknown', 'unknown');
  }
}

// ---------------------------------------------------------------------------
// uv argument builders
// ---------------------------------------------------------------------------

function checkExtras(extras) {
  if (!Array.isArray(extras)) throw new TypeError('extras must be an array');
  for (const name of extras) {
    if (typeof name !== 'string' || SYNC_EXTRAS_ALLOWED.indexOf(name) === -1) {
      throw new TypeError('extra name is not allowed: ' + JSON.stringify(String(name).slice(0, 40)));
    }
  }
}

function uvRunArgs(root, extras, opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  if (typeof root !== 'string' || !root) throw new TypeError('root must be a non-empty string');
  checkExtras(extras);
  let entry = ENTRY_DEFAULT;
  if (o.entry !== undefined) {
    const key = JSON.stringify(o.entry);
    if (key === JSON.stringify(ENTRY_DEFAULT)) entry = ENTRY_DEFAULT;
    else if (key === JSON.stringify(ENTRY_DOCTOR)) entry = ENTRY_DOCTOR;
    else throw new TypeError('entry is not allowed');
  }
  const args = o.allowNetwork === true
    ? ['run', '--locked', '--project', root]
    : ['run', '--no-sync', '--offline', '--locked', '--no-python-downloads', '--project', root];
  for (const name of extras) args.push('--extra', name);
  return args.concat(entry);
}

function uvSyncArgs(extras) {
  const list = Array.isArray(extras) ? extras : [];
  checkExtras(list);
  const ordered = ['mcp-server'];
  for (const name of list) if (ordered.indexOf(name) === -1) ordered.push(name);
  const args = ['sync', '--locked', '--no-python-downloads'];
  for (const name of ordered) args.push('--extra', name);
  return args;
}

function syncHosts(extras) {
  const list = Array.isArray(extras) ? extras : [];
  const hosts = ['pypi.org', 'files.pythonhosted.org'];
  if (list.indexOf('modern-encoder') !== -1 || list.indexOf('reference-encoder') !== -1) hosts.push('download.pytorch.org');
  return { hosts, python_downloads: 'off', builds_from_source: list.indexOf('hmm') !== -1 ? ['pomegranate'] : [] };
}

// ---------------------------------------------------------------------------
// where the engine writes and reads
// ---------------------------------------------------------------------------

function engineWrites(env) {
  const e = envObject(env);
  const home = homeOf(e);
  const engine = resolver.resolveEngine(e);
  const out = [];
  if (engine.root) {
    const venv = str(e.UV_PROJECT_ENVIRONMENT);
    out.push({ kind: 'environment', path: venv ? path.resolve(engine.root, venv) : path.join(engine.root, '.venv'), access: 'write at setup (uv sync)' });
  }
  const data = str(e.MINDRIAN_EUREKA_DATA_DIR);
  out.push({ kind: 'data', path: data ? path.resolve(data) : path.join(home, '.local', 'share', 'mindrian-eureka'), access: 'write at every engine start (jobs.sqlite3)' });
  const cache = str(e.MINDRIAN_EUREKA_CACHE_DIR);
  out.push({ kind: 'cache', path: cache ? path.resolve(cache) : path.join(home, '.cache', 'mindrian-eureka'), access: 'write (embeddings.sqlite3)' });
  out.push({ kind: 'huggingface', path: hubFolder(e, home), access: 'read' });
  return out;
}

function hubFolder(e, home) {
  const direct = str(e.HF_HUB_CACHE) || str(e.HUGGINGFACE_HUB_CACHE);
  if (direct) return path.resolve(direct);
  const hfHome = str(e.HF_HOME);
  if (hfHome) return path.join(path.resolve(hfHome), 'hub');
  return path.join(home, '.cache', 'huggingface', 'hub');
}

// ---------------------------------------------------------------------------
// probes
// ---------------------------------------------------------------------------

function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch (_e) { return false; } }

function normalizedNames(sitePackages) {
  const names = new Set();
  let entries = [];
  try { entries = fs.readdirSync(sitePackages); } catch (_e) { return names; }
  for (const raw of entries) {
    let name = String(raw).toLowerCase();
    if (/\.(dist|egg)-info$/.test(name)) name = name.replace(/\.(dist|egg)-info$/, '').replace(/-\d.*$/, '');
    else name = name.replace(/\.py$/, '');
    names.add(name.replace(/-/g, '_'));
  }
  return names;
}

function findSitePackages(venv) {
  const candidates = [path.join(venv, 'Lib', 'site-packages')];
  for (const lib of ['lib', 'lib64']) {
    try {
      for (const entry of fs.readdirSync(path.join(venv, lib))) {
        if (/^python3/.test(entry)) candidates.push(path.join(venv, lib, entry, 'site-packages'));
      }
    } catch (_e) { /* no such lib folder */ }
  }
  return candidates.find(isDir) || null;
}

function extrasInstalled(root, env, deps) {
  void deps;
  const none = { venv_present: false, located: false, installed: { 'mcp-server': null, 'modern-encoder': null, 'reference-encoder': null, hmm: null } };
  try {
    if (typeof root !== 'string' || !root) return none;
    const e = envObject(env);
    const venvSetting = str(e.UV_PROJECT_ENVIRONMENT);
    const venv = venvSetting ? path.resolve(root, venvSetting) : path.join(path.resolve(root), '.venv');
    if (!isDir(venv)) return none;
    const site = findSitePackages(venv);
    if (!site) return { venv_present: true, located: false, installed: none.installed };
    const names = normalizedNames(site);
    const installed = {};
    for (const [extra, markers] of Object.entries(EXTRA_MARKERS)) installed[extra] = markers.every((m) => names.has(m));
    return { venv_present: true, located: true, installed };
  } catch (_error) {
    return none;
  }
}

function probeEnv(env) {
  const e = envObject(env);
  const out = {};
  for (const key of ['PATH', 'HOME', 'USERPROFILE', 'SystemRoot', 'TMPDIR', 'TEMP', 'TMP', 'LANG']) if (typeof e[key] === 'string') out[key] = e[key];
  return out;
}

function nodeStatus(env, deps) {
  const spawn = (deps && deps.spawnSync) || childProcess.spawnSync;
  let res;
  try {
    res = spawn('node', ['--version'], { shell: false, encoding: 'utf8', timeout: PROBE_TIMEOUT_MS, input: '', env: probeEnv(env), windowsHide: true });
  } catch (_error) {
    return { ok: false, version: null, cause: 'node_missing' };
  }
  const text = res && !res.error && res.status === 0 ? String(res.stdout || '').trim() : '';
  const match = /^v(\d+)\.\d+/.exec(text);
  if (!match) return { ok: false, version: null, cause: 'node_missing' };
  if (Number(match[1]) < 22) return { ok: false, version: text, cause: 'node_too_old' };
  return { ok: true, version: text, cause: null };
}

const MODEL_PATH_VARS = ['MINDRIAN_EUREKA_RS_MODEL_PATH', 'MINDRIAN_EUREKA_HSI_MODEL_PATH', 'MINDRIAN_EUREKA_JASON_MODEL_PATH', 'MINDRIAN_EUREKA_ANALOGY_MODEL_PATH'];

function modelHint(env) {
  try {
    const e = envObject(env);
    for (const key of MODEL_PATH_VARS) {
      const value = str(e[key]);
      if (value && isDir(value)) return { found: true, via: 'env-path' };
    }
    const hasHome = str(e.HOME) || str(e.USERPROFILE);
    const hub = (str(e.HF_HUB_CACHE) || str(e.HUGGINGFACE_HUB_CACHE) || str(e.HF_HOME) || hasHome) ? hubFolder(e, homeOf(e)) : null;
    if (hub && isDir(hub)) {
      const entries = fs.readdirSync(hub);
      if (entries.some((x) => String(x).indexOf('models--') === 0)) return { found: true, via: 'hf-cache' };
    }
    return { found: false, via: null };
  } catch (_error) {
    return { found: false, via: null };
  }
}

// plain string matching of pyproject.toml: the [project] name and requires-python lines, and the
// [project.scripts] entry named eureka-mcp. No TOML library.
function sectionText(text, header) {
  const lines = String(text).split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === header);
  if (start === -1) return '';
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\s*\[/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

function readPyproject(root) {
  let text;
  try { text = fs.readFileSync(path.join(root, 'pyproject.toml'), 'utf8'); } catch (_e) { return null; }
  const project = sectionText(text, '[project]');
  const name = /^\s*name\s*=\s*"([^"]*)"/m.exec(project);
  const py = /^\s*requires-python\s*=\s*"([^"]*)"/m.exec(project);
  const scripts = sectionText(text, '[project.scripts]');
  return { name: name ? name[1] : null, requiresPython: py ? py[1] : null, hasEntry: /^\s*eureka-mcp\s*=/m.test(scripts) };
}

function checkEngine(root, deps) {
  const d = deps && typeof deps === 'object' ? deps : {};
  const env = envObject(d.env);
  const spawn = d.spawnSync || childProcess.spawnSync;
  const checks = [];
  const add = (id, ok, detail) => checks.push({ id, ok, detail });
  const result = (ok, cause, families) => ({ ok, cause, checks, families: families || [] });
  const skipped = (ids) => { for (const id of ids) add(id, null, 'skipped'); };
  const ALL = ['checkout', 'project_name', 'uv', 'python', 'node', 'extras', 'model', 'env_prepared'];
  const spawnOpts = { shell: false, encoding: 'utf8', timeout: PROBE_TIMEOUT_MS, input: '', env: probeEnv(env), windowsHide: true };

  // checkout
  if (typeof root !== 'string' || !root || !isDir(root)) {
    add('checkout', false, 'folder missing'); skipped(ALL.slice(1));
    return result(false, 'checkout_missing');
  }
  const project = readPyproject(root);
  if (!project) {
    add('checkout', false, 'no pyproject.toml'); skipped(ALL.slice(1));
    return result(false, 'pyproject_missing');
  }
  add('checkout', true, 'folder and pyproject.toml found');
  if (project.name !== 'mindrian-eureka' || !project.hasEntry) {
    add('project_name', false, project.name !== 'mindrian-eureka' ? 'project name is not mindrian-eureka' : 'no eureka-mcp script entry');
    skipped(ALL.slice(2));
    return result(false, 'project_name_mismatch');
  }
  add('project_name', true, 'mindrian-eureka with an eureka-mcp entry');

  // uv and Python (the only uv probes: --version and python find)
  const uvCommand = str(env.MINDRIAN_EUREKA_UV) || 'uv';
  let uvOk = false;
  let uvDetail = 'uv not found';
  try {
    const res = spawn(uvCommand, ['--version'], spawnOpts);
    if (res && !res.error && res.status === 0) { uvOk = true; uvDetail = String(res.stdout || '').trim().slice(0, 40) || 'uv found'; }
  } catch (_error) { uvOk = false; }
  add('uv', uvOk, uvDetail);
  let pythonOk = false;
  if (uvOk) {
    try {
      const res = spawn(uvCommand, ['python', 'find', '--no-project', project.requiresPython || '>=3.11'], spawnOpts);
      pythonOk = !!(res && !res.error && res.status === 0 && String(res.stdout || '').trim());
    } catch (_error) { pythonOk = false; }
    add('python', pythonOk, pythonOk ? 'a Python that meets ' + (project.requiresPython || '>=3.11') + ' was found' : 'no Python that meets ' + (project.requiresPython || '>=3.11'));
  } else {
    add('python', null, 'skipped');
  }

  // Node, extras, model (informational, except the mcp-server group)
  const node = nodeStatus(env, { spawnSync: spawn });
  add('node', node.ok, node.ok ? node.version : (node.cause === 'node_too_old' ? node.version + ' is older than 22' : 'node not found'));
  const installed = extrasInstalled(root, env, d);
  const extrasDetail = installed.located
    ? Object.keys(installed.installed).filter((k) => installed.installed[k]).join(', ') || 'none'
    : 'layout not read';
  add('extras', installed.located ? installed.installed['mcp-server'] === true : null, extrasDetail);
  const hint = modelHint(env);
  add('model', hint.found, hint.found ? 'found via ' + hint.via : 'no model folder seen (advisory)');
  add('env_prepared', installed.venv_present, installed.venv_present ? 'environment folder present' : 'no environment folder');

  // the core verdict
  let ok;
  let cause = null;
  if (!uvOk) { ok = false; cause = 'uv_missing'; }
  else if (!pythonOk) { ok = false; cause = 'python_missing'; }
  else if (!installed.venv_present) { ok = false; cause = 'env_not_synced'; }
  else if (!installed.located) { ok = null; }
  else if (installed.installed['mcp-server'] !== true) { ok = false; cause = 'extra_missing'; }
  else ok = true;

  // families
  const enc = encoderExtra(env);
  const groupFamily = (family, extra, needsModel) => {
    if (ok === false) return { family, status: 'not_ready', needs: [extra], cause };
    const have = installed.located ? installed.installed[extra] : null;
    if (have === null || have === undefined) return { family, status: 'unknown', needs: [extra], cause: null };
    if (have === false) return { family, status: 'needs_extra', needs: [extra], cause: 'extra_missing' };
    const row = { family, status: 'ready', needs: [extra], cause: null };
    if (needsModel) row.model_hint = hint.found;
    return row;
  };
  const graph = ok === false
    ? { family: 'graph', status: 'not_ready', needs: ['mcp-server'], cause }
    : ok === null ? { family: 'graph', status: 'unknown', needs: ['mcp-server'], cause: null }
      : { family: 'graph', status: 'ready', needs: ['mcp-server'], cause: null };
  const nodeFamily = ok === false
    ? { family: 'node-workers', status: 'not_ready', needs: ['node>=22'], cause }
    : node.ok ? { family: 'node-workers', status: 'ready', needs: ['node>=22'], cause: null }
      : { family: 'node-workers', status: 'needs_node', needs: ['node>=22'], cause: node.cause };
  const families = [graph, groupFamily('pairs-and-scout', enc, true), groupFamily('decision', 'hmm', false), nodeFamily];
  return result(ok, cause, families);
}

// ---------------------------------------------------------------------------
// text classification
// ---------------------------------------------------------------------------

const MODULE_GROUP = { mcp: 'mcp-server', sentence_transformers: 'modern-encoder', pomegranate: 'hmm', torch: 'reference-encoder', transformers: 'reference-encoder' };

function classifyEngineText(text) {
  try {
    const t = String(text === null || text === undefined ? '' : text);
    if (!t.trim()) return null;
    const opt = /Install the optional extra:[^\n]*mindrian-eureka\[([A-Za-z0-9_,-]+)\]/i.exec(t);
    if (opt) return { cause: 'extra_missing', extras: opt[1].split(',').map((x) => x.trim()).filter((x) => SYNC_EXTRAS_ALLOWED.indexOf(x) !== -1) };
    const mod = /No module named ['"](mcp|sentence_transformers|pomegranate|torch|transformers)(?:\.[\w.]*)?['"]/i.exec(t);
    if (mod) return { cause: 'extra_missing', extras: [MODULE_GROUP[mod[1].toLowerCase()]] };
    if (/No local model found|local_model_unavailable|A local sentence-transformer model is required/i.test(t)) return { cause: 'model_missing', extras: [] };
    if (/Node\.js 22 or newer/i.test(t)) return { cause: /not found|was not found/i.test(t) ? 'node_missing' : 'node_too_old', extras: [] };
    if (/No interpreter found|requires-python/i.test(t)) return { cause: 'python_missing', extras: [] };
    if (/lockfile[^\n]*needs to be updated|uv\.lock[^\n]*(needs to be updated|out of date)/i.test(t)) return { cause: 'lock_stale', extras: [] };
    if (/\buv\b[^\n]*ENOENT|uv: command not found|uv was not found/i.test(t)) return { cause: 'uv_missing', extras: [] };
    if (/No virtual environment found/i.test(t)) return { cause: 'env_not_synced', extras: [] };
    return null;
  } catch (_error) {
    return null;
  }
}

// The first non-empty line of start-up text from the engine process (before any request), made
// safe to show: root and home replaced, control characters removed, non-ASCII replaced, cut to 160.
function startLine(text, ctx) {
  try {
    const c = ctx && typeof ctx === 'object' ? ctx : {};
    const raw = String(text === null || text === undefined ? '' : text);
    let line = raw.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) || '';
    if (!line) return '';
    if (typeof c.root === 'string' && c.root) line = line.split(c.root).join('<MINDRIAN_EUREKA_ROOT>');
    if (typeof c.home === 'string' && c.home) line = line.split(c.home).join('~');
    line = line.replace(/[\u0000-\u001f\u007f]/g, '').replace(/[^\x20-\x7e]/g, '?');
    return line.slice(0, 160);
  } catch (_error) {
    return '';
  }
}

module.exports = {
  EXTRA_MARKERS,
  SYNC_EXTRAS_ALLOWED,
  needsForCall,
  uvRunArgs,
  uvSyncArgs,
  extrasInstalled,
  nodeStatus,
  modelHint,
  checkEngine,
  engineWrites,
  syncHosts,
  classifyEngineText,
  startLine,
  describeEngineState: resolver.describeEngineState,
  reasonForCause: resolver.reasonForCause,
};
