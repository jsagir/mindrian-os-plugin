---
status: resolved
kind: rca
trigger: "file-meeting-missing-reference-files"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: not_applicable
canon_parts: []
created: 2026-08-27T00:00:00Z
updated: 2026-08-27T21:30:00Z
---

## Resolved (goal-directed phase-sweep session, 2026-08-27T21:30Z)

Fix was sitting complete-but-uncommitted in a shared working tree (this repo's
standing condition this whole sweep -- see `docs/2026-08-27-HANDOFF-goal-directed-
phase-sweep-265-271.md`). Re-verified before commit rather than trusted blindly:
`grep -n '`references/' commands/file-meeting.md | grep -v CLAUDE_PLUGIN_ROOT` returns
zero bare citations (all anchored), `node scripts/build-skill-mirrors.cjs --check`
passes clean (112/112, `skills/file-meeting/SKILL.md` mirror already matched -- no
separate commit needed for it), and `tests/test-265-file-meeting-gates.cjs` passes all
4 arms. Committed as-is. The live-end-user-cwd blind spot named below (Resolution.
verification) remains genuinely unverified -- no such sandbox was available here
either -- carried forward as a known limitation, not a blocker.

## Current Focus

reasoning_checkpoint:
  hypothesis: "`commands/file-meeting.md` (the source of truth, byte-mirrored into
    `skills/file-meeting/SKILL.md` by `scripts/build-skill-mirrors.cjs`) cites its 9
    mandatory reference files as BARE relative paths (`` `references/meeting/...` ``,
    `` `references/personality/voice-dna.md` `` -- no `${CLAUDE_PLUGIN_ROOT}` anchor).
    Bare relative paths resolve against the Claude Code session's actual current
    working directory, not the plugin's install directory. In a dev/dogfood session
    (cwd == this repo root) the path coincidentally resolves because `references/` also
    happens to exist at repo root. In a real end-user session (cwd == the user's own
    Data Room, a different directory entirely) the same bare path resolves against the
    Data Room instead and fails with 'File does not exist' -- exactly the reported
    symptom. This is the SAME disease class already diagnosed and fixed in this exact
    file for `bash scripts/<name>` call sites by the resolved debug session
    `.planning/debug/resolved/intern-w1-rooms-skill-script-path.md` (file-meeting was
    literally one of the 11 files fixed there) -- but that fix's grep scope
    (`bash scripts/<name>`) never caught the separate `Read \`references/...\`` pattern
    in this file's own Setup section, so the same disease survived there unaddressed."
  confirming_evidence:
    - "`find /home/jsagi/dev/MindrianOS-Plugin/references -type f` shows all 9 mandatory
      + 1 optional cited files DO exist, at the plugin ROOT's `references/` directory
      (sibling of `skills/` and `commands/`), not inside `skills/file-meeting/`. The
      original hypothesis ('files were never authored') was wrong -- it only searched
      `skills/file-meeting/` and never checked the plugin-root `references/` directory
      the bare path actually resolves against when cwd happens to equal plugin root."
    - "Confirmed present identically in the installed plugin cache
      (`~/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.11/references/meeting/`
      and `.../references/personality/voice-dna.md`) -- not a packaging gap either."
    - "`commands/file-meeting.md` itself is internally inconsistent: its Setup section
      Read instructions (lines 47-56) use bare `references/...`, while its OWN bash
      script invocations elsewhere in the same file (lines 128, 296, 787, 938, 942) use
      the anchored `${CLAUDE_PLUGIN_ROOT}/scripts/...` form -- the correct, established,
      already-proven convention in this repo."
    - "`.planning/debug/resolved/intern-w1-rooms-skill-script-path.md` root-caused and
      fixed the identical disease (bare plugin-relative path, cwd-dependent, 'fails when
      cwd != plugin root') for `bash scripts/<name>` in 11 files including file-meeting,
      concluding `${CLAUDE_PLUGIN_ROOT}` 'is resolvable from any cwd and any subshell' on
      Claude Code. `scripts/build-skill-mirrors.cjs` (Exception Class 3, phase 234-06,
      threat T-234-11) independently confirms `${CLAUDE_PLUGIN_ROOT}` is a Claude-Code-
      injected env var, and further hardens the SKILL.md mirror (not commands/) by
      auto-wrapping every bare `${CLAUDE_PLUGIN_ROOT}` in a fail-closed
      `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?msg}}` for foreign Agent-Skills hosts
      that don't set the var at all."
    - "44 of 121 commands repo-wide use the identical bare `` `references/... `` Read
      pattern -- this is a much larger latent blast radius than file-meeting alone, but
      confirms the pattern is a genuine repo-wide authoring gap (never anchored to
      plugin root for Read instructions), not something specific/deliberate to
      file-meeting."
  falsification_test: "If bare `references/...` paths were in fact resolved against the
    plugin root regardless of session cwd (e.g. if Claude Code's Read tool had special
    plugin-command path resolution), this hypothesis would be false. Checked: no such
    mechanism is documented (WebSearch: Claude Code plugin docs + GH issue #9354 confirm
    `${CLAUDE_PLUGIN_ROOT}` is required precisely because relative paths in command/skill
    markdown resolve relative to the current directory, not the plugin), and this repo's
    own intern-w1 debug session independently reproduced and fixed the exact 'cwd !=
    plugin root -> bare relative path fails' mechanism for the sibling `bash scripts/...`
    pattern in this same file."
  fix_rationale: "Anchor every bare `references/...` citation in `commands/file-meeting.md`
    (the source of truth) with `${CLAUDE_PLUGIN_ROOT}/`, matching the convention already
    used successfully elsewhere in the same file. This is a direct application of the
    already-proven, repo-established fix pattern (not a new mechanism) -- it fixes the
    resolution mechanism itself (root cause), not the symptom (missing files, which were
    never actually missing)."
  blind_spots: "44 other commands share the identical bare-path pattern and are outside
    this session's scope (only file-meeting is being fixed here per task scope) -- filing
    a follow-up finding, not a fix, for the wider blast radius. Also not independently
    verified against a live 'foreign Agent-Skills host' or an actual separate-directory
    Claude Code session (no such sandbox available here) -- verification is via
    constructing the resolved absolute path and confirming the target file exists, plus
    the existing mirror-generator's own portability-hardening tests/checks."
next_action: awaiting human verification that a real /mos:file-meeting invocation from a
Data Room (cwd != this plugin repo) now loads all reference files successfully in Setup.

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ working tree (11 commits ahead of
  `origin/main`, uncommitted fix on top), repo `/home/jsagi/dev/MindrianOS-Plugin`
- **WIRE claims probe against:** none. This bug and its fix touch zero Brain wire --
  it is a pure local plugin-markdown path-resolution defect (Setup-step `Read`
  citations), verified entirely by filesystem inspection and `git log`.
- **Date of audit:** 2026-08-27
- **Re-verification rule:** the fix in this file is uncommitted. Re-verify
  `commands/file-meeting.md` and its `skills/file-meeting/SKILL.md` mirror against
  `origin/main` HEAD once committed and released; until then this finding is tagged
  `needs-release-before-live`.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.11 (installed cache) / unreleased fix on `main` working tree
- Branch: main (11 commits ahead of origin/main at time of report, uncommitted changes present
  in .planning/STATE.md, docs/AMENDMENT-2026-08-27-DECISIONS-1-AND-5-MOAT-SHIFT.md,
  evals/plurai/211-baseline.json; untracked docs/2026-08-20-gate0-queries.cypher,
  docs/MINDRIANOS-PRD.md, prototypes/ -- unrelated in-flight work, do not touch)
- Reported by: live user-facing session (a navigator ran `/mos:file-meeting` against a real
  meeting transcript in a Data Room; the skill's own Setup step could not load its cited
  reference files)
- Date first observed: 2026-08-27
- Related debug sessions: `.planning/debug/resolved/intern-w1-rooms-skill-script-path.md`
  (same disease class, same file, different citation pattern -- see Evidence). Worth
  checking whether Phase 265 (10/11), 267.1, or 269 planning docs already track this
  before treating as a fresh finding.

## Problem Statement

`/mos:file-meeting`'s SKILL.md Setup section (steps 1-11) requires reading 9 reference files
before the 6-step Claimify pipeline can run:

- references/personality/voice-dna.md
- references/meeting/transcript-patterns.md
- references/meeting/segment-classification.md
- references/meeting/knowledge-typing.md
- references/meeting/section-mapping.md
- references/meeting/artifact-template.md
- references/meeting/summary-template.md
- references/meeting/speaker-profile-template.md
- references/meeting/cross-meeting-intelligence.md
  (references/meeting/cross-relationship-patterns.md is explicitly optional -- "skip gracefully
  if not")

None of the 8 mandatory files exist anywhere in the repo. The skill cannot execute its Claimify
extraction, speaker-profile creation, section-mapping, or meeting-archive steps as documented.

## Symptoms

expected: `/mos:file-meeting` loads its reference docs in Setup, then runs the 6-step pipeline
(speaker ID, Claimify 4-pass extraction with typed claim-node writes via
`navigation.writeClaimNode`, section-mapped filing, meeting archive creation, cross-relationship
scan) against a pasted transcript.

actual: every one of the 9 cited reference files (minus the one explicitly optional one) is
missing. A live session attempting to follow Setup step-by-step could not load any of them.

errors: not a thrown error -- a silent structural gap. `Read` on any of the cited paths returns
"File does not exist." No error surfaces from the skill invocation itself; the failure is only
visible if the reader actually tries to open its own cited Setup files.

timeline: unknown when this gap was introduced. Not previously reported in this repo's
`.planning/debug/` (checked: no existing session matches by slug or by grep for
"file-meeting" reference gap).

reproduction:
1. `find /home/jsagi/dev/MindrianOS-Plugin/skills/file-meeting -type f`
2. Observe only `SKILL.md` is present.
3. Attempt to `Read` any of the 9 cited `references/...` paths under that skill directory.
4. Every read fails with "File does not exist."

Confirmed identically on both surfaces:
- Installed plugin cache: `~/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.11/skills/file-meeting/` -- SKILL.md only.
- Dev repo source of truth: `/home/jsagi/dev/MindrianOS-Plugin/skills/file-meeting/` -- SKILL.md only.

Ruling out a packaging/build-stripping bug: since the DEV REPO itself (source of truth, not a
built/packaged artifact) also lacks the files, the gap is at the source-authoring level, not a
packaging or plugin-cache sync issue.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (all three -- the bug is in the shared
  `commands/file-meeting.md` source markdown, not in any surface-specific harness)
- Affected commands: `/mos:file-meeting` (this RCA). 44 of 121 commands repo-wide cite
  `references/...` with the same unanchored pattern (see Evidence, timestamp
  2026-08-27T00:12:00Z) -- confirmed as a real blast radius, not audited individually here
- Affected users: every real end-user session, on every install, whose Data Room is not
  the plugin repo itself. Not affected: plugin developers dogfooding from
  `/home/jsagi/dev/MindrianOS-Plugin` as cwd, where the bare path coincidentally resolves
  (this is exactly why the bug shipped unnoticed)
- Version range: unknown first-bad version (git history shows the citation was never
  anchored, i.e. present since the file's original authoring) - last-checked
  2.0.0-beta.11 (installed cache), confirmed still broken there
- Severity: high. The command's Setup step is unusable end-to-end for its documented
  purpose in any real Data Room; the pipeline silently degrades to ad hoc manual filing
  with none of Claimify's typed-claim extraction, speaker profiles, or meeting archive
- Blast radius: any of the 44 other commands sharing the bare `references/...` pattern
  are latent instances of the same defect, unconfirmed individually (see Non-Code
  Follow-ups)

## Eliminated

- hypothesis: "The 9 cited reference files were never authored anywhere in the repo (a
  source-authoring gap, not packaging)."
  evidence: "`find /home/jsagi/dev/MindrianOS-Plugin/references -type f` shows all 9
  mandatory + the 1 optional file exist, at the plugin ROOT's `references/` directory
  (sibling of `skills/` and `commands/`) -- `references/personality/voice-dna.md` and
  all 9 files under `references/meeting/`. Also present identically in the installed
  plugin cache (`~/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.11/references/`).
  The original test (`find skills/file-meeting -type f`) only searched the skill's own
  subdirectory and never checked the plugin-root `references/` directory the bare path
  actually needs to resolve against -- an incomplete search, not a true absence."
  timestamp: 2026-08-27T00:10:00Z

## Evidence

- timestamp: 2026-08-27T00:05:00Z
  checked: "`git log --all --diff-filter=A --name-only -- 'skills/file-meeting/references/*'`"
  found: "Zero commits, ever, added any file under that path. Confirms these paths were
  never populated inside the skill's own directory at any point in history."
  implication: "Rules out authored-then-deleted; the skill directory was never meant to
  contain its own copy of these files."

- timestamp: 2026-08-27T00:07:00Z
  checked: "`git log --oneline --all -- skills/file-meeting/` and the mirror-generator
  script `scripts/build-skill-mirrors.cjs`"
  found: "`skills/file-meeting/SKILL.md` is machine-generated: a near-byte-identical
  mirror of `commands/file-meeting.md`, produced by `build-skill-mirrors.cjs` (created
  commit 14f2923d, 'mirror all commands into skills/ via build-skill-mirrors.cjs' --
  Windows commands-registration workaround). `commands/` is the read-only source of
  truth; `skills/<name>/SKILL.md` is always regenerated from it."
  implication: "The actual authoring location to investigate/fix is `commands/file-meeting.md`,
  not `skills/file-meeting/SKILL.md` directly -- editing the mirror alone would be
  overwritten/diverge on the next `build-skill-mirrors.cjs` run and fail its `--check` gate."

- timestamp: 2026-08-27T00:12:00Z
  checked: "`find ./references -type f` (top-level plugin references directory) plus
  `grep -rl 'references/personality/voice-dna' commands/ skills/`"
  found: "A top-level `references/` directory exists at the plugin root with ~100 files
  including all 9 cited by file-meeting's Setup. 44 of 121 commands repo-wide cite
  `references/personality/voice-dna.md` and similar paths using the exact same bare
  (unanchored) relative-path convention."
  implication: "This is a repo-wide authoring convention, not something unique to
  file-meeting -- raises the question of whether it actually resolves correctly at
  runtime, or is a much larger latent bug."

- timestamp: 2026-08-27T00:15:00Z
  checked: "commands/file-meeting.md line-by-line for `${CLAUDE_PLUGIN_ROOT}` usage vs
  bare `references/` usage"
  found: "The SAME file uses `${CLAUDE_PLUGIN_ROOT}/scripts/...` (anchored) for every
  bash script invocation (lines 128, 296, 787, 938, 942), but bare `references/...`
  (unanchored) for every reference-file citation (10 in Setup lines 47-56, 9 more later
  in the body at lines 106, 211, 257, 356, 358, 403, 582, 683, 867, 904)."
  implication: "Internal inconsistency within one file: the author/generator already
  knows relative paths to plugin-bundled files need `${CLAUDE_PLUGIN_ROOT}` anchoring
  (applied correctly for scripts/) but never applied the same treatment to references/."

- timestamp: 2026-08-27T00:18:00Z
  checked: "`.planning/debug/resolved/intern-w1-rooms-skill-script-path.md` (prior
  resolved session, found via CHANGELOG.md line 1114 grep for CLAUDE_PLUGIN_ROOT)"
  found: "This exact disease class -- bare plugin-relative path, works only when
  cwd == plugin root, fails otherwise with 'File does not exist' / exit 127 -- was
  already root-caused and fixed in this exact file (file-meeting was 1 of 11 SKILL.md
  files fixed) for the `bash scripts/<name>` pattern specifically. Root cause quote:
  'the scripts only ever existed at the plugin root, so any invocation with cwd !=
  plugin root failed.' Fix quote: '${CLAUDE_PLUGIN_ROOT} is resolvable from any cwd and
  any subshell, unlike a locally-computed path.' That session's own grep scope
  (`bash scripts/<name>`) never covered the separate `Read \`references/...\`` pattern,
  so this instance of the same disease was never caught by that fix."
  implication: "Confirms the fix mechanism (`${CLAUDE_PLUGIN_ROOT}` anchoring) is
  already proven and repo-established for exactly this failure mode. Confirms the root
  cause mechanism itself (cwd != plugin root breaks bare relative paths) is not
  speculative -- it was independently reproduced and fixed once before in this very file."

- timestamp: 2026-08-27T00:22:00Z
  checked: "WebSearch: Claude Code plugin command markdown relative path resolution +
  GitHub issue anthropics/claude-code#9354"
  found: "Claude Code's plugins-reference docs and issue #9354 confirm `${CLAUDE_PLUGIN_ROOT}`
  exists precisely because relative paths inside command/skill markdown resolve against
  the current working directory, not the plugin's install directory."
  implication: "External confirmation, independent of this repo's own history, that the
  bare-path pattern is cwd-dependent and not safe for plugin-bundled file references."

- timestamp: 2026-08-27T00:25:00Z
  checked: "`scripts/build-skill-mirrors.cjs` Exception Class 3 (lines 99-129,
  `applyPluginRootPortability`)"
  found: "The generator already has machinery, built for phase 234-06 (threat T-234-11),
  that auto-wraps every bare `${CLAUDE_PLUGIN_ROOT}` token found in a command's body with
  a fail-closed `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?msg}}` pattern when producing
  the SKILL.md mirror (for foreign Agent-Skills hosts that don't set the var at all).
  This only fires on tokens that are ALREADY `${CLAUDE_PLUGIN_ROOT}` in the source --
  it does not, and is not meant to, invent anchoring for paths that were never anchored
  in `commands/file-meeting.md` to begin with."
  implication: "Confirms the correct fix location is `commands/file-meeting.md` (add the
  `${CLAUDE_PLUGIN_ROOT}/` prefix to the bare references/ citations); the mirror generator
  will then automatically apply its existing, already-tested portability hardening on
  regeneration -- no separate manual edit of skills/file-meeting/SKILL.md is needed or
  correct."

