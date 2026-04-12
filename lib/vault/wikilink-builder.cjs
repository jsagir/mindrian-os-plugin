/**
 * MindrianOS Plugin -- Wikilink Builder (pure functions)
 *
 * Shared builder module for native wikilink injection at filing time.
 * Extracted from scripts/vault-wikilink-injector.cjs (Phase 76) so any filing
 * pathway -- /mos:file-meeting, room-passive, xref generators -- can inject
 * wikilinks at write time instead of relying on a retroactive batch pass.
 *
 * Zero fs/child_process imports. Callers pass in team-profile arrays and
 * receive transformed strings. Idempotent: running twice produces the same
 * output.
 *
 *   const wb = require('./lib/vault/wikilink-builder.cjs');
 *   const linked = wb.buildTeamLinks(content, room.teamProfiles, {
 *     ownProfilePath: filePath,
 *   });
 */

'use strict';

// ---------- Pure helpers (verbatim from Phase 76 injector) ----------

/** Escape regex metacharacters. */
function reEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Return { bodyStart } -- offset into `content` after any YAML frontmatter
 * block. Body modifications should only occur at offsets >= bodyStart.
 */
function frontmatterSplit(content) {
  if (!content || !content.startsWith('---')) return { bodyStart: 0 };
  const end = content.indexOf('\n---', 3);
  if (end === -1) return { bodyStart: 0 };
  return { bodyStart: end + 4 };
}

/**
 * Replace the first occurrence of `needle` in `haystack` at or after `offset`
 * that is NOT already inside a [[wikilink]]. Whole-word boundary enforced via
 * \b. Returns the new string, or null if no suitable occurrence was found.
 */
function replaceFirstOutsideLinks(haystack, needle, replacement, offset) {
  const re = new RegExp('\\b' + reEscape(needle) + '\\b', 'g');
  re.lastIndex = offset || 0;
  let m;
  while ((m = re.exec(haystack)) !== null) {
    const idx = m.index;
    const before = haystack.slice(0, idx);
    const lastOpen = before.lastIndexOf('[[');
    const lastClose = before.lastIndexOf(']]');
    if (lastOpen > lastClose) {
      // Inside a wikilink; skip.
      continue;
    }
    return (
      haystack.slice(0, idx) + replacement + haystack.slice(idx + needle.length)
    );
  }
  return null;
}

/** Append a structural line after frontmatter (or at the top if none). */
function appendStructuralLine(content, line) {
  if (content.startsWith('---')) {
    const fmEnd = content.indexOf('\n---', 3);
    if (fmEnd !== -1) {
      const fmClose = fmEnd + 4;
      return (
        content.slice(0, fmClose) + '\n' + line + '\n' + content.slice(fmClose)
      );
    }
  }
  return line + '\n' + content;
}

/** "2026-04-09-align-strategy-session" -> "Align Strategy Session". */
function meetingDisplayName(slug) {
  if (!slug) return '';
  const rest = slug.replace(/^\d{4}-\d{2}-\d{2}-?/, '');
  if (!rest) return slug;
  return rest
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** "business-model" -> "Business Model". */
function slugToTitle(slug) {
  if (!slug) return '';
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------- Public API ----------

/**
 * Replace the first occurrence of each team member's display name in `text`
 * with a wikilink to their PROFILE.md. Only touches body (skips frontmatter).
 * Case-sensitive whole-word match. Sorts by display name length DESC so
 * longer names win over shorter prefixes. Skips self-link when the file being
 * processed IS that person's own profile.
 *
 * @param {string} text
 * @param {Array<{name:string,displayName:string,path:string,category:string}>} teamProfiles
 * @param {{ ownProfilePath?: string|null }} [opts]
 * @returns {string} new text (original unchanged if no replacements)
 */
function buildTeamLinks(text, teamProfiles, opts) {
  if (!text || !Array.isArray(teamProfiles) || teamProfiles.length === 0) {
    return text;
  }
  const ownProfilePath = (opts && opts.ownProfilePath) || null;
  const { bodyStart } = frontmatterSplit(text);

  const targets = teamProfiles
    .filter((p) => p && p.displayName && p.name && p.category)
    .map((p) => ({
      displayName: p.displayName,
      linkTarget: `[[team/${p.category}/${p.name}/PROFILE.md|${p.displayName}]]`,
      ownProfilePath: p.path || null,
    }))
    .sort((a, b) => b.displayName.length - a.displayName.length);

  let current = text;
  const seen = new Set();
  for (const t of targets) {
    if (seen.has(t.displayName)) continue;
    if (ownProfilePath && t.ownProfilePath === ownProfilePath) continue;
    const next = replaceFirstOutsideLinks(
      current,
      t.displayName,
      t.linkTarget,
      bodyStart
    );
    if (next && next !== current) {
      current = next;
      seen.add(t.displayName);
    }
  }
  return current;
}

/**
 * Build a section wikilink.
 * @param {string} sectionName
 * @param {{ display?: string }} [opts]
 * @returns {string}
 */
function buildSectionLink(sectionName, opts) {
  const display = (opts && opts.display) || sectionName;
  return `[[${sectionName}/ROOM.md|${display}]]`;
}

/**
 * Build a meeting summary wikilink.
 * @param {string} meetingSlug
 * @returns {string}
 */
function buildMeetingLink(meetingSlug) {
  return `[[meetings/${meetingSlug}/summary.md|${meetingDisplayName(meetingSlug)}]]`;
}

/**
 * Build the filed-to footer lines (2-line block, or 1 line if targetPath null).
 * @param {{ targetPath: string|null, meetingSlug: string }} args
 * @returns {string}
 */
function buildFiledToFooter(args) {
  const targetPath = args && args.targetPath;
  const meetingSlug = args && args.meetingSlug;
  const lines = [];
  if (targetPath) {
    lines.push(`-> Full artifact: [[${targetPath}]]`);
  }
  if (meetingSlug) {
    const display = meetingDisplayName(meetingSlug);
    lines.push(`<- Source meeting: [[meetings/${meetingSlug}/summary.md|${display}]]`);
  }
  return lines.join('\n');
}

/**
 * Inject filed-to footer lines into `content` after the frontmatter block.
 * Idempotent: if a line is already present, it is not duplicated.
 *
 * @param {string} content
 * @param {{ targetPath: string|null, meetingSlug: string }} args
 * @returns {string}
 */
function injectFiledToFooter(content, args) {
  if (!content) return content;
  const targetPath = args && args.targetPath;
  const meetingSlug = args && args.meetingSlug;
  let current = content;

  if (targetPath) {
    const line = `-> Full artifact: [[${targetPath}]]`;
    if (!current.includes(line)) {
      current = appendStructuralLine(current, line);
    }
  }
  if (meetingSlug) {
    const display = meetingDisplayName(meetingSlug);
    const line = `<- Source meeting: [[meetings/${meetingSlug}/summary.md|${display}]]`;
    if (!current.includes(line)) {
      current = appendStructuralLine(current, line);
    }
  }
  return current;
}

module.exports = {
  // Public builders
  buildTeamLinks,
  buildSectionLink,
  buildMeetingLink,
  buildFiledToFooter,
  injectFiledToFooter,
  // Helpers exported for downstream reuse
  meetingDisplayName,
  slugToTitle,
  frontmatterSplit,
  replaceFirstOutsideLinks,
  appendStructuralLine,
};
