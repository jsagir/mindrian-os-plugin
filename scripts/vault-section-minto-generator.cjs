#!/usr/bin/env node
/**
 * MindrianOS Plugin -- Vault Section MINTO Generator
 *
 * Writes a MINTO.md (Minto Pyramid + MECE issue tree) into every section
 * folder that contains at least one artifact. Empty sections are skipped per
 * SECTION-07. Recursive through sub-rooms per SECTION-05.
 *
 * Trifecta contract (ARCH-02): this is the reasoning half of the tier-1 MOC
 * hub. Paired with ROOM.md (identity, Decision 15) and STATE.md (status,
 * companion script), every section becomes a fully-formed Obsidian MOC.
 *
 * Pure CJS, zero npm dependencies. Reuses lib/vault/room-scanner.cjs and
 * scripts/vault-section-state-generator.cjs walk helper.
 *
 *   node scripts/vault-section-minto-generator.cjs <roomDir> [--dry-run] [--section <name>]
 *
 * Idempotent (WIKI-07): stable sort orders, atomic .tmp + rename write,
 * byte-identical skip on re-run.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  scanRoom,
  parseFrontmatter,
  slugToTitle,
} = require('../lib/vault/room-scanner.cjs');
const {
  walkAllSections,
} = require('./vault-section-state-generator.cjs');

// ---------- CLI ----------

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const sectionFlagIdx = argv.indexOf('--section');
const SECTION_FILTER =
  sectionFlagIdx !== -1 && argv[sectionFlagIdx + 1]
    ? argv[sectionFlagIdx + 1]
    : null;

// Phase 81-01: --plan and --write subcommand flags.
const PLAN_FLAG = argv.includes('--plan');
const WRITE_FLAG = argv.includes('--write');
const narrativeFlagIdx = argv.indexOf('--narrative');
const NARRATIVE_PATH =
  narrativeFlagIdx !== -1 && argv[narrativeFlagIdx + 1]
    ? argv[narrativeFlagIdx + 1]
    : null;

// Phase 88-04-B: test-only invariant-rejection mock flag. Behind MOS_TEST=1
// so production cannot accidentally inject synthetic violations. Accepted
// values: "error" | "warning" | "critical" (null = real validator).
let MOCK_INVARIANTS_FAIL_CLI = null;
for (const a of argv) {
  const m = a.match(/^--mock-invariants-fail=(.+)$/);
  if (m) {
    MOCK_INVARIANTS_FAIL_CLI = m[1];
    break;
  }
}

// roomArg: first positional that is not a flag value.
// Values of --section and --narrative are consumed by their flags.
const FLAG_VALUE_INDICES = new Set();
if (sectionFlagIdx !== -1) FLAG_VALUE_INDICES.add(sectionFlagIdx + 1);
if (narrativeFlagIdx !== -1) FLAG_VALUE_INDICES.add(narrativeFlagIdx + 1);
const roomArg = argv.find(function (a, i) {
  if (a.startsWith('--')) return false;
  if (FLAG_VALUE_INDICES.has(i)) return false;
  return true;
});

function usage() {
  process.stderr.write(
    'Usage: node scripts/vault-section-minto-generator.cjs <roomDir> [--dry-run] [--section <name>]\n' +
      '       node scripts/vault-section-minto-generator.cjs --plan <roomDir> --section <name>\n' +
      '       node scripts/vault-section-minto-generator.cjs --write <roomDir> --section <name> --narrative <jsonFile>\n'
  );
}

// ---------- Heuristic gap lookup ----------

const GAP_HEURISTICS = {
  'problem-definition': [
    'root-cause analysis',
    'stakeholder impact mapping',
    'problem formulation history',
  ],
  'market-analysis': ['TAM sizing', 'SAM sizing', 'SOM sizing', 'segment personas'],
  'solution-design': ['architecture diagram', 'user journey map', 'technical feasibility'],
  'business-model': ['revenue model', 'unit economics', 'pricing strategy'],
  'competitive-analysis': ['direct competitors', 'indirect competitors', 'moat analysis'],
  'financial-model': ['projections', 'burn rate', 'runway analysis', 'funding ask'],
  'legal-ip': ['entity structure', 'IP ownership', 'regulatory review'],
  'team-execution': ['hiring plan', 'org chart', 'milestones'],
  team: ['founder bios', 'advisor roster', 'gaps in expertise'],
  meetings: ['meeting cadence', 'decision log', 'action items'],
  'opportunity-bank': ['grant pipeline', 'partnership pipeline', 'convergence signals'],
};

// ---------- Helpers ----------

function today() {
  // Phase 81-01: allow deterministic date injection for test fixtures.
  // When unset (production), behavior is byte-equivalent to pre-81.
  if (process.env.MINTO_FROZEN_DATE) return process.env.MINTO_FROZEN_DATE;
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Phase 88-00: ISO-8601 timestamp for last_generated_at. Honors
// MINTO_FROZEN_TIMESTAMP for deterministic test fixtures.
function nowIso() {
  if (process.env.MINTO_FROZEN_TIMESTAMP) {
    return process.env.MINTO_FROZEN_TIMESTAMP;
  }
  // Seconds precision: .000Z truncated so byte diffs between runs are
  // clean (no sub-second jitter in human-read frontmatter).
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ---------- Phase 88-00: v88 frontmatter preservation ----------
//
// When regenerating MINTO.md, four v88 fields must be preserved from the
// previous file:
//   - last_artifact_write_seen_at (set by 88-04 post-write hook)
//   - reasoning_health_score      (computed by 88-01 readTriple)
//   - flagged_weaknesses          (populated by 88-13 guardian)
//   - decision_log                (cross-session decision continuity)
//
// last_generated_at is NOT preserved -- it advances on every write.
//
// The parser below is a narrow-dialect frontmatter reader that extracts
// exactly these four fields. It mirrors the dialect supported by
// lib/core/feynman-minto-invariants.cjs so the two modules agree on what
// a Feynman-MINTO frontmatter looks like. Zero new dependencies.

function readPreservedV88Fields(targetPath) {
  const defaults = {
    last_artifact_write_seen_at: null,
    reasoning_health_score: null,
    flagged_weaknesses: [],
    decision_log: [],
  };
  let raw;
  try {
    raw = fs.readFileSync(targetPath, 'utf8');
  } catch (_) {
    return defaults;
  }
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!fmMatch) return defaults;
  const fmText = fmMatch[1];
  const lines = fmText.split(/\r?\n/);

  const out = Object.assign({}, defaults);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // last_artifact_write_seen_at: "ISO" | null
    let m = line.match(/^last_artifact_write_seen_at:\s*(.*)$/);
    if (m) {
      const v = m[1].trim();
      if (v.length > 0 && v !== 'null') {
        out.last_artifact_write_seen_at = stripQuotes(v);
      }
      continue;
    }

    // reasoning_health_score: number | null
    m = line.match(/^reasoning_health_score:\s*(.*)$/);
    if (m) {
      const v = m[1].trim();
      if (v.length > 0 && v !== 'null') {
        const num = Number(v);
        if (Number.isFinite(num)) out.reasoning_health_score = num;
      }
      continue;
    }

    // flagged_weaknesses: [a, b] or block list
    m = line.match(/^flagged_weaknesses:\s*(.*)$/);
    if (m) {
      const v = m[1].trim();
      if (v.startsWith('[') && v.endsWith(']')) {
        // Flow-style array.
        const inner = v.slice(1, -1).trim();
        if (inner.length > 0) {
          out.flagged_weaknesses = inner
            .split(',')
            .map(function (s) { return stripQuotes(s.trim()); })
            .filter(function (s) { return s.length > 0; });
        }
        continue;
      }
      // Block list: read `  - item` continuation lines.
      const items = [];
      let j = i + 1;
      while (j < lines.length) {
        const nxt = lines[j];
        const it = nxt.match(/^\s+-\s+(.*)$/);
        if (!it) break;
        items.push(stripQuotes(it[1].trim()));
        j += 1;
      }
      out.flagged_weaknesses = items;
      continue;
    }

    // decision_log: [] (empty) OR block list of objects
    m = line.match(/^decision_log:\s*(.*)$/);
    if (m) {
      const rest = m[1].trim();
      if (rest === '[]') continue; // empty
      // Block list: walk continuation lines indented with at least 2 spaces.
      const entries = [];
      let j = i + 1;
      let current = null;
      while (j < lines.length) {
        const nxt = lines[j];
        if (/^[A-Za-z_]/.test(nxt)) break; // next top-level key
        if (/^\s*$/.test(nxt)) {
          j += 1;
          continue;
        }
        const head = nxt.match(/^\s+-\s+([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
        if (head) {
          if (current) entries.push(current);
          current = {};
          current[head[1]] = stripQuotes(head[2]);
          j += 1;
          continue;
        }
        const cont = nxt.match(
          /^\s+([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/
        );
        if (cont && current) {
          current[cont[1]] = stripQuotes(cont[2]);
          j += 1;
          continue;
        }
        break;
      }
      if (current) entries.push(current);
      out.decision_log = entries;
      continue;
    }
  }

  return out;
}

function stripQuotes(s) {
  if (typeof s !== 'string') return s;
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

// Render the five v88 fields as frontmatter lines (in canonical order).
// Returns an array of lines (no trailing newline). Caller splices into the
// frontmatter right before the closing `---` delimiter.
function renderV88FrontmatterLines(preserved) {
  const lines = [];
  lines.push('last_generated_at: "' + nowIso() + '"');

  const laws = preserved.last_artifact_write_seen_at;
  if (laws === null || laws === undefined) {
    lines.push('last_artifact_write_seen_at: null');
  } else {
    lines.push('last_artifact_write_seen_at: "' + laws + '"');
  }

  const rhs = preserved.reasoning_health_score;
  if (rhs === null || rhs === undefined) {
    lines.push('reasoning_health_score: null');
  } else {
    lines.push('reasoning_health_score: ' + String(rhs));
  }

  const fw = Array.isArray(preserved.flagged_weaknesses)
    ? preserved.flagged_weaknesses
    : [];
  if (fw.length === 0) {
    lines.push('flagged_weaknesses: []');
  } else {
    lines.push(
      'flagged_weaknesses: [' +
        fw.map(function (s) { return '"' + String(s).replace(/"/g, '\\"') + '"'; }).join(', ') +
        ']'
    );
  }

  const dl = Array.isArray(preserved.decision_log) ? preserved.decision_log : [];
  if (dl.length === 0) {
    lines.push('decision_log: []');
  } else {
    lines.push('decision_log:');
    dl.forEach(function (entry) {
      const keys = Object.keys(entry);
      if (keys.length === 0) return;
      // session_id first (canonical), then remaining keys in insertion order.
      const ordered = [];
      if ('session_id' in entry) ordered.push('session_id');
      for (const k of keys) {
        if (k !== 'session_id') ordered.push(k);
      }
      ordered.forEach(function (k, i) {
        const v = entry[k];
        const quoted = typeof v === 'string'
          ? '"' + v.replace(/"/g, '\\"') + '"'
          : String(v);
        if (i === 0) {
          lines.push('  - ' + k + ': ' + quoted);
        } else {
          lines.push('    ' + k + ': ' + quoted);
        }
      });
    });
  }

  return lines;
}

function collectSectionArtifacts(sectionDir, contentFiles) {
  return contentFiles
    .filter((f) => f.path.startsWith(sectionDir + path.sep))
    .filter((f) => !f.isFiledTo)
    .sort((a, b) => a.relPath.localeCompare(b.relPath));
}

function firstBodyLine(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    let body = content;
    if (content.startsWith('---')) {
      const end = content.indexOf('\n---', 3);
      if (end !== -1) body = content.slice(end + 4);
    }
    const lines = body.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('#')) continue;
      if (trimmed.startsWith('<!--')) continue;
      if (trimmed.startsWith('>')) continue;
      // Truncate for one-line summary
      return trimmed.length > 180 ? trimmed.slice(0, 177) + '...' : trimmed;
    }
  } catch (_) {
    /* ignore */
  }
  return 'Artifact contributes evidence to this section.';
}

