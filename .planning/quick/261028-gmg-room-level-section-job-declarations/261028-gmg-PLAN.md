---
phase: quick-261028-gmg
plan: 01
quick_id: 261028-gmg
type: execute
wave: 1
depends_on: []
date: 2026-10-28
mode: quick-full
tree: /home/jsagi/dev/MindrianOS-Plugin/.claude/worktrees/section-job-room-declarations (branch quick/section-job-room-declarations, base main 30ff3e8d0)
canon_parts: [7, 8, 9]
files_modified:
  - lib/core/section-registry.cjs
  - tests/test-353-room-section-jobs.cjs
  - tests/run-all-353.sh
  - lib/core/doctor/section-ruling-module.cjs
  - data/doctor-modules.json
  - tests/test-353-doctor-section-ruling.cjs
  - lib/core/room-skeleton-scaffold.cjs
  - lib/core/navigation-engine.cjs
  - lib/core/feyminto/next-move.cjs
autonomous: true
requirements: [QUICK-261028-gmg]
must_haves:
  truths:
    - "A room declares a job for its own custom section in <roomDir>/.mindrian/section-jobs.json, and getSectionJob(slug, roomDir) returns that job with source 'room-declaration'"
    - "getSectionJob(slug) called with no room argument returns exactly what base 30ff3e8d0 returned, for every canon slug and for every unknown slug"
    - "A room declaration never overrides a canon row: a declared canon slug is rejected with reason canon_section and the canon row is returned"
    - "A declaration whose job_id or secondary_job_id fails isDeclaredJob, or that carries no ratified_by and ratified_at, is rejected, reported by the doctor, and never becomes a job"
    - "A symlinked section-jobs.json or a symlinked .mindrian directory is rejected as file_symlink and never read; a slug that names an Object.prototype property is rejected as invalid_slug; every rejected entry carries slug and job_id cut to 64 characters"
    - "The section-ruling doctor lists room-declared sections apart from canon sections; only still-undeclared sections land in sections_without_job_id; a room-declared section never lands in ruling_fingerprint_drift"
    - "The section-ruling registry row keeps exactly seven keys and no auto_heal key; data/section-job-canon.json is byte-identical to base; no canon section ruling fingerprint changes"
    - "When the caller knows the room, the FeyMinto next move (gatherNest, BRIEF.md, suggest_next) and decide() read the room-declared job for a custom section"
  artifacts:
    - path: "lib/core/section-registry.cjs"
      provides: "readRoomSectionJobs(roomDir) and room-aware getSectionJob(slug, roomDir)"
      exports: ["getSectionJob", "readRoomSectionJobs", "ROOM_SECTION_JOBS_REL", "ROOM_SECTION_JOBS_SCHEMA", "ROOM_SECTION_JOBS_VALUE_CAP", "isDeclaredJob"]
      contains: "mos.room-section-jobs/1"
    - path: "lib/core/doctor/section-ruling-module.cjs"
      provides: "separate room-declared reporting, rejected-declaration drift class, job_sources split"
      contains: "room_declarations_rejected"
    - path: "tests/test-353-room-section-jobs.cjs"
      provides: "registry parity, validation, and caller tests for room declarations"
      min_lines: 150
    - path: "tests/test-353-doctor-section-ruling.cjs"
      provides: "doctor tests for room-declared, rejected and undeclared sections; registry count fixed to 30"
      contains: "room_declarations_rejected"
    - path: "data/doctor-modules.json"
      provides: "section-ruling row description names the room declaration file; seven keys kept"
      contains: "section-jobs.json"
  key_links:
    - from: "lib/core/doctor/section-ruling-module.cjs"
      to: "lib/core/section-registry.cjs"
      via: "getSectionJob(slug, roomPath) per section node, readRoomSectionJobs(roomPath) once per check"
      pattern: "getSectionJob\\(slug, roomPath\\)"
    - from: "lib/core/section-registry.cjs readRoomSectionJobs"
      to: "isDeclaredJob (closed job vocabulary)"
      via: "every job_id and secondary_job_id passes isDeclaredJob or the entry is rejected"
      pattern: "isDeclaredJob\\("
    - from: "lib/core/feyminto/next-move.cjs gatherNest"
      to: "getSectionJob(section, roomDir)"
      via: "readJob(sectionDir, section, roomDir)"
      pattern: "getSectionJob\\(section, roomDir\\)"
    - from: "lib/core/navigation-engine.cjs decide() ledger fallback"
      to: "getSectionJob(ctx.section, roomDir)"
      via: "ctx.roomDir when it is a non-empty string"
      pattern: "getSectionJob\\(ctx\\.section,"
    - from: "lib/core/room-skeleton-scaffold.cjs writeSectionContracts"
      to: "getSectionJob(slug, roomDir)"
      via: "the roomDir argument the function already takes"
      pattern: "getSectionJob\\(slug, roomDir\\)"
---

<objective>
Let a room declare a job id for its own custom sections without editing the shared canon (data/section-job-canon.json).

Purpose: today getSectionJob(slug) reads only the shipped canon (11 core sections plus personas, 12 rows in the file, PROVEN). A room with custom sections can never clear `sections_without_job_id`. The room pws-website reports 13 such sections (Clients, blog, community-page, content-strategy, crm-automation, export, homepage, institutional, methodology-page, mindrian-page, newsletter, plans, site-design). The doctor module comment calls the fix "a canon-file edit", which is wrong for a custom section: a custom section belongs to one room, not to the shipped canon.

