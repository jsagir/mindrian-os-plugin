# HANDOFF: kill Tier 0 - the doctrine is DECIDED, the work is UNSTARTED

**Date:** 2026-08-09 · **Author:** a Claude Code session on the native Windows checkout
**For:** whoever opens this milestone on the WSL dev machine
**Status:** DECISION MADE by the navigator · ZERO code written · a `/gsd-quick` planner was
deliberately STOPPED mid-run because the scope escalated past a quick task

> This is a BREAKING CHANGE to the install contract of a commercial plugin. It rewrites two
> constitutional Decisions. Do not start it as a quick task or a phase. It is a milestone.
> Read section 6 before writing a line, because the mechanism the obvious plan would use does not
> exist.

---

## 1. The decision, in the navigator's own words

The navigator escalated across three explicit gates in one session. The final position:

> **"Larry without the Brain isn't Larry, then Tier 0 is shipping a hollow imitation !!! yes"**

Chosen option, verbatim from the gate: **"Hard-require the Brain - kill Tier 0."** No Brain, no
Larry, no keyless mode at all.

### The path there matters, because two softer positions were considered and rejected

1. First offered and chosen: **"always reach, never silent"** - keep Tier 0, kill only the silence.
2. Then chosen: **"Brain required for methodology, optional for chat"** - conversation degrades,
   methodology refuses visibly.
3. Then escalated to: **kill Tier 0 entirely.**

I pushed back twice with the costs in section 3 and the navigator held. **Do not relitigate this.**
If you believe it is wrong, say so once, plainly, and then do what was decided.

### The argument for it, which is strong

What is local versus what is remote:

| Local, in the plugin | Remote, in the Brain |
|---|---|
| Voice, the reframe, Decision Gates, De Stijl marks, room mechanics | 181 frameworks, WHEN / WHICH / SEQUENCE, grading calibration, FEEDS_INTO chains |

Brainless Larry is **the voice without the curriculum**. Canon Part 12 measures Larry by *how
invisible he is when the insight lands* - and the insight comes from the methodology, not the voice.
On the product's own test, voice-alone is a persona doing an impression of a teacher.

### The reframe that survived the escalation, and should shape implementation

"Hollow imitation" is an argument about **honesty**, not optionality. What was actually wrong with
Tier 0 was not that a keyless Larry existed. It is that a keyless Larry **presented itself as the
real thing** - answering methodology questions from local heuristics, never disclosing the Brain was
down, indistinguishable from full Larry from outside. For weeks. That is the counterfeit. Whatever
gets built, the test to apply is: *can a user ever be served methodology that did not come from the
Brain, without being told?* The answer must be no.

---

## 2. The precipitating evidence - this is not abstract

`skills/brain-connector/SKILL.md` says, today:

> "Any success = Brain active. All fail = **silent fallback. Never mention failures to user.**"

For weeks, `scripts/brain-response-sanitize-hook.cjs` blanked **100 percent** of Brain responses and
returned them in a shape the host could not read, throwing `e.reduce is not a function` on every
call. Full diagnosis in the sibling handoff,
`docs/2026-08-09-HANDOFF-brain-envelope-and-egress-guard.md`.

**Nobody noticed, because the doctrine instructed silence.** A total outage of the most valuable
thing in the product looked, from outside, like a Larry who simply had less to say.

**That causal link is the strongest argument the doctrine change has, and it belongs in the
amendment itself, on the record, not in a chat log.**

Second, independent, same file: `activation: "env:MINDRIAN_BRAIN_KEY"` in that skill's frontmatter
**is a no-op**. Claude Code's documented SKILL.md frontmatter is `name`, `description`,
`disable-model-invocation`, `allowed-tools`, `disallowed-tools`, `arguments`, `context`, `background`.
`activation` is not among them; Claude Code ignores it. The skill has only ever loaded on
description match. **Two clauses in one 123-line file, both pretending to do something, neither
doing it.**

---

## 3. The cost, stated plainly - the navigator accepted these

Killing Tier 0 makes these statements FALSE the moment it merges:

```
CLAUDE.md:19    "One command installs it; no setup, Larry starts talking."
CLAUDE.md:84    "...inside Claude Code with zero infrastructure"
decisions.md:5  "| 1 | One-command install | Zero config; Larry works immediately. |"
```

And it means:

- Every user needs a Supabase-minted `MINDRIAN_BRAIN_KEY` before Larry says a word.
- **Decision #1 must be rewritten, not just Decision #8.** Both, together, or the constitution
  self-contradicts.
