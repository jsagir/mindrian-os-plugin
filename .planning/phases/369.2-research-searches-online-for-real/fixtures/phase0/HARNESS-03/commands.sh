cd /home/jsagi/dev/MindrianOS-Plugin
echo "provider_unavailable hits (lib scripts commands skills): $(grep -rn provider_unavailable lib scripts commands skills 2>/dev/null | wc -l)"
grep -rn "provider_unavailable" lib scripts commands skills 2>/dev/null | head -20
echo "TAVILY_API_KEY hits in lib scripts:"; grep -rn "TAVILY_API_KEY" lib scripts 2>/dev/null | cut -c1-200 | head -20
grep -n "tavily\|TAVILY" lib/lens-engine/source-lens-driver.cjs | head -20
grep -n "tavily\|industry" lib/core/doctor*.cjs scripts/*doctor* 2>/dev/null | head
cd /home/jsagi/dev/MindrianOS-Plugin/.planning/phases/369.2-research-searches-online-for-real/fixtures/phase0/HARNESS-03 && node 02-no-tavily-key-broad.cjs   # HOME and MINDRIAN_ROOMS_HOME isolated inside _partialB-prelude.cjs; net guard installed
