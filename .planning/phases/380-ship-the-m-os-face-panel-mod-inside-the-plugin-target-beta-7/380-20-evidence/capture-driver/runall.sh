#!/bin/bash
S=$S
cd $S; export PLAYWRIGHT_BROWSERS_PATH=/home/jsagi/.cache/ms-playwright
for n in "$@"; do echo "=== $n $(date +%T) load $(cut -d' ' -f1-3 /proc/loadavg)"; node drive.cjs specs/$n.json 2>&1 | tail -30; echo "exit ${PIPESTATUS[0]}"; done
