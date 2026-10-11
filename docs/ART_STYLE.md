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
| Warrior | `warrior_green.jpg` | steel plate, red cape, longsword right hand, round lion shield left arm |
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
- Actions in the atlas today: idle, walk, run, jump (3: crouch, apex, fall), djump (2), stance, hurt 6, launched 6,
  down_impact 3, down 2, getup 7, plus each class's skill sheets (6 frames each).

## 7. Prompt recipes that work
**GPT (stills, in the ChatGPT tab, it opens raw GitHub links):**
`Open this image: <raw link>. It is a 2D game character (side view, facing right) on a pure green background. Create ONE new image of the exact same character, identical design, colors, <signature>, same art style, same size, side view facing right, <pose>. No motion blur, no effects, no ground. Background: one flat solid pure green #00FF00, nothing else. Canvas 1280x1024.`
Ask for one pose per message; a series of poses works best in one chat ("Now the same character … <next pose>").

**PixVerse (video, Transition mode, first = last = the ref, 720p, 5 s, seed 11111):**
- walk: `walks in place, side view facing right, one full natural walk cycle that loops back exactly to the starting pose, <weapon held exactly as in the image>. Camera locked. Background: solid pure green #00FF00 only, no shadow, no effects.`
- run (from the sprint ref): `sprints in place at full speed … one complete fast run cycle that loops back exactly to the starting pose … <both hands keep gripping the weapon exactly as in the image; hands and weapon stay locked in place>. The arms do not swing. Camera locked. Background: solid pure green #00FF00 only, no shadow, no effects, no dust, no motion blur.`
  Negative prompt: `gray background, studio floor, wall, shadow, arm swing, weapon raised, motion blur, dust`.
- hit states (image-to-video, 8 s, wide shot from `<hero>_small_green.jpg`): stand 1 s → invisible impact from the right → stagger left → launched in a low arc → slam and slide → lie 1 s → roll / push up → stand; "completely alone, no effects".
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
Green keying: `gkey.py` (keeps the largest component; a 3-px despill rim is applied in `cut.py`).
