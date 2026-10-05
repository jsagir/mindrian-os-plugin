# 01 g_block
grep -nE "decision|block|process.exit|exit\(|try|catch|degrade|surface_degraded|rendering your choices|selectable card" scripts/check-card-fire.cjs | head -80
# 01 g_block
grep -nE "rendering your choices|selectable card|stop_hook_active|background|subagent|surface_degraded|decision: *'block'|MAX_SESSION_INTERCEPTS *=|MAX_FORCE_RETRIES *=" scripts/check-card-fire.cjs scripts/on-stop lib/mcp/tools/stop-gate.cjs | cut -c1-220
# 02 run_numbered
export HOME=$(mktemp -d /tmp/phase0-home-XXXX); echo $HOME >&2; unset MINDRIAN_MCP_FIRST; printf '%s' '{"hook_event_name":"Stop","session_id":"p0-s1","output_text":"Pick one:\n[1] Continue\n[2] Stop\n","ran_entries":[],"askuserquestion_fired":false}' | node scripts/check-card-fire.cjs; echo; ls $HOME/.mindrian 2>&1
# 03 run_garbage
export HOME=$(mktemp -d /tmp/phase0-home-XXXX); unset MINDRIAN_MCP_FIRST; printf '%s' 'not json' | node scripts/check-card-fire.cjs; echo
# 04 run_numbered_x4
export HOME=$(mktemp -d /tmp/phase0-home-XXXX); unset MINDRIAN_MCP_FIRST; for i in 1 2 3 4; do printf '%s' '{"hook_event_name":"Stop","session_id":"p0-s2","output_text":"Pick one:\n[1] Continue\n[2] Stop\n","ran_entries":[],"askuserquestion_fired":false}' | node scripts/check-card-fire.cjs; echo "  -> rc=$?"; done
# 05 test_interceptor
export HOME=$(mktemp -d /tmp/phase0-home-XXXX); node tests/test-ga4-card-fire-interceptor.cjs 2>&1 | tail -25
# 06 test_retry_ceiling
export HOME=$(mktemp -d /tmp/phase0-home-XXXX); node tests/test-198-stop-gate-retry-ceiling.test.cjs 2>&1 | tail -12
# 07 run_transcript
export HOME=$(mktemp -d /tmp/phase0-home-XXXX); unset MINDRIAN_MCP_FIRST; for i in 1 2 3 4; do printf '%s' '{"hook_event_name":"Stop","session_id":"p0-s3","transcript_path":"/tmp/claude-1000/-home-jsagi/cd7fca86-da84-4084-9260-f655b86621f9/scratchpad/p0-transcript.jsonl"}' | node scripts/check-card-fire.cjs 2>&1; echo "  -> rc=$?"; done; cp /tmp/claude-1000/-home-jsagi/cd7fca86-da84-4084-9260-f655b86621f9/scratchpad/p0-transcript.jsonl /dev/null
