export HOME=$(mktemp -d /tmp/phase0-home-XXXX)
cp probe.cjs.txt probe.cjs && node probe.cjs   # see 01-probe.out
