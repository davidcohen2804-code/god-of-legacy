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
   bend); a weapon's profile is its motion kit, the way the body holds and swings it: `sword_1h` (one hand, slash),
   `dagger_1h` (one hand, forward grip, quick piercing thrust), `staff_2h` (both hands, forward thrust); its grip is
   found from the drawing. An exceptional item's extra data goes in `overrides.json`
   by id. (`items.json` is the older form, read only when there is no `catalog.csv`.)
3. Build: `python3 build.py <out>` then `python3 pack.py <out> ../../../src/v4/base01/assets`, then
   `node ../build_studio.mjs` (the studio) and `node ../build_lab.mjs` (the lab's game scene). A trial build of another
   catalog: `B01_CATALOG=<file> python3 build.py <out>`.
4. The package (what a reviewer checks): `node previews.mjs <renders>` (the studio served on port 4201) draws every item
   worn alone with the game's own runtime, then `python3 package.py <out> <renders> package` writes
   `package/manifest.json` (schema `base01-package/1`: template, exporter and master versions; per item its slot,
   profile, motion kit, source picture and checksum, parts with their sizes and anchors, the body pieces it covers,
   every check the exporter measured and the warnings in plain words; the rejected rows with their reasons),
   `package/previews/<id>_600.png` and `_150.png` (build outputs, not kept in the repository), and `package/previews.jpg`
   (all of them on one sheet, kept with the manifest).

## The asset contract (BASE-01, template v1, exporter 1.8)

- The skeleton and the anatomy are the master's and never change (`template.json`, versioned); every package records
  the template and exporter versions, the master's hash and each source picture's hash.
- Alignment and checks: a picture is lined up with the master (the body outside the item, then each limb) and
  **rejected**, with the reason in plain words, when the body outside the item is not the master (median colour error
  40 or more, or 2% of the figure's shape different; an item reaching past the body, such as big shoulder plates, is
  the item, not a different figure: pieces off the body, joined to the item, coloured unlike skin, hair and shorts).
- The body check (exporter 1.6): outside the item the body keeps the master's proportions and pose. Each trunk and leg
  part (head, chest, hips, thighs, shins) not covered by the item must sit within 3 master px of the master's after the
  body fit (its drawn lines fitted on their own), and each limb wholly outside the item within 3 degrees of the
  master's pose. An exact edit of the master sits within 1.7 px and 0.2 degrees; the made defects X01 (torso 4%
  shorter, legs as much longer) and X02 (an arm turned 6 degrees) are caught. The report keeps every measure
  (`geometry_px`, `pose_deg`, `limb_fit`, `part_shift`, `reach_px`).
- Cutting: the item is told apart from the body with a colour model; small holes are filled, a large enclosed area
  on the trunk (the bare chest inside a harness, an open vest) stays body, while one inside a top's sleeve or a
  bottom's trouser leg (or off the master's figure) is the garment itself, coloured like skin (pale cloth over the
  legs), and is filled; footwear and headwear keep their openings (the skin between a sandal's straps); skin-coloured pixels along its edge that match the master's skin are
  body. It is cut by the same part map as the body, into the same pieces (limb strips widen for a flared sleeve or a
  wide trouser leg). A sleeve is a sleeve only when it reaches a third of the way down the arm and wraps it (covers half
  or more of the arm just below the shoulder); a sleeveless top's armhole edge or side panel rides the chest.
- Rigid tops: each shoulder plate (the plates its outlines enclose that reach the shoulder and lie a quarter or more on
  the upper arm) is one piece on its own slot, turning 0.55 of the arm; under it the chest plate carries on (a harness
  leaves the body bare); the rest of an arm's plates are cut at the elbow, and only solid plates are kept there (a
  piece of 400 px or more once thin strokes are opened away, with its outline) that covers a quarter or more of the
  bare arm where it lies (a bracer, an arm plate); a narrower piece is the shoulder plate's edge: joined to the
  shoulder plate it rides with it, loose it is a stray stroke and is not drawn.
- Coverage: the parts of the body an item covers 85% or more hide the bare piece under them (`covers`). Trousers have a
  hidden 10 px underlap, drawn only under a top.
- Light garments (tops and trousers with a median L* above 72) get a crisp warm dark outline (7 master px) and slightly
  deeper fold shadows, for gameplay size on pale floors.
- Weapons: scaled so the drawn handle fits the fist (30 master px), pivot at the grip; never animated on their own.
  The profile picks the body's motion kit (idle, run, jump and attack made for that kind of weapon); a new weapon of
  a known kit needs no animation work. A staff is held with both hands: the far fist closes on the shaft 0.167 of the
  body height above the near one, solved onto it in every frame (`hold` in the animation), drawn over the shaft.
- Determinism: an item's cut depends on its own picture only (the colour models start from a fixed seed), so adding,
  removing or rejecting a source changes no other item; a subset built in another order is byte-identical.
