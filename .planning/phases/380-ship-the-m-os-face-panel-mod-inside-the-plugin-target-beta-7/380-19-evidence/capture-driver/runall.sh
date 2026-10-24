#!/bin/bash
S=/tmp/claude-1000/-home-jsagi/c03816a4-113f-4230-9448-0156b88f0247/scratchpad/s10
cd $S; export PLAYWRIGHT_BROWSERS_PATH=/home/jsagi/.cache/ms-playwright
for n in "$@"; do echo "=== $n $(date +%T) load $(cut -d' ' -f1-3 /proc/loadavg)"; node drive.cjs specs/$n.json 2>&1 | tail -30; echo "exit ${PIPESTATUS[0]}"; done
