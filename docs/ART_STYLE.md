# God Of Legacy — art style (heroes, moves, effects)

The shared look for every image and video any chat makes (GPT, PixVerse). Written by Movements from the hero art
that is in the game. If something you need is missing, add it here — do not invent a second look.

## 1. The look in one line
Painted Korean-MMO hero art (DFO / MapleStory-2 cinematic key art): semi-realistic proportions (7–7.5 heads),
hand-painted rendering with soft gradients and crisp edges, rich saturated costumes with gold trim, dark fine
lines only where edges need them, one warm key light from the upper right, no outlines, no pixel art, no cel
shading, no 3D render look, no photo.

## 2. Per-hero references (always attach / link one)
All on green screen `#00FF00`, side view facing right, standing: `tools/heroes/refs/<hero>_green.jpg`
(1280×720, figure ~95 % of the height). Raw link for GPT: `https://raw.githubusercontent.com/davidcohen2804-code/god-of-legacy/main/tools/heroes/refs/<file>`.

| hero | file | signature |
|---|---|---|
| Warrior | `warrior_green.jpg` | steel plate with a gold lion crest, red cape, longsword right hand — NO shield (David: the warrior carries no shield) |
| Samurai | `samurai_green.jpg` | black-and-red lamellar, katana, long dark hair, red sash |
| Archer | `archer_green.jpg` | hooded green cloak (hood always up), gold-trimmed leather, recurve bow left hand, quiver |
| Book Mage | `book_mage_green.jpg` | white hair, blue-and-white robe with gold stars, open spell book left hand |
| Gambler | `gambler_green.jpg` | top hat with a card, long black coat with gold filigree, magenta lining, cane left hand, cards right hand |
| Beginner ♂ | `beginner_male_green.jpg` | brown hair, white shirt, leather vest, satchel, wooden sword right hand |
| Beginner ♀ | `beginner_female_green.jpg` | ponytail, same kit |

Extra refs that exist: `<hero>_run_green.jpg` (sprint pose), `<hero>_run2h_green.jpg` (sprint, both hands on
the weapon — gambler, beginners), `<hero>_small_green.jpg` (figure 50 % height, for wide shots), `samurai_air_green.jpg`.

## 3. Palette
- Skin: warm, `#F2C9A3` light → `#B9825A` shadow. Hair/dark: `#2A1F1C`. Steel: `#9FA6AD` → `#4B5157`, specular `#E8ECEF`.
- Gold trim everywhere: `#D9A441` → `#8A5E1E`. Leather: `#7A4B2A`. Wood: `#B98A52`.
- Class accents: Warrior red `#B3261E`; Samurai red `#C8102E` + black `#1B1B1F`; Archer forest green `#3E6B3A` + moss `#7E9A4D`;
  Book Mage royal blue `#2F55C8` + white `#F4F1EA`; Gambler magenta `#C0157A` + black + gold; Beginners cream `#F1E7D2` + brown.
- Backgrounds for generation: always one flat `#00FF00`, nothing else (no floor, no shadow, no vignette).

## 4. Lighting, line, rendering
- Key light upper right (the hero faces right, so the face is lit), soft cool fill from the left, no rim light, no bloom.
- Cast shadow: none in the source (the game draws the ground ring).
- Edges: painted, crisp on metal and blades, soft on cloth and hair; line weight ~1 px at 1400 px canvas, darker only in creases.
- No effects, dust, sparks, motion blur or speed lines in body art. Effects are separate assets (see §8).

## 5. Camera, pose, size
- Pure side view, facing right, eye-level camera, no perspective tilt, no foreshortening toward the viewer.
- Weapon stays in its hand and in character: the same grip as the reference. In loops (walk / run) the arms do not
  swing: ask for "both hands locked on the weapon" (two-hand grip refs exist) — the one thing PixVerse gets wrong otherwise.
- Figure height: standing = whole canvas height in the refs. Airborne poses: no ground in the picture.

## 6. Frame sizes and placement (the motion canvas)
- Source frames: `tools/heroes/motion/<hero>/<act>_NN.png`, 768×768 RGBA, standing height 509 px, feet on y = 700,
  hips at x = 384 (lying frames: bbox centre). `motion.json` lists each action (frames, loop, frame_ms, cycle_canvas).
