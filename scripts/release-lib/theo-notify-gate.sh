#!/usr/bin/env bash
# scripts/release-lib/theo-notify-gate.sh
#
# WHAT: a sourced library defining `mos_theo_notify_gate`, the LEADING half
# of RULE 5 place 8: it fires a GitHub `repository_dispatch` at
# `jsagir/theo` (event `theo-resync`) immediately after a release tag is
# verified at origin, so Theo hears about a version the moment it ships
# instead of only being able to refuse the NEXT one. See
# docs/RELEASE-CEREMONY-RULING-SYSTEM.md RULE 5 (place 8) and
# docs/THEO-NOTIFY-CONTRACT.md, the durable ruling record this file
# implements against.
#
# WHY: Phase 343 shipped the LAGGING half (scripts/release-lib/theo-stamp-
# gate.sh), which can only refuse a release and never repair the drift it
# catches. The measured drift that motivated it: Theo's own `mappedBy` sat
# at `command-registry@2.0.0-beta.12` against a repo already at
# `2.0.0-beta.40` -- 28 betas of silence, and nothing on the plugin side
# could fail because nothing on the plugin side told Theo anything moved.
# This is the half that repairs that: an event fired the moment a release
# lands, not a check performed the next time one is attempted.
#
# THE FACTS THIS SHAPE IS BUILT AGAINST (measured, dated, no token ever
# printed):
#   - `gh` 2.45.0 authenticated with `repo` scope in the release
#     environment.
#   - `jsagir/theo` is a PRIVATE repository, which is why the `repo` scope
#     is required rather than the narrower `public_repo`.
#   - A successful `repository_dispatch` is a 204 with no response body.
#   - GitHub's `client_payload` caps at ten top-level properties (MEDIUM
#     confidence, WebSearch-corroborated against multiple independent
#     community sources; docs.github.com itself was unreachable to WebFetch
#     at research time -- 349-RESEARCH.md assumption A2). This gate's own
#     four-key payload leaves six of headroom before that cap is touched.
#   - Theo's own `command_neighborhood` tool already returns a per-command
#     `registryHash`, keyed to whatever registry state it last mapped from
#     (measured live 2026-09-15: a real digest returned alongside
#     `mappedBy: "command-registry@2.0.0-beta.12"`). That is why the
#     OUTBOUND hash this file computes is the plugin's own LIVE value, at
#     the tagged commit, and never an echo of a value Theo already holds --
#     echoing back a value Theo already has would tell Theo nothing it did
#     not already know; what Theo cannot know is the registry's state NOW,
#     at the commit it is about to pull, so the plugin sends its own digest
#     and Theo diffs against it (WD-349-4, docs/THEO-NOTIFY-CONTRACT.md
#     Ruling 2).
#
# THE PLACEHOLDER-VERSION TRAP, the single most important constraint this
# file is built against: by the time release.sh reaches this gate's call
# site (Step 5.6, immediately after Step 5.5's tag-at-origin proof and
# before Step 9.8), an earlier release step has ALREADY rewritten the
# plugin's own on-disk manifest to the next beta's dev placeholder version.
# This file NEVER reads a version from disk, and never re-derives one from
# any repo-version helper, for exactly that reason. The sibling stamp gate
# gets away with a disk read only because it runs before any release
# mutation happens at all; copying that read pattern here is the specific
# defect this paragraph exists to prevent. The version is ALWAYS the
# argument the caller passes, computed once by release.sh and never
# reassigned (WD-349-5).
#
# THE DISPATCH SEAM: `MINDRIAN_THEO_NOTIFY_CMD`, when set, replaces the
# real default dispatch command entirely. This is a TEST SEAM, the write-
# direction sibling of `MINDRIAN_THEO_STAMP_CMD` (the sibling gate's read
# seam), and it is how tests/test-349-theo-notify-gate.cjs and tests/
# test-349-payload-boundary.cjs prove every path -- success, failure, the
# dry-run non-invocation, the audited skip, the metacharacter-safety and
# token-non-disclosure arms -- hermetically, with zero real network calls.
#
# THE DRY-RUN RULE, and why it differs from the sibling's: the sibling
# stamp gate performs a REAL read under `--dry-run` (WD-20) because a read
# is side-effect-free and `scripts/doctor.cjs --acceptance` shells
# `release.sh --dry-run` constantly. This gate's action is a WRITE. This
# gate NEVER sends under `--dry-run`, ever -- copying the sibling's
# read-time carve-out to a write would fire a real dispatch at Theo on
# every single acceptance run, which happens far more often than a real
# release (WD-349-6, docs/THEO-NOTIFY-CONTRACT.md Ruling 3).
#
# THE AUDITED OPT-OUT: `--no-theo-notify`, parsed by release.sh beside
# `--no-minisite` / `--no-website` / the sibling's own `--no-theo-check`.
# This is a SEPARATE flag from `--no-theo-check` on purpose: an unreachable
# Theo for READS (the sibling gate) and an unreachable GitHub for a WRITE
# (this gate) are independent outage classes, and one flag would force an
# operator with only one of those two problems to disable both gates
# (WD-349-3). A skip always prints the flag, the version, and the
# consequence in plain words -- never silent.
#
# THE LOCAL AUDIT RECORD: one line appended per real release to
# `$HOME/.mindrian/theo-notify-log.txt` (overridable via
# `MINDRIAN_THEO_NOTIFY_LOG`, the send seam's own sibling env var, so a
# hermetic test never touches a real HOME), on SUCCESS and on SEND FAILURE
# alike. This is deliberately an UNTRACKED file, never a tracked write:
# release.sh's own clean-tree guard runs before the push, and this gate's
# call site runs AFTER the push, so a tracked write here would leave the
# tree dirty at the end of every successful release and red the very next
# cut's own pre-flight clean-tree check (WD-349-7, docs/THEO-NOTIFY-
# CONTRACT.md Ruling 5). The durable, tracked, cross-session record is a
# separate `docs/OPEN-HANDOFFS.md` row written at phase time (349-05), not
# a per-release write made here.
#
# INFORMATION DISCLOSURE: this file never prints a resolved credential
# value, and never forwards the dispatch command's own stdout or stderr
# verbatim -- a real `gh` call's response body, or anything a test fake
# prints, is discarded, not echoed. Only the outcome class (`SENT` /
# `SKIPPED` / `SEND FAILURE`) and the four payload values this file already
# holds are ever printed.
#
# RULES for this file (theo-stamp-gate.sh's shape, copied on purpose so the
# two files read as a deliberate pair):
#   - No local errexit (`-e`) flag added here. The caller's own shell
#     options (release.sh runs under a strict mode of its own) are never
#     fought by this file; every command whose failure is a normal,
#     expected branch is explicitly guarded so it cannot trip the caller's
#     strict mode by accident.
#   - No top-level side effects, no global variable assignment outside a
#     function body. Safe to source more than once.
#   - Safe to source under `set -u`: every parameter expansion here is
#     guarded with `${VAR:-}`, including the color constants, which may be
#     unset when this file is sourced outside release.sh (e.g. by a test).
#
# Phase 349 Plan 03, behind a blocking navigator checkpoint (ratified
# 2026-09-16; see docs/THEO-NOTIFY-CONTRACT.md's Navigator Ratification
# section). This file lands inert: nothing sources it yet. 349-04 wires it
# into release.sh and scripts/doctor.cjs.

