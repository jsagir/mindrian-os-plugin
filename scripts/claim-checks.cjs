#!/usr/bin/env node
'use strict';

// Phase 358 B1 CLI for the checking record.
//
// One thin caller of lib/core/navigation.cjs -- the same functions the
// claim_verify / claim_read MCP tools call (Canon Part 9: one write door).
// This script has zero direct database access and zero remote-graph reach
// (Canon Part 8): no network egress, no direct SQL substrate require, only
// the two navigation-owned caller-handle functions below. Every option list
// (rungs, against-kinds, methods, results) is read from navigation.cjs at
// run time, so swapping the provisional rung list is a one-constant edit in
// verification.cjs, never a change here.
//
// Subcommands: rungs | options | portrait | list | show | record | help
//
// NO em-dashes in this file (CLAUDE.md HARD RULE); hyphens only.

const fs = require('node:fs');
const path = require('node:path');

const navigation = require(path.join(__dirname, '..', 'lib', 'core', 'navigation.cjs'));

const BOOLEAN_FLAGS = new Set(['json', 'resolves-dispute']);
const REQUIRED_RECORD_FLAGS = ['claim', 'against', 'against-kind', 'rung', 'method', 'result'];

// ---------------------------------------------------------------------------
// argv parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const list = Array.isArray(argv) ? argv : [];
  const out = { sub: list.length > 0 ? list[0] : null, flags: {}, positionals: [] };
  for (let i = 1; i < list.length; i += 1) {
    const tok = list[i];
    if (typeof tok === 'string' && tok.indexOf('--') === 0) {
      const name = tok.slice(2);
      if (BOOLEAN_FLAGS.has(name)) {
        out.flags[name] = true;
      } else {
        const val = list[i + 1];
        out.flags[name] = val !== undefined ? val : '';
        i += 1;
      }
    } else {
      out.positionals.push(tok);
    }
  }
  out.ref = out.positionals.join(' ');
  return out;
}

// ---------------------------------------------------------------------------
// usage / refusal rendering (allowed values always pulled from navigation)
// ---------------------------------------------------------------------------

function usageText() {
  const rungLines = navigation.VERIFICATION_RUNGS.map((r, i) => (i + 1) + ' = ' + r.label).join('; ');
  const lines = [
    'Usage: claim-checks.cjs <rungs|options|portrait|list|show|record|help> [flags]',
    '',
    '  rungs [--json]                 list the rung ladder',
    '  options                        print the four option lists as JSON',
    '  portrait [--room <dir>] [--json]           room counts by state',
    '  list [--room <dir>] [--query <q>] [--limit N] [--json]   claim list',
    '  show [--room <dir>] <id-or-words> [--json]                claim view',
    '  record [--room <dir>] --claim <id-or-words> --against <text>',
    '         --against-kind <kind> --rung <n> --method <m> --result <r>',
    '         [--note-handle <h>] [--resolves-dispute] [--json]',
    '',
    '  --room <dir>        room directory (else the active room)',
    '  --against-kind <k>  one of: ' + Array.from(navigation.VERIFICATION_AGAINST_KINDS).join(', '),
    '  --rung <n>          one of: ' + rungLines,
    '  --method <m>        one of: ' + Array.from(navigation.VERIFICATION_METHODS).join(', '),
    '  --result <r>        one of: ' + Array.from(navigation.VERIFICATION_RESULTS).join(', '),
    '  --note-handle <h>   optional free-form note artifact handle',
    '  --resolves-dispute  only after an explicit person Yes to the resolve question',
    '  --json              machine-readable output',
  ];
  return lines.join('\n');
}

function printUsage() {
  process.stdout.write(usageText() + '\n');
}

const REFUSAL_HINTS = {
  invalid_rung: () => 'allowed rungs: ' + navigation.VERIFICATION_RUNGS.map((r, i) => (i + 1) + '=' + r.label).join(', '),
  invalid_method: () => 'allowed methods: ' + Array.from(navigation.VERIFICATION_METHODS).join(', '),
  invalid_against_kind: () => 'allowed against-kind values: ' + Array.from(navigation.VERIFICATION_AGAINST_KINDS).join(', '),
  invalid_result: () => 'allowed results: ' + Array.from(navigation.VERIFICATION_RESULTS).join(', '),
  no_dispute_to_resolve: () => 'this claim has no open dispute to resolve; drop --resolves-dispute',
  resolution_requires_person: () => 'only a person (checked_by user) can resolve a dispute',
  invalid_resolution: () => 'a resolving record cannot itself carry a contradicts result',
  claim_not_found: () => 'check the claim id or use fewer/different words',
};

