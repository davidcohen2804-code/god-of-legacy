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
