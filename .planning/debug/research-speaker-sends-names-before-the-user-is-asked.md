---
status: fixing
kind: rca
trigger: "research-speaker-sends-names-before-the-user-is-asked"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-11-06T14:00:00Z
updated: 2026-11-06T14:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` working tree of /home/jsagi/dev/MindrianOS-Plugin-release, after commit 0e5fc4523 (Phase 386 plan 24)
- **WIRE claims probe against:** none. A stub `curl` first on PATH logged each call and exited 1. 0 requests left the machine. The fixture room and the speaker are synthetic and live in a scratch directory (Canon Part 8).
- **Date of audit:** 2026-11-06
- **Re-verification rule:** code is cited by symbol or section name. Phases 384 and 385 edit nearby files.

## Current Focus

hypothesis: scripts/research-speaker builds 3 web searches from a person name and room words and sends them with curl as soon as it runs. The command asks the user only before the PROFILE.md write, which comes after the send. The --apply step runs the same searches again.
test: Run the script on a synthetic room with a stub curl. Count calls. Check the URLs for the synthetic name and context word. Run again with --apply.
expecting: 3 calls on a plain run and 3 more with --apply.
next_action: Pin the test (RED), then add the list mode, the token check, the credential check and the audit record.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Reported by: EGRESS-CLAIMS-CHECK.md claim (h) and the owner decision of 2026-11-06 (card answer "Extend the ruling")
- Date first observed: 2026-11-06
- Related debug sessions: web-paths-no-approval-or-audit-record (plan 386-22, the shared gate)

## Problem Statement

research-speaker sends a person name together with the venture context to Google before anyone asks the user. The 2026-10-05 ruling names the research lines only. The order of ask versus send was never checked.

## Symptoms

- A plain run makes 3 curl calls at once.
- The command text (Post-Pipeline: Proactive Speaker Research) runs the script in step 2 and asks the user in step 4. The question covers only the PROFILE.md write.
- --apply runs the 3 searches again, although the apply branch does not use their results.
- No audit record is written. No credential check runs on the context.

## Scope and Impact

- Surfaces: CLI, Desktop and Cowork, wherever the file-meeting command runs.
- Impact: a person name and the venture words leave the machine before the user decides.
- Not a Brain line. The owner decision of 2026-11-06 applies: ask before anything is sent, then a credential check, plus the audit record. No content scan.

## Eliminated

- A Brain call: the script uses curl to www.google.com only. PROVEN by reading the script.
- The apply branch using search results: it writes only the research status, the date and the project context text. PROVEN by reading the branch.

## Evidence

Query construction (PROVEN, read from the script):

- QUERY1 is the display name in quotes plus the STATE.md domain, or the project context when no domain exists.
- QUERY2 is the display name in quotes plus the role from PROFILE.md plus the words "linkedin OR crunchbase OR twitter".
- QUERY3 is the display name in quotes plus up to 5 unique words from the project context and the domain.
- The first curl runs in the loop right after the 3 strings are built. No prompt, no flag and no token comes before it.

Reproduction with a stub curl on a synthetic room (PROVEN, 2026-11-06):

- Plain run: 3 curl calls. The synthetic name is in 3 of 3 URLs. The synthetic context word is in 2 of 3 URLs.
- Run with --apply: 3 curl calls again, then PROFILE.md changed to research_status: complete.
- Audit file written: none (no .mindrian directory).

Order of ask versus send in commands/file-meeting.md (PROVEN): step 2 runs the script (send). Step 3 shows the findings. Step 4 asks the user before the PROFILE.md write. Step 5 runs --apply (send again). The question comes after the first send.

## Technical Root Cause

The 2026-10-05 gate (an approval card first, a credential check, the audit record) was never applied to this bash script. The script has no step that lists the strings, no token check, no credential check and no audit call. The command text puts the only question after the send. The apply branch sits after the curl loop, so it repeats the send although it does not use the results.

## Required Code Changes

1. scripts/research-speaker: add --list-queries and --approve TOKEN. Build the 3 strings before any send. Print them and the token in list mode (exit 0, no curl). Without a matching token print that approval is needed and that nothing was sent (exit 0). With a token run the credential check (refuse on a hit), send, then record each search with provider google_search. Use lib/core/web-path-gate.cjs through its CLI. If node is missing, send nothing and say so. --apply needs the same token. The apply branch does not use search results, so it sends nothing.
2. commands/file-meeting.md: list the searches first, ask the user, send only after yes, pass the token on --apply. The added step sits between marker comments and does not use the word grant.

## Tests to Add or Update

- tests/test-386-research-speaker-approval.cjs, arms RS1 to RS9 (stub curl on PATH).
- Existing suites that cover research-speaker or file-meeting: run and record.

## Non-Code Follow-ups

- On resolve (plan 386-21): move this file to `.planning/debug/resolved/` and add the knowledge-base block.

## Resolution

root_cause: see Technical Root Cause.
fix: not started.
verification: reproduction only.
files_changed: none
commits: none
