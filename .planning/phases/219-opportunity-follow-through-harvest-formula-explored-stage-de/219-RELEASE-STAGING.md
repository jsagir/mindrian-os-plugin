# Phase 219: Release Readiness Staging (REQ-7 as RE-AMENDED 2026-07-13)

**Status:** STAGED DRAFTS ONLY - nothing below is applied in Phase 219. `git diff --exit-code
package.json .claude-plugin/plugin.json CHANGELOG.md README.md` is CLEAN at staging time
(recorded in the readiness sweep, Section 0). The cut itself executes at Phase 221 completion
via `scripts/release.sh <version>` - never here, never by hand (D-14).

**The ONE open precondition at staging time:** the corepower-isolation Desktop validation
(219-COREPOWER-VALIDATION-PROMPT.md, navigator-run, blocking checkpoint). Everything else in
this document is ready. The navigator confirmation lands in 219-VERIFICATION.md Section 4;
release staging is not CLOSED until it does.

---

## 0. Readiness gate sweep (run 2026-07-13, this staging session)

| # | Gate | Result |
|---|------|--------|
| 1 | `bash tests/run-all-219.sh` | GREEN - Phase 219 PASS=12 FAIL=0 SKIP=0; 218 substrate no-regression 13/13; 211 engine no-regression 10/10; vec0 capability probe PASSED |
| 2 | `node scripts/doctor.cjs --acceptance` | 14/15 points PASS; the single FAIL is `verify-release-clean-tree` = tracked working-tree drift owned by CONCURRENT SIBLING sessions (220/221: commands/eureka.md, evals/plurai/211-baseline.json, package-lock.json, scripts/eureka-command.cjs, skills/eureka/SKILL.md), pre-documented in deferred-items.md. Zero overlap with 219's diff. Those sessions must land or revert their drift BEFORE the Phase 221 cut - release.sh requires a clean tree |
| 3 | `node scripts/build-connector-registry.cjs --check` | GREEN - `connector-registry: OK` |
| 4 | `scripts/verify-release` (consistency pre-check on the CURRENT version) | GREEN - 26 passed / 0 failed / 3 warnings, verdict `CLEAR TO RELEASE v1.15.3-beta.15`. Expected warning: CHANGELOG has no finalized entry for v1.15.3-beta.15 (its top heading is `[Unreleased] -- v1.15.3-beta.15 (in progress)` - correct pre-cut state; Section 1 below is the entry that finalizes it at cut time) |
| 5 | `git diff --exit-code package.json .claude-plugin/plugin.json CHANGELOG.md README.md` | CLEAN (exit 0) - zero premature bump, zero premature docs. The version files sit at 1.15.3-beta.15 exactly as they did before this plan ran |

**Readiness fix landed by this staging pass (deviation, recorded):** the GAP-2 harvest fix
(`BRIDGE_EDGE_TYPES` + extraction vocabulary, RCA
`.planning/debug/219-live-checkpoint-two-structural-gaps.md`) was live-verified and staged but
never committed by the 219-06 session - HEAD's harvest lane still lacked it. Committed now
(`d5a47f83`) so the release ships the code the live evidence describes. Gate 1 above ran green
against exactly this code.

---

## 1. CHANGELOG entry draft - the joint 219+220+221 release entry

Copy-applicable at cut time: this REPLACES the `## [Unreleased] -- v1.15.3-beta.15 (in
progress)` heading at the top of CHANGELOG.md, under the version release.sh is invoked with.
The two marked slots are filled from the sibling staging docs, verbatim.

