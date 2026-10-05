# 01 g_header
grep -nE 'room|session|version|run|task|Room|Session|Version' ui/shell/client/frame/ShellHeader.tsx | cut -c1-200 | head -40; echo ----; grep -nE 'room|session|version|state|label' ui/shell/client/frame/SessionIndicator.tsx | cut -c1-200 | head -30; echo ---; grep -nE 'version|VERSION|run_id|runId|task' ui/shell/client/frame/*.tsx ui/shell/client/frame/*.ts | cut -c1-200 | head -20
# 02 g_statusline
grep -nE "session_id|version|room|run_id|\bmodel\b" scripts/context-monitor | cut -c1-170 | head -30; echo ----; grep -nE "room|session|version" scripts/statusline-mos-dispatch lib/statusline/statusline-mos | cut -c1-170 | head -30
# 03 g_panel
grep -nE 'data-row|<dt>' ui/shell/client/frame/StatusPanel.tsx; echo; grep -nE 'statusOpen|StatusPanel' ui/shell/client/frame/ShellHeader.tsx ui/shell/client/frame/ShellFrame.tsx | head; echo; sed -n 1,30p lib/statusline/statusline-fallback-echo.cjs | cut -c1-170; grep -nE 'room|session|version' lib/statusline/statusline-fallback-echo.cjs | wc -l
# 04 g_echo
sed -n 1,25p scripts/statusline-fallback-echo.cjs | cut -c1-170; grep -cE 'room|session|version' scripts/statusline-fallback-echo.cjs
