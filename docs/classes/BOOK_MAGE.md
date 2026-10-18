# The Book Mage — characterisation (DFO, 18 Oct; David 18:31: "go over it deeply, freehand, build it as it should be")

## Who he is
A celestial scholar whose grimoire is a star chart. His card says it all: silver hair, blue and white robes edged in gold,
an open blue book with a compass star on its cover, and blue starlight with four-point star glints round his hands.
**His magic is starlight read out of his book.** Every spell opens at the book (a star at his hand, or the book's compass
seal standing upright before it) and every blow lands as a star.

## The look (one language for every skill)
- **Astral** (his own magic): royal-cyan blue `#3f9dff` with star gold `#ffc75a`; the deep night blue `#0c2257` is the
  painted body of his columns. Motifs: the four-point star; the compass seal (a ring of runes round the compass rose of the
  book's cover).
- **Frost** chapter: ice cyan `#8fe0ff`, white `#d6f4ff`; hoarfrost ferns spreading over the floor, ice crystals.
- **Storm** chapter: blue-white `#8fb2ff` fringed violet `#b7a2ff`; dark storm clouds and dark funnels (`#1c1838`) lit
  from inside by lightning.
- **Paper** chapter: cream pages `#f6eedc` edged in gold; real paper cranes, torn pages.
- On the bright red planks a light added alone turns white: every star, seal, frost and bolt is **painted in its colour**
  (normal blending) **under its glow** — it keeps its hue. Nothing pure white but a blow's flash.
- In PVP 3D the room's pieces carry the skills (`src/arena3d/fx3d/book_mage.ts`, pieces in `fx3d/pieces.ts`); the
  painted layer (`MageFx`) only keeps the states on the foe (chill, freeze, the curse, levity) and the ultimate's portrait.

## The skills (numbers unchanged unless written)
| Key | Skill | What it does | How it looks (PVP 3D) |
|---|---|---|---|
| Space | Arcane Bolt | 3-beat chain: two star darts, then a piercing lance that throws back (shatters the frozen). Attuned: frost / storm bolts. | A star at his hand on each throw; each dart a spinning four-point star with a thin trail; the lance charged on the upright compass seal, then a star drawn out along its flight, a ring thrown off its head; every hit lands as a star (the lance's a big gold one). Frost bolts leave small crystals, storm bolts crackle. |
| 1 | Arcane Wave | A wide short wave that lifts a grounded foe (bounces one in the air). | The seal flashes under him; three painted crests of starlight run out across the lane's depth (the middle one tallest), stars glinting in their foam, a band of light left on the planks. |
| 2 | Binding Rune | Two runes on the floor (10 s); stepping on one binds 3 s; two close runes join in a beam. | Each rune a small compass seal turning in the floor while it waits; sprung: the seal flares under the foe and four gold chains of light shoot up from its points and close round him, humming for the 3 s, snapping into motes. |
| 3 | Astral Lift | A hand of starlight seizes, draws in and throws the foe up; he sinks back slowly (1.8 s). | A constellation lights on the floor under the foe (its stars drawn together by lines), the seal opens; it erupts as a column of night sky streaked with starlight (deep blue body, gold top) and a gold star bursts at its top; he sinks back in a soft column of night with gold stars rising in it. |
| 4 | Frost Nova | A ring of ice round him chills (freezes the chilled). | Cold motes spiral in to his feet over a frost seal; then hoarfrost ferns race out over the planks, two rings of ice crystals break out of the floor one after the other, an ice star at his heart; the frost lies a moment and melts. |
| 5 | Lightning Chain | Lightning seizes the first foe and leaps to 3 more, holding them up; conducts through the chilled. | The book crackles; a forked bolt (keeping its blue) leaps book → foe → foe, each struck one crackling in small arcs, a star at each contact; the last link a bolt out of the sky. |
| 6 | Storm Field (signature) | A field where he aims: four pulses slow and draw foes in, the last throws them up. | The compass seal opens on the floor and a dark storm cloud gathers over it; the wind turns on the floor, stray bolts fall out of the cloud lighting it from inside; each pulse a bolt onto the heart; the last a great strike: a beam out of the sky, a star, the floor torn, a ring over the floor. |
| 7 | Time Collapse (ultimate) | A great area: draws foes in, freezes them 1 s, then a blast that shatters them (ends the combo). | His white-eyed portrait with lightning crosses the screen as the great seal opens and the storm gathers; a dark tornado drops out of the cloud onto the field and draws them in, lightning lashing all round — **time stops**: the tornado stands still, the lightning hangs frozen in the air, a gold star of stillness; then it all shatters: a beam onto its heart, a giant gold star, the floor torn, the frozen storm bursting into motes. |
| Q | Blink | Vanish and reappear a short way off (2 in a row), stunning a foe passed through. | He folds into a star where he stands; a ribbon of light runs to where he steps out, a streak over the floor; he unfolds out of a star there, a small seal flashing at his feet. |
| R | Glacial Spikes | Three rows of ice spikes in a fan throw foes up and chill; they stand 1.5 s as a wall. | Three lines of ice crystals break out of the floor one after another, growing as they go, a vein of hoarfrost under each line; they stand as a wall, then shatter. |
| F | Levity Field | Gravity turns over: foes float (held 0.9 s, hover to 2.5 s). | An ice-white seal turns slowly on the floor, a soft column of pale light with a dark ice body over it, motes and torn pages drifting up it. |
| G | Origami Flock | Five homing paper cranes (+1 per torn page lying near). | Pages flutter out of the book; each flies as a real paper crane in the room, its wings beating, gold trails; it bursts into torn paper and a gold glint where it strikes. |
| C | Arcane Ward | A shield of 20% HP for 8 s (party 10%); breaking, it chills round him. | A sphere of hexagons closes round him (the seal under him as it opens); it lights where a blow lands on it, and shatters into light when it breaks. |
| V | Paper Curse | Silence: folded into a paper crane 1.2 s (cannot attack). | Pages fly to the foe and wrap him in a whirl of torn pages, a gold star as it takes. |
| T | Elemental Ascension | 20 s: every hit both chills and shocks. | The seal opens under him in frost and storm; the two lights braid up round him in streams turning against each other, bolts strike down onto him, a beam of frost light; then for 20 s ice motes orbit him and small arcs crackle over him. |
| H | Rift Gates | Two gates in the floor (10 s); stand on one and press: through to the other. | Each gate a portal in the floor — a dark well with light spiralling down into it inside a burning gold ring of runes, pages circling over it; crossing, light pours down into the gate under him and he rises out of the other in a beam, a star round him. |
| Z | Tempest Ride | Ride a tornado 2.5 s (steered, unstaggerable); it catches and throws foes. | A dark storm funnel streaked with light wraps him and travels with him, bending as it goes, sparks and pages spinning up it, bolts lashing out of it at each cut; at its end it is flung wide with a ring and a star. |
