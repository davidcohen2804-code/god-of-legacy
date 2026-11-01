#!/bin/sh
# Candidate B's real-art atlases from the parts sheets drawn for B (basic clothing, Golden Warrior, Ember Duelist) and the hand
# sheets (bare, gauntlets, fingerless gloves): cut (build_parts.py, build_hands.py), then pack (pack.py).
# Usage, from the repository root: tools/v4/parts/make_b.sh [work dir]
# Writes src/v4/real/assets/b256.png, b512.png and b.json (frames, pivots and the rig geometry measured on the parts).
set -e
D=$(dirname "$0")
W=${1:-$(mktemp -d)}
python3 "$D/build_parts.py" "$D/sheets/b_parts_basic.png" basic "$D/cfg_basic.json" "$W" > /dev/null
python3 "$D/build_parts.py" "$D/sheets/b_parts_golden.png" gold "$D/cfg_gold.json" "$W" > /dev/null
python3 "$D/build_parts.py" "$D/sheets/b_parts_ember.png" ember "$D/cfg_ember.json" "$W" > /dev/null
python3 "$D/test_standins.py" "$W" > /dev/null
mkdir -p "$W/head"
python3 "$D/build_head.py" "$D/sheets/b_head_expressions.png" "$D/sheets/b_head_layers.png" "$W/head" > /dev/null
cp "$W/head/parts_head.json" "$W/parts_head.json"
mkdir -p "$W/hands"
python3 "$D/build_hands.py" "$D/sheets/b_hands.png" "$W/hands" ember="$D/sheets/b_hands_ember.png" > /dev/null
cp "$W/hands/parts_hands.json" "$W/parts_hands.json"
python3 "$D/pack.py" "$W" src/v4/real/assets
