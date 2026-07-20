---
kind: seed
status: open
severity: low
created: 2026-07-18
canon_parts: [8, 11]
related: [SEED-063 (OpenCode -- the recommendation this seed loses to), SEED-062 (the engine gap)]
proving_case: "Primary-source verification 2026-07-18 of github.com/xai-org/grok-build. LICENSE reads 'Copyright 2023-2026 SpaceXAI / Apache License Version 2.0' -- OSI-approved, no field-of-use restriction, no NOTICE, no TRADEMARK.md. 18.4k stars. Open-sourced 2026-07-15/16 as a SINGLE squashed commit authored by grokkybara[bot], zero human commit history, no releases. CONTRIBUTING.md: 'This repository does not accept external pull requests.'"
source: "navigator asked for research on xai-org/grok-build 2026-07-18. It scored best on hooks and worst on governance; SEED-063's resolution of the Stop-hook question neutralised its one decisive advantage."
---

# SEED-064: Grok Build as host runtime -- runner-up, held in reserve

## What's actually open

Nothing, unless SEED-063 fails. This seed exists so the option is recorded with its
verification intact rather than re-researched later.

**Trigger:** promote only if the OpenCode fork proves unworkable in practice, or if
OpenCode's governance materially degrades (relicense, hosted-Zen coupling, abandonment).

## Why it scored well

- **Apache-2.0**, verified. OSI-approved, not a custom xAI licence. **No acceptable-use
  or field-of-use restriction.** No NOTICE, no TRADEMARK.md -- only the stock Apache §6
  trademark reservation, which permits rebranding.
- A **finished harness** (~844K lines of Rust: TUI + agent loop + tool layer + full
  extension system), not a framework.
- **17 hook events** -- `PreToolUse`, `PostToolUse`, `PostToolUseFailure`,
  `UserPromptSubmit`, `SessionStart`, `SessionEnd`, `Stop`, `StopFailure`,
  `SubagentStart`, `SubagentStop`, `TaskCreated`, `TaskCompleted`, `PreCompact`,
  `PostCompact`, `Notification`, `InstructionsLoaded`, `CwdChanged` -- **with exit code 2
  blocking**, i.e. Claude Code's exact semantics. This is the best hook surface found in
  the entire survey.
- Reads Claude Code marketplaces, plugins, skills, MCPs, agents, hooks, and `CLAUDE.md`
  **with zero configuration**. Reads `.mcp.json`. MCP client on stdio and HTTP.
- Blocking numbered-choice permission panels already exist.
- Headless first-class: `grok -p --output-format json`, named session create/resume.
- `grok agent stdio` (Agent Client Protocol) -- embeddable, satisfies the milestone-2
  detachable-UI requirement.
- Model-agnostic via OpenAI-compatible endpoint redirection (Anthropic, OpenAI, Google,
  local). **Caveat:** this is endpoint redirection, not a native adapter layer; every
  documented Anthropic path routes through a gateway and is under-exercised
  (open bug: CLIProxyAPI #4218).

## Why it is NOT the recommendation

1. **Rust.** Our 236K lines of CJS cannot run in-process. Forces IPC -- workable via our
   existing MCP server, but the one-process architecture is off the table permanently.
2. **The public repo is days old.** One squashed commit plus two "synced from monorepo"
   commits, **all authored by `grokkybara[bot]`. Zero human commit history. Zero
   external contributors. No releases.** A `SOURCE_REV` file confirms a one-way export
   from an internal monorepo.
3. **`CONTRIBUTING.md`: "This repository does not accept external pull requests or
   unsolicited patches."** Every fork is permanent and solo. We would maintain 844K
   lines of Rust alone, forever, with no upstream path for anything we build.
4. **Motive was damage control, not strategy.** Open-sourced after a researcher found
   v0.2.93 uploading entire git repositories -- full commit history -- to a hardcoded
   xAI-controlled GCS bucket (`grok-code-session-traces`). **`upload/gcs.rs` remains in
   the tree, merely disabled.**
5. Relicensing risk is LOW for the snapshot (Apache-2.0 is irrevocable) but
   **MODERATE-HIGH going forward** -- the licence was granted reactively, the mirror is
   one-way, and contributions are refused. xAI can stop syncing at any time.

## The Canon Part 8 contradiction -- state it, do not bury it

MindrianOS's canon exists to guarantee prompt text does not leave the box. Part 8 draws
the graph boundary; the Brain repo's SEED-001 and SEED-002 both carry local-provider-only
constraints for exactly this reason. **The best-fitting harness on features came from the
vendor caught hardcoding an exfiltration bucket.**

That is not automatically disqualifying -- Apache-2.0 is irrevocable, we fork, we excise.
But we of all people do not get to skip that audit.

## If ever promoted, these are gates not tasks

1. Audit and **excise `upload/gcs.rs` and every telemetry path** before any customer
   build. Prove it with a network-egress test in the spirit of the Brain repo's Phase-0
   contract suite.
2. Prove the non-xAI provider path **end-to-end against Anthropic** before committing --
   the abstraction is endpoint redirection and the non-xAI paths are under-exercised.
3. Accept and plan for solo-fork maintenance of a large Rust codebase.