# _theo_notify_registry_hash(plugin_dir, release_sha) -- prints a
# 64-character lowercase hex SHA-256 digest of `data/command-registry.json`
# AS IT EXISTS AT THE TAGGED COMMIT (`git show <release_sha>:...`), run with
# plugin_dir as the git working directory. NEVER hashes the working tree's
# copy of that file -- by the time this gate's call site is reached the
# working tree may already differ from the tagged commit (Step 7.5 has
# already run). Prints nothing on any failure (an unreadable path, a
# missing SHA-256 tool, a bad plugin_dir or release_sha) and always returns
# 0; callers judge success by whether the printed string is a well-formed
# 64-hex-character digest, never by this function's own exit code, matching
# the sibling gate's "judge by output, never by this function's exit code"
# discipline. Prefers `sha256sum` (Linux); falls back to `shasum -a 256`
# (macOS) when `sha256sum` is not on PATH.
_theo_notify_registry_hash() {
  local plugin_dir="${1:-}"
  local release_sha="${2:-}"

  [ -z "$plugin_dir" ] && return 0
  [ -z "$release_sha" ] && return 0

  local hasher_bin="" hasher_flag=""
  if command -v sha256sum >/dev/null 2>&1; then
    hasher_bin="sha256sum"
  elif command -v shasum >/dev/null 2>&1; then
    hasher_bin="shasum"
    hasher_flag="-a 256"
  else
    return 0
  fi

  local tmp_bytes
  tmp_bytes="$(mktemp 2>/dev/null)" || return 0

  # git show's own exit status is checked directly here (never through a
  # command-substitution or a pipe, either of which would hide it behind
  # the hasher's own exit status instead). A failed read must never fall
  # through to hashing an empty stream, which would print a well-formed but
  # WRONG 64-hex digest -- indistinguishable from a real one to the caller's
  # own shape check -- rather than the honest "nothing printed" this
  # function's contract requires on failure.
  if ( cd "$plugin_dir" 2>/dev/null && git show "${release_sha}:data/command-registry.json" ) > "$tmp_bytes" 2>/dev/null; then
    "$hasher_bin" $hasher_flag < "$tmp_bytes" 2>/dev/null | awk '{print $1}'
  fi

  rm -f "$tmp_bytes" 2>/dev/null
  return 0
}

