---
phase: 79-native-filing-wikilinks
plan: 01
subsystem: vault/filing
tags: [wikilinks, filing, native, vault, NATIVE-01, NATIVE-02]
requires:
  - lib/vault/room-scanner.cjs (Phase 76)
  - scripts/vault-wikilink-injector.cjs (Phase 76 -- source of extracted helpers)
provides:
  - lib/vault/wikilink-builder.cjs (pure builder API)
  - scripts/wikilink-file.cjs (single-file post-write wrapper)
  - room-passive skill instructions for native wikilink injection
affects:
  - commands/file-meeting.md (post-write wikilink calls)
  - skills/room-passive/SKILL.md (Filing Intelligence section)
tech-stack:
  added: []
  patterns:
    - Pure-function builder module (zero fs/child_process imports)
    - Soft-fail wrapper script (filing never aborts on wikilink errors)
    - Idempotent injection (running twice = same output)
key-files:
  created:
    - lib/vault/wikilink-builder.cjs
    - lib/vault/wikilink-builder.test.cjs
    - scripts/wikilink-file.cjs
  modified:
    - skills/room-passive/SKILL.md
    - commands/file-meeting.md
decisions:
  - Extracted Phase 76 helpers verbatim into pure module rather than refactoring vault-wikilink-injector.cjs to require it (keeps Phase 76 batch script untouched and stable)
  - Wrapper script soft-fails on every error path (read, scan, build, write) so filing pathway is fully backward compatible
  - file-meeting handler is commands/file-meeting.md (no scripts/file-meeting.sh exists in this plugin), wired via inline node calls in the command prose
metrics:
  duration: ~5min (work pre-staged before agent spawn)
  completed: 2026-04-13
  tasks: 2
  files: 5
---

# Phase 79 Plan 01: Pure Wikilink Builder + Filing Wiring Summary

Extracted the pure wikilink-injection helpers from Phase 76's batch script into a reusable `lib/vault/wikilink-builder.cjs` module, added a 10-test zero-dependency unit suite, built a soft-failing `scripts/wikilink-file.cjs` wrapper, and wired both the room-passive skill and the /mos:file-meeting command to call the wrapper at write time so new artifacts arrive pre-linked.

## Public API: lib/vault/wikilink-builder.cjs

```javascript
module.exports = {
  // Public builders
  buildTeamLinks,       // (text, teamProfiles, { ownProfilePath }) -> string
  buildSectionLink,     // (sectionName, { display }) -> string
  buildMeetingLink,     // (meetingSlug) -> string
  buildFiledToFooter,   // ({ targetPath, meetingSlug }) -> string (1 or 2 lines)
  injectFiledToFooter,  // (content, { targetPath, meetingSlug }) -> string (idempotent)
  // Helpers exported for downstream reuse
  meetingDisplayName,   // (slug) -> "Align Strategy Session"
  slugToTitle,          // (slug) -> "Business Model"
  frontmatterSplit,     // (content) -> { bodyStart }
  replaceFirstOutsideLinks,
  appendStructuralLine,
};
```

All functions are pure: no `fs`, no `child_process`, no globals. Callers pass in the team-profile array (from `room-scanner.scanRoom().teamProfiles`) so the module never reads disk.

### Behavior contract

- `buildTeamLinks` replaces the first occurrence of each unique team display name in the body (skips frontmatter), prefers longer names over shorter prefixes ("Avital Leibovich" beats "Avital"), skips self-links via `ownProfilePath`, and is idempotent.
- `buildSectionLink('business-model')` returns `[[business-model/ROOM.md|business-model]]`; with `{ display: 'Business Model' }` returns the display variant.
- `buildMeetingLink('2026-04-09-align-strategy-session')` returns `[[meetings/2026-04-09-align-strategy-session/summary.md|Align Strategy Session]]`.
- `buildFiledToFooter({ targetPath, meetingSlug })` returns 2 lines; if `targetPath` is null only the source-meeting line is emitted.
- `injectFiledToFooter` places the lines after the frontmatter close and is a no-op on re-injection.
- Zero team profiles -> content returned unchanged (WIKI-06 graceful fallback).

## Test Suite (10 cases, all passing)

`lib/vault/wikilink-builder.test.cjs` runs via `node lib/vault/wikilink-builder.test.cjs`:

```
ok  buildTeamLinks replaces first occurrence only
ok  buildTeamLinks prefers longer name over prefix (Avital Leibovich > Avital)
ok  buildTeamLinks skips self-link when ownProfilePath matches
ok  buildTeamLinks skips frontmatter region
ok  buildTeamLinks is idempotent (running twice = same output)
ok  buildSectionLink returns exact format and honors display override
ok  buildMeetingLink strips date prefix and title-cases
ok  buildFiledToFooter returns both lines / one line appropriately
ok  injectFiledToFooter inserts after frontmatter and is idempotent
ok  buildTeamLinks with zero team profiles returns content unchanged

10 passed, 0 failed
PASS
```

