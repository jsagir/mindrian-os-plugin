---
task: 261019-fhe
status: executing
canon_parts: [3, 7, 8, 9, 11]
---
# Room-first GPT plugin entry

User intent: invoking MindrianOS should first open existing local rooms through
the harness, so room context and memory precede later command/Theo work.

1. Attach an embedded room picker to existing room_list. On explicit selection,
   call room_bind without a caller-generated session override, verify effective
   binding, load context_assemble, then read the matching room-dashboard.
2. Fix room-dashboard's omitted room_path case to use the shared per-session
   room resolver. Preserve explicit contained-path reads and legacy unbound
   fallback. Label the actual binding on the snapshot.
3. Update startup instructions and the room-list description to choose, bind,
   recall and open. Preserve the frozen Part 8 and Theo paragraphs; regenerate
   the runtime manifest. Add structured binding output without removing legacy
   text, so the UI need not parse JSON mixed with a startup briefing.
4. Verify with a real fresh GPT-identified client and two synthetic rooms:
   choose the non-boot room, recall its memory, display its content, reconnect
   and recover a saved decision. Browser-test call ordering, refusals, empty
   room lists and host continuation through the actual MCP Apps SDK.

No new room-creation path, no filesystem migration, no second resolver or gate
executor, no raw room content to Theo, and no release/account connection change.