- Atlases are cut by `python3 tools/heroes/cut.py <hero> …` (≈3–4 min per hero) → `public/assets/final/heroes/<hero>/body.png`
  + `src/data/hero-atlas.json`. Never edit those by hand; take theirs on a conflict and re-run.
- Scale from a GPT still (1402×1122 canvas, same-size prompt) to the motion canvas: warrior 0.608, samurai —, archer 0.623,
  book_mage 0.626, gambler 0.558, beginner ♂ 0.615, beginner ♀ 0.622 (`tools/heroes/pipeline/stillpose.py <hero> <act> <scale> imgs…`).
- Actions in the atlas today: idle (painted breathing loop, 40 f at 15 fps — PixVerse Transition first = last = the standing ref, seed 5, 8 fps extraction of the 5 s clip; samurai 38 f), walk, run, jump (3: crouch, apex, fall), djump (2), stance, hurt 6, launched 6,
  down_impact 3, down 2, getup 7, backstep 4, quickrise 3, runstop 2, stunned 4 (loop), win 8 (holds), intro 8,
  plus each class's skill sheets (6 frames each).
- Still-pose states (`pipeline/states.py <hero> <scale>`, stills in `st/<hero>_<pose>.jpg`): scale = 505 / the upright
  still's height (`runstop2`). Video strips (`pipeline/strip.py <hero> <act> <strip.jpg> <n> <ms> [hold]`): frame 0 = the standing ref.

## 7. Prompt recipes that work
**GPT (stills, in the ChatGPT tab, it opens raw GitHub links):**
`Open this image: <raw link>. It is a 2D game character (side view, facing right) on a pure green background. Create ONE new image of the exact same character, identical design, colors, <signature>, same art style, same size, side view facing right, <pose>. No motion blur, no effects, no ground. Background: one flat solid pure green #00FF00, nothing else. Canvas 1280x1024.`
Ask for one pose per message; a series of poses works best in one chat ("Now the same character … <next pose>").

**PixVerse (video, Transition mode, first = last = the ref, 720p, 5 s, seed 11111):**
- idle: `stands in place breathing calmly: one subtle slow breathing loop that returns exactly to the starting pose, shoulders rise and fall gently, head steady, feet planted and never move, <weapon held exactly as in the image>, cloth and hair sway gently. No walking, no turning, no gestures. Camera locked. Background: solid pure green #00FF00 only, no shadow, no floor, no effects.` (seed 5; negative: `walking, turning, arm swing, weapon raised, gesture, gray background, floor, wall, shadow, motion blur, dust, zoom`)
- walk: `walks in place, side view facing right, one full natural walk cycle that loops back exactly to the starting pose, <weapon held exactly as in the image>. Camera locked. Background: solid pure green #00FF00 only, no shadow, no effects.`
- run (from the sprint ref): `sprints in place at full speed … one complete fast run cycle that loops back exactly to the starting pose … <both hands keep gripping the weapon exactly as in the image; hands and weapon stay locked in place>. The arms do not swing. Camera locked. Background: solid pure green #00FF00 only, no shadow, no effects, no dust, no motion blur.`
  Negative prompt: `gray background, studio floor, wall, shadow, arm swing, weapon raised, motion blur, dust`.
- hit states (image-to-video, 8 s, wide shot from `<hero>_small_green.jpg`): stand 1 s → invisible impact from the right → stagger left → launched in a low arc → slam and slide → lie 1 s → roll / push up → stand; "completely alone, no effects".
- Ask PixVerse for "camera completely static, the character stays exactly the same size, feet planted" in wins / intros (it zooms in otherwise), and "keeps a tight grip on the <weapon> for the entire clip" in hit clips ("arms free" drops it).
- Skip any frame with dust / effects; pick cycles from touchdown to touchdown (`pipeline/runcheck.py`).

