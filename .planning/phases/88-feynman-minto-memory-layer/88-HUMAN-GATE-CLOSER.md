# Phase 88 Human-Gate Closer (88-H1 + 88-H2)

Staged 2026-06-11 from the human-gate harvest: Phase 88 is the CLOSEST human_needed phase to closing. Live beta.34 evidence (room-side, via .umbilical: faculty tester session 2026-05-25) already proves the memory layer works cross-session and cross-room in real use; what remains is the scripted acceptance sequence and one timing run.

## 88-H1: Session A defer -> Session B reference (live two-session acceptance)

Setup: a real room (use the mindrianOS dog-food room or a scratch room registered in ~/MindrianRooms), current build, CLI.

1. SESSION A: in a live claude session, raise a decision and explicitly DEFER it (Decision Gate verb 9, or "let's defer this until next time" in conversation). Confirm the on-stop hook wrote it: check the room's memory artifacts / .room-graph for the defer record after session end.
2. SESSION B (new session, same room, after full session close): start cold. PASS = Larry references the deferred item unprompted in the greeting/first turns, OR surfaces it via the tension/defer resurface path at SessionStart. Capture the transcript excerpt.
3. Evidence: file the two-session transcript excerpts as a room artifact (sub-rooms/qa/ or product-evolution/), build-version tagged; cite it in 88-VERIFICATION.md and flip 88-H1.

Pass criteria source: Phase 88 VERIFICATION human_needed item (live on-stop hook write + session-start read against a real room).

## 88-H2: memory snapshot timing in a quiet environment

The flake: memory snapshot test 5 has a 1500ms budget; measured 4045ms under WSL2 fs pressure. Disambiguate budget-too-tight vs genuinely-slow:

1. Quiet env: close heavy processes; run on native Linux fs (not /mnt/c), no parallel test load.
2. Run the Phase 88 memory snapshot suite 10x; record the test-5 distribution.
3. Verdict: if p95 < 1500ms quiet -> environmental flake; annotate the test with the WSL2 caveat and close. If p95 >= 1500ms -> real regression; open a debug session instead of closing.

## Closure

Both items verdicted -> update 88-VERIFICATION.md status from human_needed to passed (or open the follow-up), citing this file + the room artifact. Per the harvest rule: every citation carries the build version it was observed on.
