# The 3D heroes — how they are made

David, 24 Oct: heroes in 3D on a skeleton (clothes and items can change); first a **Beginner** whose items are the
classes' weapons (the sword, the samurai's katana, the bow, the magic staff, the gambler's cane), the rest of the
clothes simple and the same; clothing sets per class later. In the game by default in every 3D place (the PVP 3D room,
the world in 3D) and on the menus' pedestals (`src/arena3d/Hero3D.ts`, `HeroPreview3D.ts`); `?hero3d=0` shows the
painted bodies again.

## The Beginner (`public/assets/hero3d/beginner_m.glb`, `beginner_f.glb`)

1. **Drawings** (`src/beginner_m/`, `src/beginner_f/`): GPT, from the painted Beginners
   (`public/assets/final/heroes/beginner/male.png`, `female.png`): front, back, left and right views, A-pose, plain grey,
   the same frame.
2. **Cut out** (`ai/cut.py`): the flat background flood-filled away (alpha).
3. **Shape**: Hunyuan3D 2.1 (`tencent/Hunyuan3D-2.1` Space, shape only, octree 384, 50 steps) from the front cut-out.
4. **Clean, simplify, unwrap** (`ai/prep.mjs`): the largest piece, 1.8 tall on y = 0 facing +z, 40 000 triangles
   (meshoptimizer), uv atlas (xatlas).
5. **Bake** (`ai/views.py` prepares the views and their boxes; `ai/bake.html` + `ai/bake.mjs`, headless Chromium): the four drawings projected onto the mesh, each where it
   faces its view and is not hidden (a depth map per view), blended by facing; the drawings' colours bled past their
   edges; the right view's stray sash masked.
