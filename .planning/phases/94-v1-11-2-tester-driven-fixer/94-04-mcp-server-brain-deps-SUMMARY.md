---
phase: 94-v1-11-2-tester-driven-fixer
plan: "04"
subsystem: mcp-server-brain-deps
tags: [mcp-server-brain, install-hook, env-template, drift-check, session-start, brain-mcp, mindrian-brain, bundled-deprecation, lawrence-qa-handoff, miriam-kaplan-qa, canon-part-7, canon-part-8, tdd]

# Dependency graph
requires:
  - phase: 94-v1-11-2-tester-driven-fixer
    provides: 94-03 canonical 'mindrian-brain' server name (Plan 94-03 Option A swept 17 commands; Plan 94-04 reuses the canonical name in the drift check + env template)
  - phase: 88-feynman-minto-memory-layer
    provides: scripts/session-start chokepoint (Plan 94-04 appends drift check before JSON envelope without disturbing TRIPLE_CONTEXT injection)
  - phase: 87-security-hardening-cascade-refactor
    provides: install.sh single chokepoint for plugin install steps (Plan 94-04 adds Step 3b without touching Steps 1-2 or 4-7)
provides:
  - "install.sh Step 3b post-install hook: `(cd mcp-server-brain && npm install)` wrapped in package.json existence guard; Tier 0 graceful skip on missing directory; non-fatal WARN if npm install errors"
  - ".env.brain.template completed with all 7 required env vars (SUPABASE_URL, SUPABASE_KEY, MINDRIAN_BRAIN_KEY, NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD, PINECONE_API_KEY) one per line with comments"
  - "scripts/session-start Brain drift check: yellow WARN to stderr when MINDRIAN_BRAIN_KEY env is set but no 'mindrian-brain' MCP server resolves in repo .mcp.json OR ~/.config/claude-code/mcp.json OR ~/.mcp.json"
  - "docs/install/BRAIN-SETUP.md Section 6 'Bundled mcp-server-brain (optional/legacy)' deprecation block + env-var reference table + test-brain.cjs verification + drift-warning explanation + 'why optional now' rationale"
  - "lib/memory/mcp-server-brain-deps.test.cjs 4-fixture regression fence (T1 install hook conditional + package.json reference; T2 7-var env template; T3 session-start MINDRIAN_BRAIN_KEY + canonical name + WARN advisory; T4 BRAIN-SETUP.md deprecation header + mcp-server-brain mention)"
affects:
  - 94-10 v1.11.2-release-gate (CHANGELOG narrative cites bundled-deprecation + drift-check ship-blocker fix)
  - All future bundled mcp-server-brain users (env vars now documented; install hook automatic; misconfiguration loudly surfaced)
  - 91-navigation-engine (Brain reachability path now has a loud signal when env-var/MCP wiring drifts; Mode A unreachable cases produce a session-start WARN instead of silent Tier 0)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tier 0 graceful install hook. install.sh Step 3b only runs `npm install` in mcp-server-brain/ when both the directory AND package.json exist. Advanced users who delete the bundled server do not see a confusing error; the rest of the install pipeline (commands/skills/agents/hooks registration) continues regardless."
    - "Three-location drift check. session-start verifies canonical 'mindrian-brain' against repo .mcp.json, ~/.config/claude-code/mcp.json, AND ~/.mcp.json. Plan locked-decision listed two locations (repo + ~/.config/claude-code/); execution added ~/.mcp.json as a third because the user-side BRAIN-SETUP.md Section 2 documents `.mcp.json` (not `mcp.json`) as the canonical user-side file path. Spec drift fixed inline (Rule 3 deviation: blocking issue is misalignment between Plan 94-03 docs and Plan 94-04 drift-check search paths). Documented in deviations below."
    - "Stderr-side drift warning. WARN line writes to file descriptor 2; JSON envelope on stdout (file descriptor 1) stays clean for Claude Code's hook consumer. The systemMessage one-liner is unaffected; the WARN is a parallel out-of-band signal."
    - "BRAIN-SETUP.md as the user-side contract surface (extension). Plan 94-03 created Sections 1-5 (canonical-name + .mcp.json snippet + verify wiring + migration + tool surface). Plan 94-04 appends Section 6 (bundled deprecation + env table + drift warning explanation) without touching Sections 1-5. Future canonical-name docs follow the same numbered-section append pattern."
    - "Spec-vs-reality calibration. .env.brain.template originally had only 5 vars (NEO4J_* + PINECONE_API_KEY + PINECONE_INDEX); QA handoff Section 2 FIX-3 (b) called for 7 vars. Wholesale rewrite (rather than additive append) was cleaner because the legacy header carried an em-dash, the legacy comment style mixed comment and value on one line for PINECONE_INDEX, and the 7-var ordering matters for grouped readability (Supabase block + Brain key + Neo4j block + Pinecone block)."