// Quick task 260903-i2x (T2 read half) -- reads the highest-confidence,
// most-recent conclusion/decision node for this section, straight from
// room.db, so deriveGoverningThought below can render REAL reasoning-node
// text instead of the count-based template once such a node exists.
//
// Canon Part 9 / substrate mandate M2: navigation.cjs is the ONLY door to
// room.db. openRoomDbReadOnlyForCaller (navigation.cjs:450-467) is the right
// MODE of that door here because a doc generator must never migrate or
// mutate the room it is describing -- the plain openRoomDbForCaller mode
// runs 13 schema-creation clauses (each an "IF NOT EXISTS" table create) plus
// 5 migrations on every open, which is wrong for a read-only describer. This closes the handle
// via navigation.closeRoomDbForCaller because there is deliberately no
// read-only sibling close function (same re-export, tolerant of a bare
// DatabaseSync).
//
// Lazy-required INSIDE the function, inside try/catch, mirroring the
// existing tryEnqueueBrainDerivation lazy-require idiom at line ~598 -- this
// keeps the generator's cold path free of the navigation module and keeps a
// missing/incompatible module from ever breaking the render.
//
// The whole function body is one try/catch returning null on ANY failure. A
// legacy un-migrated 3-column room.db has no confidence / created_at
// columns (node-insert.cjs::isMigratedSchema's two-schema reality) and this
// query will throw against it -- that is EXPECTED and exactly why the whole
// body degrades to null rather than propagating.
function readGoverningThoughtFromGraph(roomDir, sectionSlug) {
  let navigation;
  try {
    navigation = require('../lib/core/navigation.cjs');
  } catch (_e) {
    return null;
  }
  try {
    const db = navigation.openRoomDbReadOnlyForCaller(roomDir);
    if (!db) return null;
    try {
      // The Artifact + properties.section join shape is the shipped one at
      // lib/core/graph-ops.cjs:242 (json_extract(properties,'$.section') on
      // an Artifact node) -- cited rather than inventing a second
      // convention. DERIVED_FROM is included alongside SOURCED_FROM in the
      // edge-type match so a node reachable only via the Phase 120-00
      // structural edge is still found, not just T2's own new edge.
      const row = db.prepare(
        `SELECT json_extract(n.properties,'$.text') AS text
         FROM nodes n
         WHERE json_extract(n.properties,'$.epistemic_type') IN ('conclusion','decision')
           AND json_extract(n.properties,'$.text') IS NOT NULL
           AND json_extract(n.properties,'$.text') != ''
           AND (
             json_extract(n.properties,'$.section') = ?
             OR n.id IN (
               SELECT e.source FROM edges e
               WHERE e.type IN ('SOURCED_FROM','DERIVED_FROM')
                 AND e.target IN (
                   SELECT a.id FROM nodes a
                   WHERE a.type = 'Artifact'
                     AND json_extract(a.properties,'$.section') = ?
                 )
             )
           )
         ORDER BY COALESCE(n.confidence, 0) DESC, COALESCE(n.created_at, 0) DESC
         LIMIT 1`
      ).get(sectionSlug, sectionSlug);
      if (row && typeof row.text === 'string' && row.text.length > 0) {
        return row.text;
      }
      return null;
    } finally {
      navigation.closeRoomDbForCaller(db);
    }
  } catch (_e) {
    return null;
  }
}

