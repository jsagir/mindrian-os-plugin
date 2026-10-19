---
task: 261019-fs6
status: complete
canon_parts: [3, 7, 8, 9, 11]
---
# Implement both navigator startup flows

User explicitly authorizes first-room creation and memory/workday startup for
returning navigators. Build on the room-first entry and decision UI already saved.

1. Expose room_create as a preview that mints an F.0 material-step gate in the
   existing ledger. Only gate_answer can execute navigation.birthRoom after
   approval. Restrict destination to a safe, absent child of configured rooms home;
   recheck containment and absence at execution. Reject/defer creates nothing.
   Keep a durable approval anchor inside the birth transaction for safe retries.
   Use argv subprocess invocation for names/paths entering the existing birth.
2. Add room_startup using the existing memory readers, last-session state and
   pending-gate reader. A local SQL-backed visit checkpoint fixes the baseline
   for changes and survives sessions. Idempotent repeated calls within a session
   must not move that baseline. Report no previous checkpoint / missing history
   plainly. No fabricated timestamps, completions or next-step recommendations.
3. Extend the room UI: name/purpose/location preview, F.0 approve/reject/defer,
   successful birth -> bind -> memory -> workday briefing -> room view. Existing
   room startup shows where work stopped, recorded changes, questions and gates;
   F.1 next-move choices continue through the same gate_answer authority.
4. Add born-wired tool/shape declarations and regenerate registries/manifests.
   Test first-user approval/refusal, unsafe/colliding paths, retry/replay, fresh
   session memory/briefing and isolation. Test both flows in a sandboxed browser
   with the actual MCP Apps SDK. Preserve prior plugin tests and fallbacks.

All room data stays local; no automatic Theo request, provider migration,
dependency install, marketplace release or live ChatGPT account change.
