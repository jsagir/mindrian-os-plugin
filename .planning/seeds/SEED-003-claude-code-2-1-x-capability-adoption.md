---
id: SEED-003
status: superseded
planted: 2026-05-05
planted_during: v1.12.5.1 -- Phase 109 (sql-context-memory-navigation-spine), filed via /mos:radar --fetch
trigger_when: v1.13.0 release-planning conversation opens, OR Brain MCP cold-start latency complaint surfaces, OR a tester reports proactive-intelligence not firing on first turn
scope: large
bundle: capability-radar-adoption
implementing_phase: partial -- A1 -> Phase 114 (shipped v1.13.0-beta.2); A3 -> Phase 117-04 sanitizer (shipped v1.13.0-beta.8); A2/A4/A5 carried forward to Phase 138, which itself orphaned (see needs_author_touch); Phase 265 is the actual absorption mechanism
canon_parts: [Part 7, Part 8]
related_phases: [114, 117, 138, 265]
related_seeds: []
companion_artifacts:
  - references/capability-radar/changelog-cache.md (last fetched 2026-05-05; Claude Code 2.1.109 -> 2.1.128)
  - references/capability-radar/capabilities-index.md (carries A1-A5 cross-references)
  - data/capability-ledger.json (Phase 265 -- the living, machine-readable successor to both markdown reference files above; a row here is schema-validated and freshness-checked on two independent paths, never left to a human noticing a table looks old)
needs_author_touch: superseded -- what actually happened: A1 and A3 shipped (Phase 114, Phase 117-04). A2, A4, and A5 carried forward to Phase 138 (capability-radar-absorption-and-routing), which itself orphaned on disk (drift finding W007-138: scaffolded 2026-06-01, never added to ROADMAP.md, caught by the drift detector 2026-08-10, closed by Phase 265 on retirement). A4 (forked subagents) is now SETTLED by the platform at Claude Code 2.1.232 (default fork-mode-on) rather than the open adopt-versus-supersede question Phase 138 framed it as -- nothing left to decide. Phase 265 is the actual absorption mechanism: it retires both this seed and Phase 138 by marking (never deleting), and replaces the two-markdown-file pattern with `data/capability-ledger.json`, a machine-readable ledger a tool can validate instead of a human needing to notice staleness. See docs/RADAR-ABSORPTION-265.md for the full reasoning.
superseded_by: Phase 265 capability-radar-absorption-routing-re-scoped-supersedes-orp
---

# SEED-003: Claude Code 2.1.110-128 Capability Adoption Backlog

## Why This Matters

The capabilities-index.md was 6 weeks stale (last updated 2026-03-22). A `/mos:radar --fetch` on 2026-05-05 surfaced 15 changelog entries spanning Claude Code 2.1.109 through 2.1.128. Three of them change how MindrianOS could work *today*; two more matter at the agent + distribution layer. None are urgent enough to interrupt Phase 109, but all are urgent enough that letting them rot until v1.14.0 would be the same kind of drift that produced the 2026-04-13 Lawrence incident.

Ship them deliberately at the v1.13.0 cut, paired with the Phase 109 navigation API release.

## Adoption Candidates (ranked by leverage)

### A1 — `alwaysLoad: true` for Brain MCP (Claude Code 2.1.121)

**File:** `.mcp.json`

**What:** Add `alwaysLoad: true` to the Brain MCP server config. Brain tools surface from turn 1 instead of waiting for the 10% context-discovery threshold.

**Why it matters:** Today Larry's first response in any session is Brain-blind. Mode A (Full Loop) per Canon Part 3 doesn't actually start until the discovery threshold fires. With `alwaysLoad`, the canon's tier-awareness contract finally matches what users observe.

**Risk:** Slightly higher cold-start cost (Brain server connection during boot). Acceptable trade.

**Test:** New session, first user turn references methodology. Confirm Brain query fires without the discovery handshake.

### A2 — Hooks-as-MCP-Callers refactor (Claude Code 2.1.118)

**Files:** `hooks/hooks.json`, `lib/core/brain-client.cjs` (potential deletion), several hook scripts

**What:** Rewrite hook entries that currently spawn `node lib/core/brain-client.cjs` to use `type: "mcp_tool"` directly.

**Why it matters:** Removes the Node-child-process proxy layer. Eliminates a class of "hook timed out at 2000ms" failures. Collapses brain-client.cjs surface area. Direct moat-deepening per the MWP mandate (less surface, deeper integration).

**Risk:** Larger refactor. Affects every hook that talks to Brain. Schedule for v1.13.0 not v1.12.x.

**Test:** Confirm SessionStart, PostToolUse, OnStop all complete within budget after the swap. Run Phase 89.5 fixture suite to confirm no regression.

### A3 — Part 8 Sanitization Hook via `updatedToolOutput` (Claude Code 2.1.121)

**File:** New PostToolUse hook entry — name candidate `scripts/brain-response-sanitize.cjs`

