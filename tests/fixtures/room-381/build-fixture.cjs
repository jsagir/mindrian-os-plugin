#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 381 Plan 01 (PERF381-01, PERF381-05): the run-time ROOM fixtures of the OLD vs NEW
 * parity gate. The shape follows tests/fixtures/large-room/build-fixture.cjs.
 *
 * Builders (each writes only under targetDir and returns a JSON-able result):
 *   buildEdgeRoom(targetDir, { today })       -> { roomDir, sections, profiles, symlinks }
 *       every parity-reachable byte shape of the research list (CRLF, nested attribution,
 *       hash-order terms, xargs status values, team profiles in odd places, symlinks, ...).
 *   buildHostileRoom(targetDir, { today })    -> { roomDir, markers, nlTail }
 *       the injection payloads of quick 261029-u8x as PARITY cases (ruling 2 as amended
 *       2026-10-29): OLD at BASE_SHA is safe, so NEW must give the same bytes and no run may
 *       create a marker file in its cwd.
 *   buildBadStageRoom(targetDir)              -> { roomDir }
 *       a venture_stage value with an unmatched single quote (xargs error path).
 *   buildSmallRooms(targetDir)                -> { emptyRoom, teamNoProfiles, missingRoom }
 *   buildDivergenceRoom(targetDir, { today }) -> { roomDir, cases }
 *       the remaining named divergences of ruling 2 (SIGPIPE false negatives, invalid UTF-8,
 *       NUL). It is never a gate room.
 *
 * The result is deterministic except the dates computed from opts.today (default: now, local
 * time). No random source. Bytes that matter (CRLF, invalid UTF-8, NUL) are written as Buffers.
 *
 * Safety (threat T-381-03): every builder calls assertSafeTarget first. It refuses a target
 * under <home>/MindrianRooms or <home>/.mindrian (every home the process knows) and any path
 * with a segment named MindrianRooms (case-insensitive, so /mnt/c/Users/<u>/MindrianRooms is
 * covered too).
 *
 * Run as a script:
 *   node tests/fixtures/room-381/build-fixture.cjs <targetDir> <edge|hostile|bad-stage|small|divergence>
 * prints the result JSON on stdout. Hyphens only; no network.
 */
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const { forbiddenRoots, isInside } = require(path.join(REPO, 'tests', 'fixtures', 'large-room', 'build-fixture.cjs'));

