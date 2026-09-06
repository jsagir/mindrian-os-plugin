# Note: Theo Desktop Connector Key (Phase 339)

**Phase:** 339-brain-to-theo-cutover-release-flip-brain-client-default-orig
**Date:** 2026-09-03
**Status:** RECIPROCAL RECORD. Theo's `README.md` at commit `11d6f82` already prescribes
`mindrian-brain` as the Claude Desktop and Cowork connector key, already drops the
`Authorization` header, and already cites this exact file by path. This document is the
plugin-side half of a decision Session T has already shipped. It is not a proposal.
Section 2's residual risk is now CLOSED IN CODE by quick task 260906-gr1; see Section 8.

This document does NOT amend `docs/MINDRIAN-CANON.md`, does NOT widen `BRAIN_TOOL_MATCHER`,
and does NOT change `hooks/hooks.json`.

## 1. The record, up front

Use `mindrian-brain` as the Claude Desktop and Cowork connector key. Point it at
`https://theo-mcp.onrender.com/mcp`, WITH the `/mcp` path. Send no `Authorization` header.

The asymmetry deserves its own sentence: a direct connector hits the MCP endpoint itself, so
it needs the `/mcp` suffix, while `lib/core/brain-client.cjs` line 24 takes the BARE origin,
because the client code appends `/mcp` and `/register` itself. Getting that backwards, in
either direction, produces `/mcp/mcp`, which 404s, and the client renders that 404 as "Brain
unreachable" rather than as a configuration error. A person copying the client's bare-origin
value into a Desktop connector field, or copying a connector's `/mcp` URL into
`MINDRIAN_BRAIN_URL`, hits this exact trap.

## 2. Why the key and not the host

`BRAIN_TOOL_MATCHER` (`lib/core/brain-response-sanitize.cjs:61`) is the exact string:

```
mcp__(?:plugin_[a-z0-9_-]+_)?(?:mindrian-brain|pws-brain-mcp)__.*
```

It is byte-mirrored at `hooks/hooks.json:239` and `hooks/hooks.json:341`, and parity across
all three copies is enforced by `tests/test-brain-response-sanitize.cjs`. A connector
registered under a different key, for example `theo`, produces MCP tool names shaped
`mcp__theo__*`, which match neither the matcher above nor either hooks.json copy of it.

The consequence is concrete, not theoretical: `scripts/part8-egress-guard-hook.cjs:152` reads
`if (!sanitizer.isBrainTool(toolName)) return allow();`, an UNCONDITIONAL allow when the tool
name does not match. A `theo`-keyed connector's calls run outside the Canon Part 8 egress
guard AND outside the response sanitizer. Stated plainly: no test catches this, because no
test can see a connector a user registered by hand. That is the residual risk this note
records rather than hides.

## 3. The two paths that already exist, and the one that does not

`mindrian-brain` and `pws-brain-mcp` are both recognized by the matcher today, verbatim from
the alternation above. `theo` is not, and is not meant to be. Giving the current alternation
here, rather than paraphrasing it, lets the reader see this is a statement about a known list,
not a new claim about one.

## 4. Why the plugin is not widening the matcher

A third alternation token would legitimize a connector key whose only purpose is standalone
Theo use with no MindrianOS plugin installed, and it would turn the guard's own vocabulary
into a moving target that every future backend feels entitled to add to. The fix belongs where
the instruction lives, which is Theo's own README, and Theo has already made that fix at
commit `11d6f82`. Widening the matcher here would duplicate a decision Theo already owns and
already shipped, and it would do so by loosening a security boundary rather than by pointing a
reader at the existing one.

## 5. The other thing Session T must be told verbatim

The D-06 coverage-ruling heading contract, quoted exactly, is the one thing Session T must be
told alongside the connector-key record above: the gate in this repo reads the subsection
headed exactly `### Coverage re-measurement, 2026-09-03, and the ruling on it`, inside `## 1.
Authorization evidence`, scoped by HEADING and never by line number. It requires eleven
literal `grep -F` matches inside that subsection, including the ruling sentence:

```
Coverage does NOT block Task 2, the flip
```

