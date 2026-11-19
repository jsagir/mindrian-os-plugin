#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261118-vbv: the drain of the Part 8 egress telemetry queue.
 * =================================================================
 * The Part 8 PreToolUse hook (scripts/part8-egress-guard-hook.cjs) only appends
 * one line to <room>/.mindrian/part8-egress-telemetry.queue.jsonl. This script
 * writes the queued records into room.db through
 * lib/core/part8-egress-telemetry-queue.cjs drainRooms, which calls
 * part8-egress-ontology record() (every write goes through navigation.cjs).
 *
 * Triggers:
 *   --stop    scripts/on-stop pipes the Stop payload on stdin (session_id).
 *   --sweep   no stdin (scripts/gsd-graph-derive-drain.cjs starts it detached
 *             at session start, so a session without a Stop still drains).
 *   --room <dir>  drain this room (repeatable; tests and operators).
 *   --json    print 1 JSON line with the results (tests only).
 *
 * Rooms for --stop and --sweep: the session room (resolveLexiconRoom with
 * requireOwnership true, --stop only), the machine-global active room, and
 * every registry room that holds a queue file or a claim file. The rooms home
 * is the expression resolveActiveRoom uses; no new home rule.
 *
 * Exit 0 on every path. An unref'd timer exits 0 after 4000 ms. No stdout
 * without --json. Pure CJS, node built-ins and repo modules only. No em dash
 * and no en dash.
 *
 * License: BSL 1.1.
 */

const HARD_EXIT_MS = 4000;
const hardExit = setTimeout(function () { process.exit(0); }, HARD_EXIT_MS);
if (hardExit && typeof hardExit.unref === 'function') hardExit.unref();
process.on('uncaughtException', function () { process.exit(0); });
process.on('unhandledRejection', function () { process.exit(0); });

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const LIB_CORE = path.join(__dirname, '..', 'lib', 'core');
const QUEUE_PATH = path.join(LIB_CORE, 'part8-egress-telemetry-queue.cjs');
const LEXICON_PATH = path.join(LIB_CORE, 'part8-room-lexicon.cjs');
const RAR_PATH = path.join(LIB_CORE, 'resolve-active-room.cjs');

function parseArgs(argv) {
  const out = { stop: false, sweep: false, rooms: [], json: false };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--stop': out.stop = true; break;
      case '--sweep': out.sweep = true; break;
      case '--json': out.json = true; break;
      case '--room':
        if (typeof argv[i + 1] === 'string' && argv[i + 1].length > 0) { out.rooms.push(argv[i + 1]); i += 1; }
        break;
      default: break;
    }
  }
  return out;
}

function readStopSessionId() {
  try {
    if (process.stdin.isTTY) return null;
    const raw = fs.readFileSync(0, 'utf8');
    if (!raw || !raw.trim()) return null;
    const j = JSON.parse(raw);
    return (j && typeof j.session_id === 'string' && j.session_id.length > 0) ? j.session_id : null;
  } catch (_e) {
    return null;
  }
}

function roomsHome() {
  return process.env.MINDRIAN_ROOMS_HOME
    || path.join(process.env.HOME || process.env.USERPROFILE || os.homedir(), 'MindrianRooms');
}

function registryRooms(queue) {
  const out = [];
  try {
    const home = roomsHome();
    const regPath = path.join(home, '.rooms', 'registry.json');
    if (!fs.existsSync(regPath)) return out;
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    if (!reg || typeof reg !== 'object') return out;
    let slugs = [];
    if (Array.isArray(reg.rooms)) {
      slugs = reg.rooms.map(function (r) { return r && (r.slug || r.name); });
    } else if (reg.rooms && typeof reg.rooms === 'object') {
      slugs = Object.keys(reg.rooms);
    }
    const rar = require(RAR_PATH);
    slugs.forEach(function (slug) {
      if (typeof slug !== 'string' || slug.length === 0) return;
      const dir = rar.registryRoomPath(home, slug, reg);
      if (dir && queue.hasPending(dir)) out.push(dir);
    });
  } catch (_e) { /* a bad registry adds no room */ }
  return out;
}

function boundRoom(opts) {
  try {
    const r = require(LEXICON_PATH).resolveLexiconRoom(opts);
    return (r && r.status === 'bound' && typeof r.roomDir === 'string') ? r.roomDir : null;
  } catch (_e) {
    return null;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const queue = require(QUEUE_PATH);
  const rooms = args.rooms.slice();
  if (args.stop || args.sweep) {
    const sessionId = args.stop ? readStopSessionId() : null;
    if (sessionId) {
      const s = boundRoom({ sessionId: sessionId, requireOwnership: true });
      if (s) rooms.push(s);
    }
    const g = boundRoom({});
    if (g) rooms.push(g);
    registryRooms(queue).forEach(function (d) { rooms.push(d); });
  }
  const results = queue.drainRooms(rooms);
  if (args.json) process.stdout.write(JSON.stringify({ results: results }) + '\n');
}

try { main(); } catch (_e) { /* exit 0 below */ }
process.exit(0);
