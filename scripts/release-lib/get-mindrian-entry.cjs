#!/usr/bin/env node
'use strict';
/*
 * scripts/release-lib/get-mindrian-entry.cjs
 *
 * WHAT: writes and checks the one `get-mindrian` entry in the marketplace catalog
 * (<marketplace>/.claude-plugin/marketplace.json). get-mindrian is a local-path plugin
 * that carries the skill which installs MindrianOS (quick 261119-g5g).
 *
 * WHY: the install procedure has one source, the get-mindrian SKILL.md in the marketplace
 * repo, served at a public raw URL that never moves; the plugin repo AGENT-INSTALL.md only
 * points to it. Phase 369.1 D-03 forbids hand edits of marketplace.json, so this entry is
 * written only by this script. The script finds the entry by name and keeps every other
 * entry and its order, so the release writers (release.sh Step 4 and
 * mos_write_desktop_entry in desktop-copy-gate.sh) and this script do not undo each other.
 * It lives under scripts/release-lib, which package.json keeps out of the npm payload.
 *
 * USAGE:
 *   node scripts/release-lib/get-mindrian-entry.cjs [--check | --write] [--marketplace <dir>] [--json]
 *     --check        (default) deep-compare the entry; print IN SYNC or DRIFT with the fields
 *     --write        replace the entry in place by name, or append it at the end
 *     --marketplace  the marketplace dir; default env MINDRIAN_MARKETPLACE_DIR, else ~/mindrian-marketplace
 *     --json         print one JSON result line instead of plain lines
 *
 * Both modes first confirm that plugins/get-mindrian/.claude-plugin/plugin.json and the three
 * skill files (SKILL.md, references/commands.md, references/troubleshooting.md) exist.
 *
 * EXIT CODES:
 *   0  in sync (--check), or written (--write)
 *   1  drift or a missing entry (--check), or a bad argument
 *   2  an input is missing or unreadable (the message names the path)
 *
 * Node built-ins only. Plain lines only. Hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const NAME = 'get-mindrian';
const DISPLAY_NAME = 'Get MindrianOS';
const DESCRIPTION = 'Get MindrianOS: a skill that installs MindrianOS for you, or walks you through it one step at a time, in Claude Code, Claude Desktop or Codex.';
const SOURCE = './plugins/get-mindrian';
const SKILL_FILES = ['SKILL.md', path.join('references', 'commands.md'), path.join('references', 'troubleshooting.md')];

function parseArgs(argv) {
  const o = { mode: 'check', dir: process.env.MINDRIAN_MARKETPLACE_DIR || path.join(os.homedir(), 'mindrian-marketplace'), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--check': o.mode = 'check'; break;
      case '--write': o.mode = 'write'; break;
      case '--json': o.json = true; break;
      case '--marketplace':
        if (!argv[i + 1]) return { error: '--marketplace needs a directory' };
        o.dir = argv[i + 1];
        i += 1;
        break;
      default:
        return { error: 'unknown argument ' + argv[i] };
    }
  }
  return o;
}

function report(o, result) {
  if (o.json) {
    console.log(JSON.stringify(result));
    return;
  }
  if (result.status === 'missing-input') console.log('MISSING INPUT: ' + result.path);
  else if (result.status === 'in-sync') console.log('IN SYNC: ' + NAME + ' entry in ' + result.manifest);
  else if (result.status === 'written') console.log('WRITTEN: ' + NAME + ' entry in ' + result.manifest + ' (' + result.action + ')');
  else if (result.status === 'drift') {
    console.log('DRIFT: ' + NAME + ' entry in ' + result.manifest);
    for (const f of result.fields) console.log('  field ' + f.field + ': have ' + JSON.stringify(f.have) + ', want ' + JSON.stringify(f.want));
  } else if (result.status === 'missing-entry') console.log('DRIFT: no ' + NAME + ' entry in ' + result.manifest);
}

function missing(o, p) {
  report(o, { status: 'missing-input', path: p });
  process.exit(2);
}

function readJson(o, p) {
  if (!fs.existsSync(p)) missing(o, p);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    report(o, { status: 'missing-input', path: p + ' (not valid JSON: ' + e.message + ')' });
    process.exit(2);
  }
  return null;
}

function wantedEntry(version) {
  return { name: NAME, displayName: DISPLAY_NAME, description: DESCRIPTION, version, source: SOURCE };
}

function diffFields(have, want) {
  const keys = Array.from(new Set(Object.keys(have).concat(Object.keys(want)))).sort();
  const out = [];
  for (const k of keys) {
    if (JSON.stringify(have[k]) !== JSON.stringify(want[k])) out.push({ field: k, have: have[k], want: want[k] });
  }
  return out;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.error) {
    console.log('ERROR: ' + o.error);
    process.exit(1);
  }
  const dir = path.resolve(o.dir);
  if (!fs.existsSync(dir)) missing(o, dir);
  const manifest = path.join(dir, '.claude-plugin', 'marketplace.json');
  if (!fs.existsSync(manifest)) missing(o, manifest);
  const pluginJson = path.join(dir, 'plugins', NAME, '.claude-plugin', 'plugin.json');
  const skillDir = path.join(dir, 'plugins', NAME, 'skills', NAME);
  for (const rel of SKILL_FILES) {
    const p = path.join(skillDir, rel);
    if (!fs.existsSync(p)) missing(o, p);
  }
  const pj = readJson(o, pluginJson);
  if (typeof pj.version !== 'string' || !pj.version) {
    report(o, { status: 'missing-input', path: pluginJson + ' (no version string)' });
    process.exit(2);
  }
  const m = readJson(o, manifest);
  if (!Array.isArray(m.plugins)) {
    report(o, { status: 'missing-input', path: manifest + ' (plugins is not an array)' });
    process.exit(2);
  }
  const want = wantedEntry(pj.version);
  const idx = m.plugins.findIndex((p) => p && p.name === NAME);

  switch (o.mode) {
    case 'write': {
      let action;
      if (idx >= 0) {
        m.plugins[idx] = want;
        action = 'replaced in place at index ' + idx;
      } else {
        m.plugins.push(want);
        action = 'appended at index ' + (m.plugins.length - 1);
      }
      fs.writeFileSync(manifest, JSON.stringify(m, null, 2) + '\n');
      report(o, { status: 'written', manifest, action });
      process.exit(0);
      break;
    }
    case 'check':
    default: {
      if (idx < 0) {
        report(o, { status: 'missing-entry', manifest });
        process.exit(1);
      }
      const fields = diffFields(m.plugins[idx], want);
      if (fields.length) {
        report(o, { status: 'drift', manifest, fields });
        process.exit(1);
      }
      report(o, { status: 'in-sync', manifest });
      process.exit(0);
    }
  }
}

main();
