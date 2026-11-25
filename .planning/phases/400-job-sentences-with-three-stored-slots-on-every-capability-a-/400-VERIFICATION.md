---
phase: 400-job-sentences-with-three-stored-slots-on-every-capability-a-
verified: 2026-11-24T12:49:08Z
verified_head: 3daeb0dea
baseline: c1e496ae8
status: human_needed
score: 24/24 requirements satisfied as worded; 11/12 goal truths verified, 1 partial (wicked cut-off not fitted)
overrides_applied: 1
owner_signoff: 2026-11-25 (4 of 5 human items closed; the labels item is closed in part)
human_verification:
  - test: "Rule on the wicked cut-off fit (AX-02). data/problem-axes-wording.json wicked_cutoff.state is not_fitted, value null, so wickedFromProbability answers null for every input. Supply the two wicked label files from the research machine and run scripts/derive-wicked-cutoff.cjs --write, or accept not_fitted for this phase by an override."
    expected: "Either a fitted block (state fitted, value in 0..1, counts and file hashes) that passes derive-wicked-cutoff.cjs --check, or an override entry in this file accepted by the owner."
    why_human: "The label files are not on this machine (400-CONTEXT.md OPEN line). Only the owner can supply them or accept the deviation."
  - test: "Read the order rule of review fixes WR-04 and WR-09 in lib/core/feyminto/next-move.cjs and lib/workflow/command-resolver.cjs: fit bonus of 1 plus the calibrated value; composeWorkflow sorts by fit desc, value desc, registry index asc; only fits from the top k of the lookup move first, and only when the lookup effect is reordered."
    expected: "The owner agrees that this order is the intended in-band reorder (CY-05) and that it changes nothing when the domain is unknown."
    why_human: "400-REVIEW.md marks both as logic changes that need a human check. Tests pin the behavior, not the intent."
  - test: "Choose for review item IN-04: add a relay provider id to the decision_advisor line providers list in data/egress-policy.json, or keep the relay gated by the line name only."
    expected: "A recorded owner choice. Today the relay transport is gated by the line name and the line default is false (PROVEN)."
    why_human: "The change edits shipped data that a 399 pin (tests/test-399-egress-line.cjs) holds; 400-REVIEW.md skipped it for an owner choice."
  - test: "Render the two-stage cause_effect_domain gate card through gate_render on Claude Code CLI, Claude Desktop and Cowork, answer it, and confirm suggest_next then shows the cause_effect field."
    expected: "Stage 1 asks who can see cause and effect, stage 2 confirms the domain, the answer is stored once per room, and the card shows no elicitation form."
    why_human: "Visual and host behavior on three surfaces. Tests cover the tool replies only."
  - test: "Rule on the provisional labels in 400-LABEL-REVIEW.md (20 vocabulary sentences, 142 capability sentences, 63 MCP tool sentences, fits_domains, move_type, move matching exclusions, carry-over from 399)."
    expected: "Each list is kept or changed by the owner. Every label stays provisional until then."
    why_human: "O-14 and S5: the owner rules on label wording; an agent does not."
---

# Phase 400: Job sentences, Cynefin layer, problem-axes fixes, decision relay - Verification Report

**Phase Goal:** Every capability carries one job sentence stored as three slots (When, I want, so I can) in its own frontmatter keys; the room gets a navigator-set Cynefin cause-and-effect domain on its own axis beside wickedness, which the existing advisor uses only inside the strong band (unknown domain = exact 399 output, chaotic = honest no strong pick, disorder = label plus slicing note); the reworded Well-defined test ships behind a flag and the wicked answer gets its own fitted cut-off; a host-neutral labels-only Gemini relay (services/decision-relay/, Render blueprint, install-id caps, operator token) is built and tested offline with the decision_advisor line still off for users; the owner gets one review file for every provisional label. Chaining, per-part domains, default-on advisor or egress, PwS-Book or Theo edits, deploy and push are out of scope.
**Verified:** 2026-11-24T12:49:08Z at HEAD 3daeb0dea (branch work/400-job-sentences-cynefin-layer), baseline c1e496ae8
**Status:** human_needed
**Re-verification:** No - initial verification

