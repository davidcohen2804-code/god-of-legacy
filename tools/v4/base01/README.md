# BASE-01: the base character and its items

BASE-01 is the base character locked by the art director (GPT): `base01_master.png`, with every landmark measured on it
in `template.json` (joints, the cut lines between parts, the limb strips). Everything worn is cut by that one template,
so every item bends with the body under it.

## Adding an item (one picture, one row)

1. Ask the art director for the item **as an edit of the master**: attach `base01_master.png` and ask for the same image
   with only that item added (same stance, size and place, flat magenta). A weapon is drawn on its own, lying flat,
   blade (or head) to the right.
2. Save the picture in `items/` and add one row to `catalog.csv`: `id, slot, profile, body, name, picture`. Slots:
   `top`, `bottom`, `shoes`, `hat`, `weapon`. Profiles: `cloth` (bends with the body), `rigid` (plates that do not
   bend), `weapon` (its grip is found from the drawing). An exceptional item's extra data goes in `overrides.json`
   by id. (`items.json` is the older form, read only when there is no `catalog.csv`.)
3. Build: `python3 build.py <out>` then `python3 pack.py <out> ../../../src/v4/base01/assets`, then
   `node ../build_studio.mjs` (the studio) and `node ../build_lab.mjs` (the lab's game scene). A trial build of another
   catalog: `B01_CATALOG=<file> python3 build.py <out>`.

## The asset contract (BASE-01, template v1, exporter 1.2)

- The skeleton and the anatomy are the master's and never change (`template.json`, versioned); every package records
  the template and exporter versions, the master's hash and each source picture's hash.
- Alignment and checks: a picture is lined up with the master (the body outside the item, then each limb) and
  **rejected**, with the reason in plain words, when the body outside the item is not the master (median colour error
  40 or more, or 2% of the figure's shape different).
- Cutting: the item is told apart from the body with a colour model; small holes are filled, a large enclosed area
  (the bare chest inside a harness) stays body; skin-coloured pixels along its edge that match the master's skin are
  body. It is cut by the same part map as the body, into the same pieces (limb strips widen for a flared sleeve or a
  wide trouser leg). A sleeve is a sleeve only when it reaches a third of the way down the arm.
- Rigid tops: each shoulder plate (the plates its outlines enclose that reach the shoulder and lie a quarter or more on
  the upper arm) is one piece on its own slot, turning 0.55 of the arm; under it the chest plate carries on (a harness
  leaves the body bare); the rest of an arm's plates are cut at the elbow.
- Coverage: the parts of the body an item covers 85% or more hide the bare piece under them (`covers`). Trousers have a
  hidden 10 px underlap, drawn only under a top.
- Light garments (tops and trousers with a median L* above 72) get a crisp warm dark outline (7 master px) and slightly
  deeper fold shadows, for gameplay size on pale floors.
- Weapons: scaled so the drawn handle fits the fist (30 master px), pivot at the grip; never animated on their own.
- Regression (the lab's tests R1 to R8) over every mix of the catalog and every animation.

The exporter lines the picture up with the master (the body outside the item, then each limb on its own), **rejects**
it when the body outside the item does not match the master (it prints the fit, the colour error and the silhouette
mismatch), separates the item from the body with a colour model, and cuts it into the same pieces as the body. No
code changes for an item of a supported slot.

## The animations

`src/v4/base01/anims.ts`: whole-body key poses (pelvis, chest, head, each ankle reached by IK, the arms in world
angles). A held weapon is fixed in the fist. Marks fit the jump and the attacks onto the game's own phases.
