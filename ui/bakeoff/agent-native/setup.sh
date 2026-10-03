#!/usr/bin/env bash
# Bake-off candidate B (Phase 369 plan 16): the agent-native scaffold with the
# D-05 slice laid on it. Reproducible: the generated app (app/) is git-ignored;
# this script rebuilds it from the scaffold CLI, the dependency-removal list
# below and overlay/. Re-run is idempotent: an existing app/ is re-hygiened and
# the overlay is copied over it again.
#
# Hygiene carried from spike 007 (stages/01_scaffold/setup.sh):
#   - telemetry off for every command (the CLI reports to
#     analytics.agent-native.com by default)
#   - the scaffold's CLAUDE.md, .claude/ and .mcp.json deleted (a nested
#     CLAUDE.md auto-loads into any Claude session that reads files here)
#   - the v1 MCP SDK the spike added is NOT added (v1 was removed by MCPV2-18;
#     all room access goes through ui/shared's v2 client)
#   - the MIT notice is carried by hand (the npm tarball ships none)
# Canon Part 8: no outside host at run time; hyphens only.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
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

CORE_VERSION="0.198.8"
BLOCKNOTE_VERSION="0.51.4"

# 1. scaffold (only when absent). Pinned exactly: nightlies churn daily.
if [ ! -d app ]; then
  npx --yes "@agent-native/core@${CORE_VERSION}" create app --standalone --template chat
fi

# 2. scaffold hygiene (spike 007, trail 1). Verified by the static test arm.
rm -f app/CLAUDE.md
rm -rf app/.claude
rm -f app/.mcp.json
# Also the other agent-instruction files the scaffold ships (the orchestrator's
# ruling: treat them like CLAUDE.md, so nothing here instructs a session that
# reads the folder): AGENTS.md and the .agents skills folder.
rm -f app/AGENTS.md
rm -rf app/.agents

# 3. dependency removal (the "dependency removal" measure). Each path below
#    needs agent-native's own database (production refuses PGlite and wants a
#    hosted Postgres, spike 007 trail 7), its own model loop, or its chat
#    shell. D-14 and SEED-067: the slice uses actions and routes only.
REMOVE=(
  # chat route family (needs the agent-chat plugin and a hosted database)
  "app/app/routes/_index.tsx"                 # sign-in landing; overlay replaces it with the room list
  "app/app/routes/home.tsx"                   # chat home
  "app/app/routes/chat.\$threadId.tsx"        # chat thread
  "app/app/routes/agent.tsx"                  # agent settings screen
  "app/app/routes/database.tsx"               # database admin screen
  "app/app/routes/observability.tsx"          # run telemetry screen (agent runs)
  "app/app/routes/team.tsx"                   # org and team admin
  "app/app/routes/settings.tsx"               # settings shell
  "app/app/routes/settings.\$.tsx"            # settings catch-all
  "app/app/routes/extensions.tsx"             # extensions (agent-authored UI)
  "app/app/routes/extensions._index.tsx"
  "app/app/routes/extensions.\$id.tsx"
  "app/app/routes/extensions.\$id.\$slug.tsx"
  # chat shell components and state
  "app/app/components/chat"
  "app/app/components/layout"                 # sidebar, header, agent inspector
  "app/app/hooks/use-navigation-state.ts"
  "app/app/lib/chat-home-thread.ts"
  "app/app/lib/sidebar-thread-state.ts"
  # the agent-chat server plugin (the model loop; D-14)
  "app/server/plugins/agent-chat.ts"
  # default agent actions (none is a room door; provider-api-request is an
  # outbound request proxy, so it goes before any build)
  "app/actions/hello.ts"
  "app/actions/navigate.ts"
  "app/actions/provider-api-request.ts"
  "app/actions/run.ts"
  "app/actions/view-screen.ts"
)
for p in "${REMOVE[@]}"; do
  rm -rf "$p"
done

# 4. overlay (the slice): server/lib, server/middleware, server/routes, actions,
#    app/root.tsx, app/routes, app/slice.css
cp -r overlay/. app/
cp LICENSE-agent-native.txt app/LICENSE-agent-native.txt

# 5. D-17: no TS path alias anywhere. The scaffold's tsconfig declares paths
#    ("@/*", "@shared/*", "*") and its files import through them; rewrite the
#    kept files to relative imports and drop the paths block, so the erasable
#    gate (tests/test-369-ts-erasable-gate.cjs) holds for this tree too.
node - "$HERE/app" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
const tsconfig = path.join(root, 'tsconfig.json');
const cfg = JSON.parse(fs.readFileSync(tsconfig, 'utf8'));
if (cfg.compilerOptions) delete cfg.compilerOptions.paths;
fs.writeFileSync(tsconfig, JSON.stringify(cfg, null, 2) + '\n');
const aliases = [
  [/^@\//, path.join(root, 'app') + path.sep],
  [/^@shared\//, path.join(root, 'shared') + path.sep],
];
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.generated' || e.name === '.output' || e.name === '.react-router') continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(abs);
  }
  return out;
}
for (const dirName of ['app', 'server', 'actions']) {
  const dir = path.join(root, dirName);
  if (!fs.existsSync(dir)) continue;
  for (const file of walk(dir, [])) {
    const src = fs.readFileSync(file, 'utf8');
    const next = src.replace(/(from\s+|import\s+|import\()\s*(["'])(@\/|@shared\/)([^"']+)\2/g, (_m, lead, q, alias, rest) => {
      const target = path.join(alias === '@/' ? path.join(root, 'app') : path.join(root, 'shared'), rest);
      let rel = path.relative(path.dirname(file), target).split(path.sep).join('/');
      if (!rel.startsWith('.')) rel = './' + rel;
      return lead + q + rel + q;
    });
    if (next !== src) fs.writeFileSync(file, next);
  }
}
NODE

# 6. install, then the exact-pinned BlockNote (display only, D-13: no
#    @blocknote/xl-* package, they are GPL-3.0 OR PROPRIETARY) and the local
#    link to the shared shell core. ui/shared sits three levels above app/.
cd app
pnpm install --reporter=silent
pnpm add --save-exact "@blocknote/core@${BLOCKNOTE_VERSION}" "@blocknote/react@${BLOCKNOTE_VERSION}" "@blocknote/mantine@${BLOCKNOTE_VERSION}" --reporter=silent
pnpm add "mos-ui-shared@link:../../../shared" --reporter=silent

cd "$HERE"
scrub_dashes app

echo "agent-native candidate ready (app/). Next: build.sh, then serve.sh"