# _theo_notify_send(new_version, release_sha, registry_hash, registry_path)
# -- fires the dispatch. Resolves dispatch_cmd="${MINDRIAN_THEO_NOTIFY_CMD:-
# $default_dispatch}"; the default is the real `gh api
# repos/jsagir/theo/dispatches` call. WR-01 (copied from theo-stamp-gate.sh
# in spirit, mirrored for the write direction): the four payload values are
# NEVER string-concatenated into the command's own literal text. They
# travel as four separate positional arguments to the `bash -c` invocation
# below, each the literal string "<key>=<value>", and are referenced inside
# the command text only as ${1#*=}..${4#*=} (stripping the "key=" prefix
# back off for the real `gh` call) -- so a checkout path or a version
# string containing a shell metacharacter can never break out of this
# function's own command construction, whether the real default runs or a
# test's injected fake does. WR-02 (copied from theo-stamp-gate.sh): wraps
# the call in `timeout 8`; when no `timeout` binary is on PATH, fails
# CLOSED (prints a stderr notice, returns non-zero) rather than sending
# unbounded -- a hung GitHub API must never be able to hang the whole
# release train. Returns the dispatch command's own exit status (or 1 when
# `timeout` is unavailable). The dispatch command's own stdout and stderr
# are always discarded here, never forwarded -- a real `gh` response body,
# or anything a test fake happens to print, must never surface through this
# function; the caller prints only the outcome class and the values it
# already holds.
_theo_notify_send() {
  local new_version="${1:-}"
  local release_sha="${2:-}"
  local registry_hash="${3:-}"
  local registry_path="${4:-}"

  local default_dispatch
  default_dispatch='gh api repos/jsagir/theo/dispatches -f event_type=theo-resync -f "client_payload[version]=${1#*=}" -f "client_payload[commit]=${2#*=}" -f "client_payload[registryHash]=${3#*=}" -f "client_payload[command_registry_path]=${4#*=}"'
  local dispatch_cmd="${MINDRIAN_THEO_NOTIFY_CMD:-$default_dispatch}"

  local p1="version=${new_version}"
  local p2="commit=${release_sha}"
  local p3="registryHash=${registry_hash}"
  local p4="command_registry_path=${registry_path}"

  if ! command -v timeout >/dev/null 2>&1; then
    echo "  ! theo-notify-gate: no 'timeout' binary on PATH -- refusing to send unbounded (fail closed)." >&2
    return 1
  fi

  timeout 8 bash -c "$dispatch_cmd" _ "$p1" "$p2" "$p3" "$p4" >/dev/null 2>&1
  return $?
}

# _theo_notify_log(log_path, outcome, new_version, release_sha,
# registry_hash) -- appends one line (an ISO-8601 UTC timestamp, the
# outcome token, the version, the sha and the hash) to log_path, creating
# its parent directory if needed. Never fails the caller: a read-only HOME
# or an unwritable parent directory degrades to a printed stderr warning,
# never an aborted release -- a release must not fail because an audit log
# could not be written, but the failure to write one must stay visible
# rather than being swallowed outright. Always returns 0.
_theo_notify_log() {
  local log_path="${1:-}"
  local outcome="${2:-}"
  local new_version="${3:-}"
  local release_sha="${4:-}"
  local registry_hash="${5:-}"

  [ -z "$log_path" ] && return 0

  local log_dir
  log_dir="$(dirname "$log_path")"

  if ! mkdir -p "$log_dir" 2>/dev/null; then
    echo "  ! theo-notify-gate: could not create ${log_dir} -- the audit record for this release was NOT written." >&2
    return 0
  fi

  local ts
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)"

  if ! printf '%s outcome=%s version=%s commit=%s registryHash=%s\n' \
      "$ts" "$outcome" "$new_version" "$release_sha" "$registry_hash" >> "$log_path" 2>/dev/null; then
    echo "  ! theo-notify-gate: could not append to ${log_path} -- the audit record for this release was NOT written." >&2
  fi
  return 0
}

# _theo_notify_safe_display(version) -- a DISPLAY-ONLY sanitizer, never used
# for the actual dispatch payload or the audit log (both always carry the
# exact, unmodified argument byte for byte). Truncates at the first
# character outside a conservative semver-safe set so a version string
# carrying an injected shell metacharacter cannot smuggle arbitrary trailing
# text into this gate's own stdout -- the metacharacter is never executed
# either way (WR-01's positional-argv discipline already prevents that), but
# this keeps this file's own status lines from echoing it back either.
_theo_notify_safe_display() {
  printf '%s' "${1:-}" | grep -oE '^[A-Za-z0-9._+-]*'
}

