# Phase 83: Cross-Session Scope + Write Interception + Intent Classifier + Honesty Layer - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning (REVISION 2 - scope expanded after witnessing 8 leak vectors in one session)
**Source:** PRD Express Path (.planning/research/cross-session-memory-and-room-intent.md) plus the witnessed second-session transcript pasted by user 2026-04-14
**Trigger:** Witnessed cross-session leak 2026-04-14 (rashut-hadshanut-ai content pulled into align-x-milken session) AND extended transcript showing the leak pattern repeating across 8 distinct vectors in the same session
**Target release:** v1.10.7
**Slot impact:** Smart-notebook milestone shifts v1.10.6 -> v1.10.7 -> v1.10.8 (sixth shift in this v1.10.x patch line)

## REVISION 2 (2026-04-14 - scope expanded after second transcript)

The original Revision 1 of this CONTEXT scoped Phase 83 to Tier 1 only (read-time scope injection + sealed room surfacing + wrapper fix). The user pasted a second transcript shortly after which showed the cross-session leak repeating across 8 distinct vectors in a single session. Tier 1 alone is necessary but not sufficient. Specifically:

**The 8 witnessed leak vectors:**

1. **Recall leak.** Claude pulled full content from the sealed rashut-hadshanut-ai room into the active align-x-milken session by filesystem search after a topic name match. GUARDRAIL.md was not consulted.
2. **Drafting leak.** Claude generated 19 separate text artifacts (Hebrew + English warm-intro variants) in the active session that are conceptually owned by the rashut room.
3. **Methodology leak.** /feynman-engine ran the 6-stage pipeline on a problem statement derived entirely from the rashut room content, producing Stage 5 sweet spot and Stage 6 teach-back that became artifacts in the wrong session context.
4. **Filing leak (filesystem write).** Claude wrote MindrianRooms/align-x-milken/mindrianos-feynman-onepager.html to disk - a 308-line HTML artifact derived from rashut content, physically saved into the wrong room directory.
5. **Recovery-pivot leak.** When the user said "adam adam is not milken !!!!" Claude pivoted the case study CONTENT to Synteris but kept the file at the same align-x-milken path. The pivot was content-only, not location-aware.
6. **Hebrew version leak.** The Hebrew translation was saved to a third room (MindrianRooms/mindrianOS/) - so the same artifact lineage now exists across 3 rooms (rashut-conceptual, align-x-milken-physical-en, mindrianOS-physical-he). None are the right home.
7. **Topic recognition wins repeatedly.** Each turn that mentioned a phrase from the rashut deck pulled rashut context into the response. Topic recognition wins over scope at every message, not just at session start. Mid-session drift is the dominant failure mode.
8. **Honesty layer collapse.** Larry said "I don't have that in working memory right now" then immediately produced 21 entries of detail from a sealed room via filesystem search. Calling retrieval "memory" sets the user up to trust it as if it were stored state. The user explicitly named this in the transcript.

**Implication:** Tier 1 (session-start scope injection) is necessary but addresses only vector 7 partially and does nothing for vectors 1-6 or vector 8. Phase 83 must expand to cover all 8 vectors in v1.10.7. Real persistent cross-session memory (Tier 3) still defers to v1.10.8 smart-notebook because it requires the SQLite memory layer wiring which is its own architectural lift. But Tier 1.5 (filesystem write interception), Tier 2 (mid-session intent classifier), and the honesty layer (no fake recall) all ship in v1.10.7.

**Scope change:** plan decomposition expands from 5 plans to 8 plans. Sequential, all parallel_safe: false. Total estimated work ~6 hours, still same-day shippable.

**What stays in v1.10.8 smart-notebook:**
- Real persistent cross-session memory layer (Phase 78 SQLite wiring)
- Voice-log per room
- Synthesis voice room-scoping
- Tier 4 architectural changes (per-session room scope, hard-refuse semantics via filesystem wrapper interception)

<domain>
## Phase Boundary

