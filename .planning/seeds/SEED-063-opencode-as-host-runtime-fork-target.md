---
kind: seed
status: open
severity: high
created: 2026-07-18
canon_parts: [8, 10, 11, 12]
related: [SEED-062 (the engine gap -- this seed is the answer to it), SEED-064 (Grok Build, the runner-up this displaces), SEED-065 (MCP ceiling -- why a harness is needed at all), SEED-067 (subscription passthrough forbidden)]
proving_case: "Primary-source verification 2026-07-18. License swept across all 7,054 tracked paths of anomalyco/opencode: MIT, unmodified template, no open-core carve-out, no CLA, no DCO. Capability claims verified against source at commit b8142c7 (v1.18.3): .claude/skills ingestion at packages/opencode/src/skill/index.ts; turn-end break at packages/opencode/src/session/prompt.ts:1128; the N-option blocking decision card already ships at packages/schema/src/question.ts with three renderers."
source: "navigator direction 2026-07-18: terminal-first, workspace-later; MCP accepted as the process seam so runtime language is not a hard filter. Deep-research pass across ~20 harness candidates plus targeted verification of licence, governance, SQLite portability, and Stop-hook feasibility."
---

# SEED-063: OpenCode as the host runtime -- the fork target

## What's actually open

Fork `anomalyco/opencode` as MindrianOS's host runtime. Rent the engine, build the
cockpit.

**Trigger:** a decision to leave the Claude Code plugin runtime. Until that decision is
taken, do not fork.

## Licence -- verified, and clean in a way nothing else on the board was

- **MIT**, unmodified template ("Copyright (c) 2025 opencode"), zero added clauses.
  Swept all 7,054 tracked paths: four LICENSE files, all MIT; 37 of 40 `package.json`
  declare MIT, 3 have no field and inherit root. **No open-core carve-out.**
- `packages/enterprise/` is a **red herring** -- `"license": "MIT"`, `"private": true`.
  `private` means unpublished to npm, not licence-restricted.
- **NO CLA, NO DCO.** Verified in `CONTRIBUTING.md` and across every `.github/` workflow.
  **This is the structural protection**: without contributor copyright assignment,
  Anomaly cannot unilaterally relicense across ~455 contributors. It is the exact
  difference from Redis / Elastic / HashiCorp / MongoDB, all of which held CLAs first.
- Website ToS is restrictive but **explicitly carves out the OSS**: the repo licence
  *"will exclusively govern"* use of the open-source software. Fork from GitHub, do not
  sign up for the hosted product, ToS does not bind.
- **No de-branding paywall** (contrast AFFiNE and Open WebUI -- see SEED-066).

**Trademark:** `OPENCODE` is a claimed USPTO mark of Anomaly Innovations Inc.
(serial 99379413; pending-vs-registered is UNVERIFIED). Restricts the NAME only.
Rebranding takes the code and drops the name -- exactly the split the law intends.
Scrub `opencode` from user-visible strings, binary name, package names, config paths
(`.opencode/`) and env vars (`OPENCODE_CONFIG_DIR`).

**Governance -- an assumption we held was wrong, in our favour.** The
`sst/opencode` -> `anomalyco/opencode` move was a **GitHub org rename, not a transfer to
a new company**. Org id 66570915 was created 2020-06-07 -- the original SST org. Anomaly
Innovations Inc (Delaware, YC W2021) always owned it; same people throughout. Rename
~2026-01-02, stated reason branding consolidation. LICENSE git history is three commits,
all copyright-string edits. **Type never changed.**

**Health:** ~187K stars, 455 contributors, 15 distinct human authors in the last 30 days,
releases every 1-2 days. Bus factor concentrated at the top but not fatal given MIT +
no CLA -- a community fork is always available.

## What we inherit free

| | |
|---|---|
| Agent loop, tool execution, context management | the thing SEED-062 says we lack |
| `.claude/skills/**/SKILL.md` read natively | `CLAUDE_EXTERNAL_DIR = ".claude"` -- **our 124 skills move as-is** |
| MCP client, stdio + Streamable HTTP + SSE, OAuth | our ~30-tool server drops in |
| Subagents as real child sessions, separate context | matches our 9 subagent definitions conceptually |
| Headless `serve` / `run` / `attach`, OpenAPI 3.1, generated TS SDK | satisfies the milestone-2 embeddability requirement -- **the UI is detachable** |
| **A blocking N-option decision card, already built, three renderers** | see below -- this was the surprise |

## What we build (and should want to)

Everything missing is the **human-interaction surface**. Everything expensive is already
there. The interaction layer is the differentiator and should be owned, not inherited --
Larry's gates rendered by someone else's widget would feel like their product wearing
our name.

1. **Stop hook.** Turn-end is one `break` at `session/prompt.ts:1128`; the predicate is
   `lastUser.id < lastAssistant.id`. The loop is **state-driven** -- each iteration
   re-derives from persisted messages -- so **inserting a synthetic user message makes
   the predicate false and the loop continues.** No control-flow surgery. Prior art to
   copy verbatim: `compaction.ts:454-502`. Hook plumbing is free (`TriggerName` is
   derived from the `Hooks` interface).
   **Rated TRIVIAL-to-MODERATE.**