Output: a room-local declaration file format read by section-registry.cjs, a room-aware getSectionJob, a doctor that reports room-declared sections apart from canon sections, room-aware callers where the room is known, and tests. No job id is assigned for any real room. The navigator ratifies each job id later, outside this task.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@lib/core/section-registry.cjs
@lib/core/doctor/section-ruling-module.cjs
@data/section-job-canon.json
@tests/test-353-doctor-section-ruling.cjs
@lib/core/room-constraints.cjs (lines 1-120 only: the precedent for a person-approved room-local list at <room>/.mindrian/never-do.json, schema string, fresh read per call)

Read these line ranges only, when the task reaches them:
- lib/core/room-skeleton-scaffold.cjs lines 486-533 (writeSectionContracts; the template check at line 506 runs BEFORE getSectionJob at line 519)
- lib/core/navigation-engine.cjs lines 1150-1205 (face block, then the ledger fallback that calls getSectionJob at line 1189)
- lib/core/feyminto/next-move.cjs lines 374-386 (readJob) and 425-447 (gatherNest)
- tests/run-all-353.sh lines 1-35 and 60-100

## Baseline at 30ff3e8d0 (PROVEN by the planner, 2026-10-28)

- tests/test-353-doctor-section-ruling.cjs: PASS=23 FAIL=1. The one FAIL is stale: it asserts 28 registry modules; data/doctor-modules.json has 30 (mcp-write-path, quick 261026-s8c, and graph-doctor, quick 261009-4h4, were added after the assertion was written). Task 2 fixes it.
- tests/run-all-353.sh: PASS=20 FAIL=2. FAILED legs: `doctor section-ruling` (the stale count above) and `ledger shape`. The `ledger shape` failure is an ENV GAP: lib/core/repo-version.cjs refuses to answer from a `.claude/worktrees/` checkout. It is pre-existing and out of scope. Expected end state after this plan: PASS=22 FAIL=1, and the only FAILED leg is `ledger shape`.
- Green at base: tests/test-doctor-module-contract-parity.cjs, tests/test-doctor-doc-parity.cjs, tests/test-353-section-canon.cjs, tests/test-353-ruling-doc.cjs, tests/test-353-filing-gate.cjs, tests/test-353-decide-budget.cjs, tests/test-36925-next-move.cjs, tests/test-36925-feyminto-contract.cjs, tests/test-36925-brief.cjs, tests/test-369-hook-require-graph.cjs.
- The worktree has no node_modules. Node resolves gray-matter and semver upward from /home/jsagi/dev/MindrianOS-Plugin/node_modules. Do not run npm install. Do not modify that directory.
- WARNING: tests/run-all-353.sh (the fleet report leg) rewrites the tracked file `.planning/phases/353-icm-section-ruling-system-self-locating-room-map-jtbd-rooted/353-FLEET-REPORT.json`. After every run, restore it with `git checkout -- .planning/phases/353-icm-section-ruling-system-self-locating-room-map-jtbd-rooted/353-FLEET-REPORT.json`. Never commit it.

## Decision: where the declaration lives (constraint 5)

Chosen: `<roomDir>/.mindrian/section-jobs.json`, one file per room.

