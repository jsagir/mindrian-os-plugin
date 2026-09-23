#!/usr/bin/env node
'use strict';

// Phase 358-08 (Rome B2, CLI half of B2-05). scripts/room-question.cjs is a
// thin caller of lib/core/frame-provenance.cjs, the same door the MCP tools
// (358-09) call. It has zero direct database access and zero network reach:
// every write and read goes through navigation.cjs / frame-provenance.cjs.
// Every origin shown is read from navigation.FRAME_ORIGINS_ORDERED at run
// time, never a literal list here, so a provisional label can be swapped in
// one constant. This script never constructs a card itself (no direct
// dispatcher require, no shape-selection call) and never writes the
// officer's account for them: the account text passed via --account is
// printed back verbatim so the officer can see exactly what would be filed.
//
// Subcommands: origins | show | history | set | cancel | help
//
// NO em-dashes in this file (CLAUDE.md HARD RULE); hyphens only.

const path = require('node:path');

const navigation = require(path.join(__dirname, '..', 'lib', 'core', 'navigation.cjs'));
const frameProvenance = require(path.join(__dirname, '..', 'lib', 'core', 'frame-provenance.cjs'));

const BOOLEAN_FLAGS = new Set(['json', 'relocate']);

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
  out.text = out.positionals.join(' ');
  return out;
}

// ---------------------------------------------------------------------------
// usage / refusal rendering
// ---------------------------------------------------------------------------

