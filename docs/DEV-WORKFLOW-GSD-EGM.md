# How we work: GSD and elephant-goldfish, for a new developer

This page is for a developer who joins the MindrianOS plugin project. It explains the two methods we use together, what each one is for, and how a piece of work moves through them. Read it once before your first phase.

## The idea in one minute

We build with AI agents, and agents have two weaknesses that matter here.

1. **They forget.** A chat session ends and its understanding is gone. So everything that matters must live in files, not in a conversation.
2. **They agree with themselves.** The session that wrote a plan thinks the plan is good. Asking it to review its own plan finds very little.

GSD answers the first weakness. Elephant-goldfish (EGM) answers the second.

- **GSD is the frame.** It turns work into numbered phases, each with written scope, a plan, small tested commits, and a verification report. Any session, on any day, can pick up a phase from its files.
- **EGM is the design check inside the frame.** One agent with deep context writes the design (the elephant). Several agents with no context at all try to break it (the goldfish). We fix what they find before we write code.

A picture that helps: GSD is the building permit process, with drawings, inspections and a sign-off at each stage. EGM is the independent structural engineer who checks the drawings before any concrete is poured.

## What each one is

### GSD: the formal frame

GSD is a set of commands (`/gsd-*`) and a folder convention under `.planning/`.

| Piece | What it is | Why it exists |
|---|---|---|
| Seed (`.planning/seeds/SEED-NNN-*.md`) | An idea written down before it is ready | Ideas stop getting lost in chat |
| Phase (`.planning/phases/<N>-<slug>/`) | One unit of work with a number in the roadmap | Work has an address |
| `<N>-CONTEXT.md` | The owner's scope and rulings | The decisions are locked and visible to every agent |
| `<N>-RESEARCH.md` | Verified facts about the code, each with file and line | The plan is built on what the code does, not on what we assume |
| `<N>-NN-PLAN.md` | Small plans, each buildable and testable alone | An executor agent can finish one in a single session |
| Commits | One small commit per change | Review and revert stay cheap |
| `tests/run-all-<N>.sh` | The phase's own test suite | "Done" has a command that proves it |
| `<N>-REVIEW.md` | Code review findings and the fix status of each | Nothing is fixed silently |
| `<N>-VERIFICATION.md` | Goal checked against the code, plus the items only a human can judge | The owner signs off on a list, not on a feeling |

The entry points you will use: `/gsd-quick` for a small fix, `/gsd-debug` for a bug, `/gsd-plan-phase` and `/gsd-execute-phase` for planned work. We do not edit the repo outside a GSD workflow unless the owner says so.

### EGM: the design check

EGM stands for Elephant-Goldfish Model. It is a plugin with reviewer agents (`egm:*`).

- **The elephant** has all the context: the scope, the code, the history. It reads the real code, verifies every risk, and writes the design. Its rule: every claim about code carries a file path and a line, and every guess is marked as a guess.
- **The goldfish** have no memory of the conversation. Each one gets the design, a reading list, and one job: scope, build readiness, architecture, or code accuracy. They run in parallel and do not read each other.
- **The resolve step.** Every serious finding gets exactly one outcome: fixed in the design, contested with evidence that can be checked, or sent to the owner. A reviewer that failed to run is recorded as "not run", never as "no findings".

Why it works: a reviewer who walks in cold reads only what is on the page. If the page is unclear or wrong, there is no shared context to paper over it.

## The workflow, step by step

| Step | Who | Command or agent | Output |
|---|---|---|---|
| 1. Seed | anyone | write the seed file | `SEED-NNN-*.md` |
| 2. Open the phase | owner + main session | `/gsd-phase --insert <after> "<title>"` | roadmap entry, phase folder |
| 3. Scope and rulings | owner | cards in the main session | `<N>-CONTEXT.md` (locked) |
| 4. Elephant | one deep-context agent | general-purpose agent, briefed with the scope | `<N>-RESEARCH.md`, `<N>-DESIGN.md` |
| 5. Goldfish | four fresh agents in parallel | `egm:egm-zoom-out`, `egm:egm-implementation-readiness`, `egm:egm-design`, `egm:egm-codebase-details` | raw reviews |
| 6. Resolve | elephant again + owner | each Blocker and Major: fixed, contested, or owner | design version 2, `<N>-RESOLUTION.md` |
| 7. Plan | GSD planner | `/gsd-plan-phase <N>` | numbered plans |
| 8. Build | GSD executors | `/gsd-execute-phase <N>` | small commits, tests |
| 9. Review and verify | GSD reviewer and verifier | `/gsd-code-review`, `/gsd-verify-work` | `REVIEW.md`, `VERIFICATION.md` |
| 10. Owner sign-off | owner | answers the human items | sign-off section |
| 11. Merge | main session | pull request to `main` | merged, tests green on the merge |
| 12. Cut | owner | `scripts/release.sh` | a release |

Steps 4 to 6 are EGM. Everything else is GSD. EGM never replaces a GSD step; it sits between scope and plan.

## When to use EGM and when to skip it

Use it when a phase changes behaviour on more than one surface (CLI, Desktop, Cowork), or touches one of three sensitive areas: data leaving the machine (Canon Part 8), who may confirm a claim (Part 9), or the decision gates (Part 11).

Skip it for a small fix through `/gsd-quick`. A one-file change does not need four reviewers.

## A real example: Phase 400.2

The task: let the six thinking-hat personas do their own web research.

- The plan was to reuse research code that another command already had.
- The elephant read that code before designing anything and found three facts: no approval check ran before a web search, text from the user's room could reach a search string, and no production code called it at all.
- Four goldfish then reviewed the design. Their counts of Blockers, Majors and Nits were 1, 7 and 6 (scope), 8, 14 and 6 (build readiness), 1, 15 and 6 (architecture), and 2, 12 and 9 (code accuracy).
- Three of the four independently found the same defect: a failed web search would have been recorded as "ran and found nothing".

None of this had cost a line of code yet. That is the point of the method.

What we have not shown: that the method is faster or cheaper than a plain GSD phase. It costs more agent runs up front. Each phase records its agent runs and findings so we can check this over time.

## Rules that will save you trouble

1. **Owner rulings are locked.** A reviewer or an agent may say "the design fails ruling X". Nobody argues that the ruling is wrong inside the phase. Take that to the owner.
2. **Facts need a file and a line.** "The function checks approval" is not a fact until someone cites where.
3. **Mark guesses as guesses.** We use four labels: PROVEN, UNVERIFIED, ASSUMED, DEFAULT CHOSEN.
4. **Do not let reviewers see each other or the chat.** Their value is that they are independent.
5. **"Not run" is not "passed".** If a reviewer, a test or a search did not run, say so.
6. **`.planning/` is ignored by git.** Use `git add -f` for planning files that must travel, and write a dated handoff in `docs/` when work moves between machines or sessions. Read `docs/OPEN-HANDOFFS.md` before you start.
7. **Work in the dev workspace, on a branch.** Never in the plugin install cache, never directly on `main`.
8. **Sub-agents do not talk to the owner.** Only the main session does. A sub-agent that needs a decision returns `NEEDS_HUMAN: <one question>`.

## Where to read next

- `CLAUDE.md`: the project rules, including the section "GSD with EGM (elephant-goldfish) for design work".
- `docs/MINDRIAN-CANON.md`: the constitution (Parts 3, 6, 7, 8, 9, 11, 12).
- `docs/RELEASE-CEREMONY-RULING-SYSTEM.md`: how a release is cut.
- `.planning/phases/400.2-*/`: a full worked example with scope, research, design, the four raw reviews and the resolution.
