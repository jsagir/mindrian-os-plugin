#!/usr/bin/env bash
# scripts/release-lib/real-room-gate.sh
#
# WHAT: a sourced library defining `mos_real_room_gate`, the Step 2.6 gate of
# docs/RELEASE-CEREMONY-RULING-SYSTEM.md RULE 10 ("No cut without a real-room run
# read by a human"). It refuses a release unless a receipt for the exact HEAD sha
# exists, written only by `node scripts/real-room-run.cjs --read-by "<name>"` after a
# person read the report of a quick, a deep, a Eureka and an analogies run on a
# fixture room.
#
# WHY (navigator ruling 2026-10-05): Phase 369 regressed silently because no cut was
# read by a human on a real room. A green suite proves the code paths exist; this
# proves a person looked at what the product does on a room and signed it.
#
# THE RECEIPT: <receipt-dir>/<full HEAD sha>.json, receipt-dir defaulting to
# $HOME/.mindrian/release-real-room (seam: MINDRIAN_REAL_ROOM_RECEIPT_DIR, which
# tests/test-muy-real-room-rule.cjs drives hermetically). Valid means: its sha equals
# HEAD, `reader` is a non-empty name, the four perspective blocks (quick, deep,
# eureka, analogies) each carry a `counts` object of numbers, and it was NOT recorded
# with --offline (an offline run plans the web lines and sends none, so it cannot
# stand for a real cut).
#
# THE DESKTOP LEG: a receipt with no desktop_verified.mac and no desktop_verified.win
# passes with a loud WARN. `node scripts/real-room-run.cjs --desktop-verified mac|win`
# records the leg on the existing receipt.
#
# THE NEGATIVE LEG (369.25-24, FCLOSE-07; navigator 2026-10-06 01:00 "the gate refuses the cut when the negative leg did not
# refuse"): the receipt must also carry `negative_leg`, written by the same run: the never-ready fixture with room.db missing
# (room_db_missing) and corrupted (room_db_corrupted), quick, deep, eureka and analogies each refused with a typed
# not_ready_reason. The gate reads every job's own `refused` flag and reason, never only the summary `all_refused`: a receipt
# with no negative leg is NONEGATIVE, one in which any job ran, is missing, or refused with no typed reason is NEGATIVE_RAN.
# The check lives here and not in release.sh so the step blocks the 341 tripwire hashes stay as they are.
#
# LOCAL ONLY: this gate reads one local JSON file and one git sha. No network. It
# prints names, shas, counts and paths, never an environment value.
#
# THE DRY-RUN CARVE-OUT (the place 8 and place 9 precedent): under dry_run=1 every
# verdict is printed with a [DRY RUN] prefix and the function returns 0. no_check=1 is
# the audited opt-out --no-real-room-check: one line, never silent.
#
# RULES for this file (theo-stamp-gate.sh's shape, copied on purpose): no `set -e`, no
# top-level side effects, safe under `set -u`, the function only returns codes and never
# terminates the caller's shell.
#
# Quick 261005-muy. Hyphens only.

