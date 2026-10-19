---
phase: 371
slug: navigator-startup-ui-first-room-and-returning-workday
status: captured
created: 2026-10-19
canon_parts: [3, 7, 8, 9, 11, 12]
---

# Phase 371 - Navigator startup UI context

## User decisions

- Scope is startup flows only: first-time users and returning navigators.
- Add a focused UI phase rather than change the broader Phase 369 UI shell.
- First-time users can create a room. Returning navigators open an ongoing room,
  load its saved memory, and receive a workday briefing in a new session.
- The built-in room UI works with GPT harnesses and the existing F-shape gates.
  It can hand proposed work back to the conversation. A proposal is not execution.

Source: this chat's startup implementation request and the explicit scope choice
on 2026-10-19. This is a focused capture of those decisions, not a claim that a
separate discuss-phase interview occurred.

## Existing implementation to preserve

Commits ecde228dc and ec3d56380 already implement room-first selection and both
startup flows. The new phase defines and later applies a coherent UI contract
over those operations. Their existing tests are regression evidence, not proof
that the new visual contract is implemented.

- room_list is a picker, never an automatic selection.
- room_create previews the name, purpose and folder. The existing F.0 gate and
  gate_answer approve creation through navigation.birthRoom. Reject/defer creates
  nothing. Durable receipts prevent duplicate creation on replay.
- Effective room_bind -> context_assemble -> room_startup -> room-dashboard is
  the opening sequence. Every response must belong to the selected room.
- room_startup reads local records and persists an idempotent visit checkpoint.
  The F.1 next-move choice appears after the briefing and uses gate_answer.
- The room lives on the configured server's filesystem. Connecting ChatGPT web
  alone does not grant access to a navigator's PC or create account memory.

## Design authority and defaults

The current external brand source is Design Canon v5, adopted as the ruling
design law on 2026-10-13. It supersedes the older v3 reference used by Phase 369.
Use its Figtree/DM Sans voices, role colors, structural space, and human gate.
This phase does not revise Phase 369's contract or the external canon.

The UI researcher may choose standard panel sizing, a constrained type scale,
spacing, accessible controls and recovery copy as explicit contract defaults.
These are implementation choices, not additional user rulings. They do not alter
the room schema, gate authority or execution policy.

## Deferred / outside this phase

- Whole-room editor, graph explorer, autonomous Theo work, command execution,
  authentication, multi-tenant cloud storage, arbitrary filesystem selection,
  schedules, plugin release, and live account installation.
- A guaranteed persistent ChatGPT side panel: the host owns placement and
  lifetime. This contract must work in a narrow embedded panel or inline view.
- A new memory engine, gate dispatcher, session binding mechanism or UI framework.

## Ready for planning

The phase may plan UI work after its UI-SPEC passes review. Implementation and
host verification remain future work; phase completion is not implied by an
approved design contract.

## CIRS relationship

CONSUMES the existing room_list, room_bind, context_assemble, room_create,
room_startup, room-dashboard and gate_answer tools and their declared shapes.
ADDS no invocable command, agent, pipeline, skill or MCP tool and creates no
second gate or execution loop. Visual/recovery changes belong in the existing
room App and its producers. Plans must preserve that relationship.
