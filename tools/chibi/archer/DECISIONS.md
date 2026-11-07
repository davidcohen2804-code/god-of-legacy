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
- Next, after David accepts the idle and walk: two proof compositions — Raise over the idle, Raise over walk frame 3 —
  at ×2 and ×3; Full Draw, Release and Recover only after their review. [GPT]
- Open (for the integration, not decided): the arrow spawns 16 world px ahead of the feet and 34 px up (the combat
  code's fixed shot height, also used by the cover checks). With the chibi at ×2 that is the front of the hip, master
  (31,47), 34 px behind and 32 px below the drawn origin (48,31); at ×3, 59 and 65 px. The shot does not go into
  production with that gap. No combat timing, cover-check or balance change is authorised; the direction to study is a
  gameplay origin (collision, cover) kept apart from a visual origin (the drawn nock), checking that the arrow's look
  joins its real path without a jump — in a joint review with the owner of the combat code, testing shots standing,
  walking and in the air at ×2 and ×3. [GPT, 7 Nov]
