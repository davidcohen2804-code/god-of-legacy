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
travel onto this body's hips; the bow's draw-and-shoot is built in code on the fitted skeleton (`makeBowShoot`).

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
(`m_sword.webp` … `f_cane.webp`, 1024 × 1536, transparent), the Beginner held still in a move facing right, framed
whole, lit like a stage (`art/art.html`, `Hero3D.pose`); `art/art.mjs` renders them under the Vite dev server and
writes each picture's head (`meta.json`: the portrait's square, copied into `heroArt3d.ts`).

## Twins (`Hero3D.clone`)

Kagemusha's doubles are twins of the samurai's own 3D body: the same shape, textures, weapons and moves, a skeleton of
their own (`src/arena3d/Doubles3D.ts`, two layers of the room: behind and in front of the fighter they stand round).
