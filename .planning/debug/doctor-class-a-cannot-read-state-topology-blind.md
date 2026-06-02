---
kind: rca
slug: doctor-class-a-cannot-read-state-topology-blind
status: resolved
severity: low
surface: install-health (doctor class A + post-update activator)
filed: 2026-06-02
filed_by: v1.13.0 dogfood-update session
observed_on:
  - v1.13.0 (live dogfood box, after claude plugin update beta.39 -> 1.13.0)
---

# RCA: doctor class-A "cannot read state" + post-update activator topology-blind

## Summary
On a healthy marketplace-cache install, `/mos:doctor --fix` reported
`install-cache ⚠ cannot read state -- install dir does not exist:
~/.claude/plugins/mindrian-os`, and `doctor --fix --post-update` reported
`⚠ activation failed: doctor exit 0`. Both are FALSE: the install is healthy
(Claude Code loads the plugin from the cache version dir recorded in
installed_plugins.json; the legacy ~/.claude/plugins/mindrian-os/ dir is
CORRECTLY absent under marketplace-cache topology).

## Root cause
`scripts/doctor.cjs` `checkInstallVersion()` returned `{status:'missing'}` when
the legacy `INSTALL_DIR` was absent, with no topology awareness. The beta.39
class-A fix made the install-missing DRIFT branch topology-aware (suppressing the
false SessionStart banner), but the cannot-read-state WARNING branch was not
covered. The post-update activator (`scripts/post-update-activation.cjs`) reads
the doctor install report; with `install.version` undefined it failed its
`report.install.version === stagingVersion` check and reported "activation
failed: doctor exit 0".

Same topology-blind family as the beta.39 class-A fix and the earlier class-A
SessionStart banner false-positive.

## Fix (resolved 2026-06-02)
`checkInstallVersion()` is now topology-aware: when `INSTALL_DIR` is absent it
calls `resolveActivePluginRoot()`, and under `topology === 'marketplace-cache'`
reads the ACTIVE cache root's `plugin.json`, returning `{status:'ok', version}`.
A healthy marketplace-cache install now reports `install-cache ✓ healthy
(<version>)`, and the activator (reading the same report) reports `✓ already on
latest`. One fix resolves both surfaces.

Regression: `tests/test-doctor-class-a-topology-drift.cjs` Test a.4 asserts the
human-readable doctor reports install-cache healthy (no "cannot read state") and
the post-update activator exits 0 (no "activation failed") under marketplace-cache
topology. a.1/a.2/a.3 preserved (non-marketplace-cache install-missing drift still
fires). Verified live on the dogfood box (doctor 2 healthy / 0 drift / 0 warnings;
activator "already on latest (1.13.0)"). Ships in v1.13.1.
