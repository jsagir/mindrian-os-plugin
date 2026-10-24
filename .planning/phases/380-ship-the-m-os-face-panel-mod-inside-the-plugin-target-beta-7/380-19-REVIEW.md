---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 19
reviewed: 2026-10-24
diff: d8e135577e3ea21c56611e6768cfc5434332b623..033eb328e (release tree /home/jsagi/dev/MindrianOS-Plugin-release, ui/mos-face, lib/mos-face)
verdict: Approve
---

# Review of plan 380-19

Intent: the panel says only what is true (advice words, ROOM row, NOW line, load notice), puts the status words and the Job before the decisions, folds by the rows the host gives, and draws words on a compact screen and in the band and the hint line. Method: the code-reviewer checklist, applied to the diff of this plan only.

## Summary

The diff has 23 files. Source: hooks/overview.ts (new, pure), hooks/register.tsx, hooks/status.ts, hooks/lines.ts, hooks/probe.ts, hooks/advice.ts, hooks/job.ts (one export name). Tests: truth, overview, overview-pane and band (new), plus changes in status, tree-pane and support. The dist is rebuilt and `--check` says fresh.

## Critical issues

None.

## Major issues

None.

## Minor issues

1. hooks/register.tsx, AbovePrompt, the hidden branch (the row "Theo face hidden" and Show): it is drawn before the band layout, so it has no too-small rule. At a body width under about 24 columns the row can be wider than the room. UNVERIFIED (no test mounts a hidden band at 23 columns). Not fixed here; the row is one line and the host cuts it.
2. hooks/register.tsx, PromptHint: the screen width is `e.viewport?.columns ?? 80`. When the host gives no viewport to the hint line, the line is laid out for 80 columns. UNVERIFIED: the types say a render event carries a viewport; plan 380-20 checks on a real screen.
3. hooks/overview.ts, bandLayout: `textWidth` for a screen of 30 columns is 21 cells, so the Theo counts are cut with a mark ("Theo 0 ~"). This follows the rule "cut with a mark, never wrap" (tui-design). It is a PREFERENCE whether a narrow band should drop the thought line instead.
4. tests/overview-pane.test.tsx: the fold line is an estimate from a row counter that wraps at word edges (OV0 proves the counter on made-up drawings). It is not a screen measurement. Plan 380-20 measures.

## Checklist walk

| Area | Finding |
|------|---------|
| Design | One pure module (hooks/overview.ts) holds the layout rules; the pane, the band and the hint line only ask it. No second source of the rule. |
| Logic | Compact reads the viewport, never the pane width (register.tsx, `screenColumnsOf(e.viewport, ...)`). No viewport is not compact (OV10 pins it). Every fact is drawn once: `topRows` and `restRows` are a partition of the room and plugin facts by id. |
| Unions | `cellsFor` and `bandTile` switch over `FaceStyle` with a default branch that calls `assertNever`. `Size`, `Tier`, `HeaderLayout`, `JobForm`, `BandLayout` are unions; no enum, no explicit any (grep on the diff: none). |
| Security and egress | The diff of hooks/advice.ts touches `wordsTexts` only. Nothing about what Theo receives changed; tests/egress.test.ts and tests/test-380-egress.cjs pass (29 passed, 0 failed). |
| Performance | No new atom, hook, tool call, http call or process. OV11 and BD10 show the recorded calls and reads do not grow. Budget tests pass (11 passed). |
| Tests | A failing test came first for every task (RED commits 15c5b8c9c, 8fcb0a9c4, c831209c4, 9eed671f3; outputs in 380-19-evidence). The test names are plain sentences with exact outcomes. panel.test.tsx is byte identical to its state before the plan (git diff on the file: empty) and its 34 tests pass. |
| Changed expectations of earlier tests | P8 of tests/status.test.tsx (new order, owner ruling of gap 1), T22 of tests/tree-pane.test.tsx (40 rows became 41, one blank more), the fixture of tests/tree-pane.test.tsx (records a Theo host whose check is refused, so the NOW fix button stays). Each keeps its strength: an exact figure or an exact order. None is weakened. |
| Naming and style | Names say what they hold (`reachFailed`, `NO_HOST`, `hintLayout`). Comments cite the book line. No em-dash or en-dash in the added lines (grep: 0). No panel string names Larry (grep on added hook lines: none). No ICM, Brain or MCP word in a drawn string (tests/test-380-copy.cjs: 37 passed). |
| Error handling | `reachFailed` fails only a check that ran. A missing host is "not checked" in NOW, the light and /mos-text. A local health file that says error still fails. |
| Documentation | README sections "Truth of the words", "Overview by size" and "Band and hint line" state only what the tests or the facts file proved. Visual claims are marked pending. |
| Dist | `node scripts/build-mos-face.cjs --check`: fresh (source hash d6ebb14e27ce5151). |

## Positive feedback

- The fold test counts rows with a helper that is validated on made-up drawings first (OV0), so a wrong counter cannot hide a layout bug.
- The Theo-not-checked fix goes to the origin (one exported marker, one predicate) and is used in the NOW line, the light and /mos-text, so the three never disagree.
- The band and the hint line share one tested layout table, with a sweep that checks no row is wider than the screen.

## Questions for author

1. Should a hidden band get a too-small rule too (Minor 1)?
2. Should a narrow band drop the thought line before it cuts the Theo counts (Minor 3, PREFERENCE)?

## Verdict

Approve. No critical or major finding is open.
