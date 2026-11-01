# V4 Phase 4 — hip attachment chains and the second premium outfit

Everything is in the isolated V4 lab (branch `v4-lab`). Nothing was merged or deployed. No Ember Duelist modular sheets were generated or cut.

## 1. Step 1: the hip attachment chains

### 1.1 What was built

**Rig.** The body's bones are unchanged: the 22 character bones plus the existing cape and hair chains, 28 bones in all. Four optional bones come after them, so the body is evaluated exactly as before. Test B3 compares the 28 body bones across every outfit mix; the largest difference is 0.

There are two chains. Each has two links on the hip bone and is independent of the neck-mounted cape:

| Chain | Owner | Slots |
|---|---|---|
| A | trousers | one in front (after the hips), one behind the legs |
| B | top | one in front (after the hips), one behind the legs |

A chain is idle and undrawn until a worn item hangs a piece on it. The resolver only lets an item draw on the slots its slot type owns.

**Per-item settings.** Each item that hangs a piece sets its own:
- anchor on the hips, rest angle and link lengths;
- spring: stiffness, damping and limit;
- response to forward speed and to vertical speed, per link;
- how far the lower link swings back when the upper one is pushed (`hang`);
- `gravity`: how much of its hanging direction the piece keeps when the hips tip;
- the thighs it must stay in front of, plus a margin.

No two pieces share a motion curve.

**Draw order.**
- In front: the top's piece first, then the trousers' belt-hung piece over it.
- Behind the legs: the trousers' piece first, then the top's coat tails over it.

**Golden tabard.** It is now a strip bent along chain A instead of a rigid image. Its settings:

| Setting | Value |
|---|---|
| Stiffness, damping | 110, 13 |
| Response to forward speed | 10° / 6° (upper / lower link) |
| Response to vertical speed | 7° / 4° |
| Spring limit | 32° |
| Hang | 0.45 |
| Gravity | 0.6 |
| Clearance | 12° in front of the most forward thigh |

The result:
- At rest it hangs exactly as before.
- It trails slightly when running or lunging, and floats slightly in a fall.
- A raised knee lifts it.
- When the hips tip it keeps most of its hanging direction.

**Clean-up found during the test (no new art).** The Golden hips art still had the original short tabard painted into it. It showed under the long tabard whenever a knee lifted the tabard. The parts cutter now removes that panel and paints the trousers' cloth in its place (seam, crotch, shading taken from the cloth beside it). See `p4_hips_cleanup.png`.

### 1.2 Validation

Automated tests: B1–B8 all pass on candidate B. The Phase 1 engine suite passes 18/18.

**Idle silhouette.**
- In idle the tabard sits 0.00° from the rigid piece's angle (test B7).
- Against the Phase 3C capture, 172 of 508,400 pixels differ by more than 8/255, all along the tabard's edges (sub-pixel resampling of the strip). See `p4_tabard.png`, bottom.

**The four animations, 208 frames at 60 Hz** (`p4_tabard.png`, top; `reel_tabard.gif`):
- Largest swing: 54°, of which the spring is at most 32° and the rest is the lift by a raised knee.
- Lifted by a knee in 97 frames.
- Behind the most forward thigh in 0 frames.
- Lower link bent at most 26° against the upper one.
- Timings, events and hitboxes are unchanged. The animations were not touched.

**Extreme poses and a spring stress run (test B8, `p4_extreme_poses.png`).**
- Eight held poses: far knee to the hip, near knee to the hip, deep lunge, crouch, back kick, split, hips tipped forward 25°, hips tipped back 25°.
- Then a run, a sudden stop, a jump and an attack, with the springs carried over.
- The tabard is lifted up to 92° (a knee raised to the hip). It is never behind a thigh, and no link folds (the limit is 75°). Its lower link bends at most 47°.

**Mixed equipment (`p4_mixed_equipment.png`, `reel_two_chains.gif`).**
- Golden trousers with the basic top, and with the basic boots.
- Golden top, gauntlets and cape with basic trousers and boots.
- A plain coat-tail stand-in on the top's chain B, worn with the Golden trousers and with the basic trousers. The stand-in is a lab test piece, not a design.

With both chains worn together:
- One chain changes the other's motion, and the body's bones, by 0.
- Visibility over 32 poses:

  | Piece | Visible on average, worn alone | Visible on average, with the other item |
  |---|---|---|
  | Golden tabard | 73% | 73% |
  | Coat tails | 45% | 43% |

- The most either item hides of the other is 3.8% of the piece.
- No pose hides either piece completely.

### 1.3 Known limitations

- The strip bends in 2D. Lifted near horizontal over a knee at the hip, it reads as cloth lying on the thigh, but with no fold or foreshortening.
- The top of the tabard's first link keeps the belt's direction, so the cloth stays under the buckle.

