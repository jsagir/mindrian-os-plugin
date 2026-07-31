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
- Every command has a declared `interactive_first_reward` field in its frontmatter
- Value must be one of the closed REWARD_TYPES vocabulary OR `--none (scripting only)`
- If value is `--none` without the scripting justification, the command spec is rejected at review
- CI check enforces this at build time

**Implementation:**
- Library: `lib/core/mva-rule-linter.cjs` (exports `scanCommands`, `scanFiles`, `validateFrontmatter`, `REWARD_TYPES`)
- CLI: `scripts/check-reward-before-investment.cjs` (table + Larry-voice summary; exits 1 on violation)
- Pre-commit hook: `scripts/hooks/pre-commit` invokes the CLI when any `commands/*.md` is staged
- Bypass: `COMMIT_NO_VERIFY=1` (wave-protocol invariant per Phase 125-08 SUMMARY)

**Two scopes (Phase 245-02):**

| Invocation | Scope | Used by |
| --- | --- | --- |
| `node scripts/check-reward-before-investment.cjs [commandsDir]` | FULL AUDIT: every `*.md` in the directory. Reports the true repo-wide debt. | CI, manual sweeps |
| `node scripts/check-reward-before-investment.cjs --staged [repoRoot]` | COMMIT GATE: only the `commands/*.md` this commit is staging, discovered via `git diff --cached --name-only --diff-filter=ACM`. Nothing staged means nothing to judge (exit 0). Exits 2 if the staged set cannot be determined, so an ungateable commit is never reported as passing. | the pre-commit hook |

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

**The v1.13.0 REWARD_TYPES closed vocabulary:**
- `reframe_question` - Larry reframes the user's sentence into a beautiful question
- `instant_brief` - the 30-second MVA pipeline output (this phase's deliverable)
- `schema_preview` - a structural preview of what would be extracted
- `calibration_distribution_preview` - anonymized score distribution from the calibration set
- `paragraph_preview` - partial extraction from the first paragraph alone
- `--none (scripting only)` - explicit opt-out, per rule doc line 81

Future expansions are canon amendments, not command-level inventions.

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
