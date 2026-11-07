# The chibi Archer — accepted design decisions

A short record so neither side forgets what was approved. Who approved each decision is in brackets.
Process (David, 7 Nov): GPT (art director) reviews every pose and every visual system before it is built and again
before David sees it; David approves anything that changes approved art direction. Silence is not approval.

## Look
- Anime pixel art, light chibi, about 64 px tall (2.5–3 heads); the palette taken from GPT's drawing; nearest-neighbour
  scaling, no anti-aliasing. [David, GPT]
- Two visual directions only, right and left, in a near-side three-quarter view with both eyes visible; moving into
  depth keeps the facing. Mirroring right into left is acceptable as long as the bow-hand logic and the silhouette stay
  readable (test it each time). [David, GPT]
- The existing God of Legacy camera stays. [David]
- The approved reference (`guides/approved_reference.png`) governs the functional silhouette (how the bow is carried),
  not only colours and face. [David, GPT]

## The bow
- The left hand holds the bow, the right hand draws. [David]
- The carry: at the hip, a compact forward-and-up curve ending in a small flick under the chin, the string running
  inside the curve; behind the body (the far hand holds it); nothing hangs below the fist; it moves and turns only
  with the hand. [GPT]
- String: light grey for now, a warmer mid-light later. [GPT]
- A tiny riser stub below the fist is allowed if it proves the bow passes through the grip (1 px preferred, 2 px at
  most), but it must never read as a hanging lower limb at gameplay scale. [GPT, 7 Nov]
- The grip (7 Nov, after David saw the bow detached from the hand): the cause was the hand, not the bow path — an
  empty-hand drawing, the riser visible on one side only, and the fist's dark outline as a seam between skin and wood.
  The fix: three layers per frame — the bow, the body without the left fist, a fist overlay drawn as a grip (a simple
  chibi mitten: knuckle shade along the riser, a thumb over it, the outline open only where the wood enters and
  leaves; a narrow slot, never a hole). The riser leaves the hand at mid-height on its front edge. One grip system,
  pose-specific fist drawings (carry, nock, draw, release…). [GPT; David saw the before / after]
- The carry fist is GPT's design A (a diagonal knuckle shade along the riser, a 1 px thumb over its top edge; not B's
  stacked fingers, which suggest a vertical handle). One drawing for every carry frame (idle, blink, walk), at each
  frame's own grip; a walk frame gets its own variant only if it visibly fails. The fist stays upright; the bow turns
  about the grip; in the idle's up frames hand, grip and bow rise together. Every frame is checked: the thumb on the
  wood, wood in both front openings, exactly 1 px of stub. [GPT, 7 Nov]
- Interchangeable bows: the character art carries no bow; every pose stores the grip anchor and axis; each bow is a
  colour style plus its carry path (and later its draw geometry), pre-rendered per frame into its own small atlas
  (no run-time rotation of pixel art); the game draws bow, body, fist from the same anchor. [GPT]

## Animation
- David approved the idle and the walk for now (7 Nov 23:26: "looks great"). His priority from here: changing clothes,
  removing them and more must stay as easy as possible. So (GPT agreed): the two Raise proofs now; then a base body
  under every item before any other shot pose — a modest, visible under-layer (a fitted plain undershirt, short-sleeved
  or sleeveless; simple shorts or leggings a shade darker; bare forearms and hands; soft foot wraps), the hair completed
  from today's bangs for the unhooded look (the same identity, not a new hairstyle); then the current outfit cut into
  items over it (hood, tunic, cape, quiver, boots, bracers, bow), with an item matrix first (covers, hides, poses). Slots:
  base body, face, hair; headwear, top, forearms / gloves, bottom, footwear, back cloth, back accessory, weapon; later
  waist and effects. Every item: anchor, render group, coverage, hide mask. [David, GPT]
- Idle: 4 frames, 400 / 300 / 400 / 300 ms; the chest, both fists and the bow rise 1 px; the cape's hem a beat
  behind; the blink is an occasional event, not part of the loop. [GPT]
- Walk: 6 frames (two steps: contact, down, passing on each foot), 110 ms, the pace follows the real speed; bob
  contact 0, down −1, passing +1; the bow trails the step: 0 / −3 / −1 / +1 / +3 / +1 degrees. [GPT]

## Minimal motion (David, 7 Nov 21:41 — the standard for all five classes; the Archer's walk is the first case)
- David: swapping clothes breaks because of motion; move as little as the character allows while it stays correct.
  [David]