## 8. Effects and hit frames (for the class chats)
- Effects are their own PNG sequences on `#00FF00` (or black for additive glows), never baked into the body.
- One signature shape and color per skill, from the class accent (§3): warrior red-gold arcs, samurai red-black slashes,
  archer green-gold wind, mage blue-white runes, gambler magenta cards. Impact frame: a bright core (`#FFF6D6`) with the
  class color around it, 1–2 frames, then smoke in the class color at 40 % alpha.
- Hit frame of a skill: the hero's body in the same style (§1–§5), a smear only on the weapon, never on the body.

## 9. The pipeline (tools/heroes/pipeline/)
`px_toolkit.js` (drive PixVerse from its page: upload / generate / poll / pull) · `pxpull.py` (reassemble base64 chunks)
· `integrate.py loop|hits` (key a clip, cut a cycle, place frames) · `runfit.py` (run cycle at the walk's scale) ·
`stillpose.py` (GPT stills → frames) · `allcap.mjs` / `begcap.mjs` (in-game screenshots of idle / walk / run / jump).
`loopfind.py <clip> <pmin> <pmax>` (the start / period whose last frame flows into the first — cut every walk / run with it; a seam under one normal frame-step) · `clipframes.py <clip> <hero> <act> i,j,…` (frames of a camera-locked clip with ONE transform from frame 0, so nothing grows or sinks — wins, intros) · `regwarp.py` (register frames onto frame 1: scale + shift, no rotation) · `drift.py <hero>` / `colorfix.py <hero> <acts> --L` (measure / shift each action's colour balance to the idle's — GPT stills come back red-shifted) · `vsheet.py` (indexed contact sheet of a keyed clip).
Green keying: `gkey.py` (keeps the largest component; a 3-px despill rim is applied in `cut.py`).

## 10. Maps, towns and monsters (Maps chat)
- **Maps** are one GPT picture each, 1672×941, side view: the walkable floor band from ~36 % to 70 % of the height (y 346–652,
  the ground a few steps deep, seen a little from above), the scenery and sky above it, the terrain's front face falling away
  below it. Nothing stands inside the floor band except the listed platforms (2–3 things one can jump onto; they become props
  by `tools/world/platforms.py`, measured by hand). Neighbouring maps continue each other: "its LEFT edge continues the
  previous map's RIGHT edge". Look: bright, warm, painted, polished 2D game art (MapleStory-Classic feel, never dark or
  scary), golden-hour light, saturated flowers and lanterns, lots of depth in the background (mountains, bridges, waterfalls,
  giant trees). Start a new map chat by attaching an existing map (e.g. `tools/world/src/dusk_village.png`) and asking for
  "exactly the same art style, canvas size, camera and scale"; GPT then outputs the same size. Interiors: "no sky", the back
  wall and a pit below the floor instead. Variety first: no two maps on the same terrace idea, no repeated trunks.
- **Monsters**: one sheet per creature on flat magenta `#FF00FF`, facing right, 5 rows: idle 4, move 6, attack 6, hit 2,
  defeat 6, same frame size and spacing, consistent size (`tools/mobs/mobs.py` cuts it; `MOBS` gives its height in world px).
  Cute and friendly, never scary, clean outlines, no shadows on the background; bosses bigger but still friendly (Pouncer, the
  Shade Fox). Ask for the next creature in the same chat ("in exactly the same sheet format").
- **NPCs**: 4 frames side by side in equal columns on magenta, facing right, full body, feet on one line, a gentle idle
  (breathing, a small gesture, a blink), chibi proportions (`tools/world/npcs.py`, `NPCS` gives the height; it also cuts the
  dialogue face). **Item icons**: a grid on magenta, 128 px each after `tools/items/loot.py`.
- Pull GPT images without a download button: the Chrome tab gives the image's file id (React fiber `memoizedProps.src`,
  `sediment://file_…`) → `/backend-api/files/<id>/download` → the signed URL; the built-in browser fetches it, re-encodes
  (canvas → webp 0.97) and returns base64 in 240 000-char chunks with a space every 64 chars (the chunks land in the
  session's tool-results folder; join them with `/tmp/claude-0/pull/pull.py`-style script). The ChatGPT conversation
  endpoint rate-limits (429) when several chats poll it: read the page's DOM instead.