Scope note: the relay runs on Render from a private copy of this code. This report verifies the code in this repo. It does not verify the deploy.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every capability carries one job sentence as three stored slots in its own frontmatter keys (O-01, O-11) | VERIFIED | YAML parse of 255 frontmatter blocks (113 commands, 125 SKILL.md, 17 agents): 254 hold top-level job_when, job_want, job_so, all non-empty strings, 0 parse errors. The one exception is skills/trending-to-absurd/SKILL.md, a hand-authored skill on the build-skill-mirrors SKIP_LIST; its command commands/trending-to-absurd.md carries the sentence (coordinator ruling, 400-03-SUMMARY). MCP tools: data/mcp-tool-job-sentences.json holds 63 entries, equal to the 63 connector surfaces. Vocabulary: 20 jobs with sentence and slots. Frameworks: 184 statements parse (test F1). |
| 2 | Descriptions unchanged; capability files change only by the new keys (O-11) | VERIFIED | git diff c1e496ae8..HEAD over 254 changed files in commands/, skills/, agents/: 0 removed lines, 0 added lines other than job_when, job_want, job_so, job_sentence_status, fits_domains, move_type, move_type_weak, cynefin_label_status. Test B1 (no description grows) PASS. |
| 3 | Registry and mirrors carry the copy; 399 data stays byte-equal | VERIFIED | build-command-registry --check and build-skill-mirrors --check PASS. Every old field of the 113 registry rows and every old field of the 20 vocabulary jobs (summary, summary_source, origins) is equal to c1e496ae8 (direct JSON compare). |
| 4 | cause_effect is a separate additive axis; cynefin_rating stays as a deprecated alias; the old rating is a weak labelled source only | VERIFIED | lib/core/problem-axes.cjs: 120 lines added, 0 removed. CAUSE_EFFECT_SOURCES = navigator, weak_cynefin_rating. causeEffectFromRating labels the weak source. wickedness.cynefin_rating still written. |
| 5 | The room domain comes only from the navigator, stored once per room through navigation, registered in aliases.yml | VERIFIED | lib/core/navigation/cause-effect.cjs writes identity key problem.cause_effect; navigation.cjs exposes writeCauseEffect, readCauseEffect, readCauseEffectForRoom. aliases.yml gains problem_cause_effect and selection_observations_cause_effect_domain. No Brain module reads cause_effect (grep). tests domain-store, domain-gate, domain-suggest-next PASS. |
| 6 | Unknown domain gives the exact 399 output | VERIFIED | Spot-check: 60 lookupShortlist calls (every vocabulary job x definition level) against git archive c1e496ae8 and HEAD produce byte-identical JSON (17376 bytes each). Test P1 (publicShortlist byte-identical) PASS. |
| 7 | Chaotic gives an honest no strong pick; disorder passes the label plus the slicing note and does not force an abstain (O-03, O-13) | VERIFIED | Spot-check validate-idea: chaotic gives state no_strong_pick, bands lowered to possible, summary holds the chaotic host note. Disorder keeps the same state and bands as the no-domain output and appends the slicing note "The host model decides how to use the shortlist." Notes live in data/cynefin-domains.json host_notes. |
| 8 | Domain reorder happens only inside the strong band; consumers pass the domain; selection log stores the domain | VERIFIED | tests advisor-domain, advisor-consumers (X7, X8), selection-domain PASS. memory-ops.cjs adds nullable cause_effect_domain by migration; selection-log.cjs writes it. |
| 9 | Labels-only validator gains cause_effect_domain (5 values) and move_type; catalog fingerprint | VERIFIED | labels-only.cjs CONTEXT_KEYS holds cause_effect_domain; move_types and glosses in the catalog; test labels-only-domain PASS. |
| 10 | Reworded Well-defined test ships behind a flag, old wording default | VERIFIED | levelWording() returns v1 (status shipped, "Clear parameters, specific constraints") unless MINDRIAN_LEVEL_WORDING is exactly v2. sensors.cjs reads it. Test problem-axes-wording W3: Axis 1 table lines byte-identical. |
| 11 | The wicked answer gets its own fitted cut-off, never raw 0.5 | PARTIAL (human decision) | The never-raw-0.5 half is VERIFIED: wickedFromProbability answers null unless a fitted block exists; no raw 0.5 cut in code. The fitted half is NOT met: data/problem-axes-wording.json wicked_cutoff.state is not_fitted, value null. 400-CONTEXT.md records this as OPEN (label files not on this machine). wickedFromProbability has no runtime consumer yet. See override suggestion below. |
| 12 | Host-neutral labels-only relay, built and tested offline, user line off, owner gates kept | VERIFIED | services/decision-relay/ uses Node built-ins only; relay.cjs requires the shared lib/core/decision-advisor/labels-only.cjs and adapter.cjs and runs validateNeutralRequest and validateProviderBody server-side; catalog_skew 409 before upstream; redirect error, timeout, body cap, upstream read cap. config.cjs: userTraffic true only for exact value on; operator token compared by sha256 with timingSafeEqual. render.yaml: autoDeployTrigger off, RELAY_USER_TRAFFIC off, GEMINI_API_KEY and RELAY_OPERATOR_TOKEN_SHA256 sync false with no value. npm pack ships 0 files under services/ (K1). No Google key pattern in the tree. data/egress-policy.json decision_advisor default false (diff changes the endpoint text only). Transport: shipped policy gives egress_line_off with 0 network calls (T1, BM6); operator run needs --operator-release-run plus the token file, writes one 0600 audit record (O1 to O9). |
| 13 | One owner review file for every provisional label | VERIFIED | 400-LABEL-REVIEW.md covers vocabulary, section-only jobs (4), funding and personas carry-over, held pairs (2), doubtful labels (5), the 0.70 to 0.89 band (132), capability sentences, fits_domains (chaotic 0), move_type, move matching exclusions, O-12 commands, card wording, problem axes, relay owner steps. test-400-review-lists drift test PASS. |
| 14 | Deferred list not built | VERIFIED | No chaining slot code (grep). One domain per room (one identity key). Advisor stays opt-in (MINDRIAN_DECISION_ADVISOR exactly on). Egress line default false. PWS-Book last commit 2026-11-16 (680ccbbd), no dirty file newer than 2026-11-15; Theo has no commit since 2026-11-23 and its one dirty file dates 2026-11-16. Branch has no upstream (no push). |

