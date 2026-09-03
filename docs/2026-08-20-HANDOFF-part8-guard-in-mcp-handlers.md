# 2026-08-20 HANDOFF: Part 8 enforcement locus, host-independent

> **Status: QUEUED. Do NOT start this yet.**
> **Gate:** runs AFTER the `complete-system-loop` milestone Phase B lands (`.planning/2026-08-20-BRIEF-complete-system-loop.md`, section 7).
> **Why queued:** Phase B moves Brain composition server-side into `mindrian-os` tool handlers and reshapes `brain-client.cjs`. Planning this against today's tree would plan against a tree that is about to change.
> **Branch:** `fix/part8-guard-in-mcp-handlers` off `main` @ `f566310c` (v2.0.0-beta.8). Doc only, no code.
> **Origin:** authored from a Windows session that could not honor the WORKSPACE GUARD. This tracked file is the carrier, per CLAUDE.md.
> **CORRECTED 2026-09-02 (Phase 257):** a dated correction sits at the end of this file. H3 as stated below (sections 1, 2, 3) is disproven for `mindrian-brain`; the belt already covers it. This handoff is corrected, not retired -- its conventions (section 5) still bind.

---

## 1. The job in one line

Canon Part 8 enforcement currently lives partly in a Claude-Code-only `PreToolUse` hook. Move the remaining enforcement into code, so the boundary holds on every host and inside every call path.

## 2. Read this before planning: it is THREE holes, not one

The `complete-system-loop` brief already found one of these. Phase 239-05 already closed another, narrowly. The third is unfiled and is the reason this handoff exists. They share a root cause: **enforcement locus, not enforcement logic.** `classify()` is correct and shipped. The question is only where it is called from.

| # | Hole | Who owns it | State |
|---|---|---|---|
| **H1** | A Brain call made inside a `mindrian-os`-named tool handler is invisible to the hook's `mcp__*brain*` matcher | `complete-system-loop` Phase B | Named in the brief, section 3 point (3). Not yet fixed. Phase B commits to fixing it. |
| **H2** | `brain-client.cjs` functions interpolating caller-supplied values into Cypher without classifying the RAW value first | Phase 239-05 | **Shipped, but narrow.** Covers `hatAwareRecommend()` and `suggestValidationSteps()` only, plus a `query()` backstop its own comment labels as insufficient alone. |
| **H3** | A **direct model-issued** `mcp__...mindrian-brain__brain_ask / brain_query / brain_search / brain_write` bypasses `brain-client.cjs` entirely. Guarded ONLY by the hook, which does not fire on hosts without MCP-scoped tool hooks. | **Nobody. This handoff.** | Open. Unfiled before this doc. |

**The trap to avoid:** Phase B ships H1's fix and cites 239-05, and it becomes easy to record "Part 8 enforcement is now in code" and move on. That would be true for H1 and H2 and false for H3. H3's path never touches `brain-client.cjs`, so no belt inside `brain-client.cjs` can ever cover it.

## 3. Why H3 is real (host evidence, verified 2026-08-20)

- **Codex CLI** has hooks behind `[features].hooks = true` in `~/.codex/config.toml` (`codex_hooks` is the deprecated alias; engine is `Stage::UnderDevelopment`). Events: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PermissionRequest, PreCompact, PostCompact, SubagentStart, SubagentStop, Stop.
- **Codex fires PreToolUse / PostToolUse for Bash tool events ONLY.** No file-write events. No MCP tool events. Its PreToolUse can only DENY, never modify input.
- `hooks/hooks.json` registers both Part 8 hooks against MCP-tool matchers (`mcp__(?:plugin_[a-z0-9_-]+_)?(?:mindrian-brain\|pws-brain-mcp)__.*`). On Codex, and on any host without MCP-scoped tool hooks, **neither fires, and nothing announces that.**
- **ChatGPT** custom MCP connectors (Settings -> Apps -> Advanced -> Developer mode, Plus/Pro/Business/Enterprise, no Free) have no hook surface at all and require a remote endpoint.
- **Agent Plugins 1.0.0** shipped 2026-08-06 (Amazon, Cursor, Microsoft, OpenAI, Vercel; Google joining). `plugin.json` + optional `skills/` + optional `mcp.json`, vendor extensions under reverse-DNS namespaces. Anthropic is not a maintainer. This is why "another host" stops being hypothetical.

This is not contingent on any port shipping. Phase 234 **D-04** already ruled: *"Enforce governance SERVER-SIDE, in MCP tool handlers, not via client hooks."* H3 is the part of D-04 that is decided but not yet true in code.

## 4. What you must RE-VERIFY before planning (do not trust the numbers below)

Phase B will move this ground. Every factual claim here is written as a command that regenerates it, deliberately, instead of a frozen line number. Run these first; if an answer differs from the expectation, the plan changes, and that is the point.

