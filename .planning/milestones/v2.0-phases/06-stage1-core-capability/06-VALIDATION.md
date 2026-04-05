---
phase: 6
slug: stage1-core-capability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bash + fixture-based (existing pattern) |
| **Config file** | None — tests use scripts/ directly against fixtures |
| **Quick run command** | `bash scripts/classify-insight tests/fixtures/meeting-artifact.md` |
| **Full suite command** | `bash tests/run-all.sh` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bash scripts/classify-insight tests/fixtures/meeting-artifact.md`
- **After every plan wave:** Run `bash tests/run-all.sh`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | MEET-01 | manual-only | Manual: test paste/file/audio in Claude | N/A | ⬜ pending |
| 06-01-02 | 01 | 1 | MEET-02 | smoke | `bash tests/test-speaker-id.sh` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | MEET-03 | unit | `bash tests/test-segment-classify.sh` | ❌ W0 | ⬜ pending |
| 06-01-04 | 01 | 1 | MEET-04 | unit | `bash scripts/classify-insight tests/fixtures/meeting-artifact.md` | ❌ W0 | ⬜ pending |
| 06-01-05 | 01 | 1 | MEET-05 | manual-only | Manual: test confirm-then-file in Claude | N/A | ⬜ pending |
| 06-01-06 | 01 | 1 | MEET-06 | unit | `bash tests/test-meeting-frontmatter.sh` | ❌ W0 | ⬜ pending |
| 06-01-07 | 01 | 1 | MEET-07 | smoke | `bash tests/test-meeting-summary.sh` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | MEET-08 | integration | `bash scripts/transcribe-audio tests/fixtures/sample.wav` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | MEET-09 | integration | `bash tests/test-velma-diarization.sh` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/run-all.sh` — test runner that executes all test scripts
- [ ] `tests/fixtures/sample-transcript-zoom.txt` — sample Zoom transcript with speaker labels
- [ ] `tests/fixtures/sample-transcript-teams.txt` — sample Teams transcript
- [ ] `tests/fixtures/meeting-artifact.md` — sample filed meeting artifact with full provenance frontmatter
- [ ] `tests/test-speaker-id.sh` — validates speaker identification from labeled text
- [ ] `tests/test-segment-classify.sh` — validates segment type classification
- [ ] `tests/test-meeting-frontmatter.sh` — validates YAML frontmatter fields present
- [ ] `tests/test-meeting-summary.sh` — validates summary structure (narrative + structured sections)
- [ ] `tests/fixtures/sample.wav` — short audio sample for Velma API tests (or mock)
- [ ] `tests/test-velma-diarization.sh` — validates Velma output includes timestamps + speaker labels
- [ ] `scripts/transcribe-audio` — Velma API wrapper script
- [ ] `scripts/create-speaker-profile` — ICM nested folder profile creation script

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Three input modes (paste/file/audio) | MEET-01 | Requires Claude conversation interaction | Run `/file-meeting`, paste text, verify flow. Run `--file path`, verify. Run `--audio file`, verify. |
| Confirm-then-file UX with rejection | MEET-05 | Interactive conversation flow | File a meeting, reject at least one segment with each rejection reason. Verify rejection captured. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
