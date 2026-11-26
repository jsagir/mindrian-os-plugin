#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick(admin-gate-hardening) -- the HARD admin-command gate (UserPromptSubmit).
 * ============================================================================
 * The admin-gated commands (visibility: admin) were protected ONLY by prose in
 * the command body telling Larry to re-derive identity. This hook is the CODE
 * enforcement that runs BEFORE Larry ever sees the command body.
 *
 * Why UserPromptSubmit (not PreToolUse:SlashCommand):
 *   When a customer TYPES `/mos:admin`, Claude Code expands the slash command
 *   client-side into the prompt. It does NOT route through the SlashCommand
 *   tool (that only fires when Larry programmatically invokes a command via the
 *   tool). A PreToolUse:SlashCommand matcher would therefore MISS the primary
 *   threat -- a human typing the admin command. UserPromptSubmit fires on the
 *   raw prompt text before the body is expanded; exit 2 hard-blocks it and shows
 *   stderr to the user.
 *
 * Signaling (clone of scripts/write-scope-check.cjs):
 *   exit 2 = BLOCK (Claude Code drops the prompt), stderr carries the 3-line
 *            "Command not found" render.
 *   exit 0 = ALLOW. Emitted on a non-admin-gated prompt, an admin who passes the
 *            identity check, OR any parse / internal error (fail-OPEN -- the
 *            defense-in-depth prose in the command body remains as the backstop,
 *            matching the shipped safety-hook posture).
 *
 * Scope discipline: the admin-command set is derived at run time by scanning
 * commands/*.md FRONTMATTER (only the first --- ... --- block) for
 * `visibility: admin`. An ordinary command can NEVER be blocked by this gate --
 * the gate never over-reaches beyond the actual visibility:admin surfaces.
 *
 * Canon Part 8: LOCAL only. No wire, no Brain call. Pure CJS, zero npm deps.
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

const { checkAdminIdentity } = require('./check-admin-identity.cjs');
const { HookExit, makeSink, finishCli } = require('../lib/core/hook-io.cjs');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands');

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

// Phase 400.4 plan 12: allow() and block() no longer touch the process. They write to the run sink and throw HookExit,
// which run() catches. The CLI main at the bottom sends the result to the process streams and exits.
function allow() { throw new HookExit(0); }

// block -- render the 3-line "Command not found" error to the sink (stderr) and exit 2.
// Mirrors the exact prose the command bodies used to render, so the user-facing
// message is identical whether the code gate or the prose fallback fires.
function block(sink, commandName) {
  const msg =
    'x Command not found: ' + commandName + '\n' +
    '  Why: Not an admin user\n' +
    '  Fix: /mos:help';
  sink.err(msg + '\n');
  throw new HookExit(2);
}

// extractFrontmatter -- return the text of the FIRST --- ... --- YAML block, or
// '' if none. We deliberately scan the frontmatter block ONLY: help.md mentions
// `visibility: admin` in its BODY (it is the command that hides admin commands),
// and matching body text would wrongly gate /mos:help. Frontmatter-only parsing
// is the scope fence.
function extractFrontmatter(text) {
  if (typeof text !== 'string') return '';
  // Must open with --- on the very first line (allow a leading BOM/whitespace).
  const m = text.match(/^﻿?\s*---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  return m ? m[1] : '';
}

// isAdminFrontmatter -- true only if the frontmatter block carries a top-level
// `visibility: admin` key (tolerant of quotes + trailing comments).
function isAdminFrontmatter(fm) {
  if (!fm) return false;
  const lines = fm.split(/\r?\n/);
  for (const line of lines) {
    const mm = line.match(/^\s*visibility\s*:\s*["']?admin["']?\s*(#.*)?$/);
    if (mm) return true;
  }
  return false;
}

// loadAdminCommandNames -- scan commands/*.md and return the set of base command
// names (filename without .md) whose frontmatter declares visibility: admin.
// NEVER throws: an unreadable dir yields an empty set (fail-open).
function loadAdminCommandNames(dir) {
  const names = new Set();
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (_) {
    return names;
  }
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    let text;
    try {
      text = fs.readFileSync(path.join(dir, entry), 'utf8');
    } catch (_) {
      continue;
    }
    if (isAdminFrontmatter(extractFrontmatter(text))) {
      names.add(entry.slice(0, -3)); // strip .md
    }
  }
  return names;
}

// detectInvokedCommand -- if the prompt is a LEADING slash-command invocation,
// return the base command name (namespace + args stripped); else null. Matches
// `/mos:admin`, `/mos:admin keys`, and the bare `/admin` form. Only a LEADING
// token counts: a mention of `/mos:admin` mid-sentence is not an invocation and
// must not be gated.
function detectInvokedCommand(prompt) {
  if (typeof prompt !== 'string') return null;
  const trimmed = prompt.replace(/^﻿/, '').trimStart();
  // /namespace:name  or  /name  -- capture the final :-separated segment.
  const m = trimmed.match(/^\/([A-Za-z0-9_-]+(?::[A-Za-z0-9_-]+)*)/);
  if (!m) return null;
  const full = m[1];
  const parts = full.split(':');
  return parts[parts.length - 1]; // 'mos:admin' -> 'admin', 'admin' -> 'admin'
}

function main(raw, sink) {
  if (!raw || !raw.trim()) return allow();

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (_) {
    return allow(); // fail-open on a non-JSON payload
  }
  if (!payload || typeof payload !== 'object') return allow();

  const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';
  if (!prompt) return allow();

  const invoked = detectInvokedCommand(prompt);
  if (!invoked) return allow(); // not a leading slash-command invocation

  const adminCommands = loadAdminCommandNames(COMMANDS_DIR);
  if (!adminCommands.has(invoked)) return allow(); // ordinary command: NEVER gated

  // The prompt invokes an admin-gated command. Run the deterministic identity
  // check. Only a REAL non-admin hit blocks (fail-closed); any internal error in
  // the checker falls open to the prose backstop.
  let verdict;
  try {
    verdict = checkAdminIdentity();
  } catch (_) {
    return allow();
  }
  if (verdict && verdict.admin === false) {
    return block(sink, invoked);
  }
  return allow();
}

// run(input, opts) -- the in-process entry point (Phase 400.4 plan 12, QA-F11 part B base).
// input is the raw stdin text. opts is {argv, deadlineAt} and is not used by this hook. Resolves {code, stdout, stderr}.
// Never calls process.exit, never reads fd 0, never writes to the process streams, never rejects.
// Fail-open: any unexpected error resolves code 0 with no output, as the CLI always did.
async function run(input, opts) { // eslint-disable-line no-unused-vars
  const sink = makeSink();
  try {
    main(typeof input === 'string' ? input : '', sink);
    return sink.take(0);
  } catch (e) {
    if (e instanceof HookExit) return sink.take(e.code);
    // Fail-open on any unexpected error: the command-body prose remains as the
    // defense-in-depth backstop.
    return makeSink().take(0);
  }
}

module.exports = { run };

if (require.main === module) {
  run(readStdinSync(), { argv: process.argv.slice(2) }).then(finishCli);
}