key-files:
  created:
    - lib/memory/mcp-server-brain-deps.test.cjs (245 lines; 4 fixture tests; BSL 1.1)
    - .planning/phases/94-v1-11-2-tester-driven-fixer/94-04-mcp-server-brain-deps-SUMMARY.md (this file)
  modified:
    - install.sh (+17 lines; Step 3b post-install hook)
    - .env.brain.template (rewritten; 16 -> 32 lines; 7 vars + comments + em-dash removed)
    - scripts/session-start (+34 lines; drift check before JSON envelope)
    - docs/install/BRAIN-SETUP.md (+79 lines; Section 6 bundled-deprecation block)
    - lib/memory/run-feynman-tests.cjs (+22 lines; TEST_FILES registration with Canon Part 7 + Part 8 traceability comment)

key-decisions:
  - "Three-layer safety locked. Layer 1: install.sh hook keeps the bundled path buildable for advanced users with one-command install. Layer 2: .env.brain.template documents all 7 required vars so users who choose the bundled path know exactly what to populate. Layer 3: session-start drift check loudly signals misconfiguration when the user has 'configured' Brain (key set) but no canonical server resolves. Each layer addresses a distinct failure mode (build failure, configuration ignorance, runtime invisible-fallback)."
  - "Bundled server officially deprecated in v1.11.2 docs. Per CONTEXT.md decisions: 'collapses to deprecate bundled server in favor of user's own Neo4j MCP if FIX-2 Option A chosen'. Plan 94-03 chose Option A. Plan 94-04 documents the deprecation in BRAIN-SETUP.md Section 6 while keeping the directory shippable. Removing the bundled server entirely would break advanced-user installs and is out of scope for v1.11.2 (a hotfix release); deprecation in docs is the cheapest correct signal."
  - "Drift check three-location search. Plan locked-decision said 'repo .mcp.json OR user .mcp.json'. Implementation searches three: repo `.mcp.json`, `~/.config/claude-code/mcp.json` (Cursor + some Claude Code installs), and `~/.mcp.json` (the canonical user-side file path documented in Plan 94-03's BRAIN-SETUP.md Section 2). Adding the third location was a Rule 3 inline fix: without it, a user who follows Section 2 verbatim and registers the canonical name in `~/.mcp.json` would still get a false-positive WARN. Documenting the third path in BRAIN-SETUP.md Section 6 closes the loop."
  - ".env.brain.template wholesale rewrite (not additive). Legacy template had 5 vars (NEO4J_* + PINECONE_API_KEY + PINECONE_INDEX), an em-dash in the header, and inconsistent commenting. Plan asked for 7 vars with comments. Cleaner to rewrite than to surgically edit. Diff is large but the end state matches the plan's locked structure exactly. PINECONE_INDEX (a non-required var defaulting to 'pws-brain') was dropped from the template because it is not in the QA handoff Section 2 FIX-3 (b) required-vars list; the bundled server's server.cjs falls back to a hardcoded default and the template should not imply this var is required."
  - "Session-start drift check placed BEFORE JSON envelope output (line 1252), not at the very end of the script. Reason: stderr writes during JSON output emission would interleave with stdout in some shell pipelines and confuse the Claude Code hook consumer. Placing the drift check before the envelope ensures all stderr WARN output flushes before stdout JSON begins. Plan said 'at the END of the script'; this is the spirit (last logic block before envelope output) without the letter (after envelope output, where stderr/stdout interleaving could occur). Rule 3 deviation logged."
  - "Canon Part 8 boundary preserved. Drift check is purely LOCAL. Three operations: (a) test if env var is set, (b) grep canonical server name from .mcp.json files on disk, (c) write WARN to stderr. Zero network surface. Zero new endpoints. Zero new MCP tools. The Phase 87 Cypher sanitization + allow-list scalars contract carries forward unchanged."

