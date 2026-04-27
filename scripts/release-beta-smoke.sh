#!/usr/bin/env bash
#
# release-beta-smoke.sh
#
# Pre-tag smoke harness for beta releases. Runs AFTER Task 6a (release commit
# lands) and BEFORE Task 6b (annotated tag is created). Clones the repo from
# HEAD into a temp dir, asserts cloned files reflect the v1.11.0-beta.1
# committed state, then prints interactive smoke steps for the executor to
# run in a fresh `claude` CLI session.
#
# On all mechanical checks passing, the harness writes the literal marker
# `SC5_MECHANICAL_PASS` into 89.6-VERIFICATION.md SC5. Task 6b's gate greps
# for this exact marker as the false-positive-resistant check (the previous
# gate grepped for "Phase Gate" + "VERDICT", both of which appear in the
# blank scaffold prose and would have passed against an empty file).
#
# Reference: .planning/phases/89.6-release-gate-beta-1/89.6-CONTEXT.md (Area
# 3: Smoke Test Scope; Area 4 Q4: commit -> smoke -> tag ordering Option A);
# .claude/includes/release-process.md (§How Users Actually Receive Updates).
#
# Exit codes:
#   0 — mechanical checks pass; SC5_MECHANICAL_PASS marker written
#   1 — preflight refused, version mismatch in clone, missing artifacts, or
#       HEAD not the release commit (Task 6a not yet run)
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERIFY_FILE="$REPO_ROOT/.planning/phases/89.6-release-gate-beta-1/89.6-VERIFICATION.md"
EXPECTED_VERSION="1.11.0-beta.1"

echo "[smoke] v${EXPECTED_VERSION} pre-tag smoke. Source: $REPO_ROOT (HEAD = $(git -C "$REPO_ROOT" rev-parse --short HEAD))"

# Step 1: preflight precondition.
if ! bash "$REPO_ROOT/scripts/release-beta-preflight.sh"; then
  echo "[smoke] preflight refused; aborting" >&2
  exit 1
fi

# Step 2: assert HEAD is the release commit (Task 6a must have run).
SUBJECT="$(git -C "$REPO_ROOT" log -1 --pretty=%s)"
if [[ "$SUBJECT" != release:\ v${EXPECTED_VERSION}* ]]; then
  echo "[smoke] HEAD subject is '$SUBJECT'; expected 'release: v${EXPECTED_VERSION}...'. Run Task 6a first." >&2
  exit 1
fi

# Step 3: temp dir + cleanup trap.
TMPDIR_SMOKE="$(mktemp -d -t mos-beta-smoke-XXXXXX)"
trap 'rm -rf "$TMPDIR_SMOKE"' EXIT
echo "[smoke] temp dir: $TMPDIR_SMOKE"

# Step 4: fresh clone from REPO_ROOT HEAD.
(
  cd "$TMPDIR_SMOKE"
  git clone --quiet "$REPO_ROOT" mos-clone
)
CLONE_DIR="$TMPDIR_SMOKE/mos-clone"
echo "[smoke] cloned $REPO_ROOT into $CLONE_DIR"

# Step 5: assert cloned plugin.json + package.json versions.
CLONE_PLUGIN_V="$(jq -r .version "$CLONE_DIR/.claude-plugin/plugin.json")"
CLONE_PKG_V="$(jq -r .version "$CLONE_DIR/package.json")"
if [[ "$CLONE_PLUGIN_V" != "$EXPECTED_VERSION" ]]; then
  echo "[smoke] cloned plugin.json version mismatch (expected $EXPECTED_VERSION, got $CLONE_PLUGIN_V); did Task 6a run?" >&2
  exit 1
fi
if [[ "$CLONE_PKG_V" != "$EXPECTED_VERSION" ]]; then
  echo "[smoke] cloned package.json version mismatch (expected $EXPECTED_VERSION, got $CLONE_PKG_V); did Task 6a run?" >&2
  exit 1
fi
echo "[smoke] cloned plugin.json version: $CLONE_PLUGIN_V"
echo "[smoke] cloned package.json version: $CLONE_PKG_V"

