# Phase 274: Bare `scripts/` Invocation Anchoring - Research

**Researched:** 2026-09-01
**Domain:** Plugin-relative path resolution in Claude Code markdown surfaces (commands, skills, agents, pipelines); release-gate promotion
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Release gate promotion**
- **D-01 (navigator ruling, 2026-09-01):** Promote `check-plugin-path-anchoring.cjs
  --include-scripts` from advisory-only to a HARD release gate, matching the exact treatment
  Phase 271-05 already gave the `references/` citation check (wired into `scripts/verify-release`
  gate 10c). Rationale (navigator-confirmed): a bare script invocation failing is a live shell
  error at runtime, which is arguably a WORSE user-facing failure than a citation silently
  degrading a model's read -- it deserves at least as strict a gate, not a softer one.

**Verification depth**
- **D-02 (navigator ruling, 2026-09-01):** Static path-correctness checking for all 34 sites
  (does the resolved path exist, is it anchored against the plugin install root, not `cwd`) PLUS
  an actual runtime smoke-test of a representative sample on the CLI surface -- the one surface a
  test harness can drive directly and automatically. Desktop and Cowork get the same static
  check applied to their invocation sites, but NO automated runtime execution test on those two
  surfaces -- this is a stated, deliberate gap per this repo's own Tri-Polar Design Rule ("a
  feature that only works on one leaves a gap on the other two install targets... treat a skip
  as a deliberate, stated call, not an oversight"), not a silent omission. The plan and its
  VERIFICATION.md must name this gap explicitly rather than imply full three-surface proof.
- Full three-surface runtime proof (CLI + Desktop + Cowork all actually exercised) was
  considered and explicitly rejected for this phase.

### Claude's Discretion

- **Gate strictness mechanics:** no explicit navigator ruling on zero-tolerance-immediate vs. a
  grandfather clause for any site this phase doesn't fully clear. Default to the same posture
  Phase 271-05 already established for the citation gate: zero-tolerance immediate hard-block on
  ANY unanchored site (no grandfathering), since this phase's own goal is to clear all 34 known
  sites before wiring the gate -- there should be nothing left to grandfather if the phase
  actually completes its stated scope. If the planner finds this genuinely can't reach 100%
  coverage in one phase, flag it explicitly rather than silently softening the gate.
- **Exact anchoring mechanism/pattern per site type** (which `__dirname`-equivalent resolution
  primitive to use, whether to reuse Phase 271's citation-anchoring helper or write a parallel
  one for Bash-argument anchoring) -- left to research/planning, not asked of the navigator per
  this repo's own discuss-phase philosophy (technical implementation detail).

### Deferred Ideas (OUT OF SCOPE)

- **`FOLLOWUP-271-R1`** (`/mos:radar` `--fetch`-vs-read-path split) -- already tracked in code
  (`REGISTERED_FOLLOWUPS` in `scripts/check-plugin-path-anchoring.cjs`), explicitly NOT this
  phase's fix scope, owned by the repo navigator per its own prior registration. Do not silently
  sweep it into this phase's fix set.
- **Full three-surface automated runtime proof** (Desktop + Cowork actual execution, not just
  static path-correctness) -- considered under D-02, explicitly deferred as future tooling work
  if the repo ever builds Desktop/Cowork automation harnesses. Not lost, just not this phase.
- Six pending todos cross-referenced and confirmed keyword-collision false positives. None folded.
</user_constraints>

<phase_requirements>
## Phase Requirements

No IDs were pre-registered for this phase. Minted here per the repo convention (Phase 273 used
`CHOKE-01..06`, Phase 272 used `PYPORT-01..07`), to be finalized in the plan frontmatter and
promoted to `.planning/REQUIREMENTS.md` at phase close.