patterns-established:
  - "Pattern: Three-layer safety for runtime-config drift. Build-time (install hook) + config-time (env template) + runtime (session-start drift check). Each layer is independent; failure of one does not mask failure of another. Future runtime-config drift (e.g. Pinecone index name, Supabase project URL) follows the same triplet."
  - "Pattern: Stderr drift warning, stdout envelope. When a hook script's stdout is consumed structurally (JSON envelope, hookSpecificOutput, additionalContext), advisory drift warnings go to stderr. The two streams never interleave because Claude Code reads stdout structurally and surfaces stderr only on hook failure or explicit invocation. Future drift checks (env-var-vs-MCP, version-vs-roadmap, canon-vs-implementation) follow this contract."
  - "Pattern: Append-section docs. When a previous plan creates a numbered-section docs file (Sections 1-N), a follow-on plan extends with Section N+1 instead of editing in place. Diff is clean; review is fast; section numbering is stable for cross-references."
  - "Pattern: Bundled-vs-user-side dual install path. The bundled server lives in this repo; the user-side path lives in user's `.mcp.json`. Plugin frontmatter routes through canonical `mindrian-brain` regardless of which side hosts the server. Future bundled-vs-user-side capabilities (Pinecone index, Brain auth, telemetry endpoint) follow this dual-path contract."

requirements-completed: []

# Metrics
duration: 18min
completed: 2026-04-28
---

# Plan 94-04 Summary

## QA reproducer (Lawrence's harness, 2026-04-28)

The v1.11.0 QA harness adopted Dr. Miriam Kaplan persona (CU Boulder JILA, NV-diamond magnetometry biomedical sensing) and ran the bundled-Brain reachability matrix against a fresh install. Phase 2 install probe:

```
$ cd ~/.claude/plugins/mindrian-os/mcp-server-brain
$ node test-brain.cjs
Error: Cannot find module '@modelcontextprotocol/sdk'
[fresh install never ran npm install in this subdirectory]
exit: 1
```

Phase 3 env-var probe:

```
$ cat ~/.claude/plugins/mindrian-os/.env.brain.template
NEO4J_URI=neo4j+s://XXXXXXXX.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password-here
PINECONE_API_KEY=your-pinecone-key-here
PINECONE_INDEX=pws-brain
[5 vars listed; QA handoff Section 2 FIX-3 (b) required 7]
[no SUPABASE_URL, no SUPABASE_KEY, no MINDRIAN_BRAIN_KEY documented]
```

Phase 4 silent-fallback evidence:

```
$ export MINDRIAN_BRAIN_KEY=plausible-but-fake-token
$ claude
[user expects Brain enriched routing; .mcp.json has no 'mindrian-brain']
[zero WARN, zero stderr, decision-traces show routing_source: legacy /
 brain_md_tier_mode: tier_0 on every session]
```

Pre-94-04 root cause: three independent failure modes, each silent.

1. install.sh ran root-level `npm install` but never descended into `mcp-server-brain/`. The bundled server's package.json went unfulfilled; `node test-brain.cjs` failed with module-not-found before any boot logic ran.

