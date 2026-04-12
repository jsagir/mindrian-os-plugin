#!/usr/bin/env node
/**
 * MindrianOS Plugin -- Vault Wikilink Injector
 *
 * Transforms any Data Room's markdown files with navigable [[wikilinks]]:
 *   1. Team name linking (first occurrence per file -> PROFILE.md)
 *   2. Filed-to stub linking (target artifact + source meeting)
 *   3. Meeting summary Filed Artifacts index
 *   4. Section reference linking in STATE.md / ROOM.md
 *   5. Sub-room navigation (Parent + Siblings)
 *   6. Link quality filter (dead link removal, de-duplication)
 *
 * Two link types enforced (ARCH-05):
 *   - Serendipity links (team names, xrefs) remain inline in body text
 *   - Structural links (filed-to, Parent/Siblings, Filed Artifacts) live in
 *     frontmatter-adjacent or footer sections
 *
 * Idempotency (WIKI-07): every pass checks before modifying.
 *
 * Usage:
 *   node scripts/vault-wikilink-injector.cjs /path/to/room [--dry-run]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { scanRoom, parseFrontmatter } = require('../lib/vault/room-scanner.cjs');

// ---------- CLI args ----------

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const roomArg = argv.find((a) => !a.startsWith('--'));

if (!roomArg) {
  process.stderr.write(
    'Usage: node scripts/vault-wikilink-injector.cjs <room-dir> [--dry-run]\n'
  );
  process.exit(1);
}

const ROOM_DIR = path.resolve(roomArg);
if (!fs.existsSync(ROOM_DIR)) {
  process.stderr.write('ERROR: room dir does not exist: ' + ROOM_DIR + '\n');
  process.exit(1);
}

// ---------- Stats ----------

const stats = {
  modified: 0,
  skipped: 0,
  links_added: 0,
  passes: {
    team: 0,
    filed_to: 0,
    filed_artifacts: 0,
    section_refs: 0,
    sub_room_nav: 0,
  },
  dead_links_removed: 0,
  files: [],
};

// In-memory cache of file content so multiple passes can accumulate edits
// before a single write per file.
const fileCache = new Map(); // absPath -> { original, current, linksAdded }

function loadFile(absPath) {
  if (!fileCache.has(absPath)) {
    const original = fs.readFileSync(absPath, 'utf-8');
    fileCache.set(absPath, { original, current: original, linksAdded: 0 });
  }
  return fileCache.get(absPath);
}

function flushFiles() {
  for (const [absPath, entry] of fileCache.entries()) {
    if (entry.current === entry.original) {
      stats.skipped += 1;
      continue;
    }
    stats.modified += 1;
    stats.links_added += entry.linksAdded;
    stats.files.push({
      path: path.relative(ROOM_DIR, absPath).split(path.sep).join('/'),
      links_added: entry.linksAdded,
    });
    if (!DRY_RUN) {
      fs.writeFileSync(absPath, entry.current, 'utf-8');
    }
  }
}

// ---------- Frontmatter helpers ----------

/**
 * Return { start, end } offsets of the body after a YAML frontmatter block,
 * or { start: 0, end: content.length } if none exists.
 * body modification should only happen within [bodyStart, content.length).
 */
function frontmatterSplit(content) {
  if (!content.startsWith('---')) return { bodyStart: 0 };
  const end = content.indexOf('\n---', 3);
  if (end === -1) return { bodyStart: 0 };
  return { bodyStart: end + 4 };
}

/** Escape regex metacharacters. */
function reEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace the first occurrence of `needle` in `haystack` after `offset`,
 * but only if it is NOT already inside a [[wikilink]]. Whole-word boundary
 * is enforced. Returns the new string, or null if not found.
 */
function replaceFirstOutsideLinks(haystack, needle, replacement, offset) {
  const re = new RegExp('\\b' + reEscape(needle) + '\\b', 'g');
  re.lastIndex = offset;
  let m;
  while ((m = re.exec(haystack)) !== null) {
    const idx = m.index;
    // Check if inside a wikilink: look for unmatched [[ before idx without an
    // intervening ]].
    const before = haystack.slice(0, idx);
    const lastOpen = before.lastIndexOf('[[');
    const lastClose = before.lastIndexOf(']]');
    if (lastOpen > lastClose) {
      // Inside a wikilink; skip this occurrence.
      continue;
    }
    // Also don't replace a name that appears as the pipe-display inside a link.
    return (
      haystack.slice(0, idx) +
      replacement +
      haystack.slice(idx + needle.length)
    );
  }
  return null;
}

// ---------- Pass 1: Team name linking ----------

