'use strict';

// Phase 358-04 (Rome B1, wave 3): the Desktop/Cowork MCP half of the
// checking-record surface. claim_verify appends ONE local checking record to
// an existing claim (what it was checked against, the rung, the method, the
// result); claim_read reopens a claim by id or by words and shows the
// checking record beside the confirmation status, plus a room-wide list and
// the room portrait (checked / disputed / inconclusive / unchecked counts).
// NEITHER tool ever confirms a claim: only a person, through gate_answer
// approve (lib/mcp/tools/gate.cjs, untouched by this file), moves
// review_status. Canon Part 9: both handlers reach room.db only through
// lib/core/navigation.cjs. Canon Part 8: no Brain/network call in this file.
// No em-dashes; hyphens only.
const { z } = require('zod');
const navigation = require('../../core/navigation.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { isWritePathEnabled } = require('../mcp-first-flag.cjs');
const { resolveSessionRoomDir } = require('../session-room.cjs');
const { detectHostTier } = require('../surface-detect.cjs');

function response(payload, error) {
  const out = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (error) out.isError = true;
  return out;
}

// hostBlock(server, ctx) -- the live client-name probe the 6 October runbook
// uses to learn a new host's clientInfo.name before it can be added to
// lib/mcp/surface-detect.cjs's HOST_TIER_MAP. Read the same way the write
// gate already reads it (server.server.getClientVersion()), so this is never
// a second detection path.
function hostBlock(server, ctx) {
  const clientVersion = server && server.server && typeof server.server.getClientVersion === 'function'
    ? server.server.getClientVersion() : undefined;
  const tier = detectHostTier(clientVersion);
  return {
    client_name: (clientVersion && typeof clientVersion.name === 'string')
      ? clientVersion.name.slice(0, 64) : null,
    host: tier.host,
    host_tier: tier.hostTier,
    write_path_enabled: isWritePathEnabled({ surface: ctx && ctx.surface, clientVersion: clientVersion }),
  };
}

// RUNG_DESCRIPTION -- generated from the ONE ordered VERIFICATION_RUNGS
// constant (lib/core/navigation/verification.cjs), never a second literal
// list. Swapping the paper author's final rung list stays a one-constant
// edit; this description regenerates itself from that same constant.
const RUNG_DESCRIPTION = 'Rung of the verification hierarchy the check reached, 1 is lowest: ' +
  navigation.VERIFICATION_RUNGS.map((r, i) => (i + 1) + ' = ' + r.label).join('; ') + '.';

const CLAIM_VERIFY_DESCRIPTION = "Record, on one local claim, what it was checked against, the rung it " +
  "reached, the method and the result. The claim's review_status never changes: a checked claim stays " +
  'proposed until a person approves it through gate_answer. Use claim_read first to find the claim_id.';

const CLAIM_READ_DESCRIPTION = "Reopen one local claim by id or by words from its text and show its " +
  'checking record beside its confirmation status (review_status), or list the room\'s claims. Every call ' +
  "also returns the room's counts of checked, disputed, inconclusive and unchecked claims; a count is not " +
  'a verdict. This tool writes nothing.';

function register(server, ctx) {
  server.tool('claim_verify', CLAIM_VERIFY_DESCRIPTION, {
    claim_id: z.string().min(1).max(512)
      .describe('Id of the existing claim node this check is recorded on.'),
    against_id: z.string().min(1).max(512)
      .describe('A handle naming what the claim was checked against (a document, an artifact, a person).'),
    against_kind: z.enum(Array.from(navigation.VERIFICATION_AGAINST_KINDS))
      .describe('The kind of thing checked against.'),
    method: z.enum(Array.from(navigation.VERIFICATION_METHODS))
      .describe('How the check was carried out.'),
    result: z.enum(Array.from(navigation.VERIFICATION_RESULTS))
      .describe('What the check found.'),
    rung: z.number().int().min(1).max(navigation.VERIFICATION_RUNGS.length)
      .describe(RUNG_DESCRIPTION),
    checked_by: z.enum(['user', 'system']).optional()
      .describe('Who performed the check. Defaults to user.'),
    checked_at: z.string().max(64).optional()
      .describe('Optional ISO timestamp of the check. Defaults to now.'),
    note_handle: z.string().max(512).optional()
      .describe('Optional handle to a free-form note artifact about this check; claim prose never rides here.'),
    resolves_dispute: z.boolean().optional()
      .describe('Set true only when the person explicitly says this check answers an earlier contradiction ' +
        'on this claim. Requires checked_by user.'),
  }, async (args, extra) => {
    const host = hostBlock(server, ctx);
    if (!host.write_path_enabled) {
      return response({
        ok: false,
        reason: 'write_path_disabled',
        host: host,
        hint: 'This MCP host is not recognized as write-enabled. On a demo machine set ' +
          'MINDRIAN_MCP_FIRST=desktop,cowork in the MCP server env block and restart, and report ' +
          'host.client_name so it can be added to the host list.',
      }, true);
    }
    const sessionId = resolveEffectiveSessionId(undefined, extra);
    const roomDir = resolveSessionRoomDir(sessionId, ctx);
    const db = navigation.openRoomDbForCaller(roomDir);
    if (!db) return response({ ok: false, reason: 'no_room_db', room_dir: roomDir }, true);
    try {
      const params = Object.assign({}, args);
      // Who checked (navigator ruling): stamped server-side from the room's
      // own USER.md, never accepted as a tool input (not in the schema
      // above, so zod strips any client-supplied checked_by_id first).
      if (params.checked_by !== 'system') {
        params.checked_by_id = navigation.resolveByUser(roomDir);
      }
      const result = navigation.recordClaimVerification(db, params);
      if (result.ok === false) {
        return response(Object.assign({ room_dir: roomDir }, result), true);
      }
      const view = navigation.readClaimVerification(db, result.claim_id);
      const claim = view.ok ? view.claim : null;
      const rendered = claim ? navigation.renderClaimViewLines(claim).join('\n') : '';
      return response({
        room_dir: roomDir,
        ok: true,
        claim_id: result.claim_id,
        review_status: result.review_status,
        verification: result.verification,
        claim: claim,
        rendered: rendered,
      });
    } finally {
      navigation.closeRoomDbForCaller(db);
    }
  });

  // claim_read -- unconditional read, no write gate (the same pattern
  // graph_query and room_search already use). It reopens a claim by id or
  // by words, or lists the room's claims, and always includes the room
  // portrait so the counts are one call away.
  server.tool('claim_read', CLAIM_READ_DESCRIPTION, {
    claim_id: z.string().min(1).max(512).optional()
      .describe('Exact claim id to reopen. When absent, query or a bare list is used instead.'),
    query: z.string().min(1).max(200).optional()
      .describe('Case-insensitive words from the claim text (or its id) to search for, so a claim can be ' +
        'reopened in a new session without knowing its id.'),
    limit: z.number().int().min(1).max(100).optional()
      .describe('Max claims returned when listing (default 20, max 100).'),
  }, async (args, extra) => {
    const host = hostBlock(server, ctx);
    const sessionId = resolveEffectiveSessionId(undefined, extra);
    const roomDir = resolveSessionRoomDir(sessionId, ctx);
    const db = navigation.openRoomDbForCaller(roomDir);
    if (!db) return response({ ok: false, reason: 'no_room_db', room_dir: roomDir, host: host }, true);
    try {
      const portrait = navigation.readVerificationPortrait(db);
      const rendered = { portrait: navigation.renderVerificationPortraitLines(portrait).join('\n') };
      const rungs = navigation.VERIFICATION_RUNGS.map((r, i) => ({ rung: i + 1, id: r.id, label: r.label }));
      const note = 'Checked is not confirmed. Only a person confirms a claim, through gate_answer approve.';

      if (args && args.claim_id) {
        const view = navigation.readClaimVerification(db, args.claim_id);
        if (!view.ok) {
          return response({
            ok: false, reason: 'claim_not_found', room_dir: roomDir,
            portrait: portrait, rendered: rendered, rungs: rungs, note: note, host: host,
          }, true);
        }
        rendered.claim = navigation.renderClaimViewLines(view.claim).join('\n');
        return response({
          ok: true, room_dir: roomDir, portrait: portrait, claim: view.claim,
          rendered: rendered, rungs: rungs, note: note, host: host,
        });
      }

      const listResult = navigation.listClaimsForChecking(db, {
        query: args && args.query, limit: args && args.limit,
      });
      rendered.claims = navigation.renderClaimListLines(listResult.claims).join('\n');
      const payload = {
        ok: true, room_dir: roomDir, portrait: portrait,
        claims: listResult.claims, total_matched: listResult.total_matched,
        rendered: rendered, rungs: rungs, note: note, host: host,
      };
      if (listResult.total_matched === 1 && listResult.claims[0]) {
        const singleView = navigation.readClaimVerification(db, listResult.claims[0].claim_id);
        if (singleView.ok) {
          payload.claim = singleView.claim;
          rendered.claim = navigation.renderClaimViewLines(singleView.claim).join('\n');
        }
      }
      return response(payload);
    } finally {
      navigation.closeRoomDbForCaller(db);
    }
  });
}

// Born-wired SOURCE of truth (Part 11 R1/R16). claim_verify keeps its
// pre-existing F.1 entry byte-unchanged (only its description and schema
// changed above); claim_read is born wired here in the same commit, with a
// 'none' hitl_shape (a pure read, no fork). data/mcp-tool-connectors.json
// and data/connector-registry.json are regenerated by 358-05, never
// hand-edited here.
const connectors = [
  {
    tool: 'claim_verify', surface: 'claim_verify', connector: 'mcp-tool', hitl_shape: 'F.1',
    hitl_why: 'Records local verification metadata on a claim; it never promotes truth state.',
    layer: 'harness', layer_why: 'Local graph bookkeeping write through the navigation chokepoint.',
  },
  {
    tool: 'claim_read', surface: 'claim_read', connector: 'mcp-tool', hitl_shape: 'none',
    hitl_why: 'Pure read of local claims, their checking records and the room counts; no fork and no write.',
    layer: 'harness', layer_why: 'Local graph read through the navigation chokepoint.',
  },
];

module.exports = { register, connectors };