```markdown
## [<CUT-VERSION>] - <CUT-DATE>

### Added
- **Opportunity follow-through: surfaced opportunities stop dying as files and one-liners.**
  Every opportunity now flows through the Harvest Formula lifecycle (candidate -> qualified ->
  explored -> promoted | parked | retired) as a real graph node with append-only stage history -
  who advanced it, why, and on what evidence, at every step.
- **Eureka statements now bank as proposed opportunity nodes.** The portfolio scan's ranked
  statements get a REAL awaited Grounding Guard verdict (a bounded async resolution pass over
  the Phase 212 critic - previously the sync emitter could never await it, so nothing ever
  banked on a live run). Statements the critic passes bank as `opportunity` nodes with
  DERIVED_FROM evidence edges; statements it rejects stay honestly unbanked with the verdict
  named. Tunable via `MINDRIAN_OPPORTUNITY_BANK_PREDICATE` (critic | critic+tail | all).
- **Harvest sensor (SENS-14): graph events become scored opportunity candidates.** A producer
  on the insight-sensor rail harvests candidates from five lanes (eureka proposals, bridges,
  contradictions, whitespace, meeting filings), classifies each through the Gibson Four-Lens
  (leveraging_resources / challenging_orthodoxies / understanding_needs / harnessing_trends),
  and scores them with HarvestIndex_v1. The bridge lane rides the real extraction edge
  vocabulary (COMPETES_WITH / USES_COMPONENT / SUPPLIES_TO), so it finds genuine cross-entity
  signal on real rooms, not just fixture edges.
- **Qualification Decision Gate (`/mos:qualify-opportunity`).** Harvested candidates come to
  YOU at a real card showing why each one qualified (Q1..Q8 rubric verdicts + machine-readiness
  components; an unknown is typed `unknown`, never a fabricated zero). Five verbs:
  Qualify+file, Park, Retire, Explore, Skip. A Skip writes a typed REJECTED_BECAUSE edge -
  rejection is data the ranker learns from. Nothing qualifies without your explicit verb.
- **[Explore]: one explicit action turns a qualified opportunity into deep research**
  (`/mos:explore-opportunity`). Runs the explored-stage chain - deep research, diffusion and
  timing, analogies, web validation - and files a Minto-shaped opportunity artifact (governing
  thought + SCQA + cited sources) into `opportunity-bank/` plus a research corpus artifact into
  `research/`, both through the navigation.cjs gates with typed evidence edges. When the
  engine cannot run, the surface OFFERS an LLM manual fallback at a card - honestly labeled
  `engine_mode: llm_manual_baseline`, never silent, never the default.
- **Frontmatter metadata extraction slice.** Artifact frontmatter (methodology, status,
  created) now lands as graph properties during extraction, so engines reason over what the
  files already declare.
<!-- 220 SLOT: insert 220-RELEASE-STAGING.md Section 1 verbatim here (web ingestion agent: URL -> cited room knowledge, SENS-15, content-hash idempotency, watched sources, provider honesty, Part 8 inbound safety) -->
<!-- 221 SLOT: insert 221's staged CHANGELOG content here (Phase 221's own staging doc owns it) -->

### Fixed
- **Windows FTS5 crash: eureka degrades bi-modal instead of dying.** On machines whose Node
  SQLite lacks the FTS5 module, the tri-modal index used to crash the whole scan with
  `no such module: fts5`. A capability probe now selects the backend up front: with FTS5 the
  lexical leg runs as before; without it the scan runs honestly on the two remaining legs
  (vector + graph) and stamps `fts_backend: absent (bi-modal degrade)` in provenance. Never a
  crash, never a silent lie. Live-validated on the exact Windows machine that exposed the bug
  (corepower-isolation, 219-VERIFICATION.md Section 4).
```

## 2. README.md content-refresh draft (Feynman + JTBD voice, content only, ZERO restyle - D-15)

Two additions, both inside EXISTING sections; every other line byte-preserved.

**(a) "What you do in a session" command slice block - add one line after `/mos:opportunities`:**

```
/mos:qualify-opportunity  # judge a surfaced opportunity at a card; Explore turns it into research
```

**(b) "The room surfaces what you cannot see" section - append one sentence to the existing
paragraph (content-only extension of the existing claim):**

```
When a scan surfaces an opportunity, it does not stop at a headline: you qualify it at a card,
and one explicit Explore turns it into cited deep research filed in your opportunity bank.
```

Rules at apply time: no new sections, no heading changes, no styling edits, no em-dashes; the
"107 commands across 14 skills" count line is re-verified against the live registry at cut
time (commands/ holds 110 .md files today - the count is enumerated from disk, never
hand-trusted; 219 minted `/mos:qualify-opportunity` and `/mos:explore-opportunity`). The
apply is navigator-confirmable: `git diff README.md` at cut time must show ONLY these two
content insertions (SPEC acceptance: no styling regression).

## 3. Marketplace pin instruction (lockstep gate 5, D-15)

At cut time (executed by release.sh / the Phase 221 cut session, never before):