| ID | Description | Research Support |
|----|-------------|------------------|
| ANCHOR-01 | Extend `check-plugin-path-anchoring.cjs`'s script tier so it is scoped by RESOLUTION MECHANISM, not by the `bash\|node` string: add the other invocation verbs present in the tree, classify anchored-vs-bare (the tier has no `anchored` concept today), and add a gateable exit-code mode. | Finding F-1, F-3, F-4; Architecture Pattern 3 |
| ANCHOR-02 | Anchor all 30 command-surface invocation sites with the quoted short form `"${CLAUDE_PLUGIN_ROOT}/scripts/<name>"`. | Finding F-2; Pattern 1; Code Example 1 |
| ANCHOR-03 | Anchor the 3 hand-authored skill sites with the quoted fail-closed long form. | Finding F-2, F-9; Pattern 2; Code Example 2 |
| ANCHOR-04 | Anchor the 1 agent site (`agents/analogy-query-fetcher.md:43`) with the short form. | Finding F-2; Pattern 1 |
| ANCHOR-05 | Regenerate the generated skill mirrors from the fixed commands and prove `build-skill-mirrors.cjs --check` stays green. | Finding F-5 |
| ANCHOR-06 | Give every site this phase deliberately does NOT anchor a reasoned `ALLOWLIST` entry (with `followup` id where residual risk exists), never a silent skip. | Finding F-6, F-7; Pattern 4 |
| ANCHOR-07 | Extend the fixture test suite (`tests/test-271-plugin-path-anchoring.cjs` pattern) with script-tier fixtures and add `tests/run-all-274.sh`. | Finding F-11; Pattern 5 |
| ANCHOR-08 | Add the CLI runtime smoke test with the resolution-failure oracle (D-02's runtime arm). | Finding F-8; Pattern 6; Code Example 3 |
| ANCHOR-09 | Wire the script tier into `scripts/verify-release` as a new hard gate (next free id: **10f**), zero-tolerance, fail-closed, following the 10c wiring shape. | Finding F-12; Pattern 7; Code Example 4 |
| ANCHOR-10 | Write the Tri-Polar stated-gap declaration plus the close-out paper trail (CHANGELOG, `knowledge-base.md`, ROADMAP row, Dev-Research Compositing mirror + room entry). | D-02; Project Constraints |
</phase_requirements>

## Summary

This phase is a **clone of a fix this repo has already performed twice, with the primitive already
proven in production in this same tree**. There is nothing to invent. The anchoring primitive is
not a code helper at all -- it is a **textual environment-variable prefix inside markdown**, in
two forms: the short `${CLAUDE_PLUGIN_ROOT}/` (Claude Code's own runtime-injected env var) for
commands, agents and pipelines, and the fail-closed
`${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?<message>}}/` wrapper for hand-authored skills, which a
foreign Agent-Skills host can load with no plugin root set. Both forms already ship in this repo
for **script invocations specifically**, not only for `references/` citations:
`skills/export/SKILL.md:80` (`bash "${MINDRIAN_OS_ROOT:-...}/scripts/generate-standalone"`),
`skills/memory/SKILL.md:94`, `skills/pipeline/SKILL.md:61`, `commands/status.md:67`. Canon Part 7
is satisfied by copying those lines' shape, not by writing anything new.

The single most important de-risking finding is that **the `/mos:radar` write-redirection
exception class does not apply here**. Phase 271-02 needed an allowlist because it was anchoring a
**data path** that a command WRITES to, so anchoring would have redirected a git-tracked write into
the install cache. This phase anchors an **executable path**. Anchoring an executable changes
nothing about the process's cwd or its write targets, and all 15 distinct scripts behind the 34
sites resolve their own internals from `__dirname`, never from `process.cwd()` (verified:
`build-new-surface.cjs:74` `path.resolve(__dirname, '..')`, `wikilink-file.cjs:70`
`require('../lib/vault/...')`). Anchoring is therefore a **pure improvement at every one of the 34
sites**, with no per-site write-vs-read disposition ruling required.

The live re-measurement confirms the count is still **34** (30 commands / 3 hand-authored skills /
1 agent / 0 pipelines, 1 permission-matcher exclusion), all 15 target scripts exist on disk, and
gate 10c currently **passes** (0 `references/` violations, so Phase 271's CLOSED-PARTIAL blocker
has since cleared and this phase does not inherit a red board). The real work beyond the sweep is
in the instrument: its script tier is a raw match-counter with no anchored classification and no
exit-code path, and its predicate is scoped by the string `bash|node` -- the exact mistake Phase
271's own generalizable lesson warns against, and it already has two live blind spots
(`python3 scripts/render-pdf`) plus one live false positive (a dev-gate mention inside a YAML
comment block).

**Primary recommendation:** Fix the instrument first (mechanism-scoped predicate + `anchored`
classification + a `--check-scripts` exit-code mode), then sweep commands -> regenerate mirrors ->
sweep hand-authored skills and the agent with the fail-closed form, then wire gate **10f** as a
separate fail-closed block alongside 10c (two tiers, two verdicts, two recovery messages), and
prove it with a fixture A/B plus a CLI runtime smoke test whose oracle is the resolution-failure
signature (`Cannot find module` / exit 127), not the script's business outcome.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Resolving "where is the plugin installed" at markdown-invocation time | Claude Code runtime (env var injection) | Shell parameter expansion | `CLAUDE_PLUGIN_ROOT` is injected by the host; markdown cannot compute it. `readlink -f "$0"` is empirically broken here (resolves to `/usr/bin/bash`). |
| Resolving "where is the plugin installed" from Node/CJS code | `lib/core/active-plugin-root.cjs` | env `MINDRIAN_OS_ROOT` | The repo already has ONE resolver for this, with a documented 5-step precedence. Never add a sixth guesser. |
| Fail-closed behaviour when no root is resolvable | Shell `${VAR:?message}` expansion | -- | Bash's own primitive. Refusing loudly beats resolving to `/scripts/...`. |
| Detecting unanchored sites | `scripts/check-plugin-path-anchoring.cjs` (lexical scanner) | -- | Already the pinned measuring instrument. Extend it, never fork it. |
| Enforcing at release time | `scripts/verify-release` gate block | `doctor.cjs --acceptance` (deliberately NOT wired, per 271-05) | 271-05 ruled the release gate alone satisfies the requirement; doctor is higher-traffic shared code with no added proof value. |
| Keeping generated skill mirrors consistent | `scripts/build-skill-mirrors.cjs` | -- | Mirrors are fixed by fixing the command and regenerating, never by hand. |
| Runtime proof | `tests/run-all-274.sh` (CLI only) | Desktop / Cowork = **static-only, stated gap** | D-02. No harness exists for the other two surfaces. |

## Project Constraints (from CLAUDE.md)

| Directive | How this phase must comply |
|-----------|----------------------------|
| **No em-dashes anywhere** | Every new line in markdown, code comments, CHANGELOG, ROADMAP and summaries uses hyphens. Verify with a grep before each commit. |
| **CJS only, no TypeScript** | The instrument extension stays `.cjs`; no build step, no transpile. |
| **Canon Part 7 - Reuse Before Build** | THE central constraint. The primitive already exists in-tree at `skills/export/SKILL.md:80`, `skills/memory/SKILL.md:94`, `commands/status.md:67`. Cite those lines; do not author a new resolution mechanism. Extend the existing scanner; do not write a second one. |
| **Tri-Polar Design Rule (STRONG DEFAULT)** | D-02's Desktop/Cowork runtime gap must be a *stated call* in the plan and VERIFICATION.md, with the reason. |
| **Workspace guard** | All work in `/home/jsagi/dev/MindrianOS-Plugin/`, never `~/.claude/plugins/*`. |
| **Verification suites** | `bash tests/run-all-274.sh`, `scripts/verify-release`, `node scripts/build-skill-mirrors.cjs --check`, `node scripts/build-connector-registry.cjs --check`. |
| **Release lockstep** | Do NOT run `release.sh` without an explicit go-ahead (standing do-not list from the 2026-08-27 handoff). CHANGELOG entry goes under the existing `[Unreleased]` heading; invent no version number. |
| **Dev-Research Compositing** | This is MindrianOS-dev architecture work, so findings file in BOTH `.planning/phases/274-*/` and `rethinking-mindrianos/research/<dated-entry>/` (mirrored to `mindrianOS/research/`), cross-linked. Note the 271-05 precedent: the room write can be blocked by the `write-scope-check` hook if the active room binding is stale. **Do not bypass the hook via Bash heredoc** -- surface it and record honest per-path status, exactly as 271-05 did. |
| **QA/RCA standard** | Any defect surfaced mid-phase goes to `.planning/debug/<slug>.md` per `docs/RCA-TEMPLATE.md`, not an improvised bug report. |
| **GSD workflow enforcement** | No direct repo edits outside a GSD workflow. |

## Standard Stack

No new dependencies. Everything this phase needs is already in the tree.

### Core

| Component | Version / Location | Purpose | Why Standard |
|-----------|-------------------|---------|--------------|
| `${CLAUDE_PLUGIN_ROOT}` | Claude Code runtime env var | Short-form anchor for commands, agents, pipelines | Claude Code's own documented plugin-root variable; already used by `hooks/hooks.json`, `settings.json` statusline, `.mcp.json` server args (validated by `tests/test-127-00-shim-handshake.sh` tests 4 and 6) and ~38 SKILL.md files. `[VERIFIED: in-repo grep + .planning/debug/resolved/intern-w1-rooms-skill-script-path.md Evidence 2026-07-11T00:05:00Z]` |
| `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?<msg>}}` | Bash parameter expansion | Fail-closed long-form anchor for hand-authored skills | Phase 271-04's established form. A foreign Agent-Skills host can load a SKILL.md with no plugin root set; `:?` refuses loudly instead of resolving to `/scripts/...`. `[VERIFIED: scripts/verify-release:344-346 + live grep of 20+ skills]` |
| `lib/core/active-plugin-root.cjs` | in-repo CJS | THE single Node-side resolver for the active install root | Collapses three former guessers into one 5-step precedence chain. Referenced by name inside the long-form's own error message. `[VERIFIED: read in full]` |
| `scripts/check-plugin-path-anchoring.cjs` | in-repo CJS, 621 lines | The measuring instrument; extend it | Phase 271-01's pinned predicate; already exports `scanScriptInvocations`, `runScan`, `ALLOWLIST`, `REGISTERED_FOLLOWUPS`, `validateAllowlist`. `[VERIFIED: read in full]` |
| `scripts/build-skill-mirrors.cjs` | in-repo CJS | Regenerates `skills/<name>/SKILL.md` from `commands/<name>.md` byte-for-byte | The only sanctioned way to fix a mirror. `SKIP_LIST = ['trending-to-absurd']`. `[VERIFIED: read]` |
| Node.js | v22.23.1 (floor >=22.16.0) | Runs the instrument and 14 of the 15 target scripts | Repo floor, `node:sqlite` `timeout` option. `[VERIFIED: node --version]` |
| Bash | 5.2.21 | Runs `scripts/compute-opportunity-state`, `verify-release`, test runners | `[VERIFIED: bash --version]` |
| Python | 3.12.3 | Runs `scripts/render-pdf` (the out-of-current-predicate site) | `[VERIFIED: python3 --version]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `${CLAUDE_PLUGIN_ROOT}` textual prefix | `PLUGIN_ROOT="$(dirname "$(dirname "$(readlink -f "$0")")")"` | **REJECTED, empirically broken.** Claude Code's Bash tool runs a markdown code block as a *shell command string*, not as an executed script file, so `$0` is `/bin/bash` and the computed root is `/usr` -- wrong on every invocation, not an edge case. Already copy-pasted into 3 files before being caught. `[VERIFIED: .planning/debug/resolved/intern-w1-rooms-skill-script-path.md, Eliminated entry 2026-07-11T00:04:00Z, direct Bash-tool test]` |
| Textual prefix in markdown | A new `lib/core/` shell helper that markdown sources | **REJECTED.** Adds a resolution hop that itself needs anchoring (chicken-and-egg), and bash variable state does not persist across separate markdown bash blocks -- the exact failure that broke new-project's Step 6.1. An inherited env var sidesteps both. `[VERIFIED: same RCA, fix rationale]` |
| Extending the existing scanner | A second, script-only scanner | **REJECTED (Canon Part 7).** Two scanners means two predicates drifting apart, which is literally the defect class this phase exists to close. |
| Short form everywhere | Long fail-closed form everywhere | Long form is 150+ chars and makes command bodies unreadable; commands only ever run inside Claude Code, which always injects `CLAUDE_PLUGIN_ROOT`. Keep the 271 split. |

**Installation:** none. Zero external packages.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages from any registry. Every component is
already present in the repository or is a shell/runtime builtin. No `npm install`, `pip install`,
or `cargo add` step appears anywhere in the recommended approach, so the slopcheck gate has no
input and there is nothing to verify against npm / PyPI / crates.io.

**Packages removed due to slopcheck [SLOP] verdict:** none (no packages proposed)
**Packages flagged as suspicious [SUS]:** none (no packages proposed)

## Architecture Patterns

### System Architecture Diagram

```
                    AUTHOR-TIME (a human or Claude writes a markdown surface)
                                        |
                                        v
              commands/*.md   skills/*/SKILL.md   agents/*.md   pipelines/**/*.md
                    |                 |                |               |
                    |  (mirror generator, one way)     |               |
                    +----> build-skill-mirrors.cjs ----+               |
                    |         writes skills/<name>/SKILL.md            |
                    |         for every command except SKIP_LIST       |
                    v                 v                v               v
        +-------------------------------------------------------------------+
        |     scripts/check-plugin-path-anchoring.cjs   (LEXICAL SCANNER)   |
        |                                                                   |
        |   enumerateSurfaces()  -> commands | hand-authored skills |       |
        |                           agents | pipelines                      |
        |          |                                                        |
        |          +--> TIER A: scanLine()  ....... references/ citations   |
        |          |      predicate: backtick | citation-verb | list-number |
        |          |      classify: anchored / allowlisted / VIOLATION      |
        |          |      target tag: OK | DIR | TEMPLATE | MISSING         |
        |          |                                                        |
        |          +--> TIER B: scanScriptInvocations() ... script invokes  |
        |                 predicate: /\b(bash|node)\s+scripts\/.../         |
        |                 exclusion: allowed-tools permission matcher       |
        |                 >>> TODAY: no anchored class, no target tag,      |
        |                 >>> no allowlist, no exit code  <<< THIS PHASE    |
        +-------------------------------------------------------------------+
                    |                                        |
          --check   |                                        |  --check-scripts (NEW)
          exit 0/1  v                                        v  exit 0/1
        +-----------------------+                +------------------------------+
        | verify-release GATE   |                | verify-release GATE 10f (NEW)|
        | 10c (Phase 271-05)    |                | fail-closed, zero-tolerance  |
        | fail-closed           |                | own recovery message         |
        +-----------------------+                +------------------------------+
                    \                                        /
                     \                                      /
                      v                                    v
                     RELEASE DECISION: cut / DO NOT RELEASE


       RUNTIME (what the anchoring actually repairs)
       ---------------------------------------------
       user session, cwd = ~/MindrianRooms/their-room
                       |
        /mos:file-meeting fires -> Claude reads commands/file-meeting.md
                       |
        line 771 says:  node scripts/wikilink-file.cjs ...
                       |
                       v
        Bash tool executes with cwd = the USER'S ROOM
                       |
          +------------+-------------+
          |                          |
      BARE (today)             ANCHORED (this phase)
          |                          |
          v                          v
   Cannot find module          node "${CLAUDE_PLUGIN_ROOT}/scripts/wikilink-file.cjs"
   '.../their-room/                  |
    scripts/wikilink-file.cjs'       v
   MODULE_NOT_FOUND            resolves against the INSTALL DIR;
   (or exit 127 for `bash`)    script's own __dirname requires still work;
   >>> COMMAND DIES <<<        cwd is UNCHANGED so its --room arg still
                               points at the user's room
```

The right-hand runtime path is the whole phase in one picture: **only the interpreter's argument
changes base; cwd and every write target stay exactly where they were.**

### Pattern 1: Short-form anchor (commands, agents, pipelines)

**What:** Prefix the script path with `${CLAUDE_PLUGIN_ROOT}/` and wrap the whole path in double
quotes.
**When to use:** `commands/*.md`, `agents/*.md`, `pipelines/**/*.md` -- surfaces that only ever
execute inside Claude Code, which always injects the variable.
**Why quoted:** install paths can contain spaces (Windows / OneDrive-backed home dirs). The
intern-w1 sweep used the quoted form for all 72 sites; keep it.

```bash
# Source: commands/status.md:67 (already shipping in this repo)
node "${CLAUDE_PLUGIN_ROOT}/scripts/mos-status.cjs" $ARGUMENTS
```

### Pattern 2: Fail-closed long-form anchor (hand-authored skills)

**What:** `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?<explicit message>}}/`
**When to use:** `skills/<name>/SKILL.md` where no `commands/<name>.md` exists (or the name is in
`build-skill-mirrors.cjs`'s `SKIP_LIST`). These are the surfaces a foreign Agent-Skills host can
load with no plugin root set at all.
**Why:** proven empirically this session (see Code Example 3). With both variables unset, the short
form silently resolves to `/scripts/<name>` and dies with a confusing module error; the long form
refuses with `CLAUDE_PLUGIN_ROOT: MindrianOS install root not found.` -- a message that names the
fix.

```bash
# Source: skills/export/SKILL.md:80 (already shipping - a SCRIPT invocation, not a citation)
bash "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/generate-standalone" ./room
```

The message string is byte-identical across every existing use. Copy it verbatim; do not paraphrase.

### Pattern 3: Mechanism-scoped predicate (the instrument extension)

**What:** Widen `SCRIPT_INVOKE_RE` from `bash|node` to the set of invocation verbs actually present
in the tree, and add an `anchored` classification so the report carries an honest denominator.

The current tier is a raw match counter. Once a site is anchored, the regex simply stops matching
it, which means **deleting a line and anchoring a line look identical in the report**. The
citation tier does not have this weakness (it reports `sites / anchored / allowlisted /
violations`); the script tier should be brought to parity.

Recommended predicate shape (bounded quantifiers only, matching T-271-01's no-catastrophic-
backtracking constraint):

```
verb        := bash | sh | node | npx | python | python3
optAnchor   := ("${CLAUDE_PLUGIN_ROOT}/" | "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?...}}/")
site        := verb WS optQuote [optAnchor] ["./"] "scripts/" NAME
classify    := anchored   when optAnchor present AND the whole path is double-quoted
               violation  otherwise, unless allowlisted or inside a permission matcher
