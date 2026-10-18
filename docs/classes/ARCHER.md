# The Archer — characterisation (DFO, 18 Oct; David 18:33: "go over her yourself, surgically; characterise her down to the last detail and improve her significantly — the effects, what she does, the idea")

## Who she is
The ranger of the wild wood. Her card: a hooded huntress in forest green and leaf-gold filigree, worn leather, a golden
bow grown of vines and leaves, a quiver of real arrows with white fletching. **Everything she does is the wood answering
her:** her arrows (real ones), the wind that carries them, the leaves of her cloak, the thorned vines under the planks,
and the wood's spirit beasts — hawk, wolf, eagle — in pale spirit light.

## The look (one language for every skill)
- **Her arrows are real arrows** flying in the room's 3D: a dark shaft, a gold broad head, white fletching, a star of
  light at the head and a thin trail; they stick in the planks where they fall (at the angle they flew) and sink away.
- **Leaves** (forest green, gold-edged, as on her cloak) are thrown where her blows land, torn off her bow on a heavy shot,
  carried by her wind.
- **Colours:** forest green `#3f8f34`, leaf green `#7fd65a`, leaf gold `#ffd27a`; her wind pale green `#d8ffd0`; the
  spirit beasts' pale light `#9dffc8`. Her two elemental arrows keep their own: FIRE (Fireball Arrow), STORM (Thunder Rain).
- **Shapes of her own:** a wreath of leaves turning (her mark: before her bow while she streams, on Hunter's Rain's mark,
  under Sky Rain), thorned vines of light growing out of the floor, geysers of wind and leaves.
- In PVP 3D the room's pieces carry her (`src/arena3d/fx3d/archer.ts`, pieces in `fx3d/pieces.ts`); the painted layer
  (`ArcherFx`) keeps what is painted best — the spirit beasts (hawk, wolf, eagle), the leaf decoy, the big boot of the
  kick, the mine lying in the floor, the Hunter's Marks, the ultimate's portrait — and no longer draws her arrows, her
  tree or hit sparks there.

## The skills (numbers unchanged unless written)
| Key | Skill | What it does | How it looks (PVP 3D) |
|---|---|---|---|
| Space | Double Shot | Tap: two fast arrows, then a charged arrow that throws back. Held: a stream (arrows nonstop, every 5th gold). | Real arrows with leaf-green trails; the charged one a big gold arrow, leaves torn off her bow as it leaves. Held: a wreath of leaves turns upright before her bow and the arrows stream out of it. |
| 1 | Rising Arrow | An arrow into the floor before the foe; a column of wind throws him high. | She looses an arrow that drives into the planks before him; a twisting geyser of wind and leaves bursts up out of the floor there and throws him. |
| 2 | Wind Step (air) | A gust throws her back; mid-leap an arrow into the floor bursts and throws the foe up. | A ribbon of wind along her leap; the arrow drives in and bursts in leaves and a ring of light. |
| 3 | Triple Arrow | Five arrows in a fan. | Five real arrows fanning out, green and gold in turn, leaves where they land. |
| 4 | Fireball Arrow | A burning arrow that bursts into fire. | A real arrow wrapped in flame with a trail of fire; where it strikes the blast of fire (its own blow: a flash, a shell of flame, the planks torn, embers) and a column of fire bursting up under the foe as it throws him. |
| 5 | Retreat Kick | A rising kick that launches while she flips back. | The painted boot turned toward the blow carries the kick; a crescent of wind sweeps up with it, leaves torn up off the floor into it, a ring where it lands. |
| 6 | Air Volley (signature) | A leap firing five volleys from the air. | A ribbon of wind drawn behind her along the whole arc; real arrows from the air, the fifth (the mark) gold; leaves thrown up at the take-off. |
| 7 | Sky Rain (ultimate) | The whole sky pours arrows on every foe; the last wave knocks them down. | Her portrait races across; she looses a volley up into the sky (her arrows climbing out of the frame); then real arrows pour down at a slant over the whole field, each sticking a moment in the planks and sinking away — no circle on the floor, nothing left lying (David 01:33); on each wave a few strike the foe himself; the last wave one giant gold arrow out of the sky onto the main foe, a beam and a burst of leaves. |
| Q | Vine Mine | A mine: whoever steps on it is held, 2 s later it explodes and throws them high. | Sprung: six thorned vines of light coil up round the foe and hold him; then a geyser of wind and leaves bursts out of the floor, the planks torn. |
| R | Thunder Rain | Leap, hang charging, loose three lightning arrows before and over her; the floor stays charged. | Lightning runs into her bow from all round, faster and faster, while three real arrows of lightning appear one after another in a fan over her shoulder, crackling, each bigger; at each beat one is loosed — a jagged bolt (keeping its blue) strikes from it to its point and the arrow rides it down and sticks there, a shell of storm light, the planks torn; the third the greatest, two bolts out of the sky beside it. The charged floor: blue arcs crawling over the planks there (no glyph — an added glyph whited the planks). |
| F | Spirit Bow | The great spirit bow: one piercing arrow that throws down (her finisher). | A great bow of spirit light stands before her, its string drawn back over the wind-up, a small wreath turning at its grip; one great arrow of spirit light tears down the line; the foe thrown down tears the floor, leaves fly. |
| G | Hunter's Roar | The wolf spirit's roar throws every foe round her back. | The painted wolf rears and howls; the roar rolls out both ways along the floor as two crests of spirit wind, a gale of leaves thrown out, the air bent (the blue lightning on the floor is gone: the wolf is a spirit of her wood). |
| C | Binding Leaves | A band of leaves and vines across the floor binds everyone on it 1.6 s; the leaves stay ~3 s (catch). | Leaves sweep across the band and settle on it, three thorned vines run along it; every bound foe has vines coiling up round him. |
| V | Spirit Hawk | A hawk that roams 20 s and dives on foes by itself. | The painted hawk; each dive a thin line out of the sky, the floor torn, feathers of leaves. |
| T | Tree of Life | A tree of light for 20 s healing the party near it. | A real tree grows out of the planks just behind her (where its apples fall from): roots of light run out over the floor, a dark trunk rises twisting with gold veins of life running up its bark, six branches spread, a crown of her leaves opens and sways for its 20 s, a soft gold light in it, gold motes rising; at its end the leaves fall and it sinks back into the floor. It stands behind the fight (the painted tree stood in front of it and hid it). |
| H | Vine Lash | A thorned vine arrow that snags the foe (in the air too) and yanks him in. | A real arrow with a thorned vine running out behind it from her bow; leaves and a ring where it snags him. |
| Z | Eagle Tide | Charge, then a giant spirit eagle sweeps half the field. | The painted eagle; a great crest of spirit wind the length of the field, a streak over it, leaves torn along its path. |
| X | Hunter's Rain | 5 s of arrows falling on a mark she steers (every 5th a great one; re-press ends it). | A wreath of gold leaves turns flat on the mark; real arrows fall out of the sky onto it and stick in the planks; every fifth one great gold arrow with a burst, the last the greatest. |
| B | Leaf Decoy (Backstep Shot) | A back flip leaving a decoy of leaves that snares whoever touches it; a spirit arrow from the flip's top. | The painted decoy; leaves torn off her as she flips, a ring of thorn green; the spirit arrow a heavy real arrow with a big star. |
