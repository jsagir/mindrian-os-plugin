---
kind: seed
status: open
severity: medium
created: 2026-07-19
canon_parts: [8, 9, 11]
related: [SEED-034 (room.db never populated -- CRITICAL, still open), SEED-049/SEED-050 (eureka generator + critic), SEED-058 (reasoning-mode fallback), SEED-059 (fallback disclosure), SEED-062 (the engine gap)]
proving_case: "Live /mos:eureka run on 2026-07-19 against mindrian-os-plugin/room (33 md files) on plugin v1.15.3-beta.24. Result: state reasoning_await_mappings, degrade_cause encoder_unavailable, entries_read 10 of 33, pairs_considered 16, graph_nodes 0. Drove the full rubric loop (mappings -> reasoning-prompts -> 16x2x6 faithful answers -> reasoning-score). Outcome: 0 ranked, 0 statements, 16/16 rejected as general_shallow, banking skipped."
source: "navigator ran /mos:eureka test it after reporting the engine 'doesn't really work'. The empirical run overturned three prior claims made in the same session and then the /mos:update check revealed the two real seams were already fixed upstream."
---

# SEED-070: The 2026-07-19 live eureka run, and the stale-bytes lesson

## What the live run actually proved

Four findings, three of which contradict claims made earlier the same day:

| Claim | Live verdict |
|---|---|
| "No orchestrating loop" | **FALSE.** retrieve -> map -> rubric -> score ran end to end. |
| "The critic never really judges" | **FALSE.** Verdict-by-code, two-pass, rejected **16/16** as `general_shallow`. |
| "It dead-ends at 'not enough entries'" | **FALSE.** It named `encoder_unavailable` -- the real cause. SEED-058/059's honest-degrade convention WORKS. |
| "`room.db` is empty" | **TRUE** -- `graph_nodes: 0` -- and the reasoning path routed around it via raw markdown. |

**The engine is not a "confident-noise fountain."** It is the opposite: a guard rejecting
conservatively and banking nothing, correctly, because it was handed nothing bankable.
Nothing was banked; the run self-labelled `banking: "skipped (reasoning mode: Part 9
human-only promotion)"`.

## THE LESSON -- the bytes under test were four releases stale

Immediately after the run, `/mos:update` reported **beta.24 -> beta.28**, and beta.28's
changelog (shipped 2026-07-18, the day before) names the two seams the run had just
surfaced empirically:

- **Seam 2 (RESOLVED):** statements rendering the literal placeholder *"unknown x unknown
  approach to a unknown x unknown cross-domain bridge"* -- i.e. the
  `sourceDomainTag: 'unknown'` / `differential: {}` blanking at
  `opportunity-statement.cjs:265`.
- **Seam 3 (RESOLVED):** `Section` container nodes admitted as pairing candidates, so
  content ranked against its own containing section. **1,575 degenerate pairs (9.8% of the
  candidate set) excluded** on a real room.

Both verified upstream *"on two independently-chosen real rooms … not just fixture-green."*

**The diagnosis was right and the fix had already shipped.** A day of analysis ran against
un-updated bytes.

**Standing rule this earns: check the version before diagnosing.** `/mos:update` is a
two-second call and should precede any "X doesn't work" investigation.

## Two bugs the run surfaced that are NOT covered by beta.28 -- verify post-update

1. **`entries_read: 10` of 33 markdown files.** ~70% of the room never reached pairing.
   Unexplained. If the same reader feeds other reaches, everything graph-adjacent may be
   running on a third of the room. **Re-run on beta.28 and check whether this number
   changes** before filing it as a bug.
2. **`pairs_mode: "graph"` while `graph_nodes: 0`.** Provenance claims a graph substrate
   while reporting zero nodes; `honest_nouns` correctly says `(none: raw-markdown
   substrate)`. The two fields disagree and the label is the wrong one. A reader trusting
   `pairs_mode` would believe the graph was used. Small, but it is a disclosure defect in
   a subsystem whose whole contract is honest disclosure (SEED-059).

## The corpus finding, which no version fixes

`room/` is 33 files about ONE subject -- MindrianOS's own product evolution and decisions.
All 16 candidate pairs drew side A from just **two** documents (W013, W014). The
top-scoring pair (lsa 0.356) was W013 *"Single-File Hub as Default Export Template"* against
D20 *"Single-File Tabbed Hub as Default Export Template"* -- **a wish paired with the
decision that granted it.** One object at two moments, not a cross-domain transfer.

**Eureka hunts cross-domain differentials. A monotopical room has no second domain to
transfer from.** Not too few entries -- too few *worlds*. Upstream's own proving rooms
produced 1,575 candidate pairs; this room produced 16.

**Corollary for testing:** never evaluate eureka on a single-project room. Use a room with
genuinely distinct material, as upstream did.

## Superseded

An earlier draft of SEED-070 proposed Agno pipeline agents as **hosted critics** with
abstracted interfaces, and named calibration as the thing sold. It was deleted unshipped.
Reasons: (a) the diagnostic pass established `eureka-portfolio-report.cjs` already
orchestrates correctly in-process, so there is no missing loop for an external agent to
supply; (b) Stage B needs raw content, which Canon Part 8 pins local, so the honest form is
a **local** LLM judge wired into `resolveCriticVerdicts`, not a remote one; (c) its
proving_case cited `eureka_critic` as a working precedent while the production path runs
Stage A only. The commercial argument may still hold -- see SEED-069 -- but it cannot rest
on this subsystem as its proof.