# _real_room_check(receipt_dir, head_sha) -- prints lines, each starting with a tag:
#   KIND <OK|NORECEIPT|UNREADABLE|MISMATCH|INVALID|NONEGATIVE|NEGATIVE_RAN|OFFLINE>
#   MSG  <text>        the reason (every non-OK kind)
#   LAST <sha> <reader> <read_at>   NORECEIPT only: the newest receipt in the dir, if any
#   LINE <text>        a summary line (OK only; one is 'negative leg: refused <n> of <n> (<reasons>)')
#   WARN <text>        a loud warning (OK only)
_real_room_check() {
  MINDRIAN_RR_DIR="${1:-}" MINDRIAN_RR_HEAD="${2:-}" node -e '
    var fs = require("fs"), path = require("path");
    var dir = process.env.MINDRIAN_RR_DIR || "", head = process.env.MINDRIAN_RR_HEAD || "";
    var out = [];
    function p(tag, text) { out.push(tag + " " + String(text).replace(/[\r\n]+/g, " ")); }
    function done() { process.stdout.write(out.join("\n") + "\n"); process.exit(0); }
    var file = path.join(dir, head + ".json");
    var raw = null;
    try { raw = fs.readFileSync(file, "utf8"); } catch (e) { raw = null; }
    if (raw === null) {
      p("KIND", "NORECEIPT");
      p("MSG", "no receipt for HEAD in " + dir);
      var best = null;
      try {
        fs.readdirSync(dir).forEach(function (f) {
          if (!/\.json$/.test(f)) return;
          var j; try { j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { return; }
          if (!j || typeof j.sha !== "string") return;
          var t = Date.parse(j.read_at || "") || 0;
          if (!best || t > best.t) best = { t: t, sha: j.sha, reader: String(j.reader || "unknown"), at: String(j.read_at || "unknown") };
        });
      } catch (e) { /* no dir */ }
      if (best) p("LAST", best.sha + " " + best.reader.replace(/\s+/g, "_") + " " + best.at);
      done();
    }
    var r;
    try { r = JSON.parse(raw); } catch (e) { p("KIND", "UNREADABLE"); p("MSG", "receipt " + file + " is not valid JSON"); done(); }
    if (!r || typeof r !== "object" || Array.isArray(r)) { p("KIND", "INVALID"); p("MSG", "receipt is not an object"); done(); }
    if (r.sha !== head) { p("KIND", "MISMATCH"); p("MSG", "the file is named for " + head.slice(0, 12) + " but the receipt names sha " + String(r.sha).slice(0, 12)); done(); }
    if (typeof r.reader !== "string" || !r.reader.trim()) { p("KIND", "INVALID"); p("MSG", "no reader: a person must pass --read-by"); done(); }
    var blocks = ["quick", "deep", "eureka", "analogies"], lines = [];
    var persp = r.perspectives && typeof r.perspectives === "object" ? r.perspectives : {};
    for (var i = 0; i < blocks.length; i++) {
      var b = persp[blocks[i]];
      if (!b || typeof b !== "object" || !b.counts || typeof b.counts !== "object" || Array.isArray(b.counts)) { p("KIND", "INVALID"); p("MSG", "the " + blocks[i] + " block is missing or has no counts"); done(); }
      var keys = Object.keys(b.counts);
      var okc = keys.length > 0 && keys.every(function (k) { return typeof b.counts[k] === "number" && isFinite(b.counts[k]); });
      if (!okc) { p("KIND", "INVALID"); p("MSG", "the " + blocks[i] + " counts are not all numbers"); done(); }
      lines.push(blocks[i] + ": " + String(b.status || "recorded") + " (" + keys.map(function (k) { return k + "=" + b.counts[k]; }).join(", ") + ")");
    }
    var NL_INJECTIONS = ["room_db_missing", "room_db_corrupted"];
    var nl = r.negative_leg;
    if (!nl || typeof nl !== "object" || Array.isArray(nl)) {
      p("KIND", "NONEGATIVE");
      p("MSG", "the receipt has no negative leg: nothing proves quick, deep, Eureka and analogies refuse a room with no usable room.db");
      done();
    }
    var nlRooms = Array.isArray(nl.rooms) ? nl.rooms : [];
    var nlReasons = [], nlJobs = 0;
    for (var ri = 0; ri < NL_INJECTIONS.length; ri++) {
      var inj = NL_INJECTIONS[ri], room = null;
      for (var rj = 0; rj < nlRooms.length; rj++) { if (nlRooms[rj] && nlRooms[rj].injection === inj) { room = nlRooms[rj]; break; } }
      if (!room || !room.jobs || typeof room.jobs !== "object") { p("KIND", "NEGATIVE_RAN"); p("MSG", "the negative leg has no " + inj + " room: no job was shown to refuse there"); done(); }
      for (var ji = 0; ji < blocks.length; ji++) {
        var jn = blocks[ji], jb = room.jobs[jn];
        if (!jb || typeof jb !== "object") { p("KIND", "NEGATIVE_RAN"); p("MSG", jn + " has no record on " + inj + ": it was not shown to refuse"); done(); }
        if (jb.refused !== true) { p("KIND", "NEGATIVE_RAN"); p("MSG", jn + " RAN on " + inj + ": the field defect R3 shape"); done(); }
        if (typeof jb.not_ready_reason !== "string" || !jb.not_ready_reason.trim()) { p("KIND", "NEGATIVE_RAN"); p("MSG", jn + " refused on " + inj + " with no typed reason: a refusal must name the failed requirement"); done(); }
        nlJobs++;
        if (nlReasons.indexOf(jb.not_ready_reason) === -1) nlReasons.push(jb.not_ready_reason);
      }
    }
    if (nl.all_refused !== true) { p("KIND", "NEGATIVE_RAN"); p("MSG", "the negative leg records all_refused " + String(nl.all_refused) + ": it did not refuse every job"); done(); }
    if (r.offline === true) { p("KIND", "OFFLINE"); p("MSG", "the receipt was recorded with --offline: the web lines were planned and shown, never sent"); done(); }
    p("KIND", "OK");
    p("LINE", "read by " + r.reader.trim() + " at " + String(r.read_at || "unknown") + " (version " + String(r.version || "unknown") + ")");
    lines.forEach(function (l) { p("LINE", l); });
    p("LINE", "negative leg: refused " + nlJobs + " of " + nlJobs + " (" + nlReasons.join(", ") + ")");
    var dv = r.desktop_verified && typeof r.desktop_verified === "object" ? r.desktop_verified : {};
    if (dv.mac || dv.win) {
      p("LINE", "desktop verified: mac " + (dv.mac || "not run") + ", win " + (dv.win || "not run"));
    } else {
      p("WARN", "WARN: this receipt carries no desktop_verified leg (mac or win): nobody has run this cut Desktop copy on a Mac or a PC. Run node scripts/real-room-run.cjs --desktop-verified mac|win on that machine to record it.");
    }
    done();
  ' 2>/dev/null || true
}

# mos_real_room_gate(plugin_dir, dry_run, no_check)
mos_real_room_gate() {
  local plugin_dir="${1:-}"
  local dry_run="${2:-0}"
  local no_check="${3:-0}"
  local run_cmd='node scripts/real-room-run.cjs --read-by "<your name>"'

  if [ -z "$plugin_dir" ]; then
    echo "  x real-room-gate: missing plugin_dir argument"
    return 1
  fi

  local head_sha
  head_sha="$(git -C "$plugin_dir" rev-parse HEAD 2>/dev/null || true)"
  head_sha="$(printf '%s' "$head_sha" | tr -d '[:space:]')"
  local short="${head_sha:0:12}"

  if [ "$no_check" = "1" ]; then
    echo -e "${YELLOW:-}  ! real-room-gate: SKIPPED via --no-real-room-check for HEAD ${short:-unknown}. nothing proves this cut ran on a room: no receipt from scripts/real-room-run.cjs was required, so no person read a quick, deep, Eureka and analogies run on a fixture room for this commit. Run ${run_cmd} and re-run without the flag.${NC:-}"
    return 0
  fi

  local prefix=""
  [ "$dry_run" = "1" ] && prefix="[DRY RUN] "

  if [ -z "$head_sha" ]; then
    if [ "$dry_run" = "1" ]; then
      echo -e "${YELLOW:-}  ${prefix}real-room-gate: READ FAILURE -- HEAD could not be read. A real release would ABORT here.${NC:-}"
      return 0
    fi
    echo -e "${RED:-}  x real-room-gate: READ FAILURE -- HEAD could not be read from ${plugin_dir}. Refusing to release.${NC:-}"
    return 1
  fi

  local receipt_dir="${MINDRIAN_REAL_ROOM_RECEIPT_DIR:-${HOME:-}/.mindrian/release-real-room}"
  local out kind msg last
  out="$(_real_room_check "$receipt_dir" "$head_sha")"
  kind="$(printf '%s\n' "$out" | sed -n 's/^KIND //p' | head -n 1)"
  msg="$(printf '%s\n' "$out" | sed -n 's/^MSG //p' | head -n 1)"
  last="$(printf '%s\n' "$out" | sed -n 's/^LAST //p' | head -n 1)"

  if [ "$kind" = "OK" ]; then
    echo -e "${GREEN:-}  ${prefix}real-room-gate: PASS -- a receipt for HEAD ${short} exists.${NC:-}"
    printf '%s\n' "$out" | sed -n 's/^LINE /    /p'
    local w
    w="$(printf '%s\n' "$out" | sed -n 's/^WARN //p')"
    if [ -n "$w" ]; then
      echo -e "${YELLOW:-}    ${w}${NC:-}"
    fi
    return 0
  fi

  local detail=""
  case "$kind" in
    NORECEIPT)
      detail="NO RECEIPT -- no real-room run has been recorded for HEAD ${short} (looked in ${receipt_dir})."
      if [ -n "$last" ]; then
        local l_sha l_reader l_at
        l_sha="${last%% *}"; last="${last#* }"
        l_reader="${last%% *}"; l_at="${last#* }"
        detail="${detail} The latest receipt is for ${l_sha:0:12}, read by ${l_reader//_/ } at ${l_at}: it is behind HEAD ${short}."
      fi
      ;;
    UNREADABLE) detail="READ FAILURE -- ${msg}. Treated as a failure, never a pass." ;;
    MISMATCH)   detail="MISMATCH -- ${msg} (HEAD is ${short})." ;;
    INVALID)    detail="INVALID RECEIPT -- ${msg}." ;;
    NONEGATIVE) detail="NO NEGATIVE LEG -- ${msg}." ;;
    NEGATIVE_RAN) detail="NEGATIVE LEG RAN -- ${msg}. A cut needs every research door to refuse a room with no usable room.db." ;;
    OFFLINE)    detail="OFFLINE RECEIPT -- ${msg}. A real cut needs a run without --offline." ;;
    *)          detail="READ FAILURE -- the receipt reader gave no verdict." ;;
  esac

  if [ "$dry_run" = "1" ]; then
    echo -e "${YELLOW:-}  ${prefix}real-room-gate: ${detail} A real release would ABORT here. Recovery: ${run_cmd}${NC:-}"
    return 0
  fi
  echo -e "${RED:-}  x real-room-gate: ${detail}${NC:-}"
  echo "    Recovery: read a real-room run, then record it: ${run_cmd}"
  echo "    Audited opt-out: re-run with --no-real-room-check."
  return 1
}