# Step 6: run preflight inside the clone.
if ! (cd "$CLONE_DIR" && test -x scripts/release-beta-preflight.sh && bash scripts/release-beta-preflight.sh); then
  echo "[smoke] cloned preflight refused" >&2
  exit 1
fi

# Step 7: confirm 4 RS commands exist in the clone.
for cmd in rs-fetch rs-thesis rs-experts rs-explain; do
  if [[ ! -f "$CLONE_DIR/commands/${cmd}.md" ]]; then
    echo "[smoke] missing commands/${cmd}.md in clone" >&2
    exit 1
  fi
done
echo "[smoke] 4 RS commands present in clone (rs-fetch, rs-thesis, rs-experts, rs-explain)"

# Step 8: confirm orchestrator exists in the clone.
if [[ ! -f "$CLONE_DIR/scripts/rs-discovery-engine.cjs" ]]; then
  echo "[smoke] missing scripts/rs-discovery-engine.cjs in clone" >&2
  exit 1
fi
echo "[smoke] rs-discovery-engine.cjs present in clone"

# Step 9: confirm CHANGELOG entry in clone.
if ! head -100 "$CLONE_DIR/CHANGELOG.md" | grep -qE '^## \[1\.11\.0-beta\.1\] - 2026-04-27$'; then
  echo "[smoke] CHANGELOG.md beta.1 entry missing in clone" >&2
  exit 1
fi
echo "[smoke] CHANGELOG.md ## [1.11.0-beta.1] - 2026-04-27 entry present in clone"

# Step 10: print interactive checklist for executor.
cat <<EOF

=== MANUAL SMOKE STEPS (run in a fresh claude CLI session in $TMPDIR_SMOKE/scratch-room) ===
Step 1: mkdir -p "$TMPDIR_SMOKE/scratch-room" && cd "$TMPDIR_SMOKE/scratch-room"
Step 2: claude plugin install file://$CLONE_DIR
        (Pre-tag, the v1.11.0-beta.1 marketplace ref does not exist yet.
         Installing from the local clone is the closest pre-tag approximation
         of fresh install, and the clone now reflects the committed v1.11.0-beta.1 state.)
Step 3: /mos:rs-fetch "CAR-T cell therapy"
Step 4: Verify the transcript:
          - Process exits 0
          - Output contains the literal substring "Phase Gate"
          - Output contains at least 1 verdict line (lines starting with VERDICT: or matching ^- VERDICT)
Step 5: Paste the full transcript into .planning/phases/89.6-release-gate-beta-1/89.6-VERIFICATION.md
        under the SC5 "Smoke transcript" code block.
Step 6: Write the literal token \`SC5_MECHANICAL_PASS\` into the SC5 "Marker (filled on smoke pass)"
        block. Task 6b's gate greps for this exact token.
=== END MANUAL SMOKE STEPS ===
EOF

# Step 11: report current marketplace state (for Task 8 reference).
if [[ -f "$HOME/mindrian-marketplace/.claude-plugin/marketplace.json" ]]; then
  CURRENT_REF="$(jq -r '.plugins[0].source.ref' "$HOME/mindrian-marketplace/.claude-plugin/marketplace.json")"
  echo "[smoke] marketplace currently pinned to: $CURRENT_REF"
fi

# Step 12: write SC5_MECHANICAL_PASS marker into VERIFICATION.md.
if [[ -f "$VERIFY_FILE" ]]; then
  printf '\n\nSC5_MECHANICAL_PASS (written by scripts/release-beta-smoke.sh on %s)\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$VERIFY_FILE"
  echo "[smoke] wrote SC5_MECHANICAL_PASS marker to $VERIFY_FILE"
else
  echo "[smoke] WARN: VERIFICATION.md not found at $VERIFY_FILE — executor MUST paste SC5_MECHANICAL_PASS manually into the SC5 marker block before Task 6b" >&2
fi

echo "[smoke] mechanical checks passed. SC5_MECHANICAL_PASS marker written. Run interactive steps above, paste transcript, then proceed to Task 6b (annotated tag)."
exit 0