## Technical Root Cause

- Site: `commands/file-meeting.md`:47-56 (Setup, 10 citations) and 9 further body
  citations at lines 106, 211, 257, 356, 358, 403, 582, 683, 867, 904; mirrored
  verbatim into `skills/file-meeting/SKILL.md` by `scripts/build-skill-mirrors.cjs`
- Cause: every `references/...` citation in this file is a bare, unanchored relative
  path. Claude Code resolves a bare relative path in command/skill markdown against
  the session's current working directory, not the plugin's install directory. The
  same file already anchors its `bash scripts/...` invocations with
  `${CLAUDE_PLUGIN_ROOT}/` (lines 128, 296, 787, 938, 942) -- the reference-file
  citations were simply never given the same treatment
- Why it surfaces now: it always existed; it surfaces as a live-session failure only
  when cwd != plugin root, i.e. every real end-user Data Room. It was invisible during
  development because the plugin repo's own root happens to also contain a
  `references/` directory, so the bare path coincidentally resolved there

## Required Code Changes

- Change 1:
  - Location: `commands/file-meeting.md`, all 19 `references/...` citation sites
    (Setup lines 47-56 plus body lines 106, 211, 257, 356, 358, 403, 582, 683, 867, 904)
  - Current behavior: cites reference files as bare `` `references/meeting/...` `` /
    `` `references/personality/voice-dna.md` ``
  - Required behavior: anchor every citation as
    `` `${CLAUDE_PLUGIN_ROOT}/references/...` ``, matching the convention already used
    for this file's own `bash scripts/...` calls
  - Short-term patch: same as the full fix -- this is a one-line-pattern, mechanical,
    already-proven change (no separate stopgap needed)
  - Long-term fix: none beyond this -- the `${CLAUDE_PLUGIN_ROOT}` convention is the
    established long-term answer already in use elsewhere in the repo