function deriveGoverningThought(section, artifacts) {
  const title = slugToTitle(section.name);
  const n = artifacts.length;
  const fallback = `${title} synthesizes ${n} artifact${n === 1 ? '' : 's'} into a coherent argument for this section of the venture.`;
  // Quick task 260903-i2x: try the graph first (section.parentRoomDir is
  // already in scope at both call sites two lines above their own call, so
  // no signature change is needed). On day one there are zero such nodes in
  // any existing room, so the fallback IS the normal path until the Task 2
  // write paths have run for a while; the fallback gets removed only once a
  // room is observed producing real conclusion nodes through normal use,
  // never on a fixed date.
  //
  // Idempotence consequence (WIKI-07): the byte-identical-on-re-run contract
  // now holds PER GRAPH STATE rather than absolutely. Two runs with an
  // unchanged graph are still byte-identical; a run after a new conclusion
  // node lands legitimately produces new content, which is the entire point
  // of this change.
  const roomDir = section && section.parentRoomDir;
  const sectionSlug = section && section.name;
  if (typeof roomDir === 'string' && roomDir.length > 0 && typeof sectionSlug === 'string' && sectionSlug.length > 0) {
    const graphThought = readGoverningThoughtFromGraph(roomDir, sectionSlug);
    if (typeof graphThought === 'string' && graphThought.length > 0) {
      return graphThought;
    }
  }
  return fallback;
}

function deriveClaims(artifacts, sectionDir, max = 5) {
  const picks = artifacts.slice(0, max);
  return picks.map((f) => {
    const base = path.basename(f.path, '.md');
    const title = slugToTitle(base);
    const rel = path.relative(sectionDir, f.path).split(path.sep).join('/');
    return {
      title,
      rel,
      display: title,
      summary: firstBodyLine(f.path),
    };
  });
}

function deriveMeceTree(section, artifacts, sectionDir) {
  const lines = [`- **${section.name}**`];
  if (artifacts.length === 0) {
    lines.push('  - *(no artifacts filed yet -- tree empty)*');
    return lines.join('\n');
  }
  // Bucket into thirds: primary / supporting / gaps
  const third = Math.ceil(artifacts.length / 2);
  const primary = artifacts.slice(0, third);
  const supporting = artifacts.slice(third);
  lines.push('  - Primary evidence');
  for (const f of primary) {
    const base = path.basename(f.path, '.md');
    const rel = path.relative(sectionDir, f.path).split(path.sep).join('/');
    lines.push(`    - [[${rel}|${slugToTitle(base)}]]`);
  }
  if (supporting.length > 0) {
    lines.push('  - Supporting evidence');
    for (const f of supporting) {
      const base = path.basename(f.path, '.md');
      const rel = path.relative(sectionDir, f.path).split(path.sep).join('/');
      lines.push(`    - [[${rel}|${slugToTitle(base)}]]`);
    }
  }
  lines.push('  - Open dimension (gap)');
  lines.push('    - *(no artifact yet)*');
  return lines.join('\n');
}

function deriveGaps(section, artifacts) {
  const heuristics = GAP_HEURISTICS[section.name] || [
    'additional artifacts for MECE coverage',
  ];
  const count = artifacts.length;
  const gaps = [];
  if (count < 3) {
    gaps.push(
      `Thin coverage: only ${count} artifact${count === 1 ? '' : 's'} filed (minimum 3 recommended)`
    );
  }
  for (const h of heuristics.slice(0, 3)) {
    gaps.push(`Missing: ${h}`);
  }
  return gaps;
}

function findRelatedSections(currentSection, room) {
  // Siblings are top-level sections (or sections inside the same sub-room)
  const sameScope = currentSection.isSubRoom
    ? room.subRooms
        .find((sr) => sr.name === currentSection.subRoomName)
        ?.sections || []
    : room.sections;
  return sameScope
    .filter((s) => s.name !== currentSection.name)
    .map((s) => s.name)
    .sort();
}

// ---------- Rendering ----------