```

**Deliberately NOT widened:** a bare backticked `` `scripts/foo.cjs` `` with no verb in front of it
(21+ sites across `commands/`) is *prose about repo layout*, not an instruction the model resolves.
The citation tier already made exactly this call for `agents/framework-runner.md:26`, with the
stated reason "a gate that flags prose gets silenced." Keep the same line.

### Pattern 4: Allowlist-with-registered-followup (existing, reuse as-is)

Every exception carries a non-empty `reason` (enforced by `validateAllowlist()` throwing at module
load), and any exception that defers real residual risk carries a `followup` id that must resolve
in `REGISTERED_FOLLOWUPS` (also enforced at module load). **Never add a bespoke skip list.** If
this phase needs an exception, it goes here with a written reason.

### Pattern 5: Fixture A/B gate proof (271-05's own discipline)

Copy the checker into a tmpdir tree, write one file RED (bare) and one GREEN (identical line,
anchored), prove exit 1 then exit 0 with the prefix as the only variable, delete the fixture tree.
**Never leave a deliberately broken file in the real tree.** `tests/test-271-plugin-path-anchoring.cjs`
already does this with `fs.mkdtempSync` + `scanSurface`/`scanScriptInvocations` imports; extend it
rather than starting a new harness.

### Pattern 6: Resolution-failure oracle (the D-02 runtime smoke test)

The smoke test must **not** assert business outcomes (that would require scaffolding rooms and
would make the test flaky for reasons unrelated to path anchoring). Assert on the *resolution
signature* instead:

| Outcome | Signal | Verdict |
|---------|--------|---------|
| `Cannot find module` / `MODULE_NOT_FOUND` | Node could not find the file | **FAIL** (unanchored) |
| exit 127 / `No such file or directory` | Shell could not find the file | **FAIL** (unanchored) |
| `CLAUDE_PLUGIN_ROOT: ... not found` | long form refused | **PASS for the fail-closed arm** |
| anything else (usage text, arg error, success) | interpreter found and started the file | **PASS** |

Run it from a scratch cwd that is provably not the plugin root, with `CLAUDE_PLUGIN_ROOT` exported
to the repo root -- that is precisely the shape of a real user session.

### Pattern 7: Fail-closed release-gate block (10c's shape)

```bash
echo -e "\n${BOLD}10f. <Gate name>${NC}"
OUT=$(node "$PLUGIN_ROOT/scripts/<script>" --<mode> 2>&1) && CODE=0 || CODE=$?
if [ "$CODE" -ne 0 ]; then
  fail "<one-line user-facing consequence>"
  echo "$OUT" | tail -12
  echo "  <recovery instruction naming the exact fix>"