```bash
cd ~/dev/MindrianOS-Plugin

# 4.1 Where is the guard wired NOW? (was: 9 lib call sites, 0 MCP handlers)
git grep -n "part8-egress-guard" -- lib bin mcp-server-brain | grep -v test

# 4.2 Is H3 still open? Expect ZERO hits. Any hit means someone closed it.
git grep -n "part8-egress-guard" -- bin/mindrian-brain-mcp-client.cjs

# 4.3 Did Phase B put Brain calls inside mindrian-os handlers? (H1 surface)
git grep -n "brain-client" -- lib/mcp bin/mindrian-mcp-server.cjs

# 4.4 Did the hook matchers change?
python3 -c "import json;h=json.load(open('hooks/hooks.json'));print(json.dumps(h,indent=1))" | grep -A3 -i "brain"

# 4.5 Is the fail-CLOSED precedent still the in-code posture?
git grep -n "fail-closed\|failClosed" -- lib/core/brain-client.cjs lib/core/bono/persona-research.cjs

# 4.6 What did Phase B actually claim about Part 8? Read its summaries.
ls .planning/phases/ | tail -20
git log --oneline main..HEAD -- lib/core/brain-client.cjs lib/mcp
```

## 5. What was LEARNED that this plan must inherit

These are shipped conventions, discovered by reading 239-05's summary and the code. Reusing them is Canon Part 7. Inventing alternatives will fail review.

1. **Fail-CLOSED is the in-code posture. Fail-OPEN is the hook posture.** They differ deliberately. `scripts/part8-egress-guard-hook.cjs` fails open because a false block from a safety hook is worse than a false allow. 239-05's in-code guard is **fail-closed and disclosed**. H3 sits on the egress path in code, so it inherits **fail-closed**. This is now a decided question, not an open one, but state the reasoning in the summary rather than asserting it.
2. **Classify the RAW value, before sanitize, before interpolation.** Clone the control flow at `lib/core/bono/persona-research.cjs` (approx lines 208-233), which 239-05 itself cloned. Two measured failure modes make this non-negotiable: template laundering via the word "Framework", and the sanitizer stripping `@` and thereby disarming the PII pattern. Classifying the assembled string is provably insufficient.
3. **Disclosure idiom:** `_logEventBestEffort(options.db, ...)`, scalars only, silent no-op when no db handle is supplied. Do not open `room.db` directly.
4. **Substrate trap.** `lib/core/brain-client.cjs` is NOT on `scripts/check-substrate.cjs`'s `ALLOWED_DIRECT_IMPORT` allow-list, and `scripts/hooks/pre-commit` runs `check-substrate.cjs --diff`. Adding a direct db opener inside it trips the pre-commit guard. Check the same constraint applies to `bin/mindrian-brain-mcp-client.cjs` before designing its disclosure path.
5. **Test infrastructure already exists. Reuse it.** `tests/helpers/brain-capture-server.cjs` (SSE-shaped Brain capture server), `tests/run-all-239.sh` (SKIP-safe aggregator), and `tests/test-239-query-egress-canary.cjs` (a 7-leg mutation-tested egress proof) are the working pattern for proving an egress guard actually blocks. Model H3's proof on the canary test, not on a fresh harness.
6. **Locked-invariant test precedent:** `lib/mcp/no-instructions.test.cjs`. H3's regression lock should follow that shape.
7. **Every schema-touching or Brain-touching PR needs Canon Custodian review.** Part 8's own PR gate covers `mcp-server-brain/`, `lib/core/brain-*`, and any MCP tool that queries the Brain. This work touches all three.

## 6. Adjacent open item, do not silently absorb

**D-239-05-01** (`.planning/phases/239-brain-access-surface/deferred-items.md`, filed 2026-07-30, OPEN): should `hatAwareRecommend` / `suggestValidationSteps` send user domain text to a methodology graph **at all**, or should the Brain-bound payload be a generic methodology HANDLE derived from the domain?

That is a **payload-design** question. H3 is an **enforcement-locus** question. They are different, and H3 does not resolve it. But note the interaction, because it decides how often the guard even has to fire: 239-05 measured that a benign domain like `'general'` classifies `ambiguous` and is now skipped, so these features degrade to "no Brain enrichment" far more often than before. If a future phase adopts option (b), the handle-shaped payload, the allow rate rises and the guard inspects far less user prose. Flag this in the plan; do not decide it inside H3.

## 7. Paste-ready brief for the NEXT `/gsd:quick` (only after Phase B lands)