This phase delivers Tier 1 of the four-tier fix model proposed in `.planning/research/cross-session-memory-and-room-intent.md`. Tier 1 is **read-time scope injection** plus the parked statusline wrapper fix. Together they close the active-session bug class without waiting on real persistent memory (which is Tier 3, deferred to v1.10.8 smart-notebook).

The witnessed failure that triggered this phase: Jonathan opened a fresh Claude Code session in `~/home/jsagi`. The MindrianOS statusline correctly showed the active room as `align-x-milken ▶ team`. Jonathan asked about "rashut hadadahnut" (the Israel Innovation Authority sealed room at `~/MindrianRooms/rashut-hadshanut-ai`). Claude pulled the rashut content via filesystem search, drafted three Hebrew warm-intro lines for an upcoming meeting, and only got caught when Jonathan looked at the statusline and noticed the conversation belonged in a different room than the active scope. The drafted Hebrew artifact belongs to the sealed rashut room and would have been filed in align-x-milken if Jonathan had not caught it. The seal evaporated because GUARDRAIL.md is unenforced documentation and the system prompt has no scope clause for Claude to check against.

Phase 83 closes the read-time bug at three layers: (1) inject ACTIVE ROOM CONTEXT into the system prompt so Claude knows which room is scoped on every session start, (2) walk `~/MindrianRooms/` for any subdirectory containing a GUARDRAIL.md and surface them as sealed rooms with hard rules quoted in the prompt, (3) bundle the parked statusline wrapper fix so settings.json statusLine self-heals to the latest cache version on every session start.

What this phase does NOT deliver:
- Real persistent cross-session memory (Tier 3; deferred to v1.10.8 smart-notebook with memory promoted to load-bearing)
- Mid-session intent classifier hook that watches user messages for room-name mentions (Tier 2; deferred)
- Hard refuse semantics on sealed-room read operations via filesystem wrapper interception (Tier 4; deferred to v2.0)
- Per-session room scope (cwd-bound or PID-bound, replacing the global singleton); requires architectural rework, deferred to v2.0
- Phase 78 SQLite memory layer wiring (lib/core/memory-ops.cjs is on disk but unwired; wiring it is a smart-notebook v1.10.8 task, not Phase 83)
- Re-cut of the smart-notebook research to memory-first ordering (separate task, lands when smart-notebook gets its plan-phase)

</domain>

<decisions>
## Implementation Decisions

### Active room context injection

- **session-start reads .rooms/registry.json active field** as the source of truth for the active room. Reads from `~/MindrianRooms/.rooms/registry.json` (the global singleton location confirmed by research).
- **Active room block injected into Claude's session-start context** as a system-prompt section the existing context-loading mechanism already supports. Locked block format:
  ```
  ## ACTIVE ROOM CONTEXT
  
  You are scoped to the room: <active-room-name>
  Path: <active-room-path>
  Section focus: <currentSection from statusline tracking, or "no current section">
  
  ## CROSS-ROOM POLICY
  
  When the user mentions a room name or topic that maps to a different
  room than the active one, you must:
  1. Acknowledge the mismatch out loud and name both rooms
  2. Ask whether to switch the active room or continue in the current scope
  3. Refuse to draft artifacts that belong to a different room without
     explicit user confirmation of intent
  4. Never file content derived from another room into the active room
  ```
- **No active room resolved (no registry, empty active field)** is graceful: the block is omitted entirely, no error, no warning, session-start continues with the current behavior.
- **The block lives in session-start hook output**, not in plugin.json or settings.json. session-start is where the existing context loading lives (per the v1.9.4 conversation-mode skill and the Mode 1/2/3 instructions block). Adding the scope block to session-start keeps it co-located with the rest of the dynamic context.

### Sealed room detection and surfacing