- Decision #5 (*"Brain as remote MCP - users get intelligence, not data"*) framed the Brain as
  deliberately remote and optional. Revisit its wording.
- The ~$114/month Render stack (`pws-brain-mcp` Pro + `pws-brain-db` Standard) becomes a **hard
  uptime dependency for every install**. Note this was a service the navigator was considering
  suspending the same morning.
- There is no try-before-key path into a commercial product.

---

## 4. MEASURED BLAST RADIUS

Counts from the native Windows checkout at the PR #2 merge, `632e230b`. Re-measure before planning;
they will have drifted.

| Surface | Count | Notes |
|---|---|---|
| Files with `isAvailable()` brain-optional guards | **47 files, 101 call sites** | the actual work |
| Docs and skills mentioning Tier 0 | **121 files** | most are prose, some are contracts |
| Test files pinning Tier-0 / graceful degradation / silent fallback | **82** | biggest single cost |
| Tier-0 sentinel chokepoint | `lib/core/tier0-messaging.cjs` | 1 chokepoint, 1 test, 1 consumer |

**The good news, and it is real:** the sentinel is a SINGLE chokepoint, exactly as Canon Part 9
intends. One file decides what a keyless session gets, so the *behaviour* flips in one place. What
does not flip in one place is the 101 guards, the 82 tests, and the 121 documents that assume the
answer.

Guard concentration, highest first:

```
lib/core/tier0-messaging.test.cjs   8      scripts/backfill-correlation-id.cjs  4
lib/core/tier0-messaging.cjs        6      lib/core/research-corpus.test.cjs    4
bin/mindrian-brain-mcp-client.cjs   6      lib/brain/chain-recommender.cjs      4
scripts/intent-classifier.cjs       5      scripts/rs-explain-command.cjs       3
lib/core/brain-client.cjs           5      scripts/part8-egress-guard-hook.cjs  3
```

**The acceptance fixture you will have to confront:** `tests/fixtures/127-03-acceptance/` contains
`clean-install`, `with-key`, `lawrence-state`, and **`tier-0-no-key`**. That last one exists
specifically to prove the product works WITHOUT a key. Killing Tier 0 means deleting the artifact
that currently proves the install works. Decide consciously whether it is deleted or repurposed into
a *refusal* fixture (asserting the keyless path refuses correctly). Repurposing is almost certainly
better than deleting: it keeps the coverage and inverts the assertion.

Offer-to-setup path reaches: `skills/brain-connector`, `skills/compare-ventures`,
`skills/deep-grade`, `skills/find-connections`, `skills/setup`, plus `lib/core/integration-registry.cjs`.

---

## 5. What was already started and then deliberately stopped

A `/gsd-quick` run was initialized and then halted when the scope escalated:

- quick id **`260808-is9`**, slug `make-the-brain-always-on-larry-behaviour`
- directory created: `.planning/quick/260808-is9-make-the-brain-always-on-larry-behaviour/`
  (**empty - no PLAN.md was ever written**)
- config observed: `workflow.use_worktrees=false`, `commit_docs=true`, no `.gitmodules`,
  `branch_name: null`, planner and executor model `opus`, `roadmap_exists: true`
- a `gsd-planner` agent WAS spawned against the softer "split contract" doctrine and was **stopped
  before it wrote the plan**, because the navigator escalated to killing Tier 0 while it ran

**Either delete that empty directory or reuse the id.** Do not let a fresh session find it and
assume a plan exists. `/gsd-quick list` will report it as in-progress with no summary.

---

## 6. READ THIS BEFORE PLANNING - the obvious mechanism does not exist

The original framing was "make the Brain skill always-on." **That is not expressible as a skill.**
Verified against Claude Code's documentation:

- Skills are **model-invoked** by `name` + `description` matching. There is no force-load field.
- `disable-model-invocation: true` only *disables*; there is no enable-always counterpart.
- Only `name` and `description` are always resident. The body loads when the skill triggers.

**So any plan that says "make brain-connector always-on" as a skill change is built on a primitive
that does not exist.** That is why the planner was stopped.

### The mechanism that DOES work, and you already ship it

A plugin-shipped **`UserPromptSubmit` hook** injecting `additionalContext` runs on every user
prompt. MindrianOS **already does this** - every turn of every session, `hooks/hooks.json` injects a
`NAVIGATION DECISION (engine v1)` block. **The rail exists, runs, and is already paid for. The Brain
reach simply is not on it.**

Ranked options, with what a plugin can actually ship:

