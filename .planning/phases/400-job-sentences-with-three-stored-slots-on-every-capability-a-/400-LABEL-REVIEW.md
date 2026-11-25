# Phase 400 label review for the owner

Phase 400 plan 15 (S5, LR-01). Ids, labels and counts only. This file quotes no research text, no probability and no book text.
Nothing in this file is a ruling. Every label of this phase is provisional until the owner rules, except the items marked ACCEPTED.
tests/test-400-review-lists.cjs keeps every "- ids (...)" line and every "count (...)" line equal to the value computed from the frontmatter, the registry and the data files.

## 1. Job vocabulary sentences

The 20 jobs of data/job-vocabulary.json carry one three-slot sentence each (fields sentence, slots, sentence_status). The summary field is unchanged.
O-14 (owner card 2026-11-24): the sentences were written fresh from repo text, not from the research drafts. They ship as provisional.
Owner ruling 2026-11-25: 7 sentences were reworded and are RULED: build, decide-pursue, design-solution, explore, navigate, plan-execution, protect-assets. Second ruling the same day: the other 13 were reviewed against Theo's ruled framework sentences (data/framework-jobs.json) and are RULED as written. All 20 vocabulary sentences are ruled.

- count (sentences-vocabulary): 20
- ids (vocabulary-provisional): none
- count (vocabulary-provisional): 0

Section-only jobs: the 4 jobs whose only origin is the section canon. They have no taxonomy summary. They got sentences like every other id.

- ids (section-only-jobs): design-solution, model-business, model-finances, protect-assets
- count (section-only-jobs): 4

Jobs with no research draft: the 3 ids that Phase 399 added from the registry (summary_source phase-399).

- ids (jobs-without-research-draft): build, navigate, temporal-correction
- count (jobs-without-research-draft): 3

Owner action: confirm or reword each sentence. The text is in data/job-vocabulary.json.

## 2. Carried from 399

Section jobs (data/section-job-canon.json):

- ids (carry-section-jobs): funding|plan-execution, personas|understand-market
- count (carry-section-jobs): 2
- funding: the section job is plan-execution. The research run scored plan-execution low for this section, and its top job was find-bottleneck. RULED 2026-11-25: the owner keeps plan-execution. No change to data/section-job-canon.json.
- personas: the section job is understand-market (source jev-probe-draft-gloss). The section has no "One job" sentence. Owner action: write the "One job" sentence, or rule that the draft gloss is enough.

Held pairs (399-LABEL-REVIEW.md section 1). They are not applied. The registry does not carry them.

- ids (held-pairs): find-bottleneck|/mos:show, surface-contradiction|/mos:memory-cortex-reach
- count (held-pairs): 2

Doubtful labels (399-LABEL-REVIEW.md section 2). The registry still carries them. They are not changed.

- ids (doubtful-labels): audit-room|/mos:admin, compare-options|/mos:deep-grade, compare-options|/mos:models, validate-idea|/mos:dial-memory-refresh, validate-idea|/mos:feynman-timeline-refresh
- count (doubtful-labels): 5

The 0.70 to 0.89 band: command pairs from the recorded 399 run with 0.70 <= p < 0.90, where the registry serves_jtbd of the command does not hold the job. The rule and the sample of 30 pairs are in 399-LABEL-REVIEW.md section 7. This phase does not change the band.

- count (band-0.70-0.89): 132

## 3. Capability sentences

Every capability carries one provisional three-slot sentence (job_when, job_want, job_so, job_sentence_status). No description field changed (tests/test-400-description-budget.cjs).

- count (sentences-commands): 113
- count (sentences-standalone-skills): 12
- count (sentences-agents): 17
- count (sentences-mcp-tools): 63
- count (framework-statements): 184

Where each sentence is stored:

