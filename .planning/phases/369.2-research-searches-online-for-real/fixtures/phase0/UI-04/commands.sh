# 01 g_states
grep -rnIiE 'empty|unavailable|unsupported|indexing|failed to load|load failure|rebuilding' ui/shell/client/copy.ts ui/shell/client/views/format.ts | cut -c1-170 | head -40; echo; grep -rnIiE 'unavailable|unsupported|indexing|load.?fail' scripts/dashboard* 2>/dev/null | cut -c1-160 | head -10
# 02 g_views
grep -nE 'loading|error|empty|unavailable|could not|Loading' ui/shell/client/views/guarded.tsx ui/shell/client/views/evidence/*.tsx ui/shell/client/views/decisions/*.tsx ui/shell/client/views/HomeRoute.tsx | cut -c1-190 | head -30; echo ---; grep -nE 'could not|unavailable|Could not|not available|failed' ui/shell/client/copy.ts | cut -c1-190 | head -20
# 03 g_appdash
grep -nIiE 'empty|unavailable|unsupported|no room|error|loading|not available' lib/mcp/app-html/dashboard.html | cut -c1-180 | head -20; echo; grep -nIiE 'empty|unavailable|unsupported|no entries|error' scripts/serve-dashboard | cut -c1-150 | head