- **session-start walks ~/MindrianRooms/** at top level, looks for any subdirectory containing a GUARDRAIL.md file. Sealed rooms include rooms NOT registered in .rooms/registry.json (the rashut-hadshanut-ai pattern where the room exists on disk but is not in the registry, which is what made it accidentally hidden from registry-driven scanners but not from filesystem search).
- **For each sealed room**, read the first 3 lines of GUARDRAIL.md (after any frontmatter or markdown title), trim, and append to the system-prompt block:
  ```
  ## SEALED ROOMS (DO NOT LEAK CONTENT INTO THIS SESSION)
  
  The following rooms exist on this machine and are sealed by GUARDRAIL.md.
  You must NOT pull content from them, draft artifacts about them, or
  reference them in this session unless the user explicitly switches to
  one of them via /mos:rooms switch <name>.
  
  - <room-name> (path: <relative-path>)
    Hard rules: <first 3 lines of GUARDRAIL.md, joined by " | ">
  ```
- **Limit: at most 10 sealed rooms** surfaced. If more than 10 exist, list the first 10 alphabetically and append "... and N more sealed rooms (run /mos:rooms list-sealed for the full set)". The 10-room cap is to bound the prompt size growth at scale.
- **Sealed room walk runs asynchronously when possible** to keep session-start under the 2-second budget. If the walk takes longer than 500ms, fall back to "no sealed rooms surfaced this session" with a debug log line. Correctness over speed is acceptable for v1.10.7 since most beta users have under 5 rooms.
- **GUARDRAIL.md content is treated as untrusted user data** for prompt-injection safety. Strip any markdown frontmatter and code fences before quoting. Do not eval or interpret.

### Wrapper fix bundle

- **scripts/statusline-mos becomes part of the plugin** (currently lives at ~/.claude/statusline-mos on Jonathan's machine only). The wrapper logic is the version captured during the 2026-04-14 manual fix: walk `~/.claude/plugins/cache/mindrian-marketplace/mos/`, sort versions via `sort -V`, exec the highest version's scripts/context-monitor with MINDRIAN_OS_ROOT set to match.
- **session-start auto-configure block at lines 446-468 is patched** to install scripts/statusline-mos to ~/.claude/statusline-mos on every session start (cp from PLUGIN_ROOT, chmod +x), then write the wrapper path into settings.json statusLine instead of the hardcoded ${PLUGIN_ROOT}/scripts/context-monitor path.
- **Self-healing for both new and legacy-install users**: every session start refreshes the wrapper from the active cache version (so wrapper bug fixes propagate) AND writes the wrapper path into settings.json (which is stable across versions). Users with hardcoded legacy paths in settings.json get auto-migrated on their first v1.10.7 session.
- **Backwards compatibility**: if settings.json statusLine already points at a wrapper path or at a non-context-monitor command, the auto-configure does NOT clobber it. The migration only fires when the existing statusLine command contains "context-monitor" but does not point at the wrapper. Users who have already manually fixed their settings (like Jonathan) are not re-migrated.

### Backwards compatibility

- **Existing rooms with no GUARDRAIL.md are untouched.** The sealed room walk only surfaces rooms that explicitly opt in via the file. Existing beta cohort rooms (align-x-milken, MindrianOS Data Room, etc.) do not get sealed-room treatment unless their owners add a GUARDRAIL.md.
- **Sessions that cannot resolve an active room** (no .rooms/registry.json or empty active field, e.g., a fresh terminal in /tmp) skip the scope injection block entirely. session-start continues unchanged. No error, no warning.
- **Existing settings.json statusLine paths that already point at a wrapper or correct cache path are NOT clobbered.** The migration is detection-driven, not unconditional rewrite.
- **The Phase 78 SQLite memory layer is NOT touched.** It remains on disk and unwired. Wiring it is v1.10.8 smart-notebook scope.

### Test strategy

- **Scope injection test:** synthetic fixture rooms registry, run session-start in a controlled environment, capture stdout/context output, assert the ACTIVE ROOM CONTEXT block is present with the expected room name and path.
- **No-active-room test:** registry with empty active field, assert session-start emits no scope block and exits cleanly.
- **Sealed room walker test:** synthetic fixture under /tmp with three rooms, two of which contain GUARDRAIL.md, one does not. Assert the sealed room block lists exactly two rooms with their first-3-lines hard rules quoted.
- **Sealed room cap test:** 15 sealed fixture rooms, assert the block lists 10 with the "... and N more" suffix.
- **Wrapper resolution test:** synthetic cache directory with three versions (1.9.0, 1.10.0, 1.10.7), assert the wrapper resolves to 1.10.7 via sort -V.
- **Wrapper migration test:** synthetic settings.json with the legacy hardcoded path, run session-start auto-configure, assert settings.json statusLine now points at the wrapper. Run twice, assert idempotent (no double-migration).
- **Wrapper non-clobber test:** synthetic settings.json with statusLine already pointing at the wrapper, run session-start, assert no change.
- **GUARDRAIL.md prompt injection test:** synthetic GUARDRAIL.md with code fences, frontmatter, and adversarial content, assert the surfaced hard rules are stripped of fences and frontmatter and treated as quoted text only.

Tests use node built-in assert. Register with whichever central runner is the right home (likely `lib/memory/run-feynman-tests.cjs` per the Phase 82 pattern, OR a new `scripts/run-session-tests.cjs` if session-start tests deserve their own runner).

### Release as v1.10.7

- **Direct to stable, NOT beta.** Bug fix for an active failure mode, not release infrastructure.
- **5-gate release** per .claude/includes/release-process.md: CHANGELOG [1.10.7] + plugin.json 1.10.7 + package.json 1.10.7 + git tag v1.10.7 + marketplace.json source.ref pinned to v1.10.7.
- **Smart-notebook milestone shifts v1.10.6 -> v1.10.7 -> v1.10.8.** Sixth shift in this v1.10.x patch line. Update PROJECT.md, TODO.md, ROADMAP.md to reflect.
- **CHANGELOG entry must credit Jonathan** for catching the witnessed failure on 2026-04-14, name the bug class (cross-session leak via topic recognition without scope clause), explain Tier 1 vs Tiers 2-4, and note the connection to v1.10.8 smart-notebook memory promotion.

### Claude's Discretion

- **Exact path resolution for ~/MindrianRooms/.** The research implied this is the canonical multi-room location but did not lock it. The phase implementation should check `MINDRIAN_ROOMS_ROOT` env var first, fall back to `~/MindrianRooms/`, fall back to scanning the home directory for any folder named `MindrianRooms`. Document the resolution chain in code comments.
- **Where to store the scope-injection log line.** Whether to log to stderr, to ~/.mindrian/bridge/scope-injection.log, or to skip logging entirely. Recommend stderr at debug level only (so it does not clutter the user-facing session-start output).
- **GUARDRAIL.md "first 3 lines" definition.** Lines after stripping frontmatter and the first markdown h1 title. If the first content line is a list item or code fence, descend until 3 prose lines are found, capped at the first 30 lines of the file.
- **Sealed room block ordering.** Alphabetical by room name for deterministic output. Tests can assert order.
- **Async sealed room walker fallback.** If the walker exceeds 500ms, return what was found so far rather than the empty fallback. Document the partial-fallback behavior in tests.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bug location and witness
- `.planning/research/cross-session-memory-and-room-intent.md` - 606 lines, the authority research with the four critical findings, four-tier fix model, Path A recommendation
- The witnessed failure transcript is in the Phase 83 trigger block above (verbatim from the 2026-04-14 conversation)

### Files to modify
- `scripts/session-start` lines around 442 (after the conversation-mode block) for the scope injection insertion point. Lines 446-468 for the auto-configure block patch (wrapper migration).
- `scripts/statusline-mos` (NEW) - the wrapper script becomes part of the plugin. Mirror the version Jonathan installed at ~/.claude/statusline-mos on 2026-04-14.
- `scripts/generate-presentation.cjs` is NOT modified by Phase 83 (Phase 82 already shipped the wiki fix; this phase only touches session-start and adds a new wrapper script)
- `lib/vault/room-scanner.cjs` is NOT modified by Phase 83 (read-only consumer; the SYSTEM_FILES alignment from Phase 82 is preserved)

### Files to read (mandatory before writing plans)
- `scripts/session-start` in full, especially:
  - Lines 1-50 for the PLUGIN_ROOT and CLAUDE_PLUGIN_ROOT resolution
  - Lines 442 for where conversation-mode block ends and where new context can be inserted
  - Lines 446-468 for the auto-configure block to be patched
- `~/MindrianRooms/.rooms/registry.json` for the schema (if it exists; if not, document fallback behavior)
- `~/MindrianRooms/rashut-hadshanut-ai/GUARDRAIL.md` for the canonical sealed-room file format
- `~/.claude/statusline-mos` (the in-place wrapper Jonathan installed on 2026-04-14) for the canonical wrapper script content
- `~/.claude/settings.json` to understand the current statusLine command shape
- `lib/core/rooms-registry.cjs` (if it exists) for the registry read API

### Authority and rules
- `.planning/phases/83-cross-session-scope-injection/83-CONTEXT.md` (this file)
- `CLAUDE.md` Decisions 1, 8, 15, 16
- `.claude/includes/release-process.md` 5-gate version consistency rule
- The repo-wide no-em-dash hard rule
- `.planning/research/smart-notebook-cofounder.md` Section 6.5 (held contradictions) and 6.7 (voice-log) for the connection to v1.10.8 memory promotion
- `.planning/research/smart-notebook-cofounder-appendix.md` Appendix E (MINTO + Feynman + memory wiring) for the smart-notebook memory architecture this phase enables

### Test fixtures
- Use `/tmp/83-cross-session-test-fixtures/` for all synthetic fixtures. Clean up after each test. Do NOT commit synthetic fixtures to the repo.
- Existing `test-fixtures/feynman/sections/fixture-{small,medium,large}/` fixtures are NOT used by Phase 83 (they are for the wiki generator).

</canonical_refs>

<specifics>
## Specific Ideas

### REVISION 2 expanded plan decomposition (8 plans)

The 5-plan decomposition below is from Revision 1 (Tier 1 only). Revision 2 expands to 8 plans to cover all 8 leak vectors witnessed in the second transcript. Plans 83-01 through 83-05 stay roughly as they were (with minor adjustments). New plans 83-06, 83-07, 83-08 are added.

- **83-06 Filesystem write interception (Tier 1.5).** Wrap the Write tool path in a room-scope check. When the active room is X but the file path target is `~/MindrianRooms/Y/...`, the system either refuses, prompts, or auto-redirects per locked policy. This closes leak vectors 4, 5, and 6 (filing leak, recovery-pivot leak, Hebrew version leak). Implementation: a hook script that runs on PreToolUse for Write/Edit/MultiEdit tools, reads the active room from `.rooms/registry.json`, parses the file path argument, compares the destination room (parsed from `~/MindrianRooms/<room>/...` segment) against the active room, and either blocks (default) or warns. ~60 minutes.

- **83-07 Mid-session intent classifier hook (Tier 2).** A new hook fires on UserPromptSubmit (or equivalent mid-session entry point). Reads the user message, scans for room-name mentions and topic-fingerprint matches against all rooms in the registry plus all sealed rooms in `~/MindrianRooms/`. If the strongest match is NOT the active room, surfaces a soft warning to Claude that gets injected into the next assistant turn context: "User just mentioned <other room name>. Active room is <active>. Acknowledge mismatch and confirm intent before proceeding." Closes leak vectors 1, 2, 3, and 7. ~75 minutes.

- **83-08 Honesty layer in larry-personality skill.** Update `skills/larry-personality/SKILL.md` to add an explicit no-fake-recall rule. When Claude is asked "do you remember X" and the X content is not in current session context, the correct response language is "let me search for that" or "I do not have that loaded - looking now" - NOT "I do not have that in working memory" followed by retrieval. The phrase "working memory" implies stored state that does not exist; using it after a successful filesystem search makes the prior denial a lie. Add a rule, add 3 examples of correct vs incorrect language, add a test that asserts Claude follows the rule on a fixture conversation. Closes leak vector 8. ~30 minutes.

### Phase plan decomposition (Revision 1, 5 plans - SUPERSEDED by the 8-plan Revision 2 expansion above)

The research recommends 5 plans matching the Phase 82 cadence. Each plan is small and atomic:

- **83-01 Wrapper script ships as plugin file + auto-configure migration.** Add `scripts/statusline-mos` to the plugin. Patch `scripts/session-start` lines 446-468 to install the wrapper to `~/.claude/statusline-mos` on every session start (cp + chmod +x) and write the wrapper path into settings.json statusLine instead of the hardcoded $PLUGIN_ROOT/scripts/context-monitor path. Detection-driven migration (only fires when current statusLine command contains "context-monitor" but does not point at the wrapper). Idempotent. Phase budget: ~45 minutes.

- **83-02 Active room scope injection block.** Add a new function or section to `scripts/session-start` that reads `~/MindrianRooms/.rooms/registry.json` `active` field, resolves the active room path and STATE.md project name, and injects the ACTIVE ROOM CONTEXT block (with Cross-Room Policy clause) into the conversation context output. Graceful no-active-room fallback. Phase budget: ~30 minutes.

- **83-03 Sealed room walker + GUARDRAIL.md surfacing.** Walk `~/MindrianRooms/` (with env var override and home-directory fallback per Claude's Discretion). For each subdirectory containing a GUARDRAIL.md, parse the file (strip frontmatter and h1, extract first 3 prose lines), append the sealed room block to the scope injection. Cap at 10 sealed rooms with "and N more" suffix. Async with 500ms partial-fallback. Treat GUARDRAIL.md content as untrusted user data for prompt-injection safety. Phase budget: ~45 minutes.

- **83-04 Fixture-based tests.** Tests for: scope injection block present, no-active-room fallback, sealed room walker with three fixture rooms (two sealed, one not), sealed room cap with 15 fixtures, wrapper resolution via sort -V, wrapper migration idempotency, wrapper non-clobber, GUARDRAIL.md prompt injection safety (code fences and frontmatter stripped). Use node built-in assert. Register with central runner. Phase budget: ~75 minutes.

- **83-05 CHANGELOG + version bump + 5-gate release + smart-notebook slot shift.** CHANGELOG [1.10.7] entry crediting Jonathan for the witnessed failure on 2026-04-14, explaining the bug class, naming Tier 1 vs Tiers 2-4, noting the v1.10.8 smart-notebook memory promotion. Version bumps. ROADMAP/TODO/PROJECT.md slot shifts (smart-notebook v1.10.6 -> v1.10.7 -> v1.10.8, sixth shift). 5-gate release pipeline. Marketplace pin. Phase budget: ~45 minutes.

**Total: 4 hours** matching the Phase 82 same-day cadence.

### Hard constraints

- **CJS only**, no ESM, no TypeScript, no new runtime dependencies. The repo is pure CommonJS Node.js. Bash hooks are bash, not zsh, not fish.
- **No em-dashes anywhere.** Use hyphens. Hard repo rule. Grep before commit.
- **Tests use node built-in assert.** No jest, vitest, mocha, or other test framework dependencies.
- **scripts/vault-section-minto-generator.cjs is not modified.** Phase 81 deliverable, untouchable.
- **lib/memory/aaak-compress.cjs is not modified.** Phase 81 deliverable, untouchable.
- **Pre-81 deterministic generator is not modified.** Phase 81 byte-equivalent guarantee preserved.
- **scripts/generate-presentation.cjs is not modified beyond Phase 82's changes.** The wiki fix shipped, leave it alone.
- **lib/core/memory-ops.cjs is not wired in by Phase 83.** Wiring is v1.10.8 smart-notebook scope.
- **GUARDRAIL.md content is untrusted user data.** Strip frontmatter, strip code fences, never eval, never interpret. Treat as quoted text only.
- **No emoji in any session-start output, code, comments, CHANGELOG, or test files.** The statusline emoji carve-out from v1.10.4 does not apply here.
- **5-gate release pipeline mandatory.** Skipping any gate violates the release process.
- **Backwards compatibility for users without rooms.** A fresh user with no rooms must see no errors and no warnings on session start.

### Tri-polar surface check

- **CLI:** session-start runs as a Bash hook, scope injection block goes into the context that Claude reads at session start. Wrapper resolves the latest cache version. All native CLI primitives.
- **Desktop:** Larry runs in a Claude Desktop session that loads the same plugin via marketplace. Session-start hook fires the same way. Scope injection block appears in Larry's context. Sealed room awareness applies.
- **Cowork:** Cowork sessions load the plugin via the same marketplace path. Scope injection applies. Sealed room awareness applies. The active room is still a global singleton on the Cowork host - this means concurrent Cowork users on the same host would share the active room scope, which is a known limitation of the current global-singleton design and is documented as a v2.0 fix (Tier 4 architectural change).

</specifics>

<deferred>
## Deferred Ideas

### Deferred to v1.10.8 smart-notebook (memory-promoted re-cut)

- **Real persistent cross-session memory (Tier 3).** Wire `lib/core/memory-ops.cjs` (Phase 78 SQLite layer that exists on disk but is unwired) into session-start, on-stop, and at least one filing path. Room-scoped tables. Voice-log under `.mos/voice-log/<room>/`. This is the load-bearing memory promotion the research recommends for v1.10.8.
- **Smart-notebook synthesis voice room-scoping.** When the synthesis voice ships in v1.10.8 or later, it must read room-scoped MINTOs only and refuse to answer questions about other rooms. Without this, the synthesis voice ships incoherent across rooms.
- **Smart-notebook scope re-cut to memory-first ordering.** The current smart-notebook research has the Mullins 7-domain scaffold as the primary deliverable. The cross-session memory research recommends inverting: memory layer first, scaffold expansion second. This re-cut happens during v1.10.8 plan-phase, not in Phase 83.

### Deferred to a future v1.10.x or v1.11.x

- **Mid-session intent classifier (Tier 2).** A hook that fires on every user message, runs a keyword pass against all rooms in the registry, fires a soft warning to Claude when a user message contains tokens from another room more strongly than from the current room. This is the mid-session drift detection layer. v1.10.7 covers session-start only; mid-session is its own phase.
- **Hard refuse semantics on sealed-room file reads (Tier 4).** A wrapper layer that intercepts read operations and refuses unless cwd matches the sealed room path. Requires architectural rework of the file-read pipeline. v2.0 work.
- **Per-session room scope.** Replace the global mutable singleton in `~/MindrianRooms/.rooms/registry.json` with a per-session scope (cwd-bound, PID-bound, or env-var-bound). Allows two terminals to be in two different rooms simultaneously. v2.0 architectural change.
- **/mos:rooms list-sealed command.** Lists every sealed room on the machine with their GUARDRAIL.md content. Implied by the "and N more sealed rooms" suffix in the scope injection block but not built in v1.10.7.
- **Active room context block on session resume (after compact).** Re-inject the scope block after PreCompact/PostCompact hooks fire so Claude does not lose room awareness across compaction boundaries. v1.10.7 covers session-start only; resume is a follow-up.

### Deferred indefinitely

- **Cross-room memory sharing.** A user with multiple rooms might want the voice to know things across rooms. Cross-room voice is orthogonal to cross-venture Brain learning. Defer until the per-session room scope and the synthesis voice both ship and the per-user-scoped layer above per-room scaffolds is designed.
- **Brain MCP integration with sealed rooms.** A sealed room must never be enriched by the Brain (per GUARDRAIL.md). The Brain MCP currently has no awareness of sealed rooms. Adding it requires the Brain MCP to read GUARDRAIL.md or the registry and refuse enrichment. Defer until the Brain MCP gets a sealed-room contract.
- **Replacing the global singleton registry with a per-session lockfile.** Makes the active room a per-process state, allows true room isolation across terminals. Architectural change, v2.0+.

</deferred>

---

*Phase: 83-cross-session-scope-injection*
*Context gathered: 2026-04-14 via PRD Express Path*
*PRD source: .planning/research/cross-session-memory-and-room-intent.md*
*Trigger: Witnessed cross-session leak 2026-04-14 (rashut-hadshanut-ai content into align-x-milken session)*
