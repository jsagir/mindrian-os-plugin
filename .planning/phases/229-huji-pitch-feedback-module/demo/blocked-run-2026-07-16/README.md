# Blocked demo run - 2026-07-16 (DI-4/DI-5 fixed, blocked at DI-6/DI-7)

These are the REAL, verbatim pipeline outputs from the first end-to-end run after
the DI-4 (dual-write) and DI-5 (byte-verbatim extraction) fixes landed. They are
preserved here UNEDITED as diagnostic evidence for the DI-6/DI-7 blockers. They are
NOT the gate-clean deliverable artifacts (the demo did not close out gate-clean), so
they are deliberately NOT named `feedback-sample-1.md` / `feedback-sample-2.md`. No
line of model output was hand-edited, paraphrased, or cleaned up (threat T-229-09-01).

## What this run PROVED (the two fixes work)

- **DI-4 FIXED.** Stage B (opus) now grades REAL pitch content, not an empty-room
  setup finding. Both `*.feedback.RAW.md` are genuine, high-quality, course-tier
  grades that quote the actual pitch. The dual-write populated the section ROOM.md
  files (problem-definition + solution-design), so the grading spine finally read
  populated sections instead of "Awaiting first content".
- **DI-5 FIXED (extraction).** Both `*.evidence.json` preserve the transcript
  disfluencies byte-verbatim: study-app keeps `vali- validating` and
  `surprising-- important`. Stage A no longer cleans speech.

## Why this run is BLOCKED (two NEW bugs, DI-6 + DI-7)

- **safescan-001.feedback.RAW.md - HONEST D1 FAILURE (DI-6).** Stage B packaged two
  quotes as elliptical, non-contiguous spans:
  `"biosensor engineer... a mobile app developer"` and
  `"a safety expert... an operation manager"`. The transcript says
  `biosensor engineer for the device and a mobile app developer` and
  `safety expert for official health certifications and an operation manager`. The
  `...` joins two non-adjacent fragments, so these are not byte-verbatim spans and
  the D1 quote-verifier correctly rejects them. quote-verifier: FAILED (2 misses).
- **study-app-001.feedback.RAW.md - FALSE PASS (DI-7 masks DI-6).** This artifact
  reports quote-verifier PASSED, but the pass is VACUOUS: all 8 of its feedback
  quotes use single quotes (`'...'`), and the D1 extractor (`extractQuotedSpans` in
  `scripts/huji-eval.cjs`) only recognizes double quotes `"..."`, curly quotes, and
  `> ` blockquotes. It extracted ZERO feedback spans, so it checked none of them. And
  one of those unchecked quotes is itself non-verbatim: it renders
  `'...handled by validating materials...'`, dropping the `vali- ` disfluency the
  transcript actually contains (`handled by vali- validating materials`). A real
  non-verbatim quote slipped through the hardest gate silently - the exact
  silently-skipped-gate / false-success failure class we track.

## Bottom line

Neither artifact is genuinely, verifiably gate-clean:
- safescan fails D1 for real (DI-6, elliptical quotes).
- study-app only "passes" because DI-7 let its single-quoted feedback quotes bypass
  D1, and at least one is non-verbatim (DI-6, dropped disfluency).

Fixes and exact repro are in `../../deferred-items.md` (DI-6, DI-7). Nothing was
fabricated or force-passed.
