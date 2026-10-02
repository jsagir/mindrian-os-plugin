'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 17 -- the one declared egress policy (ADR-E16, EPV366-22).
 *
 * data/egress-policy.json lists every line the research planner can send anything out on, once.
 * The audit ledger reads it (a record for a line that is off is refused) and the quick run checks
 * it before any fetch. A room may add <room>/.mindrian/egress-policy.json, but that file can only
 * turn lines OFF: a room file never widens the plugin default (T-366-70). `--offline` turns every
 * line off.
 *
 *   loadEgressPolicy(roomDir, { offline }) -> { schema, offline, lines, ignored }
 *     lines[name] = { endpoint, default, scope, providers, allowed }
 *     ignored[]   = strings naming each override that was not honored (never throws)
 *   lineAllowed(policy, line)    -> true only for a known line whose effective value is on
 *   lineForProvider(provider)    -> the line name from the policy file's providers[], or null
 *                                   (unknown stays null: lineAllowed treats it as off)
 *
 * Fresh read on every call, no cache (the loadFrameworkNames shape): an edited file is picked up
 * without a restart. The policy holds endpoints only, never keys (T-366-74). No network I/O here.
 * No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = 'mos.egress-policy/1';
const PLUGIN_POLICY = path.resolve(__dirname, '..', '..', '..', 'data', 'egress-policy.json');
const OVERRIDE_NAME = 'egress-policy.json';
const OVERRIDE_REL = path.join('.mindrian', OVERRIDE_NAME);

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

// readPluginPolicy() -> { ok, lines } | { ok:false }. The shipped file; malformed means fail closed.
function readPluginPolicy() {
  try {
    const doc = JSON.parse(fs.readFileSync(PLUGIN_POLICY, 'utf8'));
    if (!isObj(doc) || doc.schema !== SCHEMA || !isObj(doc.lines)) return { ok: false };
    return { ok: true, lines: doc.lines };
  } catch (_e) {
    return { ok: false };
  }
}

// within(parent, child) -> boundary-safe containment of resolved paths
function within(parent, child) {
  return child === parent || child.indexOf(parent + path.sep) === 0;
}

// readOverride(roomDir, ignored) -> the room's per-line values { line: boolean } or null.
// The file must resolve (realpath) inside the room's .mindrian directory.
function readOverride(roomDir, ignored) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) return null;
  const file = path.join(roomDir, OVERRIDE_REL);
  if (!fs.existsSync(file)) return null;
  let real;
  let realDir;
  try {
    real = fs.realpathSync(file);
    realDir = fs.realpathSync(path.join(roomDir, '.mindrian'));
  } catch (_e) {
    ignored.push('override_unreadable:' + OVERRIDE_NAME);
    return null;
  }
  if (!within(realDir, real)) {
    ignored.push('override_outside_room:' + OVERRIDE_NAME);
    return null;
  }
  let doc;
  try { doc = JSON.parse(fs.readFileSync(real, 'utf8')); } catch (_e) { doc = undefined; }
  if (!isObj(doc) || !isObj(doc.lines)) {
    ignored.push('override_malformed:' + OVERRIDE_NAME);
    return null;
  }
  const out = {};
  Object.keys(doc.lines).forEach(function (name) {
    const v = doc.lines[name];
    const bool = typeof v === 'boolean' ? v : (isObj(v) && typeof v.default === 'boolean' ? v.default : null);
    if (bool === null) { ignored.push('override_bad_value:' + name); return; }
    out[name] = bool;
  });
  return out;
}

// loadEgressPolicy(roomDir, { offline }) -> the effective policy. Never throws.
function loadEgressPolicy(roomDir, opts) {
  const offline = isObj(opts) && opts.offline === true;
  const ignored = [];
  const plugin = readPluginPolicy();
  const lines = {};
  if (!plugin.ok) {
    ignored.push('plugin_policy_unreadable:' + 'data/' + OVERRIDE_NAME);
    return { schema: SCHEMA, offline: offline, lines: lines, ignored: ignored };
  }
  Object.keys(plugin.lines).forEach(function (name) {
    const src = plugin.lines[name];
    if (!isObj(src)) return;
    lines[name] = {
      endpoint: typeof src.endpoint === 'string' ? src.endpoint : '',
      default: src.default === true,
      scope: typeof src.scope === 'string' ? src.scope : '',
      providers: Array.isArray(src.providers) ? src.providers.filter(function (p) { return typeof p === 'string'; }) : [],
      allowed: src.default === true,
    };
  });
  let override = null;
  try { override = readOverride(roomDir, ignored); } catch (_e) { override = null; ignored.push('override_unreadable:' + OVERRIDE_NAME); }
  if (override) {
    Object.keys(override).forEach(function (name) {
      if (!Object.prototype.hasOwnProperty.call(lines, name)) { ignored.push('override_unknown_line:' + name); return; }
      if (override[name] === false) { lines[name].allowed = false; return; }
      // true: a no-op over an on line, a refused widening over an off one
      if (lines[name].default !== true) ignored.push('override_cannot_widen:' + name);
    });
  }
  if (offline) Object.keys(lines).forEach(function (name) { lines[name].allowed = false; });
  return { schema: SCHEMA, offline: offline, lines: lines, ignored: ignored };
}

function lineAllowed(policy, line) {
  if (!isObj(policy) || !isObj(policy.lines) || typeof line !== 'string') return false;
  if (!Object.prototype.hasOwnProperty.call(policy.lines, line)) return false;
  return policy.lines[line].allowed === true;
}

// lineForProvider(provider) -> the line whose providers[] lists it, or null
function lineForProvider(provider) {
  if (typeof provider !== 'string' || provider.length === 0) return null;
  const plugin = readPluginPolicy();
  if (!plugin.ok) return null;
  const names = Object.keys(plugin.lines);
  for (let i = 0; i < names.length; i += 1) {
    const src = plugin.lines[names[i]];
    if (isObj(src) && Array.isArray(src.providers) && src.providers.indexOf(provider) !== -1) return names[i];
  }
  return null;
}

module.exports = {
  SCHEMA: SCHEMA,
  loadEgressPolicy: loadEgressPolicy,
  lineAllowed: lineAllowed,
  lineForProvider: lineForProvider,
};