| Mechanism | Every turn? | Plugin can ship it? |
|---|---|---|
| `UserPromptSubmit` hook injecting `additionalContext` | YES | YES - **already in use here** |
| `SessionStart` hook (with `compact` matcher) | no, session + post-compaction | YES |
| Plugin-provided agent body / system prompt | YES | YES, but replaces the whole agent |
| project or user `CLAUDE.md` | session start | **NO** - requires the user to edit their own file |

### AND THE CATCH, which is the most important thing in this document

LangTalks ep55 (Context Engineering, Lee Twito and Gal Peretz) states that prompt caching requires
leaving *"את ה-prefix של ה-prompt ללא שינוי"* - **the prompt prefix unchanged.** Injecting fresh
retrieval per turn **destroys the cache**: money and latency, on every turn, forever.

**Combine the two findings and you get something neither source had alone: MindrianOS may ALREADY be
destroying its own prompt caching on every turn, via the navigation block, before anyone adds the
Brain to the same rail.**

**MEASURE THIS FIRST.** It is unexamined, it predates this whole discussion, and if true it is a
larger live bill than the Render stack. Everything else in this handoff is a decision. That is a
bill.

And ep55 also demolishes the alternative, which is why this is a genuine design tension rather than
a simple answer:

> "even if you give it the best memory system in the world, it won't always know when to use it, or
> which questions to ask at that given moment"

framed explicitly as *"a point in MCP that I think is a bit problematic."* **On-demand under-fires;
always-on burns cache.** Neither is free. That is the real problem to solve, and it is sharper than
"make it always-on."

---

## 7. External grounding, already gathered - do not re-research this

Two consultants were run per `CLAUDE.md`'s mandatory multi-source grounding rule
(`langtalks-graph-expert` for agent and graph concepts, `claude-code-guide` for Claude Code
internals). Findings that bear on this milestone:

**Refusal has outside support, stated almost verbatim.** MotherDuck Guides Panel, flagged as
repeated twice in the talk: *"an agent facing an undefined term should say 'I don't know,' never
infer or guess."* Plus the observation that Claude, ChatGPT and Gemini all said they would "infer" -
*"which the Cambridge Dictionary defines as effectively 'guess.'"* **Your refuse-rather-than-guess
decision is externally supported.**

**A near-complete implementation blueprint nobody in this project has read.** *"Building an Advanced
Agentic Harness"* (data4sci.com, Bruno Goncalves). Local copy:
`C:\Users\PC\Projects\langtalks-graph-expert\sources\research\markdown\url-https-data4sci-com-blog-building-an-adva.md`

- a single `pressure()` scalar drives degradation: *below 0.7 the full pipeline runs including the
  LLM judge; above 0.9 the orchestrator skips the expensive critic; at 1.0 the run halts with
  partial results*
- a four-class error taxonomy: transient (retry with jittered backoff), validation (feed the error
  back), **missing-information (*"retrying is actively harmful... the right move is to re-plan"*)**,
  policy violation (halt)
- **"truncation is explicit rather than silent"** - the exact rule this outage needed
- *"Context should be actively assembled, not passively accumulated"*

**This is your Tier-0 doctrine, already designed by someone else, in more detail than we have
written.** Read it before authoring the amendment.

**Silent failure is a named law, three independent sources.** ep35 (Almog Baku): *"because AI fails
silently; we don't get bugs that pop out like in classic software engineering"* - his fix is to log
**content**, not just system events, to enable replay. ep55: best practice is not to expose internal
errors to users, but an agent NEEDS to know transient versus terminal, and *people throw tool errors
away instead of putting them in context*. Fragmented #307 lists "Agent legibility" as one of five
harness pillars.

**On the eval problem there is a cheaper answer than a golden dataset.** ep65 (Asaf Savich,
Komodor): the **shadow run** - v1.0 serves the customer while v1.1+ run behind it on real traffic
with an LLM judge scoring each, because *"I ran it on the dataset, it looked good - but does it
really simulate the real world?"* Judges a change in hours-to-days on real runs. **You do not need a
perfect QA set before you can measure. You need traffic, which you have.** Complement: Agent Factory
(Google Cloud Tech) on offline golden dataset plus LLM-as-judge plus a human calibration loop, and
its warning that per-component metrics mislead.

**Anthropic's own finding on instruction bloat**, relevant if you are about to add doctrine text:
they removed *"over 80% of Claude Code's system prompt... with no measurable loss on our coding
evaluations."* Four reversals: rules to judgement, examples to interface design, upfront to
progressive disclosure, repetition to simple tool descriptions.

