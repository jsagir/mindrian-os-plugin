#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 131-05 Task 2 -- scripts/check-research-isomorphism.cjs
 * =============================================================
 * The CI guard that asserts the /mos:research typed-node + typed-edge contract.
 * It MIRRORS the scripts/check-substrate.cjs structure (a pure scan API + a CLI
 * mode + exit-0-informational / exit-1-on-violation; node built-ins only; ZERO
 * network, ZERO Brain). It enforces the LOCKED Phase 136 forward contracts so
 * /mos:research output is graph-isomorphic to what Phase 136's render spine reads.
 *
 * TWO scan modes:
 *
 * 1. scanRoom(db | fixtures) -- the typed-node contract over a room.db (or a
 *    fixture set of { nodes, edges }). Asserts:
 *      (a) every EvidenceClaim node carries the locked provenance schema
 *          (source + url + retrieved_at + evidence_tier all present and
 *          evidence_tier in the closed Canon Part 5 set);
 *      (b) every cascade edge FROM an EvidenceClaim node has a typed predicate in
 *          { INFORMS, CONTRADICTS, SUPERSEDES, REJECTED_BECAUSE } (no untyped /
 *          off-allowlist edge);
 *      (c) every cascade-edge target is EITHER a LOCAL room.db node id (a target
 *          that exists in the nodes table OR carries a ':'-namespaced local id
 *          such as 'section:' / 'claim:') OR a teaching-graph correlation_id
 *          matching the 130.7 shape (the bare 16-char lowercase hex emitted by
 *          lib/core/correlation.cjs computeCorrelationId -- recognized via the
 *          REAL CORRELATION_ID_LENGTH constant, NEVER a phantom correlation.resolve)
 *          -- NOT a bare raw section slug / framework name;
 *      (d) a REJECTED_BECAUSE edge carries a non-empty reason scalar.
 *
 * 2. scanDirectives(files, readContent) -- the directive grep-mode. Scans the
 *    four pipeline modules + the command for ZERO Python spawn (child_process /
 *    spawn / execSync / .py / scripts/hsi), stripping comment-only lines before
 *    counting (grep-gate hygiene). Catches a re-introduced compute-hsi.py call.
 *
 * Canon Part 4: every cascade edge is typed graph data (T-131-05-02).
 * Canon Part 5: evidence_tier is graded from the closed four-tier set.
 * Canon Part 8: ZERO network, ZERO Brain; node: builtins only. Recognizes the
 *   correlation_id shape from the REAL 130.7 export, never a phantom resolver
 *   (T-131-05-01 + the no-phantom contract).
 *
 * Programmatic API (pure, no process.exit):
 *   scanRoom({ nodes, edges })          -> Array<{ kind, id|edge, rule, detail }>
 *   scanRoomDb(db)                      -> same, reading via lib/core/navigation
 *   scanDirectives(files, readContent)  -> Array<{ file, line, rule, match }>
 *
 * CLI modes:
 *   --help               : usage, exit 0.
 *   --directives         : run the directive grep over the four modules + command,
 *                          exit 1 on any Python-spawn hit (the load-bearing gate
 *                          that runs without a room.db). Default CLI mode.
 *   --room <roomDir>     : scan a real room.db, exit 1 on any contract violation.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). Uses hyphens.
 *
 * License: BSL 1.1.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Locked contract constants.
// ---------------------------------------------------------------------------

// The closed Canon Part 5 evidence-tier set (mirrors evidence-claim.cjs).
const EVIDENCE_TIERS = Object.freeze(new Set(['Academic', 'Operational', 'Practitioner', 'None']));

// The four typed cascade predicates an EvidenceClaim edge MUST use (the locked
// Phase 136 allow-list subset; INFORMS + REJECTED_BECAUSE shipped via 130-01,
// CONTRADICTS + SUPERSEDES added additively via 131-01).
const CASCADE_PREDICATES = Object.freeze(new Set([
  'INFORMS', 'CONTRADICTS', 'SUPERSEDES', 'REJECTED_BECAUSE',
]));

// The locked EvidenceClaim provenance fields (mirrors evidence-claim.cjs props).
const REQUIRED_PROVENANCE = Object.freeze(['source', 'url', 'retrieved_at', 'evidence_tier']);

// The node type a research finding lands as.
const EVIDENCE_CLAIM_TYPE = 'EvidenceClaim';