6. **Rig** (`ai/rigfit.mjs` + `ai/lm_m.json` / `ai/lm_f.json`): the 65-bone skeleton of the Quaternius base body
   (`Superhero_Male_FullBody` / `Superhero_Female_FullBody`, the moves' skeleton)
   fitted into the mesh at landmark joints (hips, knees, ankles, shoulders, elbows, wrists, spine, neck, head — read off
   the front silhouette), every bone turned to aim at its child; the base body posed onto that skeleton and its weights
   carried to the mesh from the closest point (the fingers folded into the hand: the drawn hands are one piece). The
   mesh is first split into its parts by distance along its own surface (an arm is reached only through its shoulder), so
   a sash or a tail hanging by a hand never takes the arm's bones, nor a leg the other's.
7. **Pack** (`ai/pack1.mjs`): texture WebP 2048, meshopt.

The moves stay the library's (`moves_1.glb`, `moves_2.glb`): `Hero3D` keeps their bone turns only and lays their hip
travel onto this body's hips; the moves no library has are built in code on the fitted skeleton (`makeBowShoot`, below).

## The hands (`ai/hands.mjs`)

The drawn hands were one open piece (the fingers folded into the hand: a weapon passed through the open palm). They are
replaced by the hands of the Quaternius base body the skeleton comes from (CC0): `node hands.mjs BODY.glb BASE.gltf
OUT.glb` drops the drawn hand's triangles, lays each base hand into the Beginner's (its wrist, its knuckles' line, its
size), weights it to the fingers' own bones and colours it from the drawn hand (the glove, the bare fingertips).

In the game (`Hero3D`) a hand holding a weapon is closed on it in every move: the library's grip (the sword stance's
right fist, the shield stance's left) opened as far as the weapon's grip is thick (`fitHand`: the fingers' hollow, a
circle through their joints, made the grip's thickness with the fingers' own around it — a hilt in a closed fist, the
staff, the cane and the bow's riser in a hand half open round them), the grip laid through the hollow's middle.

When the weapon is not swung the arm holds it (`HOLDS`, `makeHolds`): a blade hanging point down and forward (standing,
walking) or forward and up at the foe in the guard, the staff upright planted on the floor (gripped high on its shaft),
the cane and the bow upright at the side. Each hold is found at load on the body's own skeleton by a small search (the
shoulder's turn, the elbow's bend, the forearm's twist; the hand then turned the least it must be) for the turns that
leave the wrist as a wrist bends; the weapon is then turned about its own length (its grip is round in the fist) to
show its face to the viewer — a blade's flat, the bow's curve with its string away from the body.

## The weapons (`public/assets/hero3d/w_*.glb`)

Each drawn by GPT flat on grey (`src/weapons/`), cut out, then made solid by `weapons/inflate.py`: the silhouette
inflated — round where it is narrow (a grip, a guard, a shaft), a thin lens where it is a blade — the drawing on its
front and, mirrored, on its back; `weapons/wpnglb.mjs` welds, simplifies (2–3 000 triangles) and adds what the drawing
shows edge-on (the katana's guard disc, the bowstring). The origin is where the hand grips; +y runs to the weapon's
business end (the point, the head, the knob).

| Weapon | Length | Grip (drawing px) | Extra |
|---|---|---|---|
| sword | 1.0 m | 511, 1167 (just under the guard) | blade above row 1092, 2.8 mm |
| katana | 1.0 m | 560, 1124 | blade above row 1034; guard disc r 4.2 cm |
| bow | 1.25 m | 494, 712 (the riser) | string 2.5 mm, replaced in game by a drawn line |
| staff | 1.6 m | 507, 740 | |
| cane | 1.0 m | 510, 320 (under the knob) | |

## The pictures (`public/assets/hero3d/art/`)

The heroes' splash and faces with the 3D heroes on (`src/arena3d/heroArt3d.ts`): the VS screen, the loading VS, the
result, the fighter select's tiles and fighters, the HUD's portraits. One picture per body and weapon
(`m_sword.webp` … `f_cane.webp`, 1024 × 1536, transparent): the Beginner painted by GPT (David 25 Oct: the 3D renders
looked "horrible… it must look a million dollars") in the chats that drew its sheets — the same face, hair and basic
outfit, the class's weapon, a battle pose of its own facing right, "polished hand-painted Korean MMO key art",
transparent background. `art/splash.py IN OUT.webp [face_x face_y]` frames each alike (the body 88 % of the height, the
feet at 97.5 %, the chest in the middle, a staff's or a bow's top inside) and finds the face (the topmost blob of warm
skin, from the brow down) for the portraits' square — given by hand where a drawing hand hides the face (the archers).
(`art/art.html` + `art/art.mjs` rendered the 3D Beginner for them before: still there for close looks at the 3D body.)

## Twins (`Hero3D.clone`)

Kagemusha's doubles are twins of the samurai's own 3D body: the same shape, textures, weapons and moves, a skeleton of
their own (`src/arena3d/Doubles3D.ts`, two layers of the room: behind and in front of the fighter they stand round).

## More moves (`moves_4.glb`) and moves cut from longer ones

`moves4.mjs` packs more of the libraries' moves for the skills' own moves (the heavy combo, the thrusting dash, the
low lunging cut, the guard stance, the bend that drives the blade into the floor, a kneel, the blade held upright before
the chest, a slide); `Hero3D`'s `SUBCLIPS` cuts a skill's own part out of a longer move (the heavy combo's overhead
smash into the floor, its sword raised to the sky — held as long as the skill lasts — its rising chain; the first cut's
rising end; the dash's crouch, thrust and pointing). The move files keep only the moves played and only the bones'
turns and the hips' travel (`build.mjs`, `moves3.mjs`, `moves4.mjs`: a dropped move's keys no longer stay behind — the
four files are 1.4 MB, the three were 5.8 MB).

## Moves built on the skeleton (`Hero3D.makeBowShoot`)

What no library has is built at load on each body's own skeleton, an arm or a leg reached where it goes through its own
two bones from a library stance held at a moment: the bow's shots (`BOW_SHOTS`: level, down at the floor, up at the
sky; in a leap with the legs drawn up — level, down, up; kneeling; the deep stance of a long charge — the bow tilted
across the arrow), Retreat Kick's rising kick that turns into a tucked back flip (`Kick_Flip`), the call to the sky
(`Hold_Call`: the hand raised high and held — Spirit Hawk, Time Collapse, Jackpot), and the free hand's moves (`lefty`:
Astral Burst's seize, a flicked card, cards thrown backhand like a saw blade, the coin flip, an underhand roll), the
vault's double kick (`Vault_Kick`). `SKILL_MOVE` gives every class skill its move; `BEAT` times a volley or a flurry
(its first blow, then one every so often); `ARM_AWAY` takes the weapon out of the hand while the skill's effect stands
for it (Rotor Staff's spinning disc). `art/art.html`'s `castStrip` films a skill's move as a strip of frames.
