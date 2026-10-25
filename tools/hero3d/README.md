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

## The head (`ai/head.mjs`)

The drawn head came out of one full-body drawing with too few pixels for a face (the eyes smeared, the hair a lump with
grey streaks of the drawing's ground). It is replaced by the head of the Quaternius base body (CC0: a modelled face, its
eyes and brows) and a base hair piece, laid on the Beginner's neck at its size and coloured to its skin (the bare
forearms') and its hair (the drawn head's dark); their textures go in a band added under the atlas.
`node head.mjs BODY.glb BASE.gltf HAIR.gltf OUT.glb` (env below) — the man: `HEAD_K=1.2 SKIN_TEX=T_Superhero_Male_Ligh.png`
with `Hair_SimpleParted`; the woman: `HEAD_K=1.2 SKIN_TEX=T_Superhero_Female_Light_BaseColor.png PONY=1 HAIR_DROP_X=0.05
PONYTAIL=1` with `Hair_Buns` (its buns dropped).

- The drawn neck stays (painted skin) and the base neck goes into it, made as thick as it at each height; the drawn
  hair round the neck goes, the shirt's collar stays; the collar and the neck round the new neck smoothed (Taubin).
- The face's skin: the base texture moved to the Beginner's skin, its broad tones evened out (the face was painted
  lighter in the middle than round the jaw), from the texels of its own pieces only.
- The woman (`PONY`): the drawing's ponytail flew 30 cm out behind her head — its strands out behind go, those lying on
  the back are pressed into it (a smooth surface through the back round them) and painted the shirt; then (`PONYTAIL`)
  a ponytail is made on the head as she is drawn: tied high at the back of the pulled-back hair with a red tie (the
  sash's red), falling down her back in seven clumps that spread and come together at their tips, drawn from the hair
  texture's long locks; it hangs on the head at the top and on the upper spine down the back.

## The neck and the chest (`ai/bust.mjs`)

After the head (David 25 Oct: "why does she look awful?", then "it looks like plastic, like margarine" — the drawn neck
stood round the new one as a ragged ring; a smooth flare of one skin colour put in its place read as plastic, its join
to the head a band): the base body's own next part — its neck's root, collarbones, chest and upper back, the same mesh
the head came from — goes on below the head, so the skin runs on from the face with no seam (one surface, its uvs in
the band's skin block, the base body's own weights; joined to the head at every point they share).

- Laid on the Beginner by its bones (each base bone's bind moved to the Beginner's), its rim where head.mjs laid the
  head's neck; below the neck onto the Beginner's surface, 4 mm under the deepest of its layers along the part's own
  normal (a lapel lies on the shirt, the shirt on the chest); behind the collar standing round the neck's foot it keeps
  its own shape; folds eased away.
- The old body's neck goes (what is inside the new neck; the drawn neck's skin round it — its ragged ring) and the skin
  of the shirt's opening (grown from it through faces of the Beginner's own skin tone); the clothes stay (the collar, the
  lapels). The rims near the neck are eased along themselves and laid on the new part with its weights there (they move
  together); skin texels left on the cloth's edges are painted the cloth.
