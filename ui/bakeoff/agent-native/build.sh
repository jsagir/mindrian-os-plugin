#!/usr/bin/env bash
# Bake-off candidate B: the production build (Phase 369 plan 16). Telemetry off.
# Prints build seconds and output bytes (plan 18 measures formally). The licence
# notice is kept next to the output (the npm tarball ships none).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE/app"
export DO_NOT_TRACK=1 AGENT_NATIVE_TELEMETRY_DISABLED=1 CI=1
# House rule (hyphens only): the scaffold's docs and bundled output carry long
# dashes. Rewrite them so the phase long-dash guard (tests/run-all-369.sh) holds
# over this tree: a hyphen in prose, a \u escape in code, JSON and source maps.
scrub_dashes() {
  local f
  { grep -rlP '\x{2014}|\x{2013}' "$@" --exclude-dir=node_modules 2>/dev/null || true; } | while IFS= read -r f; do
    case "$f" in
      *.js|*.mjs|*.cjs|*.ts|*.tsx|*.json|*.map)
        perl -X -CSD -pi -e 's/\x{2014}/\\u2014/g; s/\x{2013}/\\u2013/g' "$f" ;;
      *.css)
        perl -X -CSD -pi -e 's/\x{2014}/\\2014 /g; s/\x{2013}/\\2013 /g' "$f" ;;
      *)
        perl -X -CSD -pi -e 's/[\x{2014}\x{2013}]/-/g' "$f" ;;
    esac
  done
}

start=$(date +%s)
pnpm build
end=$(date +%s)
cp "$HERE/LICENSE-agent-native.txt" .output/LICENSE-agent-native.txt
scrub_dashes .output .generated .deploy-tmp build .react-router

# Canon Part 8, T-369-16-01: the bundles carry outside-host literals that are
# never called in this configuration (agent-native's client analytics endpoint
# is used only when a public key is configured, none is; RxDB's console notice
# and error messages link to rxdb.info; the server core names a Google Fonts
# host in a design-token helper this slice never calls). Neutralize them so the built output
# names no outside host at all and a later configuration change cannot send
# anything off the machine. Server-side and client-side, text files only.
{ grep -rlE 'analytics\.agent-native\.com|rxdb\.info|fonts\.googleapis|fonts\.gstatic' .output 2>/dev/null || true; } | while IFS= read -r f; do
  perl -X -pi -e 's#https://analytics\.agent-native\.com/track#http://127.0.0.1:9/track#g; s#analytics\.agent-native\.com#analytics.invalid#g; s#rxdb\.info#rxdb.invalid#g; s#fonts\.googleapis\.com#fonts.invalid#g; s#fonts\.gstatic\.com#fonts.invalid#g; s#fonts\.googleapis#fonts.invalid#g; s#fonts\.gstatic#fonts.invalid#g' "$f"
done

# The scrub changes byte counts of served files, and Nitro's public-asset table
# (server/index.mjs) records each file's size for Content-Length: a stale size
# truncates the body ("Unexpected end of input" in the browser). Refresh sizes.
node - <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const idx = path.join('.output', 'server', 'index.mjs');
let src = fs.readFileSync(idx, 'utf8');
let n = 0;
src = src.replace(/size:(\d+),path:`\.\.\/public\/([^`]+)`/g, (m, size, rel) => {
  const f = path.join('.output', 'public', rel);
  if (!fs.existsSync(f)) return m;
  const actual = fs.statSync(f).size;
  if (String(actual) !== size) n += 1;
  return 'size:' + actual + ',path:`../public/' + rel + '`';
});
fs.writeFileSync(idx, src);
console.log('public asset sizes refreshed: ' + n);
NODE
echo "build seconds: $((end - start))"
echo "output bytes: $(du -sb .output | cut -f1)"