```
Close H3 from docs/2026-08-20-HANDOFF-part8-guard-in-mcp-handlers.md: Canon Part 8 enforcement
for DIRECT model-issued Brain MCP tool calls, which bypass lib/core/brain-client.cjs entirely
and are guarded only by a Claude-Code-only PreToolUse hook.

FIRST: run every command in section 4 of that handoff and report what changed since it was
written. Phase B reshaped this ground. Plan against what you find, not against the handoff.

SCOPE:
1. bin/mindrian-brain-mcp-client.cjs - call classify() on the raw caller value inside each Brain
   tool handler (brain_ask, brain_query, brain_search, brain_write) BEFORE any network egress.
   Fail CLOSED and disclose, per section 5.1. Clone the control flow from
   lib/core/bono/persona-research.cjs approx 208-233, the same one 239-05 cloned. Do not invent
   a second convention.
2. Decide and implement whether mcp-server-brain/ also needs the guard. It is on the FAR side of
   the network boundary and Part 8 says the Brain must never RECEIVE user content, so a check
   there is a genuine last line of defence. It deploys standalone (own package.json,
   render.yaml) and cannot require the local lib/ tree, so either vendor the pure classifier or
   keep it local-only and document the call explicitly.
3. Reconcile with whatever Phase B shipped for H1. If Phase B put Brain calls inside
   mindrian-os-named handlers, those handlers need the same treatment. State plainly which of
   H1/H2/H3 each surface now covers, so no future reader concludes Part 8 is closed when one
   leg is still open.
4. Keep the hooks in hooks.json. They become defence-in-depth, not the only belt. Do not delete.
5. Add a locked-invariant test (shape: lib/mcp/no-instructions.test.cjs) asserting every Brain
   MCP tool handler routes through the guard. Model the egress PROOF on
   tests/test-239-query-egress-canary.cjs and reuse tests/helpers/brain-capture-server.cjs.

CONSTRAINTS:
- Do not change what classify() does. It is shipped and consumed across lib/.
- Watch the substrate trap, section 5.4. Run scripts/check-substrate.cjs --diff before commit.
- D-10: do not gate any /mos: methodology run behind a paid check.
- Do NOT resolve D-239-05-01. Flag the interaction, leave the decision.
- Tri-Polar: state the effect on CLI, Desktop and Cowork.
- Canon Custodian review is required (Part 8 PR gate).
- No em-dashes. Hyphens only.
- Run tests/run-all-239.sh, tests/run-all-234.sh if present, and
  node scripts/doctor.cjs --acceptance. Report honestly, including failures.
- Atomic commits.
```

## 8. What "future-ready" means for this doc specifically

Three deliberate choices so this survives the milestone that is about to run:

- **Facts are commands, not constants.** Section 4 regenerates every claim. A line number written down today is a lie by next week; a `git grep` is not.
- **The finding is framed by hole, not by file.** H1/H2/H3 stay meaningful even after Phase B moves the code, because they describe call paths, not locations.
- **The dependency is stated as a gate with an exit condition,** not as a date. This runs when Phase B lands and section 4 has been re-run, whenever that is.

If `complete-system-loop` absorbs H3 into Phase B directly, that is a **better** outcome than running this separately. In that case: delete the queue, and make sure Phase B's summary states explicitly which of H1/H2/H3 it closed, so the record is not ambiguous.

## 9. Adjacent findings from the same session, not in scope

- **ChatGPT Tier-0 connector (navigator-selected).** Record honestly that it reopens **D-07**, which chose licensed-server open-core OVER Brain-as-a-service on 2026-07-18. Reopening it deliberately is fine; reopening it silently is drift. Good news: `mcp-server-brain/server.cjs` is already Express + `StreamableHTTPServerTransport`, stateless (`sessionIdGenerator: undefined`), `POST /mcp`, Bearer auth against Supabase `brain_api_keys`, deployed by `render.yaml`. That is most of what a ChatGPT custom connector needs. Real gaps: confirm ChatGPT accepts a static Bearer key rather than requiring OAuth; Render `plan: free` cold-starts will read as a broken app; and with no skills channel on ChatGPT, tool descriptions become the ONLY carrier for Larry's voice, which makes **D-03** load-bearing rather than advisory.
- **Agent Plugins 1.0.0 packaging.** Worth its own phase. The 234 host survey predates the standard entirely and weighted Zed 106 mentions against Codex 7 and OpenAI 3. Codex is now the closest non-Anthropic host to full parity: skills, subagents, stdio MCP, and hooks.
- **D-04 partial staleness.** D-04 said client hooks are not portable enough to carry governance. Still true for MCP-scoped hooks, which is exactly why H3 exists. Now partially stale for Codex generally, which does have SessionStart, UserPromptSubmit, Stop, PreCompact, PostCompact and SubagentStop.

## 10. Sources