- Its texels: the base texture's own non-skin (the base woman's underwear, the nipples) painted skin, the chest smoothed
  and coloured as the neck; round the sides and the back below the neck's root a linen collar band (the old body's neck
  there was the drawn hair). The band is the shirt's in the regions' map, which now covers the whole atlas
  (`beginner_*_reg.png` 1024×1536, `Wear3D` REGIONS `atlasV` 1: a shirt's dye takes the collar band too).

`REG_OUT=…_reg.png node bust.mjs IN.glb OUT.glb BASE.gltf 1.2 REGIONS.png` (on head.mjs's output; BASE the
`Superhero_*_FullBody` the head came from; REGIONS regions.mjs's map).

The shirt made clean (`items/clean.mjs IN.glb REGIONS.png OUT.glb`, after the bust): its texels (the shirt's region)
laid in a clean warm linen, the broad light and folds kept, the drawing's brown smudges mostly gone; its mean brightness
barely moves (the dyes' REGIONS means stand). (Its blur read sharp's three-channel output as one until 25 Oct — the
shading was taken from the wrong places.)

## The surfaces (`ai/maps.mjs`)

A normal map and a roughness map on the body's material (it had a colour map only: one smooth gloss everywhere — "like
plastic"): the skin, the hair and the eyes take the base body's own (Quaternius' `T_Superhero_*_Normal` / `_Roughness`,
`T_Hair_*_Normal`, `T_Eye_Normal`, CC0 — the band copies their colour maps block for block); the clothes a relief from
their own painting (the slopes of its brightness: the folds, the seams, the leather's grain) and their roughness by
region (the linen and the trousers dull, the leather with a low sheen); the band's collar cloth its region's.
`node maps.mjs IN.glb OUT.glb m|f REGIONS.png QDIR` — last in the chain: head.mjs → bust.mjs → items/clean.mjs →
ai/maps.mjs (each body ~2.7 MB).

In the game the head is kept looking ahead (`Hero3D.levelHead`): the library's moves bend this body's chest further
forward than their own (the face ~15–20° down in the idle, ~35° in the guard), so the neck and the head are turned up
toward a face a little below level — not in a blow taken, thrown, lying down or getting up.

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

### The items' weapons (`w_sword_dragon.glb` … `w_cane_royal.glb`)

Each class's special weapon (items3d: Dragonfang, Crimson Moon, Sylvan Wing, Astral Staff, Royal Flush) is made the
same way from its GPT drawing (`src/weapons/*_dragon.jpg` …: cut with `ai/cut.py` — the bow's string painted out first,
it closed the bow's inside off from the ground — inflated, `wpnglb.mjs`, then `weapons/packw.mjs` packs it as the game's:
its drawing as WebP, meshopt). In game they are their kind's model in its holder (`Hero3D.swapArm`: its fist fitted
again, the bow's string taken from its own, a staff of another length slid through the fist to the floor), at girth 1
(drawn as thick as they are).

| Weapon | Length | Grip (drawing px) | inflate extra |
|---|---|---|---|
| sword_dragon | 1.05 m | 511, 1205 | blade above row 785, 2.8 mm |
| katana_moon | 1.0 m | 511, 1180 | blade above row 1036; guard disc r 3.6 cm at +6.8 cm |
| bow_sylvan | 1.25 m | 445, 748 | string 0.157, ±0.58 m |
| staff_astral | 2.4 m | 516, 880 | RC 4 cm (a round shaft); tall, so its orb stands over the head (at the face it hid it) |
| cane_royal | 1.0 m | 511, 395 | RC 2 cm |

## The items (`src/arena3d/items3d.ts`, `Wear3D.ts`)

David 25 Oct: a few swappable items for every class — aura, shirt, trousers, boots, hat, cloak — and a special weapon
each. One set per class on seven slots (weapon, hat, cloak, top, bottom, shoes, aura); the arena's and the world's
items panel (`items3dPanel.ts`) tries them on (a slot's pieces, a class's whole set) and saves what is worn for the
character (this browser); the character select shows it on the pedestal.

- **Hats** are made in code on the head's bone, sized to this body's head with its hair (`Wear3D.headFit`: the rim at
  the forehead, its half-widths, the crown's height): the warrior's helm (a steel dome, a nose guard, a crimson crest),
  the samurai's straw kasa (a red cord under the chin), the archer's feathered cap, the mage's bent wizard hat, the
  gambler's slanted top hat with the ace of spades in its band. A hat shades the head under its rim (the body's shader,
  `HAT_SHADE`: whole down to the chin under a wide brim, to the eyes under the cap and the helm): the room has no shadow
  maps, and the face under a brim read bright and bare from the fight's high camera. A twin (`Hero3D.clone`: Kagemusha's
  doubles) wears what its source wears at once and keeps up when it changes (`wearLike`; its own hat — the source's is
  kept out of the copy); the region map is loaded once and shared by every body of that sex.
- **Cloaks** are cloth: 9 × 14 particles pinned along the shoulders (through the collarbones' and the upper spine's
  skinning), falling under their weight at 60 steps a second, kept off the back, the legs and the upper arms
  (capsules on the bones), a ripple running down them in a run's wind, carried with the back (moved and turned as
  the upper spine moves and turns) on anything faster than a run or a quick turn — a dash, a leap, a double darting
  round the foe — instead of streaming like a flag; each its own painted face (trim, an emblem, stars, suits, a dagged
  hem) and lining.
- **Shirt, trousers, boots** change the Beginner's own painted clothes by their regions: `items/regions.mjs BODY.glb
  OUT.png OUT.json` maps each texel of the atlas to the shirt, the vest, the sash, the trousers, the boots or the
  bracers (by the bone it hangs on and its colour, specks smoothed) — run it again whenever a body changes and copy its
  means into `Wear3D`'s `REGIONS`. The body's shader recolours a region keeping the painting's shading (colour ×
  brightness / the region's mean) and lays a pattern on the body (stripes, checks, sparks, scales, dots, waves).
- **Auras**: a magic circle turning at the feet, a soft glow up the body and rising (or falling) sprites — embers,
  sakura petals, leaves, sparks, coins.
- **The test** (`items/test.mjs [dev server URL]`, the Vite dev server running): every item on the man and the woman,
  put on, driven through the moves (standing, walking, running, a jump, a skill of its weapon, a blow taken, thrown,
  down, up) and taken off — nothing throws or goes to NaN, a hat stays on the head, a cloak hangs behind the back, off
  the body and above the floor, a dye reaches the shader, an aura moves, an item weapon is in the fist and its kind's
  own comes back; a twin wears the set once; on and off three times over leaves no geometry or texture behind; the
  catalogue has one piece per class and slot and the weapons' files.
- **The item weapons glow**: their drawing's bright, saturated colours (runes, gems, the orb) are their emissive map,
  breathing slowly (`Hero3D.glow` / `breathe`).

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
