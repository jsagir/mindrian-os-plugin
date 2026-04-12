#!/usr/bin/env node
/**
 * MindrianOS Plugin -- VAULT-RULES.md Design System Generator
 *
 * Emits a canonical VAULT-RULES.md at the root of a Data Room vault.
 * This document IS the ruling system in human-readable form: De Stijl
 * color tokens, typography hierarchy, Obsidian callout mapping, symbol
 * vocabulary, per-file-type formatting rules, and graph view rulings.
 *
 * Anyone (human or agent) opening the vault can read VAULT-RULES.md and
 * understand the visual contract every file in the vault obeys. The file
 * is the single source of truth for the De Stijl design system as applied
 * to a Data Room export.
 *
 * Requirements satisfied:
 *   - RULES-01: ship VAULT-RULES.md at room root
 *   - RULES-02: document De Stijl color tokens with semantic meanings
 *   - RULES-06: typography hierarchy enforced and documented
 *   - RULES-10: graph view ruling documented
 *
 * Usage:
 *   node scripts/vault-rules-generator.cjs <room-dir> [--dry-run]
 *
 * Exit codes:
 *   0 - success (file written, or dry-run printed to stdout)
 *   1 - usage error, missing room dir, or internal failure
 *
 * Contract:
 *   - Zero npm dependencies (fs + path + local room-scanner only)
 *   - Idempotent: re-running produces byte-identical output
 *   - Matches CLI pattern of scripts/vault-wikilink-injector.cjs
 *   - Body is purely static (no timestamps, no env-dependent values)
 *   - Only dynamic field is the ${roomName} footer interpolation
 *
 * Reference implementation pattern: scripts/vault-wikilink-injector.cjs
 * (argv routing, stderr usage errors, JSON stats on stdout).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { scanRoom } = require('../lib/vault/room-scanner.cjs');

// ---------- Static template ----------

/**
 * The VAULT-RULES.md template. The ONLY dynamic field is ${roomName} at the
 * very bottom, so two runs against the same room produce byte-identical
 * output (no timestamps, no environment-dependent values).
 */
