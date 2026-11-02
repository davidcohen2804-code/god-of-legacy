# BASE-01: the base character and its items

BASE-01 is the base character locked by the art director (GPT): `base01_master.png`, with every landmark measured on it
in `template.json` (joints, the cut lines between parts, the limb strips). Everything worn is cut by that one template,
so every item bends with the body under it.

## Adding an item (one picture, one line)

1. Ask the art director for the item **as an edit of the master**: attach `base01_master.png` and ask for the same image
   with only that item added (same stance, size and place, flat magenta). A weapon is drawn on its own, lying flat,
   blade to the right.
2. Save the picture in `items/` and add one line to `items.json`: `id`, `slot` (`top`, `bottom`, `shoes`, `hat`,
   `weapon`), `name`, `picture` (a weapon also gives `grip` [x, y] at the middle of its handle and `grip_thickness`).
3. Build: `python3 build.py <out>` then `python3 pack.py <out> ../../../src/v4/base01/assets`, then
   `node ../build_studio.mjs` (the studio) and `node ../build_lab.mjs` (the lab's game scene).

The exporter lines the picture up with the master (the body outside the item, then each limb on its own), **rejects**
it when the body outside the item does not match the master (it prints the fit, the colour error and the silhouette
mismatch), separates the item from the body with a colour model, and cuts it into the same pieces as the body. No
code changes for an item of a supported slot.

## The animations

`src/v4/base01/anims.ts`: whole-body key poses (pelvis, chest, head, each ankle reached by IK, the arms in world
angles). A held weapon is fixed in the fist. Marks fit the jump and the attacks onto the game's own phases.