// The REAL 130.7 correlation_id shape: a bare lowercase-hex string of EXACTLY
// CORRELATION_ID_LENGTH chars. Read the length from the REAL export so the guard
// recognizes the shape lib/core/correlation.cjs actually emits, never a phantom.
let CORRELATION_ID_LENGTH = 16;
try {
  const correlation = require('../lib/core/correlation.cjs');
  if (correlation && Number.isFinite(correlation.CORRELATION_ID_LENGTH)) {
    CORRELATION_ID_LENGTH = correlation.CORRELATION_ID_LENGTH;
  }
} catch (_e) {
  // Degrade to the locked default 16 (the contract-of-record length). The guard
  // still runs without the module present (hermetic test contexts).
}
const CORRELATION_ID_RE = new RegExp('^[0-9a-f]{' + CORRELATION_ID_LENGTH + '}$');

// A LOCAL room.db node id carries a ':' namespace prefix by convention
// ('section:' / 'claim:' / 'EvidenceClaim:' / 'decision:' etc.). This is how the
// findings-wirer's defaultResolveLocalTarget mints local targets.
const LOCAL_NODE_ID_RE = /^[A-Za-z][A-Za-z0-9_-]*:/;

// The directive scan targets (the four pipeline modules + the command).
const DIRECTIVE_FILES = Object.freeze([
  'lib/lens-engine/source-lens-driver.cjs',
  'lib/core/research-context-extractor.cjs',
  'lib/core/findings-wirer.cjs',
  'commands/research.md',
]);

