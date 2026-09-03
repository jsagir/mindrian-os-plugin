'use strict';
// Phase 270-11 (MEMOP-08) -- identity_write, the first writer anywhere in
// this repo for ~/.mindrian-user.md.
//
// THE CORRECTION (RESEARCH.md 4.3). The MECHANISM already existed.
// writeUserMdAtomic (lib/core/user-md-ops.cjs:442) takes an ABSOLUTE path
// and has ZERO room coupling (negative grep for roomDir/ROOM.md/
// MindrianRooms against that file returns nothing). The read side was
// already wired at lib/core/user-archetype.cjs:64, which reads
// ~/.mindrian-user.md as its third archetype-detection fallback -- and
// reads it as raw TEXT (a full-file regex scan for archetype-indicating
// words), not a frontmatter-field parser, so it does not care which exact
// field this tool populates as long as an identifying word lands somewhere
// in the file. Home-directory atomic writes are precedented at roughly 20
// sites, including lib/core/scratchpad-ops.cjs:302-303 and
// lib/core/persona-override.cjs:189-215. What was missing was a CALLER.
// This file is that caller. It builds no new writer.
//
// CROSS-PHASE NOTE. Cross-references Phase 267.2 W2 (GAP I-1) so that phase
// does not build a redundant mechanism -- see 270-11-SUMMARY.md's
// "Cross-reference: Phase 267.2 W2" section for the full handoff. Phase 270
// ships the caller; Phase 267.2 W2 owns the TRIGGER, jointly with Phase
// 267.3 for hook-surface declaration jurisdiction.
//
// THE HONEST CAVEAT (OQ-2, 270-DECISIONS.md: oq2-ship-caller). An MCP tool
// the model must CHOOSE to call is model-compliance dependent. A first
// install may have no MCP session at all, and the FIRST_INSTALL surface is
// a bash hook injecting prose (scripts/session-start). Making this a tool
// does NOT by itself make the identity write deterministic. A hook-side
// writer may be more deterministic. That is Phase 267.2's decision, not
// this file's claim.
//
// THE ROOM-SCOPING EXCEPTION. This is the ONE memory tool that is
// deliberately NOT room-scoped. Every other memory tool refuses with
// {ok:false, reason:'no_room_db'} when no room exists (lib/mcp/tools/
// graph.cjs:202, :236, :271). This one must work BEFORE any room exists,
// which is why it never calls resolveSessionRoomDir and never opens a
// room.db. That absence is the feature; tests/test-270-identity-write.cjs
// leg 4 asserts it by source grep.
//
// OQ-3 (270-DECISIONS.md): the MCP-tool hitl_shape R16 mandate is
// UNRESOLVED (docs/HITL-SHAPE-DECLARATION-CONTRACT.md names four R16
// surface classes and MCP tools are not among them). This tool declares
// F.1 regardless -- correct under either answer, and the conservative
// choice for a material write.
//
// Canon Part 8: this file opens no Brain wire and makes no network call.
// It writes exactly one path under the user's home directory and reads
// nothing from the graph.
//
// No em-dashes. CJS only.

const os = require('node:os');
const path = require('node:path');
const { z } = require('zod');

const { readUserMd, writeUserMdAtomic } = require('../../core/user-md-ops.cjs');

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

// USER_MD_PATH() resolves os.homedir() at CALL time, not at module load, so
// the isolated-HOME test fixture (which overrides process.env.HOME /
// USERPROFILE AFTER this module is required) actually takes effect. A
// module-load-time constant would bind the real developer HOME the first
// time this module is required in a process and silently write there for
// every later call in that same process -- threat T-270-13.
function USER_MD_PATH() {
  return path.join(os.homedir(), '.mindrian-user.md');
}

const roleBlendSchema = z.object({
  founder: z.number().min(0).max(1).optional(),
  researcher: z.number().min(0).max(1).optional(),
  operator: z.number().min(0).max(1).optional(),
  investor: z.number().min(0).max(1).optional(),
  mentor: z.number().min(0).max(1).optional(),
  domain_expert: z.number().min(0).max(1).optional(),
  student: z.number().min(0).max(1).optional(),
}).optional()
  .describe('Per-axis role weights, each 0 to 1. Only the axes supplied are written; the rest keep their prior value.');