- The target is the fewest unique drawings for a whole character, its equipment and its actions — not the fewest
  frames. Save animation in ordinary movement; spend it on meaningful actions (the shot keeps its four poses). [GPT]
- The walk standard (a test first: it replaces the current walk only after a side-by-side and David's choice): 4 frames
  — right contact, right passing, left contact, left passing — over about the old 660 ms cycle, following the real
  speed. Only these move: the legs (4 poses, boots follow), a 1 px bob, the free arm (2–3 positions), the cape's hem
  (1–2 variants). One drawing each, shifted by the bob: head, torso (tunic, belt), the bow arm in its carry, the bow
  (one carry raster, no trailing angle), the quiver. The rigid torso must still look attached to the moving pelvis
  (the tunic and belt overlap it; no visible joint). [GPT]
- The legs: the 4 best poses taken from the existing walk drawings, fitted to one fixed waist anchor, overlaps
  corrected; redrawn only if they fail the compositing test. The current 6-frame walk stays as the benchmark and the
  fallback. [GPT]
- Slots: base body, face, hair, headwear, top, bottom, footwear, gloves / forearms (its own slot in principle), back
  cloth (cape, coat tails, scarf) and back accessory (quiver, banner, book…), weapon, effects. Every item has anchors,
  a layer group per pose (a sleeve can be behind the torso in one pose and in front in another; the bow's order changes
  between the carry and the shot), overlap masks (headwear against hair: a hood leaves the bangs), the region it covers,
  the poses it needs, rigid or deforming. [GPT]
- Support art: the pixels hidden under moving parts exist as their own regions (the torso behind the free arm, the hips
  under the skirt, the cape behind the legs, the shoulders under the collar or headwear), so a swap or a swing never
  opens a hole. [GPT]
- The breakdown (layers of the master; walk frames 1, 3, 4, 6 for the legs; the free arm in 3 positions) was approved
  as the basis of the test; the legs are used as they are and cleaned only where the test shows a fault. Risks to
  watch: a free-arm swing too busy against the rigid body (keep the rhythm, cut the amplitude), the cape looking stuck
  over moving legs, the passing legs' extra row reading as a change of proportion instead of the body's lift; timing
  tried at 165 and 150 ms. [GPT]
- The test build (`tools/chibi/archer/src/minimal_R.py`, behind the flag): `?chibi&walk=4` the 4-frame walk;
  `&outfit=b` outfit B — a red tunic with a gold hem, a dark belt with a steel buckle and a point hanging below the
  hem (one torso drawing), dark boots with a fur cuff (one drawing per leg pose); `&wms=150` the walk's frame time on
  screen (165 ms by default; `&wms=236` matches the 6-frame walk's real cycle — the pace formula plays that one at
  ~157 ms a frame, a 943 ms cycle, at the walking speed). The free arm swings ±2 px at the fist (±1 at the forearm);
  the hem lags a pixel on the passing frames.
- **David chose the 4-frame walk at the planned pace (7 Nov 23:06): it is the game's walk now** (165 ms a frame on
  screen); the 6-frame walk stays as the fallback (`&walk=6`). Outfit B stays a test item (`&outfit=b`), not a look.
  Fixed in it the same night: the sleeve's highlight belongs to the top (gold on the red sleeve, no white stripe), the
  boots take every leather tone of the leg drawings, and the fur cuff follows each leg where its boot shows under the
  tunic (it steps down under the point, never lands on a toe). [David]
- GPT's review of the test (7 Nov): "The 4-frame minimal-motion Archer walk is visually acceptable and
  production-beneficial, especially at gameplay scale ×2" — at ×3 the 6-frame walk is prettier, the trade-off is
  David's. Kept honest for David (no torso animation added back); if he wants more life, the first knob is a slightly
  larger free-arm arc. Known, not blocking: the sleeve's highlight stayed in the arm layer (rule: the sleeve belongs to
  the top, the bracer and fist to gloves / forearms); the fur cuff sits at a fixed height (in the standard, cuffs
  follow the leg pose); the rigid skirt hiding the waist join may not carry over to every class. [GPT]
- Rendering: a self-contained chibi compositor inside the flagged system (pose + equipment + facing → parts placed by
  anchors and layer rules), caching composites if needed; the shared renderer stays untouched. [GPT]
- The test: side by side at ×2 and ×3 — appeal, a smooth loop without foot sliding, the bow's connection, a swap of a
  clearly different tunic and boots during the new walk, performance measured. [GPT]

