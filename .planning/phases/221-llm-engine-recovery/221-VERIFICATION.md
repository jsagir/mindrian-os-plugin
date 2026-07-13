# Phase 221: Verification (precondition table + executed release evidence)

**Status: CLOSED. The joint 219+220+221 cut executed and is live: v1.15.3-beta.16.**

This file records the 221-05 Task 1 precondition gate as it stood pre-cut, plus (Section 4
below) the actual executed release evidence. It is NOT the full 221-05 closeout (that also
covers the CHANGELOG assembly - already
landed separately, commit `edcc4180` - README refresh, website capability copy, and the
executed five-gate release itself). This section exists so the precondition state is real,
evidenced, and inspectable ahead of the cut, not re-derived from memory at cut time (D-10).

## 1. Precondition table (221-05-PLAN.md Task 1, checked live 2026-07-13)

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | `219-RELEASE-STAGING.md` exists | PASS | present, staged drafts verified read in full this session |
| 2 | 219 corepower confirmation recorded (not a placeholder) | PASS (as WAIVED) | `219-VERIFICATION.md` Section 4.3: "STATUS: WAIVED (navigator override, 2026-07-13) - NOT a PASS" - a real recorded decision, not an empty placeholder |
| 3 | `220-RELEASE-STAGING.md` exists | PASS | present, staged drafts verified read in full this session |
| 4 | 220 readiness recorded | **OPEN - the one real blocker** | `220-VERIFICATION.md`: "Awaiting navigator confirmation" of the SENS-15 live-card checkpoint. Cannot be fired from this session - confirmed live: this MCP session is bound to an unrelated real room (`motj-ecosystem/sub-rooms/jonathan-contractor-motj`), and `room_bind` to a clean test room (`ador-ip-test`) fails with `no_session_id` (the same infra limitation noted earlier this session). Needs the navigator to run `220-NAVIGATOR-VERIFICATION-PROMPT.md` in a real room-bound session and paste back the ticked checklist. |
| 5 | 221 gates: `bash tests/run-all-221.sh` FAIL=0 | **WAIVED (see 2.1 below)** | Every 219/220/221 test file green standalone. The 2 aggregate FAILs are both the SAME pre-existing, unrelated, tracked issue (2.1), not a new regression. |
| 6 | `node scripts/doctor.cjs --acceptance` green | **WAIVED (see 2.2 below)** | 14/15 points pass. The 1 failure (`verify-release-clean-tree`) is pre-existing, unrelated tree drift (2.2), not new. |
| 7 | `node scripts/build-connector-registry.cjs --check` green | PASS | `connector-registry: OK` |
| 8 | `git diff --exit-code package.json .claude-plugin/plugin.json` (no premature hand-bump) | PASS | clean |

## 2. Waivers recorded (navigator override, 2026-07-13) - NOT a PASS on either, knowing risk acceptance, same pattern as the 219 corepower waiver

### 2.1 The `--strict` shape-declaration gate (216-03), cascading into 220/221's regression legs

**Root cause (verified live, not assumed):** `scripts/check-shape-declaration.cjs`'s `--strict`
mode hard-fails on 3 skills - `skills/update/SKILL.md`, `skills/vault/SKILL.md`,
`skills/visualize/SKILL.md` - each of which declares BOTH a genuine `hitl_shape`
(they really do offer a one-action approve/defer decision) AND `connector.excluded:true`
(they are legitimately never reached via the proactive reach/connector spine - each is a
deliberately-invoked lifecycle/maintenance/deprecated surface with no problem-state trigger).
This is not a bug in these 3 skills; it is ONE frontmatter field (`connector.excluded`) doing
double duty for two different concepts ("has no fork" vs. "not reached via the governed
connector spine"), already root-caused and explicitly deferred in
`.planning/debug/knowledge-base.md` (2026-07-xx, the conversation-mode RCA): "a genuine
architectural fix requires splitting them into distinct fields (not done this session)."

Per Phase 210 policy this gate is advisory (WARN, non-blocking) in normal mode; it hard-fails
only under `--strict`, and `tests/run-all-216.sh` intentionally exercises `--strict` as a
meta-test that strict mode itself still works - not as a real release gate. It cascades into
`tests/run-all-220.sh` and `tests/run-all-221.sh` purely because both chain the 216 regression
leg, making an unrelated, pre-existing, already-tracked architectural question read as a fresh
FAIL in this release's own aggregate.

**Navigator decision (2026-07-13):** waive, same as corepower. Recorded here as a knowing,
informed acceptance - not fixed, not hidden. The real fix (splitting the frontmatter field) is
real future work, separate from this release wave; it is not re-filed here since
`knowledge-base.md` already carries it.

### 2.2 The 2026-07-12 tree drift (`verify-release-clean-tree`)

**Root cause:** pre-existing, explicitly flagged uncommitted work from a prior session
(`.planning/SESSION-HANDOFF-2026-07-12.md` line 59): a `/mos:eureka html` subcommand
(`commands/eureka.md` + `skills/eureka/SKILL.md` argument-hint diff, `scripts/eureka-html-report.cjs`)
and PWS wisdom-nugget Brain-ingestion prep (`cypher/pws-brain-ingest.cypher`,
`data/pws-brain-nuggets.json`, `scripts/ingest-pws-nuggets-pinecone.py`, `scripts/ingest_neo4j.py`),
explicitly marked "not yours to resolve as part of this task - just don't let release.sh sweep
them in by accident." Confirmed still present, untouched, exactly as flagged.

**Navigator decision (2026-07-13):** waive, same as corepower. `release.sh` must NOT sweep
this drift into the release commit - whoever picks it up next commits it deliberately, on its
own terms, separately from this release.

## 3. Net position (pre-cut)

The joint 219+220+221 engine work is real, tested, and green end to end. The ONLY thing still
genuinely blocking 221-05 dispatch is precondition #4 above (the 220 URL-card live checkpoint) -
a navigator-only action this session cannot perform (confirmed: no working room-bind path to a
clean test room from here). Once that checklist is pasted back and confirmed, 221-05 is
dispatchable with every other precondition already honestly resolved (green or explicitly
waived) above.

## 4. THE EXECUTED RELEASE (2026-07-13)

**Navigator decision:** waive the 220 URL-card checkpoint too, same honest-risk-acceptance
pattern as corepower and the two Section 2 waivers, and cut immediately. Recorded in
`220-VERIFICATION.md` Section 4 (updated separately, commit `037c3e03`) - not a pass, a
knowing risk acceptance, the four original checklist items carried forward as OPEN.

### 4.1 Pre-cut hygiene

The 2026-07-12 tree drift (Section 2.2) was still present and would have HARD-ABORTED
`release.sh`'s own Step 2.5 clean-tree pre-flight gate (a stronger gate than the advisory
`doctor --acceptance` roll-up used for the precondition table above). Resolved without
touching or losing that work: `git stash push -u` (captured both the 3 modified tracked files
and the 5 untracked files as one stash), confirmed `doctor --acceptance` went 15/15 with a
clean tree, ran the release, then `git stash pop` immediately after - the drift is back,
byte-identical, uncommitted, exactly as found, never swept into any release commit. Verified:
`git status --short` post-pop shows the same 3 modified + 5 untracked files as before.

