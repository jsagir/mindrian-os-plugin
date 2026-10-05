grep -rnE "room_switched|resolveWriteRoom|rooms switch|rooms-open|/mos:rooms (switch|open)" scripts/write-scope-check.cjs lib/core/write-scope*.cjs 2>/dev/null
grep -rln 'write-scope' scripts lib hooks --include=*.cjs --include=*.json --include=*.sh 2>/dev/null | grep -v test | head -20
# --- e2e: deny -> prescribed remediation (set-active, same script /mos:rooms switch runs) -> retry ; 3.12 vs 3.9
R=/home/jsagi/dev/MindrianOS-Plugin; TB=$(mktemp -d /tmp/phase0-bin-XXXX); ln -s /home/jsagi/.local/bin/python3.9 $TB/python3
for PY in 312 39; do
  export HOME=$(mktemp -d /tmp/phase0-home-XXXX); export MINDRIAN_ROOMS_HOME=$HOME/MindrianRooms; mkdir -p $MINDRIAN_ROOMS_HOME/a $MINDRIAN_ROOMS_HOME/b
  bash $R/scripts/room-registry create a $MINDRIAN_ROOMS_HOME/a A idea >/dev/null; bash $R/scripts/room-registry create b $MINDRIAN_ROOMS_HOME/b B idea >/dev/null; bash $R/scripts/room-registry set-active a >/dev/null  # python3.12
  PP=$PATH; [ $PY = 39 ] && PP=$TB:$PATH
  PAYLOAD="{\"tool_name\":\"Write\",\"session_id\":\"phase0-none\",\"tool_input\":{\"file_path\":\"$MINDRIAN_ROOMS_HOME/b/note.md\"}}"
  echo "--- py=$PY step1 write to b (active a)"; echo "$PAYLOAD" | env -u CLAUDE_CODE_SESSION_ID -u CLAUDE_SESSION_ID PATH=$PP node $R/scripts/write-scope-check.cjs; echo exit=$?
  echo "--- step2 remediation: set-active b"; env PATH=$PP bash $R/scripts/room-registry set-active b; echo exit=$?
  echo "--- step3 retry write to b"; echo "$PAYLOAD" | env -u CLAUDE_CODE_SESSION_ID -u CLAUDE_SESSION_ID PATH=$PP node $R/scripts/write-scope-check.cjs; echo exit=$?
done