- Pipeline checks (`checks.py`): R14 source integrity (`python3 checks.py r14 <build>`: the build used the repository's
  template and master; every row's picture is present, at the master's size and the very file the build cut; the
  game's atlas is exactly what the build generated, frame by frame and pixel by pixel; it holds every accepted item and
  nothing of a rejected source; the package manifest names the same versions and sources) and R16 failure isolation
  (`python3 checks.py r16 <build A> <build B>`, B built from the catalog with every negative fixture mixed in: the same
  items accepted, every accepted piece, check and packed frame identical, no piece of a rejected source anywhere).
- Regression (the lab's tests R1 to R13, and R17 for skirts) over every mix of the catalog and every animation. The art director's ten
  stress items (`items/stress/`) are permanent fixtures: every exporter change must still accept them.
- Rejections, each with its reason in plain words and its check (`check` in the report: catalog row, slot, background,
  orientation, alignment, pose, proportions, body colour, figure, no item, face, weapon orientation): a row with an
  unknown slot or profile, or a profile that does not fit its slot; a row whose slot does not fit its picture
  (exporter 1.8: 30% or less of what differs from the master lies where the row's slot goes, 60% or more where another
  slot goes, as a top catalogued as footwear); a picture whose background is not the flat
  magenta (its border, 12 px all round: white, another flat colour, a gradient or a scene); a mirrored picture (the
  character faces the other way: flipped back it lines up clearly better); a picture that cannot be lined up with the
  master; a figure whose shape outside the item is not the
  master's; no item in the picture; a weapon not drawn level; headwear whose face is not the master's (where the face
  shows, its drawn lines must match the master's at 0.7 or more and be at least 0.8 as strong: a blurred face fails;
  and, exporter 1.8, each feature the headwear leaves half or more uncovered (the eyes, the near brow, the nose, the
  mouth: windows measured on the master) must match the master's in its own window at 0.85 or more, within 2 px of
  its place: a valid hat 0.97 or more; eyes drawn 1.25 times larger or a mouth 6 px lower fail);
  a body whose proportions or pose differ from the master's.
  Negative fixtures: `catalog_negative.csv` (every row rejected but `neg08`, a smaller drawing that is lined up and
  accepted): `B01_CATALOG=catalog_negative.csv python3 build.py <out>`. The art director's made defects (X01, X02, ...)
  come from `make_invalid.py`: controlled changes of valid pictures, the same every time, each recorded in
  `items/gate5/invalid/made.json` (X05 is a valid top with a footwear row; X07 the hat with the face under it changed).
- Split coats: each tail panel hangs from its hip joint, turns 0.45 of its thigh and swings up to 10 degrees behind it.
  Full helmets drawn smaller than the master's head are enlarged about the neck by up to 8%.
- Skirts (exporter 1.7, the art director's skirt garment profile): a bottom whose cloth closes the gap between the
  thighs down to a hem above the knees, where the gap opens at once (by 0.015 B or more within 0.006 B of height) onto
  other cloth or the bare legs (the cloth above and below the opening differ: median Lab distance 12 or more, both
  ways) and covers the thighs from side to side above the hem (70% or more), is a skirt. It is cut on its own from the
  same picture: its waistband (a graph cut between the band's colours and the skirt's) stays the hips' rigid piece,
  the skirt hangs from the waistband's lower edge, and the trouser legs keep what is below the hem, carried on up to
  the hips in their own cloth (one profile across the leg, outline and all, laid across the bare leg's width), so a
  thigh swung out from under the skirt shows trousers, never the body; under a skirt a leg counts as covered by its
  trousers alone. At runtime (`pelvis.skirt`, `SlotDef.skirt`) the skirt is one fan of 25 columns, each turning about
  its own point on the hang line: the back edge as far back as the thigh swung furthest back, the front edge as far
  forward as the thigh swung furthest forward, the columns between in proportion (never one leg alone, never crossing);
  a thigh lifted past 30 degrees lifts its edge an eighth as much again and the cloth on that side rides up over it
  (0.03 B per radian, hidden under the waistband); a thigh pushes its edge out at once and the cloth falls back keeping
  75% of each frame's turn, at most 11 degrees behind. Side panels (they leave the gap between the legs open) and wide
  trouser legs (their gap opens gradually, in the same cloth) are not skirts: each panel stays on its own leg. The
  report gives every bottom's measures and, when it is not a skirt, why (`skirt` in the report). The lab's R17 checks
  every skirt through idle, the long-stride run, the jump tuck, the landing crouch and both attacks.

The exporter lines the picture up with the master (the body outside the item, then each limb on its own), **rejects**
it when the body outside the item does not match the master (it prints the fit, the colour error and the silhouette
mismatch), separates the item from the body with a colour model, and cuts it into the same pieces as the body. No
code changes for an item of a supported slot.

## The animations

`src/v4/base01/anims.ts`: whole-body key poses (pelvis, chest, head, each ankle reached by IK, the arms in world
angles). A held weapon is fixed in the fist. Marks fit the jump and the attacks onto the game's own phases.
