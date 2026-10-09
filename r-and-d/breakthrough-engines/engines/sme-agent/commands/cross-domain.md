---
name: cross-domain
description: Find breakthrough ways to look at a problem by structure-mapping it against far-domain analogues
argument-hint: "<problem statement> [--local <path>] [--rules AN|LS|MA] [--known <file>]"
allowed-tools: Read, Write, Bash, Glob, Grep, WebSearch, WebFetch, Agent
---

Run the structure-mapping research agent on: $ARGUMENTS

1. Spawn `structure-mapping-research-agent` with the problem, the `--local` paths as the local material, and the rules.
2. It encodes the target, finds and encodes far-domain bases, maps each with `lib/sme_cli.py`, tests candidate inferences, and returns ranked reframes.
3. Present the reframes as the agent formats them. Do not add implementation steps.
