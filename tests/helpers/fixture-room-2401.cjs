'use strict';
/*
 * Phase 240.1 Plan 05 Task 1 -- buildFixtureRoom2401: the seeded synthetic
 * room the CTXL-03 room-context benchmark (plan 240.1-06) runs against.
 *
 * WHAT IT SEEDS, AND WHY. CTXL-03 measures whether feeding Larry real room
 * content improves his answers. Doing that against a live room under a real
 * rooms tree would be a Canon Part 8 breach (240.1-RESEARCH.md Pitfall 7), so
 * this fixture builds a COMPLETE, FULLY INVENTED room from scratch under a
 * caller-supplied temp root, and nothing else ever touches the real
 * filesystem tree.
 *
 * INVENTED FACTS AND THE TASK IDS THEY GROUND (RESOLUTION 2, locked in
 * 240.1-05-PLAN.md: every fact below is invented for a fictional venture,
 * "Quillow Systems"; nothing is copied, paraphrased, or adapted from any
 * real Data Room):
 *
 *   business-model/pricing.md
 *     "Vellichor Ledger Enterprise tier costs 4,812 dollars/mo"   -> T02
 *     "Quillow Systems is headquartered in Thornmere"             -> T06
 *     "Vellichor Ledger has never supported the Vosmere protocol" -> T04
 *     "Quillow Systems has never raised outside venture capital"  -> (context only)
 *
 *   market-analysis/competitors.md
 *     "Bramblewick Analytics ... based in Cravenholt ... makes
 *      the Cindergate Suite"                                      -> T05, T08
 *     "Cindergate Suite costs 5,290 dollars/mo"                   -> distractor for T02
 *     "Bramblewick Analytics employs roughly 312 people"          -> distractor for T07
 *
 *   team/roster.md
 *     "Zoraida Thistlewood founded Quillow Systems on 2019-03-14" -> T01, T03
 *     "Quillow Systems employs 1,847 people"                      -> T07
 *     "Percival Nkemdirim ... previously worked at Bramblewick
 *      Analytics"                                                 -> T05 (the join half)
 *     "most recent internal town hall was held on 2021-11-02"     -> distractor for T03
 *
 * RESOLUTION 1 (locked, 240.1-05-PLAN.md): buildFixtureRoom2401(rootDir)
 * takes an EXPLICIT caller-supplied root and reads neither a rooms-home
 * environment variable nor the caller's home directory. The caller owns
 * mkdtempSync. This makes Pitfall 7's named warning sign -- the harness
 * reading from a real rooms tree -- structurally impossible rather than
 * merely discouraged. (Grep proof: this file contains no reference to any
 * rooms-home environment variable, no os.homedir call, and no home-directory
 * environment variable.)
 *
 * Every seed step asserts its own result and quotes it in the assertion
 * message (the fixture-room-236.cjs fixture-failure-is-not-a-green idiom, in
 * spirit), so a broken fixture reports as a FIXTURE failure and can never
 * present as a false green.
 *
 * DETERMINISTIC: fixed content, no randomness in any asserted value, no
 * network, no model call. NO em-dashes or en-dashes anywhere (CLAUDE.md HARD
 * RULE). CJS only, Node built-ins only, zero new dependencies.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// The fixture room's slug and the frozen section list. Both exported so a
// consuming harness (plan 240.1-06) never has to hardcode either.
const FIXTURE_ROOM_SLUG = 'ctxl-2401-fixture';
const FIXTURE_SECTIONS = Object.freeze(['business-model', 'market-analysis', 'team']);

const FIXTURE_VENTURE_NAME = 'Quillow Systems';
const FIXTURE_VENTURE_STAGE = 'Growth';

// The byte-identical STATE.md stamp scripts/room-registry:127-131 writes at
// room birth. Research 1B (240.1-RESEARCH.md) proved this stamp is exactly
// what a buggy regeneration path can destroy, so this fixture also doubles
// as a usable seed for that work.
const STATE_MD_CONTENT = [
  '---',
  'gsd_state_version: 1.0',
  'status: active',
  '---',
  '',
  '# State',
  '',
  '## Decisions',
  '',
  '(none yet)',
  '',
].join('\n');

// Section -> artifact filename -> body. Every body is deliberately plain
// prose naming an invented fact (RESOLUTION 2), each traceable to one or
// more task ids in tests/fixtures/240.1-ctxl-tasks.json via the header
// register above.
const SECTION_ARTIFACTS = {
  'business-model': {
    file: 'pricing.md',
    body: [
      '# Quillow Systems Pricing and Product Notes',
      '',
      'This file is part of the CTXL-03 synthetic benchmark fixture (Phase',
      '240.1 Plan 05). Every fact below is invented for a fictional venture;',
      'nothing here is copied, paraphrased, or adapted from any real Data Room.',
      '',
      'The Vellichor Ledger Enterprise tier costs 4,812 dollars per month,',
      'billed annually.',
      '',
      'Quillow Systems is headquartered in Thornmere, a fictional operations',
      'hub that exists only for this benchmark fixture.',
      '',
      'The Vellichor Ledger has never supported the Vosmere migration',
      'protocol; any customer request to import data through Vosmere is',
      'declined by design.',
      '',
      'Quillow Systems has never raised outside venture capital funding; the',
      'company has operated as a fully self-funded venture since its founding.',
      '',
    ].join('\n'),
  },
  'market-analysis': {
    file: 'competitors.md',
    body: [
      '# Competitive Landscape for Quillow Systems',
      '',
      'This file is part of the CTXL-03 synthetic benchmark fixture (Phase',
      '240.1 Plan 05). Every fact below is invented for a fictional venture.',
      '',
      "Bramblewick Analytics is Quillow Systems' closest direct competitor,",
      'based in Cravenholt. Bramblewick Analytics makes the Cindergate Suite,',
      'a rival product to the Vellichor Ledger.',
      '',
      'The Cindergate Suite costs 5,290 dollars per month at its',
      'comparable enterprise tier.',
      '',
      'Bramblewick Analytics employs roughly 312 people, according to',
      "Quillow's own competitive research file.",
      '',
    ].join('\n'),
  },
  team: {
    file: 'roster.md',
    body: [
      '# Quillow Systems Team Roster',
      '',
      'This file is part of the CTXL-03 synthetic benchmark fixture (Phase',
      '240.1 Plan 05). Every fact below is invented for a fictional venture.',
      '',
      'Zoraida Thistlewood founded Quillow Systems on 2019-03-14.',
      '',
      'Quillow Systems employs 1,847 people across two offices, as of this',
      "fixture's snapshot date.",
      '',
      'Percival Nkemdirim, a senior integrations engineer at Quillow Systems,',
      'previously worked at Bramblewick Analytics before joining Quillow in',
      '2021.',
      '',
      "Quillow Systems' most recent internal town hall was held on",
      '2021-11-02.',
      '',
    ].join('\n'),
  },
};

/**
 * seedDir(dirPath, label) -> creates dirPath (recursive) and asserts it
 * exists as a real directory afterward, quoting the label and path in the
 * assertion message.
 * @param {string} dirPath
 * @param {string} label
 * @returns {string} dirPath
 */