# mos_theo_notify_gate(plugin_dir, release_sha, new_version, dry_run,
# no_theo_notify) -- the gate, in this exact order so the failure classes
# can never be conflated:
#   1. Missing plugin_dir, release_sha or new_version -- names which one,
#      returns 1. An empty new_version is never allowed through: it is
#      exactly what a disk-read regression would produce.
#   2. no_theo_notify=1 -- prints the audited SKIPPED line naming the flag,
#      the version and the consequence. Returns 0. Sends nothing, logs
#      nothing.
#   3. dry_run=1 -- prints a [DRY RUN] preview line naming the version, the
#      event, the target and the four payload keys it WOULD send. Returns
#      0. Sends nothing, logs nothing, computes no hash (there is nothing
#      to compute it for -- the tree at dry-run time is not the tree at
#      release time).
#   4. An empty or malformed registry hash is a SEND FAILURE (never a
#      MISMATCH, never a SKIP) -- names the cause, names the audited
#      opt-out as the escape, appends to the audit log, returns 1.
#   5. Sends. SENT (0) or SEND FAILURE (1), each appended to the audit log.
#
# Returns 0 on a successful dispatch, an audited --no-theo-notify skip, or
# any outcome while dry_run=1. Returns 1 on a send failure, an unreadable
# registry hash, or a missing required argument.
mos_theo_notify_gate() {
  local plugin_dir="${1:-}"
  local release_sha="${2:-}"
  local new_version="${3:-}"
  local dry_run="${4:-0}"
  local no_theo_notify="${5:-0}"

  if [ -z "$plugin_dir" ]; then
    echo "  x theo-notify-gate: missing plugin_dir argument"
    return 1
  fi
  if [ -z "$release_sha" ]; then
    echo "  x theo-notify-gate: missing release_sha argument"
    return 1
  fi
  if [ -z "$new_version" ]; then
    echo "  x theo-notify-gate: missing new_version argument -- refusing to notify Theo of an empty version, which is exactly what a disk-read regression would produce"
    return 1
  fi

  local log_path="${MINDRIAN_THEO_NOTIFY_LOG:-$HOME/.mindrian/theo-notify-log.txt}"
  local registry_path="data/command-registry.json"
  local display_version
  display_version="$(_theo_notify_safe_display "$new_version")"

  if [ "$no_theo_notify" = "1" ]; then
    echo -e "${YELLOW:-}  ! theo-notify-gate: SKIPPED via --no-theo-notify for version ${display_version}. Theo was NOT told this version shipped, so its command layer may map to a stale registry until the next cut's lagging gate catches it. Re-run without the flag once GitHub is reachable, or trigger the dispatch manually.${NC:-}"
    return 0
  fi

  if [ "$dry_run" = "1" ]; then
    echo -e "${YELLOW:-}  [DRY RUN] theo-notify-gate: would send version=${display_version}, event=theo-resync, target=jsagir/theo, payload keys: version, commit, registryHash, command_registry_path. No dispatch is sent under --dry-run.${NC:-}"
    return 0
  fi

  local registry_hash
  registry_hash="$(_theo_notify_registry_hash "$plugin_dir" "$release_sha")"

  if ! [[ "$registry_hash" =~ ^[0-9a-f]{64}$ ]]; then
    echo -e "${RED:-}  x theo-notify-gate: SEND FAILURE -- could not compute a registry hash for version ${display_version} (the tagged commit's ${registry_path} could not be read, or no SHA-256 tool was found on PATH).${NC:-}"
    echo "    Audited opt-out (only for a known outage): re-run with --no-theo-notify."
    _theo_notify_log "$log_path" "SEND FAILURE" "$new_version" "$release_sha" "$registry_hash"
    return 1
  fi

  if _theo_notify_send "$new_version" "$release_sha" "$registry_hash" "$registry_path"; then
    echo -e "${GREEN:-}  theo-notify-gate: SENT -- version ${display_version}, event theo-resync, target jsagir/theo, registryHash ${registry_hash:0:12}...${NC:-}"
    _theo_notify_log "$log_path" "SENT" "$new_version" "$release_sha" "$registry_hash"
    return 0
  fi

  echo -e "${RED:-}  x theo-notify-gate: SEND FAILURE -- could not dispatch theo-resync for version ${display_version}. Recovery: re-run the dispatch by hand, or re-run the release with --no-theo-notify once the outage is known.${NC:-}"
  _theo_notify_log "$log_path" "SEND FAILURE" "$new_version" "$release_sha" "$registry_hash"
  return 1
}
