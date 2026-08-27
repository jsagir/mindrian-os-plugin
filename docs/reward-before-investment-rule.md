---
source: ~/MindrianRooms/mindrian/mindrianOS/sub-rooms/communications/conversion-fix/solution-design/reward-before-investment-rule.md
canonical_location: above
date: 2026-04-12
type: non-negotiable-constraint
applies_to: every entry flow current and future
in_repo_copy_landed: Phase 118-06 Plan 06 (v1.13.0-beta.17)
---

# The Reward-Before-Investment Rule

> NOTE TO FUTURE CONTRIBUTORS: This file is the in-repo copy of the canonical
> rule. The source-of-truth lives at the path in `source:` above. Treat the
> source room as authoritative if the two ever diverge. The in-repo copy
> exists so the rule is visible in the plugin context, not only in
> `~/MindrianRooms/`. Em-dashes from the source have been replaced with
> hyphens per the project's no-em-dash hard rule (`feedback_no_emdashes` in
> the user's memory index).

## The rule
**No flow in MindrianOS may require user input beyond one sentence before delivering its first variable reward.**

This is a hard architectural constraint. It applies to every current entry flow, every future entry flow, every command that might be run "cold" without prior room content, and every onboarding variant.

## Why this is non-negotiable
Nir Eyal's #1 sequencing rule: **reward always comes before investment.** A user who has not yet received value resists effort. A user who has just received value is primed to invest more.

Every current MindrianOS entry flow violates this rule:
- `/mos:new-project` asks for venture questions before delivering value
- `/mos:file-meeting` requires a transcript before showing intelligence
- `/mos:grade` requires existing room content

Every one of these is a Dror death spiral waiting to happen.

## What counts as "user input beyond one sentence"
Violations:
- Filling any form
- Picking from any menu longer than 3 options
- Naming anything
- Uploading anything
- Selecting a stage, category, type, or framework
- Running a second command before seeing output from the first
- Reading instructions longer than one line

Non-violations:
- Typing one sentence about the venture
- Pressing a single number to pick from 3 options
- Clicking a URL
- Watching output stream

## What counts as "first variable reward"
A reward qualifies only if it is:
1. **Unpredictable** - user could not have produced it themselves in under 30 seconds
2. **Intelligible** - user understands what they are seeing without explanation
3. **Valuable** - the user would pay attention to it if they saw it on someone else's screen
4. **Attributable to MindrianOS uniquely** - not something ChatGPT could do in the same time budget

A grade is not a reward (predictable output of an asked question).
A `/mos:status` output is not a reward (predictable report).
A status report is not a reward.

The Instant Brief IS a reward. The Breakthrough Scan IS a reward. A Tavily-sourced funding opportunity surfaced unsolicited IS a reward.

## Application to existing flows (audit + remediation)

### `/mos:new-project`
**Current:** asks exploration questions before room creation.
**Remediation:** first user sentence triggers Instant Brief pipeline. Room creation offered as option 2 of the 3-option footer. User can get value without ever creating a room.
**Phase 118 declaration:** `interactive_first_reward: instant_brief` (canonical implementation lands in Phase 118 itself; this phase IS the Instant Brief pipeline).

### `/mos:file-meeting`
**Current:** requires transcript upload before any intelligence.
**Remediation:** on invocation, surface a preview of what WILL be extracted using the first paragraph of the transcript alone. Full analysis is option 2. Reward comes at character 200, not character 20,000.
**Phase 118 declaration:** `interactive_first_reward: paragraph_preview` (field only; actual remediation is a follow-up phase).

### `/mos:grade`
**Current:** requires existing content.
**Remediation:** on cold invocation, explain what the grade measures AND show the calibration set's anonymized score distribution. User sees where they would land if they had content, before they have content. This is a reward without requiring prior investment.
**Phase 118 declaration:** `interactive_first_reward: calibration_distribution_preview` (field only; actual remediation is a follow-up phase).

### `/mos:onboard`
**Current:** runs an interactive walkthrough.
**Remediation:** first screen is not a tutorial. First screen is a question: "What decision are you stuck on right now? Tell me in one sentence." Everything else waits until after Larry reframes the sentence.
**Phase 118 declaration:** `interactive_first_reward: reframe_question` (field only; actual remediation is a follow-up phase).

## Application to future flows
Every new command added to MindrianOS from this date forward must answer:
**"Does this flow deliver a variable reward before asking for meaningful investment?"**

If the answer is no, the flow is redesigned until the answer is yes. This is reviewed at the command-spec stage, not at the code-review stage. Commands that violate this rule are blocked from shipping.

