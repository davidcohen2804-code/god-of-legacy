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