Amending that heading, moving the subsection to a different place in the file, or changing
that sentence's wording will make the gate report "coverage held" and stop the flip release
before `release.sh` runs. That is a successful gate outcome, not a stall, and it is worth
Session T knowing in advance so an edit made for unrelated reasons does not accidentally trip
it.

## 6. Two dispositions this phase made, so a Theo reader does not have to rediscover them

The census artifacts, `data/brain-census.generated.json` and
`docs/BRAIN-GRAPH-CENSUS.generated.md`, are deliberately left describing the incumbent
Brain's graph as of this cutover. A re-census against Theo is registered as a deferred
follow-up, not an oversight this note is silently accepting.

The plugin's `brain_write` and `ingest_framework` paths meet Theo's `WRITE_PATH_DISABLED`.
That is a named follow-up phase, reviewed and re-routed separately, and it is explicitly not
part of this cutover.

## 7. The three Theo-side hashes on this seam

For completeness, so the record names every commit a future reader would otherwise have to
hunt for separately:

- `81dfac8`: the coverage ruling (the subsection named in Section 5 above).
- `221df3e`: the close-out staging.
- `11d6f82`: the README change that already prescribes `mindrian-brain`, already drops the
  `Authorization` header, and already cites this file by path.

## 8. SUPERSEDED, 2026-09-06: the Section 2 residual risk is closed in code

SUPERSEDED. Quick task 260906-gr1 closes the residual risk this note recorded in Section 2,
and this section states plainly what changed, what did not, and what a Theo-side reader needs
to know.

**(a) The claim that no longer holds.** Section 2 stated: "`scripts/part8-egress-guard-hook.cjs:152`
reads `if (!sanitizer.isBrainTool(toolName)) return allow();`, an UNCONDITIONAL allow when the
tool name does not match." That sentence described the live behavior as of Phase 339 and it is
no longer true. The hook now reads `if (!sanitizer.isBrainShapedTool(toolName)) return allow();`,
and `isBrainShapedTool` recognizes any connector key whose bare tool name has the shape
`brain_<verb>` -- so a `theo`-keyed call such as `mcp__theo__brain_ask` reaches `classify()`
instead of taking the unconditional allow. The same inversion applies to the PostToolUse
sanitizer in `scripts/brain-response-sanitize-hook.cjs`. The test that now proves this inversion
is `tests/test-260906-gr1-brain-shaped-tool-gate.cjs` (Group 1, "the bypass proof"), together
with the retargeted foreign-name legs in `tests/part8-egress-guard-hook.test.cjs` and
`tests/test-239-pii-sanitizer-liveness.cjs`.

**(b) What did not move.** Section 4's specific rejection of a THIRD TRUSTED ALTERNATION TOKEN
(adding `theo` as a name the guard TRUSTS) still stands and was not reversed. `isBrainTool`'s
trusted-key list -- `mindrian-brain` and `pws-brain-mcp` -- is byte-unchanged, and `theo` is
still not in it; no future backend gets to add itself to that trusted vocabulary by fiat, and
the guard's trust vocabulary is still not a moving target. What DID change is a different thing
Section 4 never addressed: the HARNESS MATCHER's SCRUTINY scope, meaning which calls even reach
inspection at all. That scope was widened by a structural `brain_<verb>` rule (any connector key,
one shared suffix), not by adding a named trusted key. Section 4 is a statement about trust; this
closure is a statement about scrutiny; the two are different questions and neither contradicts
the other.

**(c) The two-predicates distinction, for a Theo-side reader.** `isBrainTool` answers "is this
THE trusted Brain connector?" and `isBrainShapedTool` answers "might this be carrying
methodology traffic to a Brain backend, so Part 8 must inspect it?" As of this closure, `theo`
gained SCRUTINY, not TRUST: a `theo`-keyed call is now inspected and can be blocked or gated by
Canon Part 8, exactly like a `mindrian-brain`-keyed call, but it still is not treated as the
trusted Brain door for any purpose that depends on trust rather than inspection.

**(d) `mindrian-brain` remains the prescribed connector key.** Theo's README at commit `11d6f82`
needs no change: this closure protects users who do not read that instruction (or a future
backend that ships its own preferred key), it does not replace the instruction. Registering
under `mindrian-brain` is still the correct, documented path; the code-level fix in Section 8
is a backstop for the case where that path is not followed, not a substitute for it.
