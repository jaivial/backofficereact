#!/bin/bash
cd /var/www/newvillacarmen/backoffice
export NODE_ENV=production
export PORT=3010
export BACKEND_ORIGIN=http://127.0.0.1:8085
/home/jaime/.local/bin/bun server/index.ts &
BUN_PID=$!
# Keep running as long as bun is alive
wait $BUN_PID
