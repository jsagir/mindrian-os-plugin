/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 13 (HIPS-07, D-34, D-35, D-40, D-48). Pins the structure
 * every one of the three fixture rooms under tests/fixtures/355-rooms/ must
 * satisfy: the Phase 353 icm-rooms .room-root / ROOM.md / MINTO.md pattern,
 * 4 sections of 3-4 artifacts each (12-16 total per room), a 150-300 word
 * body per artifact, a D-48 frontmatter mix (at least 4 artifacts resolve
 * through resolveEndpoint via framework or methodology, at least 4 resolve
 * through nothing), the D-40 pws_stage on each root ROOM.md, and
 * planted-cases.json's ground truth for room-control's meaning bridges and
 * false friends (D-32: never named "planted" in any room's own text).
 *
 * Every discovery run happens on an fs.cpSync copy under
 * fs.mkdtempSync(os.tmpdir()) (the icm-rooms README rule); the committed
 * fixture tree is never touched by running this test.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { scrubVendorKey, installNetGuard, makeChecker, listFilesRecursive } = require('./helpers/hygiene-355.cjs');

scrubVendorKey();
const netGuard = installNetGuard();

const { discoverArtifacts } = require('../lib/core/rs-engine.cjs');
const { extractCarried, resolveEndpoint } = require('../lib/core/verification-stamp.cjs');

const { check, summary } = makeChecker('355-13 fixture rooms');

const ROOMS_DIR = path.join(__dirname, 'fixtures', '355-rooms');
const ROOMS = ['room-ill-defined', 'room-extend', 'room-control'];
const EXPECTED_PWS_STAGE = {
  'room-ill-defined': 'ill_defined',
  'room-extend': 'extend_opportunity',
  'room-control': null,
};
const BANNED_WORDS = ['planted', 'false friend', 'bridge case'];

function wordCount(text) {
  const t = text.trim();
  if (t.length === 0) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function stripFrontmatter(text) {
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (m) return text.slice(m[0].length);
  return text;
}

function listDirsRecursive(dirAbs) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      const abs = path.join(dirAbs, e.name);
      out.push(abs);
      out.push(...listDirsRecursive(abs));
    }
  }
  return out;
}