## The scripting override
CLI tools must support automation. A user running MindrianOS from a script does not want a 30-second Instant Brief every time.

**Rule:** any violation of reward-before-investment is acceptable IF the command is invoked with a `--no-interactive`, `--script`, or `-q` flag. The flag is the scripting escape hatch. Interactive mode remains hard-gated by the rule.

## Detection mechanism (Phase 118-06)
A linter-style check at the command-spec level:
- Every command has a declared `interactive_first_reward` field in its frontmatter; a surface with no frontmatter declares in `data/first-reward-surfaces.json` instead
- Value must be one of the closed REWARD_TYPES vocabulary, which includes the two opt-outs `--none (scripting only)` and `--none (diagnostic surface)`
- If value is `--none (scripting only)` without the scripting justification, the command spec is rejected at review; `--none (diagnostic surface)` is the honest opt-out for an interactively-invoked command that only reports state
- CI check enforces this at build time

**Implementation:**
- Library: `lib/core/mva-rule-linter.cjs` (exports `scanCommands`, `scanFiles`, `scanDeclaredSurfaces`, `validateFrontmatter`, `REWARD_TYPES`)
- CLI: `scripts/check-reward-before-investment.cjs` (table + Larry-voice summary; exits 1 on violation)
- Registry: `data/first-reward-surfaces.json` (Phase 267.3, ruling D-A) declares the first reward for surfaces that have no frontmatter to declare in, such as the `scripts/session-start` prose branches; read by `scanDeclaredSurfaces()` and audited by the `--surfaces` CLI mode
- Pre-commit hook: `scripts/hooks/pre-commit` invokes the CLI when any `commands/*.md` is staged
- Bypass: `COMMIT_NO_VERIFY=1` (wave-protocol invariant per Phase 125-08 SUMMARY)

**Two scopes (Phase 245-02):**

| Invocation | Scope | Used by |
| --- | --- | --- |
| `node scripts/check-reward-before-investment.cjs [commandsDir]` | FULL AUDIT: every `*.md` in the directory. Reports the true repo-wide debt. | CI, manual sweeps |
| `node scripts/check-reward-before-investment.cjs --staged [repoRoot]` | COMMIT GATE: only the `commands/*.md` this commit is staging, discovered via `git diff --cached --name-only --diff-filter=ACM`. Nothing staged means nothing to judge (exit 0). Exits 2 if the staged set cannot be determined, so an ungateable commit is never reported as passing. | the pre-commit hook |
| `node scripts/check-reward-before-investment.cjs --surfaces [repoRoot]` | REGISTRY AUDIT (Phase 267.3): every record in `data/first-reward-surfaces.json`, the declarations for surfaces with no frontmatter. Same three buckets, same exit contract. Wired fail-closed into `scripts/verify-release`. | the release gate, manual sweeps |

Why the split: the hook always CLAIMED to gate staged changes, but it passed
the whole `commands/` directory. With 103 of 112 commands never having declared
the field, one pre-existing offender blocked every commit that touched any
command, which made `COMMIT_NO_VERIFY=1` mandatory rather than exceptional. The
per-file verdict is unchanged: stage a command with a missing or invalid
declaration and the commit is still blocked. Pinned by
`tests/test-245-reward-guard-staged.cjs`, which asserts BOTH that unstaged debt
no longer blocks AND that a staged offender still fails, through the CLI and
end to end through the installed hook.

The repo-wide backfill (102 commands still undeclared as of Phase 245) remains
open and is visible through the full-audit mode. Narrowing the commit gate does
not retire that debt; it stops the debt from blocking unrelated work.