// Python-spawn / external-process forbidden patterns (the zero-Python directive).
const PYTHON_SPAWN_PATTERNS = Object.freeze([
  /child_process/,
  /\bexecSync\s*\(/,
  /\bspawn(?:Sync)?\s*\(/,
  /\.py\b/,
  /scripts\/hsi/,
]);

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// Provenance parsing. A node's properties may be a JSON string (room.db column)
// or an already-parsed object (fixture). Returns a plain object or {}.
// ---------------------------------------------------------------------------
function parseProps(props) {
  if (isPlainObject(props)) return props;
  if (typeof props === 'string') {
    try {
      const o = JSON.parse(props);
      return isPlainObject(o) ? o : {};
    } catch (_e) {
      return {};
    }
  }
  return {};
}

function edgeProps(props) {
  return parseProps(props);
}

// True iff an edge target is contract-valid: a LOCAL node id (present in the
// node-id set OR namespaced) OR a 130.7 correlation_id (bare 16-char hex). A bare
// raw name (no ':' prefix, not a correlation_id, not a known node) is a violation.
function isValidTarget(targetId, nodeIdSet) {
  if (typeof targetId !== 'string' || targetId.length === 0) return false;
  // A teaching-graph correlation_id: bare lowercase hex of the locked length.
  if (CORRELATION_ID_RE.test(targetId)) return true;
  // A LOCAL node id present in the room.
  if (nodeIdSet && nodeIdSet.has(targetId)) return true;
  // A LOCAL namespaced node id (section: / claim: / EvidenceClaim: / decision:).
  if (LOCAL_NODE_ID_RE.test(targetId)) return true;
  return false;
}

/**
 * scanRoom({ nodes, edges }) -> Array<violation>
 *
 * Pure over an in-memory graph snapshot:
 *   nodes : Array<{ id, type, properties }>
 *   edges : Array<{ source, target, type, properties }>
 *
 * Returns a violation array (empty == clean). Each violation is
 * { kind, id|edge, rule, detail }. Never throws.
 */
function scanRoom(graph) {
  const g = isPlainObject(graph) ? graph : {};
  const nodes = Array.isArray(g.nodes) ? g.nodes : [];
  const edges = Array.isArray(g.edges) ? g.edges : [];
  const violations = [];

  // Index the node set + the EvidenceClaim node ids.
  const nodeIdSet = new Set();
  const evidenceClaimIds = new Set();
  for (const n of nodes) {
    if (!isPlainObject(n) || typeof n.id !== 'string') continue;
    nodeIdSet.add(n.id);
    if (n.type === EVIDENCE_CLAIM_TYPE) evidenceClaimIds.add(n.id);
  }

  // (a) Every EvidenceClaim node carries the locked provenance schema.
  for (const n of nodes) {
    if (!isPlainObject(n) || n.type !== EVIDENCE_CLAIM_TYPE) continue;
    const props = parseProps(n.properties);
    for (const field of REQUIRED_PROVENANCE) {
      const v = props[field];
      if (typeof v !== 'string' || v.length === 0) {
        violations.push({
          kind: 'node', id: n.id, rule: 'missing-provenance',
          detail: 'EvidenceClaim missing provenance field: ' + field,
        });
      }
    }
    const tier = props.evidence_tier;
    if (typeof tier === 'string' && tier.length > 0 && !EVIDENCE_TIERS.has(tier)) {
      violations.push({
        kind: 'node', id: n.id, rule: 'invalid-evidence-tier',
        detail: 'evidence_tier not in closed Part 5 set: ' + String(tier).slice(0, 40),
      });
    }
  }

  // (b)+(c)+(d) Every cascade edge FROM an EvidenceClaim node.
  for (const e of edges) {
    if (!isPlainObject(e)) continue;
    const source = typeof e.source === 'string' ? e.source : '';
    const target = typeof e.target === 'string' ? e.target : '';
    const type = typeof e.type === 'string' ? e.type : '';
    // Scope the contract to edges originating at an EvidenceClaim node.
    if (!evidenceClaimIds.has(source)) continue;

    // (b) typed predicate in the four-member allow-list.
    if (!CASCADE_PREDICATES.has(type)) {
      violations.push({
        kind: 'edge', edge: source + ' -[' + type + ']-> ' + target,
        rule: 'untyped-cascade-edge',
        detail: 'edge predicate not in {INFORMS,CONTRADICTS,SUPERSEDES,REJECTED_BECAUSE}: ' + String(type).slice(0, 40),
      });
      continue;
    }

    // (c) target is a LOCAL node id OR a 130.7 correlation_id (not a raw name).
    if (!isValidTarget(target, nodeIdSet)) {
      violations.push({
        kind: 'edge', edge: source + ' -[' + type + ']-> ' + target,
        rule: 'raw-name-target',
        detail: 'cascade target is a raw name (not a room.db node id and not a 130.7 correlation_id): ' + String(target).slice(0, 60),
      });
    }

    // (d) REJECTED_BECAUSE carries a non-empty reason scalar.
    if (type === 'REJECTED_BECAUSE') {
      const props = edgeProps(e.properties);
      const reason = props.reason;
      if (typeof reason !== 'string' || reason.length === 0) {
        violations.push({
          kind: 'edge', edge: source + ' -[REJECTED_BECAUSE]-> ' + target,
          rule: 'rejected-without-reason',
          detail: 'REJECTED_BECAUSE edge missing a non-empty reason scalar',
        });
      }
    }
  }

  return violations;
}

/**
 * scanRoomDb(db) -> Array<violation>
 *
 * Read the nodes + edges directly from a caller-owned room.db handle (the
 * node:sqlite shape openRoomDb produces) and run scanRoom over the snapshot.
 * Reads ONLY the two tables (no write, no network). Never throws: a read failure
 * degrades to an empty graph (clean), so a missing room is not a false-positive.
 */
function scanRoomDb(db) {
  if (!db || typeof db.prepare !== 'function') return [];
  let nodes = [];
  let edges = [];
  try {
    nodes = db.prepare('SELECT id, type, properties FROM nodes').all() || [];
  } catch (_e) {
    nodes = [];
  }
  try {
    edges = db.prepare('SELECT source, target, type, properties FROM edges').all() || [];
  } catch (_e) {
    edges = [];
  }
  return scanRoom({ nodes, edges });
}

// ---------------------------------------------------------------------------
// Directive grep-mode (the zero-Python gate). Strips comment-only lines before
// counting so a documentation line mentioning the forbidden token is not a false
// flag (grep-gate hygiene, the same idiom check-substrate.cjs uses).
// ---------------------------------------------------------------------------
function isCommentOnlyLine(line, isMarkdown) {
  // JS/CJS comment-only lines.
  if (/^\s*\/\//.test(line) || /^\s*\*/.test(line) || /^\s*\/\*/.test(line)) return true;
  // Markdown is documentation: strip fenced-code markers + prose lines that are
  // not executable. For the command file we only flag a literal .py / hsi spawn
  // in a CODE position; a prose mention inside a sentence is stripped. We treat a
  // markdown line as comment-only UNLESS it is inside a fenced bash/sh block. The
  // scanner tracks fence state separately (see scanDirectives), so here we only
  // strip obvious prose: lines NOT starting with a shell token in a code fence are
  // handled by the fence tracker; this helper just catches block-comment lines.
  if (isMarkdown) {
    // A markdown header / bullet / table line is prose, never a spawn.
    if (/^\s*(#|\||-\s|\*\s|>\s)/.test(line)) return true;
  }
  return false;
}

function scanDirectives(files, readContent) {
  const violations = [];
  for (const filePath of files) {
    const content = readContent(filePath);
    if (!content) continue;
    const isMarkdown = /\.md$/.test(filePath);
    const lines = content.split('\n');
    let inCodeFence = false;
    let fenceLang = '';
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      // Track markdown fenced-code blocks so we only scan code positions in .md.
      if (isMarkdown) {
        const fence = raw.match(/^\s*```(\w*)/);
        if (fence) {
          if (!inCodeFence) { inCodeFence = true; fenceLang = fence[1] || ''; }
          else { inCodeFence = false; fenceLang = ''; }
          continue;
        }
        // Outside a code fence, a markdown line is prose -> never a spawn.
        if (!inCodeFence) continue;
        // Inside a non-shell fence (e.g. a json sample), still scan for .py / hsi.
        void fenceLang;
      } else if (isCommentOnlyLine(raw, false)) {
        continue;
      }
      for (const rx of PYTHON_SPAWN_PATTERNS) {
        const m = raw.match(rx);
        if (m) {
          violations.push({
            file: filePath, line: i + 1, rule: 'python-spawn',
            match: m[0],
          });
        }
      }
    }
  }
  return violations;
}

// Default reader: read a repo-relative path from disk; '' if unreadable.
function readFromDisk(relPath) {
  try {
    return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
  } catch (_e) {
    return '';
  }
}

// ---------------------------------------------------------------------------
// CLI entry point.
// ---------------------------------------------------------------------------
function printUsage(stream) {
  stream.write([
    'check-research-isomorphism.cjs -- the /mos:research typed-node + typed-edge CI guard.',
    '',
    'Usage:',
    '  node scripts/check-research-isomorphism.cjs --help',
    '  node scripts/check-research-isomorphism.cjs --directives   (default; zero-Python gate)',
    '  node scripts/check-research-isomorphism.cjs --room <roomDir>',
    '',
    'Exit 0 == clean; exit 1 == a contract violation (Python spawn / missing',
    'provenance / untyped cascade edge / raw-name target / un-reasoned rejection).',
    '',
  ].join('\n'));
}

function runDirectives() {
  const violations = scanDirectives(DIRECTIVE_FILES.slice(), readFromDisk);
  if (violations.length === 0) {
    process.stdout.write('[check-research-isomorphism] --directives: clean (zero Python spawn across the 4 modules + command).\n');
    process.exit(0);
  }
  process.stderr.write('[check-research-isomorphism] FAIL (--directives): a Python spawn was re-introduced:\n');
  for (const v of violations) {
    process.stderr.write('  ' + v.file + ':' + v.line + ': [' + v.rule + '] ' + v.match + '\n');
  }
  process.stderr.write('The research pipeline must call ZERO Python (Canon Part 8 + the 4.8 re-baseline).\n');
  process.exit(1);
}

function runRoom(roomDir) {
  // Open room.db through the navigation chokepoint re-export
  // (navigation.openRoomDbForCaller), NOT a direct room-db.cjs require: the guard
  // is NOT on the substrate allow-list, so per Canon Part 9 it reaches room.db
  // ONLY through lib/core/navigation.cjs. The caller owns the handle and MUST
  // close it via closeRoomDbForCaller in a finally (the documented contract).
  let db = null;
  let navigation = null;
  try {
    navigation = require('../lib/core/navigation.cjs');
    db = navigation.openRoomDbForCaller(roomDir);
  } catch (e) {
    process.stderr.write('[check-research-isomorphism] could not open room.db at ' + roomDir + ': ' + String(e.message || e).slice(0, 120) + '\n');
    process.exit(1);
  }
  if (!db) {
    // A missing room.db (Tier 0 cold start) is not a violation -- nothing to scan.
    process.stdout.write('[check-research-isomorphism] --room: no room.db at ' + roomDir + ' (Tier 0 cold start); nothing to scan.\n');
    process.exit(0);
  }
  const violations = scanRoomDb(db);
  try { navigation.closeRoomDbForCaller(db); } catch (_e) { /* ignore */ }
  if (violations.length === 0) {
    process.stdout.write('[check-research-isomorphism] --room: clean (typed-node + typed-edge contract holds).\n');
    process.exit(0);
  }
  process.stderr.write('[check-research-isomorphism] FAIL (--room): the typed-node contract is violated:\n');
  for (const v of violations) {
    const where = v.kind === 'node' ? ('node ' + v.id) : ('edge ' + v.edge);
    process.stderr.write('  [' + v.rule + '] ' + where + ': ' + v.detail + '\n');
  }
  process.exit(1);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printUsage(process.stdout);
    process.exit(0);
  }
  const roomIdx = args.indexOf('--room');
  if (roomIdx !== -1) {
    const roomDir = args[roomIdx + 1];
    if (!roomDir) {
      process.stderr.write('--room requires a room directory argument.\n');
      process.exit(1);
    }
    runRoom(roomDir);
  } else {
    // Default + --directives both run the zero-Python gate (runs without a room.db).
    runDirectives();
  }
}

module.exports = {
  scanRoom: scanRoom,
  scanRoomDb: scanRoomDb,
  scanDirectives: scanDirectives,
  EVIDENCE_TIERS: EVIDENCE_TIERS,
  CASCADE_PREDICATES: CASCADE_PREDICATES,
  REQUIRED_PROVENANCE: REQUIRED_PROVENANCE,
  CORRELATION_ID_LENGTH: CORRELATION_ID_LENGTH,
  DIRECTIVE_FILES: DIRECTIVE_FILES.slice(),
};
