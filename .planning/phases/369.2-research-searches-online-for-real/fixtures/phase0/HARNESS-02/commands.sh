cd /home/jsagi/dev/MindrianOS-Plugin
for t in operation_id refused_before_fetch not_executed executed_empty executed_with_results; do echo "$t: $(grep -rn "$t" lib scripts commands skills hooks 2>/dev/null | wc -l)"; done
grep -rn "operation_id\|refused_before_fetch\|not_executed\|executed_empty" lib scripts 2>/dev/null | head -30
grep -n "^function\|^const .*= *function\|module.exports" lib/core/research-planner/audit-ledger.cjs
sed -n 1,40p lib/core/research-planner/audit-ledger.cjs
grep -n "auditLedger\.\|audit-ledger" lib/core/research-planner/deep.cjs lib/core/research-planner/quick.cjs | head