2. **Wire the existing Question subsystem to the turn boundary.** Do NOT generalise the
   permission prompt -- its three options are frozen in the wire schema
   (`Reply = ["once","always","reject"]`) across four renderers with
   `always`-persists-a-rule semantics. Use `packages/schema/src/question.ts` instead:
   arbitrary N options with `label` + `description`, digit shortcuts 1-9,
   single/multi-select, optional free text, multi-question tabs, and a **blocking** `ask`.
   `ask` takes `tool` as **optional**, so it is directly callable from the loop exit.
   **Rated TRIVIAL.** This is a near-exact match for the AskUserQuestion contract our
   gate ladder already targets (Canon Part 12 / SEED-021).
3. **`.claude/agents` is NOT read** -- Claude-*style* frontmatter, not Claude-*located*.
   Move 9 files.
4. **Persona injection** via `instructions` plus duplication into tool descriptions
   (see SEED-065 for why that duplication is load-bearing).

## Sharp edges recorded

- **Hooks must NOT signal by throwing.** `Plugin.trigger` invokes via `Effect.promise`,
  so a rejection becomes an unrecoverable **defect**, not a typed failure. Signal via the
  mutable `output` object. (An earlier note in this research said "block by throwing" --
  that was wrong.)
- In `tool.execute.before`, mutating `output.args.x` works but **reassigning
  `output.args = {...}` silently does nothing** -- same object reference is passed on.
  Same for `shell.env`'s `output.env`.
- **A Stop hook fires for child/subtask sessions too** (`handleSubtask`, prompt.ts:1145,
  recurses through the same loop) and for programmatic `loop()` callers. **Gate on
  `session.parentID` and agent identity or nested agents deadlock behind decision cards
  no human is watching.** This is the sharpest failure mode.
- Add a **re-entry counter**: `agent.steps` only produces a soft `MAX_STEPS_PROMPT`, not
  a hard stop, so a Stop hook can loop unbounded.
- Question's `Answer` is `Schema.Array(Schema.String)` -- **replies are unvalidated
  free-text labels, not constrained to the offered set**, and it carries no
  authorization semantics. It answers "which direction?", not "may I?". Validate
  server-side if a gate must authorise a material action.
- **Target plugin API v1, not v2.** v2 (`packages/plugin/src/v2/`, ~400 lines) is not a
  superset and has no turn-end event; its own `PLAN.md` calls itself "an implementation
  plan, not documentation for the current API." v1 has no deprecation markers and is
  what every runtime call site uses. Expect to port later.
- **SQLite: see SEED-062's sibling finding.** OpenCode compiles to a **Bun** binary.
  `better-sqlite3` **segfaults under Bun** (raw V8 C++ API, not N-API; issue #4290 open
  since 2023-08-24) -- the top-level `require('better-sqlite3')` in
  `lib/core/lazygraph-ops.cjs` **kills the process on load** and must be removed
  regardless. `node:sqlite` is fully implemented in Bun but only merged to `main`
  2026-07-17, after the latest release (v1.3.14, 2026-05-13). **Fix: dispatch at the
  existing M3 chokepoint** (`docs/architecture/SUBSTRATE-CONTRACT.md`, enforced by
  `scripts/check-substrate.cjs`) on `typeof Bun !== 'undefined'` -- `bun:sqlite` under
  Bun, `node:sqlite` under Node. `.prepare/.all/.get/.run/.exec/.close` and the
  `{changes, lastInsertRowid}` shape are identical; it is a class rename plus a
  `readOnly` -> `readonly` casing flip.

## Mechanical porting tax (applies to any harness)

- `${CLAUDE_PLUGIN_ROOT}` is threaded through all **84 hook entries** in `hooks.json`
  and the 26 commands that shell out. Find-and-replace plus a path-resolution shim.
  A day, not a quarter -- but invisible until everything fails at once on first boot.
- Statusline is Claude-Code-protocol-specific; rewrite as harness-native output.

## Four things to do when promoted

1. Rebrand thoroughly (the trademark is the only real constraint, and it is avoidable).
2. Preserve the MIT notice in an about/licences screen -- our sole obligation.
3. **Run a transitive dependency licence scan.** The real exposure is a stray GPL/AGPL
   among ~200 deps, not OpenCode's own licence.
4. Pin and vendor a commit hash; audit the default config for hosted-Zen endpoints.

## Residual risk

VC-backed, and a free CLI funnelling into a paid model gateway ("opencode Zen") is the
configuration where a board-driven relicense becomes thinkable. Mitigated: MIT is
irrevocable for the commit we fork, and no CLA makes a future relicense legally awkward.
**Watch instead for the softer failure -- the OSS core acquiring hard dependencies on
hosted Zen endpoints.**
