// lib/statusline/ratification-next.cjs -- Quick task 260705-ui4
//
// A LOCAL, read-only side-channel scanner that feeds the statusline "Next:" cue
// an enum/count-only ratification prompt on the ABSTENTION leg only. It mirrors
// the room-health / stance / next-move side-channel idiom: every fs op is
// try/caught, any failure degrades to null (the caller clears the cache to the
// byte-stable "Next: --" default).
//
// What it does: when the routing engine has nothing routed (case 3 of
// persistFromDecision), this scans the ACTIVE room's research/ entries for
// ratification frontmatter (ratification_status: proposed) and returns a single
// enum/count cue like "ratify strong (2 open)" -- the highest-priority
// unconverted ratification item. A `proposed` item is an explicit owner-assigned
// action; surfacing it beats a dead "--".
//
// Canon Part 8 (Graph Boundary + the cache's own "never user-room content"
// promise): the cue is built ONLY from a fixed strength ENUM and the open COUNT.
// Entry titles, ratification_target prose, owners, or any other user-room bytes
// NEVER appear in the cue. The allow-listed strength enums below are the only
// user-derived tokens that can reach the cue, and they are a closed vocabulary.
//
// Frozen-roomDir guardrail: resolveActiveRoom() is CALLED fresh inside the
// per-call function body (never at module load, never captured in a closure), so
// switching rooms mid-session is reflected on the next abstaining turn. The
// staleness class this avoids was found at bin/mindrian-mcp-server.cjs:65.
//
// House rule: hyphens only, no em-dashes. CJS only, zero new packages.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
// The require may sit at module top; the CALL happens per invocation (below).
const { resolveActiveRoom } = require(path.join(__dirname, '..', 'core', 'resolve-active-room.cjs'));

// Closed strength vocabulary. Only these tokens may reach the cue (enum-only
// invariant). Rank drives priority selection; absent/unknown -> rank 0 and NO
// strength label in the cue. medium and moderate are treated as equal rank.
const STRENGTH_RANK = { strong: 3, medium: 2, moderate: 2, weak: 1 };

// Defensive caps for the per-turn walk (T-ui4-02 DoS mitigation): depth-2 only,
// bounded file count.
const MAX_ENTRY_DIRS = 60;
const MAX_FILES = 50;

/**
 * Parse only the four ratification_* keys out of a leading YAML frontmatter
 * block, using a cheap line-wise regex (keeps the classifier's require graph
 * light -- no gray-matter on the seam path). Returns { status, strength } with
 * lowercased trimmed values, or an empty object when there is no frontmatter.
 * Never throws.
 * @param {string} text
 * @returns {{status?: string, strength?: string}}
 */
function parseRatificationFrontmatter(text) {
  try {
    if (typeof text !== 'string' || text.length === 0) return {};
    // Frontmatter block is the content between the first two '---' fence lines.
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    if (!m) return {};
    const block = m[1];
    const out = {};
    const statusM = /^\s*ratification_status:\s*(.+?)\s*$/m.exec(block);
    if (statusM) out.status = String(statusM[1]).trim().replace(/^["']|["']$/g, '').toLowerCase();
    const strengthM = /^\s*ratification_strength:\s*(.+?)\s*$/m.exec(block);
    if (strengthM) out.strength = String(strengthM[1]).trim().replace(/^["']|["']$/g, '').toLowerCase();
    return out;
  } catch (_e) {
    return {};
  }
}

/**
 * Scan the ACTIVE room's research/ entries (depth 2:
 * research/<entry-dir>/<entry>.md) for ratification_status: proposed items and
 * return the highest-priority enum/count cue.
 *
 * @returns {{cue: string, count: number, strength: string|null}|null}
 *   null when there is no active room, no research dir, no proposed entries, or
 *   on any read/parse failure. NEVER throws.
 */
function scanRatificationNext() {
  try {
    // Fresh per-call resolution -- never frozen (see module header guardrail).
    const active = resolveActiveRoom();
    if (!active || typeof active.abs_path !== 'string' || !active.abs_path) return null;

    const researchDir = path.join(active.abs_path, 'research');
    let entryDirs;
    try {
      entryDirs = fs.readdirSync(researchDir, { withFileTypes: true });
    } catch (_e) {
      return null; // no research/ dir
    }

    let count = 0;
    let topRank = -1;
    let topStrength = null;
    let topMtime = -1;
    let filesSeen = 0;
    let dirsSeen = 0;

    for (const de of entryDirs) {
      if (dirsSeen >= MAX_ENTRY_DIRS || filesSeen >= MAX_FILES) break;
      if (!de || !de.isDirectory()) continue;
      dirsSeen += 1;
      const entryDir = path.join(researchDir, de.name);
      let files;
      try {
        files = fs.readdirSync(entryDir, { withFileTypes: true });
      } catch (_e) {
        continue; // unreadable entry dir -> skip
      }
      for (const fe of files) {
        if (filesSeen >= MAX_FILES) break;
        if (!fe || !fe.isFile() || !fe.name.endsWith('.md')) continue;
        filesSeen += 1;
        const filePath = path.join(entryDir, fe.name);
        let text;
        try {
          text = fs.readFileSync(filePath, 'utf8');
        } catch (_e) {
          continue; // unreadable file -> skip
        }
        const fm = parseRatificationFrontmatter(text);
        if (fm.status !== 'proposed') continue; // OQ-1 v1 scope: proposed only
        count += 1;

        // Only allow-listed strength enums may influence the cue (enum-only).
        const strengthEnum = (fm.strength && Object.prototype.hasOwnProperty.call(STRENGTH_RANK, fm.strength))
          ? fm.strength
          : null;
        const rank = strengthEnum ? STRENGTH_RANK[strengthEnum] : 0;

        let mtime = 0;
        try {
          mtime = fs.statSync(filePath).mtimeMs;
        } catch (_e) {
          mtime = 0;
        }

        // Highest rank wins; tiebreak newest mtime.
        if (rank > topRank || (rank === topRank && mtime > topMtime)) {
          topRank = rank;
          topStrength = strengthEnum;
          topMtime = mtime;
        }
      }
    }

    if (count <= 0) return null;

    // Build the cue from the strength ENUM + open COUNT only. Never any prose.
    const cue = topStrength
      ? 'ratify ' + topStrength + ' (' + count + ' open)'
      : 'ratify (' + count + ' open)';

    return { cue: cue, count: count, strength: topStrength };
  } catch (_e) {
    return null;
  }
}

module.exports = { scanRatificationNext, parseRatificationFrontmatter };
