# Milestones

## v1.15.0 "The Cockpit" (Shipped, rolled forward into v1.16.0: 2026-07-28)

**No formal `/gsd-complete-milestone` audit ran** -- same precedent as v1.14.0 "Larry Thinks"
(see this repo's own CLAUDE.md: "shipped in place with no formal archive step... rolled forward
directly into v1.15.0... treat as superseded, not a separately closed milestone"). Neither
v1.14.0 nor v1.15.0 ever had a dedicated REQUIREMENTS.md refresh -- `.planning/REQUIREMENTS.md`
was last cleanly scoped at v1.13.1's close-out (commit `9428f5c7`) and rolled forward informally
across both subsequent milestones before being replaced with v1.16.0's own fresh requirements.
This entry documents v1.15.0 honestly rather than fabricating a REQUIREMENTS.md archive or a
MILESTONE-AUDIT.md that never cleanly existed.

**Phases completed:** 234 phases (the last phase directory; numbering is cumulative from
project start, not per-milestone), latest released tag v1.15.3-beta.50.

**One known open item, deliberately not fabricated as closed:** Phase 234's final plan
(234-08) Task 2 is a blocking human-verify checkpoint -- installing and observing MindrianOS
on a real foreign host (VS Code, Cursor, Goose, or Zed) -- that requires the navigator's own
hands and has not yet run. Task 1 is green (`tests/run-all-234.sh` 11/11); Task 3 is gated
behind Task 2. Full detail: `.planning/phases/234-mindrianos-as-infrastructure-skills-mcp-everywhere-open-core/234-08-PLAN.md`.
Carries forward as an early v1.16.0 item, not silently dropped.

**Key accomplishments (this session's own work, 2026-07-28):**

- Critical Pathway (score -> consult -> reuse-check -> promote -> execute) formalized for the
  seed backlog, catching two near-misses live the same week it was written.
- `rooms-open` false-success bug found, root-caused, and fixed (no real writer ever called
  `room-registry set-active`; success was structurally impossible without the switch landing).
- Five distinct check-card-fire.cjs-family defects found and fixed in one session: notification-
  only-turn force-fire, answered-gate TTL-refire (a lifecycle the record never had), the MCP-
  first path's structurally-unreachable retry ceiling (plus a dead-code sibling that silently
  broke the TTL fix's own consumption wire on that path), cross-session room-resolution bleed
  (two compounding defects: an unwired consumer, a broken sub-room path), and the unbound-
  session ownership gap closing the same cluster via a PID-liveness design.
- SEED-068 + SEED-069 consolidated and promoted to Phase 234 ("infrastructure, not an
  application" + "open core at the network boundary"), langtalks-graph-expert-consulted per
  the mandatory rule; research found the phase ~far closer to done than either seed assumed
  (33 live MCP tools already, persona already a skill, the entitlement mechanism already built).
- Two seed id collisions found and resolved (SEED-054 x2, SEED-020/031 stale duplicate).

---

## v1.13.1 "Larry Reaches" (Shipped STABLE: 2026-06-17)

**Phases completed:** 24 phases executed across the 140-160 band (plus the connector-spine .x phases); 1740 commits since v1.13.0-beta.1. Audit: tech_debt accepted (deferred items -> v1.14.0). npm @latest 1.13.1, tag v1.13.1.

**Key accomplishments:**

- LARRYREACH loop-fires: insight sensors (143) + navigation-engine flip (144, routing_source legacy->engine) + the self-extending connector spine + retrofit sweep (144.1) + the fully-wired acceptance gate (146, `tests/run-all-146.sh` 8/8 green).
- Local retrieval spine + capability dial (141) and local-intelligence wiring compute-store-act (142): `getRoomContext` 3-leg fusion + FILEVAL evidence filing with read-back.
- LarryReach selector re-wire (148): `hats` minted as the 6th frozen reach; dial-reach orchestrator + reach-component map; suggest surfaces unified on the F.1 host.
- Memory cortex + GSD planning artifacts as local-graph members (149/150); meeting micro-knowledge DIKW filing (150.8) adding REFINES/ROOT_CAUSES/INSTANTIATES to the frozen edge vocabulary.
- Brain orchestration projection + `methodology_tier` boundary-keeper (157); temporal-awareness spine (160); Futures Wheel MVP `/mos:futures` (156); graph-spine single-authority viz W1-W3 / SEED-026 shipped on the beta train (162).
- Canon Part 10 "Conversation as Product" RATIFIED (canon v1.8 -> v1.9, navigator-authority override; empirical confirmation deferred to a v1.14.0 tester validation week).

---

## v1.11.0 Memory Triple + Navigation Engine (Shipped: 2026-05-01)

**Phases completed:** 34 phases, 172 plans, 196 tasks

**Key accomplishments:**

- CLI:
- Rewrote lazygraph-ops.cjs from KuzuDB/Cypher to better-sqlite3/SQL with identical 21-export API, WAL mode, and 52 passing tests
- Updated graph-ops.cjs/write-lock.cjs for SQLite backend and verified WAL concurrent reads with multi-process fork test
- Session tracking, conversation fragments, and assumption validity lifecycle with evidence linking on room.db
- /mos:vault
- 1. [Rule 3 - Blocker] No scripts/file-meeting.sh exists
- Rewrote 4 graph-building scripts from KuzuDB/Cypher to SQLite/SQL, eliminating all kuzu dependencies from the scripts layer
- 1. [Rule 2 - Missing] SQL injection prevention in graph-links.cjs
- Eliminated all kuzu/.lazygraph references across 13 files -- CLI says SQL, SKIP_DIRS say .mindrian, command docs reference SQLite
- 1. [Rule 3 - Blocking] Extensive kuzu references in 28 files beyond plan scope
- MANIFEST schema module, deterministic vault scanner, classifications-sync round-trip helper, Layer 3 import-config reference, 4 stage-contract CONTEXT.md templates, 3 fixture vaults with deterministic person and collision seeds, and a zero-dep child-process test runner (15/15 tests green)
- 1. [Rule 1 - Bug] MWP edge names corrected
- 1. [Rule 3 - Blocking] Person-detector narrow-window role-bucket miss
- lib/import/branding.cjs
- One-liner:
- One-liner:
- One-liner:
- [Rule 2 - Missing critical test hook]
- None (Rule 0).
- Found during:
- Finding:
- 1. [Rule 3 - Blocking] Added STATE.md to seed-room
- Closed the confirmed Cypher injection vector (8 interpolation sites now pass through sanitizeCypherInput with a whitelist of [a-zA-Z0-9 ._-]), the confirmed API key file permission gap (checkFilePermissions refuses group/world-readable .env files), and the confirmed HSI premature-abort (12 timeout:5000 sites bumped to timeout:HSI_TIMEOUT_MS = 30000) in one atomic plan.
- Installable pre-commit hook that enforces CLAUDE.md decision #15 at git commit time, scoped to Data Room subtrees via a `.room-root` sentinel file so plugin-source commits are never blocked; worktree-safe, symlink-safe, cross-platform, and self-healing via a session-start re-install block.
- Replaced TOCTOU-racy `existsSync` + `writeFileSync` pair with `fs.openSync(lockPath, 'wx')` atomic primitive; proven by 20-worker concurrency fence (1 winner / 19 losers, non-flaky across 3 runs).
- 1. [Rule 2 - Test assertion update] SEC-03 structural count assertions required topology migration
- One-liner:
- Zod regex /^[a-z0-9-]+$/ on 5 section sites + safeResolveSection path-traversal guard + explicit opportunitySchema JSON validation close CASCADE-03 and CASCADE-05.
- Wrapping indexArtifact's INSERT body in explicit BEGIN/COMMIT with ROLLBACK on throw closes CASCADE-04. Four independent tests prove rollback semantics, lock-release semantics, and their interaction -- with a proven regression fence (the mid-transaction rollback test FAILS when the BEGIN/COMMIT is removed).
- Brain re-init handshake eliminated within 5-min TTL windows via pending-promise sessionCache; 3 intelligence-cascade Maps bounded to 100-entry LRUs with zero call-site refactoring due to Map-parity iteration.
- 1. [Rule 3 - Blocking] Test circular dependency via feynman recursion
- Anthropic BYO-API chat ships in v1.10.12 via a three-factor auth on /api/room/chat (Bearer token + CSRF double-submit cookie + creation-time Origin binding) plus DNS-rebinding guard + four response headers + zero-log error discipline; all six R-87-09-CSRF gaps are closed by integration tests and the cascade-e2e baseline stays exact.
- One-liner:
- Single source of truth for "properly managed" Feynman-MINTO files: validate(filePath) module with 5 violation categories, 4 severity levels, hand-written zero-dep YAML frontmatter parser, and 21 fixture tests wired into the Feynman suite (28 -> 29 baseline).
- Extended Feynman-MINTO frontmatter with 5 new fields (last_generated_at, last_artifact_write_seen_at, reasoning_health_score, flagged_weaknesses, decision_log), wired read-before-write preservation across every regen, exported validateStructural + validateDecisionLogEntry validators, shipped an idempotent openSync-wx atomic migration script with dry-run, and kept the feynman test suite green at 31/31 (29 baseline + 2 new test files, 13 new individual assertions).
- Shipped the ONE and ONLY read contract for the per-folder memory triple (ROOM.md + STATE.md + MINTO.md) at lib/core/folder-memory.cjs, with sync + async dual entry points mirroring Phase 87-04, deterministic staleness and health-score computation, invariants-validator integration, and 15 fixture tests wiring the Feynman suite to 32/32 green.
- Shipped the debounced queue that coalesces post-write regen intents at scripts/minto-debouncer.cjs, with earliest-wins 10s coalescing window per section, atomic tmp+fsync+rename writes bracketed by Phase 87-02 write-lock, exponential-backoff lock retry for 5-20 concurrent producers, self-healing corrupt-queue recovery, and 12 tests bringing the Feynman suite to 33/33 green.
- Shipped the deterministic ROOM.md references recompiler at scripts/recompile-room-references.cjs, closing the partial-wiring gap on the R of the memory triple; identity prose is preserved byte-for-byte across recompiles, mtime-conflict detection honors risk #7, atomic write composes with Phase 87-02 write-lock, and 10 fixture tests wire the Feynman suite to 34/34 green.
- Every Feynman-MINTO write now goes through a 7-step atomic sequence (openSync 'wx' + fsync + validate + acquireLock + rename + releaseLock) so torn reads are impossible and broken narratives cannot overwrite valid previous files; machine-parsable envelope {success, violations[], bytes_written, elapsed_ms, path} lets downstream Phase 88 hooks detect rejection; 7 new tests cover happy path, 5-fork concurrent race, mid-write crash, invariant ERROR rejection with preservation, WARNING passthrough, reader safety, and fsync-before-rename ordering; Feynman suite 34 -> 35 green.
- Wired the write-side freshness triple: every Write, Edit, or MultiEdit that touches a .md artifact inside a Data Room section now fires debouncer enqueue (synchronous) + ROOM.md recompile (backgrounded) + MINTO stamp (backgrounded). System files stamp only. Non-.md files stamp only. Writes outside .room-root are no-ops. hooks.json PostToolUse matcher widened to Write|Edit|MultiEdit so Edit-in-place of an existing artifact also triggers the wires. Stamp + recompile are backgrounded so the user-visible PostToolUse return is not serialized on the room write-lock under Cowork contention. 15 fixture tests wire the Feynman suite to 37/37 green.
- Wired the background regen runner at scripts/intent-classifier. On every UserPromptSubmit, the hook drains minto-debouncer queue items older than 30s, appends drained entries to .mindrian/pending-tier1-regen.json atomically, and spawns tier-0 regens in fire-and-forget background via child_process.spawn(detached,unref). This is the "lazy commit" that turns the 88-02 queue into actual regens -- without it, items accumulate forever. Session crashes preserve the queue; the next session's first UserPromptSubmit picks up where we left off. 20-entry burst measured at 777ms wall-clock, well under the 2000ms UserPromptSubmit timeout, and the Feynman suite grows to 38/38 green.
- Shipped the session close-out wire at scripts/on-stop: drain the minto-debouncer queue, recompile ROOM.md references in parallel, walk every active section via folder-memory.readTriple(), and atomic-write .mindrian/session-snapshot.json + .mindrian/minto-stale.json. The Phase 84 STATE.md contract is preserved byte-for-byte; the entire Phase 88 block is strictly additive, soft-fails at every gate, and stays inside the 3000ms Stop-hook budget.
- Shipped the highest-leverage wire in Phase 88: a TRIPLE_CONTEXT block injected into session-start additionalContext on every session resume, per active section, grounded in a MEASURED budget cap (~3825 token baseline -> 5000 cap) with SESSION_START_BUDGET_TOKENS env override. Reads the 88-06 session-snapshot.json first; falls back to live folder-memory.readTriple walk. Weakest-first truncation with null-score-first sort preserves the most-informative triples under budget pressure. Closes the cross-session memory loop: Session-B Larry wakes up knowing what Session-A decided, what reasoning was in flight, and what the governing thought of each section is.
- Shipped the compaction-bridge wire at scripts/pre-compact: walk every active section via folder-memory.readTriple(), sort weakest-first by reasoning_health_score (null -> -1), truncate to MAX_SECTIONS=20 under a MAX_MS=1800 wall-clock budget, and atomic-write .mindrian/pre-compact-snapshot.json with kind:"pre-compact" discriminator. The Phase 83/84 pre-compact-state.json legacy write is preserved byte-for-byte; the entire Phase 88-08 block is strictly additive, soft-fails at every gate, and stays inside the 2000ms PreCompact hook budget with 200ms slack. Closes the compaction-resilience loop: user invokes /compact mid-session; Claude compresses context; 88-09 post-compact re-injects the triple snapshot so Larry still knows the per-section governing thoughts, reasoning health, and decision log after the context wipe.
- Shipped the compaction-bridge consumer at scripts/post-compact: read .mindrian/pre-compact-snapshot.json (88-08 producer, kind:"pre-compact") FIRST; fall back to live folder-memory.readTriple walk when snapshot missing or malformed; emit via the SAME formatter session-start uses (lib/memory/triple-context-formatter.cjs, 88-07). Byte-identity between the two hooks' TRIPLE_CONTEXT blocks enforced by Test 9 (feeds identical fixture inputs to both and asserts stdout matches byte-for-byte). Closes the cross-session memory loop at the compaction boundary: user invokes /compact, Claude compresses context, Larry wakes up knowing exactly what governing thoughts, reasoning health, decision logs, and stale / pending footers were in scope before the compact. The compaction event is now transparent to the memory layer.
- Shipped lib/core/decision-capture.cjs as the per-section decision persistence module: recordDecision appends APPROVE/REJECT/DEFER entries to MINTO.md.frontmatter.decision_log, caps at 20 entries, archives overflow to .mindrian/decision-archive/YYYY-MM/<section>.jsonl partitioned by ARCHIVED entry timestamp (not today); readDecisionLog is the read-optimized consumer path; 14 fixture tests cover first-write, append preservation, cap + JSONL archive, archive-month correctness, invalid-entry rejection with MINTO unchanged, missing-MINTO + missing-field graceful reads, 3-fork concurrent race with zero lost-writes, post-write invariants validation, preserve-on-regen composition with 88-00 generator, and special-char section names; Feynman suite 43/44 (baseline 42/43 preserved + 1 new test file registered, 1 pre-existing failure unchanged).
- Wired the APPROVE/REJECT/DEFER cascade (Phase 69) to dual-write: bin/mindrian-tools.cjs record-decision now keeps the existing proactive-intelligence.cjs write (`.proactive-intelligence.json` plus optional graph edge) AND additively calls decision-capture.recordDecision so the decision also lands in the owning section's Feynman-MINTO decision_log. The primary writer is authoritative and byte-frozen; the tertiary write is read-optimized for 88-07 session-start TRIPLE_CONTEXT injection and never blocks or regresses primary behavior. Section is derived from --source-artifact (relative or absolute, must resolve inside --room). When --source-artifact is absent, dual-write is a documented SKIP with no error log entry. Failures in the tertiary write log to .mindrian/decision-dual-write-errors.jsonl and the CLI still exits 0. 8/8 fixture tests pass; full Feynman suite 45/45 green with MINTO_FROZEN_DATE=2026-04-14.
- Five-gate release protocol: gates 1-4 closed autonomously (CHANGELOG [1.10.13] entry, plugin.json 1.10.12 -> 1.10.13, package.json 1.10.12 -> 1.10.13, local commit ba3829e + local tag v1.10.13). Gates 5a (git push origin main --tags) and 5b (marketplace.json source.ref pin to v1.10.13) surfaced to user as structured checkpoint. Phase 88 feynman-minto-memory-layer is feature-complete: 15 prior plans shipped the per-folder memory triple wiring across 5 waves; Feynman suite 45/46 with 1 pre-existing Phase 87-02 flake unchanged.
- Shipped the triple-health guardian at scripts/feynman-minto-guardian.cjs with a validator registry and four seed validators that convert three concrete silent-failure modes (partial session-snapshots, unbounded minto-queue growth, ghost stale.json entries) into first-class health signals visible at the very next session-start, plus orphan tmp cleanup from 88-04-B mid-write crashes. Advisory at session-start + on-stop, blocking only at pre-commit. 16 tests pass; Feynman suite 46/46 green; 50-section fixture session-start under 2000ms with all 4 validators active.
- L1 surface polished across all 72 commands: descriptions <= 60 chars, verb-first, under-promise, with argument-hints on 23 and disable-model-invocation on 4 destructive commands.
- Canonical permissions stance shipped across two surfaces (README H2 + machine-readable template) with 19 granular matchers, Canon Part 8 Graph Boundary verified, zero over-scoped Bash wildcards.
- All 8 lifecycle hooks now emit a tight one-line systemMessage on their happy or advisory paths; Canon Part 2 glyph vocabulary used uniformly; Canon Part 8 boundary preserved; Feynman 46/46 maintained.
- scripts/context-monitor now renders the active section's MINTO governing_thought + Canon Part 2 glyph between the stage label and the plugin brand; 5s TTL cache + atomic write keeps the cold path at 38ms and the warm path at 29-34ms (well under the 300ms CONTEXT R1 budget); graceful fallback preserves the pre-88 statusline byte-identically when MINTO is stale or absent.
- scripts/mos-status.cjs ships the Shape E (Action Report) renderer for /mos:status: per-section governing_thought rows with Canon Part 2 health glyphs (check/warn/low/--), (stale: reason) suffixes, (no MINTO yet) placeholders for empty sections, and a summary row counting filled/stale/median reasoning health; commands/status.md is rewired from Shape A (pre-88 Mondrian Board + raw artifact counts) to Shape E and carries Plan 88.1-01-compliant frontmatter; the renderer reuses Plan 88.1-04's statusline-cache 5s TTL cache + classifyHealth + truncateGoverningThought byte-identically so /mos:status and the statusline render the same glyph for the same score.
- scripts/session-start now emits a 4-line MINTO banner (brand + version + room slug + top-3 most-recently-active sections with Canon Part 2 glyph + 60-char-truncated governing_thought) between the Phase 83 ACTIVE ROOM CONTEXT block and the Phase 88-07 TRIPLE_CONTEXT block; lib/memory/sessionstart-banner-formatter.cjs is pure (fs reads limited to plugin.json for version), reuses Plan 88.1-04's classifyHealth + truncateGoverningThought byte-identically, respects SESSION_START_BUDGET_TOKENS via a proportional 20% banner share (floor 50) and a per-row envelope overhead so budget 200 drops to 2 rows and budget 50 drops all rows; banner wires MWP Layer 4 MINTO Reasoning into the highest-leverage surface - the session boundary.
- Advisory PostToolUse hook that validates per-section YAML frontmatter against 4 schemas (ROOM.md / STATE.md / MINTO.md-delegated / artifact-default) on every Write/Edit/MultiEdit under a .room-root subtree, emits one-line systemMessage on drift, appends per-event JSONL to ${CLAUDE_PLUGIN_DATA}/schema-violations.jsonl, and ALWAYS exits 0 (never blocks).
- 1. [Rule 2 - Auto-add] Documentation invariant phrasing
- 8 agent files audited and tightened: 3 PROACTIVELY additions on observe-react agents, 8 color assignments across the palette, 3 isolation: worktree declarations -- all frontmatter-only, body content untouched except one hard-rule em-dash fix in grading.md.
- Gates 1-4 closed autonomously per user prompt (CHANGELOG [1.10.15] + plugin.json 1.10.15 + package.json 1.10.15 + docs/CANON-PHASE-MAP.md + README 57x retune + release commit --no-verify + LOCAL tag v1.10.15). Gate 5 held as CHECKPOINT for user (push + marketplace pin). 57x telemetry validation: NO_DATA at release time (hook ships in this release; measurement window opens post-tag); routed to RETUNE path by retuning README to "up to 57x" with measurement surface pointer. Canon Parts 6, 7, 8 honored. Feynman 52/52 green. Zero new runtime dependencies. 10 package.json dependencies preserved byte-for-byte.
- L7 surface trust-floor shipped: three expectation-setter paragraphs placed near the top of README.md, read by every new user before the first session; Plan 02's Permissions section gains a high-traffic inbound link; Canon Part 2 reviewer R7 peer-path rule codified in user-facing docs, not just CLAUDE.md decisions.
- PATH A (Brain reachable).
- Scope deviation (documented here, not at execution time):
- Autonomous path successfully executed.
- 1. [Rule 3 - Blocking] Filename hyphen vs underscore
- 1. [Rule 3 - Blocking] Filename hyphen vs underscore
- 1. [Rule 3 - Blocking] Filename hyphen vs underscore
- 1. [Rule 3 - Blocking] Filename hyphen vs underscore (fourth repeat)
- 1. [Rule 3 - Blocking] Filename hyphen vs underscore (fifth repeat)
- 1. [Rule 3 - Blocking] Plan assumed cross-room schema; 89-01 output uses internal schema
- Live Brain Mode A3 unblocked via adaptBrainSearchResponse pure function inside rs-brain-substrate.cjs that translates {result:{hits:[]}} into {matches:[{id,score,metadata}]} without modifying brain-client.cjs
- lib/core/rs-domain-analyzer.cjs ships analyzeDomain(topic, opts) returning the 7-field structured output (primary_domain, concepts[], terminology[], methods[], breakthroughs[], boundary_flag, adjacent_domains[]) via deterministic score-weighted n-gram intersection over the 89.1a substrate; ExternalEgressViolation sibling class enforces Canon Part 8 on the new external-egress surface via three tripwires (pre-input scan + per-field scrubScalar + JSON.stringify pre-return audit); 11/11 fixture suite green including 4 adversarial scenarios + determinism fence + A1 cross-scenario forbidden-pattern sweep.
- lib/core/rs-query-matrix.cjs ships generateQueryMatrix(da, opts) returning a deterministic 60-query matrix (4 categories x 15 templates) consumed by 89.2 external fetchers; ExternalEgressViolation sibling class enforces Canon Part 8 on the new external-egress surface via two tripwires (validateAnalysis pre-input scan + auditQuery per-template post-template scan); 11/11 fixture suite green including 4 adversarial scenarios + determinism fence + A1 cross-scenario forbidden-pattern sweep.
- v1.11.0 milestone canon edge from `rss-phase-1` (ProcessStep) to `tech-domain-analysis` (Technique) filed via direct neo4j-driver after the user selected Option A: pre-pend a ProcessStep canonize-MERGE that creates the missing parent node before the dependent USES_TECHNIQUE edge MERGE; both writes succeeded on first attempt; idempotency proven by a second invocation that produced 0 mutations on every counter; final_edge_count = 1; audit log carries verbatim Cyphers + counters + rollback Cyphers; Canon Part 8 boundary held under live admin-tier write conditions.
- Phase 89.1 closure: lib/memory/run-feynman-tests.cjs advanced from 64 to 66 entries (Plan 89.1-02 + Plan 89.1-03 fixture suites registered); 89.1-PHASE-GATE.md filed with 13/13 PASS asserts (9 G + 4 E); 89.1-LIVE-A3-VERIFY.md extended with live Mode A3 re-probe (substrate_length=25, sample_score=0.808986 in [0,1], framework_name in metadata, audit log clean) AND live canon edge read (USES_TECHNIQUE edges=1 from rss-phase-1 to tech-domain-analysis); zero release artifacts touched (E4 PASS); 89.1a deferred-items.md item 1 (brain-client shape mismatch) RESOLVED.
- Status: PASS
- Three Wave-1 foundation modules + adversarial fixture suite shipped in 4m21s. ExternalEgressViolation extracted from 89.1's per-module siblings to lib/core/rs-egress-violations.cjs (Canon Part 7 reuse; 89.1 siblings preserved as back-compat). FORBIDDEN_PATTERNS re-exports byte-for-byte from cross-room-aggregator via lib/core/rs-egress-prompts.cjs with require-time drift guard. Per-source telemetry primitive at the global ~/.mindrian/telemetry/external-papers.json with sha256-hashed query_text (Canon Part 8: literal queries NEVER persist to disk). Wave-2 fetchers (academic / patents / industry / experts) can now consume these three modules without each redefining their own violation class, FORBIDDEN_PATTERNS reference, or telemetry path.
- Six-source academic external-egress fetcher shipped with one Canon Part 8 chokepoint and a drop-in invariants validator. fetchAcademic orchestrates OpenAlex + arXiv + PubMed (no API key) + Scopus + IEEE + Nature (env-key gated) into a single deduped paper stream. buildAcademicQuery is the SOLE URL builder; auditQueryString runs pre-egress so adversarial input throws ExternalEgressViolation BEFORE any fetch() call. fetchWithTimeout is the ONE native fetch call site (static grep enforced). Per-source rate-limit / timeout / parse-error / API-key-missing / budget-exhausted all degrade gracefully via the v1 ALLOWED_STATUSES telemetry enum. external-academic-invariants validator drops in at scope='global' with 6 checks mirroring the brain-substrate-invariants byte-for-byte structure. 18/18 fixture scenarios green plus A1 forbidden-pattern sweep across cumulative captured URLs and A2 FORBIDDEN_PATTERNS parity gate. Wave 3 (preprocessor + differential scorer) can now consume normalized {id, title, abstract, authors[], institution, doi, source, fetched_at} records.
- Two-source patents external-egress fetcher shipped with one Canon Part 8 chokepoint and a drop-in invariants validator. fetchPatents orchestrates Google Patents + USPTO (both no-key) into a single deduped patent stream. buildPatentsQuery is the SOLE URL builder; auditQueryString runs pre-egress so adversarial input throws ExternalEgressViolation BEFORE any fetch() call. Pre-flight audit walks every query before the source loop so adversarial inputs at any position produce ZERO captured URLs (an improvement on the academic fetcher's per-query audit). fetchWithTimeout is the ONE native fetch call site. Per-source rate-limit / timeout / parse-error / budget-exhausted all degrade gracefully via the v1 ALLOWED_STATUSES telemetry enum. external-patents-invariants validator drops in at scope='global' with PATENTS_SOURCES = {google_patents, uspto} gate so Checks B/C/E/F only emit warnings for patents entries on the shared ledger. 17/17 fixture scenarios green plus A1 forbidden-pattern sweep across cumulative captured URLs and A2 FORBIDDEN_PATTERNS parity gate. Wave 3 (preprocessor + differential scorer) can now consume normalized {patent_id, title, abstract, inventors[], assignee, filing_date, source, fetched_at} records.
- From 89.2-02 (academic):
- Experts post-processor that extracts deduped author records from the academic fetcher's papers[] output, sorts deterministically by paper count and name, and gates the output through a defense-in-depth auditQueryObject scan even though the module introduces no new network egress surface.
- Phase 2 deterministic 5-field preprocessor + Phase 3 dual-floor differential scorer (passes IFF diff>0.3 AND LSA>0.2 AND BERT>0.2 strict) + CJS->Python pinecone-direct bridge for strict 1024-dim cosine via existing rs_cache.py + documented Canon Part 7 carve-out for pair-wise LSA via embedded sklearn TfidfVectorizer + TruncatedSVD.
- Phase 3 deterministic 3-enum innovation classifier (lsa/bert >0.3 thresholds, strict >) + Phase 3 5-dimension 0-10 breakthrough rubric (feasibility/market/magnitude/advantage/impact, frozen-order tie-break) + Phase 4 pure-template-fill thesis generator ("By applying X to Y, achieve Z because mechanism bridge_concept.") -- the three-stage deterministic chain that converts a scored pair into an actionable thesis. ZERO runtime LLM. ZERO Math.random. ZERO new runtime deps. Pre-input + pre-return Canon Part 8 audits across all 3 modules.
- Single-sweep Feynman registration of 11 new 89.2 fixture suites (baseline 66 -> 77; +11 delta exceeds ROADMAP target of +8) + Phase Gate transcript with 9 G + 5 E asserts (13 PASS + 1 CONDITIONAL G8) + VERIFICATION.md mirroring 89.1 format with all 13 ROADMAP Success Criteria verified -- the closure plan that hands off Phase 89.2 to Phase 89.3 / 89.4 / 89.5 with full evidence trail.
- Tier 1 Aura Cypher writer for canonical Reverse Salient schema with REAL idempotency via sha256-deterministic ids (not mock-state tracking) and Canon Part 8 defense-in-depth audit covering UNWIND-input smuggling vectors.
- Tier 0 SQLite writer with byte-for-byte API parity to rs-neo4j-writer (Plan 89.3-01); INSERT OR REPLACE on PRIMARY KEY for MERGE-equivalent idempotency; deterministic sha256 ids shared with the Aura tier; Canon Part 8 defense-in-depth audit covering UNWIND-input smuggling vectors; SQLiteUnreachableError as clean tier-dispatch signal.
- 5-branch Cytoscape mind-map generator with Tier 0/1 transparent dispatch (SQLite via lazygraph.openGraph OR Aura via opts.driver); reuses dashboard cytoscape@3.33.1 CDN with zero new runtime deps (Canon Part 7); Canon Part 8 defense-in-depth audit on the final rendered HTML so leaks at the display surface are caught regardless of where in the pipeline they originated.
- Cypher MATCH-then-MERGE expert resolver that takes Plan 89.2-05 mapExperts output and resolves authors + institutions + citation_edges in the user's own Aura (Tier 1) or returns a friendly degraded subset from rs-sqlite-mirror's room.db (Tier 0). Defense-in-depth at two Canon Part 8 seams: pre-Cypher per-expert audit and pre-return output audit.
- In-place backward-compatible enhancement of bridge-writer.cjs (renderBridgeArtifact gains 2 OPTIONAL frontmatter fields + Canon Part 8 audit seam; module.exports byte-identical) + single-sweep Feynman registration (5 new 89.3 entries; baseline 77 -> 82) + Phase Gate transcript (9 G + 5 E asserts; CONDITIONAL PASS for G8 inheritance) + VERIFICATION.md (9/9 SCs PASS).
- One-liner:
- One-liner:
- 1. [Rule 1 - Bug] 89.4-02 Test 4 + Test 9 STUB-specific assertions blocked Plan 89.4-03 GREEN
- One-liner:
- Deterministic Phase 4 commercial layer: frozen-table 3-field output (market_size_estimate + value_proposition + partnership_targets[]) with Canon Part 8 input audit and zero runtime LLM dependency.
- Bidirectional NL-Graph Surface (a) Text->Query: the hardest Canon Part 8 surface in v1.11.0. Arbitrary user NL is translated into a triangulated {cypher, sql, brain_query} bundle via a deterministic intent classifier + buildBrainQueryFromNL chokepoint + 3-seam audit, with brain_query OMITTED when intent unrecognized OR would require user-content.
- Bidirectional NL-Graph Surface (b) Query->Text: raw graph results translate to Larry-voiced NL via frozen VOICE_TEMPLATES (5 kinds x 3-4 templates = 16 total) + deterministic FNV-1a template selection + venture context enrichment via folder-memory.readQuadruple + 2-seam Canon Part 8 defense. NO runtime LLM. Mode A/B/Tier-0 graceful degradation across the BRAIN.md presence axis.
- Top-level orchestrator chains every Reverse Salient phase end-to-end via 17 require()'d 89.1-89.5 modules. Single runDiscovery(topic, opts) entry point returns the full RSDiscovery bundle with chain metadata + persisted graph nodes. Tier 0/Tier 1 dispatch with AuraUnreachableError catch + Tier 0 fallback. Mode A/Mode B graceful via chain-feeder chokepoint reuse. Canon Part 8 input audit at the gate; Brain chokepoint exclusively via chain-feeder.lookupUpstream (zero direct brain-client require, zero direct fetch). 9/9 fixtures pass.
- Closes Phase 89.5 (the v1.11.0 Reverse Salient capstone) with 4 user-facing CLI commands wrapping 89.5-01..04 library modules + end-to-end CLI smoke test (6 scenarios; bidirectional NL-Graph loop verified) + 5 new Feynman fixture suites registered (baseline 85 -> 90) + Phase Gate transcript (9G + 5E asserts; CONDITIONAL PASS) + VERIFICATION report (9/9 SCs passed). Phase 89.5 is the v1.11.0-beta.1 readiness gate; the release gate ships as a SEPARATE sub-phase added between 89.5 and 91 per kickoff section 7 strategy.
- 1. [Rule 1 - Plan-spec mismatch] Plan-stated Canon Part 8 grep gate over-restricts the queue module
- 1. [Rule 1 - Bug] Test 2 env var name mismatch
- 1. [Rule 3 - Blocking] Lazy folder-memory require for Check A fallback
- L5 Decision layer that composes 5 signals (ICM scope + SQL relations + Feynman-MINTO reasoning + BRAIN.md derivations + intent/persona) through a structured rule-based decide() function with full Section 8 trace, Section 4 staleness multipliers, Section 5 tier-mode resolver, Section 6 RECOMMENDED gate, and Canon Part 2 attribution guard.
- Promoted persona from ephemeral session-state keyword detection to first-class per-user artifact in USER.md. Shipped lib/core/persona-taxonomy.cjs (D-03 frozen tables + Larry->Brain translation) and lib/core/user-md-ops.cjs (Phase 87-02 atomic read/write + 6-reason update-detection tree). 22 fixture tests, Canon Part 8 boundary verified, cross-session subprocess persistence proven. Zero new runtime deps.
- Wired Phase 91 Navigation Engine into the UserPromptSubmit hot path. scripts/intent-classifier.cjs now resolves active room + section, calls navigation-engine.decide() under a 1200ms Promise.race timeout, persists decision_trace atomically with 50-entry rotation, and emits a NAVIGATION DECISION (engine v1) block to additionalContext. Engine-throw + engine-timeout fallback preserves Phase 83 classifier behavior byte-for-byte. 12 fixture tests green; Phase 83 regression guard fixed (one assertion relaxed to permit the engine block while still forbidding Phase 83 mismatch warnings on matching messages).
- Shipped lib/core/skill-activation-router.cjs as a pure routing composer that merges navigation-engine.decide() output with the pre-91 (legacy) file-state + env activation set. Canon Part 3 closed 10-verb vocabulary is enforced at the router boundary: unknown verbs are rejected with a trace note instead of silently propagating. Canon Part 7 Reuse Before Build is honored: legacy activation is preserved byte-equivalent when the engine is silent. The router has three precedence rules (engine / mixed / legacy) with explicit reason codes, plus deterministic resolution of contradictory engine outputs (fire wins over self-suppress). 17-test suite green: 15 router unit tests + 2 end-to-end integration tests through scripts/intent-classifier.cjs.
- Shipped lib/core/offer-presenter.cjs as a pure-function module that converts navigation-engine.decide()'s offer_next_step into a one-line grounded suggestion ("Offer: Because <reason>, try <command>.") with optional RECOMMENDED marker. Three-tier noise gate (one_offer_per_turn + consecutive_ignores_threshold + grounding rule) prevents offer fatigue. Canon Part 3 Section 6 RECOMMENDED gate is RESPECTED at render time (engine evaluates Mode A + confidence >= 0.7 + verb match in Plan 91-00; presenter reads the resolved flag and renders '(RECOMMENDED)' when true). Canon Part 4 graph-data persistence: offer outcomes (shown / ignored / acted) atomically append to .mindrian/offer-history.json with 100-entry rotation. Canon Part 8 LOCAL-only: zero network surface, zero Brain reads. 17-test suite green: 15 presenter unit tests + 2 end-to-end integration tests through scripts/intent-classifier.cjs (engine offer renders the Offer line; ignore-loop reclassifies prior 'shown' to 'ignored' on next turn).
- Shipped /mos:explain-decision as the user-facing audit surface for the Navigation Engine. Reads .mindrian/decision-traces/<session>.json (written by Plan 91-02; extended by 91-03 routing + 91-04 offer fields) and renders human-readable trace output: header + Tier Mode glyph classifier + BRAIN.md signal block (5 fields) + RECOMMENDED marker block (2 fields) + Five-Signal Triangulation (5 numbered structural entries) + chosen_rationale + optional Routing + optional Offer. Default renders last 1 trace; --last N renders N most recent (clamped to traces.length); --session SESSIONID overrides default resolution. Default session resolution chain: --session flag -> CLAUDE_SESSION_ID env -> .mindrian/current-session.json pointer -> mtime fallback. Graceful fallbacks always exit 0: absent file -> "No decisions recorded"; malformed JSON -> "could not be parsed"; no active room -> registry advisory. Pure CJS + Node built-ins; zero network surface (Canon Part 8); never writes back to the trace file (Canon Part 4 audit lens). 14/14 fixture tests green (12 command-semantics + 2 markdown lint). Feynman runner advances by +1 to 94/96 with 2 inherited 89.4 fails preserved. Plan 91-02/03/04 regression tests all green.
- Shipped the visible Larry dial as `lib/core/nav-dial.cjs` (pure resolver + formatter) wired into `scripts/context-monitor` between the MINTO segment and plugin brand. Three positions (Investigate | Blend | Insight) with the active position highlighted via De Stijl ANSI palette per Navigation Engine decision. Reads the same `.mindrian/decision-traces/<session>.json` file `/mos:explain-decision` reads, so the dial is grounded in the same audit surface. Position mapping: tier_0 -> Investigate/--/null; mode_b -> Investigate/warn/active; mode_a + weight bands across 0.3 / 0.7 / 0.9 floors; weight >= 0.9 + insight markers (synthesize/insight/converge case-insensitive) promotes Blend to Insight. Glyph vocabulary (check/warn/low/--) byte-identical with Plan 88.1-04 statusline-cache classifyHealth. Suppress dial when glyph='--' AND highlight=null (pre-engine state); dial only renders when the engine has actually spoken. Pure module imports nothing; caller does all reads with try/catch wrap (degraded-install graceful fallback preserves pre-91 statusline byte-identically). 17/17 dial tests green: 12 pure-module + 5 integration / canon audit (Test 17 source-scans for forbidden brain-client / fetch / curl / https references in dial source -- zero matches). Feynman runner advances by +1 to 95/97 with 2 inherited pre-existing fails preserved (84-smart-notebook-copilot 15/16; test-self-update-platform 19/24; both predate this plan and are out-of-scope per Rule 3 scope boundary). Tyler meeting quote ('my students almost unanimously said, We love the slider') is now a shipped pedagogical surface, not a research wish.
- 4-type problem classification (UDP / IDP / WDP / unknown) routes skills per locked decision D-08 with Canon Appendix E R4 wicked escalation, plus Wave-3 brain-client.isAvailable() upgrade unlocks Mode A.
- Brain-flagged Composable Methodology becomes real -- when the user just completed framework A, the engine pre-loads framework B from BRAIN.md FEEDS_INTO edges with grounding-rule reason and Canon Part 3 RECOMMENDED gate respected; user override captured as graph data.
- Drop-in registry-compatible validator that converts five silent Phase 91 navigation failure modes -- missing trace fields, RECOMMENDED-in-wrong-mode, weight-clamp breaches, malformed trace files, unknown verbs -- into first-class health signals visible at session-start, on-stop, and pre-commit. Zero guardian.cjs edits; the Phase 88-13 registry contract was built for exactly this.
- STATE.md frontmatter current_room is now the canonical source of truth for the active-room slug, consumed by scripts/context-monitor through lib/core/folder-memory.cjs getCurrentRoom(). Lawrence Aronhime's "look at the bottom. It still says core power" reproducer (4 callouts in 38 minutes) cannot recur on this code path.
- Canon Part 7 (Reuse Before Build).
- Canon Part 7 (Reuse Before Build).
- Canon Part 7 (Reuse Before Build).
- Canon Part 4 (Every Choice Is Graph Data).
- The room classifier now honors unambiguous user input: 'switch to 8', explicit slugs ('/mos:rooms curriculum-redesign-fall-2026'), and quoted exact names ('"Beta"') bypass the similarity heuristic and resolve directly. Three of Lawrence Aronhime's four loudest UX callouts from the 2026-04-28 38-min live test are fenced; the fourth (natural-language 'the curriculum room') is documented as known-deferred to v1.11.3.
- Three U+2014 em-dash characters removed from commands/wiki.md (lines 39, 40, 68) per project hard rule (feedback_no_emdashes.md: "never use em-dashes in any output"). QA handoff Section 3 FIX-5 acceptance criterion satisfied: `grep -cP "[\x{2014}]" commands/wiki.md` returns 0.
- Five U+2717 (heavy ballot x, `✗`) violations across commands/admin.md (4) and commands/help.md (1) replaced with ASCII `x` (U+0078). The 12-glyph canonical vocabulary in skills/ui-system/SKILL.md does NOT include U+2717; ASCII `x` is the canonical error-line glyph per SKILL.md Section 7 (red `x` + Why: + Fix: pattern). Two-file character-level edit; one commit; QA handoff Section 3 FIX-7 acceptance gate satisfied for the two named files. Two additional U+2717 occurrences in commands/room.md discovered during the broader sweep are deferred to v1.11.3 or addendum plan 94-08b per executor SCOPE BOUNDARY rule.
- Canon Part 3 (Tri-Context Decision Gate, 10-verb canonical vocabulary

preserved).

- The /mos:heal slash command ships v1.11.1 GA: a one-command path that brings any room back to v1.11.x conformance via 10 idempotent steps wrapping 4 shipped scripts. The recipe was dog-fooded on the mindrianOS room itself on 2026-04-29 and authored AS executed. Canon Part 7 (reuse-before-build) honored at the orchestrator surface; Canon Part 4 (every choice is graph data) honored via heal-log.json envelope; Canon Part 8 (graph boundary) honored via LOCAL-only operation with read-only brain-derivation-queue. Three v1.12 candidates deferred with explicit re-trigger conditions in deferred-items.md.
- One-liner:
- 1. [Rule 3 - Blocking] Active-room guard prevented cascade in test fixtures
- Spot-audit of .cjs wrappers
- STEP A (Workspace guard):
- REQUIREMENTS.md `## Plugin Self-Healing Diagnostics (DOCTOR-95.1)` block
- Sibling test fixture at test/fixtures/cascade-surface-e2e/ that gates Class D surface verification (envelope -> side-channel -> reader contract) without sharing state with the existing pipeline fixture.
- 7 RED test skeletons covering all 8 DOCTOR-95.1 requirements registered in the Feynman runner -- Wave 1 plans now ship as RED -> GREEN transitions per Nyquist sampling rule.
- ROOM.md + MINTO.md generator for drift class E remediation -- single-dir + --recursive + skip-if-exists + --force, hand-rolled minimal frontmatter, atomic write via mktemp + rename(2), zero new runtime dependencies.
- 1. [Rule 3 - Blocking] Cleaned 9 forbidden box-char comment dividers from scripts/doctor.cjs
- scripts/doctor.cjs gains 4 new check surfaces (cascade-rooms / cascade-rooms-active / verify-surface stub / room-md) + class E --fix generator dispatch, flipping tests/test-doctor-class-{b,c,e}.cjs from RED to GREEN (9/9 scenarios) while preserving Plan 04's zero-box-char invariant and the cascade-surface-e2e + ui-self-compliant green status.
- scripts/doctor.cjs gains checkUIRulingCompliance() (the most ironic detector in the phase: the one that would have flagged /mos:doctor's own historical non-compliance), flipping tests/test-doctor-class-f.cjs from RED 0/4 to GREEN 4/4 while staying self-clean (0 forbidden chars in detector source) thanks to a new-RegExp-from-Unicode-escape design that lets the scanner safely scan its own home file.
- Hydrated the MindrianOS-Plugin dogfood `room/` subtree atomically — 1 sentinel + 20 generated ROOM.md/MINTO.md files (10 directories) staged for Plan 95.1-08 commit + 1 nested-smoke-debris cleanup — and upgraded scripts/doctor.cjs's class D stub to a live spawnSync runner that asserts the 8-key side-channel shape end-to-end via tests/test-cascade-surface-e2e.cjs.
- Phase 95.1 ships as v1.12.1-beta.1.

---

## v1.8.6 MindrianRooms -- ICM Room Organization (Shipped: 2026-04-06)

**Phases completed:** 6 phases (56-59.2), 6 plans, 35 requirements

**Key accomplishments:**

- Centralized all Data Rooms under ~/MindrianRooms/ with ICM Layer 0 (CLAUDE.md) and Layer 1 (INDEX.md) auto-generation
- 4-strategy resolve-room cascade (central registry, directory scan, workspace registry, legacy fallback) with MINDRIAN_ROOMS_HOME env var
- /mos:organize wicked hierarchy navigator with 4 subcommands (tree/propose/view/move), 4-tier graceful degradation (Brain+KuzuDB -> Brain -> KuzuDB -> metadata), human confirmation for every move
- Dual-graph room hierarchy: KuzuDB local (Room/RoomGroup/CONTAINS/AT_STAGE) + Neo4j Brain remote (adds USES_FRAMEWORK/SHARES_THEME/HAS_SECTION) as additive intelligence layer
- Migration engine detecting 5 legacy room patterns with per-room confirmed migration
- 13 orphaned DataRoomSection Brain nodes wired to parent Room nodes
- Integration audit: 21 exports, 0 orphaned, 6/6 E2E flows verified

---

## v4.0 Brain API Control & CLI UI Ruling System (Shipped: 2026-03-29)

**Phases completed:** 6 phases, 12 plans, 21 tasks

**Key accomplishments:**

- Supabase SQL migration with validate_brain_key RPC, plan-gated brain_write admin guard, and Render env var declarations
- Standalone brain-admin.cjs with 6 commands (create/revoke/extend/list/usage/requests) for Brain API key lifecycle management via Supabase REST
- 728-line SKILL.md governing all MindrianOS terminal output with 4-zone anatomy, 5 body shapes, 12 glyphs, 5 ANSI colors, session start contract, and dual context routing
- Retrofitted status, room, and help commands to follow 4-zone anatomy with declared body shapes (Mondrian Board, Semantic Tree, Room Card, tldr-help)
- Hidden self-teaching /mos:admin command wrapping brain-admin.cjs with admin visibility filtering in /mos:help
- resolve-room keystone script with registry-first/legacy-fallback resolution, room-registry CRUD, and all 5 hooks retrofitted for multi-room awareness
- Room lock guard in room-passive skill, registry-aware Zone 1 header canary, and multi-room session greeting with other-rooms list
- Brain-driven autonomous framework selection with thinking traces, subagent isolation, chain mode (3-5 frameworks), and dry-run preview
- Isolated subagent for autonomous methodology execution with quality gate, provenance tracking, and chain mode output contract
- Single-file De Stijl HTML export template with Mondrian grid, document reader with sidebar nav, intelligence view, and interactive Cytoscape knowledge graph
- Node.js generation script that reads room data, runs intelligence/graph analysis, queries LazyGraph, and injects into De Stijl template for self-contained HTML export

---

## v2.0 Meeting Intelligence (Shipped: 2026-03-24)

**Phases completed:** 4 phases, 13 plans, 0 tasks

**Key accomplishments:**

- (none recorded)

---
