#!/usr/bin/env bash
# Phase 369 plan 15 (BAKE369-01): bake-off candidate A, the workroom chassis.
#
# Reproducible: copies the workroom checkout into the git-ignored app/ directory,
# snapshots it (files, line counts, sha256) for the "workroom code surviving"
# measure, deletes everything REMOVE.txt names, lays the overlay (the action
# layer, the slice, a font-host-free layout) over the copy, installs the
# workroom's own lockfile with scripts off, then applies package-patch.json
# (drop the GPL exporters, the AI SDK and the fs frontmatter reader; add the
# local mos-ui-shared package). A failed build is fixed by re-running this
# script, never by editing app/.
#
# Usage: bash setup.sh [--refresh]
#   --refresh   rewrite snapshot.json from the current workroom checkout
#
# The workroom checkout (MOS_WORKROOM_SRC, default ~/dev/mindrian-workroom) is
# only READ. It is not under git, so nothing here may write into it.
# Telemetry off. Hyphens only: no em-dash or en-dash anywhere.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${MOS_WORKROOM_SRC:-$HOME/dev/mindrian-workroom}"
APP="$HERE/app"
REFRESH=0
[ "${1:-}" = "--refresh" ] && REFRESH=1

export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
export DO_NOT_TRACK=1 NEXT_TELEMETRY_DISABLED=1
export npm_config_fund=false npm_config_audit=false npm_config_update_notifier=false

[ -d "$SRC/src" ] || { echo "workroom source not found at $SRC" >&2; exit 1; }
[ -n "$APP" ] && [ "$APP" != "/" ] || { echo "refusing: empty app path" >&2; exit 1; }

echo "== 1/6 copy $SRC -> app/ (no node_modules, .next, .git, env files, demo data)"
rm -rf "$APP"
mkdir -p "$APP"
rsync -a \
  --exclude='/node_modules' --exclude='/.next' --exclude='/.git' \
  --exclude='/.env*' --exclude='/.vercel' --exclude='/.snapshots' \
  --exclude='/demo-data' --exclude='/docs' \
  --exclude='/tsconfig.tsbuildinfo' --exclude='/next-env.d.ts' \
  "$SRC/" "$APP/"

# The scaffold's CLAUDE.md and AGENTS.md auto-load into any Claude session that
# reads files here (T-369-15-04). Delete them from the copy.
rm -f "$APP/CLAUDE.md" "$APP/AGENTS.md"
rm -rf "$APP/.claude" "$APP/.mcp.json"

echo "== 2/6 snapshot of the untouched copy"
if [ ! -f "$HERE/snapshot.json" ] || [ "$REFRESH" = "1" ]; then
  APP_DIR="$APP" SRC_DIR="$SRC" OUT="$HERE/snapshot.json" node -e '
    const fs = require("node:fs");
    const path = require("node:path");
    const crypto = require("node:crypto");
    const app = process.env.APP_DIR;
    const files = [];
    function walk(rel) {
      for (const ent of fs.readdirSync(path.join(app, rel), { withFileTypes: true })) {
        const p = rel ? rel + "/" + ent.name : ent.name;
        if (ent.isDirectory()) walk(p);
        else files.push(p);
      }
    }
    for (const top of ["src", "scripts"]) if (fs.existsSync(path.join(app, top))) walk(top);
    for (const cfg of ["package.json", "next.config.ts", "tsconfig.json", "eslint.config.mjs", "postcss.config.mjs"]) {
      if (fs.existsSync(path.join(app, cfg))) files.push(cfg);
    }
    files.sort();
    let total = 0;
    let tsTotal = 0;
    const rows = files.map((f) => {
      const buf = fs.readFileSync(path.join(app, f));
      const lines = buf.toString("utf8").split("\n").length - (buf.length && buf[buf.length - 1] === 10 ? 1 : 0);
      total += lines;
      if (/^src\/.*\.(ts|tsx)$/.test(f)) tsTotal += lines;
      return { path: f, lines, sha256: crypto.createHash("sha256").update(buf).digest("hex") };
    });
    const record = {
      note: "Snapshot of the workroom checkout as copied by setup.sh, before any removal or overlay. The workroom is not under git, so there is no commit: the sha256 per file is the identity. total_lines counts every listed file; ts_tsx_lines counts src TS and TSX only (the figure RESEARCH Pattern 6 measured).",
      source: process.env.SRC_DIR,
      file_count: rows.length,
      total_lines: total,
      ts_tsx_lines: tsTotal,
      files: rows,
    };
    fs.writeFileSync(process.env.OUT, JSON.stringify(record, null, 2) + "\n");
    console.log("snapshot: " + rows.length + " files, total_lines " + total + ", ts_tsx_lines " + tsTotal);
  '
else
  echo "snapshot.json kept (use --refresh to rewrite)"
fi

echo "== 3/6 remove what REMOVE.txt names"
while IFS= read -r line; do
  case "$line" in ''|'#'*) continue ;; esac
  rel="${line%% :: *}"
  case "$rel" in /*|../*|*/../*|*/..|..) echo "refusing unsafe path in REMOVE.txt: $rel" >&2; exit 1 ;; esac
  rm -rf "$APP/$rel"
done < "$HERE/REMOVE.txt"

echo "== 4/6 overlay"
cp -R "$HERE/overlay/." "$APP/"

echo "== 5/6 npm ci (the workroom's own lockfile, scripts off), inside app/ only"
( cd "$APP" && npm ci --ignore-scripts --no-audit --no-fund )

echo "== 6/6 package patch (remove GPL exporters, AI SDK, fs reader; add mos-ui-shared)"
( cd "$APP" && PATCH="$HERE/package-patch.json" node -e '
  const fs = require("node:fs");
  const cp = require("node:child_process");
  const patch = JSON.parse(fs.readFileSync(process.env.PATCH, "utf8"));
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const names = Object.keys(Object.assign({}, pkg.dependencies, pkg.devDependencies));
  const drop = names.filter((n) => patch.remove.some((p) => p.endsWith("*") ? n.startsWith(p.slice(0, -1)) : n === p));
  if (drop.length) {
    cp.execFileSync("npm", ["uninstall", "--ignore-scripts", "--no-audit", "--no-fund"].concat(drop), { stdio: "inherit" });
  }
  for (const [name, spec] of Object.entries(patch.add)) {
    cp.execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--install-links", name + "@" + spec], { stdio: "inherit" });
  }
  console.log("removed: " + (drop.join(", ") || "(none)"));
' )

echo "setup done: $APP"