function printRefusal(title, reason, flags, extra) {
  if (flags.json) {
    const out = Object.assign({ ok: false, reason: reason }, extra || {});
    process.stdout.write(JSON.stringify(out) + '\n');
    process.exitCode = 1;
    return;
  }
  process.stderr.write('x ' + title + '\n');
  process.stderr.write('  Why: ' + reason + '\n');
  const hint = REFUSAL_HINTS[reason] ? REFUSAL_HINTS[reason]() : 'check the value and try again';
  process.stderr.write('  Fix: ' + hint + '\n');
  if (extra && Array.isArray(extra.candidates)) {
    navigation.renderClaimListLines(extra.candidates).forEach((l) => process.stderr.write(l + '\n'));
  }
  process.exitCode = 1;
}

function printNoRoom(flags) {
  if (flags.json) {
    process.stdout.write(JSON.stringify({ ok: false, reason: 'no_room' }) + '\n');
    process.exitCode = 1;
    return;
  }
  process.stderr.write('x No Data Room found\n');
  process.stderr.write('  Why: no --room given and no active room in the MindrianRooms registry\n');
  process.stderr.write('  Fix: /mos:new-project, or pass --room <dir>\n');
  process.exitCode = 1;
}

function usageError(missing) {
  process.stderr.write(usageText() + '\n');
  process.stderr.write('Missing required: --' + missing.join(', --') + '\n');
  process.exitCode = 2;
}

// ---------------------------------------------------------------------------
// room resolution
// ---------------------------------------------------------------------------

function resolveRoomDir(flags) {
  if (flags.room) {
    const resolved = path.resolve(flags.room);
    try {
      if (fs.statSync(resolved).isDirectory()) return resolved;
    } catch (_e) {
      return null;
    }
    return null;
  }
  const active = navigation.detectActiveRoom();
  return active && active.roomDir ? active.roomDir : null;
}