- Change 2:
  - Location: `skills/file-meeting/SKILL.md` (generated mirror, entire file)
  - Current behavior: byte-mirror of the pre-fix `commands/file-meeting.md`
  - Required behavior: regenerate via `node scripts/build-skill-mirrors.cjs` after
    Change 1 lands -- do not hand-edit this file directly, it will diverge from the
    generator and fail `--check`

## Tests to Add or Update

- Test 1:
  - Type: integration (already exists, re-run as regression evidence, no new test
    file needed for this specific fix)
  - Location: `tests/test-265-file-meeting-gates.cjs`
  - Given: `commands/file-meeting.md` with the `${CLAUDE_PLUGIN_ROOT}`-anchored
    reference citations
  - When: the 4-arm gate suite runs
  - Then: all 4 arms pass (confirmed, see Resolution.verification)
- Test 2 (new, recommended, not yet written):
  - Type: unit
  - Location: `scripts/build-skill-mirrors.test.cjs` (new or extend existing)
  - Given: a command markdown file containing a bare `references/...` citation
    (unanchored)
  - When: a lint/check pass runs over `commands/*.md`
  - Then: the check fails, naming the file and line -- this would have caught the
    original defect and would catch the 44-file blast radius named in Scope and Impact
    without requiring a live end-user session to discover it