function register(server, _ctx) {
  server.tool(
    'identity_write',
    'Records durable, cross-room facts about WHO this user is (their role or archetype, journey stage, working style) into ONE home-directory file every room reads. Deliberately not scoped to a room and works before any room exists. Preserves any prose the user has written by hand below the frontmatter. This is a material write: confirm the content with the user rather than inferring it silently.',
    {
      canonical_role: z.string().max(120).optional()
        .describe('The user\'s primary role or archetype, for example founder, researcher, student, operator.'),
      journey_stage: z.string().max(120).optional()
        .describe('Where the user currently sits in their own venture or research journey.'),
      problem_type: z.string().max(120).optional()
        .describe('The PWS problem-type classification of the user\'s current work: undefined, ill-defined, well-defined, or wicked.'),
      venture_stage: z.string().max(120).optional()
        .describe('The user\'s general stage across every room, not any one room\'s own stage.'),
      larry_persona: z.string().max(120).optional()
        .describe('Which Larry persona variant suits this user best, if already known.'),
      brain_persona: z.string().max(120).optional()
        .describe('Which Brain persona variant suits this user best, if already known.'),
      user_id: z.string().max(200).optional()
        .describe('A stable identifier for this user, if the caller already has one.'),
      role_blend: roleBlendSchema,
    },
    (args, _extra) => {
      const a = args || {};
      const data = {};
      if (typeof a.canonical_role === 'string') data.canonical_role = a.canonical_role;
      if (typeof a.journey_stage === 'string') data.journey_stage = a.journey_stage;
      if (typeof a.problem_type === 'string') data.problem_type = a.problem_type;
      if (typeof a.venture_stage === 'string') data.venture_stage = a.venture_stage;
      if (typeof a.larry_persona === 'string') data.larry_persona = a.larry_persona;
      if (typeof a.brain_persona === 'string') data.brain_persona = a.brain_persona;
      if (typeof a.user_id === 'string') data.user_id = a.user_id;
      if (a.role_blend && typeof a.role_blend === 'object') data.role_blend = a.role_blend;

      const userMdPath = USER_MD_PATH();
      try {
        // CR-01 fix (267.2-REVIEW.md). This handler used to pass `data`
        // straight to writeUserMdAtomic. writeUserMdAtomic's own
        // buildFrontmatter does Object.assign(emptyUser(), data) -- it does
        // NOT merge with the existing on-disk file, only the body below the
        // '---' delimiter survives untouched. A bare write therefore
        // clobbered every field the CURRENT call did not re-supply back to
        // null/empty, including journey_stage / last_detected_at seeded by
        // scripts/first-install-router.cjs's _seedIdentityFile (or by an
        // earlier identity_write call). Read-modify-write, mirroring the
        // exact pattern _seedIdentityFile already uses: readUserMd() first,
        // Object.assign the delta onto the existing record, then persist the
        // merge. {ignoreOverride: true} (WR-03) makes this read the REAL
        // on-disk file even while a persona override is active -- an
        // override-shaded read merged back onto disk would corrupt the real
        // file the same way a bare write does.
        const existing = readUserMd(userMdPath, { ignoreOverride: true });
        const merged = existing ? Object.assign({}, existing, data) : Object.assign({}, data);
        // role_blend needs its OWN nested merge (mirrors buildFrontmatter's
        // own Object.assign(emptyUser().role_blend, data.role_blend) re-merge
        // in lib/core/user-md-ops.cjs): Object.assign at the top level above
        // would otherwise let a PARTIAL role_blend in this call silently
        // replace the whole existing role_blend object wholesale, zeroing
        // out any axis an earlier call set that this call does not repeat.
        if (data.role_blend && typeof data.role_blend === 'object') {
          const existingRoleBlend = (existing && existing.role_blend && typeof existing.role_blend === 'object')
            ? existing.role_blend : {};
          merged.role_blend = Object.assign({}, existingRoleBlend, data.role_blend);
        }
        writeUserMdAtomic(userMdPath, merged);
      } catch (_e) {
        // Never echo the caught error's raw message: it can carry a
        // filesystem path the client did not supply (T-270-30).
        return textResponse({ ok: false, reason: 'write_failed' }, true);
      }
      return textResponse({ ok: true, path: userMdPath, fields_written: Object.keys(data) });
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). scripts/build-connector-
// registry.cjs discovers this export and regenerates data/mcp-tool-
// connectors.json + data/connector-registry.json from it; never hand-edit
// either generated file.
const connectors = [
  {
    tool: 'identity_write',
    surface: 'identity_write',
    connector: 'mcp-tool',
    hitl_shape: 'F.1',
    hitl_why: 'Writes a durable, cross-room claim about the user\'s identity to a file every room reads -- a material commitment the user should confirm rather than have inferred. Contrast with graph_write\'s F.1 (a typed graph edge): this is the same shape (a material write with a declared fork) applied to a different, cross-room-identity surface.',
  },
];

module.exports = { register, connectors, _internal: { USER_MD_PATH } };