## The shot (a design only, 7 Nov — nothing is drawn until David accepts the idle and walk)
- The combat timeline is authoritative. Beat 1 (startup 85 / active 70 / recovery 110) fires two arrows, at 85 and
  155 ms: two distinct visual releases, the second draw a quick re-tension (never a full re-nock, never back to idle).
  Beat 2 (170 / 0 / 220) fires one arrow at 170 ms; its longer full draw reads as the charge (no player-held charge yet).
  A Release frame is on screen at each spawn. [GPT]
- Four reusable poses: Raise, Full Draw, Release, Recover. [GPT]
- Offline compositing for the prototype: the upper body (head, torso, both arms, hands, bow, string, arrow, upper cape)
  from the shot drawings over the idle / walk / air frames below the belt, joined at the waist with 1–2 px of overlap.
  The bow's art and attachment data stay separate source assets, so other bows can be regenerated; not yet the
  permanent architecture (count the assets before adding equipment). The cape hangs from the shoulders: a seam at the
  belt is a test, not approved until seen; if it shows, a shoulder-anchored cape layer instead of patches. [GPT]
- Pose map A is the working design (master px; W waist (24,44), Sf far shoulder (31,34), Sn near shoulder (15,33)):
  the draw hand just under the near jaw at (20,31), the fist touching the chin's near corner; the bow canted about +15°
  (top forward); the arrow on the bow fist's top row, 3 px above the grip; no arm longer than its real 14–15 px. Raise:
  grip (40,37), +25°, the hand already on the string at (29,34). Full Draw: grip (45,34), arm straight, +15°, arrow
  (20,31)→(48,31). Release: the grip stays at (45,34) — the recoil is in the limbs, the straight string and the draw
  hand thrown back to (16,30); no full-arm kick. Recover: grip (40,41), +30°, the hand down to (18,42). The cheek
  anchor was withdrawn: it needed a 22 px draw arm and put the string through the far eye. [GPT, 7 Nov]
- The string: in front of the lower face, a clean 1 px muted warm light grey, never over an eye or eyebrow (fix it with
  the bow angle or the string first; hiding it behind the face only as the last correction), under the draw hand's
  fingers where they grip it; never hidden wholly behind the head. [GPT]
- The arrow: behind the grip fist (the knuckles over 1–2 px of it), straight on both sides; the draw hand visibly
  pinches the nock. [GPT]
- Raise starts already partly drawn (85 ms leaves no time to nock). The jump from the carry grip (34,48) to the Raise
  grip is checked at 60 fps in the first composite test; an in-between pose only if it visibly pops. [GPT]
- Render order, back → front: cape + quiver, far upper arm, legs, torso, head, bow, arrow, grip fist, string, near arm
  + draw hand. In Recover the bow goes back behind the body only once it is close to the torso again. [GPT]
- Next, after David accepts the idle: two proof compositions — Raise over the standing legs, Raise over the walk's
  passing legs (frame 2 of the 4-frame walk) — at ×2 and ×3, facing right; the bow moves from the carry into the Raise
  without leaving the left fist. Then the same upper body over all four walk leg poses (is the system really
  reusable?), and only then Full Draw, Release and Recover. Minimal motion is not minimal impact: the walk stays
  simple, the shot keeps its four strong poses, reusing the head, equipment, legs and attachments. [GPT, 7 Nov]
- The Raise proofs (7 Nov, `src/shot_R.py`, not in the game): the composition passes — no seam at the waist, the head,
  cape and quiver unchanged over standing and passing legs, the bow angle good, the grip connected (provisional). The
  artwork stays provisional and is kept as a technical reference, not polished now: the draw arm must show a bent elbow
  (down and back) instead of a straight bar, the bow arm's elbow must read, and the nock must visibly meet the drawing
  fingers. The carry → Raise jump (the grip 11 px up, 6 px forward) is judged in motion on the combat timeline first;
  an in-between only if it pops, with no added latency. [GPT, 7 Nov]
- The base body comes first (GPT, 7 Nov): derived by Claude from the approved master, not a new image — the face and
  the bangs exactly as they are, the hair completed under the hood; a plain ivory short-sleeved undershirt, simple brown
  or beige shorts, bare forearms and hands, neutral foot wraps; nothing removable baked in. Removal is independent (the
  top never takes the arms, the hood never the bangs, the boots leave no hole). The acceptance test is the round trip:
  the base plus the original items must rebuild the approved Archer. Shown as clothed / base alone / outfit recomposed
  over the base; then the four walk poses and a removal test; only then the shot's arms again. [GPT]