Zero npm deps. Uses Node's built-in `assert` per the lib/vault/ convention.

## Wrapper: scripts/wikilink-file.cjs

```
node scripts/wikilink-file.cjs <room-dir> <file-path> \
  [--filed-to-target=<relPath>] \
  [--meeting-slug=<slug>]
```

Pipeline:
1. `scanRoom(roomDir)` -- loads team profiles
2. `buildTeamLinks(content, teamProfiles, { ownProfilePath: filePath })`
3. If `--meeting-slug` given: `injectFiledToFooter(content, { targetPath, meetingSlug })`
4. Write back only if changed

Every error path (room missing, file missing, module load, scanRoom, buildTeamLinks, injectFiledToFooter, write) logs to stderr and returns/exits 0. Filing never aborts because of a wikilink pass.

## Where file-meeting invokes the builder

`commands/file-meeting.md` was updated in two places:

1. **Step 4 (Create Filed Artifacts)** -- after each filed artifact is written:
   ```bash
   node scripts/wikilink-file.cjs "$ROOM_DIR" "$ARTIFACT_PATH"
   ```
2. **Step 5 (Filed-to stubs + summary)** -- after each filed-to stub and the meeting summary:
   ```bash
   node scripts/wikilink-file.cjs "$ROOM_DIR" "$STUB_PATH" \
     --filed-to-target="{section}/YYYY-MM-DD-{slug}.md" \
     --meeting-slug="YYYY-MM-DD-{meeting-name}"

   node scripts/wikilink-file.cjs "$ROOM_DIR" "$SUMMARY_PATH" \
     --meeting-slug="YYYY-MM-DD-{meeting-name}"
   ```

Note: this plugin has no `scripts/file-meeting.sh` -- the file-meeting handler is the command markdown that Larry executes. The plan's reference to `scripts/file-meeting.sh` was a planning-time assumption; the real entry point is the command. No deviation impact: NATIVE-01/02 are still satisfied.

## room-passive skill update

A new "Wikilink Injection on Filing (NATIVE-02)" subsection was added under "## Filing Intelligence" in `skills/room-passive/SKILL.md`. Key contents:

- **Rule:** Every artifact written into the active room MUST arrive with wikilinks already present. No retroactive batch.
- **Preferred path:** call `node scripts/wikilink-file.cjs "$ROOM_DIR" "$NEW_FILE_PATH" [--filed-to-target=... --meeting-slug=...]`.
- **Manual fallback:** explicit team-link, section-link, filed-to, and meeting-display-name patterns Claude can emit directly when the wrapper is not feasible.
- **Graceful fallback (WIKI-06):** zero team profiles or zero meetings -> skip that link type, never crash.
- **Idempotence:** never double-link the same display name; never duplicate a filed-to footer line.
- **Canonical builder:** "See `lib/vault/wikilink-builder.cjs` for the canonical builder functions."

The subsection lives entirely inside the existing `## Filing Intelligence` section -- no unrelated restructuring.

## Verification

```
node lib/vault/wikilink-builder.test.cjs   # 10/10 PASS
node -e "require('./lib/vault/wikilink-builder.cjs'); require('./lib/vault/room-scanner.cjs'); require('./scripts/wikilink-file.cjs')"
grep -c "Wikilink Injection on Filing" skills/room-passive/SKILL.md   # 1
grep -c "wikilink-builder" skills/room-passive/SKILL.md               # 2
grep -c "wikilink-file.cjs" commands/file-meeting.md                  # 3
```

## Deviations from Plan

**1. [Rule 3 - Blocker] No scripts/file-meeting.sh exists**
- **Found during:** Task 2
- **Issue:** Plan referenced `scripts/file-meeting.sh` and `bash -n` syntax check. This plugin has no such file -- the file-meeting handler is `commands/file-meeting.md` (Claude executes the command markdown directly).
- **Fix:** Wired the wikilink-file.cjs invocation directly into the relevant Step 4 and Step 5 sections of `commands/file-meeting.md` instead. Same outcome (NATIVE-01/02 satisfied), correct entry point. Skipped the `bash -n` half of the verify line since there is no shell script to lint.
- **Files modified:** commands/file-meeting.md (instead of scripts/file-meeting.sh)
- **Commit:** ee215ad

No other deviations. No auto-fixed bugs. No architectural changes needed.

## Self-Check: PASSED

- FOUND: lib/vault/wikilink-builder.cjs (committed 7e4ed91)
- FOUND: lib/vault/wikilink-builder.test.cjs (committed 7e4ed91)
- FOUND: scripts/wikilink-file.cjs (committed ee215ad)
- FOUND: skills/room-passive/SKILL.md modified (committed ee215ad)
- FOUND: commands/file-meeting.md modified (committed ee215ad)
- FOUND: commit 7e4ed91 (Task 1)
- FOUND: commit ee215ad (Task 2)
- TESTS: 10/10 passing

## Known Stubs

None. All builder functions implemented, all wiring in place, all error paths handled.
