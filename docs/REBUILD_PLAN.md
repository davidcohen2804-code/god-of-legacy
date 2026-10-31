# God of Legacy — the rebuild (David, 31 Oct 2026 01:29: "looks great — go, run")

The DFO chat runs this end to end (David's direct request; it covers the Movements, hero and progression areas for this
rebuild). Other chats: read this before touching the base character, the hero bodies, skills or progression.

## North star
When David opens the game he says "wow": a MapleStory-grade *feel* (every move right, nothing exaggerated where it should
not be) with what is ours — the floor's depth, bigger effects that never tire the eye, running.
- Reference: MapleStory Classic, studied from its own data and a faithful open-source client — `docs/` concept and
  research pages: https://claude.ai/artifact/U95Zj8Ywyghs9k2JbgjFuG (concept) ·
  https://claude.ai/artifact/B1cWRr7eXXBddLqeuS36Mg (how MapleStory moves). Take the method, never copy the art.

## Locked decisions (David)
- **The base character** (31 Oct 01:29, approved): `tools/base/gpt/v3/approved_base.jpg` + `approved_poses.jpg` —
  chibi young adventurer (~2.8 heads), three-quarter view: facing right / left but the face toward the screen (both eyes
  seen), clean dark-brown outlines, flat two-tone shading; base outfit: white undershirt + light-blue shorts, barefoot
  (what stays on under all clothes — natural, never revealing). Female base: the same language (next).
- **Depth stays** (31 Oct 00:43): the floor has depth; not a left / right-only game. Maps may have several floors
  (jump down a ledge → the camera pulls back to show both → settles on the new one). No ladders or ropes.
- **Movement feel** (31 Oct 01:00): MapleStory's — the jump is one drawing with the arms tucked to the chest; no landing
  frame; quick start and stop; the walk's pace follows the real speed; a hit = a small hop back + 2 s flicker. Running
  added (MapleStory has none). Speed buffs (Haste) only speed the same walk and raise the jump — the body never breaks.
- **Skills** (31 Oct 01:18): a skill goes the way the player presses, diagonals into the depth included (this replaces
  the old "attacks only straight right / left" rule). Effects can be big (lightning over the map, a fire sword) but
  never tire the eye or fill the screen in our side camera.
- **Progression** (31 Oct 01:18): MapleStory-like — level 1 with the basic attack and starting clothes (removable to the
  base outfit), job advancement, active / passive skills, skill points spent by choice, skills opening by level.

## The method (from the research)
- A closed list of body poses; every skill is a choreography of them (per-frame time, move, rotate, mirror) plus its
  effect — never new body drawings. So every item fits every skill, forever.
- The head is one drawing set on each frame's neck (`tools/base/naked_frames.py` already works this way); hair, faces,
  hats and accessories are drawn once. Body clothes are drawn on every frame (the expensive part).
- Colours are data (hair, eyes, clothes recoloured from labelled layers), so variety multiplies cheaply.

### The closed pose list v1 (male first, then female)
| pose | frames | ms per frame | notes |
|---|---|---|---|
| stand | 3 | 500 | breathing |
| alert (combat stance) | 3 | 500 | 5 s after an attack or a hit |
| walk | 4 | 180 | pace = real speed |
| run | 4 | 110 | ours |
| jump | 1 | — | knees folded, arms tucked |
| swing 1 / 2 / 3 | 3 each | 300 · 150 · 350 | the basic attack picks one at random |
| stab 1 / 2 | 2 each | 350 · 450 | |
| shoot | 3 | 300 · 150 · 350 | archer |
| cast | 3 | 300 · 150 · 350 | mage (also the long "hold" pose of big spells) |
| launched | 2 | — | PvP / heavy hits |
| down + get-up | 3 | — | PvP |
| dead | 1 | — | then a ghost |

### Feel numbers (MapleStory's, scaled to our character's height)
Full speed and stop ≈ 0.1 s · jump ≈ 1.15 × the character's height, ≈ 0.5 s in the air · no steering in the air (turn +
a light brake) · hit hop ≈ 0.7 × height up and 1.2 × back · 2 s flicker (brightness, not transparency) · alert 5 s ·
blink every ≈ 2.5 s (3 × 60 ms) · expressions ≈ 2.5 s.

