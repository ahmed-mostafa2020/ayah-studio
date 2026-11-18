#!/usr/bin/env bash
cd "$(dirname "$0")"
( sleep 1.5; (command -v open >/dev/null && open http://localhost:4747) || (command -v xdg-open >/dev/null && xdg-open http://localhost:4747) ) &
exec node studio/server.mjs