**Genuinely absent from all 44 corpus sources** - do not go looking again: groundedness scoring,
recall@k as a practice, QA pairs for a knowledge graph, result shaping (raw rows versus summaries),
retrieved-content staleness, and any discussion of making a remote knowledge service a hard startup
requirement. **The specific decision in this handoff has no external precedent in that corpus.** It
is the navigator's own call. Own it as such; do not cite these talks as support for it.

---

## 8. THE PRECONDITION nobody has satisfied

**You are about to hard-require a dependency whose answer quality you cannot currently measure.**

- There is **no eval set**. None. Not a golden dataset, not QA pairs, not a shadow-run harness.
- **Eight of the Brain's nine vector indexes are the wrong dimension for the e5 sidecar** (seven at
  384, one at 1536, only `mindrian_methodology_vec` at 1024). Details in the sibling handoff.
- The retrieval entry point had a ranking bug that returned an **alphabetical slice capped at 15
  rows** instead of a relevance ranking, making most of a 44-framework result set unreachable. Fixed
  in the brain repo, but it shows the class of defect that ships unnoticed without an eval.

**Hard-requiring something is a promise about its quality.** That promise currently has no
measurement behind it. The shadow-run pattern in section 7 is the cheapest way to acquire one, and
it can run before the doctrine ships rather than after.

Recommended ordering, offered not imposed:

1. Measure the prompt-cache cost of the existing per-turn hook (section 6).
2. Stand up a shadow-run or minimal eval so quality is observable.
3. Write the doctrine amendment (Decisions #1 AND #8 together) plus the `CLAUDE.md` architecture
   correction, as ONE reviewable unit with no code.
4. Then sweep the 101 guards, the 82 tests, and the `tier-0-no-key` fixture.

Step 3 alone is safe to merge; steps 3 and 4 must not be split across releases, or the docs will
claim Brain-required while the guards still silently degrade. **That contradiction is worse than
either state.**

---

## 9. Canon obligations this milestone must clear

- **Part 8 (Graph Boundary).** Untouchable. This changes WHEN the Brain is reached and how loudly
  failure surfaces. It must not change WHAT crosses the wire. No LOCAL user data egresses, ever.
- **Part 11 (CIRS).** If a visible methodology refusal is a genuine Decision-Gate fork - and it
  plausibly is: *connect the Brain, or proceed without methodology* - then `brain-connector` needs
  `hitl_shape` and `hitl_why` and can no longer sit behind `connector.excluded: true`. Decide this
  explicitly and justify it. Gate: `node scripts/check-shape-declaration.cjs`.
- **Part 7 (Reuse Before Build).** Do NOT mint a fourth brain skill. `brain-connector`,
  `brain-derive`, and `pws-brain` (explicitly RETIRED) already exist. Extend `brain-connector`.
- **Part 6 (Dog-Fooding).** A real violation here surfaces as a CONTRADICTS edge against the
  plugin's own room. Expect that and treat it as signal.
- **Tri-Polar.** CLI, Desktop, and Cowork. A keyless refusal must behave correctly on all three, and
  Desktop and Cowork resolve plugin-scoped tool names while CLI in the dev checkout resolves
  project-scoped ones - both legs are already exercised by
  `tests/test-245-brain-envelope-shape.cjs` claim (b) if you need the pattern.
- **No em-dashes anywhere.** Hyphens only; there is a test fence.
- Gates to run: `bash tests/run-all-<phase>.sh`, `node scripts/check-shape-declaration.cjs`,
  `node scripts/build-connector-registry.cjs --check`, `node scripts/doctor.cjs --acceptance`,
  `scripts/verify-release`.

---

## 10. Related artifacts

| Where | What |
|---|---|
| `docs/2026-08-09-HANDOFF-brain-envelope-and-egress-guard.md` | sibling handoff: the outage, PR #2 merged, PR #3 open, the release owed |
| `ProblemsWorthSolving-Brain/docs/2026-08-07-brain-for-harness-design.md` | the Brain's consumption-surface design, sourced from four transcripts, with an explicit record of what none of them could answer |
| `github.com/memgraph/skills`, `skills/memgraph-graph-rag/SKILL.md` | a published reference skill: when-to-use with an explicit do-NOT-use, outcomes, tool contracts, guardrails, `references/REFERENCE.md`. Adapt rather than invent. |
| `C:\Users\PC\Projects\langtalks-graph-expert` | the consultant corpus. 7,187 nodes, 44 sources. MCP registered at user scope; **tools require a session restart to appear**. |
