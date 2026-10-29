'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 381 Plan 04 (PERF381-01, PERF381-02, PERF381-08) -- the compute-team node renderer.
 *
 * Purpose
 *   scripts/compute-team forked about 957 processes per run (sed, head, grep, tr, date) to read
 *   the team profiles and the section artifacts. This module does the same work in one node
 *   process and writes the same bytes: team/TEAM-STATE.md (truncating write) and the
 *   "## Contributions" section of every PROFILE.md that carries one (PROFILE.md.tmp, then rename).
 *   Stdout stays empty; the exit code is 0 unless a write fails.
 *
 * Method (381-RESEARCH.md Pattern 1): every block of the bash body (scripts/compute-team, from
 * "Portable date -d replacement" to the final "exit 0") is transliterated in bash order. Every
 * bash "declare -A" is a BashAssoc fed in the bash insertion order, so the hash-ordered rows
 * (Knowledge Gaps contributors, Recurring Concerns, Influence Distribution and its tie winner,
 * Influence Scores) keep the bash order (ruling 7). Frontmatter is read with the bash dialect
 * (bashFmLines, bashField; ruling 1), read splits with readSplit and readArray, sort with
 * sortLines, all from lib/core/room-scan.cjs.
 *
 * Fields that reach no output are not ported: roles (the roles: list), affiliation and
 * first_meeting are read by the bash body into arrays that no echo prints.
 *
 * Named divergences (ruling 2 as amended 2026-10-29, pinned in tests/test-381-known-divergence.cjs)
 *   invalid-utf8: invalid bytes decode to U+FFFD; OLD grep treats such input as binary.
 *   room-path-sed: the room prefix of a profile path is removed as a literal string; OLD builds a
 *     sed program from the room path, which fails or mis-matches for | \ [ * ^ $ or a newline.
 *   macos-python-path: the wrapper header runs this renderer before the bash 3.2 python fallback.
 *
 * Child processes (T-381-01)
 *   This module never builds program text from room data. The only date-related spawns are the
 *   dateDToEpoch chain inside room-scan (value as argv, constant program). The only spawn of this
 *   module is FALLBACK_PROGRAMS.profileRewrite (constant text, values as positional arguments),
 *   used only when a contributions table value holds a backslash, because echo -e and awk -v
 *   both process escapes and that double processing is not emulated here.
 *
 * Canon
 *   Part 8 (graph boundary): zero network. Node built-ins and lib/core/room-scan.cjs only.
 *   Part 11 (invocation constitution): a library behind scripts/compute-team; no new surface.
 *
 * Hyphens only. CommonJS (.cjs): a hook reaches this file through scripts/compute-team.
 */

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const scan = require('./room-scan.cjs');

const {
  findByName, globDirs, globFiles, readTexts, bashFmLines, bashField, BashAssoc, readSplit,
  readArray, sortLines, stripTrailingNewlines, dateDToEpoch, computedStamp, byteCompare,
} = scan;

// 12-type role taxonomy (bash ALL_ROLES, same order).
const ALL_ROLES = ['mentor', 'researcher', 'team-member', 'investor', 'advisor', 'customer', 'founder',
  'partner', 'domain-expert', 'government', 'competitor', 'unknown'];

const MISSING_MESSAGES = {
  customer: '- CRITICAL: No **customer** voice on the team. Customer perspective is the most commonly missing in early ventures.',
  'domain-expert': '- CRITICAL: No **domain-expert** perspective. Deep domain knowledge reduces false assumptions.',
  investor: '- No **investor** perspective. Consider before fundraising conversations.',
  mentor: '- No **mentor** perspective. Experienced guidance accelerates learning cycles.',
  researcher: '- No **researcher** perspective. Research grounds decisions in evidence.',
  advisor: '- No **advisor** perspective. Strategic advisors expand the network.',
  government: '- No **government/regulatory** perspective. Relevant for regulated markets.',
  founder: '- No **founder** on team. Core leadership role not yet represented.',
  partner: '- No **partner** perspective. Partnerships can unlock distribution.',
  'team-member': '- No **team-member** roles. Core execution capacity not represented.',
  competitor: '- No **competitor** intelligence. Understanding competition sharpens positioning.',
};

// The awk program of the "Update PROFILE.md Contributions sections" block, copied from
// scripts/compute-team. $1 is the table with literal two-character \n sequences, $2 the profile.
const AWK_PROGRAM = [
  '',
  '      /^## Contributions/ || /^## Key Contributions/ {',
  '        print new_section',
  '        in_section = 1',
  '        next',
  '      }',
  '      in_section && /^## / {',
  '        in_section = 0',
  '      }',
  '      !in_section { print }',
  '    ',
].join('\n');

const FALLBACK_PROGRAMS = Object.freeze({
  profileRewrite: 'awk -v new_section="$(echo -e "$1")" \'' + AWK_PROGRAM + '\' "$2" > "$2.tmp" && mv "$2.tmp" "$2"',
});

// Frontmatter key names. Written in double quotes where a key equals a process name, so the
// source grep for spawned tools stays clean; these are frontmatter keys, never processes.
const KEY_DATE = "date";

const HEAD_CONTRIB = Buffer.from('## Contributions');
const HEAD_KEY_CONTRIB = Buffer.from('## Key Contributions');
const HEAD_ANY = Buffer.from('## ');

function startsWithBuf(buf, prefix) {
  return buf.length >= prefix.length && buf.compare(prefix, 0, prefix.length, 0, prefix.length) === 0;
}

// Records of a file as awk and grep see them: split on 0x0A; a final record without a newline is
// still a record; a final newline does not open an empty record.
function bufLines(buf) {
  const out = [];
  let start = 0;
  for (;;) {
    const nl = buf.indexOf(10, start);
    if (nl === -1) {
      if (start < buf.length) out.push(buf.subarray(start));
      break;
    }
    out.push(buf.subarray(start, nl));
    start = nl + 1;
  }
  return out;
}

// The lines a here-string loop reads: "$raw" plus the newline the here-string adds.
function hereLines(raw) {
  return raw.split('\n');
}

// [[ ! ",$list," == *",$item,"* ]] with the quoted item (a literal containment test).
function listHas(list, item) {
  return (',' + list + ',').includes(',' + item + ',');
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch (_e) {
    return false;
  }
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch (_e) {
    return false;
  }
}

// echo "$fname" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}', captured by $(...).
function dateFromName(fname) {
  const hits = [];
  for (const line of fname.split('\n')) {
    const m = /^[0-9]{4}-[0-9]{2}-[0-9]{2}/.exec(line);
    if (m) hits.push(m[0]);
  }
  return hits.join('\n');
}

function trendOf(lastActive, status, today) {
  if (lastActive === '' || lastActive === 'unknown') return 'unknown';
  const la = dateDToEpoch(lastActive);
  if (la === 0) return 'unknown';
  const days = Math.trunc((today - la) / 86400);
  if (days <= 14) return 'consistent';
  if (days <= 30) return 'occasional';
  if (status === 'active') return 'declining';
  return 'inactive';
}

// ---------------------------------------------------------------------------
// Profiles ("Scan PROFILE.md files")
// ---------------------------------------------------------------------------
async function scanProfiles(roomArg, teamDir) {
  const paths = await findByName(teamDir, 'PROFILE.md', { typeF: true });
  const texts = await readTexts(paths);
  const prefix = roomArg + '/';
  const profiles = [];
  for (const p of paths) {
    const got = texts.get(p);
    if (!got) continue;
    const fm = bashFmLines(got.text);
    const name = bashField(fm, 'name');
    if (name === '') continue;
    let primaryRole = bashField(fm, 'primary_role');
    if (primaryRole === '') primaryRole = bashField(fm, 'role');
    if (primaryRole === '') primaryRole = 'unknown';
    let status = bashField(fm, 'status');
    if (status === '') status = 'active';
    const lastActive = bashField(fm, 'last_active');
    let meetings = bashField(fm, 'meetings_attended');
    if (meetings === '') meetings = '0';
    // sed "s|^$ROOM_DIR/||" as a literal prefix (named divergence room-path-sed).
    const rel = p.startsWith(prefix) ? p.slice(prefix.length) : p;
    profiles.push({ name, primaryRole, status, lastActive, meetings, dir: path.posix.dirname(rel) });
  }
  return profiles;
}

// ---------------------------------------------------------------------------
// Sections and artifacts ("Scan room/ sections for contributions")
// ---------------------------------------------------------------------------
async function scanSections(roomArg) {
  const dirs = await globDirs(roomArg);
  const sectionDirs = [];
  for (const d of dirs) {
    // section_name=$(basename "$section_dir"): the capture drops trailing newlines.
    const name = stripTrailingNewlines(d.name);
    if (name.startsWith('.') || name === 'team' || name === 'meetings') continue;
    sectionDirs.push(name);
  }
  const perSection = [];
  for (const section of sectionDirs) {
    const files = await globFiles(roomArg + '/' + section);
    perSection.push({ section, files: files.filter((f) => f.name !== 'ROOM.md' && f.name !== 'TEAM-STATE.md' && f.name !== 'STATE.md') });
  }
  const allPaths = [];
  perSection.forEach((s) => s.files.forEach((f) => allPaths.push(f.path)));
  const texts = await readTexts(allPaths);
  return { sectionDirs, perSection, texts };
}

// ---------------------------------------------------------------------------
// The whole run
// ---------------------------------------------------------------------------
async function runTeam(roomArgIn, ctx) {
  const c = Object.assign({ now: () => new Date() }, ctx || {});
  const roomArg = roomArgIn === undefined || roomArgIn === '' ? '.' : roomArgIn;
  const teamDir = roomArg + '/team';
  const stderr = [];
  if (!isDir(teamDir)) return { code: 0, stderr: '' };

  const profiles = await scanProfiles(roomArg, teamDir);
  if (profiles.length === 0) return { code: 0, stderr: '' };

  const { sectionDirs, perSection, texts } = await scanSections(roomArg);

  const contribCounts = new BashAssoc();
  const personSections = new BashAssoc();
  const personArtifacts = new BashAssoc();

  for (const { section, files } of perSection) {
    for (const f of files) {
      const got = texts.get(f.path);
      if (!got) continue;
      const fm = bashFmLines(got.text);
      let speaker = bashField(fm, '  speaker');
      if (speaker === '') speaker = bashField(fm, 'speaker');
      if (speaker === '') continue;
      let segType = bashField(fm, 'segment_type');
      if (segType === '') segType = bashField(fm, 'type');
      if (segType === '') segType = 'entry';
      let artDate = bashField(fm, '  meeting_date');
      if (artDate === '') artDate = bashField(fm, KEY_DATE);
      if (artDate === '') artDate = dateFromName(f.name);
      if (artDate === '') artDate = 'unknown';

      const key = speaker + '|' + section;
      contribCounts.set(key, (contribCounts.get(key) || 0) + 1);

      const existing = personSections.get(speaker) || '';
      if (!listHas(existing, section)) {
        personSections.set(speaker, existing === '' ? section : existing + ',' + section);
      }
      const prev = personArtifacts.get(speaker) || '';
      personArtifacts.set(speaker, prev + artDate + '|' + section + '|' + segType + '|' + f.name + '\n');
    }
  }

  // Expertise distribution.
  const expertise = profiles.map((p) => {
    const sectionsStr = personSections.get(p.name) || '';
    if (sectionsStr === '') return { primary: '(no contributions)', sections: '-', total: '0' };
    let maxCount = 0;
    let maxSection = '';
    let total = 0;
    for (const sec of readArray(sectionsStr, ',')) {
      const cnt = contribCounts.get(p.name + '|' + sec) || 0;
      total += cnt;
      if (cnt > maxCount) {
        maxCount = cnt;
        maxSection = sec;
      }
    }
    return { primary: maxSection, sections: sectionsStr, total: String(total) };
  });

  // Knowledge gaps.
  const sectionContributors = new BashAssoc();
  for (const key of contribCounts.keys()) {
    const [person, section] = readSplit(key, '|', 2);
    const existing = sectionContributors.get(section) || '';
    if (!listHas(existing, person)) {
      sectionContributors.set(section, existing === '' ? person : existing + ',' + person);
    }
  }

  // Missing perspectives.
  const represented = new Set(profiles.map((p) => p.primaryRole));
  const missingRoles = ALL_ROLES.filter((r) => r !== 'unknown' && !represented.has(r));

  // Role distribution.
  const roleCounts = new Map();
  const roleMembers = new Map();
  for (const p of profiles) {
    roleCounts.set(p.primaryRole, (roleCounts.get(p.primaryRole) || 0) + 1);
    const existing = roleMembers.get(p.primaryRole) || '';
    roleMembers.set(p.primaryRole, existing === '' ? p.name : existing + ', ' + p.name);
  }

  // Activity patterns (date +%s taken once).
  const today = Math.floor(c.now() / 1000);
  const trends = profiles.map((p) => trendOf(p.lastActive, p.status, today));

  // Counts.
  const activeCount = profiles.filter((p) => p.status === 'active').length;
  let uniqueRoles = '';
  for (const p of profiles) {
    if (!listHas(uniqueRoles, p.primaryRole)) {
      uniqueRoles = uniqueRoles === '' ? p.primaryRole : uniqueRoles + ', ' + p.primaryRole;
    }
  }

  // Write TEAM-STATE.md.
  const out = [];
  out.push('---');
  out.push('computed: ' + computedStamp(c.now()));
  out.push('team_size: ' + profiles.length);
  out.push('active_members: ' + activeCount);
  out.push('roles_represented: [' + uniqueRoles + ']');
  out.push('---');
  out.push('# Team Knowledge Landscape');
  out.push('');

  out.push('## Expertise Distribution');
  out.push('');
  out.push('| Person | Primary Expertise | Sections Contributed | Last Active |');
  out.push('|--------|------------------|---------------------|-------------|');
  profiles.forEach((p, i) => {
    const display = expertise[i].sections === '-' ? '(none)' : expertise[i].sections;
    out.push('| ' + p.name + ' | ' + expertise[i].primary + ' | ' + display + ' | ' + (p.lastActive || 'unknown') + ' |');
  });
  out.push('');

  out.push('## Knowledge Gaps');
  out.push('');
  out.push('| Section | Contributors | Gap Assessment |');
  out.push('|---------|-------------|----------------|');
  for (const section of sectionDirs) {
    const contributors = sectionContributors.get(section) || '';
    if (contributors === '') {
      out.push('| ' + section + ' | 0 | CRITICAL: No perspectives filed |');
    } else {
      const n = readArray(contributors, ',').length;
      if (n === 1) {
        out.push('| ' + section + ' | 1 (' + contributors + ') | CONCENTRATION: Single perspective only |');
      } else {
        out.push('| ' + section + ' | ' + n + ' | Diverse -- ' + n + ' perspectives |');
      }
    }
  }
  out.push('');

  out.push('## Missing Perspectives');
  out.push('');
  if (missingRoles.length === 0) {
    out.push('All role types from the 12-type taxonomy are represented.');
  } else {
    for (const role of missingRoles) {
      out.push(MISSING_MESSAGES[role] || ('- No **' + role + '** perspective represented.'));
    }
  }
  out.push('');

  out.push('## Role Distribution');
  out.push('');
  out.push('| Role | Count | Members |');
  out.push('|------|-------|---------|');
  for (const role of ALL_ROLES) {
    const cnt = roleCounts.get(role) || 0;
    if (cnt === 0) continue;
    out.push('| ' + role + ' | ' + cnt + ' | ' + (roleMembers.get(role) || '') + ' |');
  }
  out.push('');

  out.push('## Activity Patterns');
  out.push('');
  out.push('| Person | Status | Meetings | Last Active | Trend |');
  out.push('|--------|--------|----------|-------------|-------|');
  profiles.forEach((p, i) => {
    out.push('| ' + p.name + ' | ' + p.status + ' | ' + p.meetings + ' | ' + (p.lastActive || 'unknown') + ' | ' + trends[i] + ' |');
  });
  out.push('');

  // Recurring Concerns.
  out.push('## Recurring Concerns');
  out.push('');
  const personTopicCounts = new BashAssoc();
  const personTopicFirst = new BashAssoc();
  for (const name of personArtifacts.keys()) {
    const raw = personArtifacts.get(name);
    if (raw === '') continue;
    const counts = new BashAssoc();
    const firsts = new BashAssoc();
    for (const line of hereLines(raw)) {
      const [d, s] = readSplit(line, '|', 4);
      if (s === '') continue;
      counts.set(s, (counts.get(s) || 0) + 1);
      const first = firsts.get(s) || '';
      if (first === '' || byteCompare(d, first) < 0) firsts.set(s, d);
    }
    for (const sec of counts.keys()) {
      personTopicCounts.set(name + '|' + sec, counts.get(sec));
      personTopicFirst.set(name + '|' + sec, firsts.get(sec));
    }
  }
  const recurring = [];
  for (const key of personTopicCounts.keys()) {
    const cnt = personTopicCounts.get(key);
    if (cnt >= 3) {
      const [person, topic] = readSplit(key, '|', 2);
      recurring.push('| ' + person + ' | ' + topic + ' | ' + cnt + ' | ' + personTopicFirst.get(key) + ' |');
    }
  }
  if (recurring.length) {
    out.push('| Person | Concern | Frequency | First Raised |');
    out.push('|--------|---------|-----------|--------------|');
    recurring.forEach((l) => out.push(l));
  } else {
    out.push('No recurring concerns detected yet. Requires 3+ artifacts from the same person in the same section.');
  }
  out.push('');

  // Influence Distribution.
  out.push('## Influence Distribution');
  out.push('');
  const personDecisions = new BashAssoc();
  const personInsights = new BashAssoc();
  const personDomainDecisions = new BashAssoc();
  for (const name of personArtifacts.keys()) {
    const raw = personArtifacts.get(name);
    if (raw === '') continue;
    let dCount = 0;
    let iCount = 0;
    for (const line of hereLines(raw)) {
      const [, artSection, artType] = readSplit(line, '|', 4);
      if (artType === '') continue;
      if (artType === 'decision') {
        dCount += 1;
        const k = artSection + '|' + name;
        personDomainDecisions.set(k, (personDomainDecisions.get(k) || 0) + 1);
      } else if (artType === 'insight') {
        iCount += 1;
      }
    }
    personDecisions.set(name, dCount);
    personInsights.set(name, iCount);
  }
  const domainPrimaryVoice = new BashAssoc();
  const domainPrimaryCount = new BashAssoc();
  for (const key of personDomainDecisions.keys()) {
    const [section, nm] = readSplit(key, '|', 2);
    const cnt = personDomainDecisions.get(key);
    const currentMax = domainPrimaryCount.get(section) || 0;
    if (cnt > currentMax) {
      domainPrimaryVoice.set(section, nm);
      domainPrimaryCount.set(section, cnt);
    }
  }
  if (domainPrimaryVoice.size > 0) {
    out.push('| Domain | Primary Voice | Decisions Led |');
    out.push('|--------|--------------|---------------|');
    for (const section of domainPrimaryVoice.keys()) {
      out.push('| ' + section + ' | ' + domainPrimaryVoice.get(section) + ' | ' + domainPrimaryCount.get(section) + ' |');
    }
  } else {
    out.push('No decision artifacts attributed yet.');
  }
  out.push('');

  const influence = [];
  for (const name of personDecisions.keys()) {
    const d = personDecisions.get(name);
    const ins = personInsights.get(name) || 0;
    const x2 = d * 2 + ins;
    if (d > 0 || ins > 0) {
      influence.push('| ' + name + ' | ' + d + ' | ' + ins + ' | ' + Math.trunc(x2 / 2) + '.' + (x2 % 2) + ' |');
    }
  }
  if (influence.length) {
    out.push('### Influence Scores');
    out.push('');
    out.push('| Person | Decisions | Insights | Influence Score |');
    out.push('|--------|-----------|----------|-----------------|');
    influence.forEach((l) => out.push(l));
  }

  try {
    fs.writeFileSync(teamDir + '/TEAM-STATE.md', out.join('\n') + '\n');
  } catch (err) {
    stderr.push('compute-team: cannot write ' + teamDir + '/TEAM-STATE.md: ' + (err && err.code ? err.code : String(err)));
    return { code: 1, stderr: stderr.join('\n') + '\n' };
  }

  // Update PROFILE.md Contributions sections.
  for (const p of profiles) {
    const file = roomArg + '/' + p.dir + '/PROFILE.md';
    if (!isFile(file)) continue;
    const raw = personArtifacts.get(p.name) || '';
    const r = rewriteProfile(file, raw);
    if (r.stderr) stderr.push(r.stderr);
    if (r.code !== 0) return { code: r.code, stderr: stderr.join('\n') + '\n' };
  }

  return { code: 0, stderr: stderr.length ? stderr.join('\n') + '\n' : '' };
}

// The sorted rows of the contributions table: sort -t'|' -k1 -r over the lines of raw, rows
// whose fourth read field is empty are skipped.
function tableRows(raw) {
  const body = raw.endsWith('\n') ? raw.slice(0, -1) : raw;
  const sorted = sortLines(body.split('\n'), { sep: '|', reverse: true });
  const rows = [];
  for (const line of sorted) {
    const [d, s, t, f] = readSplit(line, '|', 4);
    if (f === '') continue;
    rows.push({ d, s, t, f });
  }
  return rows;
}

function rewriteProfile(file, raw) {
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch (_e) {
    return { code: 0 };
  }
  const lines = bufLines(buf);
  const hasHeading = lines.some((l) => startsWithBuf(l, HEAD_CONTRIB) || startsWithBuf(l, HEAD_KEY_CONTRIB));
  if (!hasHeading) return { code: 0 };

  const rows = raw === '' ? [] : tableRows(raw);
  if (raw !== '' && raw.includes('\\')) return fallbackRewrite(file, rows);

  let table = '## Contributions\n\n';
  if (raw === '') {
    table += '[No contributions found yet]\n';
  } else {
    table += '| Date | Section | Type | Artifact |\n';
    table += '|------|---------|------|----------|\n';
    for (const r of rows) table += '| ' + r.d + ' | ' + r.s + ' | ' + r.t + ' | [[' + r.s + '/' + r.f + ']] |\n';
  }
  const newSection = Buffer.from(stripTrailingNewlines(table) + '\n', 'utf8');
  const NL = Buffer.from('\n');
  const parts = [];
  let inSection = false;
  for (const l of lines) {
    if (startsWithBuf(l, HEAD_CONTRIB) || startsWithBuf(l, HEAD_KEY_CONTRIB)) {
      parts.push(newSection);
      inSection = true;
      continue;
    }
    if (inSection && startsWithBuf(l, HEAD_ANY)) inSection = false;
    if (!inSection) {
      parts.push(l);
      parts.push(NL);
    }
  }
  const tmp = file + '.tmp';
  try {
    fs.writeFileSync(tmp, Buffer.concat(parts));
  } catch (_e) {
    // awk > tmp failed: the && list stops before mv and set -e does not fire.
    return { code: 0, stderr: 'compute-team: cannot write ' + tmp };
  }
  try {
    fs.renameSync(tmp, file);
  } catch (_e) {
    return { code: 1, stderr: 'compute-team: cannot move ' + tmp + ' to ' + file };
  }
  return { code: 0 };
}

// A value with a backslash: build the table exactly as bash does (literal two-character \n
// sequences) and run the constant bash program with the table and the file as arguments.
function fallbackRewrite(file, rows) {
  let table = '## Contributions\\n\\n';
  table += '| Date | Section | Type | Artifact |\\n';
  table += '|------|---------|------|----------|\\n';
  for (const r of rows) table += '| ' + r.d + ' | ' + r.s + ' | ' + r.t + ' | [[' + r.s + '/' + r.f + ']] |\\n';
  let res;
  try {
    res = cp.spawnSync('bash', ['-c', FALLBACK_PROGRAMS.profileRewrite, '_', table, file], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (_e) {
    return { code: 1, stderr: 'compute-team: cannot run the profile rewrite fallback' };
  }
  const err = res && res.stderr ? res.stderr.toString('utf8').replace(/\n+$/, '') : '';
  if (!res || res.error) return { code: 1, stderr: 'compute-team: cannot run the profile rewrite fallback' };
  // mv failed (the tmp file is still there): set -e ends the bash run with status 1.
  if (res.status !== 0 && fs.existsSync(file + '.tmp')) return { code: 1, stderr: err };
  return { code: 0, stderr: err };
}

// renderTeam(args, ctx) -> { stdout, stderr, code } (the CLI path of room-render.cjs team).
async function renderTeam(args, ctx) {
  const list = Array.isArray(args) ? args : [];
  const r = await runTeam(list[0], ctx);
  return { stdout: '', stderr: r.stderr || '', code: r.code };
}

module.exports = { renderTeam, runTeam, FALLBACK_PROGRAMS, ALL_ROLES };