**Score:** 24/24 requirements satisfied as worded. Goal truths: 13/14 verified, 1 partial (truth 11, fitted half).

### Override suggestion for truth 11

This looks intentional. 400-CONTEXT.md OPEN line: "plan 400-11 ships the wicked cut-off as not_fitted until they arrive." To accept the deviation for this phase, the owner adds to this frontmatter:

```yaml
overrides:
  - must_have: "The wicked answer gets its own fitted cut-off, never raw 0.5"
    reason: "Label files are on the research machine only; the cut-off ships not_fitted (answers null, never a raw 0.5 cut) with derive-wicked-cutoff.cjs ready to fit it"
    accepted_by: "<owner>"
    accepted_at: "<ISO timestamp>"
```

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| lib/core/job-sentence.cjs | slot validator and parser | VERIFIED | tests job-sentence-lib PASS; used by apply-job-sentences.cjs and the drift test |
| scripts/apply-job-sentences.cjs | frontmatter writer with --check | VERIFIED | --check --require-all PASS |
| data/job-vocabulary.json | 20 sentences with slots | VERIFIED | old fields byte-equal to base |
| data/mcp-tool-job-sentences.json | 63 MCP tool sentences | VERIFIED | key set equals connector surfaces |
| data/cynefin-domains.json | 5 domains, verb order, posture, move type, quote hashes, host notes, card text | VERIFIED | K4 book drift ran against ~/PWS-Book (not skipped) and passed |
| data/cynefin-label-provenance.json | label provenance, counts and hashes only | VERIFIED | derive-cynefin-labels --check PASS |
| data/problem-axes-wording.json | v1, v2 wording; wicked_cutoff block | VERIFIED (cut-off not fitted) | see truth 11 |
| lib/core/decision-advisor/domain.cjs | domain effect, lazy loaded | VERIFIED | 399 S6 pin: loaded only on the domain path |
| lib/core/navigation/cause-effect.cjs | room-level store | VERIFIED | wired through navigation.cjs |
| lib/core/cause-effect-card.cjs | two-stage card | VERIFIED | used by gate.cjs |
| services/decision-relay/*.cjs, render.yaml, README.md | relay, blueprint, operator README | VERIFIED | 786 lines of code; tests relay, relay-server, relay-packaging, relay-fence PASS |
| scripts/decision-advisor-transport.cjs | relay client and operator release run | VERIFIED | relay-transport PASS |
| scripts/derive-wicked-cutoff.cjs | dev-time cut-off fit | VERIFIED as code | --check PASS on the not_fitted block |
| tests/run-all-400.sh | aggregator | VERIFIED | exit 0 |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| services/decision-relay/relay.cjs | lib/core/decision-advisor/labels-only.cjs | require, validateNeutralRequest and validateProviderBody | WIRED |
| relay.cjs | catalog fingerprint | x-mindrian-catalog header compare, 409 catalog_skew | WIRED |
| scripts/decision-advisor-transport.cjs | data/egress-policy.json decision_advisor | egress-policy.cjs, line name | WIRED (default false) |
| gate.cjs gate_answer | navigation/cause-effect.cjs | ratifyCauseEffect inside the gate transaction | WIRED |
| sensors.cjs suggest_next | readCauseEffect | causeEffectFor(roomDir) | WIRED |
| shortlist.cjs | domain.cjs | lazy require('./domain.cjs') | WIRED |
| next-move.cjs, command-resolver.cjs | lookupShortlist causeEffect | fit set of the one lookup | WIRED |
| selection-log.cjs | selection_observations.cause_effect_domain | INSERT column | WIRED |
| build-skill-mirrors.cjs | skills/*/SKILL.md mirrors | --check | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| suggest_next cause_effect field | room domain | identity table via readCauseEffect | yes, navigator answer from gate_answer | FLOWING |
| advisor domain note | host_notes | data/cynefin-domains.json | yes | FLOWING |
| wickedFromProbability | wicked_cutoff | data/problem-axes-wording.json | no fit yet, answers null | STATIC (by design, see truth 11) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| No domain equals 399 output | node cmp.cjs on git archive c1e496ae8 and HEAD, MINDRIAN_DECISION_ADVISOR=on | byte-identical, 17376 bytes | PASS |
| Domain effects | lookupShortlist validate-idea per domain | clear, complicated, complex tie_kept; chaotic no_fit and no_strong_pick; disorder note; bogus domain ignored | PASS |
| Public output for chaotic and disorder | publicShortlist | chaotic bands possible plus host note; disorder same bands plus slicing note | PASS |
| Level wording default | levelWording() with no env | v1, shipped | PASS |
| Frontmatter parse | yaml parse of 255 capability files | 254 with 3 non-empty slots, 0 errors | PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| tests/run-all-400.sh | bash tests/run-all-400.sh | exit 0: 21 phase-400 tests PASS, 7 drift checks PASS, run-all-399 PASS | PASS |
| tests/test-346-catalogue-schema.cjs | node | FAIL 12 (hook mechanism partition) | pre-existing, phase 400 changes no hook file (deferred-items 3) |
| tests/test-355-direction-agreement.cjs | node | leg H FAIL (rs-chain-feeder.cjs, test-rs-discovery-engine.cjs) | pre-existing, files not in the phase diff (deferred-items 4) |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| JS-01 | vocabulary sentences, 20, provisional, summary unchanged | SATISFIED | truth 1, 3; J3 PASS |
| JS-02 | 73 run-step command sentences in frontmatter, registry, mirrors | SATISFIED | truth 1, 3 (trending-to-absurd skill is not a mirror, disclosed) |
| JS-03 | 40 other commands, 12 standalone skills, 17 agents | SATISFIED | truth 1; S5 to S7 PASS |
| JS-04 | 63 MCP tool sentences in a data file | SATISFIED | M1 PASS |
| JS-05 | framework sentences reused, 184 parse | SATISFIED | data/framework-jobs.json unchanged; F1 PASS |
| JS-06 | slot validator, writer, drift test, descriptions never grow | SATISFIED | truth 2; B1, F1, --check PASS |
| CY-01 | cause_effect axis, additive, cynefin_rating alias | SATISFIED | truth 4 |
| CY-02 | data/cynefin-domains.json with book drift test | SATISFIED | K4 ran and PASS |
| CY-03 | two-stage gate card, room-level store through navigation, aliases.yml, suggest_next field | SATISFIED | truth 5 |
| CY-04 | fits_domains and move_type on 73 run-step commands | SATISFIED | 73 of 73 carry both keys |
| CY-05 | advisor domain key, in-band reorder, chaotic and disorder, consumers | SATISFIED (order rule needs a human read) | truth 6 to 8 |
| CY-06 | labels-only catalog gains domain and move type | SATISFIED | truth 9 |
| CY-07 | selection log domain column | SATISFIED | truth 8 |
| AX-01 | reworded Well-defined test behind a flag | SATISFIED | truth 10 |
| AX-02 | wicked cut-off, never raw 0.5 | SATISFIED as worded; fit pending | truth 11 |
| RL-01 | relay pipeline with the shared validator | SATISFIED | truth 12 |
| RL-02 | install-id callers, caps, operator token, counts-only logs | SATISFIED | C1 to C4, review proof of log content |
| RL-03 | catalog skew detected and refused | SATISFIED | R4, T4 PASS |
| RL-04 | relay server, health, render.yaml, README, not shipped | SATISFIED | K1 to K5 PASS |
| RL-05 | relay client behind the off line, O-10 operator run with audit | SATISFIED | T1, O1 to O9 PASS |
| LR-01 | owner review file with drift test | SATISFIED | truth 13 |
| PG-01 | run-all-400 aggregator and phase gates | SATISFIED | exit 0 |