function usageText() {
  const originIds = navigation.FRAME_ORIGINS_ORDERED.map((o) => o.id).join(', ');
  return [
    'Usage: room-question.cjs <origins|show|history|set|cancel|help> [flags]',
    '',
    '  origins [--json]                                list the origin vocabulary',
    '  show [--room <dir>] [--json]                     current question (a waiting change prints first)',
    '  history [--room <dir>] [--json]                  every version, oldest first',
    '  set [--room <dir>] --origin <id> [--account <words> | --relocate]',
    '      [--based-on <N>] [--json] <question text>    record or change the question',
    '  cancel [--room <dir>] [--json]                    cancel a waiting change',
    '',
    '  --room <dir>       room directory (else the active room)',
    '  --origin <id>      one of: ' + originIds,
    "  --account <words>  the officer's own words on what the old question got wrong",
    '  --relocate         mark the change as a new question (no account)',
    '  --based-on <N>     the version this change is based on',
    '  --json             machine-readable output',
  ].join('\n');
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

function printRefusal(result, flags) {
  if (flags.json) {
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = 1;
    return;
  }
  const reason = result.reason;
  const firstLine = (reason === 'change_needs_account' || reason === 'question_changed_meanwhile')
    ? 'x The question was not changed yet'
    : 'x Could not record the question';
  process.stderr.write(firstLine + '\n');
  process.stderr.write('  Why: ' + reason + '\n');

  if (reason === 'change_needs_account') {
    process.stderr.write('  Previous question (version ' + result.previous.version + '): ' + result.previous.text + '\n');
    process.stderr.write('  Proposed question: ' + result.proposed.text + '\n');
    process.stderr.write('  ' + frameProvenance.QUESTION_ASK + '\n');
    process.stderr.write(
      "  Fix: re-run set with --account \"<the officer's own words>\" (files as refines),"
      + ' or --relocate (files as relocates), or run cancel\n'
    );
    if (result.card && typeof result.card.rendered_text === 'string') {
      process.stdout.write(result.card.rendered_text + '\n');
    }
  } else if (reason === 'invalid_origin') {
    const ids = (Array.isArray(result.allowed) ? result.allowed : navigation.FRAME_ORIGINS_ORDERED.map((o) => o.id)).join(', ');
    process.stderr.write('  Fix: allowed origins: ' + ids + '\n');
  } else if (reason === 'ambiguous_change') {
    process.stderr.write('  Fix: pass --account or --relocate, not both\n');
  } else if (reason === 'question_changed_meanwhile') {
    process.stderr.write('  Fix: run show, then set again with --based-on <current version>\n');
  } else if (reason === 'nothing_pending') {
    process.stderr.write('  Fix: there is no waiting question change\n');
  } else if (reason === 'no_previous_question') {
    process.stderr.write('  Fix: the first question needs no --account or --relocate\n');
  } else if (reason === 'invalid_text') {
    process.stderr.write('  Fix: the question must be 1 to ' + frameProvenance.MAX_QUESTION_CHARS + ' characters\n');
  } else if (reason === 'invalid_account') {
    process.stderr.write('  Fix: the account must be at most ' + frameProvenance.MAX_ACCOUNT_CHARS + ' characters\n');
  } else {
    process.stderr.write('  Fix: check the value and try again\n');
  }
  process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// room resolution (mirrors scripts/claim-checks.cjs)
// ---------------------------------------------------------------------------

function resolveRoomDir(flags) {
  if (flags.room) {
    return flags.room;
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
// subcommands
// ---------------------------------------------------------------------------

function cmdOrigins(args) {
  const list = navigation.FRAME_ORIGINS_ORDERED.map((o, i) => ({ id: o.id, label: o.label, position: i + 1 }));
  if (args.flags.json) {
    process.stdout.write(JSON.stringify(list) + '\n');
  } else {
    list.forEach((o) => process.stdout.write(o.position + '. ' + o.id + ' - ' + o.label + '\n'));
  }
  process.exitCode = 0;
}

function cmdShow(args, db, roomDir) {
  const view = frameProvenance.readGoverningQuestion(db, roomDir);
  if (!view.ok) return printRefusal(view, args.flags);
  if (args.flags.json) {
    process.stdout.write(JSON.stringify(view) + '\n');
    process.exitCode = 0;
    return;
  }
  frameProvenance.renderQuestionLines(view).forEach((l) => process.stdout.write(l + '\n'));
  process.exitCode = 0;
}

function cmdHistory(args, db, roomDir) {
  const history = frameProvenance.readQuestionHistory(db, roomDir);
  if (!history.ok) return printRefusal(history, args.flags);
  if (args.flags.json) {
    process.stdout.write(JSON.stringify(history) + '\n');
    process.exitCode = 0;
    return;
  }
  frameProvenance.renderHistoryLines(history).forEach((l) => process.stdout.write(l + '\n'));
  process.exitCode = 0;
}

function cmdSet(args, db, roomDir) {
  const flags = args.flags;
  if (!args.text) {
    process.stderr.write(usageText() + '\n');
    process.stderr.write('Missing required: question text\n');
    process.exitCode = 2;
    return;
  }

  const params = {
    text: args.text,
    origin: flags.origin,
    set_by_id: navigation.resolveByUser(roomDir),
  };
  if (flags.account !== undefined) params.account = flags.account;
  if (flags.relocate === true) params.relocate = true;
  if (flags['based-on'] !== undefined) {
    const n = Number(flags['based-on']);
    if (Number.isInteger(n)) params.based_on_version = n;
  }

  const result = frameProvenance.setGoverningQuestion(db, roomDir, params);
  if (!result.ok) return printRefusal(result, flags);

  if (flags.json) {
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = 0;
    return;
  }

  if (result.result === 'unchanged') {
    process.stdout.write('Unchanged: the governing question is already this (version ' + result.version + ').\n');
    process.exitCode = 0;
    return;
  }

  let line;
  if (result.result === 'first') {
    line = 'Recorded: version ' + result.version + ' (first question)';
  } else if (result.result === 'refines') {
    line = 'Recorded: version ' + result.version + ' (refines version ' + (result.version - 1) + ')';
  } else {
    line = 'Recorded: version ' + result.version + ' (relocates from version ' + (result.version - 1) + ')';
  }
  process.stdout.write(line + '\n');
  if (result.result === 'refines') {
    process.stdout.write('What the old question got wrong: ' + result.account_text + '\n');
  }
  process.stdout.write('\n');

  const view = frameProvenance.readGoverningQuestion(db, roomDir);
  if (view.ok) frameProvenance.renderQuestionLines(view).forEach((l) => process.stdout.write(l + '\n'));
  process.exitCode = 0;
}

function cmdCancel(args, db, roomDir) {
  const result = frameProvenance.setGoverningQuestion(db, roomDir, { cancel: true });
  if (!result.ok) return printRefusal(result, args.flags);
  if (args.flags.json) {
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = 0;
    return;
  }
  process.stdout.write('The waiting question change was cancelled.\n');
  process.exitCode = 0;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main(argv) {
  const args = parseArgs(argv || process.argv.slice(2));
  const sub = args.sub;

  if (!sub) {
    process.stderr.write(usageText() + '\n');
    process.exitCode = 2;
    return;
  }
  if (sub === 'help') {
    process.stdout.write(usageText() + '\n');
    process.exitCode = 0;
    return;
  }

  switch (sub) {
    case 'origins':
      return cmdOrigins(args);
    case 'show':
      return withRoomHandle(args, cmdShow);
    case 'history':
      return withRoomHandle(args, cmdHistory);
    case 'set':
      return withRoomHandle(args, cmdSet);
    case 'cancel':
      return withRoomHandle(args, cmdCancel);
    default:
      process.stderr.write(usageText() + '\n');
      process.exitCode = 2;
  }
}

module.exports = { main, parseArgs };

if (require.main === module) {
  main(process.argv.slice(2));
}