- Commands: own frontmatter keys in commands/*.md (O-11). data/command-registry.json carries the copy (job_sentence). The generated skill mirrors carry the same 4 lines.
- Standalone skills and agents: own frontmatter keys in skills/<name>/SKILL.md and agents/*.md (O-11).
- MCP tools: data/mcp-tool-job-sentences.json (MCP tools have no frontmatter).
- Frameworks: data/framework-jobs.json is reused through a read-time view (frameworkSentences in lib/core/job-sentence.cjs). The file is not edited.

Ruled framework statements exempt from the "to " want rule (plan 04). The want slot of these 5 statements does not begin with "to ". The test drops only that one style rule for them; every other slot rule and the round trip hold.

- names (framework-want-exempt): Ansoff Matrix; MECE (Mutually Exclusive, Collectively Exhaustive); Psychological Safety; Six Thinking Hats; Value Proposition
- count (framework-want-exempt): 5

Open item from plan 02: skills/trending-to-absurd/SKILL.md is hand-authored and on the mirror skip list, so it carries no job lines. The command file and the registry row carry the sentence. Owner action: leave it, or let the writer label skip-listed skills.

### Deferred to Phase 401

- Stale line pointers: command frontmatter comments of the form `first delivery at commands/<name>.md:<line>`. The 4 job lines sit above every cited line, so each cited line number is now 4 lower than the real line. Not fixed in this phase.
- count (stale-delivery-pointers): 65
- F1 frontmatter end: in agents and standalone skills, the job lines sit after the first `# ---` comment line inside frontmatter. When a host ends frontmatter at that comment, the host does not see the job keys. No new `---` line was added.
- count (job-lines-after-comment): 27
- ids (job-lines-not-after-comment): agents/research.md, agents/reverse-salient-agent.md
- count (job-lines-not-after-comment): 2

## 4. fits_domains

The 73 run-step commands carry fits_domains, move_type, move_type_weak and cynefin_label_status provisional as own frontmatter keys (plan 06). A domain fits when the recorded labels-only run gave p at or above 0.70. Provenance: data/cynefin-label-provenance.json (source names, hashes and counts only).

- count (run-step-commands): 73
- ids (fits-clear): /mos:funding, /mos:grade-grant, /mos:onboard
- count (fits-clear): 3
- ids (fits-complicated): /mos:act, /mos:analyze-needs, /mos:analyze-timing, /mos:auto-explore, /mos:beautiful-question, /mos:bono, /mos:build-knowledge, /mos:build-thesis, /mos:causal, /mos:challenge-assumptions, /mos:compare-ventures, /mos:deep-grade, /mos:diagnostics, /mos:diffusion, /mos:discover, /mos:dominant-designs, /mos:eureka, /mos:explain-decision, /mos:explore-opportunity, /mos:find-bottlenecks, /mos:find-connections, /mos:futures, /mos:grade, /mos:grade-grant, /mos:hat-briefing, /mos:intel-pipeline, /mos:leadership, /mos:macro-trends, /mos:mos-reason, /mos:mullins, /mos:mva-brief, /mos:opportunities, /mos:persona, /mos:pipeline, /mos:qualify-opportunity, /mos:reanalyze, /mos:research, /mos:root-cause, /mos:rs-explain, /mos:rs-fetch, /mos:scenario-plan, /mos:scientific-roadmap, /mos:stance, /mos:structure-argument, /mos:suggest-next, /mos:systems-thinking, /mos:think-hats, /mos:validate, /mos:validate-proposition, /mos:whitespace
- count (fits-complicated): 50
- ids (fits-complex): /mos:analyze-systems, /mos:auto-explore, /mos:beautiful-question, /mos:bono, /mos:challenge-assumptions, /mos:compare-ventures, /mos:diagnostics, /mos:diffusion, /mos:eureka, /mos:explore-futures, /mos:explore-opportunity, /mos:explore-trends, /mos:find-analogies, /mos:find-bottlenecks, /mos:find-connections, /mos:futures, /mos:grade, /mos:intel-pipeline, /mos:map-unknowns, /mos:new-project, /mos:persona, /mos:qualify-opportunity, /mos:radar, /mos:reanalyze, /mos:research, /mos:scientific-roadmap, /mos:scout, /mos:suggest-next, /mos:systems-thinking, /mos:think-hats, /mos:trending-to-absurd, /mos:validate-proposition, /mos:whitespace
- count (fits-complex): 33
- ids (fits-chaotic): none
- count (fits-chaotic): 0
- ids (fits-disorder): /mos:auto-explore, /mos:bono, /mos:diagnose, /mos:diagnostics, /mos:discover, /mos:explore-domains, /mos:explore-opportunity, /mos:find-bottlenecks, /mos:ignite, /mos:leadership, /mos:macro-trends, /mos:map-unknowns, /mos:persona, /mos:structure-argument, /mos:suggest-next
- count (fits-disorder): 15
- ids (no-domain): /mos:file-meeting, /mos:jtbd, /mos:lean-canvas, /mos:mva-report, /mos:organize, /mos:rs-experts, /mos:rs-thesis, /mos:score-innovation, /mos:user-needs
- count (no-domain): 9

The chaotic list is empty (F-04). No command on this install fits chaotic. The advisor shows "no strong pick" for a chaotic room with the chaotic host note of section 8.

## 5. move_type

move_type is the top move of the recorded run. move_type_weak is true when the top move probability is under 0.5.

- ids (move-categorize): /mos:auto-explore, /mos:file-meeting, /mos:funding, /mos:grade, /mos:grade-grant, /mos:ignite, /mos:jtbd, /mos:lean-canvas, /mos:mva-brief, /mos:mva-report, /mos:new-project, /mos:onboard, /mos:organize
- count (move-categorize): 13
- ids (move-analyze): /mos:analyze-needs, /mos:analyze-timing, /mos:bono, /mos:build-thesis, /mos:causal, /mos:challenge-assumptions, /mos:compare-ventures, /mos:deep-grade, /mos:diffusion, /mos:discover, /mos:dominant-designs, /mos:explain-decision, /mos:find-analogies, /mos:find-bottlenecks, /mos:hat-briefing, /mos:leadership, /mos:mos-reason, /mos:mullins, /mos:opportunities, /mos:persona, /mos:reanalyze, /mos:root-cause, /mos:rs-fetch, /mos:rs-thesis, /mos:score-innovation, /mos:suggest-next, /mos:user-needs, /mos:validate-proposition
- count (move-analyze): 28
- ids (move-probe): /mos:analyze-systems, /mos:beautiful-question, /mos:diagnostics, /mos:eureka, /mos:explore-futures, /mos:explore-opportunity, /mos:explore-trends, /mos:find-connections, /mos:futures, /mos:intel-pipeline, /mos:pipeline, /mos:qualify-opportunity, /mos:radar, /mos:research, /mos:rs-experts, /mos:rs-explain, /mos:scenario-plan, /mos:scientific-roadmap, /mos:scout, /mos:stance, /mos:systems-thinking, /mos:think-hats, /mos:trending-to-absurd, /mos:validate, /mos:whitespace
- count (move-probe): 25
- ids (move-act): none
- count (move-act): 0
- ids (move-slice): /mos:act, /mos:build-knowledge, /mos:diagnose, /mos:explore-domains, /mos:macro-trends, /mos:map-unknowns, /mos:structure-argument
- count (move-slice): 7
- ids (move-weak): /mos:act, /mos:analyze-systems, /mos:auto-explore, /mos:diagnostics, /mos:discover, /mos:macro-trends, /mos:opportunities, /mos:persona, /mos:pipeline, /mos:research, /mos:rs-explain, /mos:stance, /mos:structure-argument, /mos:suggest-next, /mos:think-hats
- count (move-weak): 15

The act list is empty (F-05). This is the same fact as the empty chaotic list of section 4.

## 6. Move matching exclusions

Rule (plan 09): a command enters move matching only when its registry kind is methodology. An excluded command keeps its 399 behaviour: the domain never demotes it and never boosts it.
Assumption A4 (RESEARCH): kind methodology is an acceptable housekeeping rule. Caution: scripts/build-command-registry.cjs states that kind is the wrong fence for "navigator against plumbing" (that fence is surface). Here kind answers a different question: is this a methodology move with a Cynefin verb order?

- count (methodology-run-step): 51
- ids (move-matching-excluded): /mos:act, /mos:auto-explore, /mos:eureka, /mos:explain-decision, /mos:explore-opportunity, /mos:file-meeting, /mos:funding, /mos:ignite, /mos:intel-pipeline, /mos:mva-brief, /mos:mva-report, /mos:new-project, /mos:onboard, /mos:opportunities, /mos:organize, /mos:pipeline, /mos:qualify-opportunity, /mos:radar, /mos:reanalyze, /mos:scout, /mos:stance, /mos:suggest-next
- count (move-matching-excluded): 22
- ids (excluded-meta): /mos:act, /mos:intel-pipeline, /mos:pipeline, /mos:suggest-next
- count (excluded-meta): 4
- ids (excluded-utility): /mos:auto-explore, /mos:eureka, /mos:explain-decision, /mos:explore-opportunity, /mos:file-meeting, /mos:funding, /mos:ignite, /mos:mva-brief, /mos:mva-report, /mos:new-project, /mos:onboard, /mos:opportunities, /mos:organize, /mos:qualify-opportunity, /mos:radar, /mos:reanalyze, /mos:scout, /mos:stance
- count (excluded-utility): 18
- ids (excluded-categorize): /mos:auto-explore, /mos:file-meeting, /mos:funding, /mos:ignite, /mos:mva-brief, /mos:mva-report, /mos:new-project, /mos:onboard, /mos:organize
- count (excluded-categorize): 9

Excluded utility commands that read as methodology (RESEARCH Q5). Owner action: keep them excluded, or change their kind to methodology.

- ids (utility-reads-as-methodology): /mos:eureka, /mos:explore-opportunity, /mos:qualify-opportunity, /mos:radar, /mos:scout
- count (utility-reads-as-methodology): 5

### Code review: shortlist.cjs loads domain.cjs by a built path (plan 09)

- lib/core/decision-advisor/shortlist.cjs loads domain.cjs with `require(DOMAIN_MODULE)`, where `DOMAIN_MODULE = path.join(__dirname, 'domain.cjs')`. It loads only when a closed domain is given.
- Reason: tests/test-399-table.cjs S6 allows only the require literals node:fs and node:path in shortlist.cjs. A literal `require('./domain.cjs')` fails S6.
- Effect: static require scans do not see this edge. tests/test-369-hook-require-graph.cjs counts it as one advisory dynamic site and passes. tests/test-400-advisor-domain.cjs A9 pins the one built-path require, and pins that domain.cjs requires only node:fs and node:path.
- Owner action: accept the built path, or allow the literal in S6 (a test-399 edit, which this phase does not make).

## 7. O-12 commands

O-12 (owner card 2026-11-24): organize, mva-brief and mva-report stay on the 73 run-step list and are labelled in this phase. Each carries a job sentence and the Cynefin labels. Each sentence describes the job of its successor surface. Their removal belongs to a later efficiency phase.

- ids (o12-labelled): /mos:mva-brief, /mos:mva-report, /mos:organize
- count (o12-labelled): 3

## 8. Card wording and host notes (O-03)

ACCEPTED. O-13 (owner card 2026-11-24): the two-stage card wording and the disorder and chaotic host notes are accepted as written. This confirms O-03. No owner action is open. The text lives in data/cynefin-domains.json and is copied here exactly.

- ids (card-options): ce-act, ce-anyone, ce-cannot-tell, ce-nobody, ce-probe, ce-trained
- count (card-options): 6

Stage 1 header: Who can see cause and effect here, before you act?

- ce-anyone: Everyone can see it (clear)
- ce-trained: Only trained people can see it (complicated)
- ce-nobody: Nobody can see it before we act (goes to stage 2)
- ce-cannot-tell: We cannot answer: people give different answers (disorder)

Stage 2 header: Is there time to try small, safe probes first?

- ce-probe: Yes: we can try safe probes and watch (complex)
- ce-act: No: we must act now to make it stable (chaotic)

Disorder host note (O-03): Cause and effect domain: disorder. The navigator cannot tell which domain applies. The book's move for disorder is to slice: break the situation into parts and place each part in its own domain before choosing a move. The host model decides how to use the shortlist.

Chaotic host note (F-04): Cause and effect domain: chaotic. No command on this install is an act-first move, so there is no strong pick. Act to make the situation stable first, then look again.

A dialog closed with no answer, a reject or a defer stores nothing.

## 9. Problem axes (S3)

Level wording (AX-01): the reworded Well-defined test (F-07, O-02) ships as v2 behind MINDRIAN_LEVEL_WORDING=v2. The default is v1, the shipped table wording. Only the exact value v2 turns the flag on. The v2 text is in data/problem-axes-wording.json (level_wording.versions.v2), status provisional. Owner action: rule v2 after fresh cases confirm it (Deferred in CONTEXT).

Wicked cut-off (AX-02, F-06): the shipped block is state ruled, value 0.9, status provisional. It is a ruling and not a fit. The owner delegated the choice on 2026-11-25 (sign-off page, item 1), and two models chose it as a conservative policy value: a false yes is the worse error, because the wicked label changes the posture of the product. No label file was read. wickedFromProbability answers yes at or above the value and no below it; no raw 0.5 cut exists. The fit is still pending the two label files of plan 11, which are not on this machine; when it runs it replaces the ruled value.

NEEDS_HUMAN: copy theo-routing-labels-two-axis-60.md and theo-routing-labels-two-axis-batch4-larry.md from the research machine, then run node scripts/derive-wicked-cutoff.cjs --answers <file> --labels <file> --labels <file> --write

## 10. Owner-gated relay steps

The 8 OWNER-GATED steps of services/decision-relay/README.md (the K4 list). No agent takes any of them.

- count (owner-gated-steps): 8

1. Choose the Render plan and confirm its price (the Blueprint names 0.5c-512mb, region oregon).
2. Create the service from the Blueprint, with Blueprint Path services/decision-relay/render.yaml.
3. Set GEMINI_API_KEY in Render.
4. Mint an operator token locally and set only its sha256 in RELAY_OPERATOR_TOKEN_SHA256.
5. Confirm the paid Gemini tier on the key's project before any user traffic (F-09).
6. Keep RELAY_USER_TRAFFIC off until a separate owner ruling (O-10). The egress line decision_advisor also stays off for users.
7. Deploy only from the release commit (catalog skew, Pitfall 12).
8. Run one instance (assumption A3: the caps are in memory).

### Relay design choice for owner review (plan 12)

- Operator usage is counted apart from the user counters. The operator meets only operator_daily_cap. Operator questions, requests and input tokens do not use up the global user budget (services/decision-relay/limits.cjs).
- Effect: a release-time table build cannot exhaust the daily budget of user installs, and user traffic cannot block a release build. The bill bound is the global user cap plus the operator cap.
- Owner action: accept the split, or rule that operator usage also counts against the global cap.

### Release-note lines (the release cut is owner-gated)

- room.db: the table selection_observations gains the nullable column cause_effect_domain (a closed label, the room's navigator-set Cynefin domain at decision time). A 399 table migrates on first use. cynefin_rating stays written for one release as a deprecated alias. Registered in aliases.yml as selection_observations_cause_effect_domain.
- room.db: the identity table gains the key problem.cause_effect, written only by lib/core/navigation/cause-effect.cjs when the navigator approves the cause and effect card. Registered in aliases.yml as problem_cause_effect.
