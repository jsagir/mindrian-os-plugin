#!/usr/bin/env node
/**
 * MindrianOS Plugin -- Vault Welcome Doc Generator
 *
 * Produces `Welcome to MindrianOS.md` -- the tier-0 Home Note at the root of
 * any Data Room vault. Adapts to room contents (sections that don't exist are
 * silently omitted). Uses Obsidian callouts for rich formatting.
 *
 * Requirements satisfied: WELCOME-01..04, ARCH-03, ARCH-07.
 *
 * Usage:
 *   node scripts/vault-welcome-generator.cjs <roomDir> [--dry-run] [--out <path>]
 *
 * Exports:
 *   generateWelcome(roomDir) -> string
 *   plus all render* helpers for programmatic composition.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { scanRoom, KNOWN_SECTIONS } = require('../lib/vault/room-scanner.cjs');

// ---------- Ordering ----------

// Canonical section order for deterministic output (WELCOME-04 idempotency).
const SECTION_ORDER = [
  'problem-definition',
  'market-analysis',
  'solution-design',
  'business-model',
  'competitive-analysis',
  'team',
  'team-execution',
  'financial-model',
  'legal-ip',
  'meetings',
  'opportunity-bank',
];

// Graph color legend aligned with RULES-02 (11 canonical colors).
const SECTION_COLORS = {
  'problem-definition': '#E63946',
  'market-analysis': '#1D3557',
  'solution-design': '#2A9D8F',
  'business-model': '#457B9D',
  'competitive-analysis': '#F4A261',
  team: '#E76F51',
  'team-execution': '#B5838D',
  'financial-model': '#06A77D',
  'legal-ip': '#6D597A',
  meetings: '#FFB703',
  'opportunity-bank': '#8338EC',
};

function sortSections(sections) {
  return sections.slice().sort((a, b) => {
    const ai = SECTION_ORDER.indexOf(a.name);
    const bi = SECTION_ORDER.indexOf(b.name);
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function slugDisplay(slug) {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- Render helpers ----------

function renderHeader(room) {
  const fm = [
    '---',
    'type: home-note',
    'tier: 0',
    `room: ${room.roomName}`,
    `created: ${today()}`,
    '---',
    '',
    `# Welcome to MindrianOS -- ${slugDisplay(room.roomName)}`,
    '',
  ];
  return fm.join('\n');
}

function renderOverview(room) {
  const sectionCount = room.sections.length;
  const subRoomCount = room.subRooms.length;
  const teamCount = room.teamProfiles.length;
  const sentence =
    `**${slugDisplay(room.roomName)}** is a MindrianOS Data Room covering ` +
    `${sectionCount} section${sectionCount === 1 ? '' : 's'}` +
    (subRoomCount ? `, ${subRoomCount} sub-room${subRoomCount === 1 ? '' : 's'}` : '') +
    (teamCount ? `, and ${teamCount} team profile${teamCount === 1 ? '' : 's'}` : '') +
    '. This Home Note is the tier-0 entry point -- start here, then dive into any section.';
  return [
    '> [!abstract] Room Overview',
    '> ' + sentence,
    '',
  ].join('\n');
}

function renderHowItWorks(_room) {
  return [
    '> [!info] How This Vault Works',
    '> MindrianOS organizes every Data Room as a 3-tier Map of Content (MOC) hierarchy:',
    '> - **Tier 0 -- Home Note** (this file): the landing page for the whole vault.',
    '> - **Tier 1 -- Section MOCs** (each `<section>/ROOM.md`): identity + routing for one subsystem.',
    '> - **Tier 2 -- Permanent Notes** (artifacts inside each section): the actual claims, evidence, and analysis.',
    '> Obsidian\'s graph view will light up once wikilinks are injected. See the color legend below.',
    '',
  ].join('\n');
}

function renderSectionTable(room) {
  const sections = sortSections(room.sections).filter((s) => s.hasRoom);
  if (sections.length === 0) return '';
  const counts = new Map();
  for (const f of room.contentFiles) {
    if (!f.section) continue;
    counts.set(f.section, (counts.get(f.section) || 0) + 1);
  }
  const lines = [
    '## Sections',
    '',
    '| Section | Artifacts | MOC |',
    '| --- | --- | --- |',
  ];
  for (const s of sections) {
    const artifacts = counts.get(s.name) || 0;
    const display = slugDisplay(s.name);
    lines.push(`| ${display} | ${artifacts} | [[${s.name}/ROOM.md\\|${display}]] |`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderGapWarnings(room) {
  const counts = new Map();
  for (const f of room.contentFiles) {
    if (!f.section) continue;
    counts.set(f.section, (counts.get(f.section) || 0) + 1);
  }
  const gaps = sortSections(room.sections).filter(
    (s) => !s.hasRoom || (counts.get(s.name) || 0) === 0
  );
  if (gaps.length === 0) return '';
  const lines = ['> [!warning] Open Gaps'];
  lines.push('> Sections present as folders but missing identity or content:');
  for (const s of gaps) {
    const reason = !s.hasRoom ? 'no ROOM.md' : '0 artifacts';
    lines.push(`> - **${slugDisplay(s.name)}** -- ${reason}`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderSubRoomArchitecture(room) {
  if (!room.subRooms || room.subRooms.length === 0) return '';
  const sorted = room.subRooms.slice().sort((a, b) => a.name.localeCompare(b.name));
  const lines = [
    '> [!note] Sub-Rooms',
    '> Nested venture subsystems with their own ICM hierarchy:',
  ];
  for (const sr of sorted) {
    const inner = sr.sections.length;
    lines.push(
      `> - [[sub-rooms/${sr.name}/ROOM.md\\|${slugDisplay(sr.name)}]] -- ${inner} inner section${inner === 1 ? '' : 's'}`
    );
  }
  lines.push('');
  return lines.join('\n');
}

function renderTeamRoster(room) {
  if (!room.teamProfiles || room.teamProfiles.length === 0) return '';
  const byCat = new Map();
  for (const p of room.teamProfiles) {
    if (!byCat.has(p.category)) byCat.set(p.category, []);
    byCat.get(p.category).push(p);
  }
  const cats = Array.from(byCat.keys()).sort();
  const lines = ['## Team', ''];
  for (const cat of cats) {
    const people = byCat.get(cat).slice().sort((a, b) => a.displayName.localeCompare(b.displayName));
    lines.push(`### ${slugDisplay(cat)}`);
    lines.push('');
    for (const p of people) {
      lines.push(`- [[team/${p.category}/${p.name}/PROFILE.md\\|${p.displayName}]]`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function renderMeetingIntelligence(room) {
  const meetings = (room.meetings || [])
    .filter((m) => m.hasSummary)
    .slice()
    .sort((a, b) => b.slug.localeCompare(a.slug));
  if (meetings.length === 0) return '';
  const lines = ['## Meetings', ''];
  lines.push('> [!quote] Meeting Intelligence');
  lines.push('> Institutional knowledge lives in conversations. Every filed meeting produces cascade edges.');
  for (const m of meetings) {
    lines.push(`> - [[meetings/${m.slug}/summary.md\\|${m.slug}]]`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderCrossReferences(room) {
  const xrefs = (room.contentFiles || [])
    .filter((f) => f.isXref)
    .slice()
    .sort((a, b) => a.relPath.localeCompare(b.relPath));
  if (xrefs.length === 0) return '';
  const lines = ['## Cross-References', ''];
  for (const f of xrefs) {
    lines.push(`- [[${f.relPath}]]`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderGraphLegend() {
  const lines = [
    '## Graph Color Legend',
    '',
    '> [!tip] Obsidian Graph Colors',
    '> Each section renders in a distinct color in Obsidian\'s graph view.',
    '',
    '| Section | Color |',
    '| --- | --- |',
  ];
  for (const name of SECTION_ORDER) {
    lines.push(`| ${slugDisplay(name)} | \`${SECTION_COLORS[name]}\` |`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderCommandReference() {
  const lines = [
    '## MindrianOS Commands',
    '',
    '> [!example] Essential /mos: Commands',
    '> Run these from the Claude Code CLI to operate on this room.',
    '',
    '| Command | Purpose |',
    '| --- | --- |',
    '| `/mos:status` | Show room health, gaps, and next actions |',
    '| `/mos:grade` | Grade the room against PWS rubrics |',
    '| `/mos:diagnose` | Surface contradictions, convergence, reverse salients |',
    '| `/mos:vault` | Export the room as an Obsidian-ready vault |',
    '| `/mos:room linkify` | Inject wikilinks retroactively across all artifacts |',
    '| `/mos:meeting file` | File a meeting transcript with cascade intelligence |',
    '',
  ];
  return lines.join('\n');
}

function renderBlockerCallout(room) {
  const counts = new Map();
  for (const f of room.contentFiles) {
    if (!f.section) continue;
    counts.set(f.section, (counts.get(f.section) || 0) + 1);
  }
  const blockers = sortSections(room.sections).filter(
    (s) => !s.hasRoom && (counts.get(s.name) || 0) > 0
  );
  if (blockers.length === 0) return '';
  const lines = ['> [!important] Routing Blockers'];
  lines.push('> These sections have content but no ROOM.md -- content may be misfiled or orphaned:');
  for (const s of blockers) {
    lines.push(`> - **${slugDisplay(s.name)}** -- ${counts.get(s.name)} artifact(s) without section identity`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderFooter(room) {
  return [
    '---',
    '',
    `*Filed by MindrianOS -- Welcome (tier-0 MOC) -- ${today()} -- ${room.roomName}*`,
    '',
  ].join('\n');
}

// ---------- Composer ----------

function generateWelcome(roomDir) {
  const room = scanRoom(roomDir);
  const blocks = [
    renderHeader(room),
    renderOverview(room),
    renderHowItWorks(room),
    renderSectionTable(room),
    renderGapWarnings(room),
    renderSubRoomArchitecture(room),
    renderTeamRoster(room),
    renderMeetingIntelligence(room),
    renderCrossReferences(room),
    renderGraphLegend(),
    renderCommandReference(),
    renderBlockerCallout(room),
    renderFooter(room),
  ].filter((b) => b && b.trim().length > 0);

  let doc = blocks.join('\n\n');
  // Collapse 3+ blank lines to exactly 2.
  doc = doc.replace(/\n{3,}/g, '\n\n');
  if (!doc.endsWith('\n')) doc += '\n';

  // Self-check: WELCOME-02 requires >= 5 distinct callout types.
  const calloutTypes = new Set();
  const re = /\[!(abstract|info|tip|warning|quote|success|example|important|note)\]/g;
  let m;
  while ((m = re.exec(doc)) !== null) calloutTypes.add(m[1]);
  if (calloutTypes.size < 5) {
    throw new Error(
      `vault-welcome-generator: WELCOME-02 violation -- only ${calloutTypes.size} distinct callout types (need >= 5)`
    );
  }

  return doc;
}

// ---------- CLI ----------

function main() {
  const args = process.argv.slice(2);
  const roomDir = args.find((a) => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  const outIdx = args.indexOf('--out');
  const outPath = outIdx !== -1 ? args[outIdx + 1] : null;

  if (!roomDir) {
    process.stderr.write(
      'usage: vault-welcome-generator.cjs <roomDir> [--dry-run] [--out <path>]\n'
    );
    process.exit(1);
  }

  const absRoom = path.resolve(roomDir);
  if (!fs.existsSync(absRoom)) {
    process.stderr.write('ERROR: room dir does not exist: ' + absRoom + '\n');
    process.exit(1);
  }

  const doc = generateWelcome(absRoom);

  if (dryRun) {
    process.stdout.write(doc);
    return;
  }

  const target = outPath
    ? path.resolve(outPath)
    : path.join(absRoom, 'Welcome to MindrianOS.md');
  fs.writeFileSync(target, doc, 'utf-8');
  process.stdout.write(`wrote ${target} (${doc.length} bytes)\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write('ERROR: ' + (err && err.stack ? err.stack : err) + '\n');
    process.exit(1);
  }
}

module.exports = {
  generateWelcome,
  renderHeader,
  renderOverview,
  renderHowItWorks,
  renderSectionTable,
  renderGapWarnings,
  renderSubRoomArchitecture,
  renderTeamRoster,
  renderMeetingIntelligence,
  renderCrossReferences,
  renderGraphLegend,
  renderCommandReference,
  renderBlockerCallout,
  renderFooter,
  SECTION_ORDER,
  SECTION_COLORS,
};