function renderSectionMinto(section, artifacts, room, preserved) {
  const title = slugToTitle(section.name);
  const date = today();
  const parentRel = path
    .relative(section.dir, path.join(section.parentRoomDir, 'STATE.md'))
    .split(path.sep)
    .join('/');
  const governingThought = deriveGoverningThought(section, artifacts);
  const claims = deriveClaims(artifacts, section.dir);
  const meceTree = deriveMeceTree(section, artifacts, section.dir);
  const gaps = deriveGaps(section, artifacts);
  const siblings = findRelatedSections(section, room);

  const sourcesArr = artifacts.map((f) =>
    path.relative(section.dir, f.path).split(path.sep).join('/')
  );
  const relatedArr = siblings.map((s) => `../${s}/MINTO.md`);

  const claimSections = [];
  claims.forEach((c, i) => {
    claimSections.push(`### Claim ${i + 1}: ${c.title}`);
    claimSections.push('');
    claimSections.push('> [!example] Evidence');
    claimSections.push(`> Source: [[${c.rel}|${c.display}]]`);
    claimSections.push(`> -- ${c.summary}`);
    claimSections.push('');
  });

  const gapLines = gaps.map((g) => `> - ${g}`);
  const crossRefLines =
    siblings.length === 0
      ? ['- *(no sibling sections to cross-reference)*']
      : siblings.map((s) => `- [[../${s}/MINTO.md|${s} reasoning]]`);

  const sourceArtifactLines = artifacts.map((f) => {
    const base = path.basename(f.path, '.md');
    const rel = path.relative(section.dir, f.path).split(path.sep).join('/');
    return `- [[${rel}|${slugToTitle(base)}]]`;
  });

  // Phase 88-00: five v88 frontmatter fields appended after existing
  // structural keys, before the closing `---`. Preserved values come from
  // the previous file (if any); last_generated_at is always fresh.
  const v88Lines = renderV88FrontmatterLines(
    preserved || {
      last_artifact_write_seen_at: null,
      reasoning_health_score: null,
      flagged_weaknesses: [],
      decision_log: [],
    }
  );

  // Phase 88-04-B: invariants validator (88-00-B) requires schema_version
  // and governing_thought as top-level frontmatter keys. Tier-0 reuses the
  // derived placeholder governingThought so the contract is satisfied even
  // without an LLM-produced narrative.
  const gtTier0Escaped = String(governingThought).replace(/"/g, '\\"');
  return [
    '---',
    'schema_version: "' + FEYNMAN_MINTO_SCHEMA_VERSION + '"',
    'type: section-minto',
    `section: ${section.name}`,
    `created: ${date}`,
    `room: ${room.roomName}`,
    'parent-moc: ROOM.md',
    'methodology: minto-pyramid',
    `sources: [${sourcesArr.join(', ')}]`,
    `related: [${relatedArr.join(', ')}]`,
    'status: active',
    'governing_thought: "' + gtTier0Escaped + '"',
    ...v88Lines,
    '---',
    '',
    `# ${title} -- Minto Reasoning`,
    '',
    '> [!abstract] Governing Thought',
    `> ${governingThought}`,
    '> *(Auto-generated placeholder -- refine after first read.)*',
    '',
    '## Argument Structure',
    '',
    '> [!info] Pyramid Logic',
    `> This section's artifacts collectively argue: ${governingThought}`,
    `> Supported by ${claims.length} key claim${claims.length === 1 ? '' : 's'} drawn from the artifacts below.`,
    '',
    '## Key Claims',
    '',
    ...claimSections,
    '## MECE Issue Tree',
    '',
    meceTree,
    '',
    '## Evidence Gaps',
    '',
    '> [!warning] Missing Evidence',
    ...gapLines,
    '',
    '## Cross-References',
    '',
    ...crossRefLines,
    '',
    '## Source Artifacts',
    '',
    ...sourceArtifactLines,
    '',
    '## Navigation',
    '',
    `- Section identity: [[ROOM.md|${section.name} ROOM]]`,
    `- Section status: [[STATE.md|${section.name} STATE]]`,
    `- Parent room: [[${parentRel}|${room.roomName}]]`,
    '',
    '---',
    `*Filed by MindrianOS -- Section MINTO -- ${date} -- ${room.roomName}/${section.name}*`,
    '',
  ].join('\n');
}

// ---------- Phase 81-01: plan/write subcommand support ----------

const { validateNarrative } = require('../lib/memory/narrative-schema.cjs');
const {
  compressToAaak,
  attachAaakFooter,
} = require('../lib/memory/aaak-compress.cjs');

// Phase 88-04-B: atomic write contract -- invariants validator and write-lock.
// Required so broken narratives / torn reads cannot contaminate cross-session
// memory. The validator lives in lib/core/ and is the single source of truth
// for "properly managed" per 88-00-B. acquireLock / releaseLock reuse the
// Phase 87-02 openSync('wx') primitive so concurrent producers (post-write +
// debouncer + on-stop drain) cannot corrupt the rename race.
const feynmanMintoInvariants = require('../lib/core/feynman-minto-invariants.cjs');
const { acquireLock, releaseLock } = require('../lib/core/write-lock.cjs');

// Phase 90-02: post-regen hook for the brain-derivation queue. After a
// successful MINTO.md write, compare prior governing_thought sha256 against
// the new value's sha256. If they differ, enqueue brain-derivation so the
// next UserPromptSubmit drains and refreshes BRAIN.md asynchronously.
//
// Canon Part 8: the queue carries ONLY the section slug + sha256 hash pair
// + ISO timestamp + reason. The governing_thought TEXT never appears in
// the queue. Queue module is required lazily so the generator stays usable
// in test environments where the queue module may not be on the path.
const crypto = require('node:crypto');

function brainDerivationQueueModule() {
  try {
    return require('../lib/core/brain-derivation-queue.cjs');
  } catch (_e) {
    return null;
  }
}

// Extract governing_thought from a MINTO.md raw body. Mirrors the parser
// used by parseMintoMd (lib/core/folder-memory-shared.cjs). Frontmatter
// scalar OR first body line under "## Governing Thought" heading.
function extractGoverningThought(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return '';
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) {
    const fm = fmMatch[1];
    const m = fm.match(/^governing_thought:\s*(.+)$/m);
    if (m) {
      let v = m[1].trim();
      if ((v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      // Unescape standard YAML double-quote escapes.
      v = v.replace(/\\"/g, '"');
      return v;
    }
  }
  // Body fallback: first non-empty paragraph after the "## Governing Thought" heading.
  const bodyIdx = raw.indexOf('## Governing Thought');
  if (bodyIdx !== -1) {
    const slice = raw.slice(bodyIdx).split(/\r?\n/);
    for (let i = 1; i < slice.length; i++) {
      const t = slice[i].trim();
      if (!t) continue;
      if (t.startsWith('#')) break;
      if (t.startsWith('>')) {
        return t.replace(/^>+\s*/, '').trim();
      }
      return t;
    }
  }
  return '';
}

function sha256GoverningThought(text) {
  return 'sha256:' + crypto.createHash('sha256')
    .update(String(text == null ? '' : text).normalize('NFC'))
    .digest('hex');
}

// Read the prior MINTO.md (if present) and return its governing_thought
// sha256, or null when no prior file exists. Called BEFORE the new write
// lands so the post-write enqueue hook can detect a change.
function readPriorGoverningThoughtHash(targetPath) {
  let raw;
  try {
    raw = fs.readFileSync(targetPath, 'utf-8');
  } catch (_e) {
    return null;
  }
  const gt = extractGoverningThought(raw);
  if (!gt) return null;
  return sha256GoverningThought(gt);
}

// Post-regen hook: after MINTO.md is successfully written, compare hashes
// and enqueue brain-derivation when they differ. Soft-fail on any error
// so the generator's primary contract is never broken by a queue failure.
function tryEnqueueBrainDerivation(roomDir, mintoPath, newContent, priorHash) {
  try {
    const Q = brainDerivationQueueModule();
    if (!Q) return;
    const sectionDir = path.dirname(mintoPath);
    const sectionSlug = path.basename(sectionDir);
    // Sanity: only enqueue when section name is a valid slug (skips
    // top-level room-root MINTO.md cases where the dirname is the room).
    const slugSafe = /^[a-z0-9][a-z0-9_-]{0,63}$/.test(sectionSlug);
    if (!slugSafe) return;
    const newGt = extractGoverningThought(newContent);
    const newHash = sha256GoverningThought(newGt);
    if (priorHash !== null && priorHash === newHash) return; // no change
    Q.enqueue(roomDir, sectionSlug, priorHash, newHash, 'governing_thought_changed');
  } catch (_e) {
    // Soft-fail: queue enqueue must never disrupt MINTO write.
  }
}

// Phase 88-04-B: schema_version constant emitted into every MINTO.md
// frontmatter. Required by the invariants validator (88-00-B) so the
// atomic write gate accepts generator output.
const FEYNMAN_MINTO_SCHEMA_VERSION = '1.0';

// ---------- Phase 81-03: tier-0 single entry point ----------

/**
 * Run the tier-0 deterministic path: pre-81 renderSectionMinto content
 * plus an AAAK compressed footer. This is the single entry point for all
 * three tier-0 branches:
 *
 *   1. --write without --narrative (intentional tier-0)
 *   2. --write --narrative <path> where the file fails to parse
 *   3. --write --narrative <path> where the schema is invalid
 *
 * @param {object} args
 * @param {string} args.roomDir - absolute path to room directory
 * @param {string} args.sectionName - section slug
 * @param {boolean} [args.dryRun=false]
 * @returns {{tier: string, path: string, size: number, warnings: string[]}}
 */
function runTier0(args) {
  const roomDir = args.roomDir;
  const sectionName = args.sectionName;
  const dryRun = !!args.dryRun;

  const resolved = resolveSection(roomDir, sectionName);
  const target = path.join(resolved.section.dir, 'MINTO.md');
  // Phase 88-00: read-before-write so v88 fields preserve across regen.
  const preserved = readPreservedV88Fields(target);
  // Pre-81 structural generation, preserved byte-equivalent.
  const structuralBody = renderSectionMinto(
    resolved.section,
    resolved.artifacts,
    resolved.room,
    preserved
  );
  // Deterministic AAAK compression of the structural body.
  const aaak = compressToAaak(structuralBody, {
    section: resolved.section.name,
    room: resolved.room.roomName,
  });
  const content = attachAaakFooter(structuralBody, aaak);

  if (dryRun) {
    process.stdout.write(
      'would write tier-0 MINTO.md: ' + target + ' (' + content.length + ' bytes)\n'
    );
    return {
      tier: 'tier-0',
      path: target,
      size: content.length,
      warnings: [],
      envelope: {
        success: true,
        violations: [],
        bytes_written: content.length,
        elapsed_ms: 0,
        path: target,
      },
    };
  }
  // Phase 88-04-B: atomic write + invariants gate + write-lock rename race.
  const env = atomicWriteMinto(target, content, roomDir);
  if (env.success) {
    process.stdout.write('wrote tier-0 MINTO.md: ' + target + '\n');
  } else {
    process.stderr.write(
      'tier-0 write REJECTED by invariants gate for ' +
        target +
        ': ' +
        JSON.stringify(env.violations) +
        '\n'
    );
  }
  return {
    tier: 'tier-0',
    path: target,
    size: env.success ? content.length : 0,
    warnings: env.violations,
    envelope: env,
  };
}

function resolveSection(roomDir, sectionName) {
  const room = scanRoom(roomDir);
  const sections = walkAllSections(room);
  const section = sections.find(function (s) {
    return s.name === sectionName;
  });
  if (!section) {
    throw new Error(
      'section not found in room: ' +
        sectionName +
        ' (available: ' +
        sections.map(function (s) { return s.name; }).join(', ') +
        ')'
    );
  }
  const artifacts = collectSectionArtifacts(section.dir, room.contentFiles);
  return { room: room, section: section, artifacts: artifacts };
}

function buildStructuralPayload(room, section, artifacts) {
  // Reuse the existing deterministic helpers so there is one source of
  // truth for the structural content. Nothing here calls the LLM.
  const governingPlaceholder = deriveGoverningThought(section, artifacts);
  const meceTree = deriveMeceTree(section, artifacts, section.dir);
  const gaps = deriveGaps(section, artifacts);
  const siblings = findRelatedSections(section, room);
  const sources = artifacts.map(function (f) {
    return path.relative(section.dir, f.path).split(path.sep).join('/');
  });
  const parentRel = path
    .relative(section.dir, path.join(section.parentRoomDir, 'STATE.md'))
    .split(path.sep)
    .join('/');

  return {
    frontmatter: {
      type: 'section-minto',
      section: section.name,
      created: today(),
      room: room.roomName,
      'parent-moc': 'ROOM.md',
      methodology: 'feynman-minto',
      sources: sources,
      related: siblings.map(function (s) { return '../' + s + '/MINTO.md'; }),
      status: 'active',
    },
    mece_tree: meceTree,
    cross_refs: siblings,
    sources: sources,
    navigation: {
      parent_room: parentRel,
      room_name: room.roomName,
      section_name: section.name,
    },
    gaps: gaps,
    governing_thought_placeholder: governingPlaceholder,
  };
}

function buildArtifactPayload(section, artifacts) {
  return artifacts.map(function (f) {
    const base = path.basename(f.path, '.md');
    const title = slugToTitle(base);
    const rel = path.relative(section.dir, f.path).split(path.sep).join('/');
    return {
      path: rel,
      title: title,
      excerpt: firstBodyLine(f.path),
    };
  });
}

function emitSectionPlanPayload(roomDir, sectionName) {
  const resolved = resolveSection(roomDir, sectionName);
  const structural = buildStructuralPayload(
    resolved.room,
    resolved.section,
    resolved.artifacts
  );
  const artifactList = buildArtifactPayload(
    resolved.section,
    resolved.artifacts
  );
  const targetMinto = path
    .relative(
      resolved.room.roomDir,
      path.join(resolved.section.dir, 'MINTO.md')
    )
    .split(path.sep)
    .join('/');
  const payload = {
    section_path: path
      .relative(resolved.room.roomDir, resolved.section.dir)
      .split(path.sep)
      .join('/'),
    section_name: resolved.section.name,
    artifacts: artifactList,
    target_minto_path: targetMinto,
    structural: structural,
  };
  return payload;
}

function renderFeynmanMinto(structural, narrative, room, section, artifacts, preserved) {
  const title = slugToTitle(section.name);
  const date = structural.frontmatter.created;
  const mm = narrative.mental_model;

  // Phase 88-00: five v88 frontmatter fields appended after existing
  // structural keys, before the closing `---`. Preserved values come from
  // the previous file (if any); last_generated_at is always fresh.
  const v88Lines = renderV88FrontmatterLines(
    preserved || {
      last_artifact_write_seen_at: null,
      reasoning_health_score: null,
      flagged_weaknesses: [],
      decision_log: [],
    }
  );

  // Frontmatter (YAML-ish, consistent with pre-81 style). Phase 88-04-B
  // adds schema_version and governing_thought as top-level keys so the
  // invariants validator (88-00-B) accepts the tier-1 output. The
  // governing_thought comes straight from the Feynman narrative JSON.
  const fm = structural.frontmatter;
  const gtTier1Escaped = String(narrative.governing_thought || '').replace(/"/g, '\\"');
  const fmLines = [
    '---',
    'schema_version: "' + FEYNMAN_MINTO_SCHEMA_VERSION + '"',
    'type: ' + fm.type,
    'section: ' + fm.section,
    'created: ' + fm.created,
    'room: ' + fm.room,
    'parent-moc: ' + fm['parent-moc'],
    'methodology: ' + fm.methodology,
    'sources: [' + fm.sources.join(', ') + ']',
    'related: [' + fm.related.join(', ') + ']',
    'status: ' + fm.status,
    'governing_thought: "' + gtTier1Escaped + '"',
    ...v88Lines,
    '---',
  ];

  const keyClaimLines = [];
  narrative.key_claims.forEach(function (claim, i) {
    keyClaimLines.push('### Claim ' + (i + 1));
    keyClaimLines.push('');
    keyClaimLines.push('> [!example] Claim');
    keyClaimLines.push('> ' + claim);
    keyClaimLines.push('');
  });

  const crossRefLines =
    structural.cross_refs.length === 0
      ? ['- *(no sibling sections to cross-reference)*']
      : structural.cross_refs.map(function (s) {
          return '- [[../' + s + '/MINTO.md|' + s + ' reasoning]]';
        });

  const sourceArtifactLines = artifacts.map(function (f) {
    const base = path.basename(f.path, '.md');
    const rel = path.relative(section.dir, f.path).split(path.sep).join('/');
    return '- [[' + rel + '|' + slugToTitle(base) + ']]';
  });

  const gapLines = structural.gaps.map(function (g) { return '> - ' + g; });

  return [].concat(
    fmLines,
    [
      '',
      '# ' + title + ' -- Feynman-MINTO Reasoning',
      '',
      '> [!abstract] Governing Thought',
      '> ' + narrative.governing_thought,
      '',
      '## Essence',
      '',
      '> [!quote] Irreducible Truth',
      '> ' + narrative.essence,
      '',
      '## Plain Language',
      '',
      narrative.plain_language,
      '',
      '## Mental Model',
      '',
      '> [!tip] Analogy',
      '> ' + mm.analogy,
      '',
      '**Mapping:** ' + mm.mapping,
      '',
      '**Where it breaks:** ' + mm.limits,
      '',
      '## Sweet Spot',
      '',
      narrative.sweet_spot,
      '',
      '## Key Claims',
      '',
    ],
    keyClaimLines,
    [
      '## MECE Issue Tree',
      '',
      structural.mece_tree,
      '',
      '## Evidence Gaps',
      '',
      '> [!warning] Missing Evidence',
    ],
    gapLines,
    [
      '',
      '## Cross-References',
      '',
    ],
    crossRefLines,
    [
      '',
      '## Source Artifacts',
      '',
    ],
    sourceArtifactLines,
    [
      '',
      '## Navigation',
      '',
      '- Section identity: [[ROOM.md|' + section.name + ' ROOM]]',
      '- Section status: [[STATE.md|' + section.name + ' STATE]]',
      '- Parent room: [[' +
        structural.navigation.parent_room +
        '|' +
        room.roomName +
        ']]',
      '',
      '---',
      '*Filed by MindrianOS -- Feynman-MINTO -- ' +
        date +
        ' -- ' +
        room.roomName +
        '/' +
        section.name +
        '*',
      '',
    ]
  ).join('\n');
}

// ---------- Phase 88-04-B: atomic write contract ----------
//
// Every MINTO.md publish goes through atomicWriteMinto(). Sequence:
//   1. openSync(tmp, 'wx')           -- exclusive create, EEXIST cleanup
//   2. writeSync + fsyncSync         -- crash-safe durability
//   3. closeSync                     -- release fd
//   4. invariants.validate(tmp)      -- gate BEFORE rename so a broken
//                                       narrative cannot overwrite a valid
//                                       previous MINTO.md
//   5. acquireLock(roomDir)          -- Phase 87-02 primitive; serializes
//                                       concurrent renames across producers
//   6. renameSync(tmp, target)       -- atomic publish
//   7. releaseLock(roomDir)
//
// Tmp naming convention: <target>.tmp.<pid>.minto
// Phase 88-13 guardian sweeps stale orphans matching this pattern at
// session-start (mid-write SIGKILL leaves orphans; guardian cleans them).
//
// Test hooks (all gated behind MOS_TEST=1 so production is unaffected):
//   MOS_TRACE_FS=1                   -- stderr logs "TRACE_FS fsyncSync"
//                                       and "TRACE_FS renameSync" lines so
//                                       Test 7 can assert ordering.
//   MOS_TEST_ABORT_AFTER_FSYNC=1     -- exit(42) AFTER fsync but BEFORE
//                                       rename, leaving an orphan tmp and
//                                       preserving the previous MINTO.md.
//                                       Proves Test 3 crash-safety.

// Mock severity parsing is CLI-level (parsed from argv in the entry block).
// Default is null meaning "use the real validator".
let MOCK_INVARIANTS_FAIL = null;

function traceFs(name) {
  if (process.env.MOS_TRACE_FS === '1') {
    process.stderr.write('TRACE_FS ' + name + '\n');
  }
}

// Synthetic violations injected when MOS_TEST=1 and --mock-invariants-fail is
// set. Lets Test 4 (ERROR rejection) and Test 5 (WARNING passthrough) verify
// the gate behavior without engineering a 1500-token narrative.
function buildMockViolations(severityName) {
  const SEV = feynmanMintoInvariants.SEVERITY;
  const CAT = feynmanMintoInvariants.CATEGORIES;
  if (severityName === 'error') {
    return [
      {
        category: CAT.SCHEMA,
        severity: SEV.ERROR,
        message: 'mock-invariants-fail=error injected for test',
      },
    ];
  }
  if (severityName === 'warning') {
    return [
      {
        category: CAT.COHERENCE,
        severity: SEV.WARNING,
        message: 'mock-invariants-fail=warning injected for test',
      },
    ];
  }
  if (severityName === 'critical') {
    return [
      {
        category: CAT.ATOMICITY,
        severity: SEV.CRITICAL,
        message: 'mock-invariants-fail=critical injected for test',
      },
    ];
  }
  return [];
}

function atomicWriteMinto(mintoPath, content, roomDir) {
  const start = Date.now();
  const tmpPath = mintoPath + '.tmp.' + process.pid + '.minto';
  const SEV = feynmanMintoInvariants.SEVERITY;

  // Phase 90-02: capture prior governing_thought hash BEFORE the write so
  // the post-rename enqueue can detect a real change. Soft-fail on read
  // failure (no prior file -> priorHash stays null -> first regen always
  // enqueues, which is the correct cold-start behavior).
  const priorGoverningThoughtHash = readPriorGoverningThoughtHash(mintoPath);

  let fd;
  try {
    fd = fs.openSync(tmpPath, 'wx');
  } catch (e) {
    if (e.code === 'EEXIST') {
      // Stale tmp from a prior crash with the same pid slot. Clear and
      // retry once; Phase 88-13 guardian is the long-term sweeper.
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      fd = fs.openSync(tmpPath, 'wx');
    } else {
      throw e;
    }
  }

  try {
    fs.writeSync(fd, content);
    traceFs('fsyncSync');
    fs.fsyncSync(fd);
  } finally {
    try { fs.closeSync(fd); } catch (_) {}
  }

  // Test hook: simulate mid-write crash. Exit before rename so the previous
  // MINTO.md stays intact and an orphan tmp is left for guardian cleanup.
  if (
    process.env.MOS_TEST === '1' &&
    process.env.MOS_TEST_ABORT_AFTER_FSYNC === '1'
  ) {
    process.stderr.write(
      'TEST_HOOK abort-after-fsync: exiting before rename (tmp=' + tmpPath + ')\n'
    );
    process.exit(42);
  }

  // --- Invariants gate ---
  let validation;
  if (
    process.env.MOS_TEST === '1' &&
    MOCK_INVARIANTS_FAIL !== null
  ) {
    const mockViolations = buildMockViolations(MOCK_INVARIANTS_FAIL);
    // Derive severity from the highest-severity synthetic violation.
    const order = [SEV.INFO, SEV.WARNING, SEV.ERROR, SEV.CRITICAL];
    let maxIdx = -1;
    for (const v of mockViolations) {
      const idx = order.indexOf(v.severity);
      if (idx > maxIdx) maxIdx = idx;
    }
    validation = {
      valid: mockViolations.length === 0,
      violations: mockViolations,
      severity: maxIdx === -1 ? null : order[maxIdx],
    };
  } else {
    validation = feynmanMintoInvariants.validate(tmpPath);
  }

  const blocking = validation.violations.filter(function (v) {
    return v.severity === SEV.CRITICAL || v.severity === SEV.ERROR;
  });
  if (blocking.length > 0) {
    // Broken output -- do NOT overwrite the previous MINTO.md. Clean up.
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    return {
      success: false,
      violations: validation.violations,
      bytes_written: 0,
      elapsed_ms: Date.now() - start,
      path: mintoPath,
    };
  }

  // --- Atomic publish under lock ---
  // Concurrent producers race on the lock; the primitive throws when
  // another live PID owns it. Retry with backoff so bursty post-write +
  // debouncer + on-stop drains do not need coordination above this layer.
  // A final lock-failure still unlinks the tmp to avoid orphan leaks.
  let locked = false;
  let lockErr = null;
  const LOCK_RETRIES = 12;
  const LOCK_BASE_MS = 25;
  const LOCK_CAP_MS = 1600;
  for (let attempt = 0; attempt < LOCK_RETRIES; attempt++) {
    try {
      acquireLock(roomDir);
      locked = true;
      lockErr = null;
      break;
    } catch (e) {
      lockErr = e;
      // Exponential backoff with half-jitter; synchronous so we do not
      // need event-loop integration in hook scripts.
      const backoff = Math.min(LOCK_CAP_MS, LOCK_BASE_MS * Math.pow(2, attempt));
      const sleep = Math.floor(backoff / 2 + Math.random() * (backoff / 2));
      const end = Date.now() + sleep;
      while (Date.now() < end) { /* busy-wait per 88-02 sync primitive */ }
    }
  }
  if (!locked) {
    // Lock acquisition exhausted retries. Unlink tmp so disk stays clean;
    // surface as blocking violation so the caller does not assume success.
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    return {
      success: false,
      violations: validation.violations.concat([{
        category: feynmanMintoInvariants.CATEGORIES.ATOMICITY,
        severity: SEV.ERROR,
        message: 'write-lock acquire failed after ' + LOCK_RETRIES + ' retries: ' +
          (lockErr && lockErr.message || lockErr),
      }]),
      bytes_written: 0,
      elapsed_ms: Date.now() - start,
      path: mintoPath,
    };
  }

  try {
    traceFs('renameSync');
    fs.renameSync(tmpPath, mintoPath);
  } finally {
    if (locked) {
      try { releaseLock(roomDir); } catch (_) {}
    }
  }

  // Phase 90-02: post-regen hook into the brain-derivation queue. Compares
  // governing_thought sha256 against the prior file's hash captured before
  // the write. Soft-fails internally so a queue error never breaks the
  // primary MINTO contract.
  tryEnqueueBrainDerivation(roomDir, mintoPath, content, priorGoverningThoughtHash);

  return {
    success: true,
    violations: validation.violations,
    bytes_written: content.length,
    elapsed_ms: Date.now() - start,
    path: mintoPath,
  };
}

function writeSectionFromNarrative(roomDir, sectionName, narrativePath, opts) {
  const options = opts || {};

  // Phase 81-03: soft validation with fallthrough to runTier0.
  // Malformed file, unparseable JSON, or invalid schema all route to
  // tier-0 with a warning printed to stderr.
  let raw;
  try {
    raw = fs.readFileSync(narrativePath, 'utf-8');
  } catch (e) {
    process.stderr.write(
      'WARN tier-0 path: narrative file read failed: ' +
        narrativePath +
        ': ' +
        e.message +
        '\n'
    );
    return runTier0({
      roomDir: roomDir,
      sectionName: sectionName,
      dryRun: options.dryRun,
    });
  }

  let narrative;
  try {
    narrative = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(
      'WARN tier-0 path: narrative JSON parse failed: ' +
        narrativePath +
        ': ' +
        e.message +
        ', falling back to tier-0\n'
    );
    return runTier0({
      roomDir: roomDir,
      sectionName: sectionName,
      dryRun: options.dryRun,
    });
  }

  const v = validateNarrative(narrative);
  if (!v.valid) {
    process.stderr.write(
      'WARN tier-0 path: narrative-json failed schema validation: ' +
        narrativePath +
        ': ' +
        v.errors.join('; ') +
        ', falling back to tier-0\n'
    );
    return runTier0({
      roomDir: roomDir,
      sectionName: sectionName,
      dryRun: options.dryRun,
    });
  }

  const resolved = resolveSection(roomDir, sectionName);
  const target = path.join(resolved.section.dir, 'MINTO.md');
  // Phase 88-00: read-before-write so v88 fields preserve across regen.
  const preserved = readPreservedV88Fields(target);
  const structural = buildStructuralPayload(
    resolved.room,
    resolved.section,
    resolved.artifacts
  );
  const content = renderFeynmanMinto(
    structural,
    narrative,
    resolved.room,
    resolved.section,
    resolved.artifacts,
    preserved
  );

  if (options.dryRun) {
    process.stdout.write(
      'would write MINTO.md: ' + target + ' (' + content.length + ' bytes)\n'
    );
    return {
      tier: 'tier-1',
      path: target,
      content: content,
      outcome: 'planned',
      envelope: {
        success: true,
        violations: [],
        bytes_written: content.length,
        elapsed_ms: 0,
        path: target,
      },
    };
  }
  // Phase 88-04-B: atomic write + invariants gate. A rejection keeps the
  // previous MINTO.md intact; caller inspects envelope.success.
  const env = atomicWriteMinto(target, content, roomDir);
  if (env.success) {
    process.stdout.write('wrote MINTO.md: ' + target + '\n');
  } else {
    process.stderr.write(
      'tier-1 write REJECTED by invariants gate for ' +
        target +
        ': ' +
        JSON.stringify(env.violations) +
        '\n'
    );
  }
  return {
    tier: 'tier-1',
    path: target,
    content: content,
    outcome: env.success ? 'written' : 'rejected',
    envelope: env,
  };
}

// ---------- Idempotent write ----------

function writeOrPrint(targetPath, content, dryRun, roomDir) {
  let existing = null;
  try {
    existing = fs.readFileSync(targetPath, 'utf-8');
  } catch (_) {
    /* fresh */
  }
  if (existing === content) {
    if (dryRun) process.stdout.write(`skip (identical): ${targetPath}\n`);
    return 'skipped';
  }
  if (dryRun) {
    process.stdout.write(
      `would write MINTO.md: ${targetPath} (${content.length} bytes)\n`
    );
    return 'planned';
  }
  // Phase 88-04-B: route legacy bare-shell path through the same atomic
  // contract so batch regenerations cannot produce torn reads or let a
  // broken narrative overwrite a previous valid MINTO.md.
  if (roomDir) {
    const env = atomicWriteMinto(targetPath, content, roomDir);
    if (env.success) {
      process.stdout.write(`wrote MINTO.md: ${targetPath}\n`);
      return 'written';
    }
    process.stderr.write(
      'bare-shell write REJECTED for ' +
        targetPath +
        ': ' +
        JSON.stringify(env.violations) +
        '\n'
    );
    return 'skipped';
  }
  // Legacy fallback (no roomDir known) -- preserve pre-88-04-B semantics.
  const tmp = targetPath + '.tmp';
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, targetPath);
  process.stdout.write(`wrote MINTO.md: ${targetPath}\n`);
  return 'written';
}

// ---------- Main ----------

function generateAllSectionMintos(roomDir, opts = {}) {
  const dryRun = !!opts.dryRun;
  const sectionFilter = opts.sectionFilter || null;
  const room = scanRoom(roomDir);
  const sections = walkAllSections(room);
  const results = {
    planned: 0,
    written: 0,
    skipped: 0,
    empty_skipped: 0,
    total: 0,
  };

  for (const section of sections) {
    if (sectionFilter && section.name !== sectionFilter) continue;
    if (!fs.existsSync(section.dir)) continue;
    results.total += 1;

    const artifacts = collectSectionArtifacts(section.dir, room.contentFiles);

    // SECTION-07: skip empty sections (do not write MINTO.md)
    if (artifacts.length === 0) {
      results.empty_skipped += 1;
      process.stdout.write(`skip ${section.name}: empty (no artifacts)\n`);
      continue;
    }

    const target = path.join(section.dir, 'MINTO.md');
    // Phase 88-00: read-before-write so v88 fields preserve across regen.
    const preserved = readPreservedV88Fields(target);
    const content = renderSectionMinto(section, artifacts, room, preserved);
    // Phase 88-04-B: pass the room directory so writeOrPrint can route
    // through the atomic write contract (openSync 'wx' + fsync +
    // invariants gate + acquireLock + rename).
    const outcome = writeOrPrint(target, content, dryRun, roomDir);
    results[outcome] = (results[outcome] || 0) + 1;
  }

  process.stdout.write(
    `\nSection MINTO generator summary for ${room.roomName}: ` +
      `${results.total} sections walked -- ` +
      `written=${results.written || 0} planned=${results.planned || 0} ` +
      `skipped=${results.skipped || 0} empty_skipped=${results.empty_skipped}\n`
  );

  return results;
}

if (require.main === module) {
  if (!roomArg) {
    usage();
    process.exit(1);
  }
  const ROOM_DIR = path.resolve(roomArg);
  if (!fs.existsSync(ROOM_DIR)) {
    process.stderr.write('ERROR: room dir does not exist: ' + ROOM_DIR + '\n');
    process.exit(1);
  }
  try {
    if (PLAN_FLAG) {
      if (!SECTION_FILTER) {
        process.stderr.write('ERROR: --plan requires --section <name>\n');
        process.exit(1);
      }
      const payload = emitSectionPlanPayload(ROOM_DIR, SECTION_FILTER);
      process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    } else if (WRITE_FLAG) {
      if (!SECTION_FILTER) {
        process.stderr.write('ERROR: --write requires --section <name>\n');
        process.exit(1);
      }
      // Phase 88-04-B: propagate CLI mock flag to the atomic-write gate.
      // Gated by MOS_TEST=1 inside atomicWriteMinto; belt-and-suspenders
      // check here keeps production config changes visibly rejected.
      if (MOCK_INVARIANTS_FAIL_CLI && process.env.MOS_TEST !== '1') {
        process.stderr.write(
          'ERROR: --mock-invariants-fail requires MOS_TEST=1 (test-only flag)\n'
        );
        process.exit(1);
      }
      MOCK_INVARIANTS_FAIL = MOCK_INVARIANTS_FAIL_CLI;
      let result;
      if (!NARRATIVE_PATH) {
        // Phase 81-03: no narrative means tier-0 path. Route through the
        // single runTier0 entry point which appends an AAAK footer.
        process.stderr.write(
          'WARN tier-0 path: no narrative provided, running tier-0 for section ' +
            SECTION_FILTER +
            '\n'
        );
        result = runTier0({
          roomDir: ROOM_DIR,
          sectionName: SECTION_FILTER,
          dryRun: DRY_RUN,
        });
      } else {
        result = writeSectionFromNarrative(ROOM_DIR, SECTION_FILTER, NARRATIVE_PATH, {
          dryRun: DRY_RUN,
        });
      }
      // Phase 88-04-B: machine-parsable envelope. Callers (88-04 post-write
      // hook, 88-06 on-stop drain, 88-13 guardian) read this to know
      // whether the write landed or the invariants gate rejected it.
      if (result && result.envelope) {
        process.stdout.write(JSON.stringify(result.envelope) + '\n');
      }
    } else {
      // Legacy / bare-shell path: preserved verbatim.
      generateAllSectionMintos(ROOM_DIR, {
        dryRun: DRY_RUN,
        sectionFilter: SECTION_FILTER,
      });
    }
  } catch (e) {
    process.stderr.write('ERROR: ' + e.message + '\n');
    process.exit(2);
  }
}

module.exports = {
  generateAllSectionMintos,
  renderSectionMinto,
  collectSectionArtifacts,
  deriveGoverningThought,
  readGoverningThoughtFromGraph,
  deriveClaims,
  deriveMeceTree,
  deriveGaps,
  findRelatedSections,
  // Phase 81-01 additions
  emitSectionPlanPayload,
  writeSectionFromNarrative,
  renderFeynmanMinto,
  buildStructuralPayload,
  buildArtifactPayload,
  // Phase 81-03 additions
  runTier0,
  // Phase 88-04-B addition
  atomicWriteMinto,
};