function passTeamNames(room) {
  if (room.teamProfiles.length === 0) return; // WIKI-06 graceful

  // Build replacement targets sorted by display-name length DESC so we
  // prefer "Avital Leibovich" over "Avital" on first match.
  const targets = room.teamProfiles
    .map((p) => ({
      displayName: p.displayName,
      linkTarget: `[[team/${p.category}/${p.name}/PROFILE.md|${p.displayName}]]`,
      ownProfilePath: p.path,
    }))
    .sort((a, b) => b.displayName.length - a.displayName.length);

  for (const file of room.contentFiles) {
    // Skip PROFILE.md files -- they're cataloged and self-reference risky.
    if (file.path.endsWith('PROFILE.md')) continue;

    const entry = loadFile(file.path);
    const { bodyStart } = frontmatterSplit(entry.current);

    // First occurrence per display name per file
    const seen = new Set();
    for (const t of targets) {
      if (seen.has(t.displayName)) continue;
      // Don't link a person inside their own profile
      if (file.path === t.ownProfilePath) continue;
      const next = replaceFirstOutsideLinks(
        entry.current,
        t.displayName,
        t.linkTarget,
        bodyStart
      );
      if (next && next !== entry.current) {
        entry.current = next;
        entry.linksAdded += 1;
        stats.passes.team += 1;
        seen.add(t.displayName);
      }
    }
  }
}

// ---------- Pass 2: Filed-to stub linking ----------

function passFiledToStubs(room) {
  for (const meeting of room.meetings) {
    if (!meeting.filedTo || meeting.filedTo.length === 0) continue;
    const mtgDisplay = meetingDisplayName(meeting.slug);
    for (const stub of meeting.filedTo) {
      const entry = loadFile(stub.path);
      let content = entry.current;
      let added = 0;

      // Target artifact link
      if (stub.targetPath) {
        const targetLink = `[[${stub.targetPath}]]`;
        if (!content.includes(targetLink)) {
          content = appendStructuralLine(content, `-> Full artifact: ${targetLink}`);
          added += 1;
        }
      }

      // Source meeting link
      const meetingLink = `[[meetings/${meeting.slug}/summary.md|${mtgDisplay}]]`;
      if (!content.includes(meetingLink)) {
        content = appendStructuralLine(content, `<- Source meeting: ${meetingLink}`);
        added += 1;
      }

      if (added > 0) {
        entry.current = content;
        entry.linksAdded += added;
        stats.passes.filed_to += added;
      }
    }
  }
}

/** Append a line to the structural footer (after frontmatter, before first body). */
function appendStructuralLine(content, line) {
  // Place after frontmatter if present, before body.
  if (content.startsWith('---')) {
    const fmEnd = content.indexOf('\n---', 3);
    if (fmEnd !== -1) {
      const fmClose = fmEnd + 4;
      return (
        content.slice(0, fmClose) + '\n' + line + '\n' + content.slice(fmClose)
      );
    }
  }
  // No frontmatter: prepend at top.
  return line + '\n' + content;
}

