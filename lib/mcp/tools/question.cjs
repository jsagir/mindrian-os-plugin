'use strict';

// Phase 358-09 (Rome B2), the Desktop / Cowork half of the governing
// question. question_read reads, question_set writes through
// lib/core/frame-provenance.cjs, the one door; neither ever confirms or
// ranks anything. Canon Part 9: writes only through navigation.cjs via the
// door. Canon Part 8: no Brain or network call in this file. The card is
// built by the door, never here. No em-dashes.
const { z } = require('zod');
const navigation = require('../../core/navigation.cjs');
const frameProvenance = require('../../core/frame-provenance.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveSessionRoomDir } = require('../session-room.cjs');
const { hostBlock } = require('./claim-verify.cjs');

function response(payload, error) {
  const out = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (error) out.isError = true;
  return out;
}

// Every list below is BUILT from the constants, never a literal, so a
// provisional origin id or a routing example can never drift out of sync
// with lib/core/navigation/typed-frame.cjs or lib/core/frame-provenance.cjs.
const ORIGIN_IDS = navigation.FRAME_ORIGINS_ORDERED.map((o) => o.id);
const ORIGINS_INFO = navigation.FRAME_ORIGINS_ORDERED.map((o, i) => ({ id: o.id, label: o.label, position: i + 1 }));

function commaOrList(items) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return items.slice(0, -1).join(', ') + ' or ' + items[items.length - 1];
}
const ORIGIN_PHRASE = commaOrList(ORIGIN_IDS);
const ORIGIN_DESCRIPTION = 'Where the question came from: '
  + navigation.FRAME_ORIGINS_ORDERED.map((o) => o.id + ' = ' + o.label).join('; ') + '.';

function quotedList(items) {
  return items.map((p) => '"' + p + '"').join(', ');
}
const CHANGE_EXAMPLES = quotedList(frameProvenance.QUESTION_TURN_EXAMPLES.change);
const ASK_EXAMPLES = quotedList(frameProvenance.QUESTION_TURN_EXAMPLES.ask);

const QUESTION_READ_DESCRIPTION = "Show this room's governing question: where it came from ("
  + ORIGIN_PHRASE + '), when it was set, and every earlier version with its origin, time and whether '
  + 'each change refines or relocates. A waiting question change and its ask come first. Use when the '
  + 'officer asks about the room\'s question, for example ' + ASK_EXAMPLES + '. This tool writes nothing.';

const QUESTION_SET_DESCRIPTION = "Record or change this room's governing question with its origin ("
  + ORIGIN_PHRASE + "). Use when the officer states or changes the room's question, for example "
  + CHANGE_EXAMPLES + ', not for an ordinary question asked in conversation. A changed question is '
  + "recorded only with the officer's own words for what the old question got wrong (account, filed as "
  + 'refines) or the officer\'s explicit relocate (a new question, filed as relocates); without either, '
  + 'no version is recorded, the change waits as an ask and its card is returned. Both questions stay on '
  + 'the record and neither is ranked.';

const NEXT_TEXT = 'Fire the card, or on a host without AskUserQuestion ask the officer in plain words. '
  + 'Then call question_set again with the same text and origin plus account (the officer\'s own words, '
  + 'filed as refines), or relocate: true (the officer says it is a new question, filed as relocates), '
  + 'or cancel: true. Never write the account yourself.';

const NOTE_TEXT = 'Both questions stay on the record; neither is ranked.';

