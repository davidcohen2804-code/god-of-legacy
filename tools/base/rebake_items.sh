#!/bin/sh
# rebake_items.sh : re-bake every head item on the current base frames (run after any base-frame change).
cd "$(dirname "$0")/../.."
python3 tools/base/item2.py tools/base/gpt/item_war_hat_tophat_v2.png war_hat_tophat hat v2
NAME="Red Cap" python3 tools/base/item2.py tools/base/gpt/item_hat_cap_red.png hat_cap_red hat v2
NAME="Navy Beanie" python3 tools/base/item2.py tools/base/gpt/item_hat_beanie_navy.png hat_beanie_navy hat v3
NAME="Cat Ears" python3 tools/base/item2.py tools/base/gpt/item_hat_cat_ears.png hat_cat_ears band v5
NAME="Golden Crown" python3 tools/base/item2.py tools/base/gpt/item_hat_crown_gold.png hat_crown_gold band v5
NAME="Sunglasses" DESC="black sunglasses with thin gold frames." python3 tools/base/item2.py tools/base/gpt/item_face_sunglasses.png face_sunglasses face v5
python3 tools/base/item2.py LAYER war_hat_wizard hat
python3 tools/base/item2.py LAYER war_hat_witch hat
CLEAN=strict python3 tools/base/item2.py LAYER war_hat_beret hat
