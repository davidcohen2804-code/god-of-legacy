#!/bin/sh
# Candidate B's real-art atlases from the two parts sheets drawn for B: cut (build_parts.py), then pack (pack.py).
# Usage, from the repository root: tools/v4/parts/make_b.sh [work dir]
# Writes src/v4/real/assets/b256.png, b512.png and b.json (frames, pivots and the rig geometry measured on the parts).
set -e
D=$(dirname "$0")
W=${1:-$(mktemp -d)}
python3 "$D/build_parts.py" "$D/sheets/b_parts_basic.png" basic "$D/cfg_basic.json" "$W" > /dev/null
python3 "$D/build_parts.py" "$D/sheets/b_parts_golden.png" gold "$D/cfg_gold.json" "$W" > /dev/null
python3 "$D/pack.py" "$W" src/v4/real/assets