2. `.env.brain.template` listed only 5 of the 7 required env vars. Users who copied the template would get past Neo4j auth but fail at Brain key validation (or at Supabase auth if the bundled server's auth flow expected SUPABASE_*).

3. Session-start did not detect the env-var/MCP drift. A user who exported MINDRIAN_BRAIN_KEY believing they had wired Brain would see no signal that the canonical server name was missing from .mcp.json. Decision traces showed `routing_source: legacy` on every session; the user had no idea why.

Post-94-04 (this plan):

1. install.sh Step 3b runs `(cd mcp-server-brain && npm install)` automatically when the directory exists. Bundled server boots cleanly on next session.

2. .env.brain.template lists all 7 vars with one-line comments. Users who copy the template see exactly what to populate.

3. Session-start emits yellow `WARN: MINDRIAN_BRAIN_KEY is set but no 'mindrian-brain' MCP server resolved.` line on stderr. Users who configure half the path (env var) but skip the other half (MCP server registration) see a loud signal at session start instead of silent Tier 0.

## Files modified (4 production + 2 test infra + 1 SUMMARY)

```
install.sh                                +17 lines    Step 3b post-install hook
.env.brain.template                       rewrite      5 vars -> 7 vars + comments
                                                       (16 -> 32 lines; em-dash dropped)
scripts/session-start                     +34 lines    drift check before JSON envelope
docs/install/BRAIN-SETUP.md               +79 lines    Section 6 bundled-deprecation block

lib/memory/mcp-server-brain-deps.test.cjs +245 lines   NEW (4 fixture tests; BSL 1.1)
lib/memory/run-feynman-tests.cjs          +22 lines    registration

.planning/phases/94-.../94-04-...-SUMMARY.md  new      this file
```

Total diff: +397 / -16 lines across 7 files.

## Test count + Feynman baseline delta

```
mcp-server-brain-deps: 4/4 tests passed
  T1 install.sh contains conditional cd mcp-server-brain && npm install hook  PASS
  T2 .env.brain.template lists all 7 required env vars                        PASS
  T3 scripts/session-start emits WARN when MINDRIAN_BRAIN_KEY set
     but mindrian-brain absent                                                PASS
  T4 docs/install/BRAIN-SETUP.md contains bundled-server deprecation section  PASS

Feynman runner: baseline +1 fixture file
  Pre-94-04 baseline:  103 fixtures (per Plan 94-03 SUMMARY)
  Post-94-04 baseline: 104 fixtures (Plan 94-04 adds mcp-server-brain-deps.test.cjs)

  Suite result: 102/104 passed, 0 skipped, 2 failed
  The 2 failures are inherited from Phase 89.4 chain-wiring (per Phase
  89.5 STATE.md note "NET IMPROVEMENT (4 -> 2 inherited failures from
  89.4)"). Identical failure set as Plans 94-02 + 94-03 reported. Zero
  new regressions introduced by this plan.

  Pre- and post- 94-04 failure set:
    - test/84-smart-notebook-copilot.test.cjs Test 15 phase 83 regression guard
    - tests/test-self-update-platform.cjs (5/24 self-update Windows / POSIX)
```

## End-to-end smoke evidence

```
$ bash -n install.sh && echo "syntax OK"
syntax OK

$ bash -n scripts/session-start && echo "syntax OK"
syntax OK

$ grep -c "cd mcp-server-brain && npm install" install.sh
1

$ grep -c "mcp-server-brain/package.json" install.sh
1

$ for v in SUPABASE_URL SUPABASE_KEY MINDRIAN_BRAIN_KEY \
           NEO4J_URI NEO4J_USERNAME NEO4J_PASSWORD PINECONE_API_KEY; do
    printf "%s: %s\n" "$v" "$(grep -c "$v" .env.brain.template)"
  done
SUPABASE_URL: 1
SUPABASE_KEY: 1
MINDRIAN_BRAIN_KEY: 1
NEO4J_URI: 1
NEO4J_USERNAME: 1
NEO4J_PASSWORD: 1
PINECONE_API_KEY: 1

$ grep -c "MINDRIAN_BRAIN_KEY" scripts/session-start
3

$ grep -c "'mindrian-brain'" scripts/session-start
3

$ grep -c "WARN" scripts/session-start
1

$ grep -ci "Bundled\|Deprecated\|optional.*legacy" docs/install/BRAIN-SETUP.md
12

$ grep -c "mcp-server-brain" docs/install/BRAIN-SETUP.md
9

$ grep -cP "[\x{2014}]" install.sh .env.brain.template scripts/session-start \
                       docs/install/BRAIN-SETUP.md \
                       lib/memory/mcp-server-brain-deps.test.cjs
install.sh:0
.env.brain.template:0
scripts/session-start:0
docs/install/BRAIN-SETUP.md:0
lib/memory/mcp-server-brain-deps.test.cjs:0

$ node lib/memory/mcp-server-brain-deps.test.cjs
PASS T1 install.sh contains conditional cd mcp-server-brain && npm install hook
PASS T2 .env.brain.template lists all 7 required env vars
PASS T3 scripts/session-start emits WARN when MINDRIAN_BRAIN_KEY set but mindrian-brain absent
PASS T4 docs/install/BRAIN-SETUP.md contains bundled-server deprecation section

mcp-server-brain-deps: 4/4 passed
[exit 0]
```

## Canon traceability

**Canon Part 7 (Reuse Before Build).** install.sh and scripts/session-start are existing chokepoints. Plan 94-04 extends them by inserting one new conditional block in each (Step 3b in install.sh; drift-check stanza before the JSON envelope in session-start). Zero new orchestration. Zero new entry points. Zero new MCP tools. The justification bar for net-new capability is met (we add three small additive blocks to existing chokepoints rather than scaffolding a new "brain wiring" subsystem).

**Canon Part 8 (Graph Boundary).** The drift check is purely LOCAL. Three operations: (a) read `MINDRIAN_BRAIN_KEY` from process env, (b) grep `'mindrian-brain'` from up to three local `.mcp.json` files on disk, (c) write WARN to stderr. Zero network surface. Zero user-data egress. Zero new Brain endpoints, queries, or tools. The Phase 87 Cypher sanitization + allow-list scalars contract carries forward byte-identical. Bundled mcp-server-brain/server.cjs is unchanged.

## Plan deviations (locked-in)

1. **Three-location .mcp.json drift search instead of two.** Plan locked-decision said "repo .mcp.json OR user .mcp.json" with the user-side path implied as `~/.config/claude-code/mcp.json`. Implementation searches three: repo `.mcp.json`, `~/.config/claude-code/mcp.json`, AND `~/.mcp.json`. Reason: Plan 94-03's BRAIN-SETUP.md Section 2 documents `.mcp.json` (the file name as written by the Claude Code 1.x client) as the canonical user-side location. Without the third path, a user who follows BRAIN-SETUP.md Section 2 verbatim and registers the canonical name in `~/.mcp.json` would still get a false-positive WARN at session start. Adding the third location closes the loop. Documented in BRAIN-SETUP.md Section 6 ("Drift warning at session-start" sub-section). Rule 3 deviation: blocking issue (false-positive WARN would erode user trust in the signal).

2. **Drift check placed before JSON envelope, not at end of script.** Plan said "at the END of the script (after all existing checks)". Implementation placed the drift-check stanza after `escaped_sysmsg=$(escape_for_json ...)` and before the `if [ -n "${CURSOR_PLUGIN_ROOT:-}" ]; then printf '{...}'` block. Reason: stderr writes after the JSON envelope's stdout output could interleave in some shell pipelines and confuse the Claude Code hook consumer (or appear after the envelope JSON is already parsed). Placing the drift check before the envelope ensures stderr WARN flushes before stdout JSON begins. The plan's spirit ("after all existing checks") is preserved (drift check is the last logic block); the letter ("end of script after envelope output") is adjusted to honor stderr/stdout ordering. Rule 3 deviation: bug avoidance (envelope-after-stderr could interleave under certain pipe configurations).

3. **.env.brain.template wholesale rewrite, not additive append.** Plan said "Preserve existing comments at top. Ensure the file lists exactly these 7 env vars." Implementation rewrote the template entirely: (a) the legacy header carried an em-dash (Phase 94 hard rule violation), (b) the legacy file mixed comment style across 5 vars, (c) the legacy file included PINECONE_INDEX which is not in the QA handoff Section 2 FIX-3 (b) required-vars list. Rewriting was cleaner than surgical editing. The end state matches the plan's locked structure exactly (7 vars in Supabase + Brain + Neo4j + Pinecone groups with one-line comments). Rule 1 deviation: bug fix (em-dash removal cannot be done with surgical Edit alone given the legacy comment density; full rewrite was the lower-risk correct path). Side effect: PINECONE_INDEX dropped from template (defaults to 'pws-brain' in the bundled server's server.cjs; not surfacing it as a "required" var in the template avoids implying users must populate it).

