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
  code's fixed shot height). With the chibi at ×2 that is the front of the hip, master (31,47), 34 px behind and 32 px
  below the drawn origin (48,31); at ×3, 59 and 65 px. To raise with the owner of the combat code before the shot goes in.