No orphaned requirement: the ROADMAP lists 24 ids, and every id maps to a plan and to evidence above.

### Additive Against 399 Pins

Seven pre-existing tests changed. Six (test-348, test-361, test-363, test-3696, test-370, test-389) drop only the 8 new key names before their byte compare; every other pinned byte stays pinned. tests/test-399-table.cjs S6 changed from exactly node:fs and node:path to those two plus the one lazy sibling ./domain.cjs, with an added check that domain.cjs stays unloaded on the no-domain path (review WR-08). This is a narrow, stated widening of a 399 pin, not a removal. run-all-399.sh PASS.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| added lines in lib, scripts, services, data, tests, commands, skills, agents | - | TBD, FIXME, XXX, TODO, HACK | none found | - |
| all added lines | - | em dash or en dash | none found | - |
| 65 command frontmatter comments | - | stale line pointers "first delivery at commands/<name>.md:<line>" (off by 4) | Info | deferred-items 1, later quick task or Phase 401 |
| 17 agents, 12 standalone skills | - | job keys after a "# ---" comment line | Info | YAML parse shows the keys are top-level frontmatter; a host that ends frontmatter at "# ---" is a hypothesis owned by 400.1 F1 and Phase 401 |

### Human Verification Required

1. **Wicked cut-off fit (AX-02).** Supply the two wicked label files and run scripts/derive-wicked-cutoff.cjs --write, or accept not_fitted by the override above.
2. **Order rule of WR-04 and WR-09.** Read the in-band reorder in next-move.cjs and command-resolver.cjs and confirm the intent.
3. **IN-04 owner choice.** Add a relay provider id to the decision_advisor providers list, or keep the gate by line name.
4. **Domain card on three surfaces.** Render and answer the two-stage card on CLI, Desktop and Cowork; confirm the suggest_next cause_effect field.
5. **Provisional labels.** Rule on the lists in 400-LABEL-REVIEW.md.