function generateVaultRules(roomName) {
  return `---
type: vault-rules
generated-by: scripts/vault-rules-generator.cjs
version: 1.0
---

# VAULT-RULES.md -- MindrianOS De Stijl Design System

> This document IS the ruling system. Every file in this vault obeys these rules. If a file breaks a rule, either the file is wrong or the rule is wrong -- not both.

## 1. De Stijl Color Tokens (RULES-02)

| Token | Hex | CSS Variable | Semantic Meaning | Section Mapping |
|-------|-----|--------------|------------------|-----------------|
| Red | \`#C83D2F\` | \`--mn-red\` | Problem / Critical / Contradiction | problem-definition |
| Blue | \`#2B5BA5\` | \`--mn-blue\` | Business / Structural | business-model |
| Gold | \`#E8A838\` | \`--mn-gold\` | Financial / Action / Serendipity | financial-model |
| Cyan | \`#4A9EAF\` | \`--mn-cyan\` | Competitive / Info | competitive-analysis |
| Green | \`#4A8C5C\` | \`--mn-green\` | Solution / Success / Validated | solution-design |
| Purple | \`#8B5CF6\` | \`--mn-purple\` | Team | team, team-execution |
| Gray | \`#6B6B6B\` | \`--mn-gray\` | Meetings / Muted | meetings |

## 2. Typography Hierarchy (RULES-06)

| Level | Style | CSS Treatment | Use For |
|-------|-------|----------------|---------|
| H1 | Red underbar | \`border-bottom: 4px solid var(--mn-red)\` | Document title (one per file) |
| H2 | Blue left bar | \`border-left: 6px solid var(--mn-blue); padding-left: 12px\` | Major section |
| H3 | Gold text | \`color: var(--mn-gold); font-weight: 700\` | Subsection |
| H4 | Cyan uppercase | \`color: var(--mn-cyan); text-transform: uppercase; letter-spacing: 0.08em\` | Detail level |

## 3. Obsidian Callout Mapping (RULES-03 contract)

| Callout | Semantic | Use For |
|---------|----------|---------|
| \`[!warning]\` | Gap / Blocker | Missing evidence, stalled decisions, unresolved contradictions |
| \`[!tip]\` | Action / Recommendation | Next-step guidance, suggested methodology |
| \`[!quote]\` | Meeting source / Attribution | Direct speaker quotes with wikilinks to PROFILE.md |
| \`[!info]\` | Methodology / Explanation | Framework definitions, background context |
| \`[!example]\` | Case / Architecture | Worked examples, architectural diagrams |
| \`[!success]\` | Convergence / Validated | Cross-section agreement, proven claims |
| \`[!abstract]\` | Summary / Overview | Section-level summaries, tl;dr blocks |
| \`[!important]\` | Decision / Commitment | Locked decisions, cascade triggers |

## 4. Symbol Vocabulary (RULES-07 contract)

No raw terminal glyphs in vault files. Use Obsidian-native elements:

| Concept | Vault Form |
|---------|-----------|
| Navigation | \`[[wikilinks]]\` (not file paths) |
| Structured data | Markdown tables (not box-drawing) |
| Key insight | Obsidian callout (not ANSI glyph) |
| Section divider | Mondrian horizontal rule \`---\` (styled red-yellow-blue-black gradient via CSS) |
| Cross-reference | \`[[xref-name]]\` inline wikilink |

## 5. Formatting Rules per File Type

### Content artifacts (\`section/artifact-name/artifact-name.md\`)
- H1 = claim sentence title (not label)
- Frontmatter: type, section, created, room, methodology, sources, related, parent-moc, status
- Callouts: abstract (summary) -> info (methodology) -> example (evidence) -> success (convergence) -> warning (gaps) -> important (decision)
- Branded footer with section, date, room path

### Team profiles (\`team/<category>/<person>/PROFILE.md\`)
- H1 = person's display name
- Frontmatter: type, section, created, room, role, expertise, contributions
- Contributions rendered as wikilinked table

### Meeting artifacts (\`meetings/YYYY-MM-DD-slug/\`)
- summary.md includes "Filed Artifacts" index (auto-generated)
- transcript.md stays raw
- filed-to/ stubs wikilink both target + source

### Cross-references (\`xref-name.md\`)
- H1 = relationship claim
- Frontmatter: type, section, created, room, source-artifact, target-artifacts, relationship-type
- Body links both endpoints inline

### Filed-to stubs (\`meetings/*/filed-to/*.md\`)
- Minimal content: "-> Full artifact: [[target]]" + "<- Source meeting: [[meeting]]"

## 6. Graph View Ruling (RULES-10)

| Rule | Value |
|------|-------|
| Node size | Proportional to connection count (hubs larger) |
| Edge color (serendipity/xref) | Gold \`#E8A838\` |
| Edge color (structural/hierarchy) | White \`#FFFFFF\` |
| Edge color (contradiction) | Red \`#C83D2F\` |
| Labels visible | At all zoom levels |
| Orphans | Hidden |
| Arrows | Shown |
| Force layout | linkDistance=180, repelStrength=12, centerStrength=0.4 |

## 7. The Three Link Types (ARCH-05 contract)

1. **Serendipity links** -- inline in body text, cross-domain connections, xref insights. Rendered in gold.
2. **Structural links** -- frontmatter + footer, hierarchy (parent-moc, filed-to). Rendered in white.
3. **Contradiction links** -- only used for CONTRADICTS edges. Rendered in red.

Every injected wikilink must be explainable in one sentence (ARCH-06). Dense meaningful links beat maximum links.

## 8. File Type Contract

Every directory has a ROOM.md (ICM Layer 0). Every section folder has the trifecta: ROOM.md (identity) + STATE.md (status) + MINTO.md (reasoning). Welcome to MindrianOS.md is the tier-0 Home Note.

---

_Generated by MindrianOS vault-rules-generator.cjs for room: \`${roomName}\`_
`;
}

// ---------- CLI ----------

function main() {
  const argv = process.argv.slice(2);
  const DRY_RUN = argv.includes('--dry-run');
  const roomArg = argv.find((a) => !a.startsWith('--'));

  if (!roomArg) {
    process.stderr.write(
      'Usage: node scripts/vault-rules-generator.cjs <room-dir> [--dry-run]\n'
    );
    process.exit(1);
  }

  const ROOM_DIR = path.resolve(roomArg);
  if (!fs.existsSync(ROOM_DIR)) {
    process.stderr.write('ERROR: room dir does not exist: ' + ROOM_DIR + '\n');
    process.exit(1);
  }

  // Use scanRoom only for roomName. Everything else in VAULT-RULES.md is static.
  let roomName;
  try {
    const room = scanRoom(ROOM_DIR);
    roomName = room.roomName || path.basename(ROOM_DIR);
  } catch (err) {
    // scanRoom may fail on very sparse directories; fall back to basename.
    roomName = path.basename(ROOM_DIR);
  }

  const markdown = generateVaultRules(roomName);

  if (DRY_RUN) {
    process.stdout.write(markdown);
    return;
  }

  const outPath = path.join(ROOM_DIR, 'VAULT-RULES.md');
  fs.writeFileSync(outPath, markdown, 'utf-8');

  const stats = {
    wrote: outPath,
    bytes: Buffer.byteLength(markdown, 'utf-8'),
    dry_run: false,
    room: roomName,
  };
  process.stdout.write(JSON.stringify(stats, null, 2) + '\n');
}

try {
  main();
} catch (err) {
  process.stderr.write('ERROR: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
}
