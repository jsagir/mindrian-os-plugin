---
status: investigating
kind: rca
trigger: "card-fire-relevance-check-gap"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: n/a
canon_parts: [11, 12]
created: 2026-07-17T00:00:00Z
updated: 2026-07-17T00:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** dev workspace `/home/jsagi/dev/MindrianOS-Plugin` @ dev HEAD, 2026-07-17. `scripts/check-card-fire.cjs` grep-verified directly this session: the PRIMARY detection path (`reached-registry-gate-no-card`) keys off `data/render-coverage-registry.json` gate-reaching entries actually invoked this turn; the BACKSTOP path (`ascii-box-backstop-no-card`) is a separate, broader output-text heuristic that fires "even for an OFF-registry surface" per the script's own doc comment (line ~44). These are two independent detection paths in the same script, not one.
- **WIRE claims probe against:** n/a, local Stop hook only, no Brain calls.
- **Date of audit:** 2026-07-17.
- **Re-verification rule:** this session's own live turns are the 3rd confirmed instance of the backstop over-firing (instances 1: 2026-07-05, 2: 2026-07-11, both already logged); this filing formalizes that as a `/gsd-debug` session so it can move past "capture only" toward an actual fix decision, which every prior filing has explicitly deferred.

## Current Focus

hypothesis: the `ascii-box-backstop-no-card` path pattern-matches "did this turn end in prose that isn't a Larry-signed acknowledgment" rather than "did this turn actually render a flat ASCII choice-box" (the thing SEED-021 / the backstop's own stated purpose exists to catch). It has no relevance or content check -- it does not verify a box was drawn, only that the turn ended in ordinary running text after a REACH-class system-reminder appeared. Three independent live instances now confirm this: a plain closing question (2026-07-11), a paste-the-rest request with no question at all (2026-07-17, this session), consistent with "pattern-matches broadly" not "detects an actual degrade."
test: read `scripts/check-card-fire.cjs`'s actual `ascii-box-backstop-no-card` branch logic (not yet read line-by-line this session -- the grep above found WHERE it lives and its stated purpose/scope, not its literal predicate) and compare against the three logged instances to confirm what textual signal it is actually keying on.
expecting: the predicate is some form of "turn contains a question mark, a numbered/bulleted list, or ends without a specific acknowledgment marker" -- broad enough that any multi-sentence prose turn following a REACH reminder can trip it. If confirmed, the fix is a genuine content check (was a `■ ... [1] [2] [3]`-shaped block actually rendered) rather than a broader textual proxy.
next_action: read the actual backstop predicate function body, confirm or revise the hypothesis above, then present the fix options already on file (todo below) to the navigator as a real decision, not another capture-only pass.

## Meta

- Repo: `/home/jsagi/dev/MindrianOS-Plugin`
- Plugin version: v1.15.3-beta.27 (dev HEAD)
- Reported by: this session, live, three times (the third against this exact turn sequence)
- Date first observed: 2026-07-05 (instance 1, `reached-registry-gate-no-card` path); 2026-07-11 (instance 2, `ascii-box-backstop-no-card` path, first occurrence); 2026-07-17 (instance 3, same backstop path)
- Related: `.planning/todos/pending/2026-07-05-fix-stop-hook-forcing-irrelevant-decision-gate-cards.md` (the capture-only log of all 3 instances, "do not silently auto-fix -- a human should decide the approach" -- this debug session's job is to bring that decision to the navigator, not make it unilaterally); `.planning/debug/resolved/card-fire-block-surface.md` (RESOLVED -- a DIFFERENT pair of findings in the same script: the raw-slug message-leak, fixed via CR-06, and the binary-yes/no exemption, fixed via `gate-is-simple-binary` -- neither of those fixes touches the backstop's relevance gap, confirmed by this session's own 3rd live instance still firing after both landed); `.planning/debug/intern-qa-silent-degrade-pattern-three-independent-sessions-2026-07-14.md` (the OPPOSITE-direction sibling -- under-firing / silent-skip, not over-firing -- explicitly confirms `check-card-fire.cjs` "is neither complete for its own scope nor does it address the other three failure types at all," i.e. the two directions of this failure class are tracked separately and neither is resolved)

## Problem Statement

`scripts/check-card-fire.cjs`'s `ascii-box-backstop-no-card` path is meant to catch a Larry turn that silently DEGRADED a real Decision Gate into flat ASCII text instead of firing the interactive `AskUserQuestion` card (SEED-021). It instead appears to fire on any turn ending in ordinary prose following a REACH-class system-reminder, whether or not anything resembling a choice-box was ever rendered -- a false positive, not a caught degrade.

## Symptoms

expected: the backstop fires only when a turn's output text contains an actual rendered choice-picture (a `■ ... [1] [2] [3]`-shaped block, numbered options presented as a menu) with no accompanying `AskUserQuestion` tool call.
actual: fired on (1) 2026-07-11, a Brain-ingestion conversation ending in the plain closing question "Want me to check that instead?" -- no box rendered; (2) 2026-07-17 (this session), a turn ending "Now paste the rest -- steps 5 through 9... I'll hold the review until it's all in front of me" -- not even a question, a plain declarative request, no box rendered.
error message: `Stop hook blocking error from command: "node check-card-fire.cjs": rendering your choices as a selectable card` (the CR-06 calmed phrase, confirmed non-slug-leaking; the internal slug `ascii-box-backstop-no-card` is preserved only in the local diagnostic log per CR-07).
timeline: first logged 2026-07-05 (different path, `reached-registry-gate-no-card`); backstop path first logged 2026-07-11; this session adds a 3rd backstop instance, 2026-07-17. No fix attempted on the backstop path across 12 days despite 2 logged prior instances.
reproduction: not a scripted repro yet -- three independent live occurrences. Common shape across the two backstop instances: a REACH-class system-reminder appeared earlier in the turn, and the turn's own final output was ordinary multi-sentence prose (a question in one case, a plain request in the other) with no rendered box and no `AskUserQuestion` call.

## Eliminated

- hypothesis: this is the same bug as `reached-registry-gate-no-card` (instance 1, 2026-07-05).
  evidence: confirmed via direct code read this session -- `reached-registry-gate-no-card` keys off the render-coverage-registry (did a known gate-reaching surface run this turn); `ascii-box-backstop-no-card` is a separate function, explicitly documented as a broader catch-all that fires even for surfaces NOT on that registry. Two independent code paths, same script, same general failure class (fire without a real gate), different trigger logic. Rejected as "same bug"; retained as "same class, different mechanism, needs its own fix."
  timestamp: 2026-07-17T00:00:00Z
- hypothesis: the CR-06/CR-07 fix (message-leak calming, diagnostic log) already addresses this.
  evidence: CR-06/CR-07 only changed WHAT TEXT the user sees when the backstop fires (calm phrase instead of raw slug) and WHERE the slug is logged (local diagnostic file). Neither changes WHEN the backstop fires. This session's 3rd instance fired with the calmed CR-06 phrasing, confirming the leak fix landed but the over-firing itself is untouched.
  timestamp: 2026-07-17T00:00:00Z