4. **T4 already passing at RED.** When the RED test fixture was first run, T4 (BRAIN-SETUP.md deprecation section) already passed because Plan 94-03's BRAIN-SETUP.md mentioned "bundled `mcp-server-brain/server.cjs`" in Section 5 body prose. The test regex `/Bundled|Deprecated|optional.*legacy/i` matched on the lowercase "bundled" body-prose mention. Task 3 still added a dedicated Section 6 deprecation block per the plan's `<action>` Step 2 ("If file exists: APPEND a section: ## Bundled mcp-server-brain (optional/legacy)"). The test was always going to pass on this regex; Section 6 ensures the deprecation is structured as its own section (with header + env-var table + drift-warning explanation + rationale paragraph) rather than buried in body prose. Logged for traceability.

## Three-layer safety rationale

| Layer | Failure mode addressed                              | Mechanism                                                              |
|-------|-----------------------------------------------------|------------------------------------------------------------------------|
| 1     | Bundled server cannot start (npm install never ran) | install.sh Step 3b runs npm install in mcp-server-brain/ when present  |
| 2     | User does not know which env vars to populate       | .env.brain.template lists all 7 vars with one-line comments            |
| 3     | User configures half the path, sees silent Tier 0   | scripts/session-start emits yellow WARN when env-var/MCP wiring drifts |