function register(server, ctx) {
  server.tool('question_read', QUESTION_READ_DESCRIPTION, {
    history: z.boolean().optional()
      .describe('Set false to return only the current question and any waiting change. Defaults to true.'),
  }, async (args, extra) => {
    const host = hostBlock(server, ctx);
    const sessionId = resolveEffectiveSessionId(undefined, extra);
    const roomDir = resolveSessionRoomDir(sessionId, ctx);
    const db = navigation.openRoomDbForCaller(roomDir);
    if (!db) return response({ ok: false, reason: 'no_room_db', room_dir: roomDir, host: host }, true);
    try {
      const view = frameProvenance.readGoverningQuestion(db, roomDir);
      if (!view.ok) {
        return response({ ok: false, reason: view.reason || 'read_failed', room_dir: roomDir, host: host }, true);
      }
      const includeHistory = !(args && args.history === false);
      const history = includeHistory ? frameProvenance.readQuestionHistory(db, roomDir) : null;
      return response({
        ok: true,
        room_dir: roomDir,
        pending: view.pending,
        current: view.current,
        total_versions: view.total_versions,
        versions: history ? history.versions : undefined,
        unresolved: view.unresolved,
        origins: ORIGINS_INFO,
        rendered: {
          question: frameProvenance.renderQuestionLines(view).join('\n'),
          history: history ? frameProvenance.renderHistoryLines(history).join('\n') : undefined,
        },
        note: NOTE_TEXT,
        host: host,
      });
    } finally {
      navigation.closeRoomDbForCaller(db);
    }
  });

  server.tool('question_set', QUESTION_SET_DESCRIPTION, {
    text: z.string().min(1).max(frameProvenance.MAX_QUESTION_CHARS).optional()
      .describe('The question exactly as the officer states it. Required unless cancel is true.'),
    origin: z.enum(ORIGIN_IDS).optional()
      .describe(ORIGIN_DESCRIPTION + ' Required unless cancel is true.'),
    account: z.string().min(1).max(frameProvenance.MAX_ACCOUNT_CHARS).optional()
      .describe("The officer's own words for what the old question got wrong, exactly as said; files the "
        + 'change as refines. Never write this for the officer.'),
    relocate: z.boolean().optional()
      .describe('Set true only when the officer says it is a new question; files the change as relocates. '
        + 'Never set it by default.'),
    cancel: z.boolean().optional()
      .describe('Set true to drop a waiting question change.'),
    based_on_version: z.number().int().min(1).optional()
      .describe('The version the officer was looking at; if the question changed meanwhile, nothing is recorded.'),
  }, async (args, extra) => {
    const host = hostBlock(server, ctx);
    if (!host.write_path_enabled) {
      return response({
        ok: false,
        reason: 'write_path_disabled',
        host: host,
        hint: 'This MCP host is not recognized as write-enabled. On a demo machine set '
          + 'MINDRIAN_MCP_FIRST=desktop,cowork in the MCP server env block and restart, and report '
          + 'host.client_name so it can be added to the host list.',
      }, true);
    }
    const sessionId = resolveEffectiveSessionId(undefined, extra);
    const roomDir = resolveSessionRoomDir(sessionId, ctx);
    const db = navigation.openRoomDbForCaller(roomDir);
    if (!db) return response({ ok: false, reason: 'no_room_db', room_dir: roomDir, host: host }, true);
    try {
      const params = {
        text: args && args.text,
        origin: args && args.origin,
        account: args && args.account,
        relocate: args && args.relocate,
        cancel: args && args.cancel,
        based_on_version: args && args.based_on_version,
        set_by_id: navigation.resolveByUser(roomDir),
      };
      const result = frameProvenance.setGoverningQuestion(db, roomDir, params);

      if (result.reason === 'change_needs_account') {
        const curView = frameProvenance.readGoverningQuestion(db, roomDir);
        return response({
          ok: false,
          reason: result.reason,
          ask: result.ask,
          previous: result.previous,
          proposed: result.proposed,
          options: result.options,
          pending: true,
          card: {
            shape: result.card.shape,
            header: result.card.header,
            options: result.card.options,
            askuserquestion_marker: result.card.askuserquestion_marker,
            askuserquestion_binding: result.card.askuserquestion_binding,
          },
          rendered: {
            card: result.card.rendered_text,
            question: curView.ok ? frameProvenance.renderQuestionLines(curView).join('\n') : '',
          },
          next: NEXT_TEXT,
          room_dir: roomDir,
          host: host,
        });
      }

      if (result.ok === false) {
        return response(Object.assign({ room_dir: roomDir, host: host }, result), true);
      }

      const view = frameProvenance.readGoverningQuestion(db, roomDir);
      return response({
        ok: true,
        room_dir: roomDir,
        result: result.result,
        version: result.version,
        account_text: result.account_text,
        edge: result.edge,
        question: view,
        rendered: { question: view.ok ? frameProvenance.renderQuestionLines(view).join('\n') : '' },
        note: NOTE_TEXT,
        host: host,
      });
    } finally {
      navigation.closeRoomDbForCaller(db);
    }
  });
}

// Born-wired SOURCE of truth (Part 11 R1/R16). Both tools are born wired in
// this same commit; data/mcp-tool-connectors.json, data/connector-
// registry.json and data/connector-coverage-ledger.json are regenerated by
// 358-10, never hand-edited here. F.1 not F.0 for question_set (see the
// 358-07 plan context: F.0 is closed-vocabulary Approve/Reject/Defer and
// writes its Reject reason into a graph edge property, which would put the
// officer's account prose into graph metadata against locked B2-AT4).
const connectors = [
  {
    tool: 'question_read', surface: 'question_read', connector: 'mcp-tool', hitl_shape: 'none',
    hitl_why: "Pure read of the room's governing question, its origin and its history; no fork and no write.",
    layer: 'harness', layer_why: 'Local room read through the governing-question door and the navigation chokepoint.',
  },
  {
    tool: 'question_set', surface: 'question_set', connector: 'mcp-tool', hitl_shape: 'F.1',
    hitl_why: 'A changed question is one Decision Gate card: the officer writes what the old question got '
      + 'wrong (refines), says it is a new question (relocates), or cancels.',
    layer: 'harness', layer_why: 'Local room write through the one governing-question door and the navigation chokepoint.',
  },
];

module.exports = { register, connectors };
