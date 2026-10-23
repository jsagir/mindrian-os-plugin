# 380 real-terminal shots from the navigator (2026-10-24, Windows Terminal, claude 2.1.309, plugin beta.73)
Source: five screenshots in 380-user-shots/. First run of the mod in a real terminal.

## Works
- Panel loads beside the chat. Face, Theo label, quote, Context, WRITES TO, ROOM/FILED/STALE/HEALTH, NOW, NEXT, Job, THEO, VERSION, ASK all show.
- Unbound session says so: "WRITES TO nothing - this session is not bound" plus [ Bind a room ].
- Click on a section or file puts the sentence in the prompt box; Enter sends; the model answered end to end (shot 5).
- Context gauge fills (9% - ok in shot 5). Status parity fields present.

## Gaps (feed plan 380-16)
G1 Contradiction line: "Theo was not asked: the call was not allowed" and "Theo was sent: ..." show together (shots 3, 4). The sent line must clear when the call is denied.
G2 Expanded section list is not capped. A section with 16 files pushes the face, label and header off the top of the pane (shots 3, 4, 5). Cap the list (rows + "+N more") or pin the face.
G3 Sent line garbles a clicked subfolder: "About the '(a name) / ' section" (shot 5). Safe, but reads badly. Say which part was removed.
G4 Job line stayed "no guess yet" after two real prompts (shots 3 to 5). The D-09 JTBD guess never appeared. Check the threshold.
G5 Eight white boxes under the face read as empty boxes while Context is "waiting" (shots 1 to 3). They are the context gauge; label or dim them when idle.
G6 Outside the mod, not diagnosed: "Unknown command: /mos:rooms", "/mos:build-thesis" in the same session (shot 5), and brain_ask denied by auto mode "Classifier unavailable" (shots 3, 4). Unverified cause.