function assertSafeTarget(p) {
  if (!p || typeof p !== 'string') throw new Error('assertSafeTarget: path must be a string');
  const target = path.resolve(p);
  forbiddenRoots().forEach((f) => {
    if (isInside(target, f)) throw new Error('assertSafeTarget: refusing a target under ' + f);
  });
  target.split(path.sep).forEach((seg) => {
    if (seg.toLowerCase() === 'mindrianrooms') {
      throw new Error('assertSafeTarget: refusing a target inside a MindrianRooms directory: ' + target);
    }
  });
  return target;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Local-time YYYY-MM-DD, offset days from `today`.
function dayStr(today, offsetDays) {
  const d = new Date(today.getTime());
  d.setDate(d.getDate() + offsetDays);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function put(root, rel, data) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  return file;
}

function todayOf(opts) {
  return opts && opts.today instanceof Date ? opts.today : new Date();
}

// ---------------------------------------------------------------------------
// The seeded FEYNMAN.md of room birth (scaffold-only), built from the modules' own constants
// exactly as tests/test-363.1-compute-state.cjs seededFeynman does.
// ---------------------------------------------------------------------------
function seededFeynman(slug) {
  const roomBirth = require(path.join(REPO, 'lib', 'core', 'navigation', 'room-birth.cjs'));
  const timelineRunner = require(path.join(REPO, 'lib', 'core', 'feynman', 'timeline-runner.cjs'));
  const dialMemory = require(path.join(REPO, 'lib', 'core', 'feynman', 'dial-memory-renderer.cjs'));
  const seed = String(roomBirth.FEYNMAN_BIRTH_SEED_TEMPLATE).replace(/\{\{SECTION_SLUG\}\}/g, slug);
  return [
    '---',
    'timeline_last_rendered: 2026-09-29T16:10:46Z',
    'dial_memory_last_rendered: 2026-09-29T16:10:47Z',
    '---',
    '# ' + slug,
    '',
    seed.replace(/^# .*\n\n?/, ''),
    '',
    timelineRunner.HEADER,
    '',
    timelineRunner.SENTINEL_START,
    '*No timeline events yet.*',
    timelineRunner.SENTINEL_END,
    '',
    dialMemory.HEADER,
    '',
    dialMemory.SENTINEL_START,
    '*Last refreshed: 2026-09-29T16:10:47Z. No dial activity yet.*',
    '',
    '**Available reaches** (6):',
    '- context_block',
    '- contradiction',
    '- cross_room',
    '- brain_consult',
    '- deep_research',
    '- hats',
    '',
    '**Last selected:** none yet.',
    '',
    '**Current recommended:** none (Brain-gated marker is a mode_a concept; current tier tier_0).',
    '',
    '**Recent research conclusions:**',
    '- no recent research conclusions',
    dialMemory.SENTINEL_END,
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// buildEdgeRoom
// ---------------------------------------------------------------------------
function buildEdgeRoom(targetDir, opts) {
  const base = assertSafeTarget(targetDir);
  const today = todayOf(opts);
  const roomDir = path.join(base, 'edge-room');
  fs.mkdirSync(roomDir, { recursive: true });
  const w = (rel, data) => put(roomDir, rel, data);
  const d = (n) => dayStr(today, n);

  // Root identity and the persisted STATE.md that analyze-room reads for venture_stage.
  w('.room-root', JSON.stringify({ room: 'edge-room', active: true }) + '\n');
  w('STATE.md', '---\nventure_stage: "Discovery"\ntotal_entries: 0\n---\n# Data Room State\n');

  // Headers that every shared-term section carries. [^\n] trap: "Navigation" loses its last letter.
  const TERM_HEADERS = '## Scalable workflow pricing latency\n## Navigation plan\n### Sub heading with ## inside\n';

  // problem-definition: 5 attributed files plus the odd name shapes.
  w('problem-definition/pd-1.md',
    '---\nspeaker: Alice Ade\nsegment_type: decision\ndate: ' + d(-5) + '\nmethodology: jobs-to-be-done\n---\n' +
    '# Problem\n\n' + TERM_HEADERS + '\nThe **Customer Discovery** pass shows recurring friction. The **retention** curve is flat.\n' +
    'An individual buyer feels it first. See [[market-analysis]] and room/solution-design for the pricing side.\n' +
    'Alice Ade and Bob Brook agree on the framing.\n');
  w('problem-definition/pd-2.md',
    ['---', 'speaker: Bob Brook', 'segment_type: decision', 'date: ' + d(-4), '---', '# CRLF file', '', '## Crlf header line', 'text', ''].join('\r\n'));
  w('problem-definition/pd-3.md',
    '\n\n---\nspeaker: Alice Ade\ntype: insight\ndate: ' + d(-3) + '\nmethodology: jobs-to-be-done\n---\n# Frontmatter on line 3\n\nIt references room/market-analysis-extra by prefix.\n');
  w('problem-definition/pd-4.md',
    '# Body rule file\nsome text\n---\nspeaker: Smith, Dan\nsegment_type: insight\n---\nmore text after the second rule\n');
  w('problem-definition/pd-5.md',
    '---\nspeaker: Bob Brook   \ntype:\tinsight\n---\n# Trailing spaces and a tab after the colon\n');
  w('problem-definition/2026-01-05-dated-note.md',
    '---\nspeaker: Pat|Lee\nsegment_type: insight\n---\n# Dated by file name\n');
  w('problem-definition/X.MD', '# Upper case extension\n');
  w('problem-definition/.hidden.md', '---\nspeaker: Alice Ade\n---\n# Dotfile\n');
  fs.mkdirSync(path.join(roomDir, 'problem-definition', 'sub.md'), { recursive: true });
  w('problem-definition/sub.md/inner.md', '# Inside a dir named sub.md\n');
  w('problem-definition/ROOM.md', '# problem-definition\n\nIdentity.\n');
  w('problem-definition/STATE.md', '---\nstage: x\n---\n# Section state\n');

  // market-analysis: nested attribution, tie on decisions, B2B, contradiction and conflict lines.
  w('market-analysis/ma-1.md',
    '---\nattribution:\n  speaker: Alice Ade\n  meeting_date: ' + d(-10) + '\nsegment_type: decision\nsource: transcript\nmethodology: porter\n---\n' +
    '# Market\n\n' + TERM_HEADERS + '\nB2B buyers dominate. The **retention** story differs by segment.\n');
  w('market-analysis/ma-2.md',
    '---\nspeaker: Bob Brook\nsegment_type: decision\ndate: ' + d(-9) + '\nsource: transcript-v2\nmethodology: porter\n---\n' +
    '# Second market note\n\nThis conflict with solution-design needs a ruling.\n');
  w('market-analysis/ma-3.md',
    '---\nspeaker: Alice Ade\nsegment_type: insight\ndate: ' + d(-8) + '\nmethodology: tam-sam-som\n---\n# Third\n\nEnterprise_tier and שלוםenterpriseשלום stay glued to neighbours.\n');
  w('market-analysis/ma-4.md',
    '---\nspeaker: Alice Ade\ntype: analysis\n---\n# Fourth\n\nThe **procurement** cycle is long.\n');
  w('market-analysis/ma-5.md', '# Entry without frontmatter\n\nPlain text only.\n');

  // solution-design: duplicated, empty and different methodology values, consumer terms, contradiction line.
  w('solution-design/sd-1.md',
    '---\nspeaker: Alice Ade\nsegment_type: decision\ndate: ' + d(-7) + '\nmethodology: lean-canvas\nsource: transcript\n---\n' +
    '# Solution\n\n' + TERM_HEADERS + '\nA consumer app. It contradicts the market-analysis numbers.\n');
  w('solution-design/sd-2.md', '---\nmethodology: lean-canvas\n---\n# Duplicate methodology\n\nSee [[problem-definition]].\n');
  w('solution-design/sd-3.md', '---\nspeaker: Bob Brook\nmethodology:\n---\n# Empty methodology\n\nNo type given so the entry label applies.\n');
  w('solution-design/sd-4.md', '---\nmethodology: six-hats\ntype: decision\nspeaker: Bob Brook\n---\n# Different methodology\n\n**procurement** again.\n');

  // business-model: one methodology only, enterprise term, one shared-term header block.
  w('business-model/bm-1.md', '---\nmethodology: business-model-canvas\nspeaker: Alice Ade\ntype: insight\n---\n# Model\n\n' + TERM_HEADERS + '\nAn enterprise licence model. The **retention** term repeats.\n');
  w('business-model/bm-2.md', '# Pricing\n\nSee [[solution-design]] and [[problem-definition]].\n');
  w('business-model/bm-3.md', '# Costs\n\nPlain.\n');

  // competitive-analysis: 1 file. team-execution: empty. legal-ip: scaffold-only.
  w('competitive-analysis/ca-1.md', '---\nmethodology: porter\n---\n# Rivals\n\nconflict with solution-design on the roadmap.\n');
  fs.mkdirSync(path.join(roomDir, 'team-execution'), { recursive: true });
  w('legal-ip/CONTEXT.md', '# CONTEXT\n\nSection contract for legal-ip.\n');
  w('legal-ip/ROOM.md', '# ROOM\n\nIdentity for legal-ip.\n');
  w('legal-ip/FEYNMAN.md', seededFeynman('legal-ip'));

  // Extended sections.
  w('notes v2/n-1.md', '---\nmethodology: notes\nspeaker: Alice Ade\ntype: insight\n---\n# Notes\n\n' + TERM_HEADERS + '\nB2B mentions with consumer words too.\n');
  w('market.analysis/m-1.md', '# Dot in the name\n\nSee [[market-analysis]]; the regex dot matches here.\n');
  w('market.analysis/m-2.md', '# Dot second\n\nroom/market-analysis appears as a path.\n');
  w('empty-ext/readme.txt', 'no markdown here\n');
  w('state-only/STATE.md', '---\nstage: held\n---\n# State only section\n');
  w('.hidden-section/h-1.md', '# Hidden section\n\nmust stay invisible.\n');
  w('references/ref-1.md', '# Reference\n\nplain.\n');

  // Symlinks, only where the platform allows them.
  let symlinks = true;
  try {
    fs.symlinkSync('notes v2', path.join(roomDir, 'zz-linked'));
    fs.symlinkSync('pd-1.md', path.join(roomDir, 'problem-definition', 'alias.md'));
  } catch (_e) {
    symlinks = false;
  }

  // Team profiles.
  const profile = (rel, fm, body) => w(rel, '---\n' + fm + '---\n' + body);
  profile('team/members/alice/PROFILE.md',
    'name: Alice Ade\nroles: [founder, partner, partner]\nprimary_role: founder\nstatus: active\naffiliation: Edge Co\n' +
    'first_meeting: 2026-01-10\nlast_active: ' + d(-3) + '\nmeetings_attended: 2\n',
    '# Alice\n\n## Contributions\n\n| Date | Section | Type | Artifact |\n|------|---------|------|----------|\n| 2020-01-01 | old | old | old.md |\n\n## Notes\n\nFree text.\n');
  profile('team/members/bob/PROFILE.md',
    'name: Bob Brook\nroles:\n  - advisor\n  - investor\nrole: advisor\nstatus: inactive\nlast_active: ' + d(-20) + '\n',
    '# Bob\n\n## Key Contributions\n\n- old line one\n- old line two\n');
  profile('team/mentors/carol/PROFILE.md', 'name: Carol Cho\nlast_active: 2020-01-01\n', '# Carol\n');
  profile('team/advisors/dan/PROFILE.md', 'name: Smith, Dan\nrole: advisor\nlast_active: 2026-02-30\n', '# Dan\n');
  profile('team/.archived/eve/PROFILE.md', 'name: Eve Ex\nrole: investor\nstatus: archived\nlast_active: ' + d(-400) + '\n', '# Eve\n');
  fs.mkdirSync(path.join(roomDir, 'team', 'members', 'PROFILE.md'), { recursive: true });
  w('team/members/PROFILE.md/x.txt', 'a directory named PROFILE.md\n');
  w('team/members/frank/PROFILE.md', ['---', 'name: Frank Fox', 'role: partner', 'last_active: ' + d(-2), '---', '# Frank', ''].join('\r\n'));
  w('team/members/gina/PROFILE.md', '# Gina\n---\nname: Gina Gee\nrole: researcher\nstatus: active\nlast_active: ' + d(-1) + '\n---\n# after the rule\n');
  profile('team/members/pat/PROFILE.md', 'name: Pat|Lee\nrole: customer\nlast_active: ' + d(-30) + '\n', '# Pat\n');

  // Meetings.
  w('meetings/2026-01-10-kickoff/metadata.yaml', 'meeting_name: "Kickoff"\nmeeting_date: 2026-01-10\nsource: transcript\nspeakers:\n  - name: "Alice Ade"\n    role: "founder"\n');
  w('meetings/2026-01-10-kickoff/segment-scope.md',
    '---\nmethodology: file-meeting\nsegment_type: decision\nmeeting_name: "Kickoff"\nmeeting_date: 2026-01-10\nattribution:\n  speaker: "Alice Ade"\n  role: "founder"\n  meeting_id: "2026-01-10-kickoff"\n---\n\n# Scope\n\nAlice Ade set the scope.\n');
  w('meetings/2026-02-01-review/metadata.yaml', 'meeting_name: "Review"\nmeeting_date: 2026-02-01\nsource: transcript\nspeakers:\n  - name: "Bob Brook"\n    role: "advisor"\n');
  w('meetings/2026-02-01-review/segment-risks.md',
    '---\nmethodology: file-meeting\nsegment_type: insight\nmeeting_name: "Review"\nmeeting_date: 2026-02-01\nattribution:\n  speaker: "Bob Brook"\n  role: "advisor"\n  meeting_id: "2026-02-01-review"\n---\n\n# Risks\n\nBob Brook listed the risks.\n');

  // Opportunity bank and funding.
  w('opportunity-bank/ROOM.md', '# opportunity-bank\n\nIdentity.\n');
  w('opportunity-bank/STATE.md', '---\nstage: held\n---\n# bank state\n');
  w('opportunity-bank/o1.md', '---\nstatus: discovered\nrelevance_score: 8\ndeadline: 2099-12-31\nfunder: Fund: Alpha\n---\n# o1\n');
  w('opportunity-bank/o2.md', '---\nstatus: "applied"\nrelevance_score: 8\ndeadline: 2099-06-01\nfunder: Beta\n---\n# o2\n');
  w('opportunity-bank/o3.md', ['---', 'status: active', 'relevance_score: 9', 'deadline: 2020-01-01', 'funder: Gamma', '---', '# o3', ''].join('\r\n'));
  w('opportunity-bank/o4.md', '---\nstatus: two words\nrelevance_score: abc\nfunder: Delta: Inc\n---\n# o4\n');
  w('opportunity-bank/o5.md', '---\nstatus: -n\nrelevance_score: 7\n---\n# o5\n');
  w('opportunity-bank/o6.md', '---\ndeadline: 2099-01-01\n---\n# o6 with no status\n');
  w('funding/alpha/STATUS.md', '---\nstage: researched\nlast_updated: 2020-01-01\n---\n');
  w('funding/beta/STATUS.md', '---\nstage: applied\nlast_updated: ' + d(-1) + '\n---\n');
  fs.mkdirSync(path.join(roomDir, 'funding', 'gamma'), { recursive: true });

  const sections = fs.readdirSync(roomDir).filter((n) => !n.startsWith('.') && fs.statSync(path.join(roomDir, n)).isDirectory()).sort();
  const profiles = ['alice', 'bob', 'carol', 'dan', 'eve', 'frank', 'gina', 'pat'];
  return { roomDir, sections, profiles, symlinks };
}

// ---------------------------------------------------------------------------
// buildBadStageRoom
// ---------------------------------------------------------------------------
function buildBadStageRoom(targetDir) {
  const base = assertSafeTarget(targetDir);
  const roomDir = path.join(base, 'bad-stage-room');
  fs.mkdirSync(roomDir, { recursive: true });
  put(roomDir, 'problem-definition/p.md', '# P\n\nOne file.\n');
  // An unmatched single quote: xargs exits non-zero on it (research assumption A3).
  put(roomDir, 'STATE.md', "---\nventure_stage: it's ready\n---\n# Data Room State\n");
  return { roomDir };
}

// ---------------------------------------------------------------------------
// buildSmallRooms
// ---------------------------------------------------------------------------
function buildSmallRooms(targetDir) {
  const base = assertSafeTarget(targetDir);
  const emptyRoom = path.join(base, 'empty-room');
  fs.mkdirSync(emptyRoom, { recursive: true });
  const teamNoProfiles = path.join(base, 'team-no-profiles');
  fs.mkdirSync(teamNoProfiles, { recursive: true });
  put(teamNoProfiles, 'team/notes.md', '# Team notes\n\nNot a profile.\n');
  put(teamNoProfiles, 'problem-definition/p.md', '---\nspeaker: Nobody\n---\n# P\n');
  const missingRoom = path.join(base, 'does-not-exist');
  return { emptyRoom, teamNoProfiles, missingRoom };
}

// ---------------------------------------------------------------------------
// buildHostileRoom: the u8x payloads as parity cases.
// Sources (copied, not required):
//   tests/test-compute-team-date-guard.cjs : TEAM_MARKER, FUND_MARKER, TEAM_PAYLOAD,
//       FUND_PAYLOAD_RAW, the buildTeamRoom and buildFundRoom shapes.
//   tests/test-analyze-room-edge-argv.cjs : MARK_INFORMS, MARK_CONTRA, payloadName,
//       payloadGrepText, the buildBashRoom shape, leg D (leading-dash folder name).
// The RCA Symptoms payload does not fire against the post-u8x scripts and is not used.
// ---------------------------------------------------------------------------
const TEAM_MARKER = 'mos-team-proof';
const FUND_MARKER = 'mos-fund-proof';
const TEAM_PAYLOAD = "'+str(__import__('os').system('touch " + TEAM_MARKER + "'))+'";
// analyze-room reads last_updated through xargs, which strips quotes and backslashes.
// Backslash-escaped quotes survive xargs as plain quotes.
const FUND_PAYLOAD_RAW = "\\'+str(__import__(\\'os\\').system(\\'touch " + FUND_MARKER + "\\'))+\\'";
const MARK_INFORMS = 'mos-edge-informs-proof';
const MARK_CONTRA = 'mos-edge-contradicts-proof';

// A folder name that closes the JavaScript string and runs a command.
function payloadName(marker) {
  return "x'+require('child_process').execSync('touch " + marker + "')+'";
}
// Text that the grep -E pattern built from payloadName(marker) matches.
function payloadGrepText(marker) {
  return "x'require'child_process'.execSync'touch " + marker + "''";
}

function buildHostileRoom(targetDir, opts) {
  const base = assertSafeTarget(targetDir);
  const today = todayOf(opts);
  const roomDir = path.join(base, 'hostile-room');
  fs.mkdirSync(roomDir, { recursive: true });
  const w = (rel, data) => put(roomDir, rel, data);
  const profile = (name, lastActive) => w('team/members/' + name + '/PROFILE.md',
    '---\nname: ' + name + '\nrole: researcher\nstatus: active\nlast_active: ' + lastActive + '\n---\n# Profile\n');

  // compute-team: crafted last_active (buildTeamRoom shape) and three more date shapes.
  profile('x', TEAM_PAYLOAD);
  profile('t-iso', dayStr(today, 0) + 'T12:00:00Z');
  profile('t-space', dayStr(today, -2) + ' ');
  profile('t-short', '2026-1-5');

  // analyze-room: crafted last_updated (buildFundRoom shape).
  fs.mkdirSync(path.join(roomDir, 'opportunity-bank'), { recursive: true });
  w('funding/f1/STATUS.md', '---\nstage: discovered\nlast_updated: ' + FUND_PAYLOAD_RAW + '\n---\n');

  // analyze-room: crafted folder names (buildBashRoom shape).
  w('problem-definition/p.md', '# P\n[[' + payloadGrepText(MARK_INFORMS) + ']]\n[[market-analysis]]\n');
  w('market-analysis/c.md', '# C\ncontradict ' + payloadGrepText(MARK_CONTRA) + '\n');
  w('market-analysis/m.md', '# M\nplain\n');
  w(payloadName(MARK_INFORMS) + '/a.md', '# A\n');
  w(payloadName(MARK_CONTRA) + '/a.md', '# A\n');

  // Leading-dash folder name (leg D of the edge-argv test).
  w('problem-definition/dash.md', '# Dash\n[[-e-proof]]\n');
  w('-e-proof/a.md', '# A\n');

  // A section name that ends in a backslash.
  const backslashName = 'back\\';
  w(backslashName + '/a.md', '# A\n[[market-analysis]]\n');

  // A section folder whose name ends in one LF (covers the trailing-newline rule of the edge text).
  let nlTail = true;
  try {
    w('nl-tail\n/a.md', '# A\n[[market-analysis]]\n');
  } catch (_e) {
    nlTail = false;
  }

  return { roomDir, markers: [TEAM_MARKER, FUND_MARKER, MARK_INFORMS, MARK_CONTRA], nlTail };
}

// ---------------------------------------------------------------------------
// buildDivergenceRoom: the remaining ruling 2 divergences, by name.
// ---------------------------------------------------------------------------
function buildDivergenceRoom(targetDir, opts) {
  const base = assertSafeTarget(targetDir);
  const today = todayOf(opts);
  const roomDir = path.join(base, 'divergence-room');
  fs.mkdirSync(roomDir, { recursive: true });
  const w = (rel, data) => put(roomDir, rel, data);

  // sigpipe-large-file: a depth-1 section file over 200 KiB with B2B on its first line.
  const filler = [];
  for (let i = 0; i < 4200; i += 1) filler.push('Line ' + String(i).padStart(5, '0') + ' of plain filler text for the large file case.');
  w('div-big/big.md', 'B2B buyers are the first line of this large file.\n' + filler.join('\n') + '\n');
  w('div-consumer/c.md', '# Consumer side\n\nThis section talks about the consumer.\n');

  // invalid-utf8: a Latin-1 byte in a profile name and in a "## " header.
  w('team/members/cafe/PROFILE.md', Buffer.concat([
    Buffer.from('---\nname: Caf'),
    Buffer.from([0xe9]),
    Buffer.from('\nrole: researcher\nlast_active: ' + dayStr(today, -1) + '\n---\n# Cafe\n'),
  ]));
  w('div-utf8/u.md', Buffer.concat([
    Buffer.from('# Invalid byte\n\n## Header with bad byte '),
    Buffer.from([0xe9]),
    Buffer.from(' inside\n\nplain line\n'),
  ]));

  // nul-byte: a NUL inside a bold run and a B2C line.
  w('div-nul/n.md', Buffer.concat([
    Buffer.from('# NUL case\n\n**bold'),
    Buffer.from([0x00]),
    Buffer.from('run**\nB2C line follows here\n'),
  ]));

  const cases = {
    'sigpipe-large-file': 'a section file over 200 KiB with B2B in its first line; OLD echo | grep -q under pipefail gives a false negative, NEW gives the correct match',
    'invalid-utf8': 'a profile name and a header with the byte 0xE9; OLD grep prints nothing for the line in a UTF-8 locale, NEW reads U+FFFD',
    'nul-byte': 'a section file with a NUL byte in a bold run; OLD $(cat) drops the NUL, NEW keeps the text as read',
    'macos-python-path': 'source-level case: the bash 3.2 python fallback prints other bytes than the Linux path; the wrapper header precedes the BASH_VERSINFO check',
  };
  return { roomDir, cases };
}

module.exports = {
  buildEdgeRoom,
  buildHostileRoom,
  buildBadStageRoom,
  buildDivergenceRoom,
  buildSmallRooms,
  assertSafeTarget,
};

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const target = args[0];
    const mode = args[1];
    const builders = {
      edge: buildEdgeRoom,
      hostile: buildHostileRoom,
      'bad-stage': buildBadStageRoom,
      small: buildSmallRooms,
      divergence: buildDivergenceRoom,
    };
    if (!target || !builders[mode]) {
      throw new Error('usage: build-fixture.cjs <targetDir> <edge|hostile|bad-stage|small|divergence>');
    }
    process.stdout.write(JSON.stringify(builders[mode](target, {})) + '\n');
  } catch (e) {
    process.stderr.write(String((e && e.message) || e) + '\n');
    process.exit(1);
  }
}
