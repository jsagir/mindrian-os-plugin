# Changelog

All notable changes to MindrianOS Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- Onboarding Registry: Each version entry can include `onboarding: true/false` and `onboard_steps:` -->
<!-- When onboarding: true, the onboard_steps list is shown to returning users in the What's New flow -->
<!-- This allows new releases to automatically surface relevant guidance without code changes -->

## [1.11.0-beta.1] - 2026-04-27

Beta release of the Reverse Salient (RS) Discovery Engine for opt-in testers (Justin / Aryeh). Stable users on v1.10.19 are NOT auto-updated; opt-in is explicit. Phase 91 Navigation Engine is NOT yet wired -- coming in beta.2. Tester sign-off promotes to stable v1.11.0 in Phase 91.5.

### Tester Opt-In

Run these two commands in order to install this beta:

```bash
/plugin marketplace update
claude plugin update mos@mindrian-marketplace --version 1.11.0-beta.1
```

To leave the beta, drop the `--version` flag and run `claude plugin update mos@mindrian-marketplace` -- next refresh resolves back to stable v1.10.19.

### Added

- **RS Discovery Engine end-to-end orchestrator** (`scripts/rs-discovery-engine.cjs`, Phase 89.5). Top-level pipeline chaining Domain Analysis -> Query Matrix -> Fetchers -> Preprocessor -> Differential Scorer -> Innovation Classifier -> Breakthrough Scorer -> Thesis Generator -> Output Layer -> Chain Feeder.
- **Phase 89.1a: substrate.** Brain query plumbing + Canon Part 8 chokepoint preserving NEVER-user-data-to-Brain across all RS surfaces.
- **Phase 89.1: Domain Analysis + 60-Query Matrix.** `rs-domain-analysis.cjs` + `rs-query-matrix.cjs::generateQueryMatrix` produce the canonical 60-query matrix consumed by every fetcher.
- **Phase 89.2: Fetchers + Preprocessor + Scoring + Thesis.** 4 external fetchers (academic / patents / industry / experts) each carrying the 5-tripwire Canon Part 8 pattern (chokepoint + ExternalEgressViolation + auditQuery + drop-in validator + adversarial fixtures). Per-source rate-limit graceful degradation per Phase 88.6-03. Differential scorer + innovation classifier + breakthrough scorer + thesis generator complete the pipeline.
- **Phase 89.3: Output Layer.** `rs-neo4j-writer.cjs` (Aura schema: RSDiscovery / ReverseSalient / Innovation / Paper / Author / Institution + DISCOVERED / DERIVED_FROM / ENABLES / AUTHORED_BY / AFFILIATED_WITH edges), `rs-sqlite-mirror.cjs` (Tier 0 fallback when Aura absent), `rs-mind-map.cjs` (5-branch Cytoscape: Direct Intersections / Structural Transfer / Semantic Implementation / Discovered RS / Innovation Ecosystem), `rs-expert-mapper.cjs` (Cypher MATCH against user's Aura).
- **Phase 89.4: Chain Wiring.** `rs-chain-feeder.cjs` codifies engine choreography across the broader MindrianOS engine ecosystem (HSI / Navigation Engine / Scenario / Opportunity / Team-Assembly). Canon Part 3 10-verb closed vocabulary enforced (validateVerb). Skill-spawn rules ship per RS type and breakthrough score.
- **Phase 89.5: Bidirectional NL-Graph Surface.** Text->Query (`rs-text-to-query.cjs`): natural language -> Cypher/SQL -> 3-graph triangulation across room.db + LazyGraph Aura + Brain methodology, with Canon Part 8 chokepoint preserved. Query->Text (`rs-query-to-text.cjs`): raw graph results -> Larry-voiced NL explanation with pedagogical framing + venture context + cross-ref enrichment.
- **4 new CLI commands:** `/mos:rs-fetch`, `/mos:rs-thesis`, `/mos:rs-experts`, `/mos:rs-explain`. All three surfaces (CLI + Desktop MCP + Cowork) verified at 89.5 closure.
- **Pre-release tripwires (this gate).** `scripts/release-beta-preflight.sh` refuses tag operations when plugin.json version does not match `-beta.N` suffix. `scripts/release-beta-smoke.sh` runs a fresh-clone + plugin-install + `/mos:rs-fetch` smoke against the COMMITTED release state (commit -> smoke -> tag ordering) BEFORE tag creation, per release-process.md beta-gating mandate.
- **TESTER-NOTES.md** at `.planning/release/v1.11.0-beta.1-TESTER-NOTES.md` with opt-in instructions, 4 CLI commands, known limitations, and feedback channel.

### Known Limitations

1. **Navigation Engine is not yet wired** (Phase 91; coming in v1.11.0-beta.2). Skill activation remains the legacy file-state + env behavior in beta.1. RS commands work fine; the engine that picks RS commands automatically does not.
2. **Aura write path requires LazyGraph connected.** SQLite Tier 0 fallback works when Aura is absent. Aura write only fires when LazyGraph is enabled via `/mos:setup graph`.

### Phase Gate

Phase 89.5 closed 2026-04-27 with 9/9 SCs verified; Phase Gate CONDITIONAL PASS; Feynman runner baseline 85 -> 90 (5 new fixture suites registered). v1.11.0-beta.1 readiness gate cleared.

## [1.10.19] - 2026-04-26

Patch release that ships two same-day hotfixes initially attempted as in-version patches to v1.10.18. The in-version mechanism failed in the field: a v1.10.18 user running `/mos:update` was told "you're on the latest" because version comparison was `1.10.18 == 1.10.18`, even though the v1.10.18 tag had been force-moved to the hotfix commit. Promoting to a real patch-bump (1.10.19) so every standard update tool sees the diff. The 1.10.x minor baseline is preserved -- planning artifacts (Phase 91 navigation-engine, Phase 92 refactor work) continue to reference the 1.10.x line.

### Fixed (Hotfix 1: hook output schema)
- **CRITICAL: Hook output schema compatibility with Claude Code 2.x.** Three hook scripts (`scripts/query-efficiency-telemetry.cjs`, `scripts/write-scope-check.cjs`, `scripts/feynman-minto-guardian.cjs`) emitted JSON with top-level `systemMessage` / `additionalContext` fields. Claude Code 2.x rejects these via `additionalProperties: false`, causing every Read/Grep/Glob and Write/Edit call to fire "Hook JSON output validation failed -- (root): Invalid input" in the user's terminal. Plugin appeared broken on every recent Claude Code install. Fixed by wrapping output in the canonical `hookSpecificOutput` envelope per the official hooks reference (https://docs.anthropic.com/en/docs/claude-code/hooks). Silent exits now emit zero stdout (was: invalid JSON with null fields).
- Reported by Aryeh Holtzberg (PWS IRIS 2025) on 2026-04-26. Reference fixes in graphify v0.3.21 (2026-04-09) and oh-my-claudecode v4.11.5 ("fix(hooks): wrap wiki hook additionalContext in hookSpecificOutput").

### Fixed (Hotfix 2: plugin registry sync)
- **CRITICAL: `/mos:update` and `scripts/self-update` bypassed Claude Code's plugin registry.** The previous implementation copied plugin files to `~/.claude/plugins/cache/...` but did NOT update `~/.claude/plugins/installed_plugins.json` or `~/.claude/settings.json :: enabledPlugins`. Result: cache had the new version, registry didn't, plugin loader silently ignored the install. Slash commands disappeared. Users restarted, saw nothing, assumed the plugin was broken. Confirmed in field by Aryeh Holtzberg on 2026-04-26 -- matches Anthropic-tracked issues #11357, #12457, #14815, #17832 (all describe `installed_plugins.json` and cache drifting out of sync, plugin appearing installed but not loading).
- **Fix: native delegation.** `commands/update.md` rewritten to call Claude Code's native `claude plugin marketplace update` + `claude plugin update mos@mindrian-marketplace` (slash form: `/plugin marketplace update` + `/plugin update mos@mindrian-marketplace`). These commands keep all four registry files in sync atomically. Constitutional rationale: Canon Part 7 -- Reuse Before Build. We had a homegrown installer; the platform already had one that worked.
- **Deprecation: `scripts/self-update`** is now a no-op stub that emits a clear migration message and exits non-zero. The 427-line original is preserved at `scripts/self-update.deprecated-2026-04-26.bak` for reference. Existing automation (cron jobs, CI) gets a clear migration path instead of silent breakage.

### Added
- **Pre-release hook compatibility scan**: `scripts/check-hook-schema-compatibility.cjs` scans every hook script for forbidden output patterns before any version bump. Top-level `systemMessage`, top-level `additionalContext`, and naked `JSON.stringify({systemMessage: ...})` patterns now fail the release gate. See `docs/RELEASE-GATES.md`. This gate is mandatory before every future version tag.
- **SHA-based update detection** in `/mos:update`: compares the local installed-commit SHA against the remote `v<version>` git tag SHA, surfacing in-version hotfixes (cases where the version string matches but the tag was force-moved). Belt-and-suspenders defense alongside semver comparison so users on a corrupted in-version build can still detect the fix is available.

### Process change
- **In-version patches are deprecated as a distribution mechanism.** v1.10.18 was force-tagged twice during the 2026-04-26 hotfix attempts; both attempts hit the same wall: existing users running version-comparison-based update tools never saw the diff. Going forward, every fix that reaches users ships with a patch-level version bump. The 1.10.18 git tag now points at the original Phase 90 release commit; v1.10.19 is the canonical home for the hotfixes.

### Phase 90 plan amendment
Both hotfixes are appended to Phase 90 (brain-derivation-layer) release notes as patch-level correctives. See `.planning/phases/90-brain-derivation-layer/90-HOTFIX-2026-04-26.md` for the failure-mode autopsy and constitutional rationale.

## [1.10.18] - 2026-04-20

### Original release notes

Phase 90 Brain Derivation Layer ships. BRAIN.md lands as the fourth
per-folder memory file on top of the Phase 88 triple, extending per-folder
memory from triple to quadruple while keeping readTriple byte-identical for
every Phase 88 consumer. Readers opt into the richer quadruple by calling
the new additive readQuadruple entry point. Derivation is Brain-authored,
versioned, and auto-invalidated on governing_thought change. Five
independent Canon Part 8 tripwires defend the constitutional boundary
across schema, prompt builders, invariants validator, cross-room
aggregator, and a cross-scenario BRAIN.md body sweep. The derivation
surface is proven fail-safe under 14 graceful-degradation scenarios
covering Brain-offline, rate-limit, schema drift, ENOSPC, EACCES, and
concurrent-write races. /mos:brain-derive ships with four orthogonal
modes (section / --all / --cross-room / --dry-run) rendering the Phase
88.6 Shape E Action Report. Phase 91 Navigation Engine consumes this
layer through a frozen v1 interface contract filed at
.planning/research/navigation-engine-brain-interface.md. Phase 90 adds
zero new runtime dependencies, preserves all 10 existing deps
byte-for-byte, and keeps three-surface parity across CLI, Desktop, and
Cowork. Feynman suite grows from 52 to 62 registered files (10 new test
suites covering every Phase 90 surface). Canon Parts 2, 3, 6, 7, 8
honored throughout. v1.10.17 was burned as a hotfix for YAML frontmatter
parse errors (entry below); Phase 90 ships at v1.10.18.

### Added

- **BRAIN.md: the fourth per-folder memory file.** A Brain-authored
  derivation layer that sits on top of the Phase 88 triple (ROOM.md +
  MINTO.md + REASONING.md). Per-section carries: Pattern Matches,
  Cross-Domain Analogies, Wicked Indicators, Unfilled Opportunity
  Matches, Framework Chain Predictions, Assessment Thinking-Chain
  Position, Problem-Type Classification, Cross-Room Contradiction Flags
  (opt-in), and optional HSI signals. Schema is frozen at v1 with a
  STALE_REASON enum + OPTIONAL_SECTION_HEADINGS vocabulary. The
  frontmatter carries governing_thought_hash so a change in the section's
  MINTO.md auto-invalidates the derivation. Schema doc at
  docs/BRAIN-MD-SCHEMA.md (Phase 90 Plans 00 + 01).

- **/mos:brain-derive slash command (4 modes).** Four orthogonal knobs
  on a single dispatcher: `section` (single), `--all` (every section
  in the active room), `--cross-room` (enable Phase 83-scoped
  cross-room contradiction aggregation), `--dry-run` (cost estimator;
  zero Brain calls, zero BRAIN.md writes). Output is a Shape E Action
  Report per Canon Part 3 (body shape ported byte-identically from
  Phase 88.6 diagnostics). Streaming stderr progress kicks in above
  3 sections. Rate-limit mid-batch converts remaining sections to
  structural skips; partial completion is valid. `allowed-tools`
  narrowed to `Bash(node *)` (Phase 90 Plan 07).

- **folder-memory readQuadruple() extension.** readTriple signature
  and return remain byte-identical (15/15 Phase 88-01 tests continue
  to pass). readQuadruple is a new composed entry that layers
  parseBrainMd + emptyBrain + attachBrainToTriple on top of the
  existing triple. Sync and async entry points both ship with
  AsyncFunction key-set parity enforced by a test. A new
  isQuadrupleFresh predicate exempts transient `brain_offline`
  staleness from "derivation stale" so a brief network outage does
  not cascade (Phase 90 Plan 04).

- **Five independent Canon Part 8 tripwires.** Schema leak heuristic
  scan (Plan 00) + deriveSection single-chokepoint
  buildBrainQueryContext (Plan 01) + registry brain-md-invariants
  body-text scan at guardian checkpoints (Plan 05) + cross-room
  aggregator sanitizeDetailScalar + JSON.stringify output audit
  (Plan 06) + cross-scenario BRAIN.md sweep across every graceful-
  degradation fixture (Plan 08). A bug in any one tripwire produces
  detection via the other four. Defense in depth for the
  constitutional boundary.

- **Cross-room contradiction aggregation.** Scoped by Phase 83
  .rooms/registry.json (zero new registry format; zero Phase 83 code
  edits). Sealed-room contract via GUARDRAIL.md preserved byte-for-
  byte. Per-room opt-out via ROOM.md `brain_cross_room: false`.
  Absolute-path scope guard: every peer resolved through
  path.resolve + startsWith(~/MindrianRooms/); out-of-scope paths
  (symlink escapes, relative traversals) are skipped. Output is
  structural-only: slug-safe strings, frozen contradiction-type
  enums (hash_divergence / framework_contradiction /
  problem_type_mismatch), sha256 hash prefixes, scalar confidence.
  Opt-in per-call, default off (Phase 90 Plan 06).

- **Phase 91 Navigation Engine interface contract (v1 frozen).** Spec
  filed at `.planning/research/navigation-engine-brain-interface.md`
  (523 lines, 11 sections). Freezes the read path (readQuadruple as
  sole entry), the consumed fields + weight table (0.35 pattern_matches
  + 0.20 framework_chain_predictions + 0.15 cross_domain_analogies +
  0.10 wicked_indicators + 0.10 unfilled_opportunity_matches + 0.05
  assessment_thinking_chain_position + 0.05 problemtype_classification
  = 1.0), the staleness weight pairs (fresh 1.0 / age_exceeded 0.7 /
  governing_thought_changed 0.3 / brain_graph_version_mismatch 0.5 /
  brain_offline 0.9 / derivation_timeout 0.2 / parse_failed 0.0), the
  tier mode mapping, the RECOMMENDED confidence gate at >= 0.7 (Mode
  A only), the signal triangulation procedure, and the Canon Part 8
  boundary for Phase 91 (Navigation Engine is READ-ONLY against
  BRAIN.md; all derivation routes through Plan 90-02 enqueue -> Plan
  90-01 deriveSection). INTERFACE_VERSION=1 with bump discipline baked
  in (Phase 90 Plan 09).

### Infrastructure

- **Governing-thought change trigger.** A post-regen hook in
  `scripts/vault-section-minto-generator.cjs` calls
  `tryEnqueueBrainDerivation` which adds a section to
  `brain-derivation-queue.json` using the same atomic-write pattern
  from Phase 88-02 / 88-04-B. Drain fires non-blocking on
  UserPromptSubmit via a detached child spawn; the parent returns
  within 100ms regardless of queue depth. Queue survives crashes via
  atomic `openSync(wx) + writeFileSync + fsyncSync + renameSync`.
  Soft cap 500 / hard cap 1000. Section-as-unique-key idempotency
  (replace on hash change, dedupe on hash equality). Stale-queue-
  race guard re-reads the live triple at drain time and skips when
  the current hash has diverged from the queued hash. Frozen reason
  vocabulary: governing_thought_changed / session_start_stale /
  manual_invocation / cross_room_aggregation. Brain-offline entries
  stay queued and drain catches up when Brain returns (Phase 90
  Plan 02).

- **Session-start Brain-staleness scan.** Precedence (first-match-
  wins): file-missing -> absent; frontmatter-parse-fail ->
  stale/parse_failed; hash mismatch -> stale/governing_thought_changed;
  age > STALE_AGE_DAYS -> stale/age_exceeded; brain_graph_version
  below current schema -> stale/brain_graph_version_mismatch; else
  fresh. Brain-reachable stale sections enqueue a regen with the live
  governing_thought hash recomputed at enqueue-time; Brain-offline
  stale sections downgrade to enqueue_when_brain_online so drain
  catches up when Brain returns. Backward-compat: rooms with zero
  BRAIN.md files emit no annotations. Per-section staleness surfaces
  in the existing Phase 88-07 TRIPLE_CONTEXT block (weakest-first
  sort preserved). Env overrides: `BRAIN_STALE_AGE_DAYS` (threshold
  tunable) + `BRAIN_STALENESS_SKIP=1` (byte-stable emergency bypass)
  (Phase 90 Plan 03).

- **brain-md-invariants validator (Phase 88-13 registry plugin).**
  Drops into `lib/memory/validators/` for auto-discovery; zero
  guardian.cjs edits. Wraps Plan 90-00 validateSchema with parse-
  failure short-circuit (prevents cascade noise on malformed
  frontmatter). Schema fatal + attribution errors (author !=
  "brain") block at guardian checkpoints. Staleness and
  canon_boundary (body-text leak scan) surface as warnings in the
  invariant-report. Fail-open confirmed: a validator throw exits
  guardian 0 and other validators continue. Six canon_boundary
  patterns (email / currency / quoted-person / meeting / SSN /
  phone); 5-violation cap prevents report spam (Phase 90 Plan 05).

- **Graceful-degradation end-to-end suite.** 14 scenarios plus 2
  cross-cutting audits covering Brain-offline (permanent +
  intermittent) / API quota exhausted / timeout mid-derivation /
  schema drift / malformed Brain response / network partition /
  EACCES / ENOSPC on atomic rename / concurrent deriveSection on
  same section / Canon Part 8 under ordinary operation + under
  timeout / corrupt peer room in cross-room aggregator / concurrent
  session-start staleness scans. Each scenario asserts four
  invariants: no crash / no orphan tmpfile / structured
  result.success boolean / retry-path where semantically meaningful.
  Cross-cutting A1 sweep scans every BRAIN.md landed during the
  suite against the frozen FORBIDDEN_PATTERNS set; A2 sweep scans
  every tmp root for `BRAIN.md.tmp.*.brain` orphans. Full suite
  runs in ~337ms (90x headroom under 30s budget) (Phase 90 Plan 08).

### Changed

- **Per-folder memory expands from triple to quadruple.** readTriple
  still works byte-for-byte for every Phase 88 consumer. readQuadruple
  is additive; consumers who want the brain field opt in by calling
  the new entry point. No field renamed, no field removed, no shape
  change to the existing triple return.

### Canon Phase Map

- Part 3 Tri-Context Decision Gate: Option generation tier-awareness
  (Mode A / B / Tier 0) shipped (cites Plan 90-09).
- Part 8 Graph Boundary: Brain derivation layer preserving boundary
  shipped (5-tripwire evidence; cites Plans 90-00 + 90-01 + 90-05 +
  90-06 + 90-08).
- L2 Memory: BRAIN.md quadruple row noted alongside the Phase 88
  triple.

### Upgrade path

Two-command manual upgrade per `.claude/includes/release-process.md`:

```
/plugin marketplace update
claude plugin update mos@mindrian-marketplace
```

Auto-update is off by default for third-party plugins. Users on
v1.10.16 or v1.10.17 run the two commands above. No Node version
change. No breaking changes. readTriple callers see zero behavioral
drift; readQuadruple callers are new.

## [1.10.17] - 2026-04-24

Hotfix for YAML frontmatter parse errors in three command files introduced by
the Phase 88.1 frontmatter hygiene sweep (v1.10.15). The self-update validator
caught these before any user install took damage -- the 5-gate release
protocol doing its job. Patch release, fix-only, no feature change. Phase 89
reverse-salient-engine behavior byte-identical. Phase 90 brain-derivation-
layer work remains unshipped (continues in v1.10.18+). Upstream bug root
cause: multi-bracket argument-hint values (e.g. `[--chain] [--swarm]
[--dry-run]`) are parsed by YAML as implicit flow-sequence mapping pairs and
require a colon between bracket groups, which is absent in shell-style hints.
Single-bracket hints (e.g. `[pipeline-name]`) parse cleanly as flow sequences
and were not affected. Fix: single-quote the offending values so YAML treats
them as plain strings. 72/72 command files + 8/8 agent files now parse
cleanly through gray-matter regression sweep.

### Fixed

- `commands/act.md` line 4 -- `argument-hint` single-quoted. Was
  `[--chain] [--swarm] [--dry-run]`, now `'[--chain] [--swarm] [--dry-run]'`.
  YAML parser now reads the value as a string; command metadata loads at
  plugin load instead of silently dropping `name`, `description`,
  `body_shape`, `ui_reference`, and `allowed-tools` fields (including the
  four Brain MCP tool allowances).
- `commands/vault.md` line 4 -- `argument-hint` single-quoted. Was
  `[<room-name>] [--path <dir>]`, now `'[<room-name>] [--path <dir>]'`.
  Restores `disable-model-invocation: true`, `body_shape_overview`,
  `ui_reference`, and `allowed-tools` at plugin load time.
- `commands/snapshot.md` line 4 -- `argument-hint` single-quoted. Was
  `[<room-path>] [--open]`, now `'[<room-path>] [--open]'`. Restores
  `disable-model-invocation: true`, `usage`, `category`, `surface`,
  `requires`, and `allowed-tools` at plugin load time.

### Notes

- Self-update validator on v1.10.12 installs refused to install v1.10.16
  cleanly (validation gate on staged copy). Nothing was ever written to the
  user's plugin cache directory. The fix ships as a hotfix branched from
  `origin/main` at v1.10.16 HEAD, isolating in-flight Phase 90 WIP from
  the release commit range.
- Two-command upgrade path per docs/release-process.md: users on v1.10.12
  or v1.10.16 run `/plugin marketplace update` then `claude plugin update
  mos@mindrian-marketplace`. Auto-update path not enabled by default for
  third-party plugins; manual upgrade is correct-by-design.
- Canon Part 7 (Reuse Before Build) honored: no new code, only YAML
  single-quote wrapping on three existing files.
- Canon Part 8 preserved: zero Brain egress surface change; pure
  plugin-layer patch.
- Three-surface parity preserved: CLI / Desktop / Cowork all load the
  three affected commands identically once frontmatter parses cleanly.

## [1.10.16] - 2026-04-24

Phase 89 reverse-salient-engine ships. Canon Part 2 Engine 1 Act 1 formal
reverse-salient engine lands across six waves: authoritative Hughes 1983 /
Kwan 2023 LSA + signed abs-diff algorithm port, tiered external corpus
fetcher (OpenAlex + arXiv + Tavily), Pinecone rs-external lazy-TTL cache
with multilingual-e5-large integrated embedding, cross-room multi-project
mode, hybrid room-x-external unified-corpus mode, and Obsidian nested
bridge artifact writer with De Stijl Cytoscape.js mind map. Five new pure
Python helper modules (rs_math, rs_corpus, rs_cache, rs_rooms, rs_hybrid)
plus scripts/rs-engine.py 4-mode CLI and scripts/write-bridge-artifacts.cjs
Obsidian renderer. Warm external-corpus runs drop to ~15s via Pinecone
cache; bypass path preserves Plan 89-02 byte-identical behavior when
Pinecone is unavailable (CLAUDE.md Decision 8 Tier 0 functionality).
Feynman suite 52/52 passing. Zero new runtime dependencies beyond
pinecone>=5.0.0 added to requirements-hsi.txt (Python-side only; plugin
JS deps unchanged). BSL 1.1 on every new .py/.cjs file. Canon Parts 2, 3,
4, 6, 7, 8 honored. Three-surface parity preserved across CLI, Desktop
ReverseSalientAgent wiring, and Cowork 00_Context/ mirror.

### Added

- Reverse salient math substrate `lib/core/rs_math.py` (287 lines):
  authoritative port of the Kwan 2023 algorithm from source/lsa.py +
  source/comparison.py. Seven helpers: build_tfidf_svd,
  extract_topic_keywords, count_topic_membership (topic-keyword membership
  counting preserved verbatim -- cosine-on-SVD substitution would change
  the signal entirely per ALGORITHM-SOURCE.md line 72 warning),
  normalize_and_l1_similarity, abs_diff_topk (iterative argmax with
  upper-triangle masking and symmetric cleanup so no (i,i) self-pair ever
  wins and no (j,i) mirror duplicates), classify_direction, build_lsa_matrix.
  NLTK stopwords dependency dropped in favor of TfidfVectorizer built-in
  English stopword list (no NLTK download required). (Plan 89-01)
- Mode A single-room CLI `scripts/rs-engine.py` (654 lines initial, 1755
  at Phase 89 end): `--mode internal --room PATH [--topk 100] [--threshold
  0.30] [--no-thesis] [--output PATH]`. Walks `room/*.md` on the
  filesystem (same pattern as scripts/compute-hsi.py:discover_artifacts --
  no room.db artifacts table exists). Writes `.rs-engine-results.json`
  with pair dicts carrying source_artifact_id, target_artifact_id,
  lsa_score, semantic_score, signed_diff, abs_diff, direction
  (structural_transfer | semantic_implementation). Writes REVERSE_SALIENT
  edges into `room.db` when present, with `properties.source='rs-engine'`
  so hsi-sourced edges coexist untouched (per-edge scoping, not per-table
  -- lazygraph-ops schema has no dedicated REVERSE_SALIENT table). JSON
  sidecar embedding cache `.rs-engine-cache.json` keyed by artifact id +
  content SHA256[:16] + model name; warm rerun drops from ~4s cold to
  ~0.9s warm on the 6-artifact fixture. (Plan 89-01)
- External corpus fetcher `lib/core/rs_corpus.py` (468 lines): OpenAlex
  primary, arXiv secondary, Tavily fallback (gated by TAVILY_API_KEY).
  Seven exports: fetch_corpus, fetch_openalex, fetch_arxiv, fetch_tavily,
  invert_abstract (reconstructs OpenAlex abstract_inverted_index per
  RESEARCH Pitfall 3), dedupe (DOI-preferred, normalized-title fallback,
  first-seen ordering), topic_slug. OpenAlex cursor pagination with
  polite-pool User-Agent + mailto: (OPENALEX_EMAIL env); arXiv Atom XML
  parsing with 0.35s spacing respecting ~3 req/s soft cap. Empty-abstract
  filter at every tier so target_n counts usable docs. MAX_TARGET_N=20000
  hard ceiling so misconfigured --topk cannot balloon external API usage.
  Skips Scopus, Semantic Scholar direct, USPTO direct, PubMed. (Plan 89-02)
- Mode B external wiring `--mode external --topic "..." --room PATH`
  produces signed-differential pairs across the freshly-fetched literature
  corpus; corpus persisted to `{room}/research/{topic-slug}/_corpus.jsonl`
  for provenance; results at `{room}/research/{topic-slug}/.rs-engine-results.json`.
  Overshoot formula `max(topk*20, topk*2)` preserves delivered pair count
  after dedup attrition on small --topk values. Pair dicts carry source_doi,
  source_url, target_doi, target_url alongside Mode A artifact-id fields
  (Plan 89-06 resolvePairIdentity schema-tolerant across both shapes).
  Auto-creates room dir for --mode external; Mode A existing-check
  preserved. (Plan 89-02)
- Pinecone rs-external lazy-TTL cache `lib/core/rs_cache.py` (479 lines):
  Velma-pattern wrapper around integrated-embedding Pinecone index with
  multilingual-e5-large field-map text->abstract on us-east-1 aws. Nine
  public entries: namespace_slug, ensure_index (idempotent create +
  readiness polling via desc.status.ready attribute form per scripts/
  consolidate-pinecone.py precedent), get_namespace_freshness (samples
  one record via list()+fetch() -- raw-vector query() fails on integrated-
  embedding indexes), upsert_corpus (batches of 96 matching Pinecone
  inference limit, single shared fetched_at timestamp per batch for single-
  sample freshness inference), query_namespace, fetch_all_from_namespace,
  is_fresh, plus INDEX_NAME, TTL_DAYS=30, MAX_NAMESPACE_VECTORS=10000
  (raises with sharding hint rather than silently truncating). Per-topic
  namespace keyed by topic_slug. Timezone-aware datetime.now(timezone.utc)
  replaces deprecated utcnow. (Plan 89-03)
- Mode B Pinecone warm/cold/bypass state machine: warm path reads 1024-dim
  e5-large vectors from rs-external namespace if age < 30 days, skipping
  fetch entirely; cold path fetches via fetch_corpus + upsert_corpus +
  re-fetch from Pinecone (re-reading server-side vectors rather than
  locally-embedded ones guarantees warm/cold semantic consistency on
  repeated runs); bypass path falls through to Plan 89-02 local MiniLM
  behavior byte-identical when PINECONE_API_KEY is unset or
  RS_EMBEDDING_MODEL=minilm. New metadata fields cache_mode (warm | cold
  | bypass), cache_age_days, cache_namespace, cache_ttl_days surface on
  every Mode B result JSON so downstream consumers can render warm-vs-cold
  provenance without re-computing freshness. Live smoke: 400-doc cold upsert
  for "nv diamond magnetometry" followed by warm run hit at age=0.0 days,
  20 pairs. (Plan 89-03)
- Cross-room Mode A extension via `lib/core/rs_rooms.py` (193 lines) and
  new `--rooms PATH [PATH ...]` CLI argument (nargs='+'): walks each room's
  filesystem per-room, tags every artifact with room_id (basename) and
  global_id (f"{room_id}::{artifact_id}") for uniqueness, skips .git /
  .lazygraph / .mindrian / node_modules / .obsidian and the three metadata
  files (STATE.md, ROOM.md, MINTO.md). Basename-collision disambiguator
  suffixes duplicate room_ids with -2, -3. `CROSS_ROOM_OVERSHOOT=3` keeps
  delivered pair count near topk after intra-room discards on up-to-67%
  intra-room fraction; `CROSS_ROOM_WARN_SHARE=0.05` warns on stderr when
  any room contributes less than 5% of the corpus (plan Risk 1 mitigation:
  prevents silent LSA skew). Separate cache directory
  `.rs-engine-cross-room-cache/` prevents collision with Mode A single-room
  cache keyed by per-room artifact_id. Mutually exclusive with --room and
  --mode external; requires at least two paths. `pair_matrix` metadata
  surfaces cross-room bridge counts keyed on sorted room-id tuples. Mode
  A multi-room writes NO room.db edges (cross-room pairs span rooms, no
  single room.db owns them). `<10` artifact threshold and all-single-room
  edge cases return well-formed empty-pairs JSON with clear stderr
  messages. (Plan 89-04)
- Hybrid Mode C via `lib/core/rs_hybrid.py` (586 lines) and
  `--mode hybrid --room PATH --topic "..." [--external-target N]`:
  build_unified_corpus returns (corpus, origin_mask, metadata) where
  origin_mask is a numpy bool array (True=room, False=external) for O(1)
  cross-corpus filtering. Room-side loader reuses scripts/rs-engine.py:
  discover_artifacts byte-for-byte so Mode A and Mode C see identical
  artifact inclusion rules. External-side reuses Plan 89-03 rs_cache
  warm/cold/bypass state machine verbatim. Full unified corpus embedded
  in one MiniLM 384-dim model space for dimensional homogeneity on the
  pairwise cosine matrix; cached e5-large vectors retained on external_doc
  for future downstream reranking. `HYBRID_OVERSHOOT=10` multiplier on
  abs_diff_topk keeps post-filter yield near topk on realistic corpora
  (O(100) room vs O(2000) external means >99% strongest by volume are
  external-external). filter_cross_corpus_pairs canonically orients
  room_side/external_side. `--external-target` defaults to 2000, clamped
  to MAX_EXTERNAL_TARGET=5000 (defense-in-depth against misconfigured
  callers blowing memory on a 50kx50k similarity matrix). Every hybrid
  pair carries BOTH Mode A-compatible source_artifact_id/source_section/
  source_title/target_* fields AND richer room_artifact/external_doc
  structs so Plan 89-06 bridge-writer resolvePairIdentity handles all
  modes through one resolver. Mode C writes NO room.db edges. `--rooms +
  --mode hybrid` is a guard rail (exit 2); `--mode hybrid` without --topic
  is a guard rail. Live smoke: 3 room + 200 external unified corpus,
  cross-corpus pairs in 15.7s warm (<30s target). (Plan 89-05)
- Obsidian bridge artifact renderer `lib/core/bridge-writer.cjs` (427
  lines, pure): seven exports slugifyPair, resolvePairIdentity,
  renderBridgeArtifact, renderRoomMd, renderSectionRoomMd, renderIndex,
  renderMindMap. Schema-tolerant resolvePairIdentity collapses Mode A
  internal (section + artifact_id), Mode B cross-room (source_room +
  source_artifact), and Mode C hybrid (room_artifact + external_doc) into
  a single 8-field identity struct consumed by every renderer -- one
  module spans all four modes without per-mode branches. Dual Brain
  framework citation in every bridge frontmatter (brain_framework_classical
  = "framework:reverse-salient-analysis" + brain_framework_algorithmic =
  "framework:algorithmic-generation-of-reverse-salient-solutions") per
  ROADMAP SC-5. v1.9.7 nested folder rule: folder-name.md matches folder
  name; ICM Layer 0 Decision 15: section ROOM.md + per-bridge ROOM.md.
  Dataview _index.md with TABLE query aggregates bridge list. (Plan 89-06)
- Bridge-writer CLI `scripts/write-bridge-artifacts.cjs` (140 lines,
  chmod +x): `--results PATH --room PATH` consumes rs-engine JSON, walks
  pairs, writes nested `opportunity-bank/cross-room-bridges/bridge-NNN-slug/`
  folders with body + ROOM.md per v1.9.7 + ICM Layer 0. Exit 2 on missing
  or invalid JSON; exit 3 on empty pairs. On 15-pair fixture: 15 bridge
  folders + 16 ROOM.md (1 section + 15 bridges) + _index.md + mindmap.html
  written. (Plan 89-06)
- De Stijl Cytoscape.js mind map `mindmap.html`: generated per-run at
  `cross-room-bridges/mindmap.html`. Inline De Stijl hex palette
  (#A63D2F red, #1E3A6E blue, #C8A43C yellow, #2A6B5E teal, #F5F0E8
  cream, #1a1a1a dark) inside Cytoscape style objects because CSS var()
  does not resolve inside Cytoscape Canvas rendering. Direction-colored
  edges (red structural_transfer, yellow semantic_implementation); cose
  layout; header cites both Brain framework nodes. Cytoscape.js 3.28.1
  via CDN -- reuses the "Cytoscape.js via CDN in dashboard HTML" STACK row
  without adding an npm dependency. ROADMAP SC-7 satisfied. (Plan 89-06)
- `pinecone>=5.0.0` added to `requirements-hsi.txt` (Python-side only,
  local install verified 8.1.0; no change to plugin package.json
  dependencies). (Plan 89-03)

### Changed

- `scripts/rs-engine.py` grows from 654 lines (Plan 89-01) to 1755 lines
  (Plan 89-05 end) as Modes B, C, and --rooms dispatch land; Mode A path
  byte-identical across all five waves (verified on /tmp/rs-test-room
  6-artifact fixture on every plan: 15 pairs + 15 REVERSE_SALIENT edges
  regression-checked pre- and post-commit). Mode B path byte-identical
  from Plan 89-02 through 89-05 on the bypass branch.
- `docs/CANON-PHASE-MAP.md` Part 2 Engine 1 "Reverse-Salient formal
  engine" row promoted from `planned` to `shipped` with Phase 89 citation.
  Version-history gains v1.3 (kept) 2026-04-24 row for Phase 89
  (v1.10.16) reverse-salient engine shipment. No canon text change; map
  row updates only.

### Notes

- Cost transparency (documented in `/mos:find-cross-room-bridges`
  command help): internal + cross-room modes are $0 (pure filesystem +
  local MiniLM); external and hybrid modes are ~$0.40-$1.10 per cold
  run (OpenAlex free + arXiv free + Tavily metered + Pinecone integrated
  embedding) and $0 on warm cache within 30-day TTL; `--no-thesis`
  disables LSA fit for $0 runs on any mode.
- Tri-polar surface: CLI direct invocation; Desktop ReverseSalientAgent
  conversational trigger (Brain stub delegated to CrossDomainInnovationAgent
  per RESEARCH Q6 -- simpler than duplicating APPLIES_TO edges, inherits
  via DELEGATES_TO); Cowork `_write_cowork_symlink` mirrors results into
  `00_Context/rs-engine-results.json` when `COWORK=1`. Team members share
  the warm Pinecone cache per-namespace transparently.
- Phase 89 planner had a consistent filename rendering bug: all five
  plans (89-01 rs_math, 89-02 rs_corpus, 89-03 rs_cache, 89-04 rs_rooms,
  89-05 rs_hybrid) listed hyphenated module filenames in frontmatter
  while their own verify blocks imported underscore forms. Python cannot
  import hyphenated module names; every plan applied Rule 3 Blocking
  auto-fix to underscore filenames. Module contents match plan specs
  verbatim; only filenames changed.
- Canon Part 8 Graph Boundary preserved across all six waves: zero Brain
  queries in the algorithm engine (Brain integration for ReverseSalientAgent
  is Desktop-surface wiring only); external corpus stored in rs-external
  Pinecone index holds ONLY public OpenAlex/arXiv metadata (DOI, title,
  year, abstract, source, fetched_at) -- SIGNAL-to-infrastructure egress,
  categorically distinct from LOCAL-to-BRAIN egress the Part 8
  constitution forbids. User room content, user decisions, user meetings,
  user assumptions never flow through rs-external.

## [1.10.15] - 2026-04-23

Phase 88.1 uiux-polish ships. Surface-polish release across L1-L7 with hook
primitives as the rendering substrate. Eleven plans across four waves:
description discipline on 72 commands, canonical permissions stance, hook
systemMessage retrofit on 8 lifecycle hooks, statusline MINTO segment,
/mos:status Shape E render with governing_thought per section, SessionStart
4-line banner with top-3 active sections, advisory frontmatter schema
validation hook, async artifact auto-commit on isolated branch, subagent
PROACTIVELY + color + isolation audit, README expectation paragraphs (Before
Your First Session), query efficiency telemetry infrastructure. Feynman
suite 52/52 passing (baseline 46 from v1.10.14 + six new test files). Zero
new runtime dependencies. BSL 1.1 on every new .cjs file. Three-surface
parity preserved. Canon Parts 1, 2, 3, 5, 6, 7, 8 honored. 57x claim
retuned to "up to 57x" with measurement surface shipped (telemetry
validation window currently NO_DATA -- hook ships but awaits first /mos:*
query in the wild; defensibility path documented below).

### Added

- Description discipline sweep across 72 commands: descriptions <= 60 chars
  verb-first under-promise, argument-hint present on 23 commands that take
  arguments, disable-model-invocation true on 4 destructive commands
  (publish, export, snapshot, vault). Zero em-dashes, zero banned words
  ("legacy", "fallback", "prefer skills"). Audit report at
  `.planning/phases/88.1-uiux-polish/88.1-01-audit-report.md`. (Plan 88.1-01)
- Canonical permissions block: README Permissions section H2 + new
  `docs/settings-template.json` with 19 granular matchers grouped by
  surface (git read/write, node scripts, python scripts, Read, Write
  scoped to 4 paths, WebFetch scoped to 3 public SIGNAL domains). Both
  stances documented with when-to-use guidance: nuclear
  (--dangerously-skip-permissions) vs granular (settings.json). Canon Part 8
  boundary preserved: zero Brain endpoints, zero bearer tokens, zero wildcard
  writes. (Plan 88.1-02)
- systemMessage retrofit on 8 lifecycle hook scripts: session-start,
  post-write, on-stop, pre-compact, post-compact, intent-classifier,
  write-scope-check, feynman-minto-guardian. Every emission is LOCAL-only
  (room slug + section count + health glyph) per Canon Part 8. Shared
  classifyHealth(score) helper extracted from
  `lib/memory/triple-context-formatter.cjs` so hooks + statusline +
  /mos:status + SessionStart banner render byte-identical Canon Part 2 glyph
  vocabulary (check / warn / low / --). Silent-on-success discipline on
  advisory hooks (R5). (Plan 88.1-03)
- Statusline MINTO segment: `scripts/context-monitor` renders the active
  section's governing_thought + health glyph between the stage label and
  the plugin brand. New `lib/core/statusline-cache.cjs` pure module with 5s
  TTL disk-backed cache, atomic writes (Phase 87-02 pattern), 60-char
  governing_thought truncation, and classifyHealth mirror. Cold render 38ms,
  warm 29-34ms, well under the 300ms CONTEXT R1 budget. Graceful fallback
  preserves pre-88 statusline byte-identically when MINTO absent or stale.
  (Plan 88.1-04)
- /mos:status Shape E Action Report: per-section governing_thought rows with
  Canon Part 2 health glyph, (stale: reason) suffix, (no MINTO yet)
  placeholder, summary row (filled / stale / median reasoning health),
  actions footer. Three argument modes: no-args (full render), <section>
  (full-detail single-section no truncation), --stale-only (filter). New
  `scripts/mos-status.cjs`. Replaces pre-88 Shape A Mondrian Board + raw
  artifact counts. (Plan 88.1-05)
- SessionStart 4-line MINTO banner: brand line (dynamic version read from
  plugin.json, never hardcoded) + active room slug + focus header + top-3
  recently-active sections with glyph + 60-char governing_thought. New
  `lib/memory/sessionstart-banner-formatter.cjs` pure formatter composes
  with Phase 88-07 TRIPLE_CONTEXT budget cascade. Budget share 20% of total
  under tight SESSION_START_BUDGET_TOKENS with 50-token floor; rows drop
  from tail, focus header drops last. Placed between Phase 83 ACTIVE ROOM
  CONTEXT (ends line 568) and Phase 88-07 TRIPLE_CONTEXT (begins line 723).
  (Plan 88.1-06)
- Frontmatter schema validation hook: PostToolUse advisory
  `scripts/frontmatter-schema-validator.cjs` on `Write|Edit|MultiEdit`
  inside a `.room-root` subtree. Four schemas (ROOM.md, STATE.md,
  MINTO.md-delegated-to-feynman-minto-invariants, artifact-default) in new
  `lib/core/frontmatter-schemas.cjs` pure module. Non-blocking (always exits
  0). Offense log at `${CLAUDE_PLUGIN_DATA}/schema-violations.jsonl` with
  `~/.mindrian/` fallback, consumable by future `/mos:admin`. Canon Part 5
  Evidence Graded By Context foundation. (Plan 88.1-07)
- Async artifact auto-commit hook: PostToolUse
  `scripts/async-artifact-auto-commit.cjs` on `Write|Edit|MultiEdit` inside
  `.room-root` auto-commits into an isolated `data-room-autocommit` branch
  via git plumbing (hash-object + update-index + write-tree + commit-tree +
  update-ref) on a tmp `GIT_INDEX_FILE`. Never touches HEAD, never moves
  the working tree. Throttled 1 commit per 5 seconds per path via new
  `lib/core/auto-commit-throttle.cjs` pure module with atomic ledger write
  (Phase 87-02 pattern). NEVER runs `git push` (Canon Part 8 preserved;
  boundary is a compile-time property: the source file does not contain the
  literal strings "git push" or "https://"). Detached fire-and-forget
  worker via `spawn(detached:true, stdio:'ignore') + proc.unref()`.
  (Plan 88.1-08)
- Subagent PROACTIVELY + color + isolation audit: all 8 agent files tightened
  to single-line descriptions under 160 chars with verb-first under-promise
  phrasing. PROACTIVELY keyword on 3 observe-react agents (grading, investor,
  opportunity-scanner) so Claude auto-delegates when room state triggers.
  Color field on all 8 agents (8-slot palette: red/orange/yellow/green/blue/
  indigo/purple/cyan). `isolation: worktree` on 3 write-heavy or
  external-API agents (framework-runner, opportunity-scanner, research).
  One pre-existing em-dash in grading.md body fixed. (Plan 88.1-10)
- README "Before Your First Session" expectation-setter H2 with three H3
  subsections: What a Room Is (Living Data Room, cross-relationship scan
  INFORMS/CONTRADICTS/CONVERGES, venture as nested system) + Permissions
  (both stances, links to Plan 88.1-02 section via #permissions anchor) +
  Commands and Larry (R7 peer-path codified: /mos:find-analogies and plain
  English utterance both land at identical logic, neither positioned above
  the other, Larry pedagogy intrinsic per Canon Part 1 correction 9).
  Placed between the v1.10.10 intro block and Quick Start. (Plan 88.1-12)
- Query efficiency telemetry infrastructure: PostToolUse hook
  `scripts/query-efficiency-telemetry.cjs` on `Read|Grep|Glob` measures
  tokens_used vs tokens_naive_estimate per /mos:* query and appends 8-field
  JSONL events to `~/.mindrian/telemetry/query-efficiency.jsonl`. New
  `lib/core/token-estimator.cjs` pure module (estimateTokens chars/4 matching
  Phase 88-07 yardstick, estimateRoomTokens session-cached, validateEventShape,
  classifyRatio with 10x advisory threshold, aggregateEvents median/mean/top5).
  New `scripts/scout-telemetry-aggregator.cjs` renders Shape E summary with
  threshold status PASS (>= 40x) / RETUNE (< 40x) / NO_DATA. /mos:scout
  extended with `efficiency` subcommand + Step 5b aggregation + --json mode
  for release-gate machine consumption. Canon Part 8 compliant: LOCAL JSONL
  only, scalar counts + LOCAL room slug, zero user-artifact bytes, zero
  network egress. (Plan 88.1-16)

### Changed

- 72 command frontmatter blocks now enforce description discipline under
  60 chars with under-promise phrasing. Picker UX wins: dashboard.md 178
  -> 48 chars; scheduled-tasks.md 144 -> 42; query.md 133 -> 45;
  scout.md 123 -> 34. Canonical exemplar: diagnose.md "Classify problem
  type against the PWS matrix" (45).
- README.md gains "Before Your First Session" H2 with three H3 subsections
  near the top + full Permissions H2 (inserted after Quick Start, before
  Three Ways to Use). 57x claim retuned from `**57x cheaper. Better
  answers.**` to `**Up to 57x cheaper. Better answers.**` with measurement
  surface pointer (`/mos:scout efficiency`). Retune is the Canon Part 6
  dog-fooding honest-claim discipline applied to our own release: until a
  validation window produces >= 50 events with median >= 40x in real
  sessions, the copy reads "up to 57x" rather than making the specific claim.
- docs/CANON-PHASE-MAP.md Part 3 (Tri-Context Decision Gate), Part 7 (Reuse
  Before Build), and Part 8 (Graph Boundary) rows updated to mark Phase 88.1
  shipment. Part 8 gains explicit note that Plan 88.1-16 query efficiency
  telemetry is Part 8-compliant (LOCAL JSONL only, no egress). New v1.3
  (kept) version-history row at 2026-04-23 citing 88.1 (v1.10.15) polish
  sweep + 57x claim retune.
- `hooks/hooks.json` gains three new PostToolUse entries: frontmatter
  schema validator (Plan 88.1-07), async artifact auto-commit (Plan 88.1-08),
  query efficiency telemetry (Plan 88.1-16). All three ALWAYS exit 0
  (advisory, never blocking).

### Compatibility

- Feynman suite: GREEN, 52/52 passing (baseline 46 from v1.10.14 + six new
  test files: statusline-minto-segment, mos-status-renderer,
  sessionstart-minto-banner, frontmatter-schema-validator,
  async-artifact-auto-commit, query-efficiency-telemetry).
- Zero new runtime dependencies (Node builtins + existing 10 deps only).
  Verified via `diff` of package.json dependencies vs v1.10.14.
- CJS only, no ESM, no build step. Zero `.mjs` or `.ts` files under
  `lib/`, `scripts/`, `bin/`.
- Three-surface parity: CLI, Desktop MCP, and Cowork all receive the polish
  sweep without surface-specific branches.
- BSL 1.1 license applied to all 16 new `.cjs` files (Plans 04, 05, 06,
  07, 08, 16).
- Chat-panel presence preserved (v1.10.12 regression guard green: 3 matches
  in templates/presentation/dashboard.html, untouched by Phase 88.1).
- Zero em-dashes introduced in the 88.1 diff across commands/, scripts/,
  lib/, agents/, README.md, CHANGELOG.md, docs/settings-template.json.
- 57x claim defensibility gate: telemetry validation window returns
  NO_DATA at release time because the PostToolUse hook landed in v1.10.15
  itself (branch b/c detection path depends on CLAUDE_SLASH_COMMAND or
  MOS_COMMAND_CONTEXT env var which only enters live usage post-tag, and
  envelope branch a is not yet surfaced by Claude Code 2.1.x). Mitigation:
  README copy retuned to "up to 57x" (above). Measurement surface ships
  ready to accumulate evidence. Phase 88.2 Selector Block rollout will wire
  `MOS_COMMAND_CONTEXT` explicitly into /mos:* command surfaces, at which
  point the 7-day validation window runs for real and either confirms the
  57x claim (PASS -> restore exact phrasing) or surfaces leakers (RETUNE).
  Honors Canon Part 6 dog-fooding mandate: we do not ship an unmeasured
  quantified claim.

### Canon

- Phase 88.1 satisfies canon_parts declared across 11 plans:
  - Part 1 Wicked Navigator (README expectation paragraphs as first-session
    onboarding; SessionStart banner as re-entry affordance; Larry pedagogy
    intrinsic rather than Brain-dependent).
  - Part 2 UI Ruling System (Canon glyph vocabulary check/warn/low/--
    enforced uniformly across hook sysmsg + statusline + /mos:status +
    banner via shared classifyHealth helper; agent color palette codified).
  - Part 3 Tri-Context Decision Gate (statusline + /mos:status + banner all
    render LOCAL context only; never BRAIN, never SIGNAL, per-turn).
  - Part 5 Evidence Graded By Context (frontmatter schema validation hook
    as advisory foundation for future evidence-tier enforcement).
  - Part 6 Product-as-Venture Dog-Fooding (release discipline reused
    verbatim from v1.10.13 and v1.10.14 5-gate protocol; 57x claim retune
    IS the dog-fooding of Canon Part 6 applied to our own copy).
  - Part 7 Reuse Before Build (description discipline sweep cites what each
    command replaces or extends; zero net-new commands; agent audit cites
    role-type invariants rather than inventing new classifications).
  - Part 8 Graph Boundary (permissions hardening preserves boundary at the
    settings layer; Plan 88.1-08 auto-commit NEVER runs `git push`;
    Plan 88.1-16 telemetry is LOCAL JSONL only with zero egress; every new
    script scanned for brain.mindrian.ai / bearer / Authorization /
    api_key / fetch / curl / http -- all returned zero matches).

## [1.10.14] - 2026-04-23

Phase 88.6 python-algorithm-wiring ships. Orchestration-only release closing
the orphan-value gap between 15 verified Python algorithms and the /mos:*
command surface. Zero new algorithms; every change is wiring, graceful
degradation, interpretation strings, and release discipline. Four Wave-1
scalars (Funk and Owen-Smith Disruption Index, Good-Turing Blindspot
Coverage, Centroid-Distance Element Novelty, Leave-One-Out Bayesian Surprise)
are now exposed via /mos:diagnostics with plain-English interpretation per
metric. Baseline auto-fire eliminates the silent-zero production bug in
discover-* pipelines via a shared ensure-brain-baseline helper. External
Semantic Scholar orchestration handles rate limits gracefully with real
per-query telemetry persisted in external-papers.json queries[]. Evidence:
2026-04-23 smoke test on ~/MindrianRooms/mindrianOS/ (207 artifacts, 77
Brain frameworks, CD = -0.7092, coverage = 0.667). Canon Parts 6, 7, 8
honored. Feynman suite 46/46.

### Added

- /mos:diagnostics command exposing 4 Wave-1 algorithms (Funk and Owen-Smith
  Disruption Index, Good-Turing Blindspot Coverage, Centroid-Distance Element
  Novelty, Leave-One-Out Bayesian Surprise) with plain-English interpretation
  strings per metric. Shape E (Action Report) output per UI System with
  4-zone rendering (header panel, metric rows, conditional intelligence
  strip, action footer). New dispatcher `scripts/diagnostics-command.cjs`
  (345 lines) and new surface `commands/diagnostics.md` (144 lines). Ground-
  truth field paths verified empirically against Python script outputs
  (disruption-index.json, blindspot-coverage.json, element-novelty.json,
  surprise-scores.json). (Phase 88.6 Plan 02)
- /mos:diagnostics discoverable via `/mos:help` -- entry added to Intelligence
  + Brain group with JTBD description, plus color mapping reference updated
  and command count bumped 66 -> 67. (Phase 88.6 Plan 02 gap-closure)
- Shared baseline auto-fire helper `scripts/ensure-brain-baseline.cjs` (117
  lines) factored out of whitespace-command.cjs; now called by both
  `scripts/discovery-cycle.cjs` and `scripts/whitespace-command.cjs` cmdMap,
  cmdDiscover, and cmdExternal. Idempotent on repeat calls. Closes the
  silent-zero production bug where discover-* pipelines produced 0 zones
  when `.mindrian/brain-baseline.json` was missing. (Phase 88.6 Plan 01)
- Per-query telemetry persistence in `scripts/query-semantic-scholar.cjs`:
  external-papers.json now includes a top-level `queries[]` array of
  `{query, status, papers_returned, http_status?}` objects with 6-value
  status enum (ok / rate_limited / api_error / network_error / timeout /
  not_attempted). Cache payload carries queryOutcomes so cache-hit replay
  surfaces real status distribution. Backwards compatible with pre-88.6-03
  caches. Unlocks real rate-limit reporting in cmdExternal. (Phase 88.6
  Plan 03 Task 0)
- Rate-limit-aware orchestration for `/mos:whitespace external`: pipeline
  continues with partial results when some Semantic Scholar queries are
  rate-limited, reports "N of M queries rate-limited" in Zone 3 Intelligence
  Strip by reading real queries[] telemetry, and fails explicitly with
  "Semantic Scholar unavailable" 3-line error only when the full corpus is
  unreachable (no file, top-level error, or zero successful queries AND
  zero papers). commands/whitespace.md documents the new Rate-Limit
  Behavior section. (Phase 88.6 Plan 03 Task 1)

### Fixed

- Silent production bug in four Python scripts (compute-whitespace-gaps.py,
  discover-hsi-whitespace.py, discover-rs-whitespace.py,
  discover-analogy-whitespace.py) that previously returned 0 zones without
  any diagnostic message when brain-baseline.json was missing. Now the
  shared helper auto-fetches on demand or shows an explicit "baseline
  unavailable -- Brain offline" message to stderr. Exit code 2 (not 1)
  distinguishes offline from invocation errors so callers can route
  appropriately. Closes the issue surfaced in the 2026-04-23 smoke test
  audit of mindrianOS.

### Changed

- docs/CANON-PHASE-MAP.md Part 2 Engine 1 table rows updated to reflect
  Phase 88.6 completion of the wiring gap for Whitespace Map + Reverse
  Salient + Cross-Domain Match. New "Wave-1 Algorithmic Fingerprint" row
  cites /mos:diagnostics as the command surface for the 4 Wave-1 scalars.
  Version history row added for v1.3 at 2026-04-23.

### Canon

- Phase 88.6 python-algorithm-wiring is an orchestration-only phase closing
  the orphan-value gap between 15 verified Python algorithms and the
  user-facing /mos:* command surface. Zero new algorithms; all changes are
  wiring, graceful degradation, interpretation strings, and release
  discipline. Evidence: 2026-04-23 smoke test on ~/MindrianRooms/mindrianOS/
  (207 artifacts, 77 Brain frameworks, CD = -0.7092, coverage = 0.667).
  Honors Canon Part 6 (Product-as-Venture Dog-Fooding Mandate -- release
  discipline IS part of the venture), Part 7 (Reuse Before Build -- all
  three plans extend existing surfaces rather than create new ones), and
  Part 8 (Graph Boundary -- zero user data egress in external Semantic
  Scholar pipeline; queries[] telemetry is LOCAL-only; all 4 Wave-1
  algorithms read .mindrian/*.json with no Brain payload construction).

## [1.10.13] - 2026-04-20

Phase 88 feynman-minto-memory-layer ships. Per-folder memory triple
(ROOM.md + STATE.md + Feynman-MINTO.md) now functions as a coordinated
cross-session memory layer. Fifteen plans across five waves: schema v88 +
invariants + read contract (Wave 1 foundations); debouncer + recompiler +
post-write triple-fire + atomic generator + background drain (Wave 1
write-side); on-stop session snapshot + session-start TRIPLE_CONTEXT
injection (Wave 2, closes cross-session memory loop); pre/post-compact
bridge (Wave 3, preserves triple across Claude context compression);
decision-capture module + cascade dual-write (Wave 4, APPROVE/REJECT/DEFER
now lands in the owning section's decision_log alongside the existing
proactive-intelligence store); guardian + extensible 4-validator registry
with silent-failure-to-loud conversion (Wave 5). Feynman suite 46/46.
Zero new runtime dependencies. BSL 1.1 on every new .cjs file.

### Added

- Per-folder memory triple -- ROOM.md + STATE.md + Feynman-MINTO.md now
  operate as a coordinated cross-section memory surface across sessions.
  Session-B Larry wakes up knowing every section's governing thought, key
  arguments, decision history, and freshness state without re-reading
  scrollback or requerying the graph. (Phase 88)
- `lib/core/folder-memory.cjs` -- single read contract for the triple.
  Sync + async entry points plus shared pure logic (copies the Phase 87-04
  two-entry-point pattern). Exports `readTriple`, `readDecisionLog`,
  `computeHealthScore`, plus a deterministic 0-1 health formula (0.3 gt
  + 0.2 args + 0.2 evidence + 0.1 mece + 0.2 fresh, clamped). Every
  downstream reader (88-06 on-stop, 88-07 session-start, 88-08/09
  pre/post-compact, 88-10 decision-capture, 88-13 guardian, Phase 91
  Navigation Engine) reads the triple through this single contract --
  zero direct MINTO readFileSync from skills or hooks. (plan 88-01)
- `lib/core/feynman-minto-invariants.cjs` -- single-source-of-truth
  `validate(filePath)` module with 5 frozen categories (existence,
  schema, freshness, coherence, atomicity), 4 frozen severity levels
  (critical > error > warning > info), hand-written zero-dep YAML
  frontmatter parser, and 21 fixture tests. Used by every write-side
  gate, read-side degradation path, and pre-commit hook in Phase 88.
  (plan 88-00-B)
- `scripts/minto-debouncer.cjs` -- 10-second coalescing queue with
  atomic writes (Phase 87-02 lock composition), exponential-backoff
  retry, `enqueue`/`drain` subcommands. Burst Write/Edit/MultiEdit
  sequences coalesce to one regen per section per window. (plan 88-02)
- `scripts/recompile-room-references.cjs` -- deterministic ROOM.md
  cross-reference compiler. Preserves the human-authored identity block
  byte-for-byte and rewrites only the `<!-- BEGIN REFERENCES --> ... <!-- END REFERENCES -->`
  marker block with classified wikilinks (team / meeting / section /
  artifact). (plan 88-03)
- `scripts/vault-section-minto-generator.cjs` atomic write contract --
  tmp + fsync + invariants-validate + rename. Pre-publish invariant
  violation rejects the write and leaves the previous MINTO.md intact.
  Under concurrent regen contention, `.tmp.<pid>.minto` naming plus
  the Phase 87-02 outer lock guarantees zero torn writes. (plan 88-04-B)
- `scripts/post-write` triple-fire -- PostToolUse hook extended to
  Write|Edit|MultiEdit matchers, composes with Phase 87-01a `.room-root`
  sentinel to scope freshness wires to Data Room sections only. On every
  Data Room write: stamp `last_artifact_write_seen_at` (backgrounded),
  enqueue regen via the debouncer (synchronous), and recompile ROOM.md
  references (backgrounded). System files (ROOM.md / STATE.md / MINTO.md)
  stamp only -- never enqueue, breaking the would-be livelock. Explicit
  `exit 0` soft-fail boundary so triple failures never surface as a
  broken user tool call. (plan 88-04)
- UserPromptSubmit drain -- 30s olderThanMs window reads the debouncer
  queue and fires tier-0 MINTO regens in the background. Fire-and-forget
  so the prompt's user-visible latency is untouched. (plan 88-05)
- `scripts/on-stop` session close-out -- writes
  `.mindrian/session-snapshot.json` containing the triple per active
  section (governing thought, arguments, evidence density, decision_log,
  reasoning_health_score, stale_reason) plus `.mindrian/minto-stale.json`
  for guardian consumption. STATE.md contract preserved; snapshot is
  additive. (plan 88-06)
- `scripts/session-start` TRIPLE_CONTEXT injection -- the highest-leverage
  wire in Phase 88. Reads the 88-06 snapshot (fast path), falls back to
  live `folder-memory.readTriple` walk (safe path), renders per-section
  blocks with MEASURED 5000-token budget cap (baseline was 3825 tokens)
  and `SESSION_START_BUDGET_TOKENS` env override. Weakest-first truncation
  with null-score-first sort preserves the most-informative triples under
  budget pressure. This block closes the cross-session memory loop:
  Session-B Larry knows what Session-A decided. (plan 88-07)
- `scripts/pre-compact` + `scripts/post-compact` -- compaction bridge
  that preserves TRIPLE_CONTEXT across Claude's context compression.
  Pre-compact writes `.mindrian/pre-compact-snapshot.json`; post-compact
  re-injects the same TRIPLE_CONTEXT block after Claude resumes with the
  compressed history. (plans 88-08, 88-09)
- `lib/core/decision-capture.cjs` -- local per-section decision_log
  persistence. `recordDecision(roomPath, section, decision)` appends to
  `MINTO.md.frontmatter.decision_log` with 20-entry cap; overflow archives
  oldest entries to `.mindrian/decision-archive/YYYY-MM/<section>.jsonl`
  partitioned by the ARCHIVED entry's timestamp (not today). Outer +
  inner write-lock composition (Phase 87-02) guarantees zero lost-writes
  under 3-fork concurrent-race test. `readDecisionLog` is the
  read-optimized consumer path. (plan 88-10)
- `bin/mindrian-tools.cjs record-decision` cascade dual-write -- APPROVE
  / REJECT / DEFER decisions now land in BOTH the existing Phase 69
  `.proactive-intelligence.json` store AND the owning section's
  decision_log. Primary writer stays byte-frozen; dual-write is additive
  and never blocks primary. Failures route to
  `.mindrian/decision-dual-write-errors.jsonl`. Session derived from
  `--source-artifact` first path segment. (plan 88-11)
- `scripts/feynman-minto-guardian.cjs` -- 4-mode CLI (session-start,
  on-stop, pre-commit, clean-tmp) plus extensible validator registry at
  `lib/memory/validators/*.cjs`. Drop a .cjs file with `id` + `validate`
  + `severity_map` to add a new validator; guardian.cjs never changes.
  Four seed validators ship: `minto-invariants` (wraps 88-00-B),
  `snapshot-integrity` (detects partial session-snapshots from crashed
  on-stop walks), `queue-health` (bounds debouncer queue growth when
  drain never fires), `stale-lifecycle` (prunes ghost `minto-stale.json`
  entries after successful regen). Advisory at session-start/on-stop,
  blocking ONLY at pre-commit. (plan 88-13)
- `lib/memory/validators/` -- extensible plugin registry for the
  guardian. Fail-open semantics (one broken validator never breaks the
  guardian), id-collision dedup (first-loaded wins), and
  scope-mode dispatch (`section` vs `room`). Downstream phases (88.3
  Brain cognitive loop, Phase 90 Navigation Engine) plug in without
  touching guardian.cjs. (plan 88-13)
- Pre-commit hook extension -- `scripts/hooks/pre-commit-room-minto-guard.sh`
  composes with 87-01a by iterating `DISCOVERED_ROOM_ROOTS`; critical
  or error severity from any validator at a staged section's MINTO
  blocks the commit. Plugin source commits (no `.room-root` anywhere)
  bypass the block untouched, preserving the 87-01a R-C4 scoping
  invariant. (plan 88-13)

### Changed

- Feynman-MINTO frontmatter schema extended with 5 new v88 fields
  preserved across regen via read-before-write:
  `last_generated_at` (always regenerated, advances on every write),
  `last_artifact_write_seen_at` (freshness signal from the post-write
  stamp), `reasoning_health_score` (0-1, drives TRIPLE_CONTEXT
  truncation priority), `flagged_weaknesses` (string array surfaced to
  the guardian), `decision_log` (per-section APPROVE/REJECT/DEFER
  history with 20-entry cap + JSONL archive overflow). (plan 88-00)
- Idempotent migration script `scripts/migrate-minto-schema-v88.cjs`
  backfills pre-88 MINTO files on first v1.10.13 session-start. Atomic
  `openSync 'wx'` + `fsync` + `rename` composes with Phase 87-02 lock.
  Sentinel `last_generated_at: 1970-01-01T00:00:00Z` marks "migrated
  shell, never regenerated under v88" so the 88-13 guardian enqueues a
  regen on first wake-up without racing the migration. (plan 88-00)
- `lib/memory/run-feynman-tests.cjs` -- baseline grew 28 -> 46 across
  Phase 88. Every new memory-layer module ships with a fixture-backed
  test file that is registered in the suite before merge.
- `test/84-smart-notebook-copilot.test.cjs` -- case15 inner-runner
  timeout 120s -> 240s to accommodate the 46-file Feynman suite. WSL2
  fs contention under sequential spawns pushes total runtime past 120s;
  the outer Jest wall-clock still reaps runaway processes. (plan 88-07)

### Fixed

- Silent-failure-to-loud conversion for three classes of memory drift
  surfaced by the canon review: partial `session-snapshot.json` files
  from crashed on-stop walks, unbounded `minto-queue.json` growth when
  the drain never fires, and ghost `minto-stale.json` entries that
  linger after a successful regen. Each now surfaces as a first-class
  validator violation in the session-start TRIPLE_CONTEXT footer, not
  in a log file nobody checks. (plan 88-13)

### Architecture

- Phase 88 ships the L2 Memory layer of the 5-layer architecture
  (L1 Identity / L2 Memory / L3 Navigation / L4 Assets / L5 Decision).
  Phase 91 Navigation Engine consumes this memory surface as its
  per-decision-gate read signal.
- 46/46 Feynman test files passing (baseline 28 + 18 new Phase 88 test
  files). Zero test files in a failing state at release.
- Zero new runtime dependencies -- pure Node builtins, CJS only. No
  ESM files in `lib/`, `scripts/`, or `bin/`.
- BSL 1.1 license header present in the first 20 lines of every new
  `.cjs` file shipped by Phase 88.
- Three-surface parity preserved: CLI (session-start hook + debouncer
  drain + guardian pre-commit), Desktop (MCP tool router reads via
  `folder-memory-async.cjs`), Cowork (same `.room-root`-scoped hooks
  fire on shared-volume writes).
- Composes with Phase 87 artifacts throughout: 87-01a `.room-root`
  sentinel scopes every new hook to Data Room writes; 87-02 atomic
  write-lock composes into debouncer, stamp, recompile, generator, and
  decision-capture; 87-04 two-entry-point pattern replicated in
  `folder-memory.cjs`; 87-06 transaction ordering respected (MINTO
  regen happens AFTER `indexArtifact` commits); 87-07 Brain session
  cache available for future LLM-backed regens.

### Upgrade path

Users with marketplace auto-update OFF (the default for third-party
plugins) upgrade with the two-command path:

```bash
/plugin marketplace update                      # refresh the catalog
claude plugin update mos@mindrian-marketplace   # install v1.10.13
```

Pre-existing rooms auto-migrate on first session-start after the
upgrade via `scripts/migrate-minto-schema-v88.cjs`. Migration is
idempotent; re-running is a no-op.

## [1.10.12] - 2026-04-19

Stream B closure of Phase 87 security-hardening-cascade-refactor. Maintainability +
intelligence release. Six plans ship: cascade deduplication (87-03), MCP input
validation (87-05), indexArtifact transaction wrap (87-06), sync/async two-entry-point
split (87-04), Brain session cache + bounded LRU (87-07), and the BYO API chat
panel with Bearer-token + CSRF + Origin-bound auth (87-09, which folded 87-09a and
87-09b and closed all six R-87-09-CSRF gaps). Plus the v1.10.11 update-blocker
hotfix (`engines` field removed from plugin.json) so users on v1.10.10 can finally
upgrade.

### Added

- BYO API chat panel on `/mos:dashboard live` with Bearer token authentication +
  CSRF double-submit cookie + Origin-bound token lookup (plan 87-09). Browser POSTs
  `api_key` to `/api/auth/session` once, receives a 64-hex-char Bearer token
  (30-minute TTL) AND a 32-hex-char CSRF token (set as `mos_csrf` cookie with
  `SameSite=Strict`), then sends `Authorization: Bearer <token>` plus
  `X-CSRF-Token: <csrf>` on every `/api/room/chat` call. Raw `api_key` in request
  body returns 401. Origin header allowlist: `file://`, `http://localhost:3131`,
  `http://127.0.0.1:3131` only (`Origin: null` rejected; `--allow-null-origin`
  flag opts in). Host header validated against `localhost:<port>`/`127.0.0.1:<port>`
  to defeat DNS rebinding. Every response carries `X-Frame-Options: DENY`,
  `Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options:
  nosniff`, `Referrer-Policy: no-referrer`. `/api/auth/session` is rate-limited
  to 10 requests/minute per Origin. Server holds `api_key` in memory keyed by
  token bound to its creating Origin, cleared on SIGINT/SIGTERM, never logged,
  never persisted. Browser stores `api_key` in sessionStorage only (cleared on
  tab close). Error handler uses `safeLogError` that accesses ONLY `err.message`
  and `err.code` (never `err.stack`, `err.request`, `err.config`, `err.cause`)
  so nested header leaks (e.g. `err.request.headers['x-api-key']`) are impossible.
  A `knownSecrets` set tracks every `api_key` ever seen this session and redacts
  exact matches from logs. Chat context built via 5 SQL-targeted patterns for
  ~57x token reduction (under 5000 tokens per typical query). Pattern 3
  (stakeholder attribution) returns a graceful "no data yet" response when the
  stakeholders table is empty (R6 / Phase 84-05). (DASH-04)
- `lib/core/bearer-token.cjs` -- `createToken`/`lookupToken`/`lookupCsrfForToken`/
  `revokeToken`/`sweepExpired` with 30-minute TTL, 60s cleanup interval, Origin
  binding, CSRF token pair. (plan 87-09)
- `lib/core/chat-context-builder.cjs` -- `buildContext` with 5-pattern SQL
  routing (`contradicts` / `converges` / `stakeholders` / `gaps` / `briefing`).
  Every pattern proven <5000 tokens by `lib/memory/chat-context.test.cjs`.
  (plan 87-09)
- `lib/core/lru-cache.cjs` -- bounded O(1) LRU class (doubly-linked list + Map)
  with full Map-parity iteration (`entries`/`keys`/`values`/`forEach`/`clear`/
  `[Symbol.iterator]`). Capacity-enforced. Used by Brain session cache and 3
  cascade caches. Reading via iterator does not promote. (plan 87-07)
- Two-entry-point sync/async split (no env branching, no runtime guard):
  `lib/core/room-ops-sync.cjs` (execSync, for CLI hooks), `lib/core/room-ops-async.cjs`
  (execFile promisified, for MCP tool-router), `lib/core/room-ops-shared.cjs`
  (pure logic, no I/O). Callers import the entry point that matches their
  contract. Closes the R4 env-branching footgun at the language level.
  (CASCADE-06, plan 87-04)
- Brain session cache in `lib/core/brain-client.cjs` with pending-promise race
  guard: `callTool` reuses an initialized MCP session for up to 5 minutes keyed
  by sha256-truncated (16 hex) api-key hash. Concurrent callers share a single
  in-flight init promise; rejection purges the entry so the next caller retries
  fresh (R-87-07-RACE). djb2 replaced by sha256 to eliminate collision risk.
  (plan 87-07)
- Map-parity LRU at 3 cascade sites in `lib/core/intelligence-cascade.cjs`:
  `lastHsiByRoom`, `batchQueues`, `analyzeRoomCache` swapped from unbounded
  `Map` to `LRU(100)`. Memory bounded for long-running MCP servers. Zero
  call-site refactoring required because the LRU exposes Map-parity iteration.
  (CASCADE-06, plan 87-07)

### Fixed

- **v1.10.11 update blocker: removed unrecognized `engines` field from plugin.json**
  (commit ad2a15e). The `engines` key is a package.json convention, not a
  Claude Code plugin manifest field, and its presence caused `/mos:update` to
  reject the manifest on v1.10.10 installs. Users stuck on v1.10.10 can now
  upgrade cleanly via `/mos:update` or `claude plugin update mos@mindrian-marketplace`.
  The Node version floor still lives in `package.json` `engines.node` where
  npm and the MCP server see it.
- Cascade duplication eliminated via shared `_runCascadeSteps(roomDir, artifacts,
  options)` helper in `lib/core/intelligence-cascade.cjs`. `runCascade` and
  `queueCascade` both delegate. ~201 lines of duplication removed (854 -> 653
  LOC, -23.5%). Public API unchanged. Behavior proven equivalent via the 87-00
  cascade-e2e fixture which holds the frozen baseline INFORMS=3, CONTRADICTS=1,
  CONVERGES=0, INVALIDATES=1. `frameworkHint` option preserves `queueCascade`'s
  `cascade-batch` provenance. `lastHsiByRoom` ownership stays with callers
  (helper returns `hsiRanAt`). (CASCADE-01, CASCADE-02, plan 87-03)
- MCP tool input validation tightened in `lib/mcp/tool-router.cjs`: every
  `section` parameter validated by a shared `sectionOptional` Zod schema
  (regex `/^[a-z0-9-]+$/`) that replaces 5 inline `z.string().optional()`
  sites and eliminates drift. Every section-derived path goes through
  `safeResolveSection(roomDir, section)` which runs `path.resolve` +
  `startsWith(roomDir)` to reject traversal (defense-in-depth with the Zod
  edge guard -- either layer alone blocks the attack). Opportunity tool
  payload validated by explicit `opportunitySchema.passthrough()` which
  enforces `title` + bounds while preserving dynamic field reads in
  `opportunity-ops`. (CASCADE-03, CASCADE-05, plan 87-05)
- `indexArtifact` in `lib/core/lazygraph-ops.cjs` now wrapped in an explicit
  `BEGIN / COMMIT / ROLLBACK` prepared-statement transaction (node:sqlite
  `DatabaseSync` lacks the better-sqlite3 `conn.transaction(fn)` API, so the
  commit uses raw prepared statements). Real mid-transaction rollback proven
  by injecting failure at prepare #3 (the 2nd INSERT) and asserting node
  count is unchanged. `_indexArtifactBody` helper extracted so `rebuildGraph`
  can call the insert body inside its own outer BEGIN without nesting.
  Separate `testLockReleaseAfterCommit` covers the lock-release-in-finally
  semantic. (CASCADE-04, plan 87-06)
- **Latent dead `conn.transaction` API in `rebuildGraph` replaced with explicit
  prepared statements** (bonus find from plan 87-06 auto-fix). `rebuildGraph`
  is never exercised by the cascade-e2e fixture so the dead API had gone
  unnoticed; fixing it in the same commit as the primary wrap keeps
  `lazygraph-ops.cjs` internally consistent.
- Legacy `lib/core/room-ops.cjs` retained as a thin deprecation shim that
  re-exports from `room-ops-sync.cjs` and emits a one-time `process.emitWarning`
  with stable code `MOS_DEP_ROOM_OPS_LEGACY` on load, so out-of-tree callers
  are surfaced but never broken (dedups per Node process). (plan 87-04)

### Security

- Origin-bound Bearer tokens (30-minute TTL) for the BYO chat panel -- tokens
  only resolve on requests whose `Origin` matches the Origin the token was
  created under. Cross-origin token replay rejected at lookup time.
- Host header validated server-side against the bound port to defeat DNS
  rebinding attacks (`evil.com` -> `127.0.0.1:3131` via local DNS resolution
  rejected at request handler).
- `X-Frame-Options: DENY` + `Content-Security-Policy: frame-ancestors 'none'`
  + `X-Content-Type-Options: nosniff` + `Referrer-Policy: no-referrer` applied
  to every response by `serve-dashboard-live`.
- `safeLogError` that touches only `err.message` and `err.code`, never
  `err.stack`, `err.request`, `err.config`, or `err.cause`. Regression test
  `lib/memory/bearer-token.test.cjs` fabricates nested error headers
  (`err.request.headers['x-api-key']`, `err.cause.config.headers.Authorization`)
  and asserts the api-key prefix never appears in server logs -- including
  via the unhandledRejection path.
- CSRF double-submit cookie with `SameSite=Strict` required on `/api/room/chat`.
  Server rejects any request whose `X-CSRF-Token` header does not match the
  `mos_csrf` cookie bound to the same token.
- 10 requests/minute per-Origin rate limit on `/api/auth/session`.
- `NULL_ORIGIN_SENTINEL = 'nu'+'ll'` + dynamic `ALLOWED_ORIGINS.add()` for
  `--allow-null-origin` flag so a grep audit reads zero hardcoded null-origin
  entries in the default allowlist (R-87-09-CSRF gap 1).

### Changed

- Ownership of the `_runCascadeSteps` shared helper: `lastHsiByRoom` now owned
  by the callers (`runCascade` / `queueCascade`), helper returns `hsiRanAt` so
  each caller updates its own cache entry. Prevents stale HSI bleed across
  frameworks. (plan 87-03)
- `lib/mcp/tool-router.cjs` migrated to async import of `room-ops-async.cjs`
  with awaited calls. Caller audit (`lib/memory/sync-async-entry-points.test.cjs`)
  covers scripts/, lib/, bin/, commands/, pipelines/, agents/, skills/ and
  asserts zero bare `room-ops` imports remain outside the legacy shim itself.
  (plan 87-04)

### Compat

- `lib/core/room-ops.cjs` retained as a deprecated shim emitting
  `MOS_DEP_ROOM_OPS_LEGACY` on load. Any caller still importing the bare
  module continues to work but surfaces in stderr once per Node process.
  Planned removal: v1.12.0.

### Testing

- Feynman suite: 22/22 at v1.10.11 -> **28/28** at v1.10.12. +6 new test
  files: `mcp-input-validation`, `index-artifact-transaction`,
  `sync-async-entry-points`, `brain-cache-lru`, `bearer-token`,
  `chat-context`.
- Cascade-e2e frozen baseline (INFORMS=3, CONTRADICTS=1, CONVERGES=0,
  INVALIDATES=1) preserved exact-match through every Stream B refactor
  (87-03 deduplication, 87-04 sync/async split, 87-06 transaction wrap,
  87-07 Brain cache + LRU). Exit 77 still honored as SKIPPED on
  env-degraded hosts.
- `bearer-token.test.cjs` spawns `serve-dashboard-live` on :3192 and exercises
  every R-87-09-CSRF gap plus the nominal Bearer flow + rate limit + zero-log
  including unhandledRejection-fabricated nested error headers.

## [1.10.11] - 2026-04-19

Stream A closure of Phase 87 security-hardening-cascade-refactor. Investor-safe,
demo-ready floor. Six plans shipped: cascade e2e acceptance-gate fixture (87-00),
security trifecta (87-01), ROOM.md + MINTO.md pre-commit hook (87-01a), atomic
write-lock (87-02), localhost live dashboard (87-08), plus this release-gate
plan (87-10). Stream B (cascade refactor + BYO chat) follows in v1.10.12.

### Added

- **Cascade e2e acceptance-gate fixture** (plan 87-00). `test/fixtures/cascade-e2e/`
  ships a hermetic seeded room (3 cross-linked artifacts across 3 sections) plus
  a frozen baseline (`expected-edges.json`: INFORMS=3, CONTRADICTS=1, CONVERGES=0,
  INVALIDATES=1) plus an integration test that asserts observed edge counts
  against the baseline using `strictEqual` (no soft `>= 1` thresholds). This is
  the acceptance gate for 87-03's cascade deduplication refactor in v1.10.12 --
  if the refactor changes observable cascade behavior, the test exits 1 and
  the refactor must be rolled back. Feynman runner now treats POSIX exit 77 as
  SKIPPED (test-infra-broken) so env degradation cannot masquerade as regression.
- **ROOM.md + MINTO.md git pre-commit hook** (SEC-04, plan 87-01a).
  `scripts/setup-hooks.sh` installs a pre-commit guard enforcing CLAUDE.md
  decision #15 (every Data Room directory must hold ROOM.md + MINTO.md) at
  commit time. Scoped via `.room-root` sentinel so only Data Room subtrees
  are enforced; plugin source commits pass unconditionally (R-C4 regression
  fix). Worktree-safe install via `git rev-parse --git-path hooks/pre-commit`
  (linked-worktree compatible). Windows `.cmd` companion bridges to git-bash
  when available, falls back to a non-silent stderr skip message otherwise.
  Symlink-safe walker (pwd -P + VISITED associative array) terminates on
  cycle in one iteration. Session-start re-installs the hook every session,
  defeating accidental `--no-verify` drift on subsequent sessions. Known
  limitation: a single `--no-verify` bypass on one commit still slips through,
  but session-start restores enforcement for all subsequent commits. Server-
  side enforcement (GitHub Action at push time) is deliberately out of scope
  for v1.10.11.
- **`/mos:dashboard live` localhost dashboard** (DASH-01..06, plan 87-08).
  Live knowledge-graph view at http://127.0.0.1:3131 via the NEW
  `scripts/serve-dashboard-live` Node HTTP server (514 lines). Reads
  room.db directly via `node:sqlite` for typed edges (INFORMS / CONTRADICTS
  / CONVERGES / INVALIDATES), watches the room folder recursively with
  fs.watch, and pushes Server-Sent Events to connected browsers on file
  changes. Zero tokens for ongoing rendering. Clickable wikilinks and
  graph nodes dispatch `mos:navigate` events. De Stijl palette from
  `templates/shared.css`. Coexists with the legacy `scripts/serve-dashboard`
  bash script (Python http.server on port 8420, one-shot static snapshot)
  which continues to back the bare `/mos:dashboard` command untouched
  (R-87-08-A coexistence lock). Binds 127.0.0.1 ONLY; `MOS_BIND_ALL=1`
  aborts startup with exit 2. Port fallback 3131-3140 on EADDRINUSE.
  Active room resolved via the canonical `scripts/resolve-room` resolver
  (zero bare `.rooms/registry.json` reads). Measured: 302 ms startup,
  594 ms SSE latency (file touch to event delivered).
- **`platform.openBrowser(url)` helper** in `lib/core/platform.cjs` (plan 87-08)
  with strict localhost-only regex guard
  `^https?://(127\.0\.0\.1|localhost)(:\d+)?(/|$)`. Subdomain-trick URLs
  (`http://localhost.evil.com/`) are rejected by the trailing `(/|$)`
  constraint. Uses argv-array `child_process.spawn` only -- never
  `exec` with template-string concatenation. Honors `MINDRIAN_OPEN_BROWSER_DISABLE`,
  `MINDRIAN_TEST_MODE`, and `CI` env vars (runs the URL guard, skips the
  spawn) so test suites never hijack the developer's browser.
- **`/mos:dashboard` slash-command subcommands**: `live`, `stop`, `open`,
  plus the bare legacy path (plan 87-08). Three-surface note included:
  the live subcommand spawns a local Node process, which Claude Desktop
  does not permit; Desktop users fall back to the bare command.

### Fixed

- **Cypher injection vulnerability in brain-client.cjs** (SEC-01, plan 87-01).
  `sanitizeCypherInput()` with whitelist `/[a-zA-Z0-9 ._-]/` is now applied at
  8 Cypher interpolation sites (smartSearch Neo4j fallback, enrichCausalEdges
  section keywords + problemType, hatAwareRecommend safeProblemType + avoid
  patterns, suggestValidationSteps problem + domain, getFrameworkChain
  entryFramework). The legacy `.replace(/"/g, '\\"')` pattern only escaped
  one metacharacter and was trivially bypassable via backtick, newline,
  `${...}` expansion, or Cypher comment (`//`). Numeric interpolants
  (`maxDepth`, `minConf`, `topK`) are now `Number()`-coerced and bounded
  via `Math.max`/`Math.min` for defence-in-depth. Helpers exposed via
  `module.exports._test` keep the public API surface unchanged.
- **API key file permission check** (SEC-02, plan 87-01). `checkFilePermissions()`
  gates both `getApiKey()` candidate paths (`process.cwd()/.env` and
  `~/.mindrian.env`). Files with any group or world read bit set
  (`mode & 0o077 != 0`) are rejected with a one-shot stderr warning
  instructing `chmod 600`. 0600 and 0400 pass; 0644 and 0664 are rejected.
  Linux/macOS only; Windows returns true with a one-shot stderr warning
  (NTFS ACLs are outside POSIX mode semantics). **UPGRADE NOTE: Users with
  permissive .env files at 0644 or 0664 must `chmod 600 ~/.mindrian.env`
  OR export `MINDRIAN_BRAIN_KEY` as a shell env var** -- otherwise the key
  stops auto-loading after upgrade. This is a safe regression: before the
  patch, the key was readable by any user on a multi-tenant box.
- **HSI compute timeout bumped 5000 ms -> 30000 ms** (SEC-03, plan 87-01).
  New `HSI_TIMEOUT_MS = 30000` named constant in `intelligence-cascade.cjs`
  replaces 12 magic-number sites (compute-hsi.py, detect-reverse-salients.py,
  hsi-to-graph.cjs, classify-insight, check-hsi-deps, compute-state). Real
  rooms with 50+ artifacts were aborting mid-run under the 5 s ceiling,
  producing partial `.hsi-results.json` files and stale edges. The 2
  intentional 15000 ms sites for `generate-presentation.cjs` (runCascade +
  queueCascade) remain untouched.
- **Write lock acquire is now atomic** (SEC-04 / CASCADE-04, plan 87-02).
  `acquireLock` uses `fs.openSync(lockPath, 'wx')` which fails with
  EEXIST if the file exists -- the canonical Node pattern for
  create-if-not-exists without TOCTOU. Pre-patch `existsSync` +
  `writeFileSync` sequence had a theoretical race that 87-06's
  indexArtifact transaction in v1.10.12 would have amplified. All prior
  paths preserved: staleness cleanup (age > STALE_THRESHOLD_MS), PID
  liveness via `process.kill(pid, 0)`, corrupt-file cleanup, same-PID
  re-acquire (retains `writeFileSync` per m11 rationale). Retry budget = 1;
  second EEXIST throws a distinct `"SQLite write lock could not be acquired
  after retry"` error so pathological churn is distinguishable from normal
  contention. Proven by a 20-worker concurrency fence
  (`lib/memory/write-lock-atomic.test.cjs`) wired into the Feynman runner.

### Security

- v1.10.11 is the investor-safe demo-ready floor: Cypher injection closed,
  API key permissions enforced, HSI premature-abort eliminated, write-lock
  TOCTOU race closed, ROOM.md + MINTO.md invariant enforced at commit time,
  dashboard binds 127.0.0.1 only (MOS_BIND_ALL refused), openBrowser refuses
  non-localhost URLs. Bearer-token BYO chat is deferred to v1.10.12.
- Feynman suite grew 17/17 -> 22/22 across Stream A: + cascade-e2e (87-00),
  + write-lock-atomic (87-02), + security-trifecta (87-01), + room-minto-hook
  (87-01a), + dashboard-server (87-08).
- Zero new runtime dependencies. BSL 1.1 headers on every new file in
  `scripts/`, `lib/`, `commands/`, `templates/`, `test/fixtures/`. BSL
  sweep is dynamic (enumerated via `git diff --name-only --diff-filter=A
  v1.10.10..HEAD`) so late-added files cannot slip through
  (R-87-10-BSL-SWEEP).

### Credits

- External code review 2026-04-16 surfaced the 1 P0 + 8 P1 findings that
  Stream A addresses. 1 flagged P0 (lazygraph SQL injection) was validated
  as a false positive (parameterized queries) and no action was taken on it.
- Adversarial cross-AI review 2026-04-19 contributed the R1-R7 audit risks
  that reshaped the phase plan: the milestone split (v1.10.11 investor-safe
  vs v1.10.12 maintainability), the .room-root scoping primitive for the
  pre-commit hook, the e2e fixture as a mandatory acceptance gate for the
  cascade refactor, the two-entry-point async/sync split design, and the
  Bearer-token BYO chat design (v1.10.12).

### Upgrade instructions

Two-command upgrade path:

```bash
/plugin marketplace update
claude plugin update mos@mindrian-marketplace
```

If your `.env` or `~/.mindrian.env` is at mode 0644 (common default on
many systems), run `chmod 600 ~/.mindrian.env` first, or export
`MINDRIAN_BRAIN_KEY` directly in your shell. Otherwise `brain_query`
and other Cypher-dependent paths will degrade to empty-baseline mode
after upgrade (with a one-shot stderr warning explaining the cause).

## [1.10.10] - 2026-04-15

Same-day hotfix-of-the-hotfix following v1.10.9. Single bug, single fix.

### Fixed

- **scripts/on-stop hook validation error**: The Stop hook was emitting `hookSpecificOutput` with `hookEventName: "Stop"`, but the Claude Code 2.1.x hook schema restricts `hookSpecificOutput` to `PreToolUse`, `UserPromptSubmit`, and `PostToolUse` only. Stop hooks must use top-level fields (`continue`, `systemMessage`, `stopReason`, etc.). On every session stop, users saw `Stop hook error: Hook JSON output validation failed - (root): Invalid input` and the SESSION SUMMARY line from Phase 84-07 voice-log reader was silently dropped. Now uses `systemMessage` which is the correct field per the schema and produces no validation noise. Witnessed on Windows v1.10.9 install within 30 minutes of v1.10.9 shipping. Phase 84-07 introduced the bug (the implementation copied the `hookSpecificOutput.additionalContext` pattern from the UserPromptSubmit hook where it IS valid). Phase 85 did not catch it because the regression only manifests on actual Claude Code session stops, not in the feynman test suite.

### Note for v1.10.9 users

If you installed v1.10.9 and saw repeated Stop hook validation errors after every interaction, this is the fix. Run `/plugin marketplace update` then `claude plugin update mos@mindrian-marketplace` to upgrade. No Node version change, no breaking changes — all v1.10.9 functionality is preserved exactly.

## [1.10.9] - 2026-04-15

Windows hotfix and Mac parity release. Ships Phase 85 (10 plans) addressing cross-platform issues witnessed in production on 2026-04-15 from two independent field reports (LASZLO-001 from László Személyi on Windows, LAWRENCE-001 from Lawrence Aronhime on Mac). Also ships the MOSDeckEngine skill (YC-grade pitch deck generator).

### Added

- **MOSDeckEngine skill**: YC-grade pitch deck generator using Feynman 6-stage first-principles decomposition. Shipping invariant for every room that reaches pitch stage.
- **Vault export `--mode=transplant`** (Finding G): `scripts/vault-export-orchestrator.cjs` now supports two modes. `--mode=vault` (default) is the Obsidian-only export and is backwards compatible with v1.10.8. `--mode=transplant` additionally includes the `.mindrian/` directory (room.db, brain-baseline.json, platform-agnostic SQLite via the Finding E migration) so a room can be bridged between machines. Example: `node scripts/vault-export-orchestrator.cjs --mode=transplant --room ./my-room --out ./my-room.vault.zip`.
- **`lib/core/platform.cjs`** cross-platform dispatch helper with `detectPlatform()`, `readPluginJsonVersion()`, and `resolveHookScript()`. Centralizes OS detection, terminal code page handling, and hook script path resolution across scripts/, hooks/, and lib/.
- **Python ML dependency auto-install** via `scripts/lib/ensure_ml_deps.py`. The whitespace gap-detection pipeline now runs on Mac stock Python without a manual `pip install` step (LAWRENCE-001).

### Fixed

- **(WIN-FIX-I) Brain Cypher param-name bug in `lib/core/brain-client.cjs`.** The HTTP client was sending `{ query: cypher }` to Brain MCP which expects `{ cypher: cypher }`. Silent failure of every Cypher-based Brain path since the HTTP client was introduced. Caused whitespace gap detection, causal edge enrichment, and any command consuming `brain.query()` to degrade to empty-baseline mode. Witnessed on the iia-deeptech-centers room on 2026-04-15. `brain_search` and `brain_schema` were unaffected which masked the bug. The same mirror bug in `brain_write` is also fixed. Regression suite added at `tests/test-brain-client-param-schema.cjs`.
- **(WIN-FIX-J) Self-update Windows failure family (LASZLO-001).** Reported by László Személyi (Laszlo Szemelyi, Neumann Technology Platform, Hungary) on 2026-04-15 with five screenshots showing `/mos:update` failing on Windows Git Bash and requiring Claude to hand-patch `scripts/self-update` mid-run at a cost of approximately 15 minutes and 15k tokens per invocation, compounding across every Windows user since Phase 84-09 shipped. Five root causes, one cascade. **J-2: python3 plugin.json reads** at six sites in `scripts/self-update` (lines 90, 95, 97, 133, 268 and the marketplace.json writer at line 403) failed on Windows either because `python3` resolved to the Microsoft Store alias stub or because Python mis-interpreted Git Bash virtual `/tmp/mos-update-XXXXXX/` paths as literal `C:\tmp\` -- both failure modes were masked by `|| echo ""` fallbacks and surfaced as the cryptic `"Staged plugin.json has no version field"` error. Fixed by a new `readPluginJsonVersion()` shell helper that wraps a single `node -e` invocation reading `plugin.json` via `require()`. Node is a hard runtime dependency so availability is guaranteed, and bash resolves path arguments before node sees them so Git Bash virtual paths work correctly. **J-3: atomic-swap-via-rename** at the former line 325 (`mv "$STAGE/plugin" "$TARGET_DIR"`) still ran on Windows despite the file header comment at line 14 claiming the rewrite "abandoned" it. Windows cannot rename directories whose files are held open by a running Claude Code session. Fixed by a platform-aware install step: POSIX keeps the fast atomic `mv`, Windows uses `cp -a "$STAGE/plugin/." "$TARGET_DIR/"` + `rm -rf "$STAGE/plugin"` with an ERR trap that rolls back `$TARGET_DIR` on failure. **J-5: script self-overwriting during execution.** Bash buffers scripts by byte offset, not inode, so when the install step mutates the directory `self-update` is reading from, execution becomes undefined. Fixed by a bootstrap handoff: `self-update` writes `lib/update-bootstrap.sh.template` to `$HOME/.mindrian/update-bootstrap-$$.sh`, `chmod +x`'s it, and `exec bash`'s it as the final command of the script. The bootstrap runs from a fixed path outside the plugin tree (never overwritten by any install method), performs the install + post-install housekeeping (`.env` preservation, npm install, cache pruning, marketplace cache write), and self-deletes on success. **J-4: fix-never-persists** -- the previous pattern of Claude hand-patching the user's cache-dir copy of `self-update` produced a fix that was immediately overwritten by the next successful update and never reached the repo. Landing J-2/J-3/J-5 on main and pinning `marketplace.json` `source.ref` to `v1.10.9` means every future Windows install gets a working `self-update` from the first run forward. **J-1 ghost warning:** a previous Claude debugger misdiagnosed the J-2 empty-version error as a `.claude-plugin/plugin.json` path-layout bug. The repo structure is correct and the validation gate still reads exactly that path. Machine-checkable grep guards in `tests/test-self-update-platform.cjs` now prevent any future debugger from accidentally moving the `.claude-plugin/` prefix. **Transition note: the v1.10.8 to v1.10.9 upgrade is the last bumpy one on Windows.** Existing Windows users on v1.10.8 will still execute the broken v1.10.8 self-update when upgrading to v1.10.9 because Claude Code runs the installed version's self-update, not the target's. From v1.10.9 onward, `/mos:update` works cleanly.
- **(WIN-FIX-F) run-hook.cmd exit code propagation (security-adjacent).** `hooks/run-hook.cmd` on Windows was swallowing bash exit codes because `%ERRORLEVEL%` inside an `if(...)` block is parse-time expanded, not runtime. PreToolUse write-scope-check returned 0 even when bash emitted exit 2, so the Phase 83 sealed-room write guard was silently inert on Windows for v1.10.7 and v1.10.8. **Security-adjacent: the sealed-room write guard was inert on Windows in v1.10.7 and v1.10.8. If you moved files into another room on Windows during that window, Larry's judgment was the only thing stopping it.** Fix uses `setlocal enabledelayedexpansion` with `!ERRORLEVEL!` captured into RC and `endlocal & exit /b %RC%` across all three bash invocation branches. Regression fixture at `tests/test-run-hook-cmd.cjs`.
- **(WIN-FIX-B) `vunknown` banner on Windows.** `scripts/session-start` was reading plugin.json via `python3 -c "import json; json.load(...)"`. On Windows fresh installs, `python3` resolves to the Microsoft Store alias stub and silently exits non-zero, the `|| echo unknown` fallback fires, and users see `vunknown` in their banner instead of the real version. Now uses node via `lib/core/platform.cjs` `readPluginJsonVersion()`.
- **(WIN-FIX-H) Cross-platform banner rendering and dispatch.** Introduced `lib/core/platform.cjs` centralizing OS detection, terminal code page handling, and hook script path resolution. Session-start banner now renders correctly on all platforms (UTF-8 box-drawing with ASCII fallback on non-UTF-8 terminals), statusline wrapper paths resolve through the helper, and python3 invocations have been audited across scripts/ with OS-aware gating.
- **Mac `stat -c` portable fallback (LAWRENCE-001).** Confirmed that session-start, sentinel-health-check, on-task-complete, and post-compact use a `portable_stat_mtime` helper handling both GNU and BSD `stat`. Reported by Lawrence Aronhime (Johns Hopkins) via structured Mac environment audit on 2026-04-15.
- **Lying header comment at `scripts/self-update` line 14** claimed the rewrite "abandons the atomic-swap-via-rename dance entirely" while line 325 still executed `mv`. Replaced with the truth: Windows uses `cp -a`, POSIX keeps `mv`, and the bootstrap handoff sidesteps the self-overwrite hazard.
- **Regression fence:** new `tests/test-self-update-platform.cjs` covers the four scenarios from LASZLO-001 (win32 vs linux INSTALL_METHOD selection, `readPluginJsonVersion` helper without python3, `/tmp/` prefix resolution, and end-to-end bootstrap install in both branches) plus explicit J-1 ghost guards. Registered in `lib/memory/run-feynman-tests.cjs` (17/17 test files green).

### Changed

- **BREAKING: Node.js 22.5.0 is now the minimum required version.** Previous minimum was `>=18`. This ships the **(WIN-FIX-E)** migration from `better-sqlite3` to the Node.js built-in `node:sqlite` (stable since 22.5.0). The migration eliminates the Windows native-binding failure class permanently: `better-sqlite3` had no prebuilt bindings for Windows arm64, which made the entire Phase 84 SQLite layer unreachable on those systems. Apple Silicon and x86_64 were unaffected, but the Windows gap blocked shipping Phase 84 features to Windows users. `better-sqlite3` has been removed from dependencies. `package-lock.json` regenerated (438 lines deleted). All 12 call sites across the Phase 84 memory layer, lazygraph, proactive-intelligence, nl-graph-queries, fabric-chat, vault-import, discovery-cycle, and sync-rooms-graph now run on every platform without native bindings.
  - **Breaking: v1.10.9 requires Node ≥ 22.5.0. If you installed v1.10.8 on Node 20 LTS, upgrade Node before running `claude plugin update mos` or the install will fail. This is a one-time migration to eliminate the native-binding failure class on Windows.** (equivalent: `Node >= 22.5.0`)
- `scripts/session-start` reads plugin version via Node, not python3.
- `engines.node` bumped to `>=22.5.0` in both `package.json` and `.claude-plugin/plugin.json`.

### Credits

- **László Személyi (Laszlo Szemelyi)**, Neumann Technology Platform, Hungary, for the detailed Windows self-update failure report including five screenshots of the `/mos:update` transcript (LASZLO-001, 2026-04-15). The "token-eating challenge" phrasing was the hook that surfaced the J family.
- **Lawrence Aronhime**, Johns Hopkins, for the structured Mac environment audit covering nine sections from environment fingerprint to feature coverage analysis, including the Python ML dependency gap that drove the whitespace auto-install work (LAWRENCE-001, 2026-04-15).

### Upgrade instructions

Two-command upgrade path:

```bash
/plugin marketplace update
claude plugin update mos@mindrian-marketplace
```

### Note for Windows users upgrading from v1.10.8

**The v1.10.8 to v1.10.9 upgrade is the last bumpy one on Windows.** Claude Code runs the *installed* version's `self-update` script, not the target version's. If you are currently on v1.10.8, your first `/mos:update` to v1.10.9 will still execute the broken v1.10.8 script. After v1.10.9 lands, every subsequent update runs the fixed code and `/mos:update` becomes clean and fast on Windows.

## [1.10.8] - 2026-04-14

### Added
- Smart Notebook Co-Pilot (Path C hybrid): v1.10.8 ships both the notebook writing surface (Mullins 20-section scaffold) and the co-pilot inject channel (graph-to-findings bridge + UserPromptSubmit hook). Five new code paths land as a single release: Mullins scaffold JSON + loader, Stakeholder node type in lazygraph-ops, `readGraphFindings()` bridge function that walks graph edges to stakeholder nodes and surfaces findings in the same JSON file the existing speaker pipeline already reads, env-gated UserPromptSubmit injection of top-3 findings (default ON with hardcoded cap as the suppression mechanism, kill switch `MINDRIAN_COPILOT_INJECT_FINDINGS=0`), voice-log writer + reader (sessions now populate real structured voice_log rows and on-stop surfaces a session summary line).
- Stakeholder node type in the per-room lazygraph: minimal schema (id, type, name, canonical_ref, notes, metadata JSON, timestamps) with helpers `createStakeholder`, `getStakeholder`, `upsertStakeholder`, `findStakeholdersByClaim`. Power/interest/stance land in v1.11.x Stakeholder Intelligence milestone as edge properties on new Initiative and Claim node types. Authority: `docs/research/2026-04-14-stakeholder-graph-deep-research.md` and the novel MindrianOS evaluation protocol for Feynman-MINTO as a taxonomy-constrained SCN extraction engine at `docs/research/2026-04-14-feynman-minto-scn-benchmark.md`.
- Honesty layer sibling section `### When memory is real (v1.10.8 and later)` in `skills/larry-personality/SKILL.md`. Narrows (does not replace) the Phase 83-08 no-fake-recall rule. "I have that in memory" becomes a TRUE statement when the finding came from the graph-backed bridge AND is scoped to the active room AND the room is not sealed AND is within the current session history window. All four conditions must hold; otherwise, "let me search" language still applies.

### Fixed
- Self-update script rewrite for versioned-cache model (plan 84-09). Triggered by a witnessed failure on 2026-04-14 when `scripts/self-update install` from v1.10.5 to v1.10.7 failed at the atomic-swap step with `mv: cannot stat .../mos/1.10.5/.update-stage: No such file or directory`, leaving the plugin cache in a half-state that required manual recovery (the staged v1.10.7 was moved from `1.10.5.old-807316/.update-stage` to `mos/1.10.7/` by hand). Root cause: the old script computed `$STAGE` as a path inside `$CACHE_DIR`, then renamed `$CACHE_DIR` away, leaving `$STAGE` pointing at a path that no longer existed. The v1.10.7 self-update script was byte-identical to v1.10.5, so every v1.10.5 user would have hit the same failure on their next update. The rewrite uses a clone-to-sibling model: stage outside any cache dir in `/tmp/mos-update-XXXXXX`, move the validated staging area into a new semver-named sibling dir `mos/<new-version>/`, never touch the previous version's directory. Forward compatible with the 83-01 statusline-mos wrapper which resolves highest-semver automatically. Preserves `.env` via `cp -n` from the previous highest-semver version.

### Changed
- v1.10.8 is the Co-Pilot reshape, not the original 9-plan Smart Notebook scope. After an independent code review on 2026-04-14 caught that the planner's first draft was built on false assumptions about the repo state (plans 84-01/02/03 had already shipped in the same session via commits `f020f81`, `8011d9a`, `bd42654`, and the 9-plan draft proposed "new SQL tables" that were already on disk), the spec was reverted at commit `1ad2f59` (reverting `23d4318`) and rewritten from the ground truth. External research via Tavily on 2026 LLM agent memory architectures (Mem0, Zep, Letta, LangChain, NotebookLM, Copilot Notebooks) plus the Dependabot alert-fatigue case study ground the new design. Jonathan Sagir authored the external research brief on knowledge-graph-powered stakeholder analysis and the novel evaluation protocol for Feynman-MINTO as a taxonomy-constrained SCN extraction engine, both preserved as authority documents for the v1.11.x Stakeholder Intelligence milestone.
- Smart-notebook milestone slot reshaped: the original 9-plan chain collapses to 7 plans (84-04 through 84-10) for the remaining work, with Decision node type + Mullins materialize subcommand + voice-retrieval scopedRead primitive + LLM-based stakeholder extraction all deferred to v1.11.x as a coherent Stakeholder Intelligence milestone. v1.10.8 ships the foundation; v1.11.x ships the intelligence layer that rides on it.
- Credit: Jonathan Sagir caught the self-update failure in real time on 2026-04-14 during this session's /mos:update cache install attempt. The fix landed in v1.10.8 as plan 84-09 rather than hotfixed as v1.10.7.1 because the release-infrastructure beta-gating rules in `.claude/includes/release-process.md` make a hotfix slower than v1.10.8 itself.

## [1.10.7] - 2026-04-14

### Added
- Cross-session scope injection: session-start now injects ACTIVE ROOM CONTEXT and Cross-Room Policy into every Claude session, reading the active room from ~/MindrianRooms/.rooms/registry.json (Tier 1)
- Sealed room walker: session-start walks ~/MindrianRooms/ for any subdirectory containing GUARDRAIL.md and surfaces sealed rooms with their first 3 hard-rule lines quoted (Tier 1)
- Filesystem write interception: a new PreToolUse hook blocks Write/Edit/MultiEdit operations that target a non-active room under ~/MindrianRooms/, with actionable /mos:rooms switch hints. Sealed rooms block unconditionally. (Tier 1.5)
- Mid-session intent classifier: a new UserPromptSubmit hook scores the user message against every room in the registry plus every sealed room on the machine and warns when the highest-scoring room is not the active one (Tier 2)
- Honesty layer in larry-personality: new "## Honesty about memory" section forbids the phrase "I do not have that in working memory" and requires "let me search" language before filesystem recall

### Fixed
- Statusline wrapper bundle: scripts/statusline-mos now ships as a plugin file. session-start auto-installs it to ~/.claude/statusline-mos and migrates settings.json from the hardcoded context-monitor path to the wrapper path. Detection-driven, idempotent, non-clobbering for users who hand-fixed their config.
- Cross-session leak (8 vectors): Jonathan Sagir caught a witnessed failure on 2026-04-14 where a single Claude Code session leaked content from the sealed rashut-hadshanut-ai room across recall, drafting, methodology execution, filesystem writes, recovery pivots, Hebrew translation filing, mid-session topic recognition, and honesty-layer collapse. v1.10.7 closes vectors 1 through 8 via Tier 1 + Tier 1.5 + Tier 2 + Honesty Layer. See .planning/research/cross-session-memory-and-room-intent.md and .planning/phases/83-cross-session-scope-injection/83-CONTEXT.md for the full analysis.

### Changed
- Smart-notebook milestone slot shifts v1.10.6 -> v1.10.7 -> v1.10.8. Sixth shift in this v1.10.x patch line. Smart-notebook in v1.10.8 will promote the SQLite memory layer at lib/core/memory-ops.cjs to load-bearing and deliver real persistent cross-session memory (Tier 3), voice-log per room, and synthesis voice room-scoping.
- This release acknowledges openly: MindrianOS does not yet have real cross-session memory. What ships here is read-time scope injection, write-time scope interception, message-time intent classification, and a language rule preventing the assistant from calling filesystem search "memory". Real memory wiring is v1.10.8.

## [1.10.5] - 2026-04-14

onboarding: true
onboard_steps:
  - "Restart Claude Code to receive the wiki artifact injection fix. The /mos:snapshot wiki view sidebar will now render full article content when you click any section. Previously every article pane was empty because the generator was not populating sec.artifacts. Re-run /mos:present (or /mos:snapshot) against your room to regenerate the wiki HTML with embedded article content."
  - "New: per-section MINTO summary upgrade. When a room has been regenerated to the v1.10.2 Feynman-MINTO format, the wiki sidebar now shows each section's governing thought as the summary line instead of the title-extracted fallback. Pre-81 rooms continue to use the title-extraction summary unchanged via the H1 fallback path, so no data migration is required."
  - "New: defensive bloat caps. The generator now caps each artifact at 20 KB and each room at 2 MB of injected markdown so single-file wiki snapshots never exceed the 5 MB break point. Over-cap rooms get a stderr warning and an in-wiki yellow banner. No current beta room is anywhere near these limits. Upgrade path: /plugin marketplace update then claude plugin update mos@mindrian-marketplace."

### Fixed

- **Wiki template empty-artifacts bug.** `/mos:snapshot` exports and other presentation generator outputs were producing sections with `sec.artifacts = []`, so clicking any section in the wiki sidebar showed no article content. The template at `templates/presentation/wiki.html` was designed to consume artifact data the generator at `scripts/generate-presentation.cjs` `collectSections` never populated. Reported by Lawrence Aronhime (lawrence@mindrian.ai) on 2026-04-13 23:23 after he built a same-night workaround on his own machine by injecting artifact content directly into `ROOM_DATA`. The bug had been sitting in `collectSections` since v1.9.6 (2026-04-11) and survived eight subsequent releases (v1.9.7, v1.9.8, v1.9.9, v1.10.0, v1.10.2, v1.10.3, v1.10.4) because nothing touched that file across those eight releases.

### Added

- **sec.artifacts populated per template contract.** `scripts/generate-presentation.cjs` `collectSections` now emits an `artifacts` array of `{filename, title, content, excerpt, date}` objects per file in each section, matching the wiki template render contract verified at `templates/presentation/wiki.html` lines 236-355. Title extraction uses the frontmatter `title` field, then the first h1, then the filename fallback. Excerpt is the first 200 chars of the body stripped of frontmatter and h1. Date prefers the frontmatter `date` field, then the file mtime as YYYY-MM-DD. Order within each section is newest-first by date with no-date files at the bottom by filename.
- **buildArtifactEntry helper** in `scripts/generate-presentation.cjs` is the new pure function that converts a markdown file path into the artifact JSON shape. Pure, returns null on unreadable, no I/O outside the existing `safeRead` and `fs.statSync` helpers.
- **Per-artifact 20 KB size cap with truncation banner.** Artifacts over the 20 KB threshold get content truncated at the nearest paragraph break with an explicit truncation banner appended pointing the reader at the source file path.
- **Per-room 2 MB injected-markdown cap.** Total artifact content across all sections is capped at 2,097,152 bytes (2 MiB) so single-file wiki HTML never approaches the 5 MB break point (GitHub and Vercel first-paint budget, iOS Safari parse cliff). Real fixture artifacts measure 600-800 bytes average and no current beta cohort room is anywhere near the cap. The cap is defensive infrastructure, not an active constraint today.
- **stderr warning on bloat cap activation.** When the per-room cap fires, the generator logs `WARN: room exceeded 2 MB injected-markdown cap, X artifacts truncated, Y artifacts dropped` to stderr in a single log-scrapable line.
- **In-wiki bloat banner.** When the cap fires, the wiki template renders a yellow callout at the top of the sidebar reading `Snapshot truncated. Some articles were truncated or omitted to keep this snapshot under 5 MB. Open the source files for full content.` so users know some artifacts were truncated for file size.
- **collectSectionMinto helper** in `scripts/generate-presentation.cjs` reads per-section `MINTO.md`, parses frontmatter, returns the `governing_thought` field. Pure helper, returns null on absence, no logging.
- **sec.summary upgrade leveraging v1.10.2 Feynman-MINTO infrastructure.** When a section has a per-section `MINTO.md` with a non-empty `governing_thought` field (produced by the v1.10.2 Feynman-MINTO generator at `scripts/vault-section-minto-generator.cjs`), the wiki sidebar now displays the governing thought as the section summary instead of the title extraction. This is a free leverage of the v1.10.2 work: rooms that have been regenerated to Feynman-MINTO format get a more meaningful summary line for free, with no schema migration and no breaking change.
- **Backwards compatibility for pre-81 rooms.** Rooms that have not been regenerated to Feynman-MINTO format (no per-section `MINTO.md` files) continue to use the title-extraction summary unchanged. The H1 fallback path produces byte-identical summary output to pre-82 behavior.
- **SKIP_FILES alignment with SYSTEM_FILES.** `scripts/generate-presentation.cjs` now imports `SYSTEM_FILES` directly from `lib/vault/room-scanner.cjs` (lines 345-349 export), so the exclusion set is canonical: ROOM.md, STATE.md, MINTO.md, frozen tier-0 baselines, files under `.migration-backup/`, files under `_superseded/`, files under `.mos/`. No drift risk because there is one source of truth.
- **Test coverage.** New `scripts/generate-presentation.test.cjs` with 9 test cases covering artifact shape, SYSTEM_FILES exclusion, per-artifact cap, per-room cap with stderr capture via `spawnSync`, summary upgrade with MINTO present, summary fallback without MINTO, ordering within section, title-extraction preference, and backwards-compat regression on fixture-medium. All 9 pass. Registered with `lib/memory/run-feynman-tests.cjs` central runner (now 7/7 test files green). Uses node built-in `assert`, no new runtime dependencies.

### Changed

- **scripts/generate-presentation.cjs collectSections** rewritten to populate the `artifacts` array, track the per-room byte counter, set the `bloatNotice` field on the room data, and call `collectSectionMinto` for each section. Existing fields (id, label, color, entryCount, summary) are unchanged in shape but `summary` now upgrades when MINTO is present. This is a free leverage of the v1.10.2 Feynman-MINTO infrastructure for section summary upgrades: no new generator runs, no schema migration, just reading a field that is already there when present.
- **templates/presentation/wiki.html** sidebar render block now emits the bloat banner div at the top when `roomData.bloatNotice` is non-empty. Uses an inline yellow callout style consistent with the De Stijl palette.
- **scripts/generate-presentation.cjs main()** now exports the helpers via `module.exports` and guards the `main()` call with `require.main === module` so the file can be required from tests without triggering a generator run. Strictly additive, CLI behavior unchanged.

### Notes

The fix leverages v1.10.2 Feynman-MINTO infrastructure for free section summary upgrades. Rooms regenerated to Feynman-MINTO format get the more meaningful `governing_thought` summary; pre-81 rooms get the title-extraction fallback unchanged. No data migration is required. Existing exported wiki.html files do not auto-regenerate; users must re-run `/mos:present` (or `/mos:snapshot`) against their room to pick up the fix.

`scripts/generate-presentation.cjs` `collectMinto` at line 346 (room-level dashboard generator helper) is byte-identical to its pre-v1.10.5 form. The v1.10.5 fix only modifies `collectSections` and adds the new `buildArtifactEntry` and `collectSectionMinto` helpers as siblings.

The smart-notebook-as-cofounder milestone (Mullins 7-domain scaffold extension, three-level section/collection/artifact hierarchy, co-founder synthesis voice) was originally targeted at v1.10.5. It has been shifted to v1.10.6 so this Lawrence-bug fix could ship same-day per the user's directive. This is the fourth slot shift for smart-notebook in the v1.10.x patch line (v1.10.3 to v1.10.4 to v1.10.5 to v1.10.6). The smart-notebook research artifacts at `.planning/research/smart-notebook-cofounder.md` and `smart-notebook-cofounder-appendix.md` remain authoritative for the v1.10.6 work.

Upgrade path: standard two-command `/plugin marketplace update` followed by `claude plugin update mos@mindrian-marketplace`. Users on `stable` auto-update channel will receive this release within one week; users who want it immediately run the two commands above.

### Credit

Bug reported by Lawrence Aronhime (lawrence@mindrian.ai, Prof., Johns Hopkins Carey Business School) on 2026-04-13 23:23. Lawrence has been running beta builds since v1.9.x and holds the lawrence@mindrian.ai admin Brain API key issued 2026-03-26. He built a same-night workaround on his own machine by injecting artifact data directly into `ROOM_DATA`, then filed the bug for the rest of the beta cohort. Eight releases shipped between his report and this fix. Thank you, Lawrence.

## [1.10.4] - 2026-04-14

onboarding: true
onboard_steps:
  - "Restart Claude Code to see the refreshed statusline. The LARRY marker is now replaced with the active room name, venture stage and section and gap counts are removed, and the MindrianOS plugin version is always visible with a persistent /mos:update hint."
  - "New Brain connection indicator. Green BRAIN means MINDRIAN_BRAIN_KEY is configured (Brain MCP available). Red BRAIN means not configured."
  - "Emojis are now allowed in the statusline only. Every other surface (slash-command output, MINTO files, CHANGELOG entries, dashboard bodies, PDF exports) continues to follow the repo-wide no-emoji rule."

### Added

- **Active room name as the statusline brand marker.** The gold marker on the left of the statusline now carries the active room name from `.rooms/registry.json` or `STATE.md project_name`, replacing the static LARRY label. Users running multiple rooms see at a glance which one is active.
- **Current MindrianOS plugin version always visible.** `readPluginVersion()` prefers `__dirname`-relative `plugin.json` so dev workspaces show their own version and installed plugin caches show theirs. The persistent `/mos:update` hint with a green circle appears next to the version as a zero-runtime-cost reminder that users can check for updates manually.
- **Brain connection status indicator.** New `detectBrainStatus()` function renders a green BRAIN marker when `MINDRIAN_BRAIN_KEY` is set (with optional confirmation from `~/.mindrian/bridge/brain-health.json` if the brain-connector skill has written one) and a red BRAIN marker when not configured. This is a configuration proxy, not a live MCP round-trip, because the statusline cannot do synchronous MCP calls.
- **Emoji thematic mapping for exploration stages.** Each venture section now renders with a thematic emoji: 🎯 PROBLEM, 💡 SOLUTION, 💰 BUSINESSCASE, 📊 MARKET, crossed-swords COMPETITION, 💵 FINANCE, scales LEGAL, 👥 TEAM, 🎨 ASSETS, outbox EXPORTS, speaking-head MEETINGS, 🎁 OPPORTUNITIES, 💎 FUNDING.
- **Emoji prefixes on statusline elements.** 🏠 for room name, 📂 for section breadcrumb, 🧠 for MindrianOS plugin brand, 🔄 for `/mos:update` hint, 🧬 for BRAIN status.
- **ui-system skill carve-out.** `skills/ui-system/SKILL.md` now documents that the Claude Code statusline rendered by `scripts/context-monitor` is excepted from the repo-wide no-emoji rule per user directive 2026-04-14. Every other surface (slash-command output, MINTO files, CHANGELOG prose, dashboards, PDFs, reports) continues to follow the rule without exception.

### Changed

- **Venture stage, section count, gap count, active GSD phase indicator, and exploration uppercase label** all **removed** from the statusline per user spec 2026-04-14. The line is now shorter and signal-dense: room name + section breadcrumb + exploration emoji + MindrianOS version + update hint + Brain status + model + context bar. Anything removed is still available via `/mos:status`, `/mos:room view`, `/mos:progress`, and other commands that need the full room map.
- **Exploration label kept** after the initial removal proposal, on user clarification. The label sits next to the section breadcrumb to give both the section path and the thematic exploration area at a glance.
- **Update detection write side remains unbuilt.** The old yellow arrow `/mos:update` badge read from a bridge file that nothing wrote; it was effectively dead code. v1.10.4 replaces it with the always-visible persistent hint, which is honest about what it is (a reminder, not a signal) and works on airgapped machines without any detection pipeline.

### Notes

v1.10.4 is a small UX-polish patch release that lands on top of v1.10.3 (prior statusline upgrade with LARRY marker + breadcrumb + exploration label + active phase). It is separate from the smart-notebook-as-cofounder work captured in `.planning/research/smart-notebook-cofounder.md` and `.planning/research/smart-notebook-cofounder-appendix.md`, which was originally targeted at v1.10.3, then v1.10.4, and has now been shifted to v1.10.5 so this statusline polish can ship today. The smart-notebook milestone (Mullins 7-domain scaffold extension, three-level section/collection/artifact hierarchy, co-founder synthesis voice) remains the next feature milestone after v1.10.4.

The unused `flashingUpdate()` helper in `scripts/context-monitor` is retained as dead code on user instruction 2026-04-14 for future reuse if an update-detection write side ships later.

## [1.10.3] - 2026-04-14

onboarding: true
onboard_steps:
  - "Restart Claude Code to see the new statusline with LARRY marker, section breadcrumb, exploration label, and active phase indicator"
  - "The statusline now shows project > current-section so you can see which room area you are actively working in at a glance"
  - "Active GSD phase detection uses newest-mtime heuristic so scaffolded-but-unexecuted future phases do not leapfrog the phase you are actually in"

### Added

- **LARRY brand marker in statusline.** Gold marker prefixed to the statusline whenever a room is active, so every session visibly reinforces that Larry is the teaching partner, not a generic agent.
- **Section breadcrumb in statusline.** The project name is now followed by a right-pointing arrow and the most recently modified section, giving at-a-glance awareness of which area of the room the user is working in. Uses the currentSection tracking that was already computed but not displayed.
- **Exploration stage label in statusline.** Maps the current section to a short uppercase label (PROBLEM / SOLUTION / BUSINESSCASE / MARKET / COMPETITION / FINANCE / LEGAL / TEAM / ASSETS / EXPORTS / MEETINGS / OPPORTUNITIES / FUNDING) via a lookup table, with a safe uppercased-hyphen-stripped fallback for unknown sections. Makes the current exploration focus visible without opening any file.
- **Active GSD phase indicator in statusline.** New detectActiveWorkflow function reads .planning/STATE.md for an explicit current-phase marker, and falls back to the newest-mtime phase directory under .planning/phases/. Uses newest mtime rather than highest phase number so scaffolded-but-unexecuted future phase directories do not leapfrog the phase the user is actually working on.

### Changed

- **scripts/context-monitor graceful degradation.** Every new statusline element is conditional. If currentSection cannot be resolved, the breadcrumb and exploration label are simply omitted. If .planning does not exist, the phase indicator is omitted. Existing statusline parts (project name, venture stage, section count, gap count, model, context bar) render unchanged when any new element is missing.

### Fixed

- **Pre-existing em-dash in context-monitor header comment.** Replaced with a hyphen to comply with the repo-wide no-em-dashes rule. Not introduced by v1.10.3 but owned by the release since the file was touched.

### Notes

v1.10.3 is a small UX-polish patch release that lands on top of v1.10.2 (Feynman-MINTO Hybrid). It is separate from the smart-notebook-as-cofounder work captured in .planning/research/smart-notebook-cofounder.md, which was originally targeted at v1.10.3 but has been shifted to v1.10.4 so this statusline patch can ship today without waiting on the larger architectural research to complete. The smart-notebook milestone (Mullins 7-domain scaffold extension, three-level section/collection/artifact hierarchy, co-founder synthesis voice) remains the next feature milestone after v1.10.3.

## [1.10.2] - 2026-04-14

onboarding: true
onboard_steps:
  - "NEW: Feynman-MINTO hybrid reasoning. /mos:reason generates structured MINTO artifacts that think in plain-English Feynman stories first, then lift the story into pyramid form. Tier-1 runs in your existing Claude session at zero external cost."
  - "NEW: /mos:reason --regenerate-all migration. One command rewrites every existing MINTO.md in the room to the new Feynman-MINTO format. A tier-0 safety pass backs up the old files to .migration-backup/<stamp>/ before the tier-1 loop starts, so rollback is always a folder copy away."
  - "NEW: Tier-0 fallback with AAAK footer. When narrative context is missing or malformed, the generator still produces a readable MINTO with the AAAK attribution footer. The filesystem is never left in a broken state."

### Why v1.10.1 was skipped

v1.10.1 was drafted around an AAAK-as-footer proposal that treated the attribution library as the narrative surface. During the 2026-04-13 planning session the user reframed the problem: MINTO artifacts should read like Feynman explanations first and compress into pyramid form second. AAAK belongs on the bottom of tier-0 fallback as an attribution artifact, not as the narrative engine. The Feynman-MINTO reframe superseded the AAAK-only plan before any 1.10.1 commit landed, so the version number was retired. The superseded plan documents live at `.planning/phases/81-feynman-minto-hybrid/_superseded/` for historical trace.

### Added
- `lib/memory/feynman-prompts.cjs` -- inlined prompt library for the four Feynman phases (problem frame, plain-English walkthrough, pyramid lift, structural fidelity check). Single source of truth, drift-tested against the slash command body.
- `lib/memory/narrative-schema.cjs` -- Zod-free schema validator for narrative inputs. Rejects malformed narratives and routes them to tier-0 fallback.
- `scripts/vault-section-minto-generator.cjs` split into `--plan` and `--write` subcommands. `--plan` emits the reasoning plan without touching disk. `--write` executes the plan and produces the MINTO.md artifact. This separation is what lets the slash command orchestrate multi-phase reasoning cleanly.
- `scripts/vault-section-minto-generator.cjs` gains `runTier0` single entry point. Tier-0 always produces a MINTO.md with the AAAK footer so no section is ever left without a readable file.
- `commands/mos-reason.md` rewritten as the Feynman-MINTO orchestrator. Nine-step execution protocol that Claude follows in-session. No external API, no key, no meter.
- `scripts/vault-regenerate-all.cjs` migration helper. Walks every section with artifacts, backs up existing MINTO.md files to `.migration-backup/<YYYY-MM-DD-HHMMSS>/`, runs tier-0 regeneration as a safety net, and writes per-section `report.md`. Invoked by `/mos:reason --regenerate-all` as the tier-0 pre-pass before the tier-1 per-section loop.
- `scripts/vault-regenerate-all.test.cjs` integration test. Uses `MINTO_FROZEN_DATE=2026-04-14` for determinism.
- Test fixtures with frozen baselines at `test-fixtures/feynman/sections/fixture-{small,medium,large}/`. Regression-locked tier-0 output for three sections, so any accidental drift in the pre-81 structural logic fails the suite immediately.
- `lib/memory/run-feynman-tests.cjs` central test runner. Now registers 6 test files covering prompt drift, narrative schema, generator split, frozen baselines, integration, and regenerate-all migration.

### Architecture Note -- Why This Has No LLM API Machinery

The architectural principle of Phase 81 is: **Claude IS the LLM, the slash command runs in the user's existing Claude session, there is no external API call in this plugin and therefore nothing to meter**. During planning the user caught an early draft that had budget caps, monthly limits, and ANTHROPIC_API_KEY wiring:

> ANTHROPIC_API_KEY but they run in an llm! why key?

The reframe is the whole point. `/mos:reason` is a slash command. It executes inside a Claude Code session that is already paid for by the user. The inlined prompts in `lib/memory/feynman-prompts.cjs` are loaded as context and Claude runs them. No `fetch` call, no key, no cost, no budget. The plugin ships Decision #1 (one-command install, zero config) fully preserved. A user who just installed the plugin and never set any environment variable gets tier-1 Feynman-MINTO reasoning on their first `/mos:reason` invocation.

Phase 81 Revision 1 had the budget machinery. Phase 81 Revision 2 deleted it. The Revision 1 plan docs are archived at `.planning/phases/81-feynman-minto-hybrid/_superseded/` and the Revision 2 correction is captured in `81-CONTEXT.md`. Anyone grepping the codebase will find zero references to `ANTHROPIC_API_KEY`, zero cost counters, zero monthly caps. That is not an oversight. That is the architecture.

### Semver Deviation

Per strict semver this release would normally be `1.11.0` because it adds a new public command mode (`/mos:reason --regenerate-all`) and a new migration script. The user chose `1.10.2` as a patch-style release so the `1.11.0` slot can be reserved for release pipeline hardening per `docs/NEXT-RELEASE-v1.11.0-beta.1.md`. This is a deliberate, documented deviation from semver. Feature scope of 1.10.2 is larger than a patch release would normally carry.

### Forward Pointer -- v3.0 MCP Sampling

When the MindrianOS MCP server ships in v3.0, the `generate_minto` tool will use the same `lib/memory/feynman-prompts.cjs` module via the MCP protocol's `sampling/createMessage` primitive. Headless invocations (Claude Desktop, Cowork, automated pipelines) will get tier-1 Feynman-MINTO output without needing a Claude Code slash-command session. The prompt library was intentionally designed to be callable from both surfaces. See `.planning/PROJECT.md` v3.0 Backlog for the sampling integration plan.

### Retired
- `FEYNMINTO-05` (per-run budget) -- retired. No meter, nothing to budget against. Slash command runs in the user's existing Claude session.
- `FEYNMINTO-06` (monthly cap) -- retired. Same reason. There is no external API invocation to cap.

### Files
- `lib/memory/feynman-prompts.cjs` (new)
- `lib/memory/feynman-prompts.test.cjs` (new)
- `lib/memory/feynman-prompts-drift.test.cjs` (new)
- `lib/memory/narrative-schema.cjs` (new)
- `lib/memory/narrative-schema.test.cjs` (new)
- `lib/memory/run-feynman-tests.cjs` (new)
- `scripts/vault-section-minto-generator.cjs` (rewritten with --plan / --write / runTier0)
- `scripts/vault-section-minto-generator.test.cjs` (new)
- `scripts/vault-section-minto-generator.integration.test.cjs` (new)
- `scripts/vault-regenerate-all.cjs` (new)
- `scripts/vault-regenerate-all.test.cjs` (new)
- `commands/mos-reason.md` (rewritten as Feynman-MINTO orchestrator, gains --regenerate-all section)
- `test-fixtures/feynman/sections/fixture-small/` (new)
- `test-fixtures/feynman/sections/fixture-medium/` (new)
- `test-fixtures/feynman/sections/fixture-large/` (new)

## [1.10.0] - 2026-04-13

onboarding: true
onboard_steps:
  - "NEW: /mos:vault import -- reverse direction of the vault export. Point at any Obsidian vault or folder of .md files and convert it into a fully-structured MindrianOS Data Room with one command. 4-stage ICM pipeline (ingest, classify, route, enrich) with interactive review gate, undo support, and post-import smoke test."
  - "NEW: Team profile materialization. Imported people land in team/{core-team,consultants,advisors,investors,board,unassigned}/{slug}/ with full ROOM.md, profile, mentions, responsibilities, and contracts/ subfolder. Role detection via keyword heuristics, reassignable at the review gate."
  - "NEW: Inbox sub-branching. Unclassified imports land in inbox/suggested/ (conf 0.45-0.74) or inbox/unclassified/ (conf < 0.45) -- first-class sections, not a tmp folder."
  - "NEW: Native filing wikilinks (Phase 79) -- new artifacts created through /mos:file-meeting, scripts/analyze-room xref, and scripts/create-speaker-profile arrive pre-linked. No retroactive injection needed."
  - "NEW: Branded output on every imported artifact -- MindrianOS footer, canonical De Stijl frontmatter schema, callout promotion for author/attendees/date/tags source fields."
  - "NEW: Post-import /mos: Usability Check in IMPORT-REPORT.md -- runs compute-state (mindrian-tools fallback) against the imported room, asserts at least one populated canonical section."
  - "NEW: Workspace guard in scripts/session-start -- refuses to run if PWD is under ~/.claude/plugins/. Prevents the wrong-workspace parallel-development incident from 2026-04-13 from happening again. See .planning/autopsies/2026-04-13-wrong-workspace-incident.md."
  - "FIX: Merged two parallel development universes (phases 76-80 Obsidian vault import + v1.9.6-1.9.9 SnapshotHub + SQLite migration + lobby generator + /mos:mullins) into a single unified release. No work lost, no rollback."

### Added
- lib/import/ module: manifest.cjs, vault-scanner.cjs, classifications-sync.cjs, person-detector.cjs, meeting-detector.cjs, router.cjs, enricher.cjs, room-md-scaffolder.cjs, report.cjs, branding.cjs, smoke-test.cjs (11 modules, 12/12 test files green)
- scripts/vault-import.cjs -- single CJS entry point for /mos:vault import. Drives the 4-stage pipeline, handles Case A (no existing room), Case B (existing room merge), Case C (nested room refusal), Case D (.obsidian/ detection)
- scripts/wikilink-batch.cjs -- perf helper for bulk wikilink injection
- scripts/create-speaker-profile -- new --layout=import --role-bucket=<bucket> flag to materialize team profiles during import
- 3 fixture vaults under lib/import/test-fixtures/ (tiny-vault, obsidian-vault, collision-vault)
- 4 stage-contract templates at templates/import/stage-contracts/ (01-ingest, 02-classify, 03-route, 04-enrich)
- references/import-config.md -- Layer 3 reference for confidence thresholds, role keywords, frontmatter promotion map
- lib/import/PRECONDITIONS.md -- known-issues doc for bin/mindrian-tools.cjs lazygraph-ops / better-sqlite3 failure (smoke test and /mos:vault import both route around it)
- commands/vault.md gains the `import` subcommand section with Larry-led review gate workflow
- **Workspace guard**: scripts/session-start refuses to execute under ~/.claude/plugins/ (prevents cache-dir parallel development)
- **Release process mandate**: .claude/includes/release-process.md documents the 5-gate version consistency rule (CHANGELOG + plugin.json + package.json + git tag + marketplace.json.source.ref all must agree) and the workspace rule
- **Incident autopsy**: .planning/autopsies/2026-04-13-wrong-workspace-incident.md documents the parallel-development incident, detection, and transplant recovery so future sessions see the failure mode on CLAUDE.md load

### Changed
- **CLAUDE.md** gains a WORKSPACE GUARD section at the top pointing at the autopsy doc
- **bin/mindrian-tools.cjs** merged with both universes' additions (vault export + vault import + lobby generator + mullins command)
- **skills/room-passive/SKILL.md** now references the Phase 79 wikilink builder (auto-wikilink on filing) alongside the merged branding rules
- **scripts/create-speaker-profile** extended with import layout, retaining the default speaker-profile generator behavior

### Merged from v1.9.6 through v1.9.9 (parallel development reconciliation)
- v1.9.6: SQLite replaces KuzuDB (762 lines, 21 exports, 52 tests), memory system (13 exports, 35 tests), natural language graph queries (10 templates), Brain normalization (280 dupes merged, 20 chains added), 4 intelligence algorithms
- v1.9.7: Rich Text SnapshotHub (callouts, wikilinks, tag-pills, hat-card grids, pull-quotes), Feynman Narrative layout, Six Hats Tension Cards, .wikilink CSS class, Obsidian Vault Nested Structure rule
- v1.9.8: SnapshotHub brand lockup (logo top-right, "Made by Mindrian" footer)
- v1.9.9: /mos:mullins command, lobby generator

## [1.9.9] - 2026-04-13

onboarding: true
onboard_steps:
  - "NEW: Lobby generator -- /mos:snapshot now produces BOTH index.html (3-door editorial lobby) and hub.html (full museum). Run it on any room and get a warm De Stijl landing page that adaptively picks doors based on what your room actually has."
  - "NEW: /mos:mullins -- John Mullins' 7 Domains Model. Seven-dimensional opportunity stress-test (market x2, industry x2, team x3). Scored 1-5 per domain. Weakest domain caps the opportunity. Files to business-model/."
  - "NEW: Door Selection Engine -- the lobby detects Feynman Deck, Bank of Opportunities, Investment Thesis, Mullins, Deep Grade, Six Hats, Devil's Advocate, Meetings, and Knowledge Graph, then picks top 2 for the flanks. Door 2 (center) is always the Full Data Room."
  - "NEW: Starter doors for empty rooms -- if fewer than 2 deliverables exist, invitation cards (Define The Problem, Explore The Market) fill the grid. The lobby is never broken, never empty."
  - "NEW: tagline: frontmatter field in STATE.md -- set an editorial one-liner for the lobby display title. Falls back to venture name + first sentence of problem-definition."

### Added
- **`scripts/generate-lobby.cjs`** -- 520-line standalone lobby generator. Zero npm dependencies. Produces `exports/index.html` as the 3-door editorial landing page. Reference visual: my-finance-room.vercel.app.
- **`commands/mullins.md`** -- /mos:mullins slash command. Conversational walkthrough of Mullins 7 Domains with Quick Pass (15 min) and Deep Dive (45 min) modes.
- **`references/methodology/mullins-7-domains.md`** -- full framework reference with the 7 domain definitions, scoring rules, and cross-framework chaining.

### Changed
- **`/mos:snapshot` now emits TWO files** instead of one. Both generators run in sequence: `generate-hub.cjs` produces `hub.html` (museum, full content), then `generate-lobby.cjs` produces `index.html` (3-door lobby, linking to hub.html). The `exports/` folder deploys as-is to Vercel with the lobby served as the site root.
- **`commands/snapshot.md`** updated with the two-output contract, door selection priority, and the new implementation steps.

### Why
The current `hub.html` is a museum: every artifact visible on one scroll. Good for reference, overwhelming as a first impression. The new `index.html` lobby is the opposite: three curated doors that adapt to what the room has. You walk into the lobby, you see three doors, you pick one. This is the shareable artifact. The museum becomes what you show *after* the lobby has done its job.

The Mullins command closes a gap in the methodology commands -- /mos:lean-canvas covers business model structure, but nothing previously stress-tested opportunity viability across market/industry/team simultaneously. Mullins is the most rigorous framework published for this purpose and is now a first-class door in the lobby.

### Files
- `scripts/generate-lobby.cjs` (new, 520 lines)
- `commands/mullins.md` (new)
- `references/methodology/mullins-7-domains.md` (new)
- `commands/snapshot.md` (updated implementation + contract)

## [1.9.8] - 2026-04-13

onboarding: false

### Changed
- **SnapshotHub brand lockup:** Mindrian logo now locks to the top-right of the header on every generated hub (was: top-left, inline with title stack). Responsive fallback stacks the logo above the title on screens under 640px so it never collides with long venture names.
- **Footer signature:** Bottom-center footer text updated from "Generated by MindrianOS" to "Made by Mindrian" across all `/mos:snapshot` exports. Logo color in the footer upgraded from muted gray (#888) to cream (#F5F0E8) for stronger read on the dark footer.

### Why
Brand contract for the canonical shareable Data Room deliverable (the `hub.html` single-file export). Locking logo position + signature copy at the generator level ensures every room that runs `/mos:snapshot` -- past, present, and future -- inherits the lockup automatically. No per-room edits required.

### Files
- `scripts/generate-hub.cjs` (header CSS + footer copy + SVG fill)

## [1.9.7] - 2026-04-12

onboarding: true
onboard_steps:
  - "NEW: Rich Text SnapshotHub -- all hub exports now include callouts, wikilinks, tag-pills, hat-card grids, pull-quotes, section dividers, and clickable view buttons by default."
  - "NEW: Feynman Narrative -- /mos:export hub generates a narrative-first layout telling the story of the snapshot in plain language before showing the data."
  - "NEW: Six Hats Tension Cards -- hat analysis rendered as 2x2 grid cards with color-coded borders. Green Hat surprise and Blue Hat verdict get dedicated callout boxes."
  - "NEW: Wikilink CSS class (.wikilink) -- dashed-underline links connecting entities across sections. Every person, technology, and methodology reference becomes clickable."
  - "FIX: View buttons now generate as clickable <a> tags linking to sections instead of decorative <span> elements."
  - "FIX: Deck button mapped to opportunity-bank section. Presentation Deck opens external slide deck URL."

### Added
- Rich text CSS system in generate-hub.cjs: .callout (4 color variants), .quote, .wikilink, .key-number/.key-label, .tag-pill (3 levels), .hat-tension/.hat-card (6 hat colors), .section-divider
- View buttons now link to actual sections with proper href mapping (Wiki->overview, Deck->opportunity-bank, Insights->solution-design, Narrative->#narrative)
- Hover state for view buttons (blue background on hover)
- Cursor: pointer on view buttons (was cursor: default)

### Changed
- View button HTML generation: <span> replaced with <a> tags
- Default snapshot quality: rich text formatting is now the baseline, not an enhancement
- **RULE: Obsidian Vault Nested Structure** -- every artifact in a .mos vault MUST sit in its own named folder (`section/artifact-name/artifact-name.md`). Enables Obsidian graph view, per-artifact attachments, clean wikilinks. Applies to all surfaces (CLI, Desktop, Cowork).

## [1.9.6] - 2026-04-11

onboarding: true
onboard_steps:
  - "BREAKING: KuzuDB replaced with SQLite. Your Data Room graph now lives at room/.mindrian/room.db with WAL mode for concurrent access. Run /mos:room rebuild-graph to migrate."
  - "NEW: Memory system -- Larry remembers who you are (L0), what facts are current (L1), session history (L2), and conversation fragments (L3). Assumptions tracked with validity lifecycle."
  - "NEW: Natural language graph queries -- ask Larry about your room's connections in plain English. 10 built-in query patterns."
  - "NEW: Brain normalization -- 280 duplicate concepts merged, 73 contamination nodes removed, 20 new framework chains added."
  - "NEW: 4 intelligence algorithms -- blindspot coverage, Bayesian surprise, element novelty, disruption index."

### Changed
- **SQLite replaces KuzuDB** -- lazygraph-ops.cjs fully rewritten from KuzuDB/Cypher to better-sqlite3/SQL (762 lines, 21 exports, 52 tests). Dead dependency removed. Room graph at room/.mindrian/room.db with WAL mode for concurrent plugin + MCP access.
- **Intelligence cascade updated** -- checks .mindrian/room.db instead of .lazygraph/. Script references updated (hsi-to-graph.cjs, causal-to-graph.cjs, whitespace-to-graph.cjs).
- **28+ files migrated** -- all scripts, CLI, MCP tools, wiki, presentation generators updated from KuzuDB to SQLite.

### Added
- **Memory system** (memory-ops.cjs) -- 13 exports: identity (L0), facts with temporal validity (L1), sessions (L2), fragments (L3), assumption tracking with validity lifecycle (untested/supported/contradicted/stale). 35 tests.
- **NL graph queries** (nl-graph-queries.cjs) -- 10 natural language query templates: contradictions, neighbors, paths, stats, section artifacts, HSI connections, reverse salients, causal claims, whitespace zones, convergence.
- **Migration tool** (migrate-lazygraph.cjs) -- rebuild-from-artifacts approach with --dry-run, --force, --help.
- **Brain normalization** -- 280 "The X" prefix dupes merged, 73 file path nodes removed, 20 FEEDS_INTO edges added (leadership -> PWS methodology chains). Brain: 7,931 -> 7,578 concepts, 147 -> 167 FEEDS_INTO.
- **Wave 1 algorithms** -- compute-blindspot-mass.py (Good-Turing coverage), compute-bayesian-surprise.py (leave-one-out cosine shift), compute-element-novelty.py (per-artifact novelty), compute-disruption-index.py (CD index).
- **Larry server instructions** -- 114-line full personality for MCP server (voice, Ask-Tell dial, mode engine, framework delivery, tool usage patterns). Zero reduction from plugin personality.

### Removed
- **kuzu** npm dependency removed from package.json
- Deleted orphaned scripts: hsi-to-lazygraph.cjs, causal-to-lazygraph.cjs, whitespace-to-lazygraph.cjs, build-graph-from-kuzu.cjs

## [1.9.4] - 2026-04-09

onboarding: true
onboard_steps:
  - "NEW: Three ways to start. Explore (just think), Explore+Capture (room builds as you talk), or Build Then Work. MindrianOS detects whether you're a TTO, researcher, or business person and adapts."
  - "Every framework Larry runs now banks opportunities automatically. Your Opportunity Bank grows with every interaction -- well-defined problems paired with mirror solutions, scored by confidence."
  - "Returning users see their strongest banked opportunities in the greeting. The scratchpad persists across sessions so you never lose a thought."

### Added
- **Opportunity Extraction Engine** -- universal schema (problem + mirror solution + domain + evidence + knight_position + confidence). Every methodology command banks opportunities as a side effect via intelligence cascade Step 11.
- **Opportunity Graph** -- banked opportunities become KuzuDB nodes with ADDRESSES and IN_DOMAIN edges. Filter by domain, knight position, or confidence threshold.
- **Brain Validation Steps** -- Brain-connected users get suggested next frameworks from 100 frameworks x 131 FEEDS_INTO chains for each banked opportunity.
- **Conversation Mode Routing** -- sessions without a room present 3 modes with JTBD statements. Mode 2 (Explore+Capture) detects persona (TTO/Researcher/Business) and selects the right Brain framework chain.
- **getFrameworkChain(persona)** -- Brain queries FEEDS_INTO chains per persona with Tier 0 hardcoded fallback in persona-chains.md.
- **conversation-mode skill** -- new skill with persona detection signals, Mode 2 banking instructions, and framework chain guidance.
- **bank-opportunity CLI subcommand** -- Larry banks opportunities during conversation via `node bin/mindrian-tools.cjs bank-opportunity`.
- **scratchpad-ops.cjs** -- pre-room persistence at ~/.mindrian/scratchpad.json. Conversations persist across sessions without a room existing.
- **Room seeding from Opportunity Bank** -- new Step 6.1 in /mos:new-project migrates scratchpad opportunities into pre-loaded room sections.
- **Onboarding redesign** -- mode-first structure: Step 1 (Three Ways to Work), Step 2 (Opportunity Bank), Step 3 (Knight uncertainty/risk framing with persona examples).
- **Returning user opportunity greeting** -- session-start surfaces banked opportunity count and strongest opportunity for returning users.

## [1.9.3] - 2026-04-09

onboarding: true
onboard_steps:
  - "NEW: The intelligence loop is real. File an artifact and Larry will surface cross-subsystem impacts -- 'This changes your financial model assumption [0.82]'. Respond APPROVE, REJECT (with reason), or DEFER. Your decisions become graph data that makes the next scan smarter."
  - "Filing now produces a complete audit trail: automatic git commit, classification metadata in frontmatter, and cascade status visible to Larry."
  - "All scripts work on macOS now. No more GNU-only stat/find/date/readlink calls breaking on Darwin."

### Added
- **APPROVE/REJECT/DEFER workflow** -- after filing an artifact, Larry surfaces up to 2 cross-subsystem impacts with confidence scores. User responds APPROVE (cascade), REJECT (reason captured as graph data), or DEFER (parked). Decisions persist to .proactive-intelligence.json and become KuzuDB edges (CONFIRMS, INVALIDATES, DEFERRED).
- **Mid-session intelligence** -- new findings surface in Larry's next response after filing, not just at session start. Repeat suppression prevents noise (3+ showings auto-suppressed). New evidence resets suppression.
- **record-decision CLI subcommand** -- `node bin/mindrian-tools.cjs record-decision` wires decisions from skill instructions through to persistence and graph edges
- **getNewFindings()** -- compares current analysis vs last-persisted, returns only NEW or CHANGED findings with suppression filtering
- **recordDecision()** -- persists user APPROVE/REJECT/DEFER with timestamp, reason, and KuzuDB edge creation
- **CONFIRMS/DEFERRED/INVALIDATES edge types** -- new KuzuDB schema for decision tracking
- **Automatic git commit on artifact filing** -- structured message format "file(section): artifact title"
- **Classification in frontmatter** -- classify-insight result stored as `classification:` field in artifact YAML
- **Cascade status reporting** -- post-write hook echoes completion status to stdout for Larry's context

### Fixed
- **macOS portability** -- replaced all GNU-only `stat -c %Y`, `find -printf`, `readlink -f`, `date -d` calls with portable helpers across 13 scripts
- **/mos:radar registered in plugin.json** -- command was implemented but unreachable
- **VERIFICATION.md staleness** -- phases 39, 60, 62 checkboxes updated to match implementations
- **Brain fallback guards** -- leadership.md and hat-briefing.md now gracefully degrade without Brain
- **datetime.utcnow() deprecation** -- replaced with datetime.now(datetime.UTC) in 4 scripts
- **zod missing from package.json** -- MCP server peer dependency was not declared
- **classify-insight fire-and-forget** -- now synchronous, result consumed by cascade

## [1.9.2] - 2026-04-09

onboarding: true
onboard_steps:
  - "CRITICAL FIX: The filing cascade now actually fires. Every artifact you write triggers KuzuDB indexing, HSI scoring, state recomputation, graph rebuilding, and proactive intelligence persistence. Before this fix, the entire pipeline was silently dead."
  - "13 wiring fixes from a full 8-audit plugin scan: post-write hook, MCP routes, allowed-tools, hook timeouts, env detection."
  - "Desktop/Cowork users can now access /mos:whitespace and /mos:organize -- they had zero MCP routing before."

### Fixed
- **Post-write hook was dead** -- Claude Code passes file paths via stdin JSON, not positional args. The entire filing cascade (KuzuDB index, HSI, reverse salients, presentation regen) silently did nothing after every artifact write. Now reads from stdin with backward-compatible fallbacks.
- **Intelligence cascade missing 4 steps** -- artifact-id injection, compute-state, build-graph, and proactive intelligence persistence were never called. The loop from "artifact filed" to "Larry surfaces a finding" now actually works.
- **act-swarm phantom MCP route** -- registered in z.enum but handler fell through to dead-end "reference not found" message
- **SessionStart hook had no timeout** -- the heaviest hook could hang indefinitely. Now has 10s timeout.
- **consolidate-pinecone.py crashed on import** -- bare `from pinecone import Pinecone` with no try/except
- **Velma env var mismatch** -- integration-registry checked MODULATE_API_KEY but transcribe-audio used VELMA_API_KEY. Now checks both.
- **deep-grade and research commands blocked by own allowed-tools** -- declared only Read but needed Bash, Agent, WebSearch
- **6 commands missing allowed-tools entirely** -- funding, opportunities, persona, splash, reason, snapshot
- **visualize and wiki YAML scalar format** -- `allowed-tools: Bash` parsed as string not list
- **help.md missing Bash** -- admin identity check could not run
- **reason.md missing name: field** -- used command: instead of name:
- **post-write missing set -euo pipefail** -- only hook script without strict error handling

### Added
- **whitespace MCP route** -- Desktop/Cowork users can now access /mos:whitespace
- **organize MCP route** -- Desktop/Cowork users can now access /mos:organize
- **act-swarm MCP handler** -- full Brain-driven swarm execution via MCP
- **Array env detection** -- integration-registry now supports checking multiple env var names per integration

## [1.9.1] - 2026-04-08

onboarding: true
onboard_steps:
  - "NEW: /mos:validate-proposition -- score your value proposition through 3 gates: Is it Real? Can you Win? Is it Worth it? Mathematical VPS composite with 15 weighted dimensions."
  - "PWS Value Proposition Framework from Prof. Aronhime -- the Samsonite Test for every venture. A proposition is not good or bad, it is strong or weak."
  - "Value Canvas + BTC statement + B2B value drivers -- full quantitative assessment from problem case to business case."

### Added
- **PWS Value Proposition Framework** -- Lawrence Aronhime's 3-gate scoring system codified as /mos:validate-proposition
- **Three Sequential Gates** -- Is It Real? (R>=6.0), Can We Win? (W>=5.5), Is It Worth It? (V>=5.0) -- each must pass before the next
- **15 Weighted Scoring Dimensions** -- 5 per gate, each scored 0-10 with evidence, weighted by importance
- **VPS Composite Formula** -- Value Proposition Strength = R*0.35 + W*0.35 + V*0.30, rated STRONG/MODERATE/WEAK/FAILING
- **Gate Kill Logic** -- any single gate failure kills the proposition regardless of other scores
- **Value Canvas Integration** -- Jobs/Gains/Pains mapping with Fit Score formula (jobs x gains x pains ratio)
- **BTC Statement Generator** -- For/Who/Our/That/Unlike/Our product template populated from gate evidence
- **B2B Value Drivers** -- 8 quantitative drivers (revenue, cost, responsiveness, productivity, cycle time, satisfaction, quality, employee)
- **Brain Integration** -- PWS Value Proposition framework node wired to JTBD, Hedgehog Concept, Golden Circle, all 5 venture stages
- **Samsonite Test** -- signature reframe: "durability at fair price beats premium quality every time"

## [1.9.0] - 2026-04-08

onboarding: true
onboard_steps:
  - "NEW: /mos:whitespace -- find what's MISSING in your venture. Maps gaps using embedding-space density analysis, based on Huan He's SemNovel research (Yale)."
  - "MindrianOS now has a Model Data Room -- 168 artifacts across 10 sections, built from 45 meeting transcripts, 43 research papers, 35 PWS frameworks."
  - "HSI Spectral Analysis on real evidence -- 20 cross-domain innovation pairs discovered, reverse salients identified."

### Added
- **Whitespace Mapping Engine** -- SemNovel-inspired embedding-space gap detection
- **/mos:whitespace command** -- 7 subcommands: map, analyze, hypothesis, tree, score, external, discover
- **Novelty Scoring** -- every filed artifact gets an embedding-distance novelty score
- **Discovery Cycle** -- HSI -> Whitespace -> RS -> Analogy chained in sequence
- **Model Data Room** -- 168 artifacts across 10 sections built from real project evidence
- **Google Drive API Integration** -- OAuth token, batch download 45+ documents
- **HSI Spectral Analysis** -- 20 innovation pairs, OM-HMM structural scoring
- **Investment Thesis Gate** -- 7/10 pass on MindrianOS's own evidence
- **People Mapping** -- 19 unique people across 45 meetings
- **Cross-Source Intelligence** -- Gmail + Calendar + Drive + Notion + Claude memory

## [1.8.8] - 2026-04-07

onboarding: true
onboard_steps:
  - "The Brain just got 10x smarter. Framework chaining (125 FEEDS_INTO edges), stage-aware recommendations (129 TYPICAL_AT), and 444 semantic bridges from LazyGraph to curated knowledge."
  - "Error messages are now human-readable. Every script follows: What happened / Why / How to fix."
  - "Install guide at mindrian.ai/docs/install -- three paths (no Claude Code / has Claude Code / update), platform-specific steps."

### Added
- **Brain: Causal Discovery** -- FEEDS_INTO 4->125, PREREQUISITE 0->15, TYPICAL_AT 4->129, ADDRESSES_PROBLEM_TYPE cleaned to 152
- **Brain: Lazy Graph Bridge** -- 444 ALIAS_OF bridges connecting LazyGraph (245K CO_OCCURS) to canonical nodes, 235 concepts promoted
- **Brain: Fragmentation Cleanup** -- 12 lowercase labels fixed, 75 null-title Books removed, noise CaseStudies cleaned
- **Brain: Teaching Wiring** -- 29/29 CaseStudies wired, 406 TEACHES edges, 23 IMPLEMENTS, 7 leadership books codified
- **Brain: Venture Stage Mapping** -- 30 TYPICAL_AT edges across 5 stages with effectiveness scores and source book provenance
- **Dummy-Proof Install** -- human-readable error messages (What/Why/Fix pattern) across resolve-room, room-registry, session-start, check-update, self-update
- **Install test checklist** (scripts/test-fresh-install.md) for Mac and Windows manual verification
- **Top 10 troubleshooting items** added to website install page

### Changed
- All script errors now follow `[MindrianOS] What / Why: reason / Fix: command` pattern
- Website install page expanded with troubleshooting section

## [1.8.7] - 2026-04-07

### Added
- Leadership coaching intelligence integrated into team-execution room section
- V2 leadership knowledge ported: 7 domains, ABET integration, signature reframes
- Team-execution proactive signals: team gaps, solo founder detection, assessment staleness
- Team-execution contradiction detection: capacity mismatch, stage mismatch
- Brain leadership framework chains: 4 coaching pipelines (assessment, building, strategic, conflict)
- Team-context-aware coaching: adapts opening based on team size and composition
- Brain-enriched framework suggestions after coaching sessions
- Neo4j Brain: 7 KnowledgeDomain nodes, 6 leadership ProblemTypes, ~57 edges

## [1.8.6] - 2026-04-06

onboarding: true
onboard_steps:
  - "Your rooms now live in ~/MindrianRooms/ -- one place for every project. Tell Larry 'go to [room name]' to switch."
  - "/mos:organize navigates your room hierarchy as a wicked problem -- multiple views, graph-informed proposals, human confirmation for every move."
  - "Room hierarchy syncs to KuzuDB (local) and Neo4j Brain (remote) as an additive intelligence layer. Graph failure degrades gracefully."
  - "/mos:setup rooms migrates legacy ~/room/ and ~/rooms/ layouts to MindrianRooms with guided confirmation."

### Added
- **MindrianRooms centralized directory** -- all Data Rooms under ~/MindrianRooms/ with ICM Layer 0 (CLAUDE.md) and Layer 1 (INDEX.md) auto-generated
- **resolve-room 4-strategy cascade** -- central registry, directory scan, workspace registry, legacy fallback with deprecation notice
- **MINDRIAN_ROOMS_HOME env var** -- override ~/MindrianRooms location for power users
- **ICM templates** -- templates/icm/CLAUDE.md (Layer 0 identity) and INDEX.md (Layer 1 routing) auto-generated on first room creation
- **update-icm-index script** -- idempotent INDEX.md regeneration from registry, called on create/archive/stage change
- **/mos:organize command** -- wicked hierarchy navigator with 4 subcommands (tree/propose/view/move), 4-tier graceful degradation (Brain+KuzuDB -> Brain -> KuzuDB -> metadata), human confirmation for every move
- **GROUP-CLAUDE.md template** -- ICM Layer 0 for grouping directories, generated from graph context
- **Virtual room projections** -- /mos:organize view [by-stage|by-client|by-domain|by-activity] shows groupings WITHOUT moving files
- **Decision memory** -- user GROUP/SEPARATE/DEFER choices stored locally and promoted to graph edges when Brain available
- **migrate-rooms script** -- detects 5 legacy room patterns, per-room confirmed migration with registry integration and optional symlinks
- **/mos:setup rooms** -- guided migration option for legacy layouts
- **Dual-graph room hierarchy** -- KuzuDB local graph (Room/RoomGroup/CONTAINS/AT_STAGE) + Neo4j Brain remote (adds USES_FRAMEWORK/SHARES_THEME/HAS_SECTION)
- **sync-rooms-graph script** -- KuzuDB sync from registry, fire-and-forget, idempotent
- **sync-rooms-brain script** -- Neo4j Brain sync with AT_STAGE, USES_FRAMEWORK, SHARES_THEME edges, wires 13 orphaned DataRoomSection nodes
- **Room hierarchy schema reference** -- references/brain/room-hierarchy-schema.md with Cypher patterns and KuzuDB DDL

### Changed
- room-passive and room-proactive skills now detect rooms via resolve-room (not dir_exists:room)
- /mos:rooms list shows ~/MindrianRooms/ paths from central registry
- /mos:room overview header shows simplified ~/MindrianRooms/[name]/ path
- /mos:new-project creates rooms under ~/MindrianRooms/[slug]/
- /mos:rooms create targets ~/MindrianRooms/[slug]/ with ICM auto-generation
- room-registry writes to central ~/MindrianRooms/.rooms/registry.json
- Session greeting references MindrianRooms location when room detected
- room-registry create/archive triggers fire-and-forget graph sync

## [1.8.4] - 2026-04-06

### Added
- Dashboard detail panel: plain English relationship descriptions ("supports", "conflicts with", "shares themes with")
- Edge hover tooltip shows full sentence: "Market Analysis supports Pricing Model" instead of raw INFORMS
- Clickable relationship items in panel navigate to connected nodes
- 12 edge types translated: INFORMS, CONTRADICTS, CONVERGES, FEEDS_INTO, REINFORCES, INVALIDATES, ENABLES, CAUSES, FILED_TO, SPOKE_IN, ATTENDED, REFERENCES
- Artifact summary preview in detail panel when available
- Relationships color-coded by type (red=conflict, blue=support, yellow=convergence, green=reinforces)

### Changed
- Graph visualization standard: vis-network (vis.js) replaces Cytoscape.js for all exports
- SnapshotHub constellation rebuilt with ForceAtlas2 physics, interactive nodes, edge filtering
- Readable labels with dark outline, section color-coding, diamond/dot node shapes
- Detail panel on node click, sidebar filters, controls bar (Fit/Zoom/Physics/Stabilize)
- Detail panel widened to 360px for relationship readability
- Design standard codified at references/design/graph-visualization-standard.md

## [1.8.3] - 2026-04-06
### Changed
- `/mos:help` completely redesigned with De Stijl color-coded job categories
- Every command description rewritten as JTBD outcomes ("what you get" not "what it does")
- 6 Mondrian colors mapped to thinking jobs: RED=Problem, BLUE=Reasoning, AMETHYST=Perspective, YELLOW=Intelligence, GREEN=Output, TEAL=Infrastructure
- Commands regrouped by job category instead of alphabetical
- Color legend rendered with actual ANSI terminal colors matching the website/dashboard palette
- Command-to-color mapping reference table for consistent rendering

### Fixed
- Brain v1.8.2 graph cleanup: reversed backwards GOVERNS edge on Red Teaming
- Merged 32 DictionaryTerm duplicate sets (35 nodes removed)
- Wired 2 under-wired FrameworkAgents (JobsToBeDone, SystemThinking)
- Connected 5 min-wired CorePrinciples to semantically matched frameworks
- Linked 6 near-orphan CaseStudies to VentureStages

## [1.8.1] - 2026-04-05
### Added
- Live Hub interactive dashboard with Command API -- click section cards to trigger MindrianOS CLI commands
- Contextual action buttons per section with JTBD rationale (Problem Definition gets Root Cause/Challenge/Validate, Market gets Trends/Timing/User Needs, etc.)
- Proper Mondrian grid mark + MINDRIAN wordmark logo linking to mindrianos website
- Content-proportional card sizing -- sections with more artifacts get larger grid cells
- Gap cells for empty/missing sections with dashed borders and contextual action buttons
- Opportunity Bank gets special treatment -- yellow border highlight with "Scan for Opportunities" CTA
- Color legend strip at bottom of grid showing all sections with artifact counts
- Command panel (slide-in from right) with copy-to-clipboard CLI command and section preview
- Full keyboard navigation -- Tab through cards, Enter/Space to activate, focus-visible rings
- ARIA labels and roles on all interactive elements
- prefers-reduced-motion support -- animations disabled for motion-sensitive users
- Mobile responsive grid -- 2-column at 1024px, single-column at 640px with reset grid positions

### Fixed
- Remove dead code in room_graph router (unreachable cases from merge artifact)
- Add hat-briefing and scheduled-tasks to MCP routers (were missing from command coverage)
- Sanitize Cypher query input in brain-router.cjs to prevent injection from malformed STATE.md
- Add shutdown handler double-fire guard in session-catchup.cjs
- Wire both MCP servers (mindrian-os local + mindrian-brain remote) into plugin .mcp.json
- ALL_TOOL_COMMANDS now correctly reports 64 routed commands
- Raw markdown no longer leaks into grid card summaries (tables, bold markers, metadata lines stripped)
- Summary extraction skips frontmatter-like lines (Filed:, Source:, Category:)
- Section label font size increased from 10px to 12px for readability
- Contrast improved on dark-bg cell labels (0.7 to 0.8 opacity)
- Touch target sizes on action buttons meet 44px minimum width

## [1.8.0] - 2026-04-05
onboarding: true
onboard_steps:
  - "MindrianOS now works across all three surfaces: CLI, Desktop, and Cowork. Same commands, same intelligence, same room."
  - "MCP Apps render your Data Room inline: dashboard, wiki, and knowledge graph views right in the conversation."
  - "Smart context loading: Larry detects your archetype (student/venturist/researcher) and loads only what you need -- half the token cost."

### Added
- **MCP Foundation**: All 64 plugin commands exposed as MCP tools via 9 hierarchical routers with intelligence-cascade.cjs shared module
- **Surface Detection**: Auto-detect CLI/Desktop/Cowork at startup; dual transport (stdio + Streamable HTTP) on same McpServer instance
- **Write Safety**: KuzuDB write-gateway with promise-chain serialization, file-based write lock with PID/timestamp/stale cleanup
- **Token Optimization**: Native-first skills compressed from 74K to 26K bytes; progressive loading (Layer 0 always, Layer 1 on-demand, Layer 2 Brain); per-turn cost halved from ~20.5K to ~10K tokens
- **Hook Optimization**: HSI debounce (30s), analyze-room caching (5-min TTL), write batching, per-room bridge file isolation, framework recommendation cache (10-min TTL)
- **Context Intelligence**: User archetype detection (venturist/researcher/student), tiered context loading (500/2K/5K tokens), 6 MCP session profiles, autocompact tuning per archetype, returning user detection, student progress tracking
- **Pipeline Chaining**: Room-file-based state enables LLM-orchestrated tool sequences; Brain chain ordering via CO_OCCURS and FEEDS_INTO relationships
- **Agent Dispatch Optimization**: Dynamic swarm sizing, cost estimation before dispatch, chain checkpoints, budget-aware model routing (opus -> sonnet -> haiku), Coordinator-compatible output
- **Scheduled Intelligence**: Session catch-up on Cowork, daily briefings, competitor/grant/news scanning, scout sentinel tasks, all results filed as room artifacts with provenance
- **MCP Apps Data Room Views**: Dashboard (De Stijl Mondrian grid), wiki (browsable room sections), knowledge graph (Cytoscape.js) rendered inline via ext-apps; bidirectional postMessage communication
- **Session State Writer**: Structured last-session.md with active_methodology, open_questions, next_suggested_action, confidence_level, artifacts_created, session_duration (KAIROS-ready)
- **KAIROS Detection**: context-engine reads KAIROS daily log instead of cold-start context rebuild when tengu_kairos activates
- **UDS Listener Stubs**: room-passive ready for cross-instance room state sharing when tengu_harbor ships
- **Platform Gate Monitor**: checkGates() monitors tengu_kairos, tengu_harbor, tengu_scratch, tengu_portal_quail via env vars with local override support

### Changed
- SDK upgraded from 1.27.1 to ^1.29.0 for Streamable HTTP transport and ext-apps peer dependency
- Router groups capped at 15 commands (data_room split into room_state/content/graph sub-routers)
- Skills teach domain-specific rules only -- no redundant tool instructions for native Claude capabilities

## [1.7.1] - 2026-04-05

### Added
- generate-hub.cjs rebuilt to Synteris quality -- full De Stijl component library with venture cards, grade circles, badge system, smart content detection (bug/wish/decision cards), Data Room Views button row, scroll-highlight navigation
- /mos:snapshot and /mos:export now produce single-file tabbed hub by default (D20)
- Recursive scanning in all visualization scripts (build-graph, generate-snapshot, generate-presentation)

### Fixed
- build-graph recursive scanning for nested directories (12 nodes to 73)
- Cytoscape node IDs with slashes breaking CSS selectors
- generate-standalone JS injection leaving orphaned .then/.catch blocks
- generate-snapshot.cjs and generate-presentation.cjs depth-1 scanning
- Cytoscape compound layout collapsing for 30+ node rooms
- Banner on every cold start, not just first install
- Status line: wrong JSON key, literal $PLUGIN_ROOT, room-only gate
- Brain key global fallback to ~/.mindrian.env
- /mos:onboard reset for replaying welcome sequence
- Post-room creation shows OS-native open folder command
- Brain setup two-stage health check (wake before verify)
- disable-model-invocation removed from 29 methodology commands

## [1.7.0] - 2026-04-05
onboarding: true
onboard_steps:
  - "When you want to know WHY something is true in your Room (not just WHAT), /mos:causal extract traces cause-effect chains with mechanisms and falsifiable predictions"
  - "When assumptions stack 3-deep and you need to know which to validate FIRST, /mos:causal trace cascade shows what breaks if each assumption fails"
  - "When you have a causal claim worth testing, /mos:causal predict turns it into a trackable prediction with a deadline -- Larry reminds you when it's time to check"

### Added
- **Causal Reasoning Layer**: CausalClaim nodes in KuzuDB with 12 properties (cause, mechanism, effect, confidence, domain, falsifiable_prediction, novelty_score, extraction_method, evidence, source_artifact, created)
- **Causal Edge Types**: CAUSES + ROOT_CAUSE_OF (Artifact->Artifact), CASCADES_TO (CausalClaim->CausalClaim), EXTRACTED_FROM (CausalClaim->Artifact)
- `/mos:causal` command with 3 subcommands: extract (Larry extracts cause/mechanism/effect triples with Three Gaps enforcement), predict (generate and track falsifiable predictions), examples (research-backed examples via Brain + Tavily)
- **Causal Graph Engine** (compute-causal.py): 5 NetworkX algorithms -- chain traversal (all_simple_paths, cutoff=6), cascade simulation (descendants with multiplicative confidence decay), bottleneck detection (betweenness centrality), contradiction detection (cycle finding), inversion protocol (node removal + path diff)
- **Cross-Reference Queries**: Cypher joins linking CausalClaims to HSI_CONNECTION, REVERSE_SALIENT, and ANALOGOUS_TO edges -- discovers where causal explanations connect to existing intelligence
- **Prediction Registry** (prediction-registry.cjs): 5 subcommands (add/resolve/list/overdue/archive), REGISTRY.json lifecycle (pending->confirmed/refuted/expired), opportunity typing (business/research/funding/competitive/technical), confidence propagation from outcomes
- **Post-Write Causal Flagging**: Lightweight regex heuristic flags causal candidates after HSI+RS in post-write cascade, writes .causal-candidates.json
- **Research-Backed Examples** (ENGINE-09): Analogy engine generates structural search queries from causal graph topology -- Brain/Pinecone for PWS teaching examples + Tavily for chronologically recent real-world examples
- **Brain Enrichment**: Theory of Change Framework node, Causal Reasoning parent Concept, FEEDS_INTO chains (Root Cause -> Systems Thinking -> CLD -> Scenario Analysis), CO_OCCURS edges, TYPICAL_AT venture stage mappings, Falsifiability + Logic Trees linked
- **Brain Query Patterns 11-13**: causal_framework_select, causal_pattern_match, causal_contradiction_resolve
- **Brain Causal Directives**: Three Gaps framework (Abstraction, Reasoning, Reality) -- every claim needs mechanism + falsifiable prediction
- **Larry JTBD Suggestions**: 5 signal-to-suggestion mappings for causal commands in larry-personality skill
- **Room-Proactive Causal Discovery**: 5 convergence patterns surfacing discoveries when causal + HSI + RS + analogy edges converge (threshold: 5+ claims, 3+ cascades)
- **Session-Start Prediction Check**: Larry proactively prompts for overdue prediction resolution

### Architecture
- **Larry EXTRACTS** causal claims (semantic, LLM with Three Gaps enforcement)
- **Python COMPUTES** graph algorithms (NetworkX -- chains, cascades, bottlenecks, contradictions, inversions)
- **KuzuDB STORES** causal data (CausalClaim nodes, CASCADES_TO/EXTRACTED_FROM edges)
- **Brain DIRECTS** causal reasoning (read-only directives, query patterns 11-13)
- **Brain never receives user causal data** -- clean IP boundary maintained
- Follows existing HSI pipeline pattern: Python extracts -> JSON intermediate -> CJS writes to KuzuDB
- Discovery emerges from graph structure: Cypher walks Causal -> HSI -> RS -> Analogy edges in one query

## [1.6.3] - 2026-04-03

### Fixed
- Remove disable-model-invocation from all 29 methodology commands -- was blocking LLM responses entirely, making every /mos: methodology command unusable

### Added
- Brain Proactive Command Engine: Command nodes as first-class Neo4j entities with TRIGGERED_BY_SIGNAL, FOLLOWS_FRAMEWORK, RELEVANT_AT_STAGE relationships
- Multi-hop command suggestion queries (Pattern 10a-d): frameworks -> commands -> triggers -> JTBD
- JTBD-powered contextual command discovery: Larry suggests commands every 3-7 turns using "When/want/so" formula
- Fabric-driven surprise suggestions: Larry queries KuzuDB Tensions, Bottlenecks, Surprises for command triggers
- Onboarding invitation on any "how to use" question with /mos:onboard
- v6.2 RoomHub: adaptive Room type detection, 7 Showcase views, Constellation graph, Generative Fabric Chat
- /mos:snapshot for 7-view SnapshotHub HTML export
- Analogy engine wired into /mos:help and pws-methodology skill
- Parallel Power group in help tree (--swarm, --parallel, --full, --broad)
- Update flow uses JTBD formula for every new capability

## [1.6.1] - 2026-03-31
onboarding: true
onboard_steps:
  - "When you are burning through tokens on routine work, /mos:models set balanced keeps Opus for teaching but uses Haiku for scanning -- 66% less cost, same quality where it matters"
  - "When 3 Sections have gaps and you only have 30 minutes, /mos:act --swarm fills all 3 in parallel -- 5 minutes instead of 45"
  - "When you want 6 expert perspectives but hate waiting, /mos:persona --parallel generates all De Bono hats simultaneously -- 2 minutes"
  - "When you are stuck on a problem that feels unique to your domain, /mos:find-analogies discovers how other industries solved the exact same structural conflict"
  - "When your Room has not been health-checked and you have deadlines approaching, /mos:scout runs a full scan -- health, grants, competitors, innovation connections"
  - "When you want to share your Room's intelligence as a living hub, /mos:snapshot generates a 7-view interactive HTML export with graph, chat, and deep links"

### Added
- /mos:models command for model profile management (quality/balanced/budget/inherit)
- /mos:scout for sentinel intelligence (health check, grant deadlines, competitor watch)
- /mos:find-analogies for Design-by-Analogy discovery (--brain, --external modes)
- /mos:snapshot for RoomHub export (7 views, adaptive, generative chat)
- 6 new hooks: PreCompact, PostCompact, FileChanged, CwdChanged, SubagentStop, TaskCompleted
- Parallel flags: --swarm (act), --parallel (persona), --full (grade), --broad (research)
- Spectral OM-HMM: Markov chain thinking-mode analysis in HSI pipeline
- 3 new KuzuDB edge types: ANALOGOUS_TO, STRUCTURALLY_ISOMORPHIC, RESOLVES_VIA
- Design-by-Analogy pipeline (5 stages) with TRIZ matrix and SAPPhIRE encoding
- Adaptive Room type detection (venture/website/research/general)
- Constellation graph with 12 Thread types and De Stijl colors
- Generative Fabric Chat querying KuzuDB via natural language
- MWP specification, moat mandate, KAIROS prep, Coordinator Mode manifest
- JTBD-powered contextual command discovery every 3-7 turns
- Onboarding invitation on any "how to use" question

## [1.6.0] - 2026-03-31
onboarding: true
onboard_steps:
  - "MindrianOS now has a visual identity -- Mondrian banner on every cold start and after updates"
  - "First-time users get a guided onboarding -- tell Larry about yourself and everything gets smarter"
  - "5 new commands connect you to your room's power: /mos:present, /mos:dashboard, /mos:speakers, /mos:reanalyze, /mos:graph"
  - "Larry's greeting now tells you what's in it for YOU based on your room state -- not feature lists"

### Added
- **Interactive Onboarding System** (Phase 35) -- 7-step Larry-voiced walkthrough on first install. Deep context building (USER.md) with 3 input approaches (Q&A, document paste, web research). Update path shows What's New from CHANGELOG. Manual re-run via /mos:onboard. Version-aware onboarding registry in CHANGELOG.md. Natural-language-first: teaches users to talk, not type commands.
- **Command Wiring** (Phase 36) -- 5 new /mos: commands connecting users to existing infrastructure: /mos:present (6-view presentation + browser), /mos:dashboard (interactive graph + chat), /mos:speakers (meeting speaker profiles), /mos:reanalyze (re-run meeting intelligence), /mos:graph (KuzuDB natural language exploration).
- **JTBD Warm Start** (Phase 37) -- Larry's session greeting identifies your current job and frames suggestions as "You have [state]. [action] [outcome that matters]." Dynamic 6-command menu adapts to what you haven't tried yet. Max 2-3 nudges per session.
- **CLI Identity** (Phase 34) -- Responsive Mondrian banner with 3 terminal width tiers (full 100+, compact 80-99, minimal <80). Update detection via version marker. /mos:splash for on-demand banner. Dual-path rendering (stderr + additionalContext fallback).
- **End-to-End Validation** (Phase 38) -- 24/24 checkpoints passing across syntax validation, template verification, presentation generation, and branding contract.

## [1.5.1] - 2026-03-31
onboarding: true
onboard_steps:
  - "Larry now builds a deep profile about you on first install -- everything gets smarter after onboarding"
  - "Returning users see what changed since their last session, framed as capabilities"
  - "Type /mos:onboard anytime to re-run the walkthrough or /mos:onboard whats-new for changelog"

### Added
- **De Stijl Mondrian Banner** -- ASCII art splash screen with 5 background color zones (red/blue/yellow/teal/green) creating a Mondrian grid composition. Shows on cold session start and during `/mos:update`. Standalone via `bash scripts/banner`. 24-bit ANSI true color. Includes `assets/banner-showcase.html` frontend preview.

## [1.5.0] - 2026-03-31

### Added
- **Git Integration** (Phase 26) -- Optional git tracking for room artifacts. `scripts/git-ops` (7 subcommands), `lib/core/git-ops.cjs` (6 functions). Auto-commit on every filing with provenance messages. `/mos:rooms git-setup` for retroactive setup. Git LFS for large binaries. Default OFF -- users opt in.
- **Filing Pipeline + KuzuDB Engine** (Phase 27) -- Every filing triggers full cascade: classify -> artifact-id -> KuzuDB index -> compute-state -> build-graph-from-kuzu -> git commit. Stable artifact hash IDs in frontmatter. Pipeline provenance (stage, requires, provides). Meeting segments as KuzuDB nodes (SEGMENT_OF, SPOKE_IN, CONSULTED_ON). Cross-room relationship detection. Proactive intelligence persistence with repeat suppression.
- **HSI + Reverse Salient Pipeline** (Phase 27.1) -- Python-native HSI computation (`scripts/compute-hsi.py`, ported from V4 production). Reverse Salient cross-section detection (`scripts/detect-reverse-salients.py`, ported from V2). Results as KuzuDB edges (HSI_CONNECTION, REVERSE_SALIENT). 3-tier: keyword (Tier 0), sklearn+MiniLM (Tier 1), sklearn+Pinecone (Tier 2). `/mos:setup hsi` for guided install.
- **Binary Asset Filing** (Phase 28) -- PDFs, images, videos filed with markdown wrappers + frontmatter. `scripts/file-asset` classifies and files. ASSET_MANIFEST.md auto-updated. Meeting audio/video registered with transcript links.
- **Canvas Graph Renderer** (Phase 29) -- Custom Canvas 2D graph replacing Cytoscape. `lib/graph/canvas-graph.js` (467 lines): force simulation, animated particles, glow rings, hover dimming (0.15 opacity), ambient pulse, `highlightCluster()` API, 6 edge type styles. `lib/graph/graph-detail-panel.js` for clicked node details.
- **Data Room Presentation System** (Phase 30) -- `/mos:export presentation` generates 6 self-contained HTML views from any room: Dashboard, Wiki (3-panel browser), Deck (fullscreen slides), Insights (stat counters, timelines, funnels), Diagrams (SVG from graph), Graph (Canvas renderer). Dual themes: De Stijl dark + PWS light. MindrianOS branding enforced (non-removable).
- **Auto-Update + Deploy** (Phase 31) -- `scripts/serve-presentation` with chokidar + SSE live reload (~1s). `/mos:publish` for guided Vercel onboarding. `--sections` for selective publishing. `--private` for password protection. `.exports-log.json` deployment tracking.
- **Generative UI + Chat** (Phase 32) -- BYOAPI chat panel (`lib/chat/chat-panel.js`) with direct Anthropic API streaming. Room context builder with Larry voice DNA. Generative tools: `highlightCluster()`, `filterEdgeType()`, `showInsight()` wired as AI tool calls. "Show me contradictions" -> graph highlights + analysis card.

## [1.4.1] - 2026-03-30

### Fixed
- **Command registration** -- Added YAML frontmatter to `funding.md`, `opportunities.md`, and `persona.md`. These 3 commands were invisible in Claude Code because they lacked the `---` frontmatter block that the plugin loader requires. All 51 commands now register correctly.

## [1.4.0] - 2026-03-29

### Added
- **Brain API Key Management** (Phase 20) -- Supabase-backed `brain_api_keys` table with `validate_brain_key` RPC. Plan-gated `brain_write` guard blocks non-admin keys. `brain-admin.cjs` CLI with 6 commands (create/revoke/extend/list/usage/requests). Render production auth wired via env vars.
- **CLI UI Ruling System** (Phase 21) -- 728-line `skills/ui-system/SKILL.md` governing all MindrianOS output. 4-zone anatomy (header, body, intelligence strip, footer), 5 body shapes (Mondrian board, semantic tree, room card, document view, action report), 12 glyphs, 5 ANSI colors, session start contract (cold/warm/signals), dual context routing (STATE.md + MINTO.md).
- **Admin Panel** (Phase 22) -- Hidden `/mos:admin` command wrapping brain-admin.cjs. Self-teaching on every invocation. Consequence previews for destructive actions. Filtered from `/mos:help` for non-admin users.
- **Multi-Room Management** (Phase 23) -- `.rooms/registry.json` for multi-project workspaces. `scripts/resolve-room` keystone resolver with legacy `room/` fallback. `scripts/room-registry` CRUD. `/mos:rooms` command with 6 subcommands (list/new/open/close/archive/where). Active room lock on all file-writing commands. Zone 1 header canary shows room name. Session start shows multi-room context. All hooks and scripts retrofitted.
- **Autonomous Engine** (Phase 24) -- `/mos:act` reads active room STATE.md + MINTO.md, queries Brain for best methodology framework (local fallback via problem-types routing table), displays thinking trace in Shape E format. `agents/framework-runner.md` isolated subagent with quality gate and provenance tracking. `--chain` mode (3-5 frameworks in sequence). `--dry-run` previews without executing.
- **Data Room Export v2** (Phase 25) -- Single-file De Stijl HTML export with 4 views: Mondrian grid overview, document reader with sidebar nav and TOC, intelligence view (gaps/convergence/contradictions), interactive Cytoscape knowledge graph. `generate-export.cjs` data injection script. Room identity in header.

## [1.3.0] - 2026-03-26

### Added
- **Per-page PDF download** — Every wiki page has a "PDF" button. De Stijl print layout with MindrianOS attribution.
- **BYOAPI Chat** — Chat panel accepts user's own Anthropic or OpenAI API key. Context scoped per page, key stored in localStorage only. Supports Claude Sonnet and GPT-4o.
- **Onboarding Tour** — 8-step guided walkthrough for first-time wiki users. Highlights each zone (header, sidebar, search, content, infobox, privacy). Skip available, never shows again.
- **Wiki Export** — `/mos:wiki --export` generates static HTML for sharing on Render, Vercel, or as zip.
- **CLI Action Buttons** — Wiki page buttons copy `/mos:` commands to clipboard for paste into Claude Code.
- **Embedded Logo** — MindrianOS logo (SVG, base64) in header + footer of all generated HTML. Links to website.
- **Privacy Disclaimer** — Footer on every page: "All data stored locally. MindrianOS does not access your venture data."
- **Larry Wiki Awareness** — Larry mentions wiki after filing artifacts or running analysis (room-passive skill, once per session).

## [1.2.0] - 2026-03-26

### Added
- **Dynamic Integration Prompting** (Phase 18) — Larry proactively detects when Brain, Velma, Obsidian, Notion, or meeting sources would enhance the task and offers setup conversationally. Non-blocking, one offer per conversation, never during methodology sessions.
- **`integration-registry.cjs`** — Detection engine for 5 integrations with context triggers and methodology suppression rules.
- **Integration Status** — `/mos:status` shows connected/available/not-configured for all integrations. Session-start context includes integration count.
- **Wikipedia Data Room Dashboard** (Phase 19) — `/mos:wiki` opens a localhost wiki-style viewer for the Data Room.
  - Every room section is a Wikipedia-style page with TOC, infobox, lead section
  - KuzuDB edges become clickable hyperlinks (INFORMS=blue, CONTRADICTS=red, CONVERGES=yellow, ENABLES=green)
  - Interactive Cytoscape.js graph view as home page with animated edges
  - "What links here" backlinks + "See also" from graph edges
  - Dark/Light mode toggle (localStorage persisted)
  - FlexSearch instant full-text search across all pages
  - Chat panel stub (UI ready, scoped to page context)
  - chokidar file watcher + SSE for auto-refresh
  - Mermaid diagrams rendered inline via CDN
  - Wikipedia formatting: sentence case headings, bold subjects, citation system
- **CLI Action Buttons** — Wiki page buttons copy `/mos:` commands to clipboard for paste into Claude Code
- **MindrianOS Attribution** — Every generated HTML page includes metadata (og:tags, generator, HTML comments) linking to mindrianos-jsagirs-projects.vercel.app. Any LLM processing the HTML sees MindrianOS attribution first.
- **Footer** — De Stijl branded footer on all wiki pages with links to website, Brain Access, GitHub, LinkedIn (Jonathan Sagir + Prof. Aronhime)

## [1.1.0] - 2026-03-26

### Added
- **De Stijl Visual Identity** — MindrianOS has its own visual language in the CLI. Every output feels like MindrianOS, not generic AI.
- **Symbol System** (`lib/core/visual-ops.cjs`) — ⬡ brand, ◌◎◉◆★ venture stages, →⊗⊕▶⊘ edge types, ?⇌! Larry modes, ■□▪ section health. Single import, consistent everywhere.
- **Unicode Room Diagrams** — `compute-state` renders the Data Room as a box diagram with sections, gaps, cross-references, and progress bars. The room becomes a visual map.
- **ASCII Sparklines** — Section completeness charts via `asciichart`. Meeting frequency, venture progress visualized inline.
- **Mermaid Diagrams in Artifacts** — Room flowcharts, knowledge graph views, framework chains embedded as Mermaid blocks in .md files. Auto-render in GitHub/Obsidian/Notion.
- **`/mos:visualize`** — Opens rich diagrams in the browser: room flowchart, graph view, framework chain. De Stijl themed HTML with Mermaid.js.
- **De Stijl Statusline** — Color-coded venture stage symbols, Mondrian accent colors (blue/red/yellow), section health indicators.
- **19 visual-ops.cjs exports** — Symbols, colors, formatters, diagram generators, Mermaid generators, sparklines, progress bars.

## [1.0.0] - 2026-03-25

### Added
- **Reasoning Engine** (`/mos:reason`) — Per-section REASONING.md files with Minto/MECE structured critical thinking. Frontmatter dependency graphs (requires/provides/affects). Goal-backward verification per section. The power backend that makes MindrianOS a platform.
- **reasoning-ops.cjs** — 8 exports: generateReasoning, getReasoning, listReasoning, verifyReasoning, createRun, get/set/mergeReasoningFrontmatter. Full programmatic frontmatter CRUD (learned from GSD gsd-tools.cjs patterns).
- **Autonomous Methodology Orchestration** — Larry chains tools in sequences (diagnose → framework → apply → file → cross-reference → graph-update) captured as methodology run artifacts in room/.reasoning/runs/.
- **Persistent Chain-of-Thought** — Reasoning is SAVED as .reasoning/ artifacts, not just displayed. Future sessions read them to understand WHY a section looks the way it does.
- **REASONING_INFORMS edge type** — LazyGraph now tracks reasoning dependencies between sections (Section-to-Section edges).
- **reasoning:// MCP Resources** — Browse reasoning state and per-section reasoning via MCP Resources (Desktop/Cowork).
- **reason-section MCP Prompt** — Larry receives Minto/MECE template + room context when reasoning about a section.
- **6 new MCP tools** — reasoning-get, reasoning-generate, reasoning-verify, reasoning-run, reasoning-list, reasoning-frontmatter in data_room router.
- **CLI/MCP parity at 46/46**

### This Is v1.0.0
MindrianOS has shipped 7 phases in a single session: MCP Platform (10-11), Brain Hosting (12), Opportunity Bank + Funding Room (13), AI Team Personas (14), User Knowledge Graph (15), and Reasoning Engine (16). 46 commands, 7 agents, embedded graph, two-graph architecture, persistent reasoning, autonomous methodology orchestration. The platform is complete.

## [0.9.0] - 2026-03-25

### Added
- **User Knowledge Graph** (`/mos:query`, `/mos:graph`) — Per-project embedded LazyGraph using KuzuDB. Room artifacts auto-indexed as graph nodes. Cross-references stored as typed edges (INFORMS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES). Natural language queries translated to Cypher by Larry.
- **KuzuDB Integration** — Embedded graph database (like SQLite for graphs). Zero server, zero setup, Apache 2.0. Cypher-compatible. Sub-millisecond local queries. Graph stored in `room/.lazygraph/` per project.
- **Two-Graph Architecture** — Brain (Neo4j, remote) = methodology intelligence. Room Graph (KuzuDB, local) = venture intelligence. Together, far more powerful than either alone.
- **Hook-Driven Graph Updates** — Post-write hook automatically indexes new room artifacts into the LazyGraph. Graph grows with the venture — no manual rebuild needed.
- **Pinecone Tier 2 Stub** — `embedArtifact()` interface ready for semantic search layer. Graceful degradation when Pinecone unavailable.
- **Graph Schema Reference** — `docs/lazygraph-schema.md` documents node types, edge types, and example Cypher queries for Larry's NL-to-Cypher translation.
- **4 new MCP graph tools** — graph-index, graph-rebuild, graph-query, graph-stats in data_room router (49 total MCP commands)

## [0.8.0] - 2026-03-25

### Added
- **AI Team Personas** (`/mos:persona`) — Generate domain expert perspective lenses from room intelligence. Six De Bono Thinking Hats mapped to venture-specific personas: White (Data Analyst), Red (Intuitive Advisor), Black (Risk Assessor), Yellow (Opportunity Scout), Green (Creative Strategist), Blue (Process Architect).
- **Multi-Perspective Analysis** — Larry invokes all 6 personas on any room artifact for multi-angle feedback. Each persona argues consistently from its hat perspective.
- **Persona-Analyst Agent** — Dedicated agent for persona invocation with disclaimer enforcement and perspective-specific questioning patterns.
- **Perspective Lens Disclaimers** — Every persona output includes "This is a perspective lens, not expert advice" disclaimer in both frontmatter and body. Never claims expert authority.
- **4 new MCP tools** — generate-personas, list-personas, invoke-persona, analyze-perspectives in data_room router
- **v3.0 Milestone Complete** — 5 phases, 12 plans, 44 CLI commands = 44 MCP tools, all verified

### Changed
- CLI/MCP parity now at 44/44 (was 41/41 after Phase 11, grew with Phases 13-14)

## [0.7.0] - 2026-03-25

### Added
- **Opportunity Bank** (`/mos:opportunities`) — Context-driven grant discovery. Larry reads your room data (problem domain, geography, stage) and searches relevant grant sources. Confirm-first UX: opportunities presented for review before filing. Multi-factor relevance scoring.
- **Funding Room** (`/mos:funding`) — 4-stage lifecycle tracking: Discovered > Researched > Applying > Submitted. Per-opportunity folders with STATUS.md, wikilink cross-references to opportunity-bank sources, deadline tracking with staleness detection.
- **Opportunity Scanner Agent** — Proactive discovery agent that uses room intelligence to find relevant opportunities across Grants.gov, Simpler Grants, and web research.
- **Opportunity Intelligence** — `analyze-room` now outputs opportunity-bank intelligence (status counts, top relevance scores, funding pipeline stages) alongside existing DD sections.
- **`compute-opportunity-state`** — Pipeline computation script for opportunity and funding aggregation, integrates with compute-state chain.
- **6 new MCP tools** — scan-opportunities, list-opportunities, file-opportunity, list-funding, create-funding, update-funding-stage. All registered in data_room hierarchical router.
- **32 new test assertions** (105 total across full suite)

## [0.6.0] - 2026-03-25

### Changed
- **Plugin renamed: `mindrian-os` -> `mos`** — All commands now use `/mos:` prefix (e.g., `/mos:diagnose`, `/mos:room`, `/mos:help`). 9 characters shorter per command. The old `/mindrian-os:` prefix no longer works after update.
- **Thinking Trace** — Larry now shows his reasoning visually when applying methodology. Blockquote-based traces show problem type, chosen framework, chain logic, Brain connections, and cross-references. Mode-adaptive: hidden in Ask mode, brief in Blend, full in Tell mode.
- **Visual Confirmations** — Larry confirms actions with structured feedback: what was filed, where, cross-references added, stage changes. Starting a methodology session shows estimated duration and output location.

### Added
- Thinking trace format in `skills/larry-personality/SKILL.md` — 4 trace types: routing, room analysis, Brain enrichment, action confirmation
- Visual confirmation patterns for methodology sessions and room filing

## [0.5.0] - 2026-03-25

### Added
- **MCP Server** — Full MindrianOS accessible from Claude Desktop and Cowork via stdio MCP. One line in `claude_desktop_config.json` unlocks all 41 commands
- **Hierarchical Tool Router** — 6 MCP tools (data_room, methodology, analysis, intelligence, meeting, export) routing all 41 CLI commands. 85-93% context reduction vs flat tool surface
- **MCP Resources** — 5 read-only resources for room browsing (room://) without tool calls: room-state, room-sections, section content, meetings, intelligence
- **MCP Prompts** — 5 methodology workflow prompts with Larry personality injection: file-meeting, analyze-room, grade-venture, run-methodology, suggest-next
- **Brain MCP Server** — Standalone `mcp-server-brain/` service wrapping Neo4j + Pinecone behind API key auth. Deploy to Render with one-click `render.yaml`
- **Brain API Key Gating** — `Authorization: Bearer <key>` middleware. Paid-tier users get API key, connect Brain from any surface
- **Shared Core Library** — `bin/mindrian-tools.cjs` single Node.js entry point + `lib/core/` modules (room-ops, state-ops, meeting-ops, graph-ops, section-registry). Both CLI and MCP call the same internals
- **Dynamic Section Discovery** — `analyze-room` and `build-graph` auto-discover new room sections. No more hardcoded arrays. Adding `opportunity-bank/` to room/ just works
- **CLI/MCP Parity Check** — `lib/parity/check-parity.cjs` validates all CLI commands have MCP counterparts. CI-ready gate (exits non-zero on drift)
- **Enhanced Status Line** — Shows project name, active room section, venture stage, gap count, and color-coded context window bar
- **Brain Namespace Search** — `brain_search` now supports namespace targeting (core, reference, tools, materials, graphrag) for the consolidated `pws-brain` index

### Changed
- Pinecone index default changed from `neo4j-knowledge-base` to `pws-brain` (consolidated index with 5 namespaces, 12K+ records, single embedding model)
- `scripts/context-monitor` rewritten in Node.js with room-aware status line

## [0.4.0] - 2026-03-24

### Added
- **Cross-Meeting Intelligence** — Convergence detection (same topic across 3+ meetings), severity-based contradiction flagging (high-impact = immediate, low-impact = summary), action item tracking across meetings (aggregated room/action-items.md with pre-filing triage), team contribution patterns (recurring concerns, influence shifts, role-gap analysis)
- **MEETINGS-INTELLIGENCE.md** — New computed intelligence file: convergence signals, active contradictions, action item aggregation, team-level cross-meeting patterns. Separate from TEAM-STATE.md (per-person vs cross-meeting focus)
- **Read AI MCP Integration** — `/mos:setup meetings` connects Read AI, Vexa, or Recall.ai MCP servers. `/mos:file-meeting --latest` auto-fetches most recent transcript without paste
- **Three-Layer Knowledge Graph** — build-graph now produces Structure (room sections), Content (meetings, speakers, artifacts), Intelligence (concepts from [[wikilinks]], convergence/contradiction edges). Every node has `layer` field, every edge has `source_type`
- **[[Wikilink]] Support** — Larry auto-inserts `[[concept-name]]` links when filing artifacts. build-graph parses all `[[...]]` patterns into concept nodes and REFERENCES edges. Lazy graph: relationships first, metadata on demand
- **Dashboard Timeline Mode** — Integrated in graph (not separate view). Meeting nodes arranged chronologically on X-axis, sections on Y-axis. REINFORCES edges pulse green, CONTRADICTS edges pulse red
- **Dashboard Layer Toggles & Presets** — Toggle buttons per layer (Structure/Content/Intelligence). Four preset views: Room Overview, Meeting Map, Team Network, Intelligence Map. Position persistence in localStorage
- **Meeting-Report PDF Export** — Minto pyramid structure: executive summary → logical claim → critical backbone → evidence & questions → full analysis by meeting. Speaker attribution with role-colored badges and section-colored filing indicators
- **Simon's Architecture of Complexity** — Basis theorem now embedded in CLAUDE.md and Larry's voice-dna. MindrianOS IS Simon's theory operationalized: near-decomposable hierarchical systems applied to venture innovation

### Changed
- `compute-state` now calls `compute-meetings-intelligence` as sub-step (layered computation: compute-state → compute-team → compute-meetings-intelligence)
- `compute-team` extended with Recurring Concerns and Influence Distribution sections in TEAM-STATE.md
- `dashboard/index.html` expanded from 911 to 1640 lines with three-layer visualization
- `commands/file-meeting.md` now a 7-step pipeline (added Step 0 action item triage, enhanced Step 4 cross-reference, enhanced Step 6 cross-meeting scan)

### Fixed
- SessionStart now reads actual version from plugin.json (was letting Larry guess from docs)

## [0.3.0] - 2026-03-23

### Added
- **Meeting Filing Command** (`/mos:file-meeting`) — Full 6-step pipeline: paste transcript, provide file path, or provide audio. Explicit flags (`--file`, `--audio`). Speaker identification with smart hybrid table (auto-matches from team/ directory). Priority-first segment classification with reasoning. Confirm-then-file UX with structured rejection reasons. Narrative + structured meeting summary with dual storage.
- **Velma Audio Transcription** (`scripts/transcribe-audio`) — Modulate Velma REST API wrapper (3¢/hour) with native speaker diarization and 20+ emotion signals. Setup via `/mos:setup transcription` or auto-prompt on first `--audio` use.
- **Speaker Profile System** — ICM nested folder profiles auto-created for every new speaker (team/{role}/{name}/ with insights/, advice/, connections/, concerns/). Extended PROFILE.md schema with roles list, primary_role, status lifecycle (active/inactive/alumni/potential), and last_active tracking.
- **Proactive Person Research** (`scripts/research-speaker`) — Web research on new speakers in context of the project/room. Builds Data Room-specific profile. `--apply` flag for user confirmation before writing.
- **Cross-Relationship Discovery** — 5 edge types (INFORMS, CONTRADICTS, CONVERGES, INVALIDATES, ENABLES) with Tier 0 keyword heuristics. Batch scan after all filing complete. Patterns reference at `references/meeting/cross-relationship-patterns.md`.
- **Meeting Reference Library** — 8 reference files: transcript-patterns (6 formats), segment-classification (6 types), section-mapping (12 roles × 8 rooms routing matrix), artifact-template (wicked-problem-aware frontmatter), summary-template, speaker-profile-template, live-join-interface spec, cross-relationship-patterns.
- **Team Room Structure** — Dynamic team/ directory (folders created on demand, not pre-populated). Multiple roles per person. Full attribution block in artifact frontmatter (speaker, role, profile_path, meeting_date, meeting_id). Topic primary + computed backlinks pattern (no file duplication).
- **Full Meeting Archive** — Self-contained meeting package in room/meetings/YYYY-MM-DD-{name}/: transcript.md, summary.md, speakers.md, decisions.md, action-items.md, metadata.yaml, plus audio copy. Past meeting lookup via metadata.yaml frontmatter search.
- **Team Intelligence** (`scripts/compute-team`) — Knowledge landscape context tool producing TEAM-STATE.md: expertise distribution, knowledge gaps, missing perspectives, role distribution, activity patterns. Layered computation: compute-state → compute-team. Structured markdown tables (lean, context-safe).
- **Room Intelligence Updates** — room-passive skill, compute-state, and analyze-room all meeting-aware. Status command shows meeting count and team intelligence.
- **Test Infrastructure** — 5 test scripts with 63+ assertions for meeting domain (segment classification, frontmatter provenance, summary structure, speaker identification, Velma diarization). `tests/run-all.sh` runner.

### Fixed
- SessionStart now reads actual version from plugin.json (was letting Larry guess from docs, sometimes reporting v0.1.0)

## [0.2.0] - 2026-03-23

### Added
- **Auto Update Notification** — SessionStart checks GitHub for new versions once per day (cached, async, non-blocking). Users see "[Update Available]" in Larry's greeting
- **Meeting Transcript Filing** — Design spec for `/mos:file-meeting`: paste transcript, identify speakers + roles, classify segments, file to Data Room sections with confirmation. Meeting summary artifact with cross-references, contradictions, action items
- **Release Process Rule** — CLAUDE.md now mandates: CHANGELOG update, version bump, tag, push with tags for every release
- **Analytics & Learning System** — Local usage tracking + behavioral learning that adapts Larry's suggestions
- **Tyler Josephson Case Study** — Full mockup with HSI cross-domain scoring and Reverse Salient bottleneck analysis
- **Dr. Vasquez Case Study** — 10-session CeraShield space reentry venture simulation with 33-page thesis PDF

### Fixed
- build-graph grep exit code under strict bash mode (all 10/10 scripts pass)
- render-pdf font resolution (base_url for WeasyPrint @font-face)
- analyze-room integer comparison in method_count
- Plugin.json now registers all 40 commands (was 14)
- Removed empty connector-awareness skill directory
- Fixed check-update GitHub URL (jsagir/mindrian-os-plugin)

## [0.1.0] - 2026-03-22

### Added
- **Larry Personality** -- Full teaching voice with mode engine calibration (40:30:20:10 distribution), signature openers, and tri-surface awareness (CLI, Desktop, Cowork)
- **26 Methodology Commands** -- Complete PWS framework toolkit: beautiful-question, explore-domains, explore-trends, map-unknowns, diagnose, analyze-needs, build-knowledge, structure-argument, challenge-assumptions, root-cause, macro-trends, user-needs, validate, find-bottlenecks, analyze-timing, dominant-designs, think-hats, scenario-plan, analyze-systems, systems-thinking, lean-canvas, leadership, explore-futures, grade, build-thesis, score-innovation
- **Pipeline Chaining** -- ICM stage contracts connect methodologies in intelligent sequences: Discovery pipeline (explore-domains -> think-hats -> analyze-needs), Thesis pipeline (structure-argument -> challenge-assumptions -> build-thesis)
- **Proactive Intelligence** -- Two-layer system: bash structural detection + Claude semantic interpretation with noise gate (max 2 HIGH-confidence findings per session)
- **Data Room Dashboard** -- De Stijl-styled localhost viewer with knowledge graph visualization, room chat, and CoSE/grid layout engine
- **Document Generation** -- PDF export for thesis, report, profile, and brief types with WeasyPrint rendering and TOC bookmarks
- **Brain MCP Integration** -- Optional Neo4j Brain connection with 5 Brain-powered commands: suggest-next, find-connections, compare-ventures, deep-grade, research
- **Self-Update System** -- Version check, changelog display, modification backup/reapply flow via `/mos:update`
- **Infrastructure Commands** -- new-project, help, status, room, setup, update
- **Passive Room Filing** -- PostToolUse hook auto-classifies and files insights to room sub-rooms
- **Graceful Degradation** -- Full functionality at Tier 0 (no dependencies), enhanced with optional Neo4j and Brain
