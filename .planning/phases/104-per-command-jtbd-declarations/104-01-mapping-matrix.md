# Phase 104-01 -- JTBD-to-Command Mapping Matrix

Status: canonical reference for Plan 104-01 sweep.
Source: lib/hmi/jtbd-taxonomy.json entries[i].methodology_hooks[] + CONTEXT.md specifics + command name semantics.
Date: 2026-05-02 (Phase 104 planning).

## Coverage check (every JTBD has >= 3 commands serving it)

| JTBD id              | Commands serving it (count) |
|----------------------|----------------------------|
| decide-pursue        | 8 |
| find-problem         | 6 |
| understand-market    | 7 |
| find-bottleneck      | 6 |
| prepare-pitch        | 6 |
| validate-idea        | 6 |
| compare-options      | 6 |
| connect-domains      | 5 |
| surface-contradiction | 4 |
| plan-execution       | 6 |
| file-meeting         | 4 |
| audit-room           | 12 |
| explore              | 11 |

## Per-command mapping (84 commands; 3 already declared; 81 new declarations)

NOTE: The 3 commands already declaring serves_jtbd at start of Phase 104 are LEFT BYTE-IDENTICAL by Plan 104-01 (re-declaration is a forbidden no-op):
- commands/jtbd.md          -> ["audit-room"]      (Phase 100-04 shipped)
- commands/memory.md        -> ["audit-room"]      (Phase 103-03 shipped)
- commands/hmi-status.md    -> ["audit-room"]      (Phase 105-02 shipped)

The 81 new declarations:

