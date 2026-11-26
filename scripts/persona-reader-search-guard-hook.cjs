#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 400.2.1 (S5): the reader search guard of /mos:persona deep mode.
 * ==========================================================================
 * Owner ruling 2026-11-26: "A: screen with a hook". It overrides owner answer
 * second-1 of Phase 400.2 for the hat reader search only. The credential guard
 * (scripts/web-credential-guard-hook.cjs) does not change.
 *
 * While a deep run is open (a live marker exists under
 * <MINDRIAN_HOME or ~/.mindrian>/persona-hats/reader-search/), this hook
 * screens the query of each WebSearch call and the url of each WebFetch call
 * with the door identity screen of the room of that run (the content fence,
 * then the room identity words: venture name, room directory, team files and
 * the proper nouns of the reading list). A hit blocks the call before the text
 * leaves the machine. run-research writes the marker, merge removes it, and a
 * marker older than 2 hours is stale and is removed, so a crashed run does not
 * screen forever.
 *
 * The marker does not name the subagent, so while a run is open the hook
 * screens every WebSearch and WebFetch call of this machine (ASSUMED: the hook
 * input has no reliable field that names the subagent).
 *
 * For WebFetch the path and the query of the url are screened, raw and decoded
 * (plus to a space, then decodeURIComponent); the host is not screened, and a
 * closed list of well-known organisation and vendor words is skipped.
 *
 * Owner ruling 2026-11-26: "Fail closed, plus an off switch". hooks.json gives
 * this hook onFailure block, and the off switch is the door subcommand
 *   node scripts/persona-hats.cjs disarm-reader-screen [--run <run_id>]
 *
 * Signaling:
 *   exit 0 = ALLOW: no live marker, a tool that is not WebSearch or WebFetch,
 *            no text to screen, or the text passes the screen.
 *   exit 2 = BLOCK: the text holds a room detail (reason room_identity_word or
 *            egress_violation), or the screen could not run while a marker
 *            file exists (reason reader_search_screen_unavailable, fail closed).
 * The message names the reason, the run id and the off switch. It never prints
 * the text or a screen token.
 *
 * Require graph: node built-ins and lib/core/persona-reader-screen.cjs only
 * (which loads rs-egress-prompts.cjs for the content fence). The hook does not
 * load the door.
 *
 * The hook opens no network connection. It reads local files only and removes
 * stale markers. No em-dashes.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCREEN_PATH = path.join(__dirname, '..', 'lib', 'core', 'persona-reader-screen.cjs');

function homeDir() {
  return process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian');
}

function allow() { process.exit(0); }

function block(reason, runId) {
  const run = typeof runId === 'string' && /^\d{8}-\d{6}-[0-9a-f]{4}$/.test(runId) ? runId : '<run_id>';
  process.stderr.write('Canon Part 8 (hat reader search, run ' + run + '): the search text holds a room detail or could not be screened (reason ' + reason + '). The request was blocked and nothing was sent. Search with general words of the field, with no venture name, person name, figure or other room detail. To stop this screen, run: node "' + path.join(__dirname, 'persona-hats.cjs') + '" disarm-reader-screen --run ' + run + '\n');
  process.exit(2);
}

function main() {
  let raw = '';
  try { raw = fs.readFileSync(0, 'utf8'); } catch (_) { raw = ''; }
  if (!raw || !raw.trim()) return allow();
  let payload;
  try { payload = JSON.parse(raw); } catch (_) { return allow(); }
  if (!payload || typeof payload !== 'object') return allow();
  const tool = payload.tool_name;
  const input = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : null;
  let text = null;
  if (tool === 'WebSearch' && input && typeof input.query === 'string') text = input.query;
  else if (tool === 'WebFetch' && input && typeof input.url === 'string') text = input.url;
  if (text === null || text.length === 0) return allow();

  // Fast path: no marker directory or no marker file means no open run. The door is not loaded.
  const dir = path.join(homeDir(), 'persona-hats', 'reader-search');
  let names = [];
  try { names = fs.readdirSync(dir).filter((n) => n.endsWith('.json')); } catch (_) { return allow(); }
  if (names.length === 0) return allow();

  let verdict;
  try {
    const screen = require(SCREEN_PATH);
    verdict = screen.readerSearchVerdict(tool, text, homeDir(), new Date());
  } catch (_) {
    return block('reader_search_screen_unavailable', null);
  }
  if (!verdict || typeof verdict.block !== 'boolean') return block('reader_search_screen_unavailable', null);
  if (verdict.block) return block(String(verdict.reason || 'room_identity_word'), verdict.run_id);
  return allow();
}

try {
  main();
} catch (_) {
  block('reader_search_screen_unavailable', null);
}