- Agent Plugins spec: https://github.com/agentplugins/agent-plugins-spec and https://agent-plugins.org/
- Vercel announcement: https://vercel.com/blog/introducing-agent-plugins
- Codex customization: https://learn.chatgpt.com/docs/customization/overview
- Codex hooks: https://deepwiki.com/openai/codex/3.11-hooks-system and https://agenticcontrolplane.com/blog/codex-cli-hooks-reference
- ChatGPT developer mode and MCP: https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt
- In-repo: `.planning/2026-08-20-BRIEF-complete-system-loop.md` section 3 and 7; `.planning/phases/239-brain-access-surface/239-05-SUMMARY.md`; `.planning/phases/239-brain-access-surface/deferred-items.md`

## CORRECTION 2026-09-02 (Phase 257): H3 as written is false

Everything above this heading is left exactly as originally written. Nothing is deleted or
softened. This block records what Phase 257's research (`257-RESEARCH.md`) measured live on
2026-09-02, against this handoff's own re-verification protocol in section 4.

**What was claimed.** Section 2's table, verbatim: "H3 | A **direct model-issued**
`mcp__...mindrian-brain__brain_ask / brain_query / brain_search / brain_write` bypasses
`brain-client.cjs` entirely. Guarded ONLY by the hook, which does not fire on hosts without
MCP-scoped tool hooks. | Nobody. This handoff. | Open. Unfiled before this doc." Section 3
restated the same claim as host evidence for why H3 is real.

**What is true.** `bin/mindrian-brain-mcp-client.cjs` is a pure stdio transport wrapper that
requires `lib/core/brain-client.cjs` at line 62. All four Brain handlers (`brain_ask`,
`brain_query`, `brain_search`, `brain_write`) delegate through `callTool`, which has carried
the fail-closed `part8-egress-guard.classify()` belt since commit `ca32b612`. The claim that
this traffic "bypasses `brain-client.cjs` entirely" is false and has been false since that
commit landed.

**The commit-order proof.** `ca32b612` at 2026-08-19 09:26:51 +0300 versus this handoff's own
base commit `f566310c` at 2026-08-19 11:55:23 +0300. `git merge-base --is-ancestor ca32b612
f566310c` returns true. The belt was already in the tree this handoff branched from, two and a
half hours before the branch point. The claim was false at the moment it was written, not
merely stale by the time it was read.

**The live wire proof.** A synthetic canary (`CANARY7F3A2B dana@acme.io`) driven through all
four Brain wrappers against `tests/helpers/brain-capture-server.cjs` produced four blocks and
zero captured bytes:

| Wrapper (the shim's exact call) | Return value | Bytes captured on wire | Canary on wire |
|---|---|---|---|
| `brainClient.ask(canary)` | `{"error":"egress_blocked","tool":"brain_ask","egress_class":"content_set"}` | `[]` | false |
| `brainClient.smartSearch(canary)` | `{"error":"egress_blocked","tool":"brain_search","egress_class":"content_set"}` | `[]` | false |
| `brainClient.query(cypher-with-canary)` | `null` | `[]` | false |
| `brainClient.write(cypher-with-canary)` | `{"error":"egress_blocked","tool":"brain_write","egress_class":"content_set"}` | `[]` | false |

**The root cause, named.** Pitfall 2 (`257-RESEARCH.md`): `git grep part8-egress-guard --
bin/` returns zero, because the belt lives in `lib/core/brain-client.cjs`, not in `bin/`. This
handoff read that absence as absence of coverage. A filename grep cannot follow a delegation --
`bin/mindrian-brain-mcp-client.cjs` calls `brainClient.ask()` / `.query()` / `.smartSearch()` /
`.write()`, and those functions call `callTool()`, where the belt actually sits. The same error
produced the false parenthetical corrected in `lib/mcp/brain-composition-census.cjs` (Phase 257
Plan 03, Task 1 of this same plan): "that traffic never touches brain-client.cjs at all."

**What this handoff got RIGHT, and this phase inherits unchanged.** Section 5's conventions
still bind: fail-CLOSED in code versus fail-OPEN in the hook; classify the raw value before
sanitize and before interpolation, per `lib/core/bono/persona-research.cjs` approx lines
208-233; the `check-substrate.cjs` `ALLOWED_DIRECT_IMPORT` trap; the egress-proof and
regression-lock test shapes (`tests/test-239-query-egress-canary.cjs`,
`lib/mcp/no-instructions.test.cjs`). Section 4's re-verification discipline is what caught this
error -- running the commands instead of trusting the frozen prose is exactly what worked.
Section 6's instruction not to silently absorb D-239-05-01 also still stands; Phase 257 does
not resolve it either.

**What is actually open, and where it is ruled on.** `pws-brain-mcp`, registered as direct
HTTPS with zero local plugin code anywhere in the path -- Desktop's and Cowork's path by
design. See `docs/257-NOTE-part8-enforcement-locus-rulings.md` (Phase 257 Plan 04) for the
ruling on that surface; it is not restated here.

**Status.** This handoff is CORRECTED, not retired. Its conventions still bind. Its central
claim about `mindrian-brain` does not.
