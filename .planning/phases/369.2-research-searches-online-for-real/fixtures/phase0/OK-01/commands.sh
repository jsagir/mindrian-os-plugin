# 01 g_scope
grep -rnIiE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next 'write.scope|writeScope|write_scope' hooks scripts lib --include=*.cjs --include=*.json --include=*.sh -l | head -15; grep -n 'write-scope\|write_scope\|writescope' -i hooks/hooks.json | head
# 02 g_guard
grep -nE "permissionDecision|decision|deny|block|outside the active room|active room" scripts/write-scope-check.cjs | cut -c1-170 | head -20; wc -l scripts/write-scope-check.cjs; ls scripts | grep -c write-scope; ls scripts/write-scope-check* tests | grep -iE 'write-scope|scope-check' 
# 03 run_test
export HOME=$(mktemp -d /tmp/phase0-home-XXXX); for t in $(ls tests | grep -iE 'write-scope' | head -3); do echo == $t; timeout 120 node tests/$t 2>&1 | tail -4; done