## Non-Code Follow-ups

- CHANGELOG.md: add a Fixed entry under the next release ("file-meeting: anchor
  reference-file citations with ${CLAUDE_PLUGIN_ROOT} so Setup loads correctly outside
  the plugin dev repo").
- Release lockstep: this fix has not shipped. Once committed, it needs the 5-place
  lockstep (`scripts/release.sh <version>`) before any installed session can pick it
  up -- a dev-repo commit alone does not make the fix live (standing project rule).
- Canon: none. This fix touches no Canon-declared concept; `canon_parts: []` is correct.
- knowledge-base.md: add the summary block on resolve (after live verification, see
  Current Focus `next_action`).
- Follow-up audit (separate, out of scope for this RCA): sweep the other 43 of 121
  commands sharing the bare `references/...` pattern (Evidence, 2026-08-27T00:12:00Z)
  and apply the same anchor fix repo-wide, ideally backed by Tests to Add, Test 2 above
  so it cannot regress silently again.

## Resolution

root_cause: "`commands/file-meeting.md` (the source of truth mirrored into
skills/file-meeting/SKILL.md) cites its 9 mandatory + 1 optional reference files as bare,
unanchored relative paths (`references/meeting/...`, `references/personality/voice-dna.md`)
instead of the `${CLAUDE_PLUGIN_ROOT}/references/...` form already used correctly elsewhere
in the same file for bash script calls. Bare relative paths resolve against the Claude Code
session's actual working directory. During plugin development/dogfooding, cwd happens to be
this repo's root, where a references/ directory also exists, so the bare path coincidentally
resolves and the bug was never caught. In a real end-user session, cwd is the user's own Data
Room (a different directory), so the same bare path resolves against the Data Room instead of
the plugin's install directory and fails with 'File does not exist' -- exactly the reported
symptom. This is the same disease class already root-caused and fixed for
`bash scripts/<name>` calls in this exact file by the resolved session
intern-w1-rooms-skill-script-path.md; that fix's scope never covered the `Read
references/...` pattern, so this instance of the disease survived unaddressed until now."
fix: "Anchored all 19 bare `references/...` citations in commands/file-meeting.md (10 in
the Setup section, 9 more later in the body) with `${CLAUDE_PLUGIN_ROOT}/`, matching the
already-established convention used elsewhere in the same file for bash script calls.
Applied via a scoped sed (`` `references/ `` -> `` `${CLAUDE_PLUGIN_ROOT}/references/ ``),
diff-reviewed to confirm only the intended 19 lines changed. Then regenerated
skills/file-meeting/SKILL.md via `node scripts/build-skill-mirrors.cjs` (the mirror
generator's Exception Class 3 automatically wrapped every new `${CLAUDE_PLUGIN_ROOT}`
token in the fail-closed `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?msg}}` portability
form for foreign Agent-Skills hosts -- no manual edit of the mirror was made or needed)."
verification: "(1) Confirmed exactly 2 files changed (`commands/file-meeting.md`,
`skills/file-meeting/SKILL.md`) and all other 111 mirrors unchanged (write-mode output:
'overwritten 1... unchanged 111'). (2) `node scripts/build-skill-mirrors.cjs --check`
passes clean (112/112 match expected). (3) Manually resolved every
`${CLAUDE_PLUGIN_ROOT}/references/...` path against the real plugin root and confirmed
all 11 target files exist on disk (was previously failing only because the bare path
resolved against the wrong base directory in a non-dev-repo cwd). (4) Existing regression
suite `tests/test-265-file-meeting-gates.cjs` passes all 4 arms unchanged. (5) Release
gates `build-connector-registry.cjs --check` and `check-render-coverage.cjs` both pass
clean, confirming no collateral damage to the connector/render pipelines that also parse
this file. Not yet independently confirmed against a live end-user session whose cwd is
an actual separate Data Room directory (no such sandbox available here) -- this is the
one blind spot named in the reasoning checkpoint and the subject of the human-verify
checkpoint below."
files_changed:
  - commands/file-meeting.md
  - skills/file-meeting/SKILL.md
