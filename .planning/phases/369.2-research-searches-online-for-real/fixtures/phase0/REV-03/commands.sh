grep -n "rooms-new\|NOT EXECUTED\|UNIMPLEMENTED_MUTATING_ORCHESTRATION\|command === 'rooms-open'" lib/mcp/tool-router.cjs
sed -n 2026,2032p lib/mcp/tool-router.cjs
git log -S'NOT EXECUTED' --oneline -- lib/mcp/tool-router.cjs | tail -3
ls commands/rooms-new.md 2>&1
