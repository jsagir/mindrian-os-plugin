'use strict';
// Phase 270-06, OQ-5 -- detect_dual_path / extract_shallow.
//
// These two tools shipped from Phase 115 but were registered inline in
// bin/mindrian-mcp-server.cjs:187 and :199, outside the lib/mcp/tools/*.cjs
// shape scripts/build-connector-registry.cjs discovers at :328-420. They
// therefore appeared in no connector registry and carried no hitl_shape: a
// Part 11 R1 born-wired gap, found by enumeration in RESEARCH.md 2.1. Moving
// them here is the entire fix; no behaviour changes. Both handler bodies
// and both description strings moved byte-identically from bin/.
//
// OQ-3 honesty note: docs/HITL-SHAPE-DECLARATION-CONTRACT.md names four R16
// surface classes (commands/*.md, agents/*.md, pipelines/*/CHAIN.md,
// skills/*/SKILL.md) and MCP tools are not among them. The connectors /
// hitl_shape export below is a parallel MCP-specific instantiation, not a
// claim that R16 covers MCP tools. Whether it is constitutionally mandated
// is OQ-3, still open. These declarations are correct under either answer.
//
// register(server, ctx) accepts ctx and ignores it: both tools are pure
// functions of their input plus an explicit sessionId PARAMETER (for
// extract_shallow), so neither resolves a session room and neither should
// call resolveSessionRoomDir.
//
// Phase 354-15 (SYS-05, decision D-354-SYS05): extract_shallow's public
// contract is honest parsing, not governed persistence. Both documented
// callers (lib/mcp/runtime-instructions.cjs's hookless runtime loop, and
// ignite Door 2) run extract_shallow BEFORE a room exists or is bound, so
// persisting at that moment would either need a room that does not exist
// or break the "never write a room artifact before binding" rule.
// Governed persistence already exists at claim_write (writeClaimNode, the
// single node chokepoint, review_status proposed); this tool does not add
// a second writer. See 354-CONTEXT.md D-354-SYS05 for the full evidence.
//
// No em-dashes. CJS only.

const { z } = require('zod');

const dualPathDetector = require('../../core/dual-path-detector.cjs');
const shallowDocParser = require('../../core/shallow-doc-parser.cjs');

function register(server, _ctx) {
  server.tool(
    'detect_dual_path',
    'Phase 115 dual-path detector. 5-feature additive score classifier (RESEARCH DISCRETION-03). Classifies turn-1 input as upload | type | ambiguous; returns { path, score, features } with booleans-only features payload (Canon Part 8 telemetry-safe). Pure classification, no side effects.',
    {
      text: z.string().describe('The user first-turn input (CV paste, conversational answer, or any string).'),
    },
    async ({ text }) => {
      const result = dualPathDetector.classify(text);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'extract_shallow',
    'Phase 115 strategy (b) shallow-file (decision D-354-SYS05, 2026-09-23). Parses a CV, memo or pitch paste classified as upload-path into an in-memory { user, venture, claims } object (1 user, 1 venture, 1-3 claims); writes nothing to the room or its graph. To keep any of it, bind a room and file each claim with claim_write (review_status proposed) after the navigator confirms it. Falls back to 0 parsed nodes on parse failure (graceful).',
    {
      text: z.string().describe('CV / memo / pitch paste classified as upload-path by detect_dual_path.'),
      sessionId: z.string().describe('Session id scoping the returned in-memory parsed ids only; no persistence happens here.'),
    },
    async ({ text, sessionId }) => {
      const result = shallowDocParser.extractShallow(text, sessionId);
      const payload = Object.assign({}, result, { persisted: false, persist_via: 'claim_write' });
      return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). scripts/build-connector-
// registry.cjs discovers this export and regenerates data/mcp-tool-
// connectors.json + data/connector-registry.json from it; never hand-edit
// either generated file.
const connectors = [
  {
    tool: 'detect_dual_path',
    surface: 'detect_dual_path',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pure classification over a string (5-feature additive score), no side effects, no graph write, no fork. Returns booleans-only telemetry-safe features (Canon Part 8), exactly what the tool description already claims.',
    layer: 'harness',
    layer_why: 'Scores a message across five additive features to classify it as upload-shaped or conversation-shaped; a measurement pass over the input, the rubric\'s own step 3 verb, with the actual path dispatch performed by the calling agent rather than this tool (WD-6 own-rung).',
  },
  {
    tool: 'extract_shallow',
    surface: 'extract_shallow',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Decision D-354-SYS05 (354-CONTEXT.md): extract_shallow is a pure parse by contract, not governed persistence. Verified against lib/core/shallow-doc-parser.cjs: this tool calls extractShallow(text, sessionId) with no opts.db, so setFocus never fires (it only fires when opts.db is supplied, extractShallow:191) and the memory_event write stays inert (safeRecord no-ops unless navigation.recordMemoryEvent is a function, which it is not today). Both documented callers run before a room exists or is bound, so persisting here would either need a room that does not exist or break the never-write-before-binding rule; governed persistence already exists at claim_write (writeClaimNode, review_status proposed) once a room is bound and the navigator confirms. This call performs zero graph writes; it computes and returns an in-memory {user, venture, claims} object with persisted:false. hitl_shape reflects real, intended behaviour, with no description-versus-behavior mismatch.',
    layer: 'loop',
    layer_why: 'Runs one bounded extraction pass over a pasted document into a structured {user, venture, claims} object and returns it; a single worker cycle to a stopping condition, not a graph write today (verified inert against the actual wiring).',
  },
];

module.exports = { register, connectors };