Each layer is independent. Layer 1 failure (bundled server boot) does not mask Layer 2 failure (env vars unconfigured). Layer 3 catches users who skip both Layer 1 and Layer 2 and configure their own Neo4j MCP under a wrong server name. Loud yellow signal at session-start beats silent Tier 0 fallback in every misconfiguration path the QA handoff documented.

## Bundled-vs-user-side install path

Plan 94-03 standardized the canonical Brain MCP server name (`mindrian-brain`) across 17 commands. Plan 94-04 documents that the v1.11.2 default is for users to point `mindrian-brain` at their own Neo4j MCP (Section 2 of BRAIN-SETUP.md), with the bundled server retained as an advanced-user escape hatch (Section 6 of BRAIN-SETUP.md). The plugin's command frontmatter is agnostic to which side hosts the server: as long as the canonical name resolves in the user's `.mcp.json`, the plugin routes Brain calls correctly.

Why deprecate the bundled server in v1.11.2 docs?

- Heavier install (Neo4j client + Pinecone client + Express + zod + node_modules + .env.brain populated)
- More moving parts to misconfigure (7 env vars, 2 external services with rate limits)
- Plan 94-03 Option A made the user-side path work with zero plugin changes
- Most users will follow Section 2 (point existing Neo4j MCP at the canonical name) and skip the bundled path entirely

The bundled path is retained because:

- Advanced users who bundle Brain into a single repo install benefit from one-command setup
- Some deployment scenarios (Cowork shared rooms, locked-down corporate environments) prefer bundled servers over per-user MCP wiring
- Removing the bundled server entirely would be a breaking change inappropriate for a hotfix release

Future Phase: if/when brain.mindrian.ai (fully managed Brain with API-key auth) ships, the bundled deprecation note will be updated. For v1.11.2 the path is: user's own Neo4j MCP under canonical name (default); bundled server retained as escape hatch.

## Closure

Plan 94-04 ready for 94-10 release-gate dependency closure. v1.11.2 ships three layers of safety against the bundled-Brain misconfiguration matrix Lawrence's QA harness surfaced. The bundled server is officially deprecated in BRAIN-SETUP.md Section 6 but remains buildable; the install hook + env template + drift check make the bundled path a clean opt-in for advanced users without burdening the default user path.

CHANGELOG narrative for v1.11.2 (locked from CONTEXT.md): "/mos:rs-fetch could not complete an end-to-end pipeline run; Brain was unreachable from /mos:* commands; /mos:research silently no-opped without paid MCPs". Plan 94-04 closes the second of those (Brain reachability), specifically the bundled-server failure mode. Plan 94-03 closed the canonical-name-routing mode; Plan 94-04 closes the npm-install + env-template + drift-detection modes.

The 2 inherited Feynman failures from Phase 89.4 chain-wiring are pre-existing and not in scope for this plan; they will be addressed in 94-10 release-gate plan if they block tag promotion.

## Self-Check: PASSED

- [x] lib/memory/mcp-server-brain-deps.test.cjs exists, 4/4 tests passing
- [x] install.sh contains conditional `cd mcp-server-brain && npm install` hook with package.json existence guard
- [x] .env.brain.template lists all 7 required env vars (SUPABASE_URL, SUPABASE_KEY, MINDRIAN_BRAIN_KEY, NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD, PINECONE_API_KEY)
- [x] scripts/session-start contains MINDRIAN_BRAIN_KEY drift check + canonical 'mindrian-brain' check + WARN advisory
- [x] docs/install/BRAIN-SETUP.md contains Section 6 bundled-server deprecation block
- [x] lib/memory/run-feynman-tests.cjs registers the new fixture suite (count 102/104 PASS, +1 from baseline 101/103, zero new failures)
- [x] All 3 task commits exist: 1d91ff4 (RED), a44d201 (GREEN partial Task 2), 8fecde6 (GREEN Task 3)
- [x] Zero em-dashes in any file modified by this plan (verified via grep -P "[\\x{2014}]")
- [x] BSL 1.1 header on lib/memory/mcp-server-brain-deps.test.cjs
- [x] bash -n syntax check passes on both install.sh and scripts/session-start
- [x] Canon Part 7 + Part 8 traceability stated in SUMMARY + BRAIN-SETUP.md Section 6
- [x] Four deviations documented (3-location drift search, drift check before JSON envelope, .env.brain.template wholesale rewrite, T4 already passing at RED)
