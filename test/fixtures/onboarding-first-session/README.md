# Phase 106 fixture: first-session-post-install onboarding gate

Purpose: Simulates a clean install where ~/.mindrian/install-onboarding.json
does NOT exist. The onboarding gate must fire once, write the touch-file,
and skip on subsequent runs. Re-fires when installed_version field changes.

Used by:
- tests/test-onboarding-gate.cjs (Plan 106-05)

Hermetic: HOME override redirects writes into a tmp dir per test run.