**What:** Add a PostToolUse hook on Brain MCP tool calls that uses `hookSpecificOutput.updatedToolOutput` to scan + redact accidental user-data echo before the response reaches the model.

**Why it matters:** **This is the structural enforcement of Canon Part 8 the canon has been describing as "PR review."** Today the boundary is procedural — `check-brain-boundary.cjs` is documented as "pending" in CANON-PHASE-MAP.md (Part 8 row). With `updatedToolOutput`, you can enforce the LOCAL→BRAIN→LOCAL roundtrip at runtime, not just at PR-review time. Closes the gap noted in Phase 90 (5 tripwires) by adding a 6th: response-side scan.

**Risk:** Sanitizer false positives could clip legitimate Brain output. Build with allowlist of generic tokens (framework names, phase IDs, enum scalars) and conservative redaction.

**Test:** Construct a Brain query whose response includes a known user-content scalar; confirm the sanitizer redacts before model sees it.

### A4 — Forked Subagents + Per-Agent `mcpServers` (Claude Code 2.1.117)

**Files:** Agent frontmatter for `larry-extended`, `mos-research`, `mos-investor`, `mos-grading`, `mos-persona-analyst`, `mos-opportunity-scanner`, `mos-larry-extended`

**What:** (1) Set `CLAUDE_CODE_FORK_SUBAGENT=1` as a documented opt-in for advanced users. (2) Add `mcpServers:` declarations to agent frontmatter so each agent declares its Brain MCP requirement explicitly.

**Why it matters:** Canon Part 2 Engine 2 (BONO Orchestration) describes spawning hat-instantiated team members in parallel. The substrate just shipped. Per-agent `mcpServers` scoping means individual team-member agents can require Brain without polluting global config — and means agents that *don't* need Brain (e.g., a pure synthesis hat) skip the MCP overhead.

**Risk:** Forked subagents are an external-build feature; document expectations clearly. Don't make it the default until validated.

**Test:** Spawn `mos-research` with `CLAUDE_CODE_FORK_SUBAGENT=1`; confirm Brain query works without global `.mcp.json` registration.

### A5 — `.zip` Distribution as Beta Channel (Claude Code 2.1.128)

**Files:** `release-process.md` update, new `scripts/build-zip.sh`

**What:** Add a "beta-zip" distribution path alongside marketplace tag. `npm run build:zip` produces `mos-v1.13.0-beta.1.zip`; testers install via `claude --plugin-dir mos-v1.13.0-beta.1.zip`.

**Why it matters:** Per release-process.md, infrastructure changes ALWAYS ship as beta first. Today the beta path is `--version 1.13.0-beta.1` against the marketplace, which still requires marketplace.json to advertise the version. Zip channel decouples — you can hand a single tester a zip without touching marketplace state. Reduces blast radius of beta releases.

**Risk:** Two distribution channels means two opportunities for version drift. Mitigate with a `release.sh` mode that produces both atomically.

**Test:** Build the zip; install via `--plugin-dir`; confirm Larry boots, hooks fire, statusline renders.

## Defer / Not Adopting

- **`/ultrareview` built-in (2.1.111)** — already exists in MindrianOS as `/ultrareview` slash command per system reminder. Verify Anthropic's built-in doesn't conflict; if it does, delegate to it and remove duplication.
- **`/usage` replaces `/cost` + `/stats` (2.1.118)** — statusline `📊` glyph format may need to track new schema. Single-line touch, not seed-worthy. File as `.planning/TODO.md` quick-fix line item instead.
- **Custom themes via JSON (2.1.118)** — De Stijl theme could be packaged. Cosmetic; defer until v1.14.0+.
- **`claude project purge` (2.1.126)** — useful for tester recovery but not actionable from inside MindrianOS. Mention in tester onboarding docs.

## Trigger Behavior

When v1.13.0 release-planning starts:
1. Read this seed.
2. Read `references/capability-radar/changelog-cache.md` for full context (refresh with `/mos:radar --fetch` if older than 7 days at that point).
3. Decide which of A1-A5 ships in v1.13.0 vs deferred.
4. For each accepted item, create a `.planning/phases/{N}-{slug}/` directory and proceed via `/gsd:discuss-phase`.

When a Brain cold-start complaint surfaces from a tester:
- Jump straight to A1. It's a one-line config change with high-confidence impact.

When proactive intelligence fails to fire on first turn:
- Investigate A1 first (Brain not loaded yet). If A1 doesn't resolve it, the issue is elsewhere (likely the bash-hook envelope regression tracked in TODO.md IMMEDIATE-NEXT Phase 95).

## Provenance

- Source command: `/mos:radar --fetch` on 2026-05-05
- Cache file: `references/capability-radar/changelog-cache.md`
- Index file (stale until manually updated): `references/capability-radar/capabilities-index.md` (last updated 2026-03-22)
- Conversation: filed during mid-Phase-109 execution pause (after Wave 1 landed but before merge resolution)