### Gaps Summary

No blocker. Every one of the 24 requirement ids has code and passing tests at HEAD 3daeb0dea. One goal clause is partial: the wicked cut-off rule is in place and never uses a raw 0.5, but it is not fitted, because the label files are not on this machine (400-CONTEXT.md OPEN line). The owner decides: fit it, or accept not_fitted by an override. Four further items need a human read or choice (WR-04 and WR-09 order rule, IN-04, the domain card on three surfaces, the provisional labels).

---

_Verified: 2026-11-24T12:49:08Z_
_Verifier: Claude (gsd-verifier)_

## Owner sign-off, 2026-11-25

The owner answered the five human items on the sign-off page (saved answers, 2026-11-25T10:20Z to 10:46Z). Status stays human_needed for one remainder, named in row 5.

| # | Item | Owner answer | Result |
|---|---|---|---|
| 1 | Wicked cut-off (AX-02) | Fit it; Codex and Fable decide the value | OVERRIDE. The label files are not on this machine, so no fit ran. The cut-off is ruled at 0.9, state ruled, status provisional (365fce03b). The goal clause "fitted" is met by a ruled value, not a fit. |
| 2 | Order rule (WR-04, WR-09) | Agree | CLOSED. The in-band reorder is the intended one. |
| 3 | Relay gate (IN-04) | Add a relay provider id | CLOSED. decision_relay is on the decision_advisor providers list in data/egress-policy.json; tests/test-399-egress-line.cjs pins it (E4, E5). The line default stays false. |
| 4 | Domain card on three surfaces | Pass on Claude Code CLI, Claude Desktop and Cowork | CLOSED. |
| 5 | Provisional labels | Edited, then approved after the edit | CLOSED IN PART. 7 vocabulary sentences ruled (307a951ea, ef5ef3421). Personas: the owner accepted the draft on 2026-11-25, so the section job stays understand-market (source jev-probe-draft-gloss) with no "One job" sentence; data/section-job-canon.json is unchanged. OPEN: the funding section job. The other label lists were not changed by the owner and stay provisional. |

Also on 2026-11-25: the branch was merged into main after v2.0.0-beta.89 (f9148bf5c), and the advisor table stopped offering deprecated commands (a6d2e63ab). The O-12 commands stay on the run-step list.