**The REWARD_TYPES closed vocabulary (v1.13.0, amended by Phase 267.3):**
- `reframe_question` - Larry reframes the user's sentence into a beautiful question
- `instant_brief` - the 30-second MVA pipeline output (this phase's deliverable)
- `schema_preview` - a structural preview of what would be extracted
- `calibration_distribution_preview` - anonymized score distribution from the calibration set
- `paragraph_preview` - partial extraction from the first paragraph alone
- `--none (scripting only)` - explicit opt-out, per rule doc line 81
- `methodology_reframe` - Larry's analysis or reframe over the user's own material (Phase 267.3)
- `--none (diagnostic surface)` - explicit opt-out for a command that reports state, or for a pure router with no first-party reward (Phase 267.3)
- `live_deliverable` - a real, deployed, shareable artifact produced by an irreversible action (Phase 267.3)

The first six are the v1.13.0 original set and are never respelled. The last three were added
by the two Phase 267.3 amendments recorded below.

Future expansions are canon amendments, not command-level inventions.

## Vocabulary amendments

A term is added to `REWARD_TYPES` in THREE places at once, together, or not at all: the
allowed-values list above, the frozen Set in `lib/core/mva-rule-linter.cjs`, and the
`_doc.reward_vocabulary` mirror in `data/first-reward-surfaces.json`. Set-equality across all
three is test-enforced by `lib/core/mva-rule-linter.test.cjs` T13 and T14, so a term added to
one and forgotten in another reds the suite instead of drifting quietly. A code change without
an entry in this section is a command-level invention wearing a library's clothes. Each entry
records the exact token, the surface class it describes, why the existing vocabulary could not
describe it, the ruling that minted it, and the date.

### `methodology_reframe`

| Field | Value |
|---|---|
| Token | `methodology_reframe` |
| Surface class | A conversational methodology command whose first delivered value is Larry's analysis or reframe over the user's OWN material. The user has already supplied the substance; the variable reward is what Larry does with it in the first turn, before any further investment. |
| Ruling | Phase 267.3, D-B (`267.3-DECISIONS.md` Section 3) |
| Date | 2026-08-27 |
| Evidence | `267.3-AUDIT.md` Section 3, specifically 3.1 and 3.2 |

Why the existing six could not describe it. `267.3-AUDIT.md` Section 3.1 measured that five
of the six original members were each minted against exactly one flow: `reframe_question` is
bound to onboard's single-sentence opener, where Larry reframes a SENTENCE before any material
exists; `instant_brief` is the 30-second MVA pipeline output; `paragraph_preview` is a partial
extraction from a transcript's first paragraph; `schema_preview` is a structural preview of
what WOULD be extracted, which is a promise about extraction and not an analysis; and
`calibration_distribution_preview` is a score distribution. Section 3.2 then measured ten
conversational methodology commands with no honest term available to them. None of the five
describes "Larry reasons over what you brought and hands back a reframe." The term is grounded
in this document's own reframe vocabulary rather than invented; it applies the same move to a
different input.

### `--none (diagnostic surface)`

| Field | Value |
|---|---|
| Token | `--none (diagnostic surface)` |
| Surface class | A command that reports state rather than delivering a variable reward, AND (per the 267.3-04 ruling below) a pure ROUTER with no first-party reward of its own. This is an OPT-OUT, not a reward. |
| Ruling | Phase 267.3, D-B (`267.3-DECISIONS.md` Section 3) |
| Date | 2026-08-27 |
| Evidence | `267.3-AUDIT.md` Section 3, specifically 3.3 |

Why the existing six could not describe it. This document already names the category in its
own words, twice, under "What counts as first variable reward": "A `/mos:status` output is not
a reward (predictable report)." and "A status report is not a reward." The gap was that the
vocabulary gave that named category no legal value to declare. `267.3-AUDIT.md` Section 3.3
measured nine diagnostic, operator and report commands in it. Declaring
`--none (scripting only)` instead would be a false statement about the command's invocation,
because the scripting override above is legitimate only IF the command is invoked with a
`--no-interactive`, `--script`, or `-q` flag, and these commands are invoked interactively;
`status` even declares `hitl_shape: F.1`, a genuine Decision-Gate fork, which is the opposite
of a silent script.

Why it is spelled in the `--none (...)` family. So a reader scanning frontmatter sees at a
glance that it is an opt-out and not a reward. Two opt-outs that look alike and one reward
vocabulary that looks different is the readable arrangement. A bare word such as
`diagnostic_report` would read as a reward type and invite exactly the misclassification the
ruling exists to prevent.

**The router sub-case, added 2026-08-28 by the 267.3-04 navigator ruling (Row 15, `show`).**
A pure router produces nothing of its own: `commands/show.md:40` says outright "you do NOT
build any view here", it resolves the navigator's chosen job through `command-resolver` and
hands the chain to `runChain`, so every reward it appears to deliver is its TARGET's reward.
That surface neither reports state nor delivers a variable reward, and the vocabulary has no
term for an INHERITED reward. The ruling reuses this opt-out rather than minting a tenth term
for a single command, on the reading that the honest content of the declaration is "this
surface has no first reward of its own", which is close enough to the term's spirit. Read this
NARROWLY. It is a documented sub-case, not a general loosening: a future router-shaped command
still needs its own first-delivery check against the four qualifying tests, not a rubber stamp
from this precedent. A command that merely LOOKS like a router, and in fact produces something
before dispatching, is not covered.

### `live_deliverable`

| Field | Value |
|---|---|
| Token | `live_deliverable` |
| Surface class | A real, deployed, shareable artifact produced by an irreversible action: a live URL, a sent file, a filed document. This is a REWARD, not an opt-out. |
| Ruling | Phase 267.3, plan 04 (`267.3-CLASSIFICATION.md`, `## Navigator ruling`, Row 13) |
| Date | 2026-08-28 |
| Evidence | `commands/publish.md:149`, where the deploy output is parsed and the live URL is handed over ("your presentation is live, share that link with anyone") |

The qualifying tests, applied. The term is legitimate only where all four of this document's
tests pass on the artifact itself, in the same framing the other terms use:

1. **Unpredictable** - the navigator could not have produced the artifact themselves in the
   available time. A deployed Data Room is not a 30-second job.
2. **Intelligible** - they understand it instantly on sight. A live URL needs no explanation.
3. **Valuable** - they would show it on someone else's screen. That is the whole point of a
   shareable link.
4. **Uniquely attributable to MindrianOS** - no general-purpose assistant produces the
   equivalent. Nothing else deploys their room.

Why the existing eight could not describe it. `reframe_question`, `instant_brief`,
`schema_preview`, `calibration_distribution_preview` and `paragraph_preview` are each bound to
one specific flow, and `publish` runs none of them; stretching `instant_brief` to mean "any
fast valuable output" would dissolve the term the same way a rushed guess almost dissolved
`--none (scripting only)` in plan 271-03. `methodology_reframe` requires Larry's analysis over
the navigator's own material, and `publish` analyzes nothing. `--none (scripting only)` is
forbidden twice over: `publish` declares `hitl_shape: "F.0"`, a genuine human fork, and carries
none of `--no-interactive`, `--script` or `-q`. And `--none (diagnostic surface)` would be false
in the OPPOSITE direction from the other eight: `publish` performs an irreversible action and
hands back a real artifact, which is categorically not "reporting state rather than delivering a
variable reward". Filing a knowingly-false-but-least-false declaration would green the guard on
an untrue claim, which is the one outcome the guard exists to prevent.

What this term does NOT cover. A command that merely writes a file into the room, or prints a
path, or promises a deploy that has not happened. The artifact must exist and be shareable at
the moment the declaration claims it is delivered.

### What an amendment does NOT authorize

Declaring a value on any specific command. Binding decision B5 stands: the linter validates
only the DECLARATION, and per-command remediations are follow-up work. The class lists cited
above are the audit's measured signal, not a rubber stamp; each command's value is ruled
per command against a written rubric with its own cited first-reward moment.

## Why this belongs in the room (and not just in code comments)
This rule is not a technical decision - it is a product constraint. It needs to be visible to every future contributor, visible to Jonathan when making design decisions, and visible to users if they ask "why did MindrianOS just give me something before asking anything?"

Put it in the room. Cite it in every phase spec. Treat violations as bugs.

## Dror 2.0 test requirement
No subject should be required to type anything other than one sentence in their first session to see meaningful MindrianOS intelligence. If the subject is asked to fill a form, name something, or pick from a list longer than 3 options before seeing a reward, the test fails by construction - not because the subject failed, but because the flow violated the rule.

**Implementation:** `tests/test-mva-dror-harness.cjs` runs the full MVA pipeline against 3 fixture sentences (1 English venture, 1 obvious non-venture, 1 Hebrew sentence) and measures elapsed time end-to-end from hook fire to Vercel URL render. The harness asserts the English venture path completes within 60 seconds and produces a non-empty Vercel URL. Per LD1 LOCKED (118-CONTEXT.md), Test 3 asserts the English-only Hebrew refusal envelope (OQ1 is closed; the harness reads LD1 at startup, never fails loudly on "OQ1 unresolved").

## Follow-up phases registered

Per binding decision B5: this phase ships the rule + the linter + the 4 named commands' DECLARATIONS. The actual per-command flow remediations (other than `/mos:new-project`, whose canonical remediation IS Phase 118 itself) are out-of-scope and tracked as follow-up phases:

1. **Audit + declare `interactive_first_reward` on the remaining ~85 commands** (the linter currently reports them as missing; that's expected; a sweep phase will classify each as either an enum value or `--none (scripting only)` per the scripting override clause).
2. **Implement actual remediation on `/mos:file-meeting`** (the `paragraph_preview` reward).
3. **Implement actual remediation on `/mos:grade`** (the `calibration_distribution_preview` reward).
4. **Implement actual remediation on `/mos:onboard`** (the `reframe_question` reward).
5. **Phase 121.5 capstone** consumes the `dror_pass` telemetry event for the Hooked re-score gate.