- The standing base body and the item cut are approved (GPT, 8 Nov): "Standing base body and item cut approved.
  Round-trip reconstruction is exact, and all item-removal combinations close correctly." Items: hood (headwear), tunic
  (top), bracers (forearms), boots (footwear), cape (back cloth), quiver (back accessory), bow (weapon). Rules: every
  pixel of the approved Archer has one owner (the base or one item); an outline two items share is both's; a removal's
  bare edge is closed with an outline by the composer; the cape and the quiver are split into a part behind the body
  and a part over it (the shoulder wrap, the strap). Cleanup done: the carried bow's string pixel baked into the
  master now belongs to the bow (the idle shows the string's own tone there). Polish later, not blocking: fuller hair
  tufts at the back. Watched: the bare shins' thickness in motion. (`src/base_R.py`, `src/items_R.py`) [GPT]
- In motion (`src/outfit_R.py`, 8 Nov): the game's idle, blink and 4-frame walk now come from the base and the items;
  with every item on they are the approved frames (the string pixel apart). The walk's base legs are your leg drawings
  recoloured — the top rows the shorts' hems, the last five rows the foot wraps wherever the foot is, skin between.
  Bits of the walk drawings' cape outline that had come with the legs (2–13 px at the hem) were dropped — an intentional
  ownership correction (they are the cape's; with the cape off they floated), which changes the walk by 2–10 px a
  frame, all on the cape's hem. Removal test behind the flag:
  `?chibi&strip=nohood|notunic|nocape|noboots|nobracers|tunicboots|base`. Approved (GPT, 8 Nov): "Modular standing +
  4-frame walk clothing/removal system approved. Motion tests pass for all reviewed outfit-removal variants." The bare
  shins stay as they are (acceptable at ×2; a slimmer lower leg only if David reacts to the boots-off look); the hair
  tufts stay a later polish; no further idle or walk changes now. Next: David's look, then the shot on the base —
  Raise again, then Full Draw, Release, Recover; the shot's arms are upper-body pose art over the base, the clothes over
  them, no longer one clothed master. [GPT]
- Fixed after that review (8 Nov): on the idle's two risen frames the figure's top row (the hood's top outline) had
  fallen out of the master's grid — the hood's top was open on 2 of 4 frames; now kept. The cape hem's outline that
  came with the standing legs (5 px) belongs to the cape: without the cape it stuck out beside the near shin (base and
  no-cape variants); walking it is left out (the walk's legs are elsewhere). Round trips unchanged.
- **The production rule (GPT, 8 Nov): a new ordinary tunic or bracer must not require drawing a new attack animation;
  only equipment that changes the actual silhouette needs additional pose-specific artwork** — for all five classes.
- Arms for new poses (`src/arms_R.py`, approved as the architecture, GPT 8 Nov): an arm in a pose is a skeleton
  (shoulder, elbow, wrist) and a hand drawing, drawn once as a material map — t along the arm (0 shoulder, 0.5 elbow,
  1 wrist) and the tone across it (light, mid, shade; lit from the upper left), or outline. The base and every arm item
  are colour bands over t (the base: the undershirt's short sleeve, skin; the tunic: its sleeve; the bracers: leather
  with a cuff); hands are the hand's own tones (gloves would add theirs). Standard-fit equipment = new bands, no redraw;
  silhouette-changing equipment (a wide sleeve, shoulder armour, a fur cuff) = a small pose-specific overlay. The
  skeleton's 7 + 7–8 px is a guide, not a rule: foreshortening is allowed in the pose data, the look at native size
  decides. Source data (geometry, zone maps, item definitions) is kept; the game gets precomposed frames. [GPT]
- The shot's geometry (GPT 8 Nov, working): Raise — grip (40,37) +25°, the hand on the string at (25,34) (the arrow
  level on the grip fist's top row), the draw elbow down behind the hand at (19,39), the bow elbow at (33,41); Full
  Draw — grip (45,34), bow arm straight, the hand under the near jaw at (20,31), the draw elbow back at the shoulder's
  height (12,33), the upper arm foreshortened (a slightly lower elbow to be judged on the sprite); Release — the grip
  stays at (45,34), the string snaps forward, the limbs respond, the hand moves back; Recover — towards the compact
  hip-level carry, grip and hand connected, the layer change only when the bow passes back by the torso. Not approved
  yet: the final Full Draw elbow, the final shooting arms, any change of combat timing or projectile origin. The test:
  Raise and Full Draw over standing and passing legs at ×2 and ×3 in three outfits (base, original, outfit B: other
  sleeve colours and proportions) with no per-outfit correction (`src/shotbase_R.py`, not in the game). [GPT]
- The proof passes (GPT, 8 Nov): "The same arm-pose drawings dress the base, original outfit and outfit B with no
  per-outfit correction." Locked: the Raise with the near upper arm down the side where it hangs in the idle (hand on
  the string at (22,34), elbow (14,39), only the forearm crossing the torso — the sleeve over the chest read only by
  its outline); the Full Draw with the lower elbow (12,35). Outfit B: no break. Hands stay provisional until the four
  poses are locked. Next: Release and Recover the same way (three outfits, standing and passing), then the game. [GPT]
- Drafted for that review: Release — grip (45,34) +15°, the string straight, the limbs springing forward (bend 3 → 2),
  the arrow gone, the open hand thrown back to (16,30), the elbow (10.6,35); Recover — grip (40,41) +30°, the string
  straight, the bow elbow down by the body (32.5,41), the draw hand dropping to (18,42), its elbow back and down
  (11,39). A hand's outline never cuts across its own forearm (the fist continues the arm; a bracer's dark edge
  separates them).
- Open (for the integration, not decided): the arrow spawns 16 world px ahead of the feet and 34 px up (the combat
  code's fixed shot height, also used by the cover checks). With the chibi at ×2 that is the front of the hip, master
  (31,47), 34 px behind and 32 px below the drawn origin (48,31); at ×3, 59 and 65 px. The shot does not go into
  production with that gap. No combat timing, cover-check or balance change is authorised; the direction to study is a
  gameplay origin (collision, cover) kept apart from a visual origin (the drawn nock), checking that the arrow's look
  joins its real path without a jump — in a joint review with the owner of the combat code, testing shots standing,
  walking and in the air at ×2 and ×3. [GPT, 7 Nov]

## The paper doll and the rest of the moves (8 Nov night — David: GPT approves everything, he checks in the morning)
- The game composes the Archer at runtime from layers (`src/doll_R.py` → `archer.doll.json`, `src/chibi/ChibiDoll.ts`):
  every frame is the base's parts and each item's parts in order; with every original item on it is the approved
  frame pixel for pixel; bare edges are closed inside the frame's reference silhouette (all removal variants clean).
- Release and Recover approved (GPT): the grip locked, the recoil in the limbs and string, the hand thrown back; the
  bow stays in front until the Recover ends, then the carry. The shot family plays on each shooting skill's timeline
  (two releases on the double beat); the post-skill recovery holds the Recover pose.
- The minimal move set (GPT): jump = 1 air pose + 1 landing squash; hit = 1 recoil (eyes shut); combat stance = a
  softened Raise, breathing (the Archer's combat idle); run = the 4-frame walk, faster, 1 px forward lean; knockdown =
  hit (launched), lying (the standing figure turned a quarter — provisional long-term), get-up crouch. Non-shot skills:
  one pose per body action, not per skill — kick (retreat kick), kneel/place (tree of life), call/summon (hunter's
  roar, spirit hawk). "Archer combat and utility animation should minimize unique poses." All approved (`src/poses_R.py`).
- Creation and the first cash shop collection, art direction (GPT): hair — Wind-Tousled Fringe (the current),
  Scout Crop, Falcon Tail; 8 colours (chestnut, dark walnut, honey blonde, ash blonde, copper red, raven black, silver
  mist, dusty moss); eyes — Calm Focus (the current), Bright Curious, Sharp Hunter; 5 skin tones (fair porcelain to deep
  cocoa); starter sets — Novice Fieldwear, Wanderer Greens, Village Scout; bows — Sprout Bow, Trail Bow; cash shop —
  hats (Moonleaf Beret, Star Courier Cap, Candy Ribbon Hood), face (Round Scholar Glasses, Dreamer Monocle Clip, Star
  Patch Sticker), tops (Rose Duelist Jacket, Night Scout Hoodie, Mint Festival Blouse), bottoms (Traveler Shorts,
  Ribbon Skirt-Pants), overalls (Little Ranger Onepiece, Celestial Pajama Suit), capes (Petal Drifter Cape, Forest
  Scout Mantle), shoes (Soft Field Boots, Moonstep Sandals, Star Runner Shoes) — cute fantasy, readable, the classic
  2D MMO's spirit, original. Drawing order: hats, tops, shoes, capes, face, bottoms, overalls. (The colours: GPT's
  reply, 8 Nov ~01:30, in `src/looks_R.py`.)