Also applied (README content refresh, D-15 discipline, content-only, zero styling regression,
verified via `git diff README.md`): 219's `qualify-opportunity` command line + sentence, 220's
`research <url>` command line + sentence, both into the existing "room surfaces what you
cannot see" paragraph and command slice block; one additional sentence for 221's engine-recovery
capability in the same voice (no new command minted for 221, per Part 7); command count
re-verified against the live registry, 107 -> 110. Commit `ef0845c0`.

**Deferred, explicitly, not silently:** the mindrian-os.com website CAPABILITY copy (new
feature descriptions for opportunity follow-through / web ingestion / engine recovery) was
NOT written this pass. The site's `PlatformFeaturesSection.tsx` is a community-platform
feature list, not obviously the right home for Claude Code plugin capabilities, and getting
this wrong (content in the wrong section of a live marketing site) is worse than a clean
deferral. The VERSION sync (the hard-gated lockstep piece) executed correctly via
`release.sh` Step 9.6b regardless - see 4.3. The capability-copy content drafts remain staged
verbatim in `219-RELEASE-STAGING.md` Section 4 and `220-RELEASE-STAGING.md` Section 3 for
whoever picks this up.

### 4.2 The cut itself

```
bash scripts/release.sh --prerelease --allow-ahead
```

`--allow-ahead` was required because 4 legitimate commits (this session's own waiver/README
docs) were ahead of origin at cut time - verified each one before allowing (no surprise
content). Version-of-record was `1.15.3-beta.15` (a post-beta.14-cut placeholder, never
itself published) going in; `--prerelease` computed the real new cut as `1.15.3-beta.16` -
this is correct semver behavior, not a skip.

Full run: exit 0. `Acceptance full: 15/15 points passed` (post-cut `doctor --acceptance`,
the same command Step 2.5's pre-flight and Step 9.8's post-cut re-run both use). Raw log:
`/tmp/release-221-05-run.log` (this machine, not repo-tracked).

### 4.3 Independent verification (never just trust the script's own self-report)

| Check | Result |
|---|---|
| `npm view @mindrian_os/cli dist-tags --json` | `{"latest":"1.15.2","next":"1.15.3-beta.16"}` - published correctly to `@next` (betas never touch `@latest`, by design) |
| `git show --no-patch v1.15.3-beta.16` | tag points at `3050ab27` `release: v1.15.3-beta.16` |
| `~/mindrian-marketplace/.claude-plugin/marketplace.json` | `version: 1.15.3-beta.16`, `source.ref: v1.15.3-beta.16` |
| `curl -s https://mindrian-os.com/ \| grep -o "1.15.3-beta.[0-9]*"` | returns `1.15.3-beta.16` - the LIVE site, not just the committed source |
| `mindrian-website/website/src/lib/version.ts` FALLBACK_VERSION | `v1.15.3-beta.16` (website commit `9c5eef6`, pushed to origin) |
| VERSION-BUMP-CHECKLIST sweep: grep both repos for the OLD literal (`beta.14`/`beta.15`) outside CHANGELOG/`.planning` history | zero hits in either repo - clean |

All five REQ-6 acceptance points (npm shows it, tag exists, marketplace pinned, website
live-poll reflects it, capability pages - deferred per 4.1) are independently confirmed, not
just taken from the script's own exit code.

### 4.4 Net position (post-cut)

**The joint 219+220+221 release is live.** Users upgrade with `claude plugin update mos`;
new installs via `claude plugin marketplace add jsagir/mindrian-marketplace && claude plugin
install mos@mindrian-marketplace`. The standing session goal ("make sure we have a new version
cut after all these needs are met") is satisfied: `scripts/release.sh` executed, version
bumped, git tag created and verified at origin, npm published and verified, marketplace
source.ref pinned and verified, website synced and verified live.

Carried-forward, explicitly open items (none of these block the cut, all deliberately deferred):
the four 220 checklist items (real card-render proof, `/mos:research` readback gate, Tavily
rung-1 key disposition, optional Desktop cross-check), the post-218 corepower Windows re-run,
the website capability-copy content, and SEED-056 (Larry behavior contract wiring the new
engines into persona-level reach, already filed for a future `/gsd-quick` session).
