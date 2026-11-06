#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 386-36 (E-WEBHOOK) -- the credential-only PreToolUse hook for the web
 * lines: native WebSearch, WebFetch and the Tavily tools.
 * ==========================================================================
 * Owner principle for Part 8 (2026-11-06): the web lines get credential checks
 * only. Room words continue through the normal approval flow; credentials do
 * not. So this hook reads the PreToolUse payload on stdin, collects every
 * string value in tool_input (nested arrays and objects included) and runs the
 * one credential audit, credentialCheck of lib/core/web-path-gate.cjs (the
 * shapes of plan 386-31). It runs NO room-word, name, company or content scan.
 *
 * Signaling (clone of scripts/part8-egress-guard-hook.cjs):
 *   exit 2 = BLOCK. stderr carries a plain message and the typed reason
 *            credential_shaped. The message carries none of the credential
 *            bytes.
 *   exit 0 = ALLOW (no credential found), or no tool input to inspect
 *            (unparsable or empty stdin, no tool_input, no string in it).
 *
 * Fail posture (plan 386-29 decision: option-a, fail closed). An internal
 * failure AFTER the tool input was read (the credential module fails to load,
 * credentialCheck throws, any other failure) exits 2 with the typed reason
 * web_credential_check_unavailable and no bytes. Every such branch first writes
 * ONE count-only outage line through recordGuardOutage (plan 386-30): class
 * web (from the tool name), mode guard_load_failed, classify_threw or
 * hook_uncaught. The log module is required lazily inside the failure branch;
 * when the file does not exist no call is made. A failing log write never
 * changes the exit code.
 *
 * The hook opens no network connection and writes no file except the outage
 * line. Node built-ins and lib/core/web-path-gate.cjs only.
 *
 * No em-dashes. License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

const LIB_CORE = path.join(__dirname, '..', 'lib', 'core');
const GATE_PATH = path.join(LIB_CORE, 'web-path-gate.cjs');
const OUTAGE_LOG_PATH = path.join(LIB_CORE, 'part8-outage-log.cjs');

// Plan 386-29, decision: option-a. Set to false only by a new owner decision.
const FAIL_CLOSED = true;

const MAX_DEPTH = 64;

// Set once the payload was parsed, so the last-resort catch can name the class.
let currentTool = '';

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

function allow() { process.exit(0); }

function block(message) {
  process.stderr.write(message);
  if (!message.endsWith('\n')) process.stderr.write('\n');
  process.exit(2);
}

// Collect every string value of tool_input at any depth. Keys are not read.
function collectStrings(node, out, depth) {
  if (depth > MAX_DEPTH) return;
  if (typeof node === 'string') { out.push(node); return; }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) collectStrings(node[i], out, depth + 1);
    return;
  }
  if (node && typeof node === 'object') {
    const keys = Object.keys(node);
    for (let i = 0; i < keys.length; i += 1) collectStrings(node[keys[i]], out, depth + 1);
  }
}

// The guard cannot run. Record one count-only line (tool name and mode only),
// then follow the posture. The line never carries a payload byte.
function outage(toolName, mode) {
  try {
    if (fs.existsSync(OUTAGE_LOG_PATH)) {
      require(OUTAGE_LOG_PATH).recordGuardOutage(typeof toolName === 'string' ? toolName : '', mode);
    }
  } catch (_) {
    // A failing log never changes a verdict.
  }
  if (FAIL_CLOSED) {
    return block('Canon Part 8 (web lines): the credential check could not run (reason web_credential_check_unavailable). The request was blocked and nothing was sent.');
  }
  process.stderr.write('Canon Part 8 (web lines): the credential check could not run; the request was allowed.\n');
  return allow();
}

function main() {
  const raw = readStdinSync();
  if (!raw || !raw.trim()) return allow();

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (_) {
    return allow();
  }
  if (!payload || typeof payload !== 'object') return allow();

  const toolName = payload.tool_name;
  currentTool = typeof toolName === 'string' ? toolName : '';
  const toolInput = payload.tool_input;
  if (!toolInput || typeof toolInput !== 'object') return allow();

  // From here on the tool input was read: every failure is an outage branch.
  let strings;
  try {
    strings = [];
    collectStrings(toolInput, strings, 0);
  } catch (_) {
    return outage(toolName, 'hook_uncaught');
  }
  if (strings.length === 0) return allow();

  let gate;
  try {
    gate = require(GATE_PATH);
    if (!gate || typeof gate.credentialCheck !== 'function') throw new Error('credentialCheck missing');
  } catch (_) {
    return outage(toolName, 'guard_load_failed');
  }

  let result;
  try {
    result = gate.credentialCheck(strings, 'web_hook');
  } catch (_) {
    return outage(toolName, 'classify_threw');
  }

  let ok;
  try {
    if (!result || typeof result !== 'object') throw new Error('result is not an object');
    ok = result.ok;
    if (ok !== true && ok !== false) throw new Error('result.ok is not a boolean');
  } catch (_) {
    return outage(toolName, 'hook_uncaught');
  }

  if (ok === true) return allow();
  return block('Canon Part 8 (web lines): a credential-shaped value was found in the outgoing web request (reason credential_shaped). The request was blocked and nothing was sent. Remove the credential and try again.');
}

try {
  main();
} catch (_) {
  // A throw outside every branch above, after the input may have been read.
  // The class comes from the tool name when the payload was parsed. The fail
  // posture still applies.
  outage(currentTool, 'hook_uncaught');
}
