---
id: SEED-113
title: "Shell sidebar (room components, Back to all rooms) and an in-shell chat routed through headless claude -p"
status: seeded
filed: 2026-10-03
source: navigator, mid-execution of Phase 369 (mockup review)
promotes_to: Phase 369 v2 scope, or a new UI phase after 369 closes
supersedes_in_part: 369-CONTEXT D-08 (review-and-decision v1 scope), D-10 (tabs by task, Rooms in the header), 369-ADAPTER-RULING (A1 = room-proposal)
---

# SEED-113: Shell sidebar and chat

## What the navigator asked (2026-10-03, verbatim)

"dont we have a chat interface ? a side bar with all room compnents and all rooms if preessing pack ?"

Card answers, same session:
- Shell layout: "Sidebar and chat now" (over "Sidebar now, chat in v2", "Mock both first", "Keep the plan as is").
- Chat route: "Headless claude -p" (over "Research both, then decide", "Relay to open session").
- Then: "dont pause ! seed it for later . proceed with you work for now !"

So the ruling is recorded here and NOT applied to the running Phase 369 execution. Plans 19 to 32 run as planned (D-08, D-10, D-14 room-proposal) and this seed is the follow-on.

## What it asks for

1. **Left sidebar.** The bound room's components (its sections: evidence, decisions, deliverables, opportunity bank, meetings, and so on, as the room's ICM Layer 0 lists them), each with its entry count and its tile mark plus written status. A **Back** control at the top collapses the sidebar into the list of ALL rooms on this machine (the room_list surface), so Rooms stops being a header dropdown and becomes the sidebar's parent level. The four task tabs (Work / Evidence / Decisions / Deliverables) stay as the dominant region; the sidebar is the structural map beside them.
2. **Chat panel.** A conversation surface inside the shell where the person talks to Larry about the room they are looking at. Selected context (the open item, the open decision) travels with the message. A reply that proposes a claim or a decision lands as a Shape F gate on the browser session, exactly as the rest of the shell does it; the chat never approves anything.
3. **Route: headless `claude -p`.** The shell server spawns the user's own Claude Code per message, under the user's login, with the MindrianOS MCP server attached on the adapter's own read-only session, write tools excluded, hooks and plugins off, a JSON schema on the reply, a timeout. This is RESEARCH Pattern 11 and 369-14's option "headless-claude", which the navigator declined on 2026-10-03 for the adapter and chose here for chat.

## What has to be true before it is built

- **A1, the terms check.** Whether Anthropic's commercial terms allow a local app to drive the user's own Claude Code non-interactively has NOT been checked (2026-09-20 localhost review line 87 asks for it; 369-RESEARCH Assumptions Log A1 is LOW confidence). The navigator picked headless without confirming the check was done. The promoting phase runs the check first and records the answer; if the terms forbid it, the chat falls back to "Relay to open session" (messages land in the room, Larry answers from the person's open Claude Code session).
- **SEED-067 holds.** No second model key, no subscription passthrough. Headless `claude -p` uses the person's own login on their own machine; nothing else.
- **Canon Part 9 holds.** The chat is an agent operating MindrianOS. Only a person approves; the human-only nonce (plan 21) and the gate on the browser session are unchanged.
- **D-08 reopens.** v1 was ruled review-and-decision; a chat is the first piece of the executable loop. The promoting phase states what moves from v2 into v1 and what stays.
- **The plan-14 adapter is reused, not replaced.** `roomProposalSource` keeps working for proposals Larry files from a CLI session; `headlessClaudeProposalSource` (the branch 369-14 did not build: `tests/fixtures/369/fake-claude.cjs`, `buildArgv`) is built here, behind the same `ProposalSource` contract.

## Costs the navigator should see before the promoting phase plans

- Each chat message costs the person's own Claude Code usage.
- Spawn latency per message is unmeasured; spike it before committing to a conversational feel.
- The bake-off (plan 18) was judged without a chat panel or a sidebar; the chassis choice may need a re-check against the extra surface.

## Mockup

The Phase 369 mockup canvas (claude.ai artifact "MindrianOS Shell Mockup", 2026-10-03) shows the four v1 screens without a sidebar or chat. The promoting phase adds two artboards: the sidebar in both levels (room components; Back to all rooms) and the chat panel with a proposal landing as a gate.

## Not done here

No code, no plan change, no CONTEXT edit. Phase 369 runs to its close on D-08 / D-10 / room-proposal as ruled on 2026-10-02 and 2026-10-03.