Compared with ROOM.md frontmatter (two variants: a `section_jobs:` map in the root ROOM.md, or a `job_id:` key in each section's own ROOM.md):

1. Canon Part 9, one write point and memory locality. The chosen file has one reader (readRoomSectionJobs in section-registry.cjs, the one home of section-job facts) and one writer (the navigator; the plugin ships no writer, and doctor fix() never writes it). It sits beside room.db in `.mindrian/`, the room's local-memory directory. ROOM.md frontmatter already has machine writers: room-map.cjs writeSelfBlocks splices `icm_self`, room-birth patches `job_id`, scaffold writes the template. Per Phase 369.25 RID-03, ROOM.md `icm_self` is a projection of room.db, never a source. A ratified fact in a projected, multi-writer file breaks the one-home rule (icm-architect invariant 9).
2. Coupling. room-map.cjs reads a section ROOM.md `job_id` into each node's tracked tuple (mapFingerprint, room-map.cjs lines 362-371 and 407-425). A per-section ROOM.md `job_id` would move the room-map fingerprint and every `icm_self` block, so the room-map doctor module would report drift in every room that declares a job. The separate file moves no room-map fingerprint.
3. Failure isolation. A YAML error in ROOM.md breaks the identity file for every reader (has_room_md becomes false). A damaged section-jobs.json fails closed to "undeclared" and the doctor reports it as `file_unreadable` or `file_malformed`.
4. Navigator ratification. One file gives one reviewable diff. Each entry carries `ratified_by` and `ratified_at` (the same two keys the canon file uses in its `ratification` object). Per-section ROOM.md keys scatter the ratification across N files.
5. Canon Part 8. `.mindrian/` is a dot directory. discoverSections skips it and isIndexableArtifactFile rejects dot-prefixed names, so the file never enters the indexer, the wiki, room.db artifact rows, or any Brain packet. ROOM.md is read by more surfaces.
6. Travel. Both travel with the room folder (copy, zip, Cowork shared folder). In the owner's home git repository, `*.db` is ignored but `.mindrian/*.json` is not (PROVEN: `git check-ignore` on pws-website/.mindrian), so section-jobs.json travels in git even where room.db does not. Travel is a tie; items 1 to 5 decide.

Precedent: `<room>/.mindrian/never-do.json` (lib/core/room-constraints.cjs): a person names and approves each entry, a schema string identifies the file, and every call reads the file fresh.

## Caller inventory (constraint 4, PROVEN by grep at base)

| Caller | Room at the call site? | Change |
|--------|------------------------|--------|
| lib/core/doctor/section-ruling-module.cjs check(), line 159 | YES (roomPath) | Pass roomPath. Task 2. |
| lib/core/room-skeleton-scaffold.cjs writeSectionContracts, line 519 | YES (roomDir argument) | Pass roomDir. Task 3. Behavior-neutral today: the template check at line 506 skips every slug without a shipped contract template, and every slug with a template is a canon slug, where canon wins. |
| lib/core/navigation/section-gate.cjs evaluateFilingGate, line 115 | NO (args are section, servesJtbd, mode) | Unchanged. |
| lib/core/navigation-engine.cjs decide() ledger fallback, line 1189 | YES when the caller threads ctx.roomDir (optional) | Pass ctx.roomDir when it is a non-empty string, else undefined. Task 3. |
| lib/core/feyminto/next-move.cjs readJob, line 380 | YES through gatherNest (roomDir) | readJob takes a third parameter roomDir; gatherNest passes it. Task 3. |
| lib/core/feyminto/theo-ask.cjs nestHandles, line 137 | NO (the input carries no room dir) | Unchanged. The call is also gated to CORE_SECTIONS, which all have canon rows, so a room declaration can never change its answer. The Theo path stays byte-identical (Part 8). |
| scripts/eval-icm-writers.cjs lines 271, 328, 332 | YES (tmpRoom, a temp copy of a shipped fixture) | Unchanged, by decision. The eval grades the canon ruling writer. The writer generates no ruling document for a custom slug (no template), so a room row adds no gradable case. Passing tmpRoom at line 271 would make the checklist expect a CONTEXT.md the writer never writes if a fixture ever carried a declaration file. The jev baseline at lines 328-332 is pinned to the canon business-model section (RCA icm-ruling-eval-agreement-below-floor) and must not move. This is the one deliberate exception to "pass the room when known". |

Not a caller and unchanged: lib/core/room-map.cjs (its section node job_id keeps reading the section ROOM.md, so no room-map fingerprint moves).

## Three surfaces and the Brain boundary (constraint 11)

The change is local file reads only: one fs read of `<roomDir>/.mindrian/section-jobs.json`, only for a slug with no canon row and only when a caller passes a room. It adds no Brain call, no network call, no MCP tool, no hook, and no write. CLI (doctor, decide() under hooks), Desktop and Cowork (the MCP server's suggest_next and sensors reach next-move.cjs gatherNest) all read the same file from the room folder, with no surface-specific code. Cowork: the file sits in the shared room folder, so every participant reads the same declarations. A half-written file fails closed to "undeclared" and the doctor reports it.

## Interfaces (the contract every task builds against)

Declaration file `<roomDir>/.mindrian/section-jobs.json`:

```json
{
  "schema": "mos.room-section-jobs/1",
  "sections": {
    "homepage": {
      "job_id": "understand-market",
      "secondary_job_id": null,
      "ratified_by": "navigator",
      "ratified_at": "2026-10-28"
    }
  }
}
```

section-registry.cjs additions:

```
ROOM_SECTION_JOBS_REL    = '.mindrian/section-jobs.json'
ROOM_SECTION_JOBS_SCHEMA = 'mos.room-section-jobs/1'
ROOM_SECTION_JOBS_VALUE_CAP = 64   // characters kept of slug and job_id in a rejected entry
readRoomSectionJobs(roomDir) -> {
  present: boolean,            // false when roomDir is not a non-empty string or the file is missing
  path: string|null,
  declarations: object,        // null-prototype map: slug -> accepted row (shape below)
  rejected: Array<{ slug: string|null, job_id: string|null, reason: string }>   // slug and job_id cut to 64 characters
}
getSectionJob(slug, roomDir?) -> canon row (unchanged shape) | accepted room row | undeclared shape (unchanged)
accepted room row = { job_id, secondary_job_id, vocabulary_extension, source: 'room-declaration',
                      probe_confidence: null, ratified_by, ratified_at }
reason enum: file_unreadable | file_too_large | file_symlink | file_malformed | invalid_slug |
             malformed_entry | canon_section | unknown_job_id | invalid_secondary_job_id | unratified
```

Doctor check() result additions (ok and warn paths only): `drift.room_declarations_rejected` (array of rejected entries, counted as drift), `job_sources: { canon: string[], room: string[] }` (section paths, not drift), and `action_lines` (string[], only when non-empty).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Room declaration reader and room-aware getSectionJob in section-registry.cjs</name>
  <files>lib/core/section-registry.cjs, tests/test-353-room-section-jobs.cjs, tests/run-all-353.sh</files>
  <behavior>
    - A1 parity: for every slug in data/section-job-canon.json `sections`, plus 'no-such-section', 'homepage', 'Clients', '', undefined, null and 42, registry.getSectionJob(x) deep-equals legacyGetSectionJob(x). legacyGetSectionJob is a verbatim copy, inside the test, of the base 30ff3e8d0 function body (section-registry.cjs lines 271-291) run over the canon file's `sections`. The same holds with roomDir passed as undefined, null and ''.
    - A2 no implicit room: with process.cwd() changed into a temp room whose file declares 'homepage', getSectionJob('homepage') still returns the undeclared shape. Restore cwd in a finally block.
    - A3 room row: getSectionJob('homepage', tmp) deep-equals { job_id:'understand-market', secondary_job_id:null, vocabulary_extension:false, source:'room-declaration', probe_confidence:null, ratified_by:'navigator', ratified_at:'2026-10-28' }. A row with job_id 'model-business' has vocabulary_extension true. A slug with a capital letter ('Clients') is accepted.
    - A4 canon wins: a declaration of 'problem-definition' with job_id 'find-bottleneck' leaves getSectionJob('problem-definition', tmp) deep-equal to getSectionJob('problem-definition'), and readRoomSectionJobs(tmp).rejected contains { slug:'problem-definition', job_id:'find-bottleneck', reason:'canon_section' }.
    - A5 entry rejections, each followed by getSectionJob(slug, tmp) returning the undeclared shape: 'write-blog' -> unknown_job_id; 'Understand-Market' (wrong case) -> unknown_job_id; 'custom' -> unknown_job_id; an unknown secondary_job_id -> invalid_secondary_job_id; a secondary_job_id equal to job_id -> invalid_secondary_job_id; no ratified_by -> unratified; a ratified_by of 65 characters -> unratified (a ratified_by of exactly 64 characters is accepted); ratified_at 'yesterday' -> unratified; a string entry -> malformed_entry; slugs '../escape', '.hidden', 'a/b', '__proto__', 'constructor', 'toString', 'valueOf', 'prototype' -> invalid_slug. A room cannot declare 'hasOwnProperty': a well-formed, ratified entry under that key is rejected as invalid_slug, readRoomSectionJobs(tmp).declarations has no 'hasOwnProperty' key, and a second, valid entry in the same file is still accepted. Output-size shape check: an entry whose job_id is a 70 KB string (71680 characters) is rejected as unknown_job_id and its rejected entry has job_id.length === 64; an entry whose slug key is a 70 KB string is rejected as invalid_slug and its rejected entry has slug.length === 64; JSON.stringify of these two rejected entries is shorter than 512 characters.
    - A6 file-level: no file -> present:false and rejected []; 'not json' -> one entry { slug:null, job_id:null, reason:'file_unreadable' }; wrong schema string -> file_malformed; `sections` an array -> file_malformed; a file larger than 262144 bytes -> file_too_large. Symlinks: `<tmp>/.mindrian/section-jobs.json` as a symlink to a valid declaration file OUTSIDE the room -> present:true, exactly one entry { slug:null, job_id:null, reason:'file_symlink' }, and getSectionJob('homepage', tmp) returns the undeclared shape; `<tmp>/.mindrian` as a symlink to a directory outside the room that holds a valid file -> the same file_symlink result. When fs.symlinkSync throws EPERM (a Windows host without the symlink right), print SKIP for these two cases and do not count a FAIL. readRoomSectionJobs and getSectionJob never throw.
    - A7 safety and freshness: Object.getPrototypeOf(result.declarations) is null; Object.prototype gains no job_id key; an edit to the file between two calls shows in the second call (no cache).
  </behavior>
  <action>
RED first: create tests/test-353-room-section-jobs.cjs in the style of tests/test-353-doctor-section-ruling.cjs (shebang, 'use strict', header comment naming quick 261028-gmg, PASS/FAIL counters, check(label, cond), exit code FAIL===0). Write the A1 to A7 cases above. Build temp rooms with fs.mkdtempSync(path.join(os.tmpdir(), '261028-gmg-')), write `.mindrian/section-jobs.json` with the exported constants, and remove every temp dir in a finally block. Use ratified_by 'navigator' only (no real names, per the repo rule). Run it and confirm it fails because readRoomSectionJobs is missing.

Re-open tests/run-all-353.sh deliberately, as its own header asks: add one header line `#   test-353-room-section-jobs.cjs    quick 261028-gmg (room section-job declarations)`, add one dated note under the IMPORTANT block (`# Re-opened deliberately by quick 261028-gmg (2026-10-28): one run_if leg for test-353-room-section-jobs.cjs.`), add one run_if leg after the `doctor section-ruling` leg (label `353: room section-job declarations (quick 261028-gmg)`), and add lib/core/doctor/section-ruling-module.cjs, lib/core/navigation-engine.cjs and lib/core/feyminto/next-move.cjs to PHASE_353_SURFACES so the em-dash guard covers them (all three have 0 em dashes at base).

GREEN: in lib/core/section-registry.cjs, add the constants ROOM_SECTION_JOBS_REL ('.mindrian/section-jobs.json'), ROOM_SECTION_JOBS_SCHEMA ('mos.room-section-jobs/1') a private 262144-byte (256 KB) size cap (large enough that the 70 KB hostile-value case in A5 reaches the per-entry checks; a real room needs a few KB), and ROOM_SECTION_JOBS_VALUE_CAP = 64. Add readRoomSectionJobs(roomDir), Node built-ins only (fs, path), no new require (this file is on hook-reachable hot paths and stays .cjs with zero dependencies). It reads the file fresh on every call, the same rule as lib/core/room-constraints.cjs, so a navigator edit takes effect at once. Steps: return the empty result when roomDir is not a non-empty string; fs.lstatSync `<roomDir>/.mindrian` first: ENOENT returns present:false, and a symlink or anything that is not a directory gives file_symlink. Then fs.lstatSync the file: ENOENT returns present:false; isSymbolicLink() true or isFile() false gives file_symlink; a size above the cap gives file_too_large. Do NOT use fs.statSync or fs.existsSync for these checks: both follow symlinks, so a link to a file outside the room would be read. Read the file with fs.readFileSync only after both lstat checks pass; any other fs error or a JSON.parse failure gives file_unreadable; a top level that is not a plain object, a schema value that is not exactly ROOM_SECTION_JOBS_SCHEMA, or a `sections` value that is not a plain object gives file_malformed. For each entry, apply the checks in this order and record the first failure: invalid_slug (not a non-empty string of at most 128 characters, contains '/' or a backslash or NUL, starts with '.', is 'prototype', or is any name for which (slug in Object.prototype) is true, which covers '__proto__', 'constructor', 'toString', 'valueOf' and 'hasOwnProperty'; do NOT lowercase, real sections such as 'Clients' use capitals). Reason for the prototype rule: the canon lookup line canon[slug] finds inherited properties, so at base getSectionJob('toString') returns a row with no job_id (PROVEN) and never reaches the room branch. Constraint 3 forbids an edit to that line, so the declaration is rejected visibly instead of failing silently; malformed_entry (the value is not a plain object); canon_section (Object.prototype.hasOwnProperty.call on the loaded canon `sections`; constraint 1); unknown_job_id (job_id fails isDeclaredJob; constraint 2); invalid_secondary_job_id (secondary_job_id is present and not null, and fails isDeclaredJob or equals job_id); unratified (ratified_by is not a non-empty string of at most 64 characters, or ratified_at does not start with YYYY-MM-DD; the 64-character bound keeps the doctor action line short). Store accepted rows on an Object.create(null) map in the accepted-row shape from the Interfaces section; vocabulary_extension is true only when job_id is a member of VOCABULARY_EXTENSION_JOBS. In every rejected entry, cut slug and job_id to their first ROOM_SECTION_JOBS_VALUE_CAP (64) characters; a job_id that is not a string is null. Cut the values after the checks run, never before them, so a 70 KB slug still fails the 128-character slug rule. Sort rejected entries by slug, file-level entries (slug null) first. The function never throws.

Change getSectionJob(slug) to getSectionJob(slug, roomDir). Do NOT edit the existing canon lookup line or the canon return shape (constraint 3 and constraint 8: the no-room path and every canon row stay byte-identical, so no ruling fingerprint can move). Only inside the existing `if (!row)` branch: when roomDir is a non-empty string and slug is a string, read readRoomSectionJobs(roomDir) and return a copy of the accepted row for an own-property match; otherwise return the existing undeclared shape unchanged. Update the JSDoc (@param {string} [roomDir]) and the Phase 353 Plan 02 comment block with one authority sentence: the shipped canon is the only source for standard sections; a room may declare jobs only for its own custom sections, in <roomDir>/.mindrian/section-jobs.json, closed vocabulary, navigator-ratified, and a canon row always wins. Export readRoomSectionJobs, ROOM_SECTION_JOBS_REL, ROOM_SECTION_JOBS_SCHEMA and ROOM_SECTION_JOBS_VALUE_CAP; keep the JOB_VOCABULARY getter as is. Do not edit data/section-job-canon.json. No em dashes.
  </action>
  <verify>
    <automated>node tests/test-353-room-section-jobs.cjs && node tests/test-353-section-canon.cjs && node tests/test-369-hook-require-graph.cjs && bash -n tests/run-all-353.sh && git diff --exit-code 30ff3e8d0 -- data/section-job-canon.json</automated>
  </verify>
  <done>A1 to A7 pass. getSectionJob(slug) with no room is proven identical to the base function. A declared canon slug and every out-of-vocabulary or unratified declaration are rejected with a named reason. A symlinked file or .mindrian directory is rejected as file_symlink and never read. A prototype-name slug is rejected as invalid_slug. Rejected values are cut to 64 characters. section-registry.cjs requires nothing new. The canon file has no diff against 30ff3e8d0. run-all-353.sh parses and carries the new leg.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Doctor reports room-declared sections apart from canon sections</name>
  <files>lib/core/doctor/section-ruling-module.cjs, data/doctor-modules.json, tests/test-353-doctor-section-ruling.cjs</files>
  <behavior>
    - D1 count fix: the registry-count assertion becomes 30, labelled '30 modules (28 plus mcp-write-path, quick 261026-s8c, and graph-doctor, quick 261009-4h4)'.
    - D2 no file (alpha-room copy): job_sources.room is [], job_sources.canon lists business-model, market-analysis and problem-definition, drift.room_declarations_rejected is [], the detail contains 'room_declarations_rejected:0' and 'room-declared:0' and does not contain 'cut to 64 chars', and ruling_fingerprint_drift is the same three sections as before this plan.
    - D3 mixed room (an alpha-room copy under tests/fixtures/icm-rooms/.tmp-*, plus custom sections homepage, blog and Clients, each holding notes.md, plus a declaration file: homepage understand-market ratified, Clients explore ratified, blog 'write-blog', problem-definition 'find-bottleneck' ratified, newsletter understand-market with no ratified_by): status 'warn'; drift.sections_without_job_id deep-equals ['blog']; job_sources.room sorted deep-equals ['Clients', 'homepage']; neither homepage nor Clients is in ruling_fingerprint_drift; drift.room_declarations_rejected has exactly 3 entries with reasons blog unknown_job_id, newsletter unratified, problem-definition canon_section; the detail contains 'room_declarations_rejected:3', 'room-declared:2' and 'rejected values cut to 64 chars'; action_lines contains a line naming homepage and understand-market, a line naming blog and unknown_job_id, and a line naming '.mindrian/section-jobs.json'.
    - D4 fix on D3: after fix() and a re-check, ruling_fingerprint_drift is empty, homepage/CONTEXT.md does not exist, and the declaration file is byte-identical to its content before fix().
    - D5 damaged file ('not json'): drift.room_declarations_rejected is one entry with reason file_unreadable and slug null, and every custom section is in sections_without_job_id.
    - D6 registry row: exactly 7 keys, no auto_heal key, and the description contains 'section-jobs.json'.
  </behavior>
  <action>
RED first: extend tests/test-353-doctor-section-ruling.cjs with D1 to D6. Keep every existing assertion except the stale count, which D1 replaces. Use the file's own temp-dir idiom (fs.mkdtempSync under path.dirname(ALPHA_ROOM) with a '.tmp-test-261028-gmg-' prefix, removed in finally). Write the declaration file with the constants exported by Task 1. Run the test and confirm the new cases fail.

GREEN in lib/core/doctor/section-ruling-module.cjs check(), per constraint 6:
- Call sectionRegistry.readRoomSectionJobs(roomPath) once, after buildRoomMap succeeds.
- For each section node, call sectionRegistry.getSectionJob(slug, roomPath). No job_id: push to drift.sections_without_job_id, as today. source 'room-declaration': push node.path to job_sources.room and continue, with NO fingerprint check. Add a comment with the reason: no shipped contract template exists for a custom slug, writeSectionContracts emits contract_template_missing for it, so fix() can never generate a ruling document and the drift would never clear. Any other row: push to job_sources.canon and run today's fingerprint check unchanged.
- Add drift.room_declarations_rejected (the rejected array) and add its length to totalDrift. A broken declaration is never silent (constraint 2): it is a declaration-file finding, separate from the section findings, and it makes the status warn.
- Detail strings. The ok path becomes: N node(s) checked, 0 drift (ruling_fingerprint_drift:0, sections_without_job_id:0, subrooms_without_job_id:0, claims_without_anchor:0, room_declarations_rejected:0); job sources: canon:A, room-declared:B. The warn path appends ', room_declarations_rejected:E' inside the parentheses and '; job sources: canon:A, room-declared:B' after them, before the existing recoverable note. When room_declarations_rejected is above 0, also append '; rejected values cut to 64 chars' after the job sources part and before the recoverable note, so the reader knows a printed slug or job_id can be shortened. The rejected action lines print the values as the registry returns them (already cut). Keep the four existing names.
- Return job_sources on the ok and warn paths. Return action_lines only when non-empty. Write one line per room-declared section ('room-declared: <path> -> <job_id> (ratified by <ratified_by> on <ratified_at>)'). Write one line per rejected entry ('rejected declaration: <slug, or "file" when slug is null> (<reason>) in .mindrian/section-jobs.json'). When sections_without_job_id is not empty, write one line: 'undeclared section(s): <paths, comma separated>. Declare each in .mindrian/section-jobs.json under sections.<slug> with job_id, ratified_by and ratified_at; job ids come from the closed job vocabulary and the navigator ratifies each one.'
- fix(): no logic change. The report-only text adds room_declarations_rejected. fix() never writes section-jobs.json.
- Rewrite the header comment: five drift classes, the job_sources split, and replace "Never touches sections_without_job_id (a canon-file edit, not a room-file rewrite)" with "Never touches sections_without_job_id: a standard section is a canon-file edit, and a custom section is a navigator-ratified entry in <room>/.mindrian/section-jobs.json; fix() writes neither."

In data/doctor-modules.json, change ONLY the section-ruling row's description value. Say five drift classes, add room_declarations_rejected, and add one sentence: room-declared sections (from <room>/.mindrian/section-jobs.json, closed job vocabulary, navigator-ratified, never overriding a canon row) are listed apart from canon sections and are not drift. Keep the seven keys and add no auto_heal key (R-353-A). Do not change introduced_version. commands/doctor.md does not mention section-ruling, and tests/test-doctor-doc-parity.cjs reads only flags and --fix class letters, so no doc text must change (constraint 9). Leave commands/doctor.md unchanged and prove parity stays green. No em dashes.
  </action>
  <verify>
    <automated>node tests/test-353-doctor-section-ruling.cjs && node tests/test-doctor-module-contract-parity.cjs && node tests/test-doctor-doc-parity.cjs && node tests/test-36925-feyminto-contract.cjs && node -e "const r=require('./data/doctor-modules.json').modules.find(m=>m.id==='section-ruling'); if(Object.keys(r).length!==7||('auto_heal' in r)||r.description.indexOf('section-jobs.json')===-1){process.exit(1)}"</automated>
  </verify>
  <done>The doctor lists room-declared sections in job_sources.room and action_lines, apart from canon sections. Only still-undeclared sections are in sections_without_job_id. Rejected declarations are a named drift class. No room-declared section ever enters ruling_fingerprint_drift, and fix() leaves no residual drift for them. The registry row has seven keys and no auto_heal. Contract parity and doc parity are green, and test-353-doctor-section-ruling.cjs is fully green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Room-aware callers where the room is known, then the full regression sweep</name>
  <files>lib/core/feyminto/next-move.cjs, lib/core/navigation-engine.cjs, lib/core/room-skeleton-scaffold.cjs, tests/test-353-room-section-jobs.cjs</files>
  <behavior>
    - C1 next-move: in a temp room with homepage/notes.md, problem-definition/notes.md (no CONTEXT.md) and a file declaring homepage understand-market (ratified) and problem-definition find-bottleneck (rejected, canon_section): gatherNest({ roomDir: tmp, sectionDir: tmp/homepage }).job.id is 'understand-market'; gatherNest for tmp/problem-definition gives 'find-problem' (canon wins); in a twin room with no file, homepage gives null.
    - C2 decide() ledger fallback: precondition, require('lib/core/section-ruling-candidates.cjs').buildLedgerCandidates({ jobId:'understand-market' }) is non-null. With ctx = { section:'Clients', roomDir: tmp } and Clients declared understand-market, navigationEngine.decide({}, ctx) leaves Array.isArray(ctx.tierCandidates) true and ctx.tierCandidatesFallbackReason 'bad_section' (the capital C fails the face regex, so this isolates the line 1189 branch). The same ctx shape on the twin room with no file leaves ctx.tierCandidates not an array.
    - C3 decide() face path: ctx = { section:'homepage', roomDir: tmp } gives Array.isArray(ctx.tierCandidates) true. The twin room with no file gives not an array. Fallback (UNVERIFIED that the face block yields a runnable primary for understand-market on a nest with no face file; if it does not, the ledger fallback at line 1189 still runs with the room): if the tierCandidates assertion cannot hold without an edit to navigation-engine.cjs beyond line 1189, relax C3 to assert gatherNest({ roomDir: tmp, sectionDir: tmp/homepage }).job.id === 'understand-market' and getSectionJob('homepage', tmp).source === 'room-declaration'. Record the relaxation and its reason in the SUMMARY. Do not change the face block to force C3.
    - C4 writeSectionContracts: in both the declared room and the twin room, writeSectionContracts(room, ['problem-definition', 'homepage'], result), with result = { warnings: [], errors: [], contracts_created: [], ruling_regenerated: [] } (the shape doctor fix() passes), writes problem-definition/CONTEXT.md with the same ruling_fingerprint in both rooms, equal to buildRulingBlock(getSectionJob('problem-definition'), ledger).fingerprint. result.warnings contains 'contract_template_missing:homepage', and homepage/CONTEXT.md exists in neither room.
  </behavior>
  <action>
RED first: append C1 to C4 to tests/test-353-room-section-jobs.cjs (temp rooms in os.tmpdir(), removed in finally; gray-matter for the C4 frontmatter read; the ledger from data/section-command-ledger.json). Run it and confirm C1, C2 and C3 fail on the declared room. C4 passes before and after: it pins that the canon fingerprint does not move.

GREEN, per constraint 4 and the caller inventory in the context section:
- lib/core/feyminto/next-move.cjs: readJob(sectionPath, section) becomes readJob(sectionPath, section, roomDir) and calls getSectionJob(section, roomDir). gatherNest passes its resolved roomDir. Keep the CONTEXT.md job_id precedence. Update the readJob doc line: the id from CONTEXT.md, else the canon, else the room's ratified declaration in .mindrian/section-jobs.json. readJob is not exported, so no other caller changes. BRIEF.md (lib/core/feyminto/brief.cjs line 520) then shows the declared job for a custom nest. No code change is needed there.
- lib/core/navigation-engine.cjs line 1189: call getSectionJob(ctx.section, roomDir), where roomDir is ctx.roomDir when it is a non-empty string, else undefined. Extend the 'Activation today' comment by one sentence: a custom section resolves through the room's declaration file when ctx.roomDir is threaded, and it is a local read only.
- lib/core/room-skeleton-scaffold.cjs line 519: call sectionRegistry.getSectionJob(slug, roomDir). Add a one-line comment: behavior-neutral today, because the template check above skips every slug without a shipped template and canon wins for every slug that has one. Do NOT edit buildRulingBlock, _rulingFingerprint, the `Source:` line, or RULING_WRITER_CONTRACT_VERSION (constraint 8).
- Leave unchanged, with no edit at all: lib/core/navigation/section-gate.cjs (no room in evaluateFilingGate args), lib/core/feyminto/theo-ask.cjs (no room, CORE_SECTIONS-gated, Theo path), scripts/eval-icm-writers.cjs (the deliberate exception stated in the context section), lib/core/room-map.cjs.

Then run the full sweep in the <verify> block. Restore the fleet report file after run-all-353.sh. Do not run scripts/doctor.cjs, and do not run any check, against a room under /home/jsagi/MindrianRooms (constraint 7). Use fixtures and temp dirs only. Commit each task with explicit paths (git add <paths>, then git commit --only <paths>). Do not push. No em dashes.
  </action>
  <verify>
    <automated>node tests/test-353-room-section-jobs.cjs && node tests/test-36925-next-move.cjs && node tests/test-353-decide-budget.cjs && node tests/test-353-ruling-doc.cjs && node tests/test-353-filing-gate.cjs && node tests/test-36925-brief.cjs && node tests/test-36925-feyminto-contract.cjs && LOG=$(mktemp) && { bash tests/run-all-353.sh > "$LOG" 2>&1; git checkout -- .planning/phases/353-icm-section-ruling-system-self-locating-room-map-jtbd-rooted/353-FLEET-REPORT.json; } && test "$(grep -E '^>>> .*: FAILED' "$LOG")" = ">>> 353: ledger shape (plan 02): FAILED" && git diff --exit-code 30ff3e8d0 -- data/section-job-canon.json lib/core/navigation/section-gate.cjs lib/core/feyminto/theo-ask.cjs scripts/eval-icm-writers.cjs lib/core/room-map.cjs && git diff --check 30ff3e8d0</automated>
    <fallback>C3 only: if the face path gives no tierCandidates, relax C3 inside tests/test-353-room-section-jobs.cjs to gatherNest().job.id === 'understand-market' and getSectionJob('homepage', tmp).source === 'room-declaration'. The automated command above stays the same. Record the relaxation in the SUMMARY.</fallback>
  </verify>
  <done>C1 to C4 pass (C3 in its full form, or in its stated fallback form). next-move and decide() resolve a room-declared job for a custom section when they know the room, and canon wins for canon slugs. writeSectionContracts passes the room without moving any canon fingerprint. run-all-353.sh shows `ledger shape` (the pre-existing worktree ENV GAP) as the only FAILED leg. The four unchanged callers and the canon file have no diff against 30ff3e8d0. The fleet report file is restored.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| room folder -> plugin reader | `<roomDir>/.mindrian/section-jobs.json` is editable by anyone with room access (navigator, an agent, a Cowork peer). Its content is untrusted input to section-registry.cjs. |
| plugin -> Brain (Theo) | No new crossing. theo-ask.cjs is unchanged and sends only CORE_SECTIONS kinds and closed-vocabulary job ids. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-gmg-01 | Tampering | readRoomSectionJobs | mitigate | Every job_id and secondary_job_id must pass isDeclaredJob (closed vocabulary); a canon slug is rejected as canon_section, and getSectionJob checks canon first. Rejected entries appear in drift.room_declarations_rejected (Task 1 A4 and A5, Task 2 D3). |
| T-gmg-02 | Tampering | readRoomSectionJobs | mitigate | Prototype keys: 'prototype' and every name for which (slug in Object.prototype) is true ('__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty') are invalid_slug. Accepted rows live on an Object.create(null) map. Lookups use own-property checks (Task 1 A5 and A7). |
| T-gmg-03 | Denial of Service | getSectionJob on the decide() and doctor paths | mitigate | 262144-byte size cap checked by fs.lstatSync before the read (file_too_large). The file is read only for a slug with no canon row and only when a room is passed. test-353-decide-budget.cjs keeps the 1200 ms NAV budget. |
| T-gmg-04 | Information Disclosure | Canon Part 8 | mitigate | No Brain or network call added. The file is in a dot directory that discoverSections and isIndexableArtifactFile exclude. A custom slug never becomes a Theo section_kind (theo-ask.cjs unchanged, git diff gate in Task 3). |
| T-gmg-05 | Repudiation | navigator ratification | mitigate | Entries without ratified_by and ratified_at (YYYY-MM-DD) are rejected as unratified. The plugin ships no writer, and doctor fix() never writes the file (Task 2 D4). |
| T-gmg-06 | Elevation of Privilege | an agent fabricates ratified_by | accept | A structural check cannot tell a real ratification from a typed one. The file is one reviewable diff in the room's git history, and the doctor prints ratified_by and ratified_at for every room-declared section. |
| T-gmg-07 | Tampering | path traversal | accept | No slug is used as a path. The reader joins only roomDir and the fixed relative path '.mindrian/section-jobs.json'. Slugs with '/' or a backslash are rejected anyway. |
| T-gmg-08 | Information Disclosure | symlinked declaration file or .mindrian directory | mitigate | fs.lstatSync on `<roomDir>/.mindrian` and on the file; a symlink or a non-regular entry is file_symlink and is never read, so a link cannot pull a file from outside the room into the doctor output (Task 1 A6). Residual: a swap between the lstat and the read needs write access to the room folder, which can already edit the file directly; accept. |
| T-gmg-09 | Denial of Service | doctor output size | mitigate | Rejected entries carry slug and job_id cut to 64 characters, ratified_by is bounded to 64 characters, and the doctor detail states the cut (Task 1 A5, Task 2 D3). |
</threat_model>

<verification>
Run from /home/jsagi/dev/MindrianOS-Plugin/.claude/worktrees/section-job-room-declarations only:
1. node tests/test-353-room-section-jobs.cjs (A1-A7, C1-C4 green)
2. node tests/test-353-doctor-section-ruling.cjs (fully green, count 30)
3. node tests/test-doctor-module-contract-parity.cjs and node tests/test-doctor-doc-parity.cjs (green)
4. node tests/test-353-section-canon.cjs, test-353-ruling-doc.cjs, test-353-filing-gate.cjs, test-353-decide-budget.cjs, test-36925-next-move.cjs, test-36925-brief.cjs, test-36925-feyminto-contract.cjs, test-369-hook-require-graph.cjs (green)
5. bash tests/run-all-353.sh: PASS=22 FAIL=1; the only FAILED leg is `ledger shape` (pre-existing worktree ENV GAP). Restore 353-FLEET-REPORT.json afterwards.
6. git diff --exit-code 30ff3e8d0 -- data/section-job-canon.json lib/core/navigation/section-gate.cjs lib/core/feyminto/theo-ask.cjs scripts/eval-icm-writers.cjs lib/core/room-map.cjs (no diff)
7. Em-dash scan over every touched file: `grep -c "$(printf '\xe2\x80\x94')"` returns 0 for each file in files_modified.
8. git diff --check 30ff3e8d0 (clean). `git status --short` shows no change under /home/jsagi/MindrianRooms, and the main checkout at /home/jsagi/dev/MindrianOS-Plugin is untouched.
</verification>

<success_criteria>
- A room can declare a closed-vocabulary, navigator-ratified job for a custom section in <roomDir>/.mindrian/section-jobs.json, and every caller that knows the room reads it, except the one stated exception (scripts/eval-icm-writers.cjs).
- getSectionJob(slug) without a room is proven identical to base 30ff3e8d0.
- A canon row is never overridden, and the canon file and every canon ruling fingerprint are unchanged.
- The doctor reports room-declared sections apart from canon sections, rejected declarations as their own drift class, and only still-undeclared sections as sections_without_job_id. The registry row keeps seven keys and no auto_heal.
- No job id is written for pws-website, and no file is written under /home/jsagi/MindrianRooms.
- Local reads only, on CLI, Desktop and Cowork alike. No Brain call, no network call, no new MCP tool, no hook change.
</success_criteria>

<out_of_scope>
Stated boundaries, each with its reason (not deferrals of a requested item):
- Assigning job ids for pws-website or any real room: the navigator ratifies each job id (constraint 7).
- A ruling document (CONTEXT.md) for a custom section: no shipped contract template exists for a custom slug, and the task does not ask for one.
- A writer tool or MCP tool for section-jobs.json: the navigator writes the file, and human ratification is the point (Canon Part 9).
- The filing gate (evaluateFilingGate) for a room-declared section: its args carry no room (constraint 4 rule). Claims filed in a custom section stay unanchored, as today.
- Filing the reasoning trail into ~/MindrianRooms/rethinking-mindrianos: constraint 7 forbids writes under /home/jsagi/MindrianRooms. The main session decides on compositing.
- The `ledger shape` leg of run-all-353.sh: a pre-existing ENV GAP in worktree checkouts.
</out_of_scope>

<output>
Create `.planning/quick/261028-gmg-room-level-section-job-declarations/261028-gmg-SUMMARY.md` when done. It is gitignored under `.planning/*`, so the main session adds it with `git add -f`.
</output>
