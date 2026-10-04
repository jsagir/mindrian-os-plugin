---
id: SEED-120
title: "Live-use product backlog from a 2h23m session (LA with YS, beta.55): Accept does not advance, no visible room/session/run state, transcript export incomplete, blind approvals, no checkpoint/resume at the session limit, undefined terms, no study-ready report, no observer mode"
status: seeded
priority: critical
filed: 2026-10-05
source: "navigator paste 2026-10-05 of a practical extraction over one 2:23:11 live-use conversation between Lawrence Aronhime (LA) and Yehonathan Sagir (YS); transcript evidence only, no code or logs were available to the extractor; filed verbatim below"
routing:
  phase_369_2: [CFG-01, OUT-01, UX-02, UX-03, REC-01, "investigation: starvation", "behaviors to preserve"]
  gate_quick_now: [BUG-01]
  shell_statusline: [UX-01, UI-01]
  export_quick: [BUG-02]
  larry_voice_seed_116: [GEN-01]
  website_track: [ONB-01, PREF-01]
  investigations: ["crash report", "unspecified output problem", "dashboard appears empty", "session continuation"]
---

# SEED-120: what a two-hour live session asked for

## How to read this

The extraction's own conclusion is the frame: the research engine shows value; the user cannot
see or control the STATE around it (which room, what is being approved, whether an action happened,
where output went, how work resumes). State visibility and reliable control first, then output
clarity and recovery. BUG-01 (Accept does nothing; "I accept" typed as a workaround) is the same
event the 2026-10-04 transcript showed from the other side, where "i accept" was then read as a
filing basket (369.2 input, defect 4). It is P0 here and gets a reproduction quick before
anything else. The behaviors-to-preserve list is the regression floor for Phase 369.2.

## Verbatim from the extraction

Source: one 2:23:11 live-use conversation between Lawrence Aronhime (LA) and Yehonathan Sagir (YS)
Scope: software behavior, bugs, usability and recovery
Evidence level: transcript evidence from the live session. Code, telemetry, screenshots and exported files were not available for independent verification.

### Product conclusion

The core research engine shows value. It can choose process steps, create research agents, use prior room context and produce a readable result after additional prompting. The immediate product risk is that the user cannot reliably see or control the state around that engine: what room is active, what is being approved, whether an action occurred, where output was saved and how work resumes after interruption.

The practical priority is therefore state visibility and reliable control, followed by output clarity and recovery.

### Action backlog

| ID | Priority | Work item | Evidence | Definition of done |
|---|---|---|---|---|
| BUG-01 | P0 | Fix the Accept action that does not advance the flow | 49:12-49:18. LA reports that activating Accept goes nowhere; YS uses typed "I accept" as a workaround. | Mouse and keyboard activation submit exactly once; the selected decision is persisted; the UI advances or shows a specific error; an automated test covers the observed gate state. |
| UX-01 | P0 | Show active room, session, task and run state in every working window | 34:48-34:51: neither participant knows which room supplies the context. 55:09: multiple windows cause task disorientation. | A persistent header shows room, session, active task, version and state: idle/running/waiting/blocked/complete. Each window has a distinct visible identity. |
| BUG-02 | P0 | Make transcript export complete and verifiable | 2:02:30-2:03:46: repeated attempts appear too short or incomplete. 2:09:00-2:10:47: file identity and location remain unclear. | Export contains every source message in order; includes source/session ID, timestamp, message count and checksum; completion shows filename and location; repeated export cannot silently overwrite another file. |
| UX-02 | P1 | Explain every approval before the user files or saves an item | 1:09:41-1:10:37: both participants are unsure what the proposed items represent. | Each option shows a preview, item type, destination, effect of approval and default selection. The user can inspect or deselect each item before submission. |
| REC-01 | P1 | Add explicit checkpoint and resume behavior for session limits | 2:19:40-2:22:55: the run reaches 96%, stops at the limit and leaves uncertainty about continuation and work location. | Before cutoff, the system records a checkpoint; the UI states what was saved and what remains; Resume continues from the checkpoint after reset or in a new session; a recovery test proves that completed work and pending work remain distinguishable. |
| GEN-01 | P1 | Define unfamiliar terms at first use and resolve pronouns | 9:33-11:47: recurring undefined concepts and unclear references. 34:25: "student matrix" appears three times without a definition. | New terms receive an inline definition on first use; generated text passes a referent check for pronouns; unknown terms are flagged before delivery; later clarification updates the report or glossary. |
| OUT-01 | P1 | Produce a study-ready report by default | 2:01:36: LA cannot assess the conclusion because the output is not in a format he can study. | Final report includes original question, selected method, steps taken, sources/evidence, findings, assumptions, limitations, conclusion and open questions. It can be exported without additional prompt repair. |
| UX-03 | P1 | Add an observer/learning mode for autonomous work | 2:12:40-2:13:18: the session explicitly proposes that the system explain its work while the human observes. | During a run, the user can see current step, why it was selected, evidence being used, decisions requested and progress. A Feynman-style final explanation is available. |
| UI-01 | P2 | Distinguish an empty room from an incomplete dashboard | 26:39-28:22: a room appears empty or nearly empty; YS describes the UI as an early content connection with little functionality. | Empty, loading, unavailable, not indexed and genuinely empty states have different messages. The UI lists available artifacts and explains unsupported actions. |
| ONB-01 | P2 | Put installation and version status in the primary path | 0:34-1:40: installed version 55 conflicts with an expectation of 59. 6:12-6:50: installation is hidden under Docs. | The site has a primary Install/Update action; the product displays installed, available and session versions; update checks explain why no update is offered. |
| CFG-01 | P2 | Detect missing research-provider configuration before a run | 1:26:48-1:27:40: Tavily is unavailable and Claude web search is supplied manually as fallback. | Preflight identifies unavailable providers before execution; offers supported alternatives; records which provider was used; the run never waits indefinitely for a missing key. |
| PREF-01 | P3 | Standardize narration voice and tone | 7:39-9:17: mixed accents and a tone perceived as condescending; British voice preferred by the users quoted. | Voice and tone are configurable and consistent within one asset; default narration passes a short tone review with target users. |

