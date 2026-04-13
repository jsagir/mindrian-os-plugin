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

function deriveGoverningThought(section, artifacts) {
  const title = slugToTitle(section.name);
  const n = artifacts.length;
  return `${title} synthesizes ${n} artifact${n === 1 ? '' : 's'} into a coherent argument for this section of the venture.`;
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

function renderSectionMinto(section, artifacts, room) {
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

  return [
    '---',
    'type: section-minto',
    `section: ${section.name}`,
    `created: ${date}`,
    `room: ${room.roomName}`,
    'parent-moc: ROOM.md',
    'methodology: minto-pyramid',
    `sources: [${sourcesArr.join(', ')}]`,
    `related: [${relatedArr.join(', ')}]`,
    'status: active',
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

function renderFeynmanMinto(structural, narrative, room, section, artifacts) {
  const title = slugToTitle(section.name);
  const date = structural.frontmatter.created;
  const mm = narrative.mental_model;

  // Frontmatter (YAML-ish, consistent with pre-81 style).
  const fm = structural.frontmatter;
  const fmLines = [
    '---',
    'type: ' + fm.type,
    'section: ' + fm.section,
    'created: ' + fm.created,
    'room: ' + fm.room,
    'parent-moc: ' + fm['parent-moc'],
    'methodology: ' + fm.methodology,
    'sources: [' + fm.sources.join(', ') + ']',
    'related: [' + fm.related.join(', ') + ']',
    'status: ' + fm.status,
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

function writeSectionFromNarrative(roomDir, sectionName, narrativePath, opts) {
  const options = opts || {};
  const resolved = resolveSection(roomDir, sectionName);

  const raw = fs.readFileSync(narrativePath, 'utf-8');
  let narrative;
  try {
    narrative = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      'narrative JSON parse failed: ' + narrativePath + ': ' + e.message
    );
  }
  const v = validateNarrative(narrative);
  if (!v.valid) {
    throw new Error(
      'narrative schema validation failed: ' +
        narrativePath +
        ': ' +
        v.errors.join('; ')
    );
  }

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
    resolved.artifacts
  );
  const target = path.join(resolved.section.dir, 'MINTO.md');

  if (options.dryRun) {
    process.stdout.write(
      'would write MINTO.md: ' + target + ' (' + content.length + ' bytes)\n'
    );
    return { path: target, content: content, outcome: 'planned' };
  }
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, target);
  process.stdout.write('wrote MINTO.md: ' + target + '\n');
  return { path: target, content: content, outcome: 'written' };
}

// ---------- Idempotent write ----------

function writeOrPrint(targetPath, content, dryRun) {
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

    const content = renderSectionMinto(section, artifacts, room);
    const target = path.join(section.dir, 'MINTO.md');
    const outcome = writeOrPrint(target, content, dryRun);
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
      if (!NARRATIVE_PATH) {
        // Phase 81-01: no narrative means fall through to tier-0 path.
        // 81-03 will wire the AAAK footer here. For 81-01 the behavior is
        // byte-equivalent to the pre-81 deterministic generator.
        generateAllSectionMintos(ROOM_DIR, {
          dryRun: DRY_RUN,
          sectionFilter: SECTION_FILTER,
        });
      } else {
        writeSectionFromNarrative(ROOM_DIR, SECTION_FILTER, NARRATIVE_PATH, {
          dryRun: DRY_RUN,
        });
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
};
