---
kind: seed
status: open
severity: high
created: 2026-07-18
canon_parts: [10, 11, 12]
related: [SEED-062 (the engine gap), SEED-063 (OpenCode -- the host-side half of the hybrid this seed argues for), SEED-021 (render hygiene -- 'no card, no picture', the rule this ceiling threatens)]
proving_case: "MCP specification review 2026-07-18. SEP-2260 (Final) makes unsolicited server-to-client requests MUST NOT. includeContext verified dead three ways: by design (never scoped to host chat), by implementation (0 of 9 hosts examined implement it), by trajectory (tagged removedInSpecVersion 2026-07-28). InitializeResult instructions works on Claude Code (2KB cap), Goose, OpenCode, VS Code; dead on Zed (field not deserialized), Cline (declined, PR closed unmerged), Claude Desktop (stored, never read). Sampling supported by roughly two production coding hosts. OpenCode has sampling AND elicitation literally commented out (issues #11948, #23066)."
source: "navigator proposal 2026-07-18: 'maybe we should first make Mindrian MCP services instead of commands and skills.' Navigator subsequently chose the maximal version (persona + proactivity via MCP) and asked for it tested rather than asserted. This seed records the test result."
---

# SEED-065: The MCP ceiling -- persona and proactivity cannot ship over MCP

## What's actually open

The hybrid. Not the maximal version -- that was tested and it fails.

**This seed closes a question rather than opening one.** Re-open only if the MCP spec
adds server-initiated turn interception. Nothing currently proposed does.

## The proposal that was tested

Move all 111 commands and 124 skills into MCP tools, so MindrianOS becomes a pure MCP
service running on any host with no plugin and no forked harness. Total portability,
zero lock-in, no fork to maintain.

## What survives

- **The methodology**, delivered as tools that **return instruction text**. A tool result
  lands in context and the host model enacts it. Our `methodology` router already proves
  this across ~64 commands -- the pattern is shipped, not speculative.
- All data operations: graph, rooms, memory, search.
- Gate rendering via `gate_render` / `gate_answer`.

## What does NOT survive

- **Proactivity is dead.** SEP-2260 (Final) makes unsolicited server-to-client requests
  `MUST NOT`. Every server notification is swallowed by the client before it reaches the
  model. Our own product claim is that MindrianOS *"proactively surfaces gaps,
  contradictions, and convergence signals"* -- that lives entirely in the 84 hook entries
  and has no MCP expression.
- **The Stop gate is architecturally impossible.** No mechanism exists, none is proposed,
  it is outside MCP's scope. This directly threatens SEED-021's "no card, no picture."
- **Persona is ~50/50 portable.** The InitializeResult `instructions` field works on
  Claude Code (2KB cap), Goose, OpenCode, VS Code. Dead on Zed (field not even
  deserialized), Cline (explicitly declined, PR closed unmerged), Claude Desktop
  (stored, never read). Cursor probably not. **Maintainers disclaim the guarantee in
  writing.**
- **Sampling cannot rescue it.** Supported by roughly two production coding hosts,
  deprecated, and `includeContext` is dead three ways over: by design (only ever scoped
  to MCP-server context, never the host's chat), by implementation (0 of 9 hosts examined
  implement it; the reference `modelcontextprotocol/servers` repo has zero occurrences),
  and by trajectory (`removedInSpecVersion: 2026-07-28`). **A server can never see the
  conversation it would need to be proactive about.** A server sending `"thisServer"` or
  `"allServers"` today gets silent discard on every host tested.
- **Elicitation is the one server-initiated primitive worth building on** -- Claude Code,
  VS Code, Goose, probably Cursor. **But OpenCode has it commented out** (issue #23066),
  which matters given SEED-063.

## The one-line version

**MCP is pull-only. MindrianOS is substantially push.**

Pure MCP yields an excellent, universally portable **tool library**. It cannot yield
Larry. On Cursor, Zed and Cline the product degrades to tools without the teaching layer.

## What to build instead -- the hybrid

1. Ship the methodology as **portable MCP tools**. Runs everywhere, zero lock-in,
   degrades gracefully on hosts we do not control.
2. Keep the teaching layer **host-side** in a forked harness (SEED-063).
3. **Duplicate persona into tool descriptions.** Every host reads those without
   exception -- it is the only universally honoured persona channel, and it is why tool
   descriptions should be written as instructions, not labels.
4. Accept that proactivity and the Stop gate require host-side code, and that this is a
   permanent architectural fact, not a temporary gap.

## Do NOT

- Plan a pure-MCP product and discover this at integration time.
- Rely on `sampling` for anything load-bearing.
- Assume the `instructions` field will be honoured -- verify per host, and always
  duplicate into tool descriptions as the fallback.