function withRoomHandle(args, fn) {
  const roomDir = resolveRoomDir(args.flags);
  if (!roomDir) return printNoRoom(args.flags);
  const db = navigation.openRoomDbForCaller(roomDir);
  if (!db) return printNoRoom(args.flags);
  try {
    fn(args, db, roomDir);
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

// ---------------------------------------------------------------------------
// claim reference resolution (id or free-text words)
// ---------------------------------------------------------------------------

function resolveClaimRef(db, ref) {
  if (typeof ref === 'string' && ref.indexOf('claim:') === 0) {
    const view = navigation.readClaimVerification(db, ref);
    if (!view.ok) return { ok: false, reason: 'claim_not_found' };
    return { ok: true, claim_id: ref };
  }
  const result = navigation.listClaimsForChecking(db, { query: ref, limit: 100 });
  const matched = (result && result.claims) || [];
  if (matched.length === 0) return { ok: false, reason: 'claim_not_found' };
  if (matched.length > 1) return { ok: false, reason: 'ambiguous_claim', candidates: matched };
  return { ok: true, claim_id: matched[0].claim_id };
}

function handleResolveFailure(resolved, flags) {
  if (resolved.reason === 'ambiguous_claim') {
    printRefusal('More than one claim matches', resolved.reason, flags, { candidates: resolved.candidates });
  } else {
    printRefusal('Claim not found', resolved.reason, flags);
  }
}

// ---------------------------------------------------------------------------
// subcommands
// ---------------------------------------------------------------------------

function cmdRungs(args) {
  const rungs = navigation.VERIFICATION_RUNGS;
  if (args.flags.json) {
    process.stdout.write(JSON.stringify(rungs.map((r, i) => ({ rung: i + 1, id: r.id, label: r.label }))) + '\n');
  } else {
    rungs.forEach((r, i) => process.stdout.write((i + 1) + '. ' + r.label + '\n'));
  }
  process.exitCode = 0;
}

function cmdOptions() {
  const out = {
    rungs: navigation.VERIFICATION_RUNGS,
    against_kinds: Array.from(navigation.VERIFICATION_AGAINST_KINDS),
    methods: Array.from(navigation.VERIFICATION_METHODS),
    results: Array.from(navigation.VERIFICATION_RESULTS),
  };
  process.stdout.write(JSON.stringify(out) + '\n');
  process.exitCode = 0;
}

function cmdPortrait(args, db, roomDir) {
  const portrait = navigation.readVerificationPortrait(db);
  if (args.flags.json) {
    process.stdout.write(JSON.stringify({ ok: true, room_dir: roomDir, portrait: portrait }) + '\n');
  } else {
    navigation.renderVerificationPortraitLines(portrait).forEach((l) => process.stdout.write(l + '\n'));
  }
  process.exitCode = 0;
}

function cmdList(args, db, roomDir) {
  const query = typeof args.flags.query === 'string' ? args.flags.query : '';
  let limit = 20;
  if (args.flags.limit !== undefined) {
    const n = Number(args.flags.limit);
    if (Number.isInteger(n)) limit = n;
  }
  const result = navigation.listClaimsForChecking(db, { query: query, limit: limit });
  if (args.flags.json) {
    process.stdout.write(JSON.stringify({
      ok: true, room_dir: roomDir, total_matched: result.total_matched, claims: result.claims,
    }) + '\n');
  } else {
    navigation.renderClaimListLines(result.claims).forEach((l) => process.stdout.write(l + '\n'));
    process.stdout.write('showing ' + result.claims.length + ' of ' + result.total_matched + ' claims\n');
  }
  process.exitCode = 0;
}

function cmdShow(args, db, roomDir) {
  if (!args.ref) return usageError(['ref']);
  const resolved = resolveClaimRef(db, args.ref);
  if (!resolved.ok) return handleResolveFailure(resolved, args.flags);
  const view = navigation.readClaimVerification(db, resolved.claim_id);
  if (!view.ok) return printRefusal('Claim not found', view.reason, args.flags);
  if (args.flags.json) {
    process.stdout.write(JSON.stringify({ ok: true, room_dir: roomDir, claim: view.claim }) + '\n');
  } else {
    navigation.renderClaimViewLines(view.claim).forEach((l) => process.stdout.write(l + '\n'));
  }
  process.exitCode = 0;
}

function cmdRecord(args, db, roomDir) {
  const missing = REQUIRED_RECORD_FLAGS.filter((f) => args.flags[f] === undefined);
  if (missing.length > 0) return usageError(missing);

  const resolved = resolveClaimRef(db, args.flags.claim);
  if (!resolved.ok) return handleResolveFailure(resolved, args.flags);

  const params = {
    claim_id: resolved.claim_id,
    against_id: args.flags.against,
    against_kind: args.flags['against-kind'],
    method: args.flags.method,
    result: args.flags.result,
    rung: Number(args.flags.rung),
    checked_by: 'user',
    checked_by_id: navigation.resolveByUser(roomDir),
    resolves_dispute: args.flags['resolves-dispute'] === true,
  };
  if (args.flags['note-handle'] !== undefined) params.note_handle = args.flags['note-handle'];

  const result = navigation.recordClaimVerification(db, params);
  if (!result.ok) return printRefusal('Check not recorded', result.reason, args.flags);

  const view = navigation.readClaimVerification(db, resolved.claim_id);
  if (args.flags.json) {
    process.stdout.write(JSON.stringify({
      ok: true, room_dir: roomDir, claim_id: resolved.claim_id,
      review_status: result.review_status, claim: view.ok ? view.claim : null,
    }) + '\n');
  } else {
    process.stdout.write('Recorded a check on this claim. Its confirmation status did not change.\n');
    if (view.ok) navigation.renderClaimViewLines(view.claim).forEach((l) => process.stdout.write(l + '\n'));
  }
  process.exitCode = 0;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main(argv) {
  const args = parseArgs(argv || process.argv.slice(2));
  const sub = args.sub;

  if (!sub) {
    printUsage();
    process.exitCode = 2;
    return;
  }
  if (sub === 'help') {
    printUsage();
    process.exitCode = 0;
    return;
  }

  switch (sub) {
    case 'rungs':
      return cmdRungs(args);
    case 'options':
      return cmdOptions(args);
    case 'portrait':
      return withRoomHandle(args, cmdPortrait);
    case 'list':
      return withRoomHandle(args, cmdList);
    case 'show':
      return withRoomHandle(args, cmdShow);
    case 'record':
      return withRoomHandle(args, cmdRecord);
    default:
      printUsage();
      process.exitCode = 2;
  }
}

module.exports = { main, parseArgs };

if (require.main === module) {
  main(process.argv.slice(2));
}