else
  pass "<what is now true>"
fi
```

Above the block, a comment that answers three questions for a reader in six months: what breaks at
runtime, which RCA/phase this descends from, and why it is fail-closed rather than advisory. 10c's
comment is the model (lines 336-361).

### Anti-Patterns to Avoid

- **Scoping by grep pattern instead of resolution mechanism.** This is pass FOUR at one disease
  class. Passes one, two and three each scoped by string and each left the sibling pattern
  standing. If this phase greps only `bash|node scripts/`, it leaves `python3 scripts/render-pdf`
  behind and a pass five becomes necessary.
- **Hand-editing a generated skill mirror.** The next generator run reverts it. Fix the command,
  regenerate.
- **Relaxing the gate to make the board green.** 271-05 explicitly held this line and left
  `verify-release` red rather than downgrade to WARN. Same posture applies. Gate 10d's own comment
  states the rule: "Wire the gate, do not relax it, and do not turn it on before the work that
  makes it green is done (the 271-05 discipline)."
- **Bypassing the `write-scope-check` hook with a Bash heredoc** to land the compositing room
  entry. 271-05 refused this; the honest record of a blocked path is the correct outcome.
- **Anchoring with the unquoted form.** `node ${CLAUDE_PLUGIN_ROOT}/scripts/x.cjs` word-splits on a
  path containing a space.
- **Adding a second scanner or a bespoke skip list.** Both violate Canon Part 7 and re-create the
  drift this phase closes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Where is the plugin installed?" from markdown | Any `$0`/`readlink`/`pwd`-derived computation | `${CLAUDE_PLUGIN_ROOT}` | Empirically resolves to `/usr` under the Bash tool. Already burned this repo once and propagated to 3 files. |
| "Where is the plugin installed?" from Node | A fresh cache-scan or `sort -V` version pick | `lib/core/active-plugin-root.cjs` | This module exists precisely because three independent guessers produced three failure modes. |
| Failing safely when no root resolves | A custom `if [ -z ... ]; then echo ...; exit 1; fi` preamble | Bash `${VAR:?message}` | One expansion, no preamble, works inside a single-line invocation. |
| Detecting the defect class | A new grep-based lint | Extend `check-plugin-path-anchoring.cjs` | It already handles surface enumeration, mirror exclusion, permission-matcher exclusion, allowlist validation, followup registration, and JSON output. |
| Keeping mirrors consistent | Manual sed over `skills/` | `node scripts/build-skill-mirrors.cjs` (+ `--check`) | Byte-for-byte generation with a verified skip list. |
| Proving a gate fires | Breaking a real file temporarily | tmpdir fixture A/B | 271-05's proven method; leaves no broken file behind. |

**Key insight:** the entire "helper" for this phase is a **string**, already shipping in this repo
in both forms, for this exact token type. The Canon Part 7 answer to "should we build a
path-resolution helper for Bash-argument anchoring" is a flat no -- the runtime already provides
one, the repo already standardized on it, and one prior attempt to build a local substitute is a
documented, resolved RCA.

## Runtime State Inventory

This is a markdown-text refactor with a release-gate wiring change. It writes no data, registers
nothing with the OS, and changes no secret or env-var **name** (it *consumes* two existing env vars
without redefining them). Each category is answered explicitly rather than left blank.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** No database, SQLite table, Mem0 record, Chroma collection, or `room.db` row contains any of the 34 invocation strings. Verified: the strings live only in tracked `.md` files under `commands/`, `skills/`, `agents/`. | none |
| Live service config | **None.** No n8n workflow, Datadog dashboard, Tailscale ACL or Cloudflare tunnel references these invocation lines. The only "live" consumer is Claude Code reading the markdown at invocation time, which reads from the install cache, refreshed by a normal plugin update. | none beyond the standard release/update path |
| OS-registered state | **None.** No Task Scheduler entry, pm2 process name, launchd plist or systemd unit embeds a `scripts/<name>` invocation from these files. | none |
| Secrets / env vars | **Two consumed, zero renamed:** `CLAUDE_PLUGIN_ROOT` (injected by Claude Code) and `MINDRIAN_OS_ROOT` (optional override, resolved by `lib/core/active-plugin-root.cjs`). This phase adds *readers* of both; it does not define, rename, or require a new one. No SOPS key, `.env` entry or CI variable changes. | none |
| Build artifacts / installed packages | **One class, and it is generated in-repo, not installed:** `skills/<name>/SKILL.md` mirrors. Editing `commands/*.md` without running `build-skill-mirrors.cjs` leaves 30 stale mirror lines that `--check` will catch. Separately, **every user's `~/.claude/plugins/cache/.../mos/<version>/` copy stays stale until they update** -- consistent with the standing "a `main` commit is not live until released AND picked up" rule. | regenerate mirrors in-phase; user pickup is the normal release path, not a phase task |

**The canonical question, answered:** after every file in the repo is updated, the only runtime
system still holding the old string is each user's plugin install cache, which is refreshed by the
documented two-command update path and is out of this phase's scope.

## Common Pitfalls

### Pitfall 1: Fixing commands without regenerating mirrors

**What goes wrong:** 30 command-surface fixes land, and `skills/<name>/SKILL.md` still carries the
bare form in 30 places (measured: 27 mirror files carry script invocations today).
**Why it happens:** the scanner deliberately EXCLUDES generated mirrors from its surface
enumeration (`handAuthoredSkills()` filters out any skill with a matching command), so **the
instrument will report zero while 30 stale mirror lines ship**. The gate cannot catch this.
**How to avoid:** `node scripts/build-skill-mirrors.cjs` immediately after the command sweep, then
`--check` as a separate verification row. `tests/run-all-271.sh` already runs the `--check` arm;
carry it into `run-all-274.sh`.
**Warning sign:** `git diff --stat` shows `commands/` changes with no matching `skills/` changes.

### Pitfall 2: The `python3` blind spot (the pass-five trap)

**What goes wrong:** the phase closes, the gate goes green, and `commands/export.md:97` plus its
mirror `skills/export/SKILL.md:95` still read `python3 scripts/render-pdf {type} --room room/` --
the identical defect, invisible to a predicate scoped to `bash|node`.
**Why it happens:** the current `SCRIPT_INVOKE_RE` hardcodes two verbs. This is exactly the
scoped-by-string mistake Phase 271's own generalizable lesson names.
**How to avoid:** widen the predicate (ANCHOR-01) BEFORE running the sweep, so the sweep's own
denominator includes these sites. `scripts/render-pdf` exists and is executable (verified).
**Warning sign:** the phase's site count is exactly 34 at close. **A correctly-widened predicate
should report MORE than 34 before the sweep** (36 with the two `python3` sites), and the plan
should say so explicitly rather than treating 34 as a target to hit.

### Pitfall 3: Deliberate cwd-relative fallbacks becoming false violations

**What goes wrong:** widening the predicate to catch `./scripts/...` turns four deliberate,
documented fallback lines into violations:

| Site | Line |
|------|------|
| `commands/help.md:77`, `:87` | "Fall back to `node ./scripts/help-renderer.cjs` if `CLAUDE_PLUGIN_ROOT` is unset." |
| `skills/help/SKILL.md:73`, `:83` | same (mirror) |
| `commands/eureka.md:76`, `skills/eureka/SKILL.md:74` | "When `CLAUDE_PLUGIN_ROOT` is unset, fall back to `./scripts/resolve-room`." |

These are the *documented behaviour for the unset case*. Anchoring them is nonsense (an anchored
fallback for an unset anchor).
**How to avoid:** either keep `./scripts/` out of the predicate, or -- better, because it is
mechanism-honest -- include it and add reasoned `ALLOWLIST` entries. Recommend the latter: it makes
the fallback a *declared, reasoned* exception visible in the report rather than an accident of
regex scope. Cross-check against the newer fail-closed `:?` form, which arguably supersedes the
prose-fallback convention entirely; if so, converting those six lines is a legitimate in-scope
improvement, but it is a behaviour change and should be called out, not slipped in.

### Pitfall 4: A dev-gate mention inside a YAML comment counted as an invocation

**What goes wrong:** `skills/conversation-mode/SKILL.md:17` reads
`` #   ...enforced HARD-FAIL by `node scripts/build-connector-registry.cjs --check`, R2/R9 gap===0 ``
-- inside a `#`-comment block in the frontmatter, explaining why a `connector.excluded:true` flag
exists. It is **prose about a dev gate, not an instruction Claude executes**, and it is one of the
3 "hand-authored skill" sites in the 34.
**Why it happens:** the script tier has no prose-vs-instruction discrimination at all (the citation
tier does: backtick-plus-verb, list-number).
**How to avoid:** rule it explicitly. Two defensible dispositions: (a) anchor it anyway (harmless,
keeps the sweep uniform, costs nothing since nothing executes it), or (b) add a reasoned `ALLOWLIST`
entry. **Recommend (a)** -- uniformity is cheaper than an exception, and an anchored path inside a
comment is still a *correct* path. Whichever is chosen, say which and why; do not let it pass
unremarked.
**Contrast:** `skills/mva-pipeline/SKILL.md:52` ("or invoke `node scripts/mva-run.cjs` via Bash
directly") IS a genuine instruction. Do not lump the two together.

### Pitfall 5: `allowed-tools` permission matchers drifting from anchored bodies

**What goes wrong:** an `allowed-tools` entry like `Bash(node scripts/foo.cjs:*)` is a
*pre-approval* pattern matched against the literal command string. Anchor the body and the matcher
stops matching, so the user gets a permission prompt where they used to get silent pre-approval.
**Live evidence this is real, and already present:** `commands/status.md:15` declares
`- Bash(node scripts/mos-status.cjs:*)` while `commands/status.md:67` already executes
`node "${CLAUDE_PLUGIN_ROOT}/scripts/mos-status.cjs" $ARGUMENTS`. The matcher and the body **already
disagree today** -- a pre-existing, unremarked drift left behind by an earlier anchoring pass. It
is degraded UX (an extra prompt), not a hard failure, which is exactly why nobody noticed.
**Blast radius for THIS phase: zero.** Verified: the only two `Bash(...scripts/...)` matchers in the
entire tree are `commands/status.md:15` and its mirror `skills/status/SKILL.md:15`. All 13 affected
command files declare a bare `- Bash` (verified by dumping every `allowed-tools` block), so
anchoring the 34 sites breaks no matcher.
**How to avoid:** confirm the zero-blast-radius finding still holds at execute time (one grep), and
rule on the pre-existing `status.md` drift -- fix it in-phase (a two-line change) or register it as
a followup. Do not leave it undocumented a second time.

### Pitfall 6: Assuming the write-redirection exception applies

**What goes wrong:** a reader pattern-matches this phase onto Phase 271-02's `/mos:radar` ruling
and spends a plan deciding per-site whether anchoring redirects a write into the install cache.
**Why it does not apply:** 271-02 anchored a **data path** the command writes to. This phase
anchors an **executable path**. `node /abs/path/x.cjs ./room` leaves cwd untouched, so every
relative argument still resolves against the user's room. Confirmed at the script level too: the
15 target scripts resolve their internals from `__dirname` (`build-new-surface.cjs:74`
`path.resolve(__dirname, '..')`; `wikilink-file.cjs:70-71` `require('../lib/vault/...')`), never
from `process.cwd()`, so anchoring cannot move a write.
**How to avoid:** state this once in the plan's assumptions and move on. **Do not budget a per-site
read/write disposition pass.**

### Pitfall 7: Landing the gate before the tree is green

**What goes wrong:** `verify-release` goes red and blocks a release for work the phase has not
finished -- exactly the DEVIATION-271-05-A situation, which blocked releases for days.
**How to avoid:** wave-order the gate LAST (ANCHOR-09 after ANCHOR-02..06), and make the plan's own
acceptance criterion for the gate task be "the gate emits a PASS line," which is only meetable if
the sweep genuinely completed. 271-05's Task 1 criterion was written before its dependency waves
closed and proved unmeetable; do not repeat that sequencing.

### Pitfall 8: The STATE.md resync-clobber bug

**What goes wrong:** `gsd-tools query state.*` calls revert `status` to `completed` and `percent` to
a stale value. Documented **17+ times**, most recently during Phase 272.
**How to avoid:** after any `state.*` call, re-read `.planning/STATE.md` frontmatter and
hand-correct. Budget for it; do not treat each occurrence as a new discovery.

## Code Examples

### Example 1: The command / agent sweep transformation

```bash
# BEFORE - commands/file-meeting.md:771 (shipping today)
node scripts/wikilink-file.cjs "$ROOM_DIR" "$NEW_FILE_PATH" --filed-to-target="..."

# AFTER - Pattern 1, quoted short form
node "${CLAUDE_PLUGIN_ROOT}/scripts/wikilink-file.cjs" "$ROOM_DIR" "$NEW_FILE_PATH" --filed-to-target="..."
```

Substitution shape proven by the intern-w1 sweep across 72 sites
(`.planning/debug/resolved/intern-w1-rooms-skill-script-path.md`, Resolution section):

```
s|(bash|node) scripts/([A-Za-z0-9_.-]+)|\1 "${CLAUDE_PLUGIN_ROOT}/scripts/\2"|
```

Apply it **per file with review**, not as a blind tree-wide sed: the predicate has known
false-positive shapes (Pitfalls 3 and 4) that a blind regex would rewrite.

### Example 2: The hand-authored-skill transformation

```bash
# BEFORE - skills/room-passive/SKILL.md:96
node scripts/wikilink-file.cjs "$ROOM_DIR" "$NEW_FILE_PATH" \

# AFTER - Pattern 2, matching skills/export/SKILL.md:80 byte-for-byte in the message string
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/wikilink-file.cjs" "$ROOM_DIR" "$NEW_FILE_PATH" \
```

### Example 3: The four-arm runtime proof, run live this session

Run from `/tmp/.../scratchpad/fakeroom` (provably not the plugin root):

```
# A. BARE (what ships today)
$ node scripts/wikilink-file.cjs
  node:internal/modules/cjs/loader:1433  throw err;   -> Cannot find module   [FAIL]

# B. ANCHORED, CLAUDE_PLUGIN_ROOT set (the fix)
$ CLAUDE_PLUGIN_ROOT=/home/jsagi/dev/MindrianOS-Plugin bash -c 'node "${CLAUDE_PLUGIN_ROOT}/scripts/wikilink-file.cjs"'
  Usage: node scripts/wikilink-file.cjs <room-dir> <file-path> [...]   [PASS - file found and started]

# C. SHORT form with CLAUDE_PLUGIN_ROOT UNSET (why skills need the long form)
$ env -u CLAUDE_PLUGIN_ROOT bash -c 'node "${CLAUDE_PLUGIN_ROOT}/scripts/wikilink-file.cjs"'
  Cannot find module '/scripts/wikilink-file.cjs'   [FAIL, and confusingly]

# D. LONG fail-closed form, both vars unset (the skills form)
$ env -u CLAUDE_PLUGIN_ROOT -u MINDRIAN_OS_ROOT bash -c 'node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found.}}/scripts/wikilink-file.cjs"'
  bash: line 1: CLAUDE_PLUGIN_ROOT: MindrianOS install root not found.   [PASS - refuses, names the fix]
```

This four-arm table IS the D-02 CLI smoke test. Generalize it over a representative sample of the
15 distinct scripts and assert on the resolution signature (Pattern 6), not on business output.

### Example 4: The gate 10f wiring (10c's shape, adapted)

```bash
# ============================================================
# 10f. PLUGIN SCRIPT-INVOCATION ANCHORING
# ============================================================
# Phase 274, the sibling of gate 10c. A bare `bash scripts/<name>` or
# `node scripts/<name>` line in command, skill, agent or pipeline markdown
# resolves against the SESSION'S CURRENT WORKING DIRECTORY. Unlike 10c's
# citation class, which degrades a model read silently, this class dies loudly:
# exit 127 from bash, MODULE_NOT_FOUND from node, in the user's face, mid-command.
#
# Two tiers, two verdicts, on purpose. A Read citation and a Bash invocation
# fail differently and need different recovery text, so folding them into one
# exit code would make the failure output unreadable.
#
# Fail-closed, zero-tolerance, no grandfather clause: Phase 274 cleared all
# known sites before this gate was wired, so there is nothing to grandfather.
# Wire the gate, do not relax it (the 271-05 discipline).
echo -e "\n${BOLD}10f. Plugin Script-Invocation Anchoring${NC}"

SCRIPTANCHOR_OUT=$(node "$PLUGIN_ROOT/scripts/check-plugin-path-anchoring.cjs" --check-scripts 2>&1) && SCRIPTANCHOR_CODE=0 || SCRIPTANCHOR_CODE=$?
if [ "$SCRIPTANCHOR_CODE" -ne 0 ]; then
  fail "Script-invocation anchoring FAILED (bare scripts/ invocations resolve against user cwd, not the plugin install dir):"
  echo "$SCRIPTANCHOR_OUT" | tail -12
  echo "  Recovery: prefix with \"\${CLAUDE_PLUGIN_ROOT}/\" (commands, agents, pipelines) or the"
  echo "  fail-closed \"\${MINDRIAN_OS_ROOT:-\${CLAUDE_PLUGIN_ROOT:?...}}/\" form (hand-authored skills),"
  echo "  then regenerate mirrors with build-skill-mirrors.cjs, or add a reasoned ALLOWLIST entry."
else
  pass "Every plugin-relative scripts/ invocation is anchored or allowlisted (--check-scripts)"
fi
```

**Next free gate id is `10f`** -- verified: `verify-release` currently defines 10, 10b, 10c, 10d,
10e, then jumps to 11.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `PLUGIN_ROOT="$(dirname "$(dirname "$(readlink -f "$0")")")"` | `${CLAUDE_PLUGIN_ROOT}` | 2026-07-11 (intern-w1 RCA) | The old form resolves to `/usr` on every invocation under the Bash tool. Had already propagated to 3 files before being caught. |
| Bare `${CLAUDE_PLUGIN_ROOT}` in hand-authored skills | `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?<msg>}}` | 2026-08-27 (Phase 271-04) | Fail-closed for foreign Agent-Skills hosts that never set a plugin root. |
| Three independent "find the install" guessers | `lib/core/active-plugin-root.cjs`, 5-step precedence | pre-271 | One source of truth; pre-release-tolerant version ordering. |
| Anchoring scoped by grep pattern (3 prior passes) | Scoping by **resolution mechanism** | 2026-08-27 (271-AUDIT lesson) | Each of the 3 prior passes left the sibling pattern standing. This phase is pass 4 and must not repeat it. |
| Advisory-only path lint | Fail-closed `verify-release` gate 10c | 2026-08-27 (Phase 271-05) | The class cannot silently return in the 46th command authored next month. This phase extends the same treatment to the script tier. |

**Deprecated / do not reuse:**
- `readlink -f "$0"` for plugin-root resolution -- documented broken.
- Bash variable state carried across separate markdown code blocks (`PLUGIN_ROOT=...` in block 1,
  used in block 2) -- does not persist; an inherited env var is the only reliable carrier.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `CLAUDE_PLUGIN_ROOT` is reliably injected on Desktop and Cowork, not only in the CLI. | Patterns 1-2, D-02 | LOW-MEDIUM. Never directly instrumented on Desktop/Cowork; the evidence is indirect (~38 SKILL.md files ship this convention successfully). The intern-w1 RCA names this exact gap as its own `falsification_test`. This is *precisely* the residual risk D-02's stated Desktop/Cowork gap covers -- name it in VERIFICATION.md rather than implying it is proven. |
| A2 | Widening the predicate to include `sh`, `npx`, `python`, `python3` surfaces exactly 2 additional sites (both `python3 scripts/render-pdf`). | Pitfall 2 | LOW. Grep-measured this session across all four surfaces. Re-measure at execute time; new sites can land between now and then. |
| A3 | `10f` is the next free `verify-release` gate id. | Example 4 | LOW. Grep-verified against the current file; another in-flight phase could claim it. Re-check before wiring. |
| A4 | The 34-site count is still live at plan/execute time. | Summary | LOW but REAL. Re-measured 2026-09-01 and unchanged, but the ROADMAP's own instruction is to re-run the instrument rather than trust the number. Re-run it. |
| A5 | Anchoring `skills/conversation-mode/SKILL.md:17` (a dev-gate mention inside a YAML comment) is harmless. | Pitfall 4 | LOW. Nothing executes a comment. Stated as a recommendation, not a ruling -- the plan should make the call explicitly. |
| A6 | The pre-existing `commands/status.md` matcher/body drift is degraded UX (an extra permission prompt), not a hard failure. | Pitfall 5 | LOW-MEDIUM. Based on `allowed-tools` being a pre-approval list rather than a restriction list, which `commands/mos-reason.md`'s own inline comment states explicitly. Not instrumented live. |

## Open Questions

1. **Should the six deliberate `./scripts/...` cwd-relative fallback lines be converted to the
   fail-closed `:?` form?**
   - What we know: they document behaviour for the `CLAUDE_PLUGIN_ROOT`-unset case, predate the
     `:?` form, and appear in `help.md`/`eureka.md` plus their mirrors.
   - What's unclear: whether the newer fail-closed form supersedes the prose-fallback convention
     repo-wide, or whether `help` and `eureka` genuinely want a cwd-relative last resort.
   - Recommendation: **out of scope for the sweep, in scope for the allowlist.** Add reasoned
     `ALLOWLIST` entries so the exception is declared and visible, and register the
     supersession question as a followup rather than changing documented fallback behaviour inside a
     path-anchoring phase.

2. **Fix or defer the `commands/status.md:15` matcher/body drift?**
   - What we know: it is real, pre-existing, two lines, and the only instance in the tree.
   - What's unclear: whether an anchored `Bash(...)` matcher pattern (containing `${...}`) even
     matches correctly in Claude Code's matcher engine, which would determine whether the fix is
     "anchor the matcher too" or "drop the specific matcher for a bare `Bash`".
   - Recommendation: fix it in-phase only if the matcher-engine behaviour can be confirmed;
     otherwise register a followup with the evidence. **Do not guess at matcher semantics.**

3. **Does the script tier need a target-existence tag (`OK` / `MISSING-TARGET`) like the citation
   tier has?**
   - What we know: all 15 distinct scripts currently exist (verified). A dangling invocation is a
     different and arguably worse defect than an unanchored one.
   - Recommendation: **yes, add it** -- it is ~5 lines reusing `classifyTarget()`, and it turns the
     gate into a guard against deleted-script drift as well. Low cost, real added value.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | instrument, 14/15 target scripts, tests | yes | v22.23.1 (floor >=22.16.0) | -- |
| Bash | `compute-opportunity-state`, `verify-release`, `run-all-274.sh` | yes | 5.2.21 | -- |
| Python 3 | `scripts/render-pdf` (the predicate-widening sites) | yes | 3.12.3 | -- |
| git | commits, `git diff --numstat` verification | yes | 2.43.0 | -- |
| `scripts/check-plugin-path-anchoring.cjs` | the whole phase | yes | in-repo, 621 lines | -- |
| `scripts/build-skill-mirrors.cjs` | mirror regeneration | yes | in-repo | -- |
| `scripts/verify-release` | gate wiring | yes | in-repo, 706 lines | -- |
| All 15 target scripts | runtime smoke test | yes | 15/15 exist, 0 missing | -- |
| External packages | none | n/a | n/a | n/a |
| Desktop / Cowork runtime harness | full three-surface runtime proof | **no** | -- | **Static path-correctness only -- D-02's stated, deliberate gap** |
| `gsd-tools` on PATH | GSD tooling calls | no (not on PATH) | -- | `node "$HOME/.claude/gsd-core/bin/gsd-tools.cjs" ...` |
| Knowledge graph (`.planning/graphs/graph.json`) | semantic context | stale | 951h old, 1289 commits behind | Not used. Repo prior-art (Phase 271 artifacts, two resolved RCAs) is authoritative here and was read directly. |

**Missing dependencies with no fallback:** none that block execution.
**Missing dependencies with fallback:** Desktop/Cowork runtime harness (fallback: static check,
declared as a gap per the Tri-Polar rule); `gsd-tools` PATH entry (fallback: absolute node
invocation).

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`, so this section applies.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None. Hand-rolled CJS assertion scripts + bash aggregators (repo convention: `tests/test-<phase>-<slug>.cjs` with a local `ok(cond,msg)` helper; `tests/run-all-<phase>.sh` aggregator). |
| Config file | none -- deliberate. `tests/test-271-plugin-path-anchoring.cjs` is the template (218 lines, `fs.mkdtempSync` fixtures, imports `scanSurface` / `scanScriptInvocations` / `validateAllowlist` directly from the instrument). |
| Quick run command | `node tests/test-274-script-invocation-anchoring.cjs` |
| Full suite command | `bash tests/run-all-274.sh` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANCHOR-01 | Widened predicate matches `sh`/`npx`/`python3`; classifies anchored vs bare; `--check-scripts` exits 1 on violation, 0 on clean | unit (fixture) | `node tests/test-274-script-invocation-anchoring.cjs` | Wave 0 |
| ANCHOR-02 | Zero unanchored command-surface invocation sites | integration (live tree) | `node scripts/check-plugin-path-anchoring.cjs --check-scripts` | Wave 0 (mode) |
| ANCHOR-03 | The 3 hand-authored skill sites use the long fail-closed form, not the short form | unit (fixture + live grep) | `node tests/test-274-script-invocation-anchoring.cjs` | Wave 0 |
| ANCHOR-04 | Zero unanchored agent-surface sites | integration | `node scripts/check-plugin-path-anchoring.cjs --check-scripts` | Wave 0 (mode) |
| ANCHOR-05 | Mirrors byte-consistent with fixed commands | integration | `node scripts/build-skill-mirrors.cjs --check` | exists |
| ANCHOR-06 | Every allowlist entry has a non-empty reason; every `followup` id resolves | unit | `node tests/test-274-script-invocation-anchoring.cjs` (reuses `validateAllowlist`) | Wave 0 |
| ANCHOR-07 | Fixture A/B: identical line, prefix as only variable, exit 1 -> exit 0 | unit (tmpdir fixture) | `node tests/test-274-script-invocation-anchoring.cjs` | Wave 0 |
| ANCHOR-08 | From a non-plugin-root cwd, a representative sample of anchored invocations resolves (no `Cannot find module` / exit 127); the bare form provably fails | integration (runtime smoke) | `bash tests/smoke-274-cli-invocation.sh` | Wave 0 |
| ANCHOR-09 | `verify-release` emits a PASS line for gate 10f | integration | `bash scripts/verify-release` (grep for the 10f PASS line) | exists |
| ANCHOR-10 | Zero em-dashes in all new text; CHANGELOG/ROADMAP/knowledge-base entries present | lint (grep) | `grep -rn '\xe2\x80\x94' <changed files>` | inline |

### Sampling Rate

- **Per task commit:** `node tests/test-274-script-invocation-anchoring.cjs` (fixtures only,
  sub-second, never touches the live tree so it stays green while the sweep is mid-flight)
- **Per wave merge:** `bash tests/run-all-274.sh`
- **Phase gate:** `bash scripts/verify-release` fully green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/test-274-script-invocation-anchoring.cjs` -- covers ANCHOR-01, 03, 06, 07. Model it on
      `tests/test-271-plugin-path-anchoring.cjs` (same `ok()` helper, same `mkdtempSync` fixture
      pattern, same direct-import-of-the-instrument approach).
- [ ] `tests/smoke-274-cli-invocation.sh` -- covers ANCHOR-08. The four-arm table in Code Example 3
      is its specification.
- [ ] `tests/run-all-274.sh` -- aggregator. Model on `tests/run-all-271.sh`, including its
      header-comment discipline (one sentence per plan stating what it has to prove) and a
      DO-NOT-REGRESS arm re-running `node scripts/check-plugin-path-anchoring.cjs --check` so this
      phase cannot re-break gate 10c's citation tier.
- [ ] `--check-scripts` mode in `scripts/check-plugin-path-anchoring.cjs` -- the gateable exit-code
      path. Part of ANCHOR-01, not a separate file.
- [ ] Framework install: **none needed.**

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so this section is
included. This is a markdown path-anchoring phase with no network, no auth, no user input parsing
and no data persistence, so most ASVS categories are genuinely not applicable -- stated explicitly
rather than omitted.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface touched. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | **partially** | `allowed-tools` permission matchers ARE an access-control surface (a pre-approval list). Pitfall 5 covers the drift risk; verified blast radius for this phase is zero. |
| V5 Input Validation | **yes** | The instrument's regexes must keep T-271-01's property: **bounded quantifiers, no nesting**, so no crafted markdown line can force catastrophic backtracking. The widened predicate must preserve this. |
| V6 Cryptography | no | None involved. |
| V12 File and Resource | **yes** | This phase is *entirely* about path resolution. The control is: resolve against a host-injected root, fail closed when absent, quote every path. |
| V14 Configuration | **yes** | Gate 10f is a build/release configuration control. It must fail closed. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path resolution against attacker-influenced cwd (a user's room could contain a `scripts/wikilink-file.cjs`, which the bare form would happily execute instead of the plugin's) | **Elevation of Privilege / Tampering** | Anchor to the install root. This is the strongest security argument for the phase and is not currently stated anywhere in the prior art: today, a bare `node scripts/X.cjs` in a user's cwd executes *whatever `scripts/X.cjs` happens to be there*. Anchoring closes a real local code-execution shadowing vector, not only a usability bug. **Worth naming explicitly in the CHANGELOG entry.** |
| Word-splitting on an unquoted expanded path | Tampering | Always double-quote the full path. |
| ReDoS via a crafted markdown line hitting the scanner | Denial of Service | Bounded, non-nested quantifiers (T-271-01), single left-to-right `indexOf` walk per line. |
| Gate silenced by an anonymous exception | Repudiation | `validateAllowlist()` throws at module load on a missing `reason` or a dangling `followup` id. Reuse it; never add a bespoke skip list. |
| Anchored path pointing into the wipe-on-update install cache for a git-tracked WRITE | Tampering | The `/mos:radar` exception class. **Verified not applicable here** (executable-path anchoring, cwd unchanged, all 15 scripts `__dirname`-internal). See Pitfall 6. |

## Sources

### Primary (HIGH confidence)

- `scripts/check-plugin-path-anchoring.cjs` (read in full, 621 lines) -- predicate, `ALLOWLIST`,
  `REGISTERED_FOLLOWUPS`, `validateAllowlist`, `scanScriptInvocations`, `SCRIPT_INVOKE_RE`,
  `PERMISSION_MATCHER_RE`, surface enumeration, mirror exclusion rationale
- `scripts/verify-release` lines 145-163 (gate 6), 336-375 (gate 10c), 377-457 (gates 10d/10e),
  458-475 (gate 11) -- the wiring shape, the fail-closed discipline, the next free gate id
- `.planning/debug/resolved/intern-w1-rooms-skill-script-path.md` (read in full) -- the exact
  substitution regex, the empirical `readlink -f "$0"` -> `/usr` refutation, the 72-site precedent,
  the `${CLAUDE_PLUGIN_ROOT}` convention evidence
- `.planning/phases/271-*/271-05-SUMMARY.md` (read in full) -- gate-wiring commit, fixture A/B
  method, DEVIATION-271-05-A (the never-relax-the-gate ruling), DEVIATION-271-05-B (the
  write-scope-hook precedent), the Phase 274 registration
- `lib/core/active-plugin-root.cjs` -- the 5-step precedence resolver
- `.planning/ROADMAP.md` Phase 274 entry -- registered scope, the exclusion rationale, the
  scope-by-mechanism lesson
- `.planning/phases/274-*/274-CONTEXT.md`, `274-DISCUSSION-LOG.md` -- D-01, D-02, discretion areas
- `CLAUDE.md` + `.claude/includes/*` -- Canon Parts 7/11, Tri-Polar rule, release lockstep,
  compositing mandate, code conventions
- `tests/run-all-271.sh`, `tests/test-271-plugin-path-anchoring.cjs` -- the test-harness template
- Live tool runs this session (2026-09-01): `node scripts/check-plugin-path-anchoring.cjs --report
  --include-scripts` (34 sites, 1 exclusion); `--json` + target-existence walk (15 distinct scripts,
  0 missing); `--check` (gate 10c currently PASSES, 0 violations); the four-arm bare-vs-anchored
  runtime A/B from a foreign cwd; `allowed-tools` block dump across all 13 affected commands;
  mechanism-scoped grep for non-`bash|node` invocation verbs; `node/bash/python3/git --version`

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` -- the 17+-occurrence resync-clobber warning
- `.planning/REQUIREMENTS.md` Traceability section -- the phase-local-ID-minting convention
  (CHOKE, PYPORT precedent) and its standing caveat
- `scripts/build-skill-mirrors.cjs` `SKIP_LIST` block -- mirror-generation contract

### Tertiary (LOW confidence)

- None. No WebSearch, Context7, or external lookup was performed or needed. Per the phase brief,
  `langtalks-graph-expert` and `fullstack-dev-skills:cli-developer` were already consulted this
  session with nothing repo-specific returned, and were deliberately not re-consulted. The
  authoritative sources for this phase are all in-repo and were read directly.

## Metadata

**Confidence breakdown:**

- **Standard stack: HIGH** -- zero new dependencies; both anchoring forms verified shipping in-tree
  for script invocations specifically (`skills/export/SKILL.md:80`, `skills/memory/SKILL.md:94`,
  `commands/status.md:67`), and the rejected alternative is a resolved RCA with a direct empirical
  refutation.
- **Architecture: HIGH** -- the gate-wiring shape is read verbatim from the 10c block this phase is
  told to match; the instrument was read in full; the next free gate id was grep-verified.
- **Pitfalls: HIGH** -- every pitfall is backed by a live measurement taken this session, not by
  recall. The mirror gap (27 mirror files), the `python3` blind spot (2 sites), the `./scripts/`
  fallback set (6 lines), the YAML-comment false positive, the `status.md` matcher drift and the
  zero-blast-radius matcher finding were each grep-confirmed against the current tree.
- **Runtime behaviour: HIGH for CLI** (four-arm A/B executed live this session), **MEDIUM for
  Desktop/Cowork** (env-var injection there is inferred from ~38 shipping files, never
  instrumented -- assumption A1, and precisely the gap D-02 declares).

**Research date:** 2026-09-01
**Valid until:** 2026-10-01 (stable domain: in-repo code and a host env var, no fast-moving
external dependency). **Two things must be re-measured at execute time regardless of this date:**
the live site count (the ROADMAP's own standing instruction) and the next free `verify-release`
gate id.
