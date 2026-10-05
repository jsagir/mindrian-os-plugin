# 01 g_grants
grep -nE '^function |^async function |module.exports|grant_request|status' lib/core/research-planner/grants.cjs | cut -c1-150 | head -30; echo; grep -nE "op === '(grant_request|file|run_quick|basket)'|case '(grant_request|file|run_quick|basket)'|no_grant|grant_required|not_granted|no_basket_approval|approval" lib/mcp/tools/research.cjs | cut -c1-170 | head -25
# 02 g_filekey
grep -nE 'grant_never_authorizes_filing|FILING_KEY_RE *=' lib/core/research-planner/grants.cjs; grep -nE 'function opFile' -A14 lib/mcp/tools/research.cjs | cut -c1-170 | head -24
# 03 run_test
export HOME=$(mktemp -d /tmp/phase0-home-XXXX); timeout 200 node tests/test-363-grants.cjs 2>&1 | tail -5
