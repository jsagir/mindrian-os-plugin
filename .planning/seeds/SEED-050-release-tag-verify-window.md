---
seed: SEED-050
slug: release-tag-verify-window-too-tight
title: release.sh Step 5.5 tag-visibility verify races GitHub replication (false-alarm on a good push)
status: captured
created: 2026-07-02
captured_during: v1.15.0 stable release ceremony
canon_parts: [6]
---

# SEED-050: release.sh tag-verify window too tight

## What happened (v1.15.0 release, 2026-07-02)

Step 9 pushed `main` + tag `v1.15.0` successfully (log: `* [new tag] v1.15.0 -> v1.15.0`).
Step 5.5 (verify tag at origin) then polled `git ls-remote --tags origin v1.15.0` with 3 retries
over ~15s and did NOT see the tag, printing a red "tag NOT visible after 3 attempts /
Recovery: git push origin v1.15.0". This was a FALSE ALARM: the tag propagated a moment later
and independent `git ls-remote` confirmed `refs/tags/v1.15.0` present. Every real release action
(npm publish @latest=1.15.0, main push, website deploy serving v1.15.0, marketplace source.ref
v1.15.0) succeeded. The tight verify window may also have caused a non-zero final exit and
skipped the last formality (post-release doctor --acceptance, run manually afterward, all green).

## Fix (Part 6 dog-fooding: the release must not cry wolf on a good push)

- Widen RELEASE_TAG_PUSH_RETRIES / backoff (e.g. 6 retries with exponential backoff to ~60-90s),
  since GitHub tag replication can exceed 15s.
- Treat a still-not-visible tag as a WARNING that does not abort or non-zero the run when the
  local push exit was 0 and `git ls-remote` for main already matches (the push demonstrably
  succeeded). Only escalate if the main push itself failed.
- Ensure Steps 9.8/10/11 (final acceptance, marketplace update, post-verify) still run even if
  5.5 warns, so the ceremony always closes its own boxes.