function seedDir(dirPath, label) {
  fs.mkdirSync(dirPath, { recursive: true });
  const isRealDir = fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  assert.equal(
    isRealDir, true,
    'fixture-2401 seed dir must exist: ' + label + ' at ' + dirPath
  );
  return dirPath;
}

/**
 * seedFile(filePath, content, label) -> writes content to filePath (creating
 * parent dirs), re-reads it, and asserts the bytes on disk match what was
 * written, quoting the label and path in the assertion message.
 * @param {string} filePath
 * @param {string} content
 * @param {string} label
 * @returns {string} filePath
 */
function seedFile(filePath, content, label) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  const readBack = fs.readFileSync(filePath, 'utf8');
  assert.equal(
    readBack, content,
    'fixture-2401 seed file must round-trip byte-identical: ' + label + ' at ' + filePath
  );
  return filePath;
}

/**
 * readTaskCorpus() -> the parsed tests/fixtures/240.1-ctxl-tasks.json array.
 * Resolved relative to THIS FILE via __dirname, never relative to
 * process.cwd(), so it behaves identically no matter what directory a
 * caller runs node from (RESOLUTION 3, locked in 240.1-05-PLAN.md).
 * @returns {Array<Object>}
 */
function readTaskCorpus() {
  const corpusPath = path.join(__dirname, '..', 'fixtures', '240.1-ctxl-tasks.json');
  const raw = fs.readFileSync(corpusPath, 'utf8');
  const tasks = JSON.parse(raw);
  assert.equal(
    Array.isArray(tasks), true,
    'readTaskCorpus must parse to an array, got ' + typeof tasks
  );
  assert.equal(
    tasks.length >= 8, true,
    'readTaskCorpus must return at least 8 tasks, got ' + tasks.length
  );
  return tasks;
}