function meetingDisplayName(slug) {
  // 2026-04-09-align-strategy-session -> Align Strategy Session
  const rest = slug.replace(/^\d{4}-\d{2}-\d{2}-?/, '');
  if (!rest) return slug;
  return rest
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------- Pass 3: Filed Artifacts index in meeting summaries ----------

function passFiledArtifactsIndex(room) {
  for (const meeting of room.meetings) {
    if (!meeting.hasSummary) continue;
    if (!meeting.filedTo || meeting.filedTo.length === 0) continue;
    const summaryPath = path.join(meeting.path, 'summary.md');
    const entry = loadFile(summaryPath);
    if (/^##\s+Filed Artifacts/m.test(entry.current)) continue; // idempotent

    const lines = ['', '## Filed Artifacts', ''];
    for (const stub of meeting.filedTo) {
      const stubLink = `[[meetings/${meeting.slug}/filed-to/${stub.name}.md|${slugDisplay(stub.name)}]]`;
      if (stub.targetPath) {
        const targetName = path.basename(stub.targetPath).replace(/\.md$/, '');
        lines.push(`- ${stubLink} -> [[${stub.targetPath}|${slugDisplay(targetName)}]]`);
      } else {
        lines.push(`- ${stubLink}`);
      }
    }
    lines.push('');

    // Append to end of file (ensuring trailing newline)
    const appended = entry.current.replace(/\s*$/, '\n') + lines.join('\n');
    const added = meeting.filedTo.length;
    entry.current = appended;
    entry.linksAdded += added;
    stats.passes.filed_artifacts += added;
  }
}

function slugDisplay(slug) {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------- Pass 4: Section reference linking in STATE.md / ROOM.md ----------

function passSectionRefs(room) {
  const targets = [
    path.join(room.roomDir, 'STATE.md'),
    path.join(room.roomDir, 'ROOM.md'),
  ];
  for (const filePath of targets) {
    if (!fs.existsSync(filePath)) continue;
    const entry = loadFile(filePath);
    const { bodyStart } = frontmatterSplit(entry.current);

    for (const section of room.sections) {
      if (!section.hasRoom) continue; // only link sections that have a ROOM.md
      const link = `[[${section.name}/ROOM.md|${section.name}]]`;
      // Skip if already wikilinked
      if (entry.current.includes(link)) continue;

      // Kebab slug first occurrence
      const next = replaceFirstOutsideLinks(
        entry.current,
        section.name,
        link,
        bodyStart
      );
      if (next && next !== entry.current) {
        entry.current = next;
        entry.linksAdded += 1;
        stats.passes.section_refs += 1;
        continue;
      }

      // Also try the display form ("Business Model" for "business-model")
      const display = slugDisplay(section.name);
      const displayLink = `[[${section.name}/ROOM.md|${display}]]`;
      if (entry.current.includes(displayLink)) continue;
      const next2 = replaceFirstOutsideLinks(
        entry.current,
        display,
        displayLink,
        bodyStart
      );
      if (next2 && next2 !== entry.current) {
        entry.current = next2;
        entry.linksAdded += 1;
        stats.passes.section_refs += 1;
      }
    }
  }
}

// ---------- Pass 5: Sub-room navigation ----------

function passSubRoomNav(room) {
  const siblingNames = room.subRooms.map((s) => s.name);
  for (const sub of room.subRooms) {
    const roomMd = path.join(sub.path, 'ROOM.md');
    if (!fs.existsSync(roomMd)) continue;
    const entry = loadFile(roomMd);
    if (/\*\*Parent:\*\*/.test(entry.current)) continue; // idempotent

    const siblings = siblingNames
      .filter((n) => n !== sub.name)
      .map((n) => `[[sub-rooms/${n}/ROOM.md|${n}]]`)
      .join(', ');

    const nav =
      `> **Parent:** [[ROOM.md|${room.roomName}]]\n` +
      (siblings ? `> **Siblings:** ${siblings}\n` : '');

    // Insert after frontmatter, or at top if none
    if (entry.current.startsWith('---')) {
      const fmEnd = entry.current.indexOf('\n---', 3);
      if (fmEnd !== -1) {
        const fmClose = fmEnd + 4;
        entry.current =
          entry.current.slice(0, fmClose) +
          '\n\n' +
          nav +
          entry.current.slice(fmClose);
      }
    } else {
      entry.current = nav + '\n' + entry.current;
    }
    const added = 1 + (siblings ? siblingNames.length - 1 : 0);
    entry.linksAdded += added;
    stats.passes.sub_room_nav += added;
  }
}

// ---------- Pass 6: Link quality filter ----------

function passQualityFilter(room) {
  const roomDir = room.roomDir;
  const linkRe = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

  for (const [absPath, entry] of fileCache.entries()) {
    if (entry.current === entry.original) continue;

    // De-duplicate: if the exact same wikilink appears 2+ times, that's
    // still fine (a name may legitimately recur). We ONLY dedupe when the
    // SAME link was added twice adjacent in structural footers.
    // For body text we leave alone.

    // Dead link removal: check every wikilink target exists.
    const seenTargets = new Set();
    const dead = [];
    let m;
    linkRe.lastIndex = 0;
    while ((m = linkRe.exec(entry.current)) !== null) {
      const target = m[1].trim();
      // Ignore root-relative system refs and anchors
      if (target.startsWith('#')) continue;
      if (target === 'ROOM.md') continue;
      // Resolve relative to room root
      const candidate = path.join(roomDir, target);
      if (!fs.existsSync(candidate)) {
        dead.push(m[0]);
      }
      seenTargets.add(target);
    }
    if (dead.length > 0) {
      for (const link of dead) {
        // Remove the dead link but preserve any display text
        const pipeMatch = link.match(/\|([^\]]*)\]\]$/);
        const replacement = pipeMatch ? pipeMatch[1] : '';
        entry.current = entry.current.split(link).join(replacement);
        stats.dead_links_removed += 1;
        process.stderr.write(
          `[quality] removed dead link ${link} from ${path.relative(roomDir, absPath)}\n`
        );
      }
    }
  }
}

// ---------- Run ----------

function main() {
  const room = scanRoom(ROOM_DIR);

  passTeamNames(room);
  passFiledToStubs(room);
  passFiledArtifactsIndex(room);
  passSectionRefs(room);
  passSubRoomNav(room);
  passQualityFilter(room);

  flushFiles();

  process.stdout.write(JSON.stringify(stats, null, 2) + '\n');
}

try {
  main();
} catch (err) {
  process.stderr.write('ERROR: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
}