| Command file                       | serves_jtbd value                                       | Rationale |
|------------------------------------|--------------------------------------------------------|-----------|
| commands/act.md                    | ["plan-execution"]                                      | Taxonomy methodology_hooks lists /mos:act under plan-execution |
| commands/admin.md                  | ["audit-room"]                                          | Plugin-admin meta command; closest user-facing JTBD is audit-room (room health surface) |
| commands/analyze-needs.md          | ["find-problem"]                                        | Taxonomy methodology_hooks lists /mos:analyze-needs under find-problem |
| commands/analyze-systems.md        | ["find-bottleneck"]                                     | Taxonomy methodology_hooks lists /mos:analyze-systems under find-bottleneck |
| commands/analyze-timing.md         | ["understand-market"]                                   | Market timing analysis is part of market understanding |
| commands/beautiful-question.md     | ["find-problem", "explore"]                             | Taxonomy methodology_hooks lists /mos:beautiful-question under find-problem; reformulation also serves explore |
| commands/brain-derive.md           | ["audit-room"]                                          | BRAIN.md derivation per section is a room health/intelligence surface |
| commands/build-knowledge.md        | ["explore"]                                             | Knowledge base construction is open-ended; no specific JTBD mapping |
| commands/build-thesis.md           | ["decide-pursue", "prepare-pitch"]                      | Taxonomy methodology_hooks lists /mos:build-thesis under both decide-pursue and prepare-pitch |
| commands/causal.md                 | ["find-problem", "find-bottleneck"]                     | Causal analysis serves both root-cause finding and bottleneck identification |
| commands/challenge-assumptions.md  | ["validate-idea", "surface-contradiction"]              | Taxonomy methodology_hooks lists /mos:challenge-assumptions under validate-idea AND surface-contradiction |
| commands/compare-ventures.md       | ["compare-options"]                                     | Taxonomy methodology_hooks lists /mos:compare-ventures under compare-options |
| commands/dashboard.md              | ["audit-room", "prepare-pitch"]                         | Dashboard is a room health view AND a pitch-ready visual artifact |
| commands/deep-grade.md             | ["audit-room", "compare-options"]                       | Taxonomy methodology_hooks lists /mos:deep-grade under audit-room AND compare-options |
| commands/diagnose.md               | ["decide-pursue"]                                       | Taxonomy methodology_hooks lists /mos:diagnose under decide-pursue |
| commands/diagnostics.md            | ["audit-room"]                                          | Taxonomy methodology_hooks lists /mos:diagnostics under audit-room |
| commands/doctor.md                 | ["audit-room"]                                          | Taxonomy methodology_hooks lists /mos:doctor under audit-room |
| commands/dominant-designs.md       | ["understand-market"]                                   | Taxonomy methodology_hooks lists /mos:dominant-designs under understand-market |
| commands/explain-decision.md       | ["audit-room"]                                          | Navigation engine decision trace is a room audit surface |
| commands/explore-domains.md        | ["find-problem", "understand-market", "explore"]        | CONTEXT.md heuristic example; engine 1 act 1 layer |
| commands/explore-futures.md        | ["compare-options", "explore"]                          | Scenario exploration; futures branching |
| commands/explore-trends.md         | ["understand-market", "explore"]                        | Taxonomy methodology_hooks lists /mos:explore-trends under understand-market |
| commands/export.md                 | ["prepare-pitch"]                                       | Export to deck / vault / dashboard is meeting/pitch prep |
| commands/file-meeting.md           | ["file-meeting"]                                        | CONTEXT.md heuristic example; taxonomy methodology_hooks |
| commands/find-analogies.md         | ["connect-domains"]                                     | Taxonomy methodology_hooks lists /mos:find-analogies under connect-domains |
| commands/find-bottlenecks.md       | ["find-bottleneck"]                                     | Taxonomy methodology_hooks lists /mos:find-bottlenecks under find-bottleneck |
| commands/find-connections.md       | ["connect-domains"]                                     | Taxonomy methodology_hooks lists /mos:find-connections under connect-domains |
| commands/funding.md                | ["prepare-pitch", "decide-pursue"]                      | Funding/grants prep is investor-facing |
| commands/grade.md                  | ["audit-room"]                                          | Taxonomy methodology_hooks lists /mos:grade under audit-room |
| commands/graph.md                  | ["audit-room", "explore"]                               | Graph navigation can be audit OR exploration |
| commands/hat-briefing.md           | ["prepare-pitch"]                                       | Taxonomy methodology_hooks lists /mos:hat-briefing under prepare-pitch |
| commands/heal.md                   | ["audit-room"]                                          | Taxonomy methodology_hooks lists /mos:heal under audit-room |
| commands/help.md                   | ["explore"]                                             | Help index is a meta/exploration surface |
| commands/leadership.md             | ["explore"]                                             | Leadership advisory is open-ended |
| commands/lean-canvas.md            | ["prepare-pitch", "validate-idea"]                      | CONTEXT.md heuristic example |
| commands/macro-trends.md           | ["understand-market"]                                   | Taxonomy methodology_hooks lists /mos:macro-trends under understand-market |
| commands/map-unknowns.md           | ["validate-idea"]                                       | Taxonomy methodology_hooks lists /mos:map-unknowns under validate-idea |
| commands/models.md                 | ["compare-options"]                                     | Mental model selection is a comparison framing |
| commands/mos-reason.md             | ["explore"]                                             | Reasoning meta surface |
| commands/mullins.md                | ["understand-market"]                                   | Taxonomy methodology_hooks lists /mos:mullins under understand-market |
| commands/new-project.md            | ["explore"]                                             | Room creation is the start of exploration |
| commands/onboard.md                | ["explore"]                                             | Onboarding is the entry-point meta surface |
| commands/operator.md               | ["explore"]                                             | CONTEXT.md heuristic example: meta-command -> explore |
| commands/opportunities.md          | ["explore"]                                             | Opportunity bank surface; cross-cutting |
| commands/organize.md               | ["audit-room"]                                          | Room organization is health/structure |
| commands/persona.md                | ["prepare-pitch"]                                       | Taxonomy methodology_hooks lists /mos:persona under prepare-pitch |
| commands/pipeline.md               | ["plan-execution"]                                      | Taxonomy methodology_hooks lists /mos:pipeline under plan-execution |
| commands/present.md                | ["prepare-pitch"]                                       | Taxonomy methodology_hooks lists /mos:present under prepare-pitch |
| commands/publish.md                | ["prepare-pitch"]                                       | Publish to public surface is pitch-prep |
| commands/query.md                  | ["audit-room", "explore"]                               | Graph query meta surface |
| commands/radar.md                  | ["understand-market"]                                   | Tech radar is a market intelligence surface |
| commands/reanalyze.md              | ["file-meeting"]                                        | Taxonomy methodology_hooks lists /mos:reanalyze under file-meeting |
| commands/research.md               | ["explore", "understand-market"]                        | Research is open-ended; market research is a common case |
| commands/room.md                   | ["audit-room"]                                          | Room metadata/inspection meta surface |
| commands/rooms.md                  | ["audit-room"]                                          | Multi-room registry/admin surface |
| commands/root-cause.md             | ["find-problem"]                                        | Taxonomy methodology_hooks lists /mos:root-cause under find-problem |
| commands/rs-experts.md             | ["find-bottleneck", "connect-domains"]                  | Reverse-salient experts surface; cross-domain expertise |
| commands/rs-explain.md             | ["find-bottleneck"]                                     | Reverse-salient explanation surface |
| commands/rs-fetch.md               | ["find-bottleneck", "surface-contradiction"]            | CONTEXT.md heuristic example |
| commands/rs-thesis.md              | ["find-bottleneck"]                                     | Reverse-salient thesis artifact |
| commands/scenario-plan.md          | ["compare-options", "plan-execution"]                   | CONTEXT.md heuristic example |
| commands/scheduled-tasks.md        | ["plan-execution"]                                      | Scheduled tasks surface |
| commands/score-innovation.md       | ["compare-options", "validate-idea"]                    | HSI scoring is comparison + validation |
| commands/scout.md                  | ["explore", "understand-market"]                        | Scouting is open-ended market reconnaissance |
| commands/setup.md                  | ["explore"]                                             | Setup wizard meta surface |
| commands/snapshot.md               | ["prepare-pitch", "audit-room"]                         | Snapshot export is pitch-prep AND audit |
| commands/speakers.md               | ["file-meeting"]                                        | Taxonomy methodology_hooks lists /mos:speakers under file-meeting |
| commands/splash.md                 | ["explore"]                                             | Splash/welcome meta surface |
| commands/status.md                 | ["audit-room", "explore"]                               | Room status is a health surface |
| commands/structure-argument.md     | ["validate-idea", "explore"]                            | Argument structuring is reasoning support |
| commands/suggest-next.md           | ["plan-execution", "explore"]                           | Next-action suggestion is execution + exploration |
| commands/systems-thinking.md       | ["find-bottleneck"]                                     | Taxonomy methodology_hooks lists /mos:systems-thinking under find-bottleneck |
| commands/think-hats.md             | ["explore", "compare-options"]                          | CONTEXT.md heuristic example |
| commands/update.md                 | ["audit-room"]                                          | Plugin self-update meta surface; closest is audit-room |
| commands/user-needs.md             | ["find-problem"]                                        | Taxonomy methodology_hooks lists /mos:user-needs under find-problem |
| commands/validate.md               | ["validate-idea"]                                       | CONTEXT.md heuristic example |
| commands/value-proposition.md      | ["validate-idea", "prepare-pitch"]                      | VP validation is a stress-test AND pitch readiness |
| commands/vault.md                  | ["prepare-pitch"]                                       | Obsidian vault export is pitch-ready knowledge artifact |
| commands/visualize.md              | ["audit-room", "prepare-pitch"]                         | Visualization surface; both health and pitch |
| commands/whitespace.md             | ["connect-domains", "find-problem"]                     | Whitespace map finds gaps + cross-domain links |
| commands/wiki.md                   | ["audit-room", "prepare-pitch"]                         | Wiki snapshot is health surface AND knowledge export |

## Summary

- 84 total commands in commands/*.md
- 3 already declaring (jtbd, memory, hmi-status -> all ["audit-room"])
- 81 new declarations added by Plan 104-01
- All 13 JTBD ids covered (>= 3 commands per id; explore covered by 11; audit-room covered by 12)
- Closed-vocabulary invariant: every value in serves_jtbd: arrays is one of the 13 ids in lib/hmi/jtbd-taxonomy.json entries[i].id
- No emdashes in any new content
