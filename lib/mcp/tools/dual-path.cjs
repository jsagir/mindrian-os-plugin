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
    'Phase 115 strategy (b) shallow-file. Parses a CV / memo / pitch paste classified as upload-path into 1 user + 1 venture + 1-3 claim nodes. Routes graph writes through lib/core/navigation.cjs setFocus + memory_event (Phase 109 chokepoint). Falls back to 0 nodes on parse failure (graceful).',
    {
      text: z.string().describe('CV / memo / pitch paste classified as upload-path by detect_dual_path.'),
      sessionId: z.string().describe('Session id for navigation.setFocus + memory_event scoping.'),
    },
    async ({ text, sessionId }) => {
      const result = shallowDocParser.extractShallow(text, sessionId);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
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
  },
  {
    tool: 'extract_shallow',
    surface: 'extract_shallow',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Verified against lib/core/shallow-doc-parser.cjs rather than assumed from its own description: the description claims it "routes graph writes through navigation.cjs setFocus + memory_event", but as this tool actually calls it (extractShallow(text, sessionId), no third opts argument), setFocus is skipped (it only fires when opts.db is supplied, extractShallow:191) and the memory_event write is ALSO inert -- navigation.cjs does not export recordMemoryEvent at all today (the module-level comment at shallow-doc-parser.cjs:138-140 names it "the proposed 14th re-export", never landed), so safeRecords typeof check is always false in production. As actually wired, this call performs zero graph writes; it computes and returns an in-memory {user, venture, claims} object only. hitl_shape reflects real behaviour, not the description prose.',
  },
];

module.exports = { register, connectors };
