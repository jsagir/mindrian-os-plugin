# CTX-03 live before/after result - 2026-08-10 (executed via fresh processes)

**Verdict: PASS on the dev-repo code; BEFORE-behavior reconfirmed on the shipped beta.13 surface.**

## BEFORE leg (shipped beta.13 cache, fresh headless claude -p session, plugin-scope tools)
- room_bind mindrianOS returned only {ok,bound,primary,source} - no effective/resolved_dir/reason
- room_state_bound followed the GLOBAL active room (jonathan-sagir decoy), ignoring the binding
- room_bind no-such-room-xyz "succeeded" with no disk validation
Exactly the RCA's documented dishonest before-behavior, reproduced on the shipped surface.

## AFTER leg (dev-repo bin/mindrian-mcp-server.cjs, fresh process, one stdio session, SEQUENCED)
- room_bind mindrianOS -> ok:true, effective:true, resolved_dir /home/jsagi/MindrianRooms/mindrianOS, resolved_source session.primary
- room_state_bound -> /home/jsagi/MindrianRooms/mindrianOS (follows the BINDING while reg.active held the decoy)
- rebind jonathan-sagir -> read follows (first-bind-remnant case dead)
- room_bind no-such-room-xyz -> effective:false, reason room_not_on_disk, resolved_source reg.active (honest fallback disclosure)

Method note: an initial concurrent probe raced (reads answered before binds completed);
the sequenced re-run is the evidentiary leg. Desktop/Cowork surface-equivalents were
already proven scripted-green in 248-02 Task 2; real-host confirmation remains deferred
to release pickup per the fix-not-live-until-released rule.