## 2. Step 2: Ember Duelist concept

**v1 was off-model.** Measured against the canonical body, v1 came out 3.4 heads tall (top of hair to chin = 1/3.4 of the height). At the same in-game height its head was about 12% smaller and its legs longer.

**v2 corrects it.** I asked the image tool to edit the basic-clothing figure of the canonical body and change only the clothes. v2 measures 3.0 heads (1/3.02), the same as the approved illustration and the rig (1/3.01). It keeps the same face, hair, sword, grip, stance and size. See `p4_proportions.png`.

The design follows the brief:
- long split crimson and charcoal coat, high collar;
- asymmetric half-cape with the sun brooch;
- bronze buttons and fasteners;
- wide sash with a hanging end, belt with a ring, pouch;
- slim trousers, tall riding boots, fingerless gloves;
- short scarf with a loose end.

**Panel map (`p4_ember_panel_map.png`).** Approximate outlines for planning, not cut lines.

Rigid on the body:

| # | Piece | Attaches to | Item |
|---|---|---|---|
| 1 | Coat body, collar, scarf wrap, aiguillette | chest | top |
| 2 | Half-cape and brooch | near-shoulder cap: turns half as far as the upper arm | top |
| 3 | Sleeves and bracers | arms | top |
| 4 | Fingerless gloves | hands | gloves |
| 5 | Sash, belt, ring, pouch, short front flap | hips, drawn over the trousers | top |
| 11 | Slim trousers | hips and legs | trousers |
| 12 | Riding boots | shins and feet | boots |

Swinging on their own chains, each with its own anchor, spring and layer:

| # | Piece | Chain | Layer |
|---|---|---|---|
| 6 | Near front panel | own hip chain, clear of the near thigh | in front of the legs |
| 7 | Far front panel | own hip chain, clear of the far thigh | between the far leg and the near leg |
| 8 | Sash end | short chain at the sash knot | — |
| 9 | Back tails | the top's chain B | behind the legs |
| 10 | Scarf end | short neck chain, separate from the cape | — |

**What the coat needs from the rig** (for approval before the sheets):
1. A top-owned waist slot drawn over the trousers' hips, because a coat is worn over the trousers.
2. Front chains for the top, one per leg, with their own slots.
3. A short sash-end chain.
4. A short neck chain for the scarf.

All are optional and tuned per item, like chains A and B, and would be built and tested in the lab before cutting.

**Layering when mixed with the Golden trousers.**
- The tabard hangs at the centre front, between the coat's front panels. It draws over their inner edges and under the coat's sash, so both stay visible.
- Behind the legs, the coat's tails draw over any trousers' back piece.

## 3. Step 3: comparison with the Golden Warrior

The Golden Warrior is the in-game V4 rig render. The Ember Duelist is concept v2. Both are at the same height (soles to top of hair, the ×1.12 standard):
- Grinding 1.0: 104 px;
- Boss 0.85: 88 px.

Images:
- `p4_gameplay.png`: 1:1 crops of the 1280 × 720 view on the Legacy Courtyard map.
- `p4_frames_720p.jpg`: the full 1280 × 720 frames at both presets.
- `p4_preview.png`: the enlarged wardrobe preview (B = 370 px).
- `p4_silhouettes.png`: silhouettes only.

**Silhouette only, no colour.** The two silhouettes are aligned at the soles and the face.
- Overlap (IoU): 0.71 large, 0.72 at Grinding, 0.69 at Boss. About 30% of the combined shape belongs to only one of them.
- Area ratio: 1.03.

Widths in B, Golden → Ember:

| Height | Golden | Ember | Why |
|---|---|---|---|
| Shoulder line | 0.42 | 0.55 | the scarf end |
| Waist | 0.41 | 0.36 | |
| Mid-thigh | 0.38 | 0.33 | |
| Knees | 0.25 | 0.36 | the coat flaring |
| Shins | 0.28 | 0.28 | |

**What separates them at gameplay size.**
- Golden: the cape's block behind the back and the armoured shoulders.
- Ember: the scarf's flag at shoulder height, the slim waist and the coat flaring at the knees.
- By value alone (no hue): Golden averages 118 (metal), Ember 98 (dark cloth).

**Verdict.** The two premium outfits are distinguishable at both gameplay sizes, by silhouette alone and by value. They share the head and the sword by design. Worn without its cape, the Golden Warrior relies on its armoured shape, and the difference then rests mostly on the Ember's scarf and coat tails.

## 4. Decisions for you

1. Step 1: approve the hip chains, the layering rule and the hips clean-up.
2. Approve Ember Duelist concept v2 for the modular sheets, or list the changes you want first.
3. Approve the rig additions the coat needs (§2) before the sheets: the waist slot over the trousers, per-leg front chains, the sash-end chain and the scarf's neck chain.
