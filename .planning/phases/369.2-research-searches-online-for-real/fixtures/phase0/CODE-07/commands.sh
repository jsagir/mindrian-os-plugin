export HOME=$(mktemp -d /tmp/phase0-home-XXXX)
cd /home/jsagi/dev/MindrianOS-Plugin/.planning/phases/369.2-research-searches-online-for-real/fixtures/phase0/CODE-07
node probe.cjs            # 01-probe.out
node probe-web.cjs        # 02-web.out
# grep.txt: greps in brain-client.cjs, research-planner, rs-egress-prompts
