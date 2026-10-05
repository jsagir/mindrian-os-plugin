# 01 g_accept
grep -rnIE 'Accept|accept|i accept' ui/shell/client ui/shell/server ui/shared --include=*.ts --include=*.tsx -i | grep -viE 'accept-language|acceptable|aria|// ' | cut -c1-200 | head -50
# 02 g_iaccept
grep -rnIiE "i accept|\baccept\b" lib scripts hooks commands agents skills references ui/shell/client ui/shell/server --include=*.cjs --include=*.js --include=*.ts --include=*.tsx --include=*.md --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next | grep -viE 'accept-|acceptance|acceptable|accepted by|accepts|accepted\b' | cut -c1-190 | head -30
# 03 g_dist
grep -rlE 'approveDecision' lib/ui-shell/dist --include=*.js 2>/dev/null | head -8; echo count-files: $(grep -rlE 'approveDecision' lib/ui-shell/dist --include=*.js 2>/dev/null | wc -l); grep -rohE 'approveDecision' lib/ui-shell/dist --include=*.js | wc -l
# 04 g_tests
grep -rlE 'approveDecision' tests ui/shell/scripts ui/shell/server 2>/dev/null | grep -v node_modules | head -20; echo; grep -rnE "press\('Enter'|keyboard.press|Space|keydown" tests/e2e-369 tests/test-369-gate* 2>/dev/null | cut -c1-170 | head -12
# 05 run_e2e_gate_button
export HOME=$(mktemp -d /tmp/phase0-home-XXXX); timeout 400 node tests/e2e-369/gate-button.cjs 2>&1 | tail -40
# 06 run_e2e_gate_button_pw
export HOME=$(mktemp -d /tmp/phase0-home-XXXX); export PLAYWRIGHT_BROWSERS_PATH=/home/jsagi/.cache/ms-playwright; timeout 500 node tests/e2e-369/gate-button.cjs 2>&1 | tail -45