for (const room of ROOMS) {
  const committedRoomDir = path.join(ROOMS_DIR, room);

  if (!fs.existsSync(committedRoomDir)) {
    check(`${room} directory exists`, false, 'not authored yet');
    continue;
  }

  const tmpParent = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-355-13-'));
  const tmpRoom = path.join(tmpParent, room);

  try {
    fs.cpSync(committedRoomDir, tmpRoom, { recursive: true });

    // 1. .room-root exists.
    check(`${room} .room-root exists`, fs.existsSync(path.join(tmpRoom, '.room-root')));

    // 2. every directory under the room carries ROOM.md and MINTO.md.
    const allDirs = [tmpRoom, ...listDirsRecursive(tmpRoom)];
    let tripleOk = true;
    for (const d of allDirs) {
      if (!fs.existsSync(path.join(d, 'ROOM.md')) || !fs.existsSync(path.join(d, 'MINTO.md'))) {
        tripleOk = false;
      }
    }
    check(`${room} every directory has ROOM.md + MINTO.md`, tripleOk);

    // 3. exactly 4 section directories.
    const sectionDirs = fs
      .readdirSync(tmpRoom, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    check(`${room} exactly 4 section directories`, sectionDirs.length === 4, `found ${sectionDirs.length}`);

    // 4. each section has 3 or 4 artifacts (.md files excluding ROOM.md/MINTO.md/STATE.md).
    const sectionArtifactFiles = {};
    let sectionCountsOk = true;
    for (const sec of sectionDirs) {
      const secDir = path.join(tmpRoom, sec);
      const files = fs
        .readdirSync(secDir)
        .filter((f) => f.endsWith('.md') && f !== 'ROOM.md' && f !== 'MINTO.md' && f !== 'STATE.md');
      sectionArtifactFiles[sec] = files;
      if (files.length < 3 || files.length > 4) sectionCountsOk = false;
    }
    check(`${room} each section has 3 or 4 artifacts`, sectionCountsOk);

    // 5. every artifact body (frontmatter stripped) is 150-300 words.
    let wordsOk = true;
    let worstDetail = '';
    const artifactRelPaths = [];
    for (const sec of sectionDirs) {
      for (const f of sectionArtifactFiles[sec]) {
        const relPath = path.join(sec, f);
        artifactRelPaths.push(relPath);
        const raw = fs.readFileSync(path.join(tmpRoom, relPath), 'utf8');
        const body = stripFrontmatter(raw).trim();
        const n = wordCount(body);
        if (n < 150 || n > 300) {
          wordsOk = false;
          worstDetail = `${relPath}: ${n} words`;
        }
      }
    }
    check(`${room} every artifact body is 150-300 words`, wordsOk, worstDetail);

    // 6. discoverArtifacts returns 12-16 artifacts.
    const discovered = discoverArtifacts(tmpRoom);
    check(
      `${room} discoverArtifacts returns 12-16 artifacts`,
      discovered.length >= 12 && discovered.length <= 16,
      `found ${discovered.length}`
    );

    // 7/8. D-48 frontmatter mix: >= 4 resolve via framework/methodology, >= 4 resolve via nothing.
    let resolvedCount = 0;
    let unresolvedCount = 0;
    for (const a of discovered) {
      const raw = fs.readFileSync(path.join(tmpRoom, a.path), 'utf8');
      const carried = extractCarried(raw, a.title);
      const resolved = resolveEndpoint(carried);
      if (resolved.via === 'framework' || resolved.via === 'methodology') resolvedCount += 1;
      else if (resolved.via === null) unresolvedCount += 1;
    }
    check(
      `${room} at least 4 artifacts resolve via framework/methodology`,
      resolvedCount >= 4,
      `found ${resolvedCount}`
    );
    check(`${room} at least 4 artifacts resolve via nothing`, unresolvedCount >= 4, `found ${unresolvedCount}`);

    // 9. root ROOM.md pws_stage (D-40).
    const rootRoomMd = fs.readFileSync(path.join(tmpRoom, 'ROOM.md'), 'utf8');
    const expectedStage = EXPECTED_PWS_STAGE[room];
    if (expectedStage) {
      check(
        `${room} root ROOM.md has pws_stage: ${expectedStage}`,
        new RegExp(`^pws_stage:\\s*${expectedStage}\\s*$`, 'm').test(rootRoomMd)
      );
    } else {
      check(`${room} root ROOM.md has no pws_stage`, !/^pws_stage:/m.test(rootRoomMd));
    }

    // 11. no planted-language leak in any artifact, ROOM.md or MINTO.md.
    const allMdFiles = listFilesRecursive(tmpRoom).filter((f) => f.endsWith('.md'));
    let leakFile = null;
    for (const f of allMdFiles) {
      const lower = fs.readFileSync(f, 'utf8').toLowerCase();
      if (BANNED_WORDS.some((w) => lower.includes(w))) {
        leakFile = f;
        break;
      }
    }
    check(`${room} no planted-language leak (D-32)`, leakFile === null, leakFile || '');
  } finally {
    fs.rmSync(tmpParent, { recursive: true, force: true });
  }
}

// 10. planted-cases.json: room-control's ground truth, joined only after judging (D-32).
const plantedPath = path.join(ROOMS_DIR, 'planted-cases.json');
if (!fs.existsSync(plantedPath)) {
  check('planted-cases.json exists', false);
} else {
  const planted = JSON.parse(fs.readFileSync(plantedPath, 'utf8'));
  const bridges = Array.isArray(planted.meaning_bridges) ? planted.meaning_bridges : [];
  const friends = Array.isArray(planted.false_friends) ? planted.false_friends : [];
  check('planted-cases.json has >= 4 meaning_bridges', bridges.length >= 4, `found ${bridges.length}`);
  check('planted-cases.json has >= 4 false_friends', friends.length >= 4, `found ${friends.length}`);

  const controlDir = path.join(ROOMS_DIR, 'room-control');
  let pathsOk = true;
  for (const b of bridges) {
    if (
      typeof b.a !== 'string' ||
      typeof b.b !== 'string' ||
      !fs.existsSync(path.join(controlDir, b.a)) ||
      !fs.existsSync(path.join(controlDir, b.b))
    ) {
      pathsOk = false;
    }
  }
  for (const f of friends) {
    if (
      typeof f.a !== 'string' ||
      typeof f.b !== 'string' ||
      !fs.existsSync(path.join(controlDir, f.a)) ||
      !fs.existsSync(path.join(controlDir, f.b))
    ) {
      pathsOk = false;
    }
  }
  check('planted-cases.json entries name two artifact paths that exist in room-control', pathsOk);
}

netGuard.restore();
check('no network attempted (installNetGuard)', netGuard.attempts() === 0);

process.exit(summary());