### Investigations that need evidence before engineering diagnosis

| Investigation | What is known | Evidence required |
|---|---|---|
| Crash report | A crash-bug report was requested and a draft was reported at 52:14-53:20. | The generated report, error text, stack trace, version, command, room/session ID and preceding event sequence. |
| "Starvation" | At 1:50:31-1:51:28 YS asks the system to fix starvation. The affected scheduler, agent or resource is not identified. | Full warning text, run ledger, queued/running agents, budgets, retry history and timestamps. |
| Unspecified output problem | At 59:53 YS says "See a problem there," without enough verbal detail to identify it. | Screenshot or captured output at that timestamp and the expected result. |
| Dashboard appears empty | The dashboard shows a room as empty while LA says he used it for materials. | Room manifest, indexing state, artifact count, API response and UI filtering state. |
| Session continuation | YS says token reset does not erase written content, but the call does not demonstrate a successful resume. | End-to-end limit, reset and resume test across the same session and a new session. |

### Recommended implementation sequence

First 48 hours

1. Reproduce BUG-01 using the exact Accept state and capture the event, persisted decision and transition.
2. Retrieve the crash-report draft and logs from the tested session.
3. Add visible room/session/task/run identifiers to the current surface.
4. Build a transcript-export integrity test using source message count and ordering.
5. Capture a checkpoint immediately before session cutoff and verify a real resume.

Next product increment

1. Replace blind approvals with inspectable approval cards.
2. Add first-use definitions and a generated-text referent check.
3. Make the study-ready report the standard completion artifact.
4. Add observer mode with progress, rationale and Feynman-style explanation.
5. Add provider preflight and automatic fallback selection.

### Workarounds observed in the call

| Situation | Temporary workaround | Limitation |
|---|---|---|
| Accept does not advance | Type "I accept" explicitly | Does not establish that the UI state or decision was persisted correctly. |
| Tavily key is missing | Ask for Claude web search | Provider choice and evidence source remain dependent on manual instruction. |
| Session reaches its limit | Wait for reset, rerun and ask it to continue; alternatively open a clean session | Successful restoration was not demonstrated. |
| Output is hard to learn from | Ask the system to explain while working and use a Feynman report | Requires extra prompting and is not yet a reliable default. |
| Term is unclear | Ask the system to explain itself | LA reports that this usually works, but it creates repeated review work. |

### Behaviors to preserve with regression tests

- The system selected relevant process steps instead of mechanically running every framework step.
- It recognized and used cross-domain analogy in the research process.
- It created groups of agents for research.
- It used information from older rooms in at least one observed run.
- It could produce a readable result after the report format was refined.
- When explicitly asked to explain a term, it usually gave a useful explanation.

### Product acceptance scenario

A user opens one room, starts an autonomous research run and reaches a decision gate. The screen continuously identifies the room, session, task and step. The gate explains the decision and destination. Accept advances exactly once and records the choice. During the run, the user can follow the method and evidence. If a provider is unavailable, the system selects an approved fallback and states it. If the session limit is reached, a checkpoint is saved and Resume continues the pending work. Completion produces a full, study-ready report and a transcript whose message count matches the source.

### Status and ownership

The priorities and suggested functional owners are product recommendations from this extraction:

- Runtime/CLI: BUG-01, REC-01 and provider preflight.
- UI/Product: UX-01, UX-02, UX-03 and UI-01.
- Generation/QA: GEN-01 and OUT-01.
- Docs/Growth: ONB-01 and narration preferences.

No individual accepted these engineering assignments in the source conversation. All items remain proposed until triaged against code, logs and the actual generated artifacts.
