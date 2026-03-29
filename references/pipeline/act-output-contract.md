# Autonomous Engine Output Contract

*Loaded by `/mos:act` chain mode and `agents/framework-runner.md`*

---

## Purpose

When `/mos:act --chain` runs multiple frameworks in sequence, each framework's output must be structured so the next framework can consume it as input. This contract defines that structure.

## Output Format

Every framework-runner invocation produces this structured output after filing artifacts:

```yaml
framework: {name}
chain_position: {N} of {total}
venture_stage: {stage from STATE.md}
problem_type: {definition_level}/{complexity}

key_findings:
  - {finding 1}
  - {finding 2}
  - {finding 3}

claims_filed:
  - section: {room section}
    file: {filename}
    type: {insight|analysis|recommendation|assumption}

open_questions:
  - {question the next framework should address}
  - {gap or tension surfaced}

chain_forward:
  focus: {what the next framework should concentrate on}
  context: {1-2 sentence summary of what was learned}
  constraints: {any boundaries or assumptions to carry forward}
```

## Chain Input Rules

When a framework-runner receives chain input from a previous framework:

1. **key_findings** become the starting context -- acknowledge them, do not re-derive
2. **open_questions** become the framework's primary focus areas
3. **chain_forward.focus** overrides the default methodology entry point
4. **claims_filed** provide cross-references for the new framework's artifacts

## Chain Selection Logic

When `/mos:act --chain` selects 3-5 frameworks:

1. First framework addresses the room's weakest section or most pressing gap
2. Each subsequent framework builds on the previous -- never redundant
3. The sequence follows natural methodology progression:
   - Exploration (beautiful-question, explore-domains, map-unknowns)
   - Analysis (root-cause, analyze-systems, find-bottlenecks)
   - Synthesis (structure-argument, build-thesis, systems-thinking)
   - Validation (challenge-assumptions, validate, think-hats)
4. Brain graph `FEEDS_INTO` relationships guide the chain when available
5. Local fallback uses the progression above as default ordering

## Dry-Run Format

When `/mos:act --dry-run` previews the execution plan:

```
[ACT] Execution Plan
     Room: {room name}
     Stage: {venture stage}
     Problem: {definition}/{complexity}

     Step 1: {framework-name}
             Why: {1-line reasoning}
             Target: room/{section}/
             Est: {time estimate}

     Step 2: {framework-name}
             Why: {1-line reasoning from chain_forward}
             Input: Step 1 findings
             Target: room/{section}/
             Est: {time estimate}

     ...

     Total: {N} frameworks, ~{total time} estimated
```
