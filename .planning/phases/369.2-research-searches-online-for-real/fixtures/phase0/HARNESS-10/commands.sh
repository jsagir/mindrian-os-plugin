cd /home/jsagi/dev/MindrianOS-Plugin
echo "baseline hits in research-planner lib: $(grep -rniE 'baseline' lib/core/research-planner | wc -l)"; grep -rniE 'baseline' lib/core/research-planner | cut -c1-200 | head -20
echo "landscape|field.scan|state.of.the.art in research-planner + SR: $(grep -rniE 'landscape|field scan|field_scan|state of the art|state-of-the-art' lib/core/research-planner lib/core/rs-*.cjs 2>/dev/null | wc -l)"
grep -rniE 'landscape|field scan|field_scan|state of the art|state-of-the-art' lib/core/research-planner | cut -c1-200 | head
grep -n "rankByUnlock" lib/core/research-planner/*.cjs | head
head -30 tests/test-363-baseline.cjs
