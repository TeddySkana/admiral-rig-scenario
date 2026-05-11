#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
echo "Starting Skana Admiral's Rig Protection Scenario at http://localhost:8000"
python3 -m http.server 8000
