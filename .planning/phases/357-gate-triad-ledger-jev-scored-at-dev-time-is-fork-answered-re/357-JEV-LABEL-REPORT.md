# Phase 357 Jev Label Report

Run timestamp: 2026-09-23T19:22:24.784Z
Model: jev-latest
Policy sha256: 3f220267e874d7cdecac69dacc8a4941d799495a0c6bca04163dc25d9dd87924
Thresholds: yes >= 0.8, no <= 0.2, otherwise uncertain
Counts by agreement: no=13, unlabeled=2, yes=21

Jev labels are never auto-applied; every disagreement below needs a navigator ruling (D-12).

| id | source | hand | is_fork | already_answered | relevant | verdict | agree |
|----|--------|------|---------|-------------------|----------|---------|-------|
| 238:inline-academic-citation:s1 | 238 | pass | no | no | no | pass | yes |
| 238:footnote-reference-list:s1 | 238 | pass | no | no | no | pass | yes |
| 238:markdown-reference-link-definitions:s1 | 238 | pass | no | no | no | pass | yes |
| 238:array-indexing-in-prose:s1 | 238 | pass | no | no | no | pass | yes |
| 238:code-enum-indexing:s1 | 238 | pass | no | no | no | pass | yes |
| 238:benign-numbered-step-instructions:s1 | 238 | pass | no | no | no | pass | yes |
| 238:benign-action-footer:s1 | 238 | pass | no | no | no | pass | yes |
| 238:terse-turn-after-stale-reach-suggestion:s1 | 238 | pass | no | no | no | pass | yes |
| 238:turn-following-already-answered-gate:s1 | 238 | pass | no | no | no | pass | yes |
| 238:notification-only-turn:s1 | 238 | pass | no | no | no | pass | yes |
| 238:genuine-multiline-bracket-box:s2 | 238 | block | yes | no | no | pass | no |
| 238:genuine-multiline-bracket-box:s3 | 238 | block | yes | no | no | pass | no |
| 238:genuine-bulleted-bracket-box:s2 | 238 | block | uncertain | no | no | pass | no |
| 238:genuine-bulleted-bracket-box:s3 | 238 | block | uncertain | no | no | pass | no |
| 238:type-1-2-or-3-literal:s2 | 238 | block | yes | no | no | pass | no |
| 238:type-1-2-or-3-literal:s3 | 238 | block | yes | no | no | pass | no |
| 238:reconstructed-two-honest-paths-fork:s2 | 238 | block | yes | no | no | pass | no |
| 238:reconstructed-two-honest-paths-fork:s3 | 238 | block | yes | no | no | pass | no |
| debug-backstop-benign-list | debug | pass | no | no | no | pass | yes |
| debug-answered-gate-refires | debug | pass | no | uncertain | no | pass | yes |
| debug-block-surface-simple-binary | debug | pass | uncertain | no | yes | uncertain | unlabeled |
| debug-over-enforcement-stale-terse | debug | pass | no | no | no | pass | yes |
| debug-relevance-check-gap-no-subject | debug | pass | no | no | no | pass | yes |
| debug-stale-f1-irrelevant | debug | pass | no | no | no | pass | yes |
| debug-option-shaped-prose-f8-chrome | debug | pass | uncertain | uncertain | no | pass | yes |
| debug-room-bind-tool-result | debug | pass | uncertain | no | no | pass | yes |
| debug-room-bind-task-notification | debug | pass | uncertain | no | no | pass | yes |
| debug-intern-w1-labeled-fork | debug | block | yes | no | no | pass | no |
| debug-intern-w1-prose-fork | debug | block | yes | no | no | pass | no |
| debug-reach-gate-stale-turn-input | debug | block | no | no | uncertain | pass | no |
| debug-carveout-skill-meta-after-human | debug | block | no | no | uncertain | pass | no |
| debug-carveout-image-meta-after-human | debug | block | no | no | no | pass | no |
| debug-harness-peer-after-tool-result | debug | pass | uncertain | no | no | pass | yes |
| debug-harness-idle-notice | debug | pass | no | no | no | pass | yes |
| live-2026-09-23-01 | live | pass | no | no | no | pass | yes |
| live-2026-09-23-02 | live | pass | uncertain | no | uncertain | uncertain | unlabeled |

## Disagreements for navigator ruling

- 238:genuine-multiline-bracket-box:s2
- 238:genuine-multiline-bracket-box:s3
- 238:genuine-bulleted-bracket-box:s2
- 238:genuine-bulleted-bracket-box:s3
- 238:type-1-2-or-3-literal:s2
- 238:type-1-2-or-3-literal:s3
- 238:reconstructed-two-honest-paths-fork:s2
- 238:reconstructed-two-honest-paths-fork:s3
- debug-intern-w1-labeled-fork
- debug-intern-w1-prose-fork
- debug-reach-gate-stale-turn-input
- debug-carveout-skill-meta-after-human
- debug-carveout-image-meta-after-human
