# The chibi heroes (paper dolls)

David 29 Oct: "one character done properly" — the warrior as a chibi in the style of his reference game (Prometheus /
AllFiring), built so its clothes can change later: **GPT paints each body part once; the parts are joined on a skeleton
and every move is posed from them**, so a part (and later a piece of clothing drawn on that part) is the same in every
frame and always fits.

## Pipeline (the warrior)
1. **GPT** (the "Draw Character Sheet" chat, images pulled as base64 through the browser — never the download button):
   `src/warrior_design.jpg` (the chibi design, from `tools/heroes/models/warrior.png`), `src/warrior_parts.png` (the parts
   sheet: two heads — calm and shouting —, torso, hips, cape, upper arm, forearm, fist, open hand, thigh, shin, boot,
   sword; round joint ends), `src/warrior_vs.jpg` (battle stance), `src/warrior_win.jpg` (victory), and
   `src/menu_warrior_edit.jpg` (the title painting's cliff with him on it).
2. `python3 cut.py src/warrior_parts.png work/cut 800` — the pieces off the green.
3. `python3 build_warrior.py` — each piece made ready (the skin-coloured joint caps painted over with the limb's own
   colours, the upper piece's lower end faded into the one under it: no seams, no rings) and the skeleton
   (`work/rig_w/warrior.json`: pivots and joints in each piece's px; the sheet's limbs were too long for a chibi, so
   thighs, shins and forearms are shortened, not thinned, and the head is drawn 1.6x).
4. `node rig/render_atlas.mjs work/rig_w/warrior.json rig/moves_w.mjs work/out_atlas 0.5` — every move of
   `rig/moves_w.mjs` (the game's action names and frame counts; poses as joint angles) drawn at 2x, each frame cut to its
   box with its feet anchor (the ground under the hips; grounded frames stand on their lowest heel or toe) and the
   sword's line (grip → point). Copy `rig/rig.js`, `rig/blank.html` next to the json first.
5. `python3 rig/pack.py work/out_atlas body.png entry.json 230` — the frames at a 230 px standing height packed into
   one 4096-wide atlas → `public/assets/final/heroes/warrior/body.png` and the `warrior` entry of
   `src/data/hero-atlas.json` (keep its `card`).
6. `python3 key.py IN OUT --fit W H` — a GPT picture off its green (the VS splash, the victory pose, the card, the
   select preview).

`rig/sheet.py DIR out.png act1,act2 [scale]` lays frames out in rows (each action a row, on its ground line) to check them.

## Posing (`rig/moves_w.mjs`)
- **Stances by the feet** (`st: ST(h, ankleNear, ankleFar, footNear°, footFar°)`): the hips' height over the floor (~500
  stands straight, ~380 squats, ~290 kneels) and where each ankle stands; `rig.js placeFeet` solves both legs to the
  ground (2-bone IK, knees forward), so a lunge or a crouch keeps both feet planted. A foot angle lifts its heel (the back
  foot pushing off). Airborne frames (`air`) keep posing the legs by their angles.
- **The whole body in every blow:** `r` leans the whole figure from the hips, `x` shifts the hips; the wind-up coils back
  onto the back foot, the blow steps into a lunge, the follow-through overshoots lower.
- **Two hands on the hilt** (`grip: true`): `rig.js gripB` reaches the far hand to the sword's grip behind the near one.
- **The head over the arms** by default (a chibi's big head: an arm raised or brought down across it goes behind it);
  `hb` puts it back under them. `_flip` draws a frame facing the other way (Whirlwind's and Blade Storm's turned frames).
- Each frame also carries the sword's line (grip → point: Radiant Blade's light) and the eyes' middle (`EYE`, in the head
  piece's px: War Cry lights them) — the atlas entry's 7th and 8th fields.