### Effect budget (our side camera)
An effect's body stays within about a third of the screen's width and half its height; whole-screen light only as a
flash under 150 ms (ultimates); the fighters' silhouettes always read through; small hits small, the last hit of a
burst big.

## Phases (each ends deployed, checked in the game, and a one-line note to David)
1. **Base body art (male):** GPT sheets of the approved character for every pose above (bald body + the standing head),
   through `tools/base/naked_frames.py` → `public/assets/final/body/naked/male/`. Gate: side by side with the approved
   sheet in the Studio — same character, smooth loops, no jitter.
2. **Head:** the standing head; faces (default, blink, hit, smile, angry…), eye colours; hair styles × colours
   (`face_extract.py`, `hair_extract.py`, `eye_colors.py`).
3. **Feel:** the numbers above in the shared kinematics (regular game and arena alike), random basic-attack swings,
   alert stance, hit hop + flicker, blink and expressions, run.
4. **Clothes:** starting outfits (tops, bottoms, overall, shoes) drawn on every frame, recolourable; wear / remove.
5. **Female base:** the same pose list.
6. **Progression:** Beginner (basic attack only) → level 10 → first job at the class master; EXP curve, level-up;
   skill points (3 a level from the first job); a skill window with actives / passives, max levels, prerequisites.
7. **Skills:** the first-job kits as choreographies + effects inside the budget, aimed with the player's direction
   (8-way); the Warrior first (fire-sword buff, a sweep, a dash, an iron-body buff, passives).
8. **Monsters:** MapleStory-like — patrol (stand / left / right every ≈ 1.6 s, turn at edges), hit pose + push back,
   HP bar 2 s, level-coloured name, death + fade, touch damage, EXP.
9. **World flow:** character creation (gender, face, hair, colours, starting outfit) → the first map with two floors →
   the class master → job advancement.
10. **QA and polish:** play it through; films; every screen at the bar; then David.

## Working rules
- Never press a download / save button in the browser; pull images as base64 (`tools/heroes/pipeline/pxpull.py`).
- GPT: only the "Draw Character Sheet" / "Character Sheet Design" chats; prompts never name MapleStory.
- `git pull --rebase` before work and before every push; `npx tsc -p .`; push to main after each approved step.
- Skills identical in the regular game and PvP (only damage differs); balance numbers logged in `docs/BALANCE_LOG.md`.
- Ask David only what cannot be decided from this plan; otherwise decide, note it here, keep going.

## Progress
- 31 Oct 01:29 — base approved; plan written.
- 31 Oct 02:45 — Phase 1 (male body) baked: `tools/base/sheets/v3_male.json` → `public/assets/final/body/v3/male/` +
  `src/data/v3-*.json` (stand 3 breathing, walk 4, run 4, alert 3, jump 1, swing 1/2/3, stab 1/2, shoot 3, cast 3, hit 1
  (the heavy stagger), launched 2, down 1, get-up 1, dead 1). The game plays it with `?base=v3` (and the Studio:
  `?studio=1&base=v3`); it becomes the base when Phase 2 gives the new head its hair and faces.
  - Learned: GPT draws the same arm phase in every frame of a walk / run (it ignores "the other arm forward", even with a
    pose guide). The other phase = ONE lone figure asked by the picture's sides ("the arm whose shoulder is on the LEFT of the
    picture swings forward, the other hides behind the back"), put into the move's sheet at the move's scale by
    `tools/base/v3/compose.py` (`--body`, `*K` until its head sits level with the other frames).
  - Tilted poses (thrown back, lying, bowed): `tiltD` — the same standing head turned with the body; `v3-heads.json` has the
    turn and the game turns the hair / face layers with it about the neck (`v3-look.json`: neck). `trim` takes GPT's own
    head edge off where GPT drew its head bigger than ours.
- 31 Oct 03:30 — Phase 2 (hair) and the base in the game: 6 hairstyles × 9 colours on the new head (GPT drew them on the
  standing figure: `tools/base/gpt/v3/hair_male.png` → `hair_extract.py --spec=sheets/v3_male.json`); the swords GPT drew
  in the attack frames are found and become the sword layer (any weapon can take their place); with `?base=v3` the
  game's Beginner is the new base (layered: its hair and clothes as layers), not the painted Beginner.
