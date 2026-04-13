#!/usr/bin/env node
/**
 * MindrianOS Plugin -- wikilink-file
 *
 * Post-write hook that injects wikilinks into a newly-written artifact using
 * lib/vault/wikilink-builder. Called from /mos:file-meeting (and any other
 * filing pathway) immediately after creating a file so new artifacts arrive
 * pre-linked rather than waiting for a retroactive batch pass.
 *
 * Usage:
 *   node scripts/wikilink-file.cjs <room-dir> <file-path> [options]
 *
 * Options:
 *   --filed-to-target=<relPath>   Target artifact path for filed-to footer
 *   --meeting-slug=<slug>         Meeting slug for filed-to footer + source link
 *
 * Behavior:
 *   1. scanRoom(roomDir) to load team profiles
 *   2. buildTeamLinks(content, teamProfiles, { ownProfilePath })
 *   3. If --meeting-slug given, also injectFiledToFooter(content, ...)
 *   4. Write back only if changed
 *
 * Errors are logged to stderr but the script exits 0 unless it crashes
 * outright -- filing must never fail because of a wikilink pass (backward
 * compatibility is non-negotiable).
 */

'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const positional = [];
  const opts = {};
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, ...rest] = a.slice(2).split('=');
      opts[k] = rest.join('=') || true;
    } else {
      positional.push(a);
    }
  }
  return { positional, opts };
}

function main() {
  const { positional, opts } = parseArgs(process.argv.slice(2));
  if (positional.length < 2) {
    process.stderr.write(
      'Usage: node scripts/wikilink-file.cjs <room-dir> <file-path> [--filed-to-target=... --meeting-slug=...]\n'
    );
    process.exit(1);
  }

  const roomDir = path.resolve(positional[0]);
  const filePath = path.resolve(positional[1]);

  if (!fs.existsSync(roomDir)) {
    process.stderr.write(`[wikilink-file] room not found: ${roomDir}\n`);
    return; // soft fail
  }
  if (!fs.existsSync(filePath)) {
    process.stderr.write(`[wikilink-file] file not found: ${filePath}\n`);
    return; // soft fail
  }

  let scanRoom, wb;
  try {
    ({ scanRoom } = require('../lib/vault/room-scanner.cjs'));
    wb = require('../lib/vault/wikilink-builder.cjs');
  } catch (err) {
    process.stderr.write(`[wikilink-file] module load error: ${err.message}\n`);
    return; // soft fail
  }

  let room;
  try {
    room = scanRoom(roomDir);
  } catch (err) {
    process.stderr.write(`[wikilink-file] scanRoom failed: ${err.message}\n`);
    return; // soft fail
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    process.stderr.write(`[wikilink-file] read failed: ${err.message}\n`);
    return;
  }
  const original = content;

  // 1. Team name linking
  try {
    content = wb.buildTeamLinks(content, room.teamProfiles || [], {
      ownProfilePath: filePath,
    });
  } catch (err) {
    process.stderr.write(`[wikilink-file] buildTeamLinks failed: ${err.message}\n`);
  }

  // 2. Filed-to footer (if meeting context provided)
  const meetingSlug = opts['meeting-slug'];
  const filedToTarget = opts['filed-to-target'] || null;
  if (meetingSlug) {
    try {
      content = wb.injectFiledToFooter(content, {
        targetPath: filedToTarget,
        meetingSlug,
      });
    } catch (err) {
      process.stderr.write(
        `[wikilink-file] injectFiledToFooter failed: ${err.message}\n`
      );
    }
  }

  if (content !== original) {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      process.stdout.write(
        `[wikilink-file] linked: ${path.relative(roomDir, filePath)}\n`
      );
    } catch (err) {
      process.stderr.write(`[wikilink-file] write failed: ${err.message}\n`);
    }
  }
}

try {
  main();
} catch (err) {
  // Never fail filing because of wikilinking.
  process.stderr.write(
    `[wikilink-file] unexpected error: ${err && err.stack ? err.stack : err}\n`
  );
  process.exit(0);
}
