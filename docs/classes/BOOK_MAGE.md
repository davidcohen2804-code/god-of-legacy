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
| 1 | Arcane Wave | A wide short wave that lifts a grounded foe (bounces one in the air). | GPT's painted wave of arcane water (glassy sapphire to turquoise, its crest curling into foam, gold stars in it), rippling as it rolls out along the lane; two smaller waves a beat behind at either side; spray where it strikes. |
| 2 | Binding Rune | Two runes on the floor (10 s); stepping on one binds 3 s; two close runes join in a beam. | Each rune a small compass seal turning in the floor while it waits; sprung: the seal flares under the foe and four gold chains of light shoot up from its points and close round him, humming for the 3 s, snapping into motes. |
| 3 | Astral Wheel | A wheel of starlight on the floor where she aims, 5 s: taps every foe on it every 0.5 s; she casts on freely. | GPT's starlight wheel (gold runes, constellations, the eight-point star) flat on the planks, turning; each tap its light pulses; thin classic bolts fall onto it. |
| 4 | Frost Nova | A ring of ice round him chills (freezes the chilled). | Cold motes spiral in to his feet over a frost seal; then hoarfrost ferns race out over the planks, two rings of ice crystals break out of the floor one after the other, an ice star at his heart; the frost lies a moment and melts. |
| 5 | Lightning Chain | Lightning seizes the first foe and leaps to 3 more, holding them up; conducts through the chilled. | Each link one classic thin painted bolt laid along it, flickering twice; fine sparks at the foe; the last link a thin bolt from the sky. |
| 6 | Storm Field (signature) | A field where he aims: four pulses slow and draw foes in, the last throws them up. | The seal and the storm cloud; every pulse a classic thin bolt (GPT: white-hot hairline core, fine forks) onto its heart, the last the biggest; stray thin bolts round it. |
| 7 | Time Collapse (ultimate) | A great area: draws foes in, freezes them 1 s, then a blast that shatters them (ends the combo). | His white-eyed portrait with lightning crosses the screen as the great seal opens and the storm gathers; a dark tornado drops out of the cloud onto the field and draws them in, lightning lashing all round — **time stops**: the tornado stands still, the lightning hangs frozen in the air, a gold star of stillness; then it all shatters: a beam onto its heart, a giant gold star, the floor torn, the frozen storm bursting into motes. | (18 Nov: its lightning is the classic thin painted bolt now, fewer and gentler.)
| Q | Cloud Ascent | Clouds lift her ~130 px; she hovers 8 s, walking and casting from the air. | GPT's soft lavender clouds gather at her feet and carry her up; they drift under and round her while she hovers. |
| R | Frost Field | A wide ice floor where she aims, 6 s: foes on it move at 40 %. | GPT's sheet of glassy ice and frost ferns spreads flat over the planks, glinting, then melts. |
| F | Levity Field | Gravity turns over: foes float (held 0.9 s, hover to 2.5 s). | The starlight wheel opens on the floor in cold blue, turning the other way; pages, stones and motes rise slowly out of it. |
| G | Origami Flock | Five homing paper cranes (+1 per torn page lying near). | Pages flutter out of the book; each flies as a real paper crane in the room, its wings beating, gold trails; it bursts into torn paper and a gold glint where it strikes. |
| C | Arcane Ward | A shield of 20% HP for 8 s (party 10%); breaking, it chills round him. | A gentle aura: a small starlight wheel turning under her feet and a slow ribbon of blue and gold motes circling her. |
| V | Paper Curse | Silence: folded into a paper crane 1.2 s (cannot attack). | Pages fly to the foe and wrap him in a whirl of torn pages, a gold star as it takes. |
| T | Tempest Trio | Three tornadoes rise round the field she aims at, drift in and wander it 10 s, lifting whoever they touch. | The painted storm tornado three times, each on its own path. |
| H | Rift Gates | Two portals standing in the air (10 s); walking into one carries her out of the other. | GPT's rift standing upright — a violet tear rimmed with gold runes; crossing, both flare and the blink flare marks where she comes out. |
| Z | Thunder Ring | Held up to 8 s, rooted: a ring of lightning round her widens 60 → 290 px, shocking whoever it holds. | GPT's ring of crackling lightning flat round her feet, turning and widening; small thin arcs snap on its rim. |