- 31 Oct 04:10 — faces: 5 expressions (blink, hurt, happy, angry, surprised: `tools/base/gpt/v3/expr_male.png` →
  `tools/base/v3/expressions.py` → `body/v3/male/face/x_<name>.png`, a layer over the face that turns with the head). The
  game blinks every 2.5–5 s (0.13 s), winces when hit / thrown / lying / getting up, shuts the eyes when defeated.
- 31 Oct 04:30 — the sword in hand in every move; **the new base is the game's male base** (`src/characters/baseSet.ts`;
  `?base=old` shows the older one): the male Beginner in the world, character select (stage + slot portrait), creation
  (the pedestal) and the HUD portrait are the new character with his hair. The female stays the older one until Phase 5.
- 31 Oct 04:45 — character creation: "Your Look" for the new base — 6 hairstyles (each button a picture of the head with
  it), 9 hair colours, 4 skin tones; the pedestal shows the choice at once.
- 31 Oct 05:40 — Phase 4 (clothes): the Beginner's outfit (T-shirt, trousers, boots — every outfit colour) is drawn on all
  17 moves of the new base. GPT redrew each bare sheet exactly, dressed and without the weapon
  (`tools/base/gpt/dressed_nosword/v3/`); the baker lays each figure on ours by the bald head (by the head's circle when a
  bow or a raised weapon stretches the figure) and lifts every piece off. Boots are found by the leather's hue along the
  body's own axis, so lying, kicking and jumping frames keep them. Worn / taken off in the bag as before (`src/items/Gear.ts`).
- 31 Oct 05:40 — Phase 5 (female) started: her standing figure in the same language (`tools/base/gpt/v3f/approved_female.png`,
  shown to David), then every pose sheet redrawn from the boy's (`tools/base/gpt/v3f/`, same poses and sizes, bald), her 6
  hairstyles and 5 faces; `tools/base/sheets/v3_female.json`.
- 31 Oct 07:35 — the attack frames are clean: GPT redrew each attack sheet exactly without the sword
  (`tools/base/gpt/bare_nosword/`); the baker takes the body from that twin and only the sword's place, grip and angle from
  the drawing that has one (no blade tips, torn shirt edges or grip bits left; the arm raised in front of the head stays over
  the hair). **Phase 5 (female) baked**: her 17 moves, hair, faces and the Beginner's outfit
  (`public/assets/final/body/v3/female/`) — she is now the game's female Beginner (world, select, creation).
  - Learned: a dressed copy must be drawn from the very drawing the body comes from (the attack sheets: from the sword-free
    twin) — GPT's copies of the sword sheet spread the stance and left up to a third of the legs bare. Measure before a
    bake (`tools/base/v3/fitcheck.py`): each dressed figure laid on the body by the head's circle, the share of the legs
    it leaves bare (≈1% = fits).
  - Open: her last cast frame's trousers (a dark wedge between the legs; that figure is being redrawn alone, then a bake).
- 31 Oct 08:00 — Phase 3 (feel) checked against what is in: the landing has no frame of its own already (the new base
  shows its stance on touching down), the alert stance and the blink are in, quick start / stop is ≈0.1 s. The quicker jump
  (≈0.6 s in the air, same height) would make two Sky Path gaps running-only: asked Maps on the board to narrow them first.
  A monster's hit: 2 s untouchable as before, the blink now dark / normal (brightness, never see-through); the small
  hop back on a hit waits for the quicker jump's gravity (the same arc).
- 31 Oct 10:30 — Phase 6 (progression), first step: **skill points.** New characters start at level 1 (the basic attack
  only); the Masters' 1st job at 10 (as before); from it 3 points a level; every job skill is learned with them in the
  Skill Book (K: the points, each skill's level 0–20, LEARN / +1, why a point cannot go in) — actives up to 20 (damage
  55 % → 100 % in the regular game), passives once; the bar locks a skill not learned. The arena, QA and test heroes:
  everything open at full power. `src/game/SkillPoints.ts`, `Character.skills`; numbers in `docs/BALANCE_LOG.md`.
  Prerequisites: the mechanism is in (`requires: { id, level }` on a skill / passive; the book shows "Needs X Lv N") —
  each class chat chooses its own. A level-1 Beginner starts on the world's level-1–8 monsters (sprout, puffling…).