/**
 * buildFixtureRoom2401(rootDir) -> {
 *   roomsHome, roomDir, sections, artifactPaths, tasks
 * }
 *
 * rootDir: an EXISTING writable directory the caller owns (typically a
 * fs.mkdtempSync root; the caller owns cleanup). This function creates,
 * under rootDir and nowhere else:
 *
 *   <rootDir>/MindrianRooms/                                sandbox rooms home
 *   <rootDir>/MindrianRooms/.rooms/registry.json             names the fixture ACTIVE
 *   <rootDir>/MindrianRooms/<slug>/.room-root
 *   <rootDir>/MindrianRooms/<slug>/.mindrian/
 *   <rootDir>/MindrianRooms/<slug>/ROOM.md
 *   <rootDir>/MindrianRooms/<slug>/STATE.md                  the gsd_state_version stamp
 *   <rootDir>/MindrianRooms/<slug>/<section>/<artifact>.md   x3 (one per FIXTURE_SECTIONS entry)
 *
 * RESOLUTION 1: rootDir is the ONLY source of truth for where this writes.
 * This function never reads a rooms-home environment variable and never
 * reads the caller's home directory -- the caller's mkdtempSync root is the
 * entire universe this function is allowed to touch.
 * @param {string} rootDir
 * @returns {{roomsHome: string, roomDir: string, sections: ReadonlyArray<string>, artifactPaths: Array<Object>, tasks: Array<Object>}}
 */
function buildFixtureRoom2401(rootDir) {
  assert.equal(
    typeof rootDir === 'string' && rootDir.length > 0, true,
    'buildFixtureRoom2401: rootDir is required and must be a non-empty string'
  );
  assert.equal(
    fs.existsSync(rootDir) && fs.statSync(rootDir).isDirectory(), true,
    'buildFixtureRoom2401: rootDir must already exist as a directory (caller owns mkdtempSync): ' + rootDir
  );

  const roomsHome = seedDir(path.join(rootDir, 'MindrianRooms'), 'roomsHome');
  const registryDir = seedDir(path.join(roomsHome, '.rooms'), 'registryDir');
  const roomDir = seedDir(path.join(roomsHome, FIXTURE_ROOM_SLUG), 'roomDir');

  seedFile(
    path.join(roomDir, '.room-root'),
    JSON.stringify({ slug: FIXTURE_ROOM_SLUG }) + '\n',
    '.room-root'
  );
  seedDir(path.join(roomDir, '.mindrian'), '.mindrian');
  seedFile(
    path.join(roomDir, 'ROOM.md'),
    '# ' + FIXTURE_VENTURE_NAME
      + '\n\nCTXL-03 synthetic benchmark fixture room (Phase 240.1 Plan 05).'
      + ' Fully invented; never a real Data Room.\n',
    'ROOM.md'
  );
  seedFile(path.join(roomDir, 'STATE.md'), STATE_MD_CONTENT, 'STATE.md');

  // Fixed timestamp so the registry entry is deterministic (no Date.now()).
  const fixedIso = '2026-07-30T00:00:00Z';
  const registry = {
    version: 1,
    active: FIXTURE_ROOM_SLUG,
    rooms: {
      [FIXTURE_ROOM_SLUG]: {
        path: FIXTURE_ROOM_SLUG,
        created: fixedIso,
        last_opened: fixedIso,
        status: 'active',
        venture_name: FIXTURE_VENTURE_NAME,
        venture_stage: FIXTURE_VENTURE_STAGE,
        git_enabled: 'false',
        git_remote: '',
        auto_push: 'off',
        vercel_url: '',
      },
    },
  };
  seedFile(
    path.join(registryDir, 'registry.json'),
    JSON.stringify(registry, null, 2) + '\n',
    'registry.json'
  );

  const artifactPaths = [];
  for (const section of FIXTURE_SECTIONS) {
    const spec = SECTION_ARTIFACTS[section];
    assert.equal(
      typeof spec === 'object' && spec !== null, true,
      'buildFixtureRoom2401: missing SECTION_ARTIFACTS entry for section ' + section
    );
    const relPath = path.join(section, spec.file);
    const absPath = seedFile(
      path.join(roomDir, relPath),
      spec.body,
      'section artifact ' + relPath
    );
    artifactPaths.push({ section: section, file: spec.file, relPath: relPath, absPath: absPath });
  }
  assert.equal(
    artifactPaths.length >= 3, true,
    'buildFixtureRoom2401 must seed at least 3 section artifacts, got ' + artifactPaths.length
  );

  const tasks = readTaskCorpus();

  return {
    roomsHome: roomsHome,
    roomDir: roomDir,
    sections: FIXTURE_SECTIONS,
    artifactPaths: artifactPaths,
    tasks: tasks,
  };
}

module.exports = {
  buildFixtureRoom2401: buildFixtureRoom2401,
  readTaskCorpus: readTaskCorpus,
  FIXTURE_ROOM_SLUG: FIXTURE_ROOM_SLUG,
  FIXTURE_SECTIONS: FIXTURE_SECTIONS,
};