1. `~/mindrian-marketplace/.claude-plugin/marketplace.json`: set `plugins[0].version` to the
   cut version and `plugins[0].source.ref` to the new tag `v<CUT-VERSION>` (currently pinned
   at `v1.15.3-beta.14`).
2. Fact-check the marketplace `description` field: it hand-types "73 commands
   (+/mos:brain-derive)" - STALE against the live registry (110 command files today).
   Reconcile the hand-typed count (or drop the literal count) as part of the same edit.
3. Commit + push the marketplace repo, then verify the two-command user upgrade path against
   the pushed state: `/plugin marketplace update` then
   `claude plugin update mos@mindrian-marketplace`.

## 4. Website fact-check checklist (mindrian-os.com - the single canonical web surface) + VERSION-BUMP-CHECKLIST

The hand-typed-version discipline (standing navigator rule: after version bumps, fact-check
every hand-typed version surface):

- [ ] Every hand-typed version string on mindrian-os.com reconciled to the joint-cut version
      (grep the site source for the OLD version literal; zero stale hits)
- [ ] If the site carries a features/capabilities list: opportunity follow-through entry added
      (draft below), no other feature entry disturbed
- [ ] If the site carries a command count: re-verify against the live registry AFTER the cut
      (219 added 2 commands; 220 added none - Part 7)
- [ ] Clarity snippet (ID wmu6iasq77) present on any page touched (standing rule)
- [ ] No em-dashes introduced in any copy edit (standing rule)
- [ ] VERSION-BUMP-CHECKLIST.md walked end to end after release.sh completes

**Feature description draft (content only; De Stijl styling owned by the site):**

> Opportunities stop dying as one-liners. When a scan surfaces one, Larry brings it to you at
> a card with the reasons it qualified. You decide - qualify it, park it, retire it, or skip
> it with a reason that becomes part of the room. One explicit Explore turns a qualified
> opportunity into cited deep research: what it is, why now, what it rhymes with, filed in
> your opportunity bank with its evidence attached.

## 5. HANDOFF NOTE (verbatim)

The 219+220+221 version cut is JOINT (navigator decision 2026-07-13). scripts/release.sh
<version> executes when Phase 221 completes (the last phase in the joint set) - default next
increment on the 1.15.3-beta line unless the navigator directs otherwise (D-14). Never
hand-bump; release.sh enforces all five gates + npm publish (step 9.5). Preconditions already
met by Phase 219: corepower validation confirmed (219-VERIFICATION.md), all 219 gates green,
this staging doc applies verbatim.

**Staging-time annotation on the note above (honest state, 2026-07-13):** the corepower
confirmation is PENDING at the moment this doc was staged - it is the blocking checkpoint this
plan stops at. The note reads as it must be TRUE at cut time; Phase 221's cut gate consumes
219-VERIFICATION.md Section 4 and must find the confirmation recorded there before release.sh
runs. Version arithmetic note: the last RELEASED tag is v1.15.3-beta.14; the version files
already sit at 1.15.3-beta.15 with the CHANGELOG heading `[Unreleased]` - so "next increment
on the line" resolves to finalizing v1.15.3-beta.15 unless the navigator directs otherwise.

---

## Handoff to Phase 221 (what the cut gate consumes)

| Input | Where |
|-------|-------|
| 219 offline + live evidence | 219-VERIFICATION.md Sections 1-3.4 (219-06 CLOSED, navigator-approved) |
| 219 corepower confirmation | 219-VERIFICATION.md Section 4 (**PENDING at staging time - the blocking checkpoint**) |
| 220 readiness | 220-RELEASE-STAGING.md + 220-VERIFICATION.md Section 4 (220-05 staged; navigator prompt open) |
| CHANGELOG joint draft | Section 1 above (219 content + marked 220/221 slots) |
| README additions | Section 2 above (content-only; apply then diff-confirm zero styling changes) |
| Marketplace pin + description fact-check | Section 3 above |
| Website drafts + VERSION-BUMP-CHECKLIST | Section 4 above |
| Version files clean proof | Readiness sweep Section 0 row 5 (green at staging time) |
| Sibling tracked drift | MUST be landed or reverted by its owning sessions before the cut (Section 0 row 2) |
| The cut itself | `scripts/release.sh <version>` at Phase 221 completion (Section 5) |
