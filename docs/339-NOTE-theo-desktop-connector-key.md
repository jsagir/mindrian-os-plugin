# Note: Theo Desktop Connector Key (Phase 339)

**Phase:** 339-brain-to-theo-cutover-release-flip-brain-client-default-orig
**Date:** 2026-09-03
**Status:** RECIPROCAL RECORD. Theo's `README.md` at commit `11d6f82` already prescribes
`mindrian-brain` as the Claude Desktop and Cowork connector key, already drops the
`Authorization` header, and already cites this exact file by path. This document is the
plugin-side half of a decision Session T has already shipped. It is not a proposal.

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
