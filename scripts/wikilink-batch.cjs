#!/usr/bin/env node
'use strict';

/**
 * wikilink-batch.cjs -- perf helper for batch wikilinking.
 *
 * Phase 79 ships scripts/wikilink-file.cjs which spawns one Node process per
 * file. For large vault imports that cost dominates. This helper walks a room
 * dir to discover team profiles once, then runs buildTeamLinks across an
 * arbitrary number of files in a single Node process.
 *
 * Usage:
 *   node scripts/wikilink-batch.cjs <roomDir> <file1> [file2 ...]
 *
 * Discovers team profiles by walking room/team/{bucket}/{slug}/{slug}.md.
 * Files that fail to read are skipped with a stderr warning. Exits 0 unless
 * every input file failed.
 */

const fs = require('node:fs');
const path = require('node:path');
const wb = require('../lib/vault/wikilink-builder.cjs');

function slugToDisplay(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); })
    .join(' ');
}

function discoverTeamProfiles(roomDir) {
  const teamDir = path.join(roomDir, 'team');
  if (!fs.existsSync(teamDir)) return [];
  const profiles = [];
  let buckets;
  try {
    buckets = fs.readdirSync(teamDir, { withFileTypes: true });
  } catch (e) {
    return [];
  }
  for (const bucket of buckets) {
    if (!bucket.isDirectory()) continue;
    const bucketDir = path.join(teamDir, bucket.name);
    let persons;
    try {
      persons = fs.readdirSync(bucketDir, { withFileTypes: true });
    } catch (e) {
      continue;
    }
    for (const person of persons) {
      if (!person.isDirectory()) continue;
      const slug = person.name;
      const md = path.join(bucketDir, slug, slug + '.md');
      if (fs.existsSync(md)) {
        profiles.push({
          name: slug,
          displayName: slugToDisplay(slug),
          path: path.relative(roomDir, md),
          category: bucket.name
        });
      }
    }
  }
  return profiles;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('usage: node scripts/wikilink-batch.cjs <roomDir> <file1> [file2 ...]');
    process.exit(1);
  }
  const roomDir = args[0];
  const files = args.slice(1);

  const teamProfiles = discoverTeamProfiles(roomDir);

  let modified = 0;
  let failed = 0;
  for (const f of files) {
    try {
      const content = fs.readFileSync(f, 'utf8');
      const linked = wb.buildTeamLinks(content, teamProfiles, {
        ownProfilePath: path.relative(roomDir, f)
      });
      if (linked !== content) {
        fs.writeFileSync(f, linked);
        modified++;
      }
    } catch (e) {
      console.error('skip ' + f + ': ' + e.message);
      failed++;
    }
  }
  console.log('wikilink-batch: ' + modified + '/' + files.length + ' files modified, ' + failed + ' failed');
  // Exit 0 unless ALL files failed.
  if (failed === files.length && files.length > 0) process.exit(2);
  process.exit(0);
}

main();
