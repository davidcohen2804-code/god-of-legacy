# The World in 3D — specification for David's approval (Maps, 17 Oct 2026)

Everything the Maps chat has built so far — the island (levels 1–10, with the floors above it and the sky), the Temple Road, chapter 3 and Elderwood Village, the Thief's Den, Sakura Temple, Ironhold, Astra Spire — re-specified as real 3D places on the shared 3D stage (`src/arena3d/Arena3D.ts`), with the story (quests, NPC talks, chapter openings) told through the new camera. Nothing new is added: the same maps, monsters, NPCs, quests and rewards; only how they are built and seen changes. The PVP 3D courtyard is the quality bar (modelled, lit, alive), not a template: every map keeps its own character.

Order: this spec → David approves (or changes it) → the first map the player sees, built perfectly and tested → the next, one at a time, each with its own headless test. Nothing is built before the approval.

---

## תקציר לדוד (ההחלטות שצריך לאשר)

1. **כל מפה היא מקום תלת-ממדי משלה** (כמו במייפל סטורי קלאסיק): עוברים בין מפות בקצה המפה, במעבר קצר (חצי שנייה של דעיכה) ולא ברצועה אחת רציפה כמו היום. ככה לכל מפה יש שמיים, אור, מזג-אוויר וחיים משלה, המפה נשארת קלה למחשב, והמצלמה לא מציצה למפה השכנה. הקומות העליונות (גבהי הקיסוס, הפסגה, המדרגות למעלה) הן חלק מהמפה שמתחתן — קרקע אמיתית בגובה; מפות השמיים (שביל השמיים, מעון העננים, מעבר שקיעת-השמש, מנוחת הזוהר) הן מקומות משלהן בשמיים.
2. **המשחק עצמו לא משתנה**: אותם רצפות הליכה, אותם מפלצות ומיקומים, אותם דמויות-צד, אותם קווסטים ותגמולים (הכול נקרא מאותו קובץ נתונים). רק הבנייה והמבט משתנים. הגיבורים, המפלצות והדמויות נשארים מצוירים (דו-ממד) ועומדים בתוך המקום התלת-ממדי עם הצל והאור שלו — כמו ב-PVP 3D.
3. **מצלמה** (כפי שנבנה בפועל במפות 1–11): 17° מעל האופק, פרספקטיבה, מרחק 9 יחידות, נקודת המבט מטר מעל רגלי הגיבור — כך הגיבור עומד בשישים אחוז מגובה המסך מעל סרגל הכישורים, ומעליו החומה, המרפסת העליונה ורצועת שמיים (ב-25° שתכננתי בהתחלה החומה מילאה את כל ראש המסך ולא נראו שמיים). המצלמה מובילה מעט לכיוון ההליכה, לא חוצה את קצות המפה, ובקרבות בוס נסוגה לפי המרחק (כמו בזירה). מעקב לגובה הקומות העליונות — נעשה (DFO הוסיף למנוע). לשמיים מצלמה שטוחה יותר (11°, שהאופק, השמש והעננים הרחוקים יישארו במסגרת), למאורה קרובה ומוטה יותר (21°, 8 יחידות — מערה).
4. **הסיפור דרך המצלמה**: כניסה למפה בפעם הראשונה — גלישה איטית של המצלמה שמציגה את המקום; שיחה עם דמות — דחיפה קלה פנימה אליה; קבלת משימה — פנייה קצרה לכיוון היעד; פתיחת פרק — נסיעה איטית עם כותרת; כניסת בוס — נסיגה, דפיקה על השאגה; שער השמש נפתח — פנייה אל השער; אבן-הדרך — הבזק ונחיתה מלמעלה.
5. **סדר הבנייה**: חצר המורשת תחילה (המפה הראשונה שהשחקן רואה), אחריה מפה-מפה לאורך הדרך: האי כולו, הדרך למקדש, הגנים בדמדומים, המאורה, סאקורה, איירונהולד, אסטרה. כל מפה מתקבלת רק עם בדיקה שלמה (הליכה מקצה לקצה עם צילומי מסך, קפיצות, מדפים, מעברים, דמויות, מפלצות, בלי שגיאות, זמן פריים).
6. **טקסטורות**: GPT (אריחים חוזרים + מפות נורמל) ברגע שהמכסה חוזרת (19:00); עד אז מודלים עם טקסטורות זמניות מהערכה הקיימת.
7. **מה נשאר מהדו-ממד**: תמונות המפות המצוירות יוצאות משימוש מפה-מפה כשהגרסה התלת-ממדית שלה עולה (הישנה נשמרת מאחורי `?world2d` להשוואה בזמן המעבר, כמו `?arena2d`).

**מצב (17.10 בוקר):** 38 מפות עומדות בתלת-ממד מאחורי `?world3d=1` עם טקסטורות זמניות — כל האי (15) והשמיים (4 מפות כמקום אחד), פרק 3 (6 מפות הדמדומים), חמשת חדרי המאורה, סאקורה (4) ואיירונהולד (4). הגיבור, המפלצות והדמויות המצוירים עומדים בהן עם צל ואור; מעברים בין מפות בדעיכה קצרה; הפנסים במאורה נדלקים לפי המשחק, השערים נפתחים כשהשלב נגמר; שער השמש נפתח לפי הקווסט. כל מפה צולמה בבדיקה אוטומטית (0 שגיאות). חסר: אסטרה (צריך קודם את נתוני הדו-ממד שלה), רחבת חותם השמש, תנועות המצלמה של הסיפור (דחיפה בשיחה, פנייה ליעד, פתיחות פרק, כניסות בוס), בדיקות הליכה/קפיצה/שיחה לכל מפה, וטקסטורות GPT מ-19:00.

אם משהו כאן לא לטעמך — זה הזמן לשנות; המפות נבנו מאחורי דגל והעולם המצויר נשאר ברירת המחדל עד שתאשר.

---

## Part 1 — the stage, the camera, the rules every map follows

### 1.1 One place per map

* Every map of the world is one **place**: `new Arena3D(scene, floor, { build: buildMap, cam: WORLD_CAM })`, with the map's own builder in `src/world3d/maps/<area>.ts` (`BuildPlace`: it gets the three.js scene behind the fighters, the one in front, the renderer, the walkable floor in units, and `soft`; it returns the same handles as the courtyard's `Room`: `sun`, `hemi`, `warm`, `groundY`, `blow`, `gust`, `update`, `shadowsDirty`, `dispose`).
* Maps are **discrete**, as in MapleStory Classic: the floor ends at the map's edge; walking past the edge (or using the way out: a gate, a stair, a cloud) crosses into the next map. The crossing: the picture fades over 180 ms, the next place is built (its textures already cached after the first visit; the geometry merges in well under a frame's worth of work at 60 fps-equivalents — measured per map, kept under 300 ms), the player appears at the entry edge still walking, the picture fades in over 220 ms and the map's name card shows. No loading screen. (The seamless 2D strip is retired: one continuous 545-unit scene would be far too heavy, could not change sky and light along it, and needed the camera walls the towns have today.)
* The 2D data stays the source of truth for everything that plays: `src/data/world-areas.json` (the walk polygons, the props' footprints and heights, the spawns, the NPCs' spots, the quests), `world-heights.json`, `world-clouds.json`, `world-towers.json`, `world-goldgate.json`. The 3D builders read them, so the monsters, NPCs, quests and rewards work unchanged; the collision stays the game's own (`WorldGeometry`). The map pictures (`world-strip.json`, the strip tiles, the heights' and clouds' pictures, the painted props) retire map by map; the minimap keeps its painting.
* Heroes, monsters and NPCs stay painted (2D): the stage places every one of them where its camera sees its floor point, at the size its depth gives, with its sun shadow and the place's light on it (as in PVP 3D). The scene registers every body (hero, monsters, NPCs) in `a3d.bodies` and `a3d.anchors`.

### 1.2 Scale

* 1 unit = 100 world px (the stage's `U`). The hero stands 1.24 units (HERO_HEIGHT 124 px); a door is 2.2–2.6; a storey 3.2; a balustrade 1.0; a stone block you jump on 0.6–0.9; the Elder Tree's trunk 6 wide.
* A map's floor keeps its 2D size: 16.7 units wide (1672 px) and the walk polygon's depth (the island's 346..652 px → 3.5 units deep, the towns' narrower floors as they are). The modelled ground extends far beyond the floor on every side (so the camera never sees an edge of the world): back to the far scenery, front past the camera.

### 1.3 The world camera (`WORLD_CAM`)

* **As built on maps 1–11 (18 Oct):** pitch 17°, fov 34°, dist 9.0, aim 1.0 (the look point a unit over the hero's feet: he stands at 60 % of the screen's height, over the skill bar, with the wall, the upper terrace and a band of sky above him). The spec's first numbers were 25° / aim 0.5: at 25° the wall behind every terrace filled the top of the frame and no sky showed; 17° opens the view like the paintings do and keeps the floor's depth readable. `distPerSpan` 0.3 and `distMax` 13 for fights spread out (a boss), `yawMax` 5° (a gentle turn toward the map's end the player walks to), `follow` 0.1. (The arena: 24° / 32° / 8.4.)
* **Lead**: the focus runs 0.9 units ahead of the hero in the direction he faces (eased over 600 ms when he turns), so he sees where he is going.
* **Clamp**: the focus never comes nearer than half the view's width to the map's ends (the camera shows no void past the floor's end; the far scenery continues anyway).
* **Height**: climbing (a ledge, a floor above, a cloud) raises the focus with the hero's floor (`focus.z` as the stage does: 40 % of his height), never snapping; on the sky maps the camera keeps its pitch (the clouds' flat tops read as floor).
* Combat: the stage's own answers stay (the push-in and jolt of heavy blows, the darkening on an ultimate, Fx3D's pieces, the hit lights on the ground).

### 1.4 The ground, the floor and the ledges (what the camera angle changes)

The old pictures drew everything flat; at 25° in perspective, every surface has a top and a front:

* **The walkable floor** is a modelled surface at height 0 (paving, planks, grass, earth, cloud) over the walk polygon, with a visible front edge where the floor ends toward the camera (a terrace's balustrade and its wall below it, a bridge's parapet, a cliff's edge) and whatever stands behind it along its back edge (a wall, a hedge, a colonnade, a tree line).
* **Blocks and platforms** (the `props` with a `stand` surface) are real solids at their footprints: a top at their height, four faces, a bevel, a contact shadow (AO decal); the hero lands on the top the collision already defines.
* **Floors above** (Ivy Heights, Ivy Summit, Orchard Heights, Crimson Heights: `world-heights.json`, H = 3.5 / 6.8 units up) are real upper terraces behind the floor: a wall face rising from the floor's back edge to the terrace's lip, the terrace's own floor on top (its walk range), its own balustrade behind it, reached by the **climbing blocks** (`world-towers.json`: stair-stepped stone blocks 0.86 / 1.72 / 2.62 units tall) that lead up to it. The hero on the upper floor is placed by the stage at (x, its floor's depth, H + his height).
* **The sky maps** (Cloud Haven, Sunfall Pass, Afterglow Rest; H = 8 units up) and the **Sky Path** (the lane of clouds between Ivy Summit and Cloud Haven, `world-clouds.json`) are places of their own: cloud floors (flat walkable tops at the clouds' heights, soft/one-way as today) made of cloud volumes, sky all round, the island far below in the haze.
* **The Sun Gate** (between Upper Gardens and the Training Grounds) and the **Temple's stage** keep their footprints and their doors' logic; they are modelled.
* **Nothing floats, nothing is seen through**: every modelled piece touches the ground (AO decal at the contact), every wall has thickness, every roof an underside; no painted cut-outs stand in a 3D place.

### 1.5 Light and air (per map, the builder owns it)

* A sun (`DirectionalLight`, soft shadows, 2048 map; the shadow camera follows the hero so the whole map keeps sharp shadows), a sky light (`HemisphereLight`), the sky dome (the courtyard's shader: three colours and a slow cloud band, plus a far panorama where the map has one), fog (colour and range per map), tone mapping ACES 1.08, bloom (the stage's), the `environmentIntensity` 0.3.
* **Warm lights** (lanterns, forges, glowing mushrooms, doors) are `PointLight`s in `warm` (they burn on when the stage darkens for an ultimate) — at most 4 per map besides the stage's hit lights, the rest emissive + glow sprites.
* The stage's answers to blows need the floor's material: the builder gives `blow` and `gust` (petals, leaves, dust) and the dust colour of its floor (a request to DFO: `Room.dustColor`, so a blow on grass throws green-brown, on cloud white).

### 1.6 Life (every map has it; the modules are shared: `src/world3d/life/`)

Reusable, already written (26cacc62): **birds** (a flock circling and perching), **butterflies** (by day) and **fireflies** (at dusk, brighter when the room darkens), **cloth** (banners, nobori, paper streamers waving in the wind, whipped by a gust), **paper lanterns** swinging on their cords, a **pond** (a real mirrored reflection with ripples, koi, lily pads), **incense smoke**, **clouds** drifting, **onlookers** (painted NPC sheets standing in 3D with shadows). To write as the maps need them (listed per map below): **grass and reed sway** (instanced blades in the wind), **falling leaves / petals / wisteria** (the courtyard's petal system generalised: a leaf texture and colours per tree), **waterfalls** (a scrolling falling-water shader with mist at the foot and spray particles; a river surface that flows), **lantern flames** (a flicker in the lamp's light and glow), **sparks and embers** (forge, quarry), **drifting cloud wisps** at foot level (the sky maps), **sunbeams through leaves** (shafts; the courtyard has them), **mist** on water and in hollows, **mushroom glow** pulsing (the den), **flags** on poles (cloth), **crows / bats** (birds with another look: the ruins at dusk), **torch fire** (a small flame billboard set + light).

### 1.7 Textures

* Painted by GPT as tileable 1024² tiles with a normal map derived (`RoomKit.normalFrom`) or painted; stored under `public/assets/world3d/tex/<kit>/<name>.webp` (+ `_n`); every builder falls back to the kit's procedural noise until a tile exists (the courtyard does the same). The tiles are listed per kit below; the prompts follow ART_STYLE.md (painted, warm, readable at game size, no text).
* Until GPT is back (19:00): the courtyard's own tiles where they fit (stone, paving, planks, plaster, bark, blossom, lacquer, roof) and procedural stand-ins; the models and the maps' shapes are built meanwhile.

### 1.8 Story through the camera (the grammar; the beats per map are in Part 2)

| beat | what the camera does | time |
|---|---|---|
| **Arrival** (the first time a map is entered; later: a short version) | from a wide view at the map's entry edge (dist 13, pitch 20°, looking into the map) it glides to the hero (dist 9, pitch 25°) while he can already walk; the map's name card over it | 2.4 s (later visits 0.9 s) |
| **Chapter opening** (the first map of a chapter: the Legacy Courtyard, the Training Grounds after the Sun Gate, the Temple Road, Wisteria Walk, the Elder Hollow's door, each town's court) | a slow dolly along the map's back line (the camera 2 units higher, dist 14) past its landmark to the hero, with the chapter's title card ("Chapter 1 — The Legacy Courtyard"), then the arrival's glide | 5 s, skippable |
| **Talk** (standing before an NPC, the talk open) | eases 18 % nearer (dist × 0.82) and turns 4° toward the NPC so both faces are in frame; back on close | 500 ms in / 400 ms out |
| **Turn to show** (a quest accepted; a hint that names a place) | pans the focus up to 4 units toward the way to go (held 800 ms), with a soft marker on the horizon (a light) where the way is, then back | 2.2 s |
| **A gate opens** (the Sun Gate; the Elder Tree's door; a den gate) | turns to the gate, holds while the doors swing (their own light spills), the warm lights come up; back | 2.5 s |
| **Boss entrance** (the first time the hero comes within aggro of a boss) | pulls back to frame both (dist 12), a short darkening (`dimWant` 0.5 for 1.2 s) and the boss's roar kicks the camera (`punch` 1.08); the boss's name banner | 1.8 s |
| **Boss falls** | slow-motion 0.4 for 900 ms, the camera drifts 6° round the fallen boss (the stage's `swing`), the darkening lifts | 1.6 s |
| **Waystone travel** | the stone's rune flares, the picture whites out 300 ms; in the new town the camera starts 4 units higher and lowers to the hero (an arrival from above) | 1.9 s |
| **Level 10 / the Masters** | at the Temple Road's stage, talking to a Master: the push-in plus the Master's door light coming up behind him | as Talk |
| **Den stage clear** | the room's gate opens: the Gate-opens beat; Pip flies ahead, the camera leads 2 units toward the gate | 2.5 s |

Names, lines and rewards stay exactly the quests' own (`world-areas.json` → `quests`); the camera adds, never replaces.

### 1.9 Tests (every map, before it is marked done)

A headless Playwright run per map (`tools/world3d/test_<area>.mjs`, the harness from PVP 3D's tests): opens the game at the map (test mode's teleport), walks it end to end with a screenshot every 2 units from the player's own camera; jumps onto every block / ledge / climb and off; crosses both exits and comes back; talks to every NPC (the talk opens, the push-in happens, it closes); kills one monster of each kind (the drops fall and are picked up); runs the quest chain's steps that happen on the map; checks: no console errors or warnings, no object placed off its floor (a body's screen point against the projected floor point), the frame time's average and worst case (soft and hard), the count of draw calls and triangles (`renderer.info`) under the budget (≤ 250 draws, ≤ 600 k triangles per map). The screenshots are looked at by me (and DFO's review): nothing floating, nothing seen through, no invisible walls, shadows and dust right, the heroes and monsters at the right size.

### 1.10 Requests to DFO (the shared engine), to be posted on the board when the build starts

1. `Arena3D.dispose()` public, and `rebuild(floor, { build, cam })` (or a cheap `new` after `dispose`) so a map crossing swaps the place without restarting the scene.
2. The floor window in `apply()` (`o.depth - wy < 450`) widened for the floors above (H up to 800 px + a jump): a world hook `a3d.floorOf = (o) => number | null` the scene can set, else the window raised to 1000.
3. `Room` handles gain `dustColor` (the floor's dust / chips colour) and `footstep` kind (the blows' and steps' material) — optional fields.
4. The camera: `lead` and `clamp` are done scene-side through `focus`; nothing needed. `cam.pitch` per map (the den: 22°; the sky: 25°) is already an option.

---

## Part 2 — the places (one section per map)

Every section: **now** (what the 2D map holds today) · **3D layout** (the floor, what is behind and in front, ledges and climbs, where the camera looks end to end) · **models** · **textures** (the kit's tiles it uses, new ones named) · **light & life** · **story beats**.

Six kits of shared models and tiles are described once, then the maps that use them.

### Kit A — the Island (the Legacy Courtyard to Warden's Hold; Ivy / Orchard / Crimson Heights; the Temple Road)

The island is a chain of sun-warmed stone terraces on a mountainside at golden hour: a paved terrace with a balustrade along its front edge (the valley and far mountains beyond), a higher wall or a second terrace behind, red banners with the sun emblem, autumn ivy pouring over every parapet, stone blocks and urns, towers at the ends of some terraces, a sun-rune emblem set into the paving.

* **Models (RoomKit, merged per material):** the terrace slab (its front wall 2.8 units high down to the valley's mist, with a moulding and buttresses every 4 units), the balustrade (posts + rail + turned balusters, 1.0 high, a run with gaps for stairs), stone blocks (bevelled boxes 1.8 × 0.9 × 1.2 with a worn top), urns (lathe, 0.9 high, with trailing ivy and red flowers), the wall behind (a terrace wall 3–4 units high with pilasters, arched niches, a cornice; where a floor above exists, that wall is the upper terrace's front), corner towers (round, 4.5 wide, 9 high, a conical roof, arrow slits, a banner), banner poles and hanging banners (cloth module), stairs (stone steps between levels, the balustrade's rails along them), the climbing blocks (stacked stones with worn edges), ivy (instanced leaf cards in autumn reds hung along the parapets and down the walls, swaying), autumn trees (the courtyard's tree grower with a maple crown: red/orange leaf clumps), far scenery (the valley's mountain range as layered relief meshes in the haze, a far waterfall or two as scrolling-shader strips, a far castle silhouette), the valley mist (soft drifting sprites below the balustrade), the sun-rune emblem (a decal on the paving with a faint gilt inlay).
* **Tiles:** `sandstone_paving` (warm flagstones), `sandstone_wall` (ashlar), `sandstone_moulding`, `cobble_worn`, `ivy_autumn` (leaf card atlas, 4 clumps), `maple_crown` (crown card atlas), `banner_red` (painted; the cloth module paints its own meanwhile), `urn_terracotta`, `roof_slate_tower`, `mountain_far` (a panorama strip), `mist_soft`.
* **Light:** the sun low from the front-right (the paintings' light: from the upper right), colour 0xffc07a, intensity 2.8, long soft shadows toward the back-left; hemi 0xffe0c8 / 0x6a4a3a 0.8; sky dome gold → rose → violet with the cloud band; fog 0xe8b890 from 40 to 110 units.
* **Life:** birds (a flock over the valley, perching on the towers and balustrade), butterflies by the ivy (day), the banners and small flags in the wind, falling autumn leaves from the trees (the petal system in reds), the valley mist drifting, clouds far, sun shafts over the floor, motes.

### Kit B — the Twilight Gardens (Wisteria Walk to the Elder Hollow, Elderwood Village)

The same terraces at dusk, gone soft and violet: wisteria hanging in curtains from pergolas and over the parapets, paper lanterns on cords between posts (Lumen lights them), moonlit waterfalls behind, fireflies, the Elder Tree's roots and moss where the village grows.

* **Models:** Kit A's terrace and balustrade re-dressed (the wall behind grey-violet stone), pergola frames (beams over posts with wisteria racemes hanging as instanced cards, swaying), lantern cords (catenaries of paper lanterns — the lantern module, warm light), the Moonfall waterfalls (three great falls behind the bridge: a scrolling water shader on tall curved surfaces, mist volumes at the foot, spray), the bridge (a stone arch bridge with a parapet, the river under it flowing), village houses grown into the roots of the Elder Tree (round doors, lit round windows, moss roofs, a well, crates, Hazel's stall with its awning and tray, the archery targets on hay bales), the Elder Tree (the hollow's landmark: a trunk 6 units wide rising out of frame, buttress roots the hero walks between, the sealed door in its base with the sun rune; the Elder Hollow's pond and mossy stones), glowcap mushrooms (emissive caps in the shade).
* **Tiles:** `stone_violet` (the dusk wall), `moss`, `bark_elder` (deep furrowed), `wisteria` (raceme cards), `lantern_paper_warm`, `water_fall`, `river`, `thatch_moss`, `wood_dark_planks`, `lilypad`.
* **Light:** the sun just set: a low rose-violet sky (0x5a3f6a → 0xb06a8a → 0xf0b0a0 at the horizon), the moon rising behind (a faint cool directional 0x9fb8ff 0.6 with soft shadows), the lanterns the main warm light (0xffa050, up to 4 points + emissive), fog 0x6a4a6a 30–90.
* **Life:** fireflies everywhere (the module), moths at the lanterns (butterflies' look swapped: pale grey), the lanterns swinging, wisteria swaying and dropping petals (violet), the waterfalls and their mist, owls' calls are sound (PvP's), bats crossing at the Hollow (birds' look swapped).

### Kit C — the Den (the Thief's Den: five rooms inside the Elder Tree)

Interiors: no sky. Root-walled caves lit by bioluminescent mushrooms (blue-violet) and the thieves' lanterns (warm), treasure heaped in the last rooms, wisteria creeping in through cracks.

* **Models:** a cave shell per room (a closed tunnel section: floor of packed earth and roots, walls and ceiling of woven roots — tapered tubes grown along the walls, root knots, hanging roots that sway), the entry wall (the way back sealed behind), the stage gate at each room's east end (a wall of roots that parts when the stage clears — animated: the roots pull aside), glowing mushrooms (instanced caps with emissive and a point light per cluster), lanterns on hooks, the root lanterns of room 2 (four pedestals with a lantern each — the puzzle's lights, lit/unlit states), the five lantern ledges of room 3 (stone shelves at different heights holding 1..5 lanterns), the Magpie's nest (room 4: a great nest of twigs and stolen cloth on a root platform, chests, a cauldron), the hoard (room 5: heaps of coins as a bumpy gold-textured mound with coin sparkle, open chests, barrels, gems), crates and shelves (room 1's cellar), the magical sigil spirals on the walls (emissive decals).
* **Tiles:** `root_bark`, `earth_packed`, `mushroom_glow` (cap atlas), `coin_heap`, `wood_crate`, `cloth_purple`, `sigil_spiral`.
* **Light:** no sun (a faint top light 0x2a2040 for shape), mushrooms' cool light (0x7a60ff), lanterns warm (0xffa050), fog 0x1a1020 10–40 (the far end of a room dims), the stage's darkening still works.
* **Life:** mushroom glow pulsing, hanging roots swaying, dust motes in the lantern light, fireflies (the sprites' sparks: Pip's trail is Pip's own), coins glinting in the hoard, the imps' dust.

### Kit D — Sakura (Sakura Temple, Blossom Steps, Fox Shrine Path, Bamboo Grove)

A mountain shrine in spring at the day's golden end: cherry trees in full blossom (the courtyard's trees), red torii gates, stone lanterns, a vermilion bridge over a stream, moss and stone steps, fox statues, bamboo.

* **Models:** the courtyard's own pieces re-used (the trees, the stone lanterns, lacquered posts and rails, the plaster-and-lattice walls, roofs with the curved eaves), the shrine hall (smaller than the arena's temple, a bell tower beside it — the bell with no clapper until the quest), the court's paving and its low fence, Jiro's tea stall (a counter under a cloth roof with kettles), stone steps up the mountainside between blossom (the Blossom Steps: three long flights with landings — the ledges), fox statues with bibs and lanterns (the Fox Shrine Path; their lanterns dark until Fox Fire), a tunnel of torii (12 gates in a row, the path under them), the vermilion bridge over a stream, a mountain stream with rocks, bamboo (instanced tall culms with leaf cards at the top, swaying; a grove dense behind, a clearing where the Ronin stand), the Tengu's roost (a great pine on a crag at the grove's end, its perch, feathers), paper streamers and shimenawa ropes.
* **Tiles:** the courtyard's `stone`, `paving`, `plaster`, `lacquer`, `roof`, `bark`, `blossom` + new `moss_stone_steps`, `bamboo_culm`, `bamboo_leaves`, `torii_lacquer_worn`, `stream_bed`, `fox_stone`.
* **Light:** golden-pink afternoon (sun 0xffc89a from the left-front), sky rose-gold, fog 0xf0c0c0 35–100, warm lanterns.
* **Life:** petals falling everywhere and lying thick (the courtyard's), the stream flowing with the bridge's reflection (the pond's water shader on a long surface), koi in the shrine's pond, birds (small, perching on torii), the bamboo swaying with a rattle, incense at the shrine, butterflies, the fox statues' lanterns lighting one by one as the quest completes.

### Kit E — Ironhold (Ironhold, Crag Path, Forge Road, Ember Quarry)

Red sandstone crags at sunset, a mountain fortress of the warriors: the parade ground before the keep, forge smoke, ore carts on rails, lava-lit quarry at the end.

* **Models:** the keep's gate and walls (crenellated red stone, banners, braziers), the parade ground (flagstones, a weapon rack, a drill dummy, Grit's forge under a timber roof with the furnace glowing, an anvil, a water trough), a great chain gate, crags (stacked rock boulders as layered lathes/boxes with a strata texture, ledges the hero jumps between — the Crag Path's floor is a ledge road along a cliff with the gorge below and a stone arch bridge), the Forge Road (a mine road with rails, carts, timber trestles, a water-wheel at a stream, a bell tower, chimneys smoking), the Ember Quarry (a pit of cut rock terraces, cranes, ore piles, lava seeping in channels — an emissive lava shader with slow flow and heat shimmer — the Crag King's cave mouth at the end with the war horn's pedestal inside).
* **Tiles:** `crag_red_strata`, `red_ashlar`, `iron_rust`, `timber_rough`, `lava_glow` (+ flow), `ore_pile`, `rails_sleepers`, `banner_crimson`.
* **Light:** a sunset sun from the right-front 0xffa060 2.6 with long shadows, sky orange → violet, fog 0xd08060 40–120; the forge and lava are the warm lights (0xff6020).
* **Life:** forge sparks and embers rising, chimney smoke (incense module scaled up, darker), the water-wheel turning with splashes, hawks circling the crags (birds), heat shimmer over the lava, dust devils on the road, banners, torch flames on the walls, the bell swinging at the hour.

### Kit F — Astra (Astra Spire and its three maps; built from the data already in `towns.py`, as far as it exists)

A floating scholars' city in a violet-blue dusk: white marble and gold, star crystals, floating islets, waterfalls pouring off the edge into cloud, a great library's facade, an observatory in ruins at the end.

* **Models:** marble terraces with gold inlay, the library front (tall arched windows glowing blue-gold, open books on plinths), star crystals (emissive clusters that pulse), floating islets (rock undersides with roots and waterfalls, drifting slowly up and down), the Starlight Bridge (a long marble bridge with lamp posts of crystal, gaps the hero jumps), the Floating Gardens (planters, scholar statues, hedges of pale leaves), the Observatory Ruins (a broken dome, a fallen armillary, the Grand Grimoire's lectern), clouds below everywhere.
* **Tiles:** `marble_white`, `gold_inlay`, `crystal_blue`, `cloud_below`, `book_spines`, `hedge_pale`.
* **Light:** a low violet-blue sky with a rising moon and a comet, the sun's last gold at the horizon, crystals as cool point lights (0x80a0ff); fog 0x8070b0 30–90.
* **Life:** drifting pages (the petal system with page cards), crystal pulses, the waterfalls into cloud, clouds below drifting (the clouds module placed low), shooting stars now and then (a streak sprite), the islets' slow rise and fall, fireflies as star-motes.

### 2.1 Chapter 1 — the Legacy Courtyard and the Terraces (levels 1–5)

#### M01 · Legacy Courtyard (`courtyard`, the start) — Kit A
* **Now:** the start map; Master Aldric (quests); 4 stone blocks, 3 urns; the picture: a wide stone stair up to a higher terrace at the back-left, corner towers, banners, the valley behind.
* **3D layout:** the floor 16.7 × 3.1 (the walk polygon has the stair's foot notch at x 1.7–4.1 where the floor reaches back to y 254: the bottom of the great stair). Behind the floor's back edge: the upper terrace's wall (3.6 high) with the great stair (12 steps, 4 wide, balustrades) rising to a landing that is scenery (closed by a gate of gilt bars: the Temple's own ground, not walkable), banners either side of the stair, corner towers at both ends. In front: the balustrade along the whole front edge over the valley, ivy spilling over it. The four blocks where they are (0.63 high), the three urns. The sun-rune emblem in the paving at the floor's middle. Camera end to end: west — the tower and the valley opening; middle — the stair and Aldric; east — the way out between the balustrade's end and the tower, the next terrace glimpsed lower in the haze.
* **Models:** Kit A (terrace, balustrade, wall with the great stair, two towers, 4 blocks, 3 urns, 6 banners, ivy, two maple trees at the back corners, far mountains and falls, mist). Aldric's spot gets a stone bench and a brazier (warm light).
* **Textures:** Kit A's tiles.
* **Light & life:** Kit A; birds perching on the towers; the brazier's flame and smoke; leaves falling from the two maples; sun shafts over the stair.
* **Story beats:** *Chapter opening* "Chapter 1 — The Legacy Courtyard": the dolly from the west tower along the balustrade to the great stair and down to the hero at Aldric. *Talk* with Aldric (push-in). **First Steps** accepted → *Turn to show* east (the Ivy Terraces). **The Sealed Road** → *Turn to show* up: the camera tilts 8° up toward the Summit's clouds (Nimbus). **Before the Road** done → *Turn to show* east and a light on the horizon (the Temple Road), Aldric's line about Elderwood. The Temple's portal arrives here (`portal → courtyard`): an *Arrival from above* (as the Waystone beat).

#### M02 · Ivy Terraces (`terraces_1`) — Kit A
* **Now:** Ivy Sproutlings (lv1, 7 spawns); a flowered arch at the back; a ledge prop, 3 blocks, 3 urns.
* **3D layout:** the same terrace one level down the mountainside (the courtyard's tower above and behind at the west end, seen over the wall); the back wall carries the rose arch (a stone arch with climbing roses, a niche with a small fountain basin — a pond module, small, mirroring the arch); the `ledge` prop is a raised garden bed (0.9 high, a stone kerb, flowers on top — walkable); the blocks. Front: balustrade. Camera: a continuous terrace, the arch its centre piece.
* **Models:** Kit A + the rose arch, the raised bed, a fountain basin, flower urns.
* **Light & life:** Kit A; butterflies at the roses; the fountain's trickle (water shader + ripples); the sproutlings' leaf dust (the stage's dust colour green-brown).
* **Story beats:** the Sproutlings for First Steps; no NPC. *Arrival* only.

#### M03 · Upper Gardens (`terraces_2`) + Ivy Heights + Ivy Summit + the Sky Path's first clouds — Kit A
* **Now:** Sproutlings below (lv1); the climb towers (climb-1..3: 0.86 / 1.72 / 2.62 high; summit-1..3 up to the Summit); Ivy Heights (H 3.5, Sproutlings), Ivy Summit (H 6.8, Thornlings lv6); the Sky Path's clouds begin at the Summit's east end (lane 4304–6700); the Sun Gate closed at the terrace's east end.
* **3D layout:** three levels in one place. The terrace (floor 16.7 × 3.1); behind it a wall 3.5 high — the front of **Ivy Heights** (its floor 16.5 × 2.3 on top, its own balustrade, its two blocks) — climbed by the three stacked stone blocks at x 5.6–11.1 (the stair of blocks the collision defines); above and behind the Heights, a second wall 3.3 high — the front of **Ivy Summit** (floor 10.9 × 2.3, its block) — climbed by the summit blocks. At the Summit's east end the first cloud of the Sky Path floats 0.4 above the lip (the way up: jumping onto it crosses into the Sky Path place). At the terrace's east end the **Sun Gate** (modelled: two gilt doors 4 wide × 4.5 high in a stone frame between short walls, the little sun in its lock, the plaque): closed until the sun is crossed, then open for good; a short walled passage behind it is the crossing into the Training Grounds. Camera: a stepped mountainside — each level's balustrade reads as a line, the gate's gold catching the sun at the east.
* **Models:** Kit A ×3 levels, the climbing blocks (worn stone with iron rings), the Sun Gate (gilt doors with the sun relief — the relief modelled as a lathe disc with rays, emissive gold rim when the gate opens), the first clouds (cloud volumes: a cluster of soft cloud sprites round a flat disc, the top walkable).
* **Light & life:** Kit A; cloud shadows crossing the terraces (a moving shadow texture on the sun: `sun.shadow` can't; a dark drifting decal instead); birds between the levels; the gate's gold glint.
* **Story beats:** *Gate opens* when the hero returns from the sky (the doors swing, light spills, the "Sun Gate" plaque fades). Standing at the closed gate: the plaque (kept) — the camera eases up to read it.

#### M04 · Sky Path (`clouds`: the lane 4304–6700, five clouds at heights 6.8–8.0) — the sky
* **Now:** a chain of five one-way cloud platforms (lengths 4–5.8 units, rising), one with an elixir every 5 min; the terrace far below.
* **3D layout:** a place with no ground: five cloud islands at the data's x and heights (z 6.8, 7.25, 7.8, 7.45, 8.0), each a puffy volume with a flat top, the gap between them a jump; the island's terraces 7 units below in the haze (a low relief of the terraces and towers, dim), the sky all round, the sun big and low to the east. The west end connects to Ivy Summit (jumping back down onto the Summit's lip), the east end to Cloud Haven.
* **Models:** cloud volumes (instanced soft cloud sprites round a lathe core, lit top, shaded belly), a few gilt floating lanterns (the path's markers), the far island relief.
* **Light & life:** the sun gold, the sky deep gold → blue overhead, fog bright 0xf6d0a0 20–60; wisps of cloud drifting across the tops at foot level; birds flying below the path; the clouds breathe (a slow scale 2 %).
* **Story beats:** *Arrival*: the glide starts far back and high (dist 15), showing the chain of clouds ahead.

#### M05 · Cloud Haven (`cloud_haven`, 33 units wide, H 8) — the sky
* **Now:** Nimbus (quests Lost Puffs, Cheer Up Big Grumble); Pufflings (lv3, 10 spawns); Big Grumble (lv5 boss) at the east end by "the great cloud wall"; four cloud blocks.
* **3D layout:** a wide cloud meadow (floor 33 × 2.3 on a sea of cloud), cloud banks rising behind it like hills, the four cloud blocks (soft mounds) to jump on, Nimbus's hollow (a bowl in the cloud with his cushion) near the west, Big Grumble's wall at the east end (a dark grey cloud cliff with a face-like fold, the east boundary; its gusts blow the hero off his feet — the data's `gust`). Below: the island far down.
* **Models:** the cloud meadow (a wide undulating cloud surface), the blocks, the cloud wall, Nimbus's cushion, little rainbow (a faint arc sprite in the mist).
* **Light & life:** bright gold-pink; the pufflings' puffs (dust white); wisps; birds; Big Grumble's huffs (a burst of cloud puffs from the wall).
* **Story beats:** *Talk* Nimbus. **Lost Puffs** → *Turn to show* across the meadow. **Cheer Up, Big Grumble** → *Turn to show* east; *Boss entrance* when he is reached (the camera pulls back as the cloud wall huffs); *Boss falls*: the wall brightens (a lighter cloud colour) and the sun's light reaches Sunfall Pass beyond — the way east opens (the wall parts: a Gate-opens beat).

#### M06 · Sunfall Pass (`sunfall_pass`, H 8) — the sky
* **Now:** the crossing of the low sun: a short cloud map, no monsters; crossing it sets `sun_gate` done (Solenne's quest opens).
* **3D layout:** a narrow cloud bridge (floor 16.5 × 2.3) toward the sun itself: a huge sun disc low ahead at the east (a bright emissive disc with rays and a halo; the sky washed gold), the clouds under the bridge glowing from within. Crossing the middle: the beat below.
* **Models:** the cloud bridge, the sun, rays (shaft meshes), gilt wind-chimes hanging from nothing (a few, cloth-module streamers).
* **Light & life:** overexposed gold (exposure up 15 % in this map), the sun's rays sweeping, motes bright; the chimes ring (a sound request to PvP).
* **Story beats:** *The sun crossed*: as the hero passes the middle, the camera pulls back and the sun's halo flares (`dimWant` negative is not available: use the bloom and a white vignette through Phaser), a line card "The sun's warmth stays with you". The Sun Gate is unlocked.

#### M07 · Afterglow Rest (`afterglow`, H 8) — the sky
* **Now:** Solenne, Keeper of the Sun, at the Sun Shrine (quest The Stolen Sun: 3 Sun Shards from the Sunbeams lv4); the empty pedestal; a storm_core reward spot every 10 min; a cloud block.
* **3D layout:** a cloud terrace after the sun (the sky now rose and violet behind, the sun gone down under the cloud): the Sun Shrine at the east — a small round temple of gold and white (six gilt pillars, a dome, the empty pedestal in the middle with a faint sun-shaped hollow), Solenne before it; the Sunbeams drifting round the shrine; the reward spot a gilt bowl; the way down at the shrine's far side: a stair of golden cloud steps descending out of the place (the crossing into Sunstone Plaza's east edge, far below — the stair's top is the exit).
* **Models:** the shrine (lathe dome, pillars, the pedestal), the cloud stair, the bowl, the block.
* **Light & life:** the afterglow (rose-gold from the west, violet east), the shrine's gold glowing (emissive), motes thick; the Sunbeams' light (they are the monsters, painted; their glow is theirs); fireflies as star-motes appear as the sky deepens.
* **Story beats:** *Talk* Solenne (the push-in and the shrine's light up). **The Stolen Sun** → *Turn to show* round the shrine. Done: a sun amulet; the pedestal's hollow glows faintly (a state: a light comes on when the quest is done). Leaving down the stair: *Arrival from above* in Sunstone Plaza, the camera starting high over the plaza and lowering.

### 2.2 Chapter 2 — the Sealed Road: Training Grounds to Warden's Hold (levels 4–10)

#### M08 · Training Grounds (`training`) — Kit A
* **Now:** Rusted Swordsmen (lv4, 6 spawns); a platform prop and 5 blocks, 3 urns; archery targets and a fence at the back; the Sun Gate at the west edge (`paint` strip at the back is the gate's painting today).
* **3D layout:** the terrace east of the Sun Gate: the gate's east face at the west end (open after the sun; its doors swung inward toward this map), a drill yard — a fence of posts and rails along the back edge with straw targets on tripods, two drill dummies, a weapon rack, the `platform` prop a wooden drill platform (planks, 0.9 high, a step), the five blocks. Front: balustrade.
* **Models:** Kit A + the fence, targets (lathe discs with painted rings), dummies (wood posts with a crossbar and a helmet), the rack, the plank platform.
* **Light & life:** Kit A; straw dust; crows on the fence (birds, dark look); the Rusted Swordsmen's rust chips (dust colour ochre).
* **Story beats:** *Chapter opening* "Chapter 2 — The Sealed Road" when the hero first comes in through the opened gate (the dolly from the gate along the fence). **The Training Grounds** (15 Rusted) — the *Turn to show* here points along the yard and then east (Mira).

#### M09 · Sparring Yard (`training_2`) — Kit A
* **Now:** Rusted Swordsmen (lv4, 7 spawns); 4 blocks, 3 urns; fences and dummies; Nimbus is placed here in the data but stands in Cloud Haven (moved to M05's place in 3D).
* **3D layout:** a ring of fence in the floor's middle-back (a sparring ring: a low rope ring on posts — scenery behind the walk line), dummies, barrels; the four blocks; the wall behind with a covered rack. Front: balustrade.
* **Models / light & life:** Kit A + the ring, barrels; sparring sounds are PvP's.
* **Story beats:** none beyond *Arrival*.

#### M10 · Archery Range (`training_3`) — Kit A
* **Now:** Rusted (lv4, 7 spawns); the perch towers (perch-1 0.86, perch-2 1.72); targets along the back.
* **3D layout:** a long range: a row of targets along the back wall at three distances (painted rings, arrows stuck in them), a shooting line of flagstones, the two perches (stacked stone blocks) at x 9–12.7 to jump up (a view over the balustrade from the top); a hut with bows at the west end.
* **Models / light & life:** Kit A + targets, the hut, bow racks; birds on the targets.
* **Story beats:** *Arrival*.

#### M11 · Sunstone Plaza (`plaza`, the hub) — Kit A
* **Now:** Mira (shop, quests Rust for Coin / Thorns in the Orchard), Bren (quests Cloth of the Cursed / The Gate Warden); 4 blocks, 3 urns; the sun emblem; a red cloth arch at the back; the sky route lands here (from M07).
* **3D layout:** a round plaza: the sun-rune emblem large in the paving (gilt inlay, the hero's spawn point from the sky at its centre), Mira's stall (a timber stall with an awning, shelves of goods, baskets — in the back-left), Bren's banner workshop (a loom under a canopy, hanging banners drying — back-right), a fountain in the middle-back (a pond module: a round basin with a sun statue, water, reflections), the red cloth arch over the back wall's gate (cloth module, two long swags), the four blocks as market crates and a cart; the cloud stair from Afterglow ends in the air above the plaza's east part (a golden cloud step hanging 3 units up — scenery that says where the hero came from). Front: balustrade with flower boxes.
* **Models:** Kit A + the stall, the loom and canopy, the fountain, the cart, crates, flower boxes.
* **Light & life:** Kit A; the fountain's water and sparkle; doves (birds, pale) on the fountain; banners drying waving; butterflies at the flower boxes; Mira's lantern.
* **Story beats:** *Arrival from above* when landing from the sky. *Talk* Mira / Bren (push-in). **Rust for Coin** → *Turn to show* west (the Training Grounds). **Thorns in the Orchard** → east. **Cloth of the Cursed** → east and far (the Crimson Ruins: a red light on the horizon). **The Gate Warden** → east, the ruined gate's silhouette lit.

#### M12 · Orchard Path (`orchard_1`) + Orchard Heights — Kit A
* **Now:** Thornlings (lv6, 7 spawns); 4 blocks, 3 urns; the climb (climb-1..3) to Orchard Heights (H 3.5, Thornlings, two blocks); orange trees; Solenne's data entry is here (she stands in Afterglow: M07).
* **3D layout:** the terrace with an orchard behind: rows of orange trees (the tree grower with round dark crowns and orange fruit spheres) on the upper terrace (Orchard Heights' floor) and along the back wall below; the climbing blocks up to the Heights at x 5.6–11.1; a picking ladder leaning on a tree, baskets of oranges; the sea seen beyond (the picture's bay): a far water plane with the sun's glitter.
* **Models:** Kit A + orange trees, ladders, baskets, the far sea.
* **Light & life:** Kit A; bees/butterflies in the trees; oranges fall now and then (a dropped sphere that rolls — a small life module); the sea's glitter.
* **Story beats:** *Arrival*; the Thornlings for Mira.

#### M13 · Harvest Square (`orchard_2`) — Kit A
* **Now:** Thornlings (lv6); step blocks (step-1..3: 0.86 / 1.72 / 0.86 — a hump); barrels and a harvest cart; vineyards and a hill town behind.
* **3D layout:** a square of harvest: the step blocks as a stack of crates and barrels you walk over, a wine press, hanging garlands of leaves and lanterns between poles over the square (cloth/lantern modules), the back wall lower here so the vineyard hills with a hill town show behind (relief meshes with rows of vines), the sun lower.
* **Models / light & life:** Kit A + crates, barrels, the press, garlands, vine-hill relief; wasps at the press (small fireflies' look in day colours), leaves.
* **Story beats:** *Arrival*.

#### M14 · Crimson Ruins (`ruins`) + Crimson Heights — Kit A (crimson variant)
* **Now:** Cursed Swordsmen (lv8, 6 spawns); 4 blocks, 3 urns; the climb to Crimson Heights (H 3.5, Cursed, two blocks); broken arches, a red cast over everything.
* **3D layout:** the terraces broken: the balustrade shattered in places (gaps with rubble, the hero cannot fall — an invisible edge is kept), fallen blocks, a row of broken arches along the back wall (ruin arches: half-standing), red creeper ivy, the climbing blocks half-ruined up to Crimson Heights (its floor cracked, a collapsed tower at its end), the sky toward the east turning crimson (the Curse's glow on the horizon — an emissive haze).
* **Models:** Kit A pieces with a broken set (arch fragments, rubble piles, cracked slabs), creeper cards in crimson, a toppled statue.
* **Light & life:** the sun the same but the fog red 0xc06050 30–90, the hemi cooler; crows and bats; embers drifting (red motes); the Cursed Swordsmen's cloth dust (dark red).
* **Story beats:** *Arrival*: the glide passes a broken arch. The Curse's glow pulses when a Cursed Swordsman dies (a brief red flare on the horizon haze).

#### M15 · Broken Colonnade (`ruins_2`) — Kit A (crimson)
* **Now:** Cursed (lv8, 7 spawns); 4 blocks, 3 urns; fallen columns, arches.
* **3D layout:** a colonnade along the back, half its columns down — drums lying across the floor's back half (scenery), two columns leaning on each other over the path (an arch the hero walks under — modelled, above head height), the blocks as column drums, a dry fountain. The floor's paving cracked with grass.
* **Models / light & life:** column drums, capitals, the leaning pair, cracked paving decals; dust devils; bats.
* **Story beats:** *Arrival*.

#### M16 · Sunken Shrine (`ruins_3`) — Kit A (crimson)
* **Now:** Cursed (lv8); the spire towers (spire-1..3: 2.58 / 1.72 / 0.86 — a descent); the picture: great crimson drapes over a sunken shrine with a dais.
* **3D layout:** the shrine sunk below the terrace: the floor itself is the shrine's court (the same walk y), its back a dais with a cracked altar under a ruined dome (half a dome on four columns), and over everything the **crimson drapes**: huge torn red cloths hung from the broken dome and the columns, moving in the wind (the cloth module at scale, mode top-hung, torn hems painted), the sky seen through their rents; the spire blocks a stair of the dais's steps down toward the east exit; braziers burning red.
* **Models:** the dais, altar, dome ruin, columns, drapes (6 large cloths), braziers.
* **Light & life:** red-lit (the drapes tint the sun's light: the sun colour 0xff9070 here, the shadows crimson), braziers' flames (warm lights ×2), embers; the drapes' slow waving is the map's life.
* **Story beats:** *Arrival* with the drapes parting in a gust (a scripted `gust` on entry).

#### M17 · Siege Approach (`gate_1`) — Kit A (crimson)
* **Now:** Cursed (lv8); the leap blocks (leap-1..3); siege engines and barricades.
* **3D layout:** the approach to the old gate: siege engines rotting along the back (a catapult, a broken ram, a siege tower's base, barricades of sharpened stakes, cursed banners), the leap blocks as overturned carts and a ballista's base; the ruined gate's towers looming at the east end (the next map's gate seen from here), the sky crimson.
* **Models / light & life:** siege engines (boxes, cylinders, ropes), stakes, carts, torn banners (cloth); crows; smoke from a dead fire.
* **Story beats:** *Arrival*; the gate's towers in the glide.

#### M18 · Warden's Hold (`gate_2`) — Kit A (crimson)
* **Now:** the Gate Warden (lv10 boss, hp 1100) at the ruined gate; 4 blocks, 3 urns; torches, chains.
* **3D layout:** the ruined gate itself across the back: two square towers and a great arch with its portcullis half-raised (the way east passes under it — the crossing into the Temple Road), chains hanging, torches in iron cages, cursed banners; the Warden's post before the arch (his spawn at the floor's middle), the blocks as fallen masonry. The front: the broken balustrade.
* **Models:** the gate (towers, arch, portcullis, chains), torches (flame module + 3 warm lights), banners, masonry.
* **Light & life:** the sun gone low behind the gate (back-lit: the arch a silhouette with the light through it), torches warm, the crimson fog thick 20–70; bats from the towers; embers.
* **Story beats:** *Boss entrance* (the Warden): the camera pulls back under the arch's shadow, the torches flare, his name banner. *Boss falls*: the portcullis grinds up fully (a Gate-opens beat), the crimson fog lifts over 3 s to the island's gold — the Curse's grip on the gate broken (the sky stays crimson east until the Temple).

### 2.3 The Temple Road (level 10 — the Masters) — Kit A

#### M19 · Temple Road (`temple`) — Kit A
* **Now:** the Masters' stage (a raised platform 6 × 2.8 with the portal to the courtyard on it, `portal` at (837, 328, z 66)); Master Gareth, Master Seraphine, Master Lyra (`rowan`), Master Hayato (talk: the job advancement at level 10); Guards Cassian and Darius at the west; the Waystone at the east end; the `paint` strip: the temple's picture behind.
* **3D layout:** the road ends at the Temple: the great temple front across the back (the PVP courtyard's temple model re-used at a smaller scale: its stair, colonnade, lit doors, curved roof — this is the same temple the arena stands in, seen from its road), the stage prop a stone platform before the stair (0.66 high, steps up from the road, the Masters standing on it in a row with their banners behind: red, blue, green, white), the portal on the platform a ring of light on the paving (the way back to the courtyard), the two guards at the road's west mouth by a pair of stone lions, the Waystone at the east end (a standing stone 2 high with the sun rune glowing, a small shrine roof over it), the road's paving, lanterns lit, the balustrade and the valley at the front, the Temple's cherry trees (the arena's).
* **Models:** the arena's temple pieces (Room.ts: stair, colonnade, doors, roof, lanterns, trees) arranged as a facade, the platform, the lions, the Waystone (a lathe/box standing stone with an emissive rune decal and a glow), the Masters' banners (cloth).
* **Light & life:** golden hour at its end (the sky deeper rose), the temple's doors and lanterns warm, petals from the cherry trees, incense before the doors, birds on the roof; the courtyard's life modules placed here too.
* **Story beats:** *Chapter opening* "The Temple Road" (the dolly along the road from the guards to the stage and the temple's roof). *Talk* with a Master: the push-in and the Master's door light coming up behind him; at level 10 the job advancement's own screen (unchanged). After the advancement: *Turn to show* east to the Waystone, the Master's hint ("your town: through the stone"). *Waystone travel*: the rune flares, white-out, the arrival from above in the town. The portal: a ring of light the hero steps into (a flash, the courtyard's arrival from above).

#### M19b · Sun Seal Plaza (`sealplaza`, below the Temple Road) — the arena's own courtyard
* **Now:** the plaza under the Temple Road's front edge (`world-arena.json`): a stair down from the road (x 22730–23176, from the floor's front edge at y 652) into a wide paved plaza with the sun seal — the old PvP arena's painting, walkable in the open world.
* **3D layout:** this place is the PVP 3D courtyard itself (`src/arena3d/Room.ts`): the Temple Road's terrace stands above and behind it, and the stair in the road's balustrade comes down onto the plaza's paving beside the plank deck. In 3D the road's place (M19) carries the stair's top and the balustrade gap; the plaza is a place of its own built by the courtyard's builder with the stair added at its back-left and the road's underside (its slab and arcade) as its back wall. Nothing to fight; a place to stand where the duels are fought.
* **Models / light & life:** the courtyard's (Room.ts) plus the stair and the arcade; its life modules when the courtyard takes them.
* **Story beats:** *Arrival from above* down the stair (the camera starts on the road's lip and lowers).

### 2.4 Chapter 3 — The Thief's Trail: the Twilight Gardens and Elderwood Village (levels 10–15) — Kit B

#### M20 · Wisteria Walk (`dusk_1`) — Kit B
* **Now:** Lumen the lamplighter (quests Lights Out, Moth Dust, The Shade Fox) at the west end; Glowcaps (lv11, 7 spawns); 4 blocks, 3 urns; wisteria pergolas and lanterns.
* **3D layout:** the terrace at dusk: a pergola runs the length of the back edge — posts and beams hung with wisteria curtains (the walk passes under its front edge: the beams above head height), paper lanterns on cords between the posts, the lantern-lighter's ladder at Lumen's spot, the four blocks as mossy stones, the urns planted with lavender; the far waterfalls (the Moonfall falls' first glimpse, far east, moonlit). Front: the balustrade with wisteria pouring over it.
* **Models:** Kit B's pergola, lantern cords (lantern module), ladder, mossy stones, Lumen's lamp-pole with a hook.
* **Light & life:** Kit B; the lanterns swing; wisteria sways and drops petals; fireflies; moths at the lamps; the glowcaps' spore dust (pale blue).
* **Story beats:** *Chapter opening* "Chapter 3 — The Thief's Trail" (the dolly under the pergola, the lanterns lighting one by one ahead of the camera — Lumen's work — to the hero). *Talk* Lumen. **Lights Out** → *Turn to show* along the walk. **Moth Dust** → *Turn to show* east (the Lantern Steps). **The Shade Fox** → far east, a cold light at the Hollow Gate. Done (the Sun Ember): the lanterns along the whole walk brighten (a state).

#### M21 · Elderwood Village (`dusk_village`, the archers' town) — Kit B
* **Now:** Wren (mentor; quests Steady Hands, Into the Den), Hazel (shop), the Waystone; crates, a well, a boulder; the floor 16.7 × 2.4; houses in the roots; the archery range.
* **3D layout:** the village grown into the Elder Tree's roots: three round-doored houses built into great roots along the back (lit windows, moss roofs, chimneys), the well in the middle (a stone well with a roof and bucket: the `well` prop, 0.7 high, walkable rim), Hazel's stall under a lantern-lit awning (back-right), Wren's range (three straw targets on the back wall's left with a rack of bows; the "young archers" as two painted onlookers if sheets exist — none yet: left out), the Waystone at the west (its own little shrine), the crates and the boulder as they stand; the Elder Tree's trunk rising behind the houses out of frame; the stream passing under a plank bridge at the east exit.
* **Models:** Kit B's houses, well, stall, targets, Waystone, plank bridge, root walls.
* **Light & life:** Kit B; chimney smoke (incense module); windows' warm light (3 points); fireflies; the well's water; a cat on the stall (no sheet: left out); petals of wisteria.
* **Story beats:** *Waystone arrival from above*. *Talk* Wren / Hazel. **Steady Hands** → *Turn to show* west (the walk). **Into the Den** → *Turn to show* east and far: the Elder Tree's door (its sun rune glows on the horizon).

#### M22 · Lantern Steps (`dusk_2`) — Kit B
* **Now:** Lantern Moths (lv13, 7 spawns); 4 blocks, 3 urns; lantern cords and steps.
* **3D layout:** the terrace rises in three broad steps toward the east (the floor stays flat for play; the steps are the back line: a stepped wall with lantern posts climbing it), lantern cords zig-zagging overhead between tall posts (the moths' home), the blocks as stone lantern bases, a stone stair at the back-left leading up to a closed garden gate (scenery).
* **Models / light & life:** the posts and cords (lantern module ×12), the stepped wall; moths (the butterfly look pale) crowd the lanterns; the Lantern Moths' dust (gold).
* **Story beats:** *Arrival*: the lanterns light up the steps ahead in the glide.

#### M23 · Moonfall Bridge (`dusk_bridge`) — Kit B
* **Now:** Lantern Moths (lv13); 4 blocks, 3 urns; the `falls` data: five waterfalls painted (three great ones behind, two below the bridge in front).
* **3D layout:** the floor is a stone bridge across a gorge: parapets both sides (the front one low, the water seen beyond), three great waterfalls pouring from the cliff behind (tall, moonlit, with mist at their foot — the river flows under the bridge's arches toward the camera and falls again in front, below the parapet), the blocks as parapet piers, rainbows faint in the mist, the moon over the falls.
* **Models:** the bridge (arches, parapets, piers), the cliff, the waterfall surfaces (water shader), the river, mist volumes.
* **Light & life:** the moon's cool light stronger here, the falls' roar (sound: PvP), the mist drifting across the bridge at foot level, droplets glinting, fireflies above the river; the water's reflection of the moon and lanterns (the pond's mirror on the river under the bridge if the budget allows; else the sky-colour water).
* **Story beats:** *Arrival*: the glide along the bridge with the falls behind.

#### M24 · Elderwood Path (`dusk_wood`) — Kit B
* **Now:** Glowcaps (lv11); a log, a stump, a boulder; a forest path toward the Elder Tree (the picture: the great tree's roots, a stream with lily pads, moss).
* **3D layout:** the terrace becomes forest: the back wall gone, instead a bank of mossy roots and tree trunks (the Elder Tree's outer roots — huge tapered tubes crossing the back ground), a brook with lily pads running along the front edge in place of the balustrade (the pond's water on a long strip), the log (walkable, 0.6 high) across the path, the stump and the boulder, glowcaps' blue light under the roots, ferns.
* **Models:** roots, trunks, the brook, the log, stump, boulder, ferns (instanced cards), mushrooms.
* **Light & life:** darker under the trees (fog 20–60), the brook's flow and sparkle, fireflies thick, glowcap light pulsing, an owl on a root (a bird perched, no flight), leaves drifting down.
* **Story beats:** *Arrival*.

#### M25 · The Elder Hollow (`dusk_3`) — Kit B
* **Now:** Bram the Root Warden at the Elder Tree's sealed door (`den_door`: the den's entry, Lv 15+ with the Sun Ember); the Shade Fox (lv15 boss, hp 3200) at the Hollow Gate (spawn at x 8.4); 2 boulders, a root, a log; a stream and pond in front.
* **3D layout:** the hollow before the Elder Tree: the trunk fills the back (6 units wide at the base, its bark furrowed, a sun-rune door 2.6 high set in it with a glow in its grooves when it can open), Bram beside the door on a root step, buttress roots fanning left and right (the `root` prop one of them, walkable), the two boulders and the log, a pond at the front-left with a stone rim (the pond module: the tree's lanterns mirrored), the stream running out of it to the front edge, moss everywhere; the Hollow Gate — a rough stone arch at the east end — where the fox lurks.
* **Models:** the Elder Tree's base, the door (two leaves with the rune relief, animated opening), roots, the pond, the stone arch, lanterns on the roots.
* **Light & life:** deep dusk, the door's rune glow warm, the pond reflecting, fireflies dense, the fox's shade (its own painted smoke), bats.
* **Story beats:** *Boss entrance* for the Shade Fox (the camera pulls back; its eyes glint in the dark — a pair of glow sprites that appear). *Boss falls*: the Sun Ember's light (a warm point light rising from the fallen fox to the hero). *Talk* Bram (push-in). *Gate opens*: with the Ember and level 15, the door's grooves fill with light and the leaves swing in — the camera turns to the door and the den's blue light spills out (the crossing into the Root Cellar).

### 2.5 The Thief's Den (party quest, Lv 15+, 25 min) — Kit C (interiors)

#### M26 · Root Cellar (`den_1`, stage 1)
* **Now:** Pip; Shade Imps (lv14) drop Sparks: ten to Pip; the entry wall; a mushroom, a root, crates; the gate at the east.
* **3D layout:** a cellar dug among roots: the door behind (the way back, closed: a root wall with the door's light fading through), shelves and crates (the thieves' stores), a great root crossing the room's middle-back (the `root` prop: walkable), a cluster of glowing mushrooms (the `mushroom` prop), Pip hovering by a lantern, the stage gate: a wall of woven roots at the east end that parts when the stage clears.
* **Models / light & life:** Kit C; lanterns on hooks (2 warm), the mushrooms' blue; Pip's sparkle is Pip's; the imps' smoke.
* **Story beats:** *Arrival*: the camera pitches down from the ceiling's roots to the floor (the den's own arrival: pitch 22°, dist 8 — nearer: a cave). *Talk* Pip. *Den stage clear*: the roots part (the Gate-opens beat), Pip flies through; the camera leads.

#### M27 · Hanging Roots (`den_2`, stage 2)
* **Now:** four root lanterns on pedestals; light exactly three, the right three (Pip hints how many are right); roots hang from the ceiling.
* **3D layout:** a taller cave, roots hanging from the ceiling in curtains (swaying), the four pedestals in a row along the back (the `pedestal` props: stone stumps with a root lantern each — unlit: a dark paper lantern; lit: glowing warm, a light), the hero stands before one and presses the key; the gate east.
* **Models / light & life:** pedestals, root lanterns (lantern module's bodies with on/off state and a point light each when lit — the 4 warm lights of this room), hanging roots (instanced tapered tubes with a sway shader).
* **Story beats:** lighting a lantern: a small push-in on it as it lights (300 ms). The right pattern: all four flare, the roots overhead pull back (the Gate-opens beat).

#### M28 · Lantern Ledges (`den_3`, stage 3)
* **Now:** five ledges at different heights holding 1..5 lanterns; light three, the right three.
* **3D layout:** a cave with five stone ledges stepping up and down along the back (the `ledge` props, walkable, 0.6–1.8 high), each with its lanterns on a shelf, root stairs between them; the floor a stream bed with still water pools (the pond's water as a decal strip) reflecting the lanterns.
* **Models / light & life:** ledges, lanterns (15 bodies, light only from the lit ones: at most 3 points + emissive), pools.
* **Story beats:** as M27; the pools reflect each lit lantern.

#### M29 · Magpie's Nest (`den_4`, stage 4)
* **Now:** Pouncer the Magpie (lv18 boss, hp 4800) and his imps; chests, a cauldron.
* **3D layout:** the great nest: a wide domed cave, a huge nest of twigs and stolen silks on a root platform at the back (the `chests` prop a heap of open chests — walkable; the `cauldron` a bubbling pot over coals: warm light), feathers everywhere, shiny things (gems, spoons, a crown) hung on strings from the roots glinting, Pouncer's perch above the nest (he drops down: his spawn).
* **Models / light & life:** the nest, chests, cauldron (smoke module, steam), strings of trinkets (glint sprites), feathers drifting (petal system, black-white).
* **Story beats:** *Boss entrance*: Pouncer drops from the perch with a screech (the camera pulls back), his name banner. *Boss falls*: the trinkets stop swinging, the gate parts.

#### M30 · Treasure Hoard (`den_5`, stage 5)
* **Now:** a minute of coins and Coin Imps; then Pip sends you out (the Thief's Box, the second Sun Ember the first time).
* **3D layout:** the hoard: mounds of gold coins (bumpy mounds with a coin texture and sparkle, sloping up to the back), open chests spilling, barrels, gems, a golden light from the heap itself; the way out at the east: a root door with the Hollow's dusk light behind it.
* **Models / light & life:** coin mounds, chests, barrels, gem clusters (emissive), the exit door; coins glinting (sparkle particles), coins the imps drop bouncing (the game's own drops).
* **Story beats:** *Arrival* with a golden flare (the camera's bloom catches the heap). The minute's end: Pip's farewell (*Talk*), the exit door opens (Gate-opens), the first clear: the second Sun Ember rises from the heap (a warm light to the hero).

### 2.6 The class towns (levels 10–20)

#### M31 · Sakura Temple (`sakura_village`, the samurai's town) — Kit D
* **Now:** Ayame (shrine maiden; quests Petals on the Steps, Fox Fire, Jiro's Order, The Tengu of the Grove), Jiro (tea master, shop), the Waystone; the entry wall at the west (the walled region today); barrels, a rock; the floor 16.7 × 2.3 with a notch at the east (walk y 360..450 past x 13.4).
* **3D layout:** the shrine's court: the shrine hall across the back-left (the arena temple's pieces at a smaller scale: a stair, a colonnade, lit lattice doors, the curved roof) with the bell tower beside it (its bell silent: no clapper until the quest), Jiro's tea stall back-right under a cloth roof (kettles, cups, a bench), the vermilion bridge over a stream at the east end leading out (the crossing to the Blossom Steps: the notch), the Waystone at the west in a ring of stone lanterns, cherry trees everywhere (the arena's), the barrels and the rock, a low lacquered fence along the front over the valley (mountains with blossom below), stone lanterns lit, a torii at the west entry.
* **Models:** Kit D; the bell tower (a frame with a bronze bell — a lathe, the clapper added as a state after the quest), the tea stall, the bridge, the torii.
* **Light & life:** Kit D; petals falling and lying thick; koi in a small pond by the shrine's stair (the pond module); the stream under the bridge; birds; incense at the shrine; the bell swings slightly in the wind.
* **Story beats:** *Waystone arrival from above* over the blossom. *Chapter-like opening* the first time: "Sakura Temple" (the dolly past the torii, under the trees, to the shrine and Ayame). *Talk* Ayame / Jiro. **Petals on the Steps** → *Turn to show* east. **Fox Fire** → east and up (the shrine path). **Jiro's Order** → east, far (the grove). **The Tengu of the Grove** → far east, the great pine. Done: the bell rings — the camera turns to the bell tower, the bell swings and sounds (PvP's sound), petals burst from the trees (a scripted `gust`).

#### M32 · Blossom Steps (`sakura_1`) — Kit D
* **Now:** Petal Sprites (lv11, 7 spawns); a log, a boulder; stone steps between blossom (the picture: a long stair rising to the back-right, lanterns, a waterfall below).
* **3D layout:** the floor a terrace of mossy flagstones along a mountainside; behind: three flights of stone steps climbing between cherry trees to a landing with a lantern (scenery, not walkable: the steps' visual path rises out of frame), stone lanterns along the floor's back line; in front: the hillside falls away with a small waterfall and a stream below (the front edge a low rope fence on posts), the log (walkable) and the boulder; blossom everywhere.
* **Models / light & life:** Kit D; the steps, lanterns, the rope fence, the waterfall; petals thick (the sprites are made of them: their dust is petals), butterflies, birds, the stream.
* **Story beats:** *Arrival* up the steps' line.

#### M33 · Fox Shrine Path (`sakura_2`) — Kit D
* **Now:** Kitsune Kits (lv13, 7 spawns); a fox statue (the `fox` prop, walkable base) and an offering stand; the torii tunnel.
* **3D layout:** the path under a tunnel of torii (twelve vermilion gates along the back half of the floor, close-set, the hero passing under their front legs — above head height; between them stone fox statues with red bibs and dark lanterns), the great fox statue on its plinth (the `fox` prop: a stone fox 1.6 high on a 0.8 plinth — walkable), the offering stand (a shelf with rice bowls and sake), a shrine gate at the east, the lanterns of the foxes dark until **Fox Fire** is done (then lit: a state with warm lights ×3 + emissive).
* **Models:** torii ×12, fox statues ×6, the plinth, the offering stand, paper streamers on the torii (cloth).
* **Light & life:** Kit D; the torii's lacquer catching the low sun, streamers fluttering, fox-fire wisps (blue-white fireflies) round the kits, petals; the lanterns' lighting as the quest ends — one by one along the path (a 3 s sequence).
* **Story beats:** *Arrival* down the torii tunnel (the glide starts under the first gate). The lanterns' lighting: *Turn to show* along the path as they come on.

#### M34 · Bamboo Grove (`sakura_3`) — Kit D
* **Now:** Bamboo Ronin (lv17) and the Tengu Elder (lv19 boss, hp 5200) at the east end (spawn x 14.8); logs, a rock; the floor 16.7 × 1.9 (370..560).
* **3D layout:** the floor a grove clearing on a ridge: bamboo dense behind (instanced culms 6–8 high, swaying, the light green and barred), a bamboo fence and gate at the west, the logs (a stack, walkable) and the rock, a stream crossing the floor's front in a stone channel with a little plank bridge (the walk unchanged: the channel is 0.3 deep, the planks at floor height), the Ronin's training posts (bamboo dummies), the Tengu's roost at the east: a great pine leaning out over the drop from a crag, its perch, feathers, a torii of rope at the roost's foot; the shrine's bell clapper hanging from the pine (a state: gone after the quest).
* **Models:** bamboo (instanced), fence, gate, log stack, posts, the stream channel and bridge, the pine (the tree grower with a pine look: dark needle clumps), the crag.
* **Light & life:** the light barred through the bamboo (shafts), leaves and petals, the bamboo's rattle, a kite flying far off, butterflies; the Tengu's wind (a `gust` with his fan: the bamboo bends — his attacks' own effects are the class/monster's).
* **Story beats:** *Boss entrance*: the Tengu drops from the pine with a gust that bends the whole grove (`gust` 1.2) — the camera pulls back. *Boss falls*: the clapper falls from the pine and rolls (a small prop drop), the grove stills.

#### M35 · Ironhold (`ironhold_village`, the warriors' town) — Kit E
* **Now:** Captain Thorne (quests Pebbles Underfoot, Cinder Tusks, Grit's Order, The Crag King), Grit (smith, shop), the Waystone; the entry wall; crates, an anvil; the floor 16.7 × 1.4 (420..558) — the parade ground before the keep.
* **3D layout:** the parade ground: the keep's gate and walls across the back (red ashlar, crenellations, two square towers, crimson banners with the lion, braziers, a great timber gate shut), Grit's forge at the back-right (a timber roof on posts over a furnace glowing, the anvil (prop, walkable), bellows, a quench trough steaming, racks of blades), the crates, a drill dummy, a weapon rack, the Waystone at the west by the gatehouse arch (the entry), the front: a low parapet over the red gorge, hawks.
* **Models:** Kit E; the keep front, the forge, the anvil, trough, racks, banners, braziers.
* **Light & life:** Kit E (sunset); the forge's glow and sparks (the main warm light), chimney smoke, banners, hawks, dust blowing across the ground; Grit's hammer (sound: PvP).
* **Story beats:** *Waystone arrival*. The first time: "Ironhold" (the dolly along the walls to the forge and Thorne). *Talk* Thorne / Grit. **Pebbles Underfoot** → *Turn to show* east. **Cinder Tusks** → east, the smoke of the Forge Road. **Grit's Order** → far east, the quarry's red glow. **The Crag King** → the cave at the quarry's end. Done: Thorne sounds the war horn — the camera turns to the keep's tower, the horn (sound), the banners snap (`gust`).

#### M36 · Crag Path (`ironhold_1`) — Kit E
* **Now:** Pebblits (lv11, 7 spawns); a boulder and a cart; a ledge road along a cliff with a stone arch bridge (the picture).
* **3D layout:** the floor a ledge road cut into the red crag: the cliff wall rising behind (strata, overhangs, a watchtower perched above at the west), the gorge dropping in front (a far valley with a river, a natural rock arch spanning the gorge in the middle distance), the boulder (walkable) and the ore cart (prop) on the road, rockfall rubble, a wooden guard rail on posts along the front edge, pines on the crag.
* **Models / light & life:** the cliff (layered boxes/lathes with the strata tile), the arch, the cart, rail, pines; hawks, dust, pebbles rolling (the Pebblits' dust grey-red), a distant landslide's rumble now and then (dust puff on the far cliff).
* **Story beats:** *Arrival* along the ledge.

#### M37 · Forge Road (`ironhold_2`) — Kit E
* **Now:** Cinder Boars (lv14, 7 spawns); an ore pile and ingots (props); a mine road with rails, a water-wheel, a bell tower, chimneys.
* **3D layout:** the road through the mine works: rails along the floor's back line with ore carts, timber trestles and a crane, the mill with its water-wheel turning in a flume at the west (the stream falling from the crag), a smelter's chimneys smoking, the bell tower, the ore pile and the ingot stack (walkable props), a storehouse; the gorge in front with the red cliffs.
* **Models / light & life:** rails, carts, trestles, crane, the mill and wheel (rotating, splashes), chimneys (smoke), the bell, the stack; sparks from the smelter, the boars' embers (their dust orange), the wheel's water.
* **Story beats:** *Arrival* with the wheel turning.

#### M38 · Ember Quarry (`ironhold_3`) — Kit E
* **Now:** Forge Golems (lv17) and the Boulder Bear, the Crag King (lv19 boss, hp 5600), at the east end (spawn x 14.5); an ore pile and a tipped cart.
* **3D layout:** the quarry floor: cut-rock terraces rising behind in steps (the quarry's walls with tool marks), cranes and scaffolds, lava seeping through channels in the floor's back half (an emissive flowing lava shader, heat shimmer above it — the walk polygon keeps the hero off it), the ore pile and the tipped cart (walkable props), the Crag King's cave mouth at the east end (a dark opening with the war horn's pedestal glinting inside and bones at the mouth), the sky red with the quarry's glow.
* **Models / light & life:** the terraces, cranes, lava (shader), the cave, the pedestal; embers rising, smoke, heat shimmer, the golems' core glow (their own), rockfall dust when the Bear slams (the stage's `blow` → extra dust).
* **Story beats:** *Boss entrance*: the Bear comes out of the cave (a roar: `punch`, the camera back, dust from the cave's roof). *Boss falls*: the war horn's pedestal lights, the lava's glow dims a shade (the quarry quiets).

#### M39 · Astra Spire (`astra_village`, the book mages' town — built as far as the 2D data goes: the town, two training maps' data, three monsters cut; the boss, the NPC art and the third map's picture are pending GPT) — Kit F
* **Now (uncommitted 2D data, kept in the stash `astra-2d-wip`):** Archivist Elowen (quests Spilled Ink, Lost Pages, Pim's Order, The Grand Grimoire), Pim (scribe, shop), the Waystone; books and a plinth (props); Starlight Bridge (Inklings lv11, pillars and crystals), Floating Gardens (Bookwyrms lv14, planters and a scholar statue), Observatory Ruins (Rune Guardians lv17, the Grand Grimoire lv19).
* **3D layout:** the academy's court on a floating isle: the library's facade across the back (tall arched windows glowing blue-gold, a great door, star crystals on the roofline), reading plinths with open books (props, walkable), Pim's scriptorium stall, the Waystone in a ring of crystal lamps, the court's marble edge in front with waterfalls pouring off into cloud, smaller islets drifting below and beside, the comet overhead. **Starlight Bridge:** a long marble bridge with crystal lamp posts (the `pillar` props) and crystal clusters (the `crystals` prop, walkable), gaps in the bridge the hero jumps (the walk polygon's), pages blowing. **Floating Gardens:** hanging gardens on an islet: planters (walkable) with pale blossom, the scholar statue, a greenhouse dome of glass, fountains. **Observatory Ruins:** a broken dome on columns, a fallen armillary sphere (its rings walkable), rune pedestals (the guardians' posts), the Grimoire's lectern at the end under the open sky, star-charts on the floor glowing.
* **Models:** Kit F.
* **Light & life:** Kit F; pages drifting; crystals pulsing; the waterfalls into cloud; islets rising and falling; shooting stars; star-motes.
* **Story beats:** *Waystone arrival* (from above, through the comet's light). "Astra Spire" (the dolly along the library's windows to Elowen). *Talk* Elowen / Pim. **Spilled Ink** → *Turn to show* east (the bridge). **Lost Pages** → the gardens. **Pim's Order** → the ruins. **The Grand Grimoire** → the far dome. *Boss entrance*: the Grimoire rises off its lectern in a storm of pages (`gust`), the camera back. *Boss falls*: the pages settle; done: Elowen writes the hero's name in starlight (the ledger's glow: a cool light).

---

## Part 3 — order, budget, what is not in this spec

### 3.1 Build order (one at a time, each tested before the next)
**Standing (17 Oct morning, behind `?world3d=1`, procedural stand-in tiles until GPT's are painted): 1–38 — the whole island and its sky (4–7 as one place), chapter 3, the Den's five rooms, Sakura and Ironhold; each shot headless (`tools/world3d/shots_*.mjs`), 0 console errors. Missing: 39–42 Astra (its 2D data first), 19b Sun Seal Plaza, the story beats' camera moves beyond the arrival glide, the per-map walk/jump/talk tests for every map (the courtyard's `test_courtyard.mjs` is the pattern), the GPT tiles (`tools/world3d/TEXTURES.md`).** 1 Legacy Courtyard · 2 Ivy Terraces · 3 Upper Gardens (+Heights, Summit, the Sun Gate) · 4 Sky Path · 5 Cloud Haven · 6 Sunfall Pass · 7 Afterglow Rest · 8 Training Grounds · 9 Sparring Yard · 10 Archery Range · 11 Sunstone Plaza · 12 Orchard Path (+Heights) · 13 Harvest Square · 14 Crimson Ruins (+Heights) · 15 Broken Colonnade · 16 Sunken Shrine · 17 Siege Approach · 18 Warden's Hold · 19 Temple Road · 20 Wisteria Walk · 21 Elderwood Village · 22 Lantern Steps · 23 Moonfall Bridge · 24 Elderwood Path · 25 The Elder Hollow · 26–30 the Den's five rooms · 31–34 Sakura · 35–38 Ironhold · 39–42 Astra (its art when GPT is back).

Shared work comes first inside map 1: the world stage wiring in the open-world scene (`OpenWorld` → a `World3D` that owns the places, the crossings, the camera's lead and clamp, the story beats' camera moves), the builders' common kit (`src/world3d/kit/`: terrain slabs, walls, balustrades, stairs, blocks, trees per kind, water, lanterns, the far scenery), the test harness. Maps 2–19 share Kit A and go quickly after the first; each new kit costs a map's extra day.

### 3.2 Budget per map
≤ 250 draw calls, ≤ 600 k triangles, ≤ 24 MB of textures resident, ≤ 300 ms to build, the stage's frame under 8 ms of GPU on a mid-range laptop (the stage drops to its lighter room by itself beyond ~21 ms; a map must not need it).

### 3.3 Not in this spec (unchanged or elsewhere)
The quests' text and numbers; the monsters' and NPCs' paintings; the Waystones' logic; test mode; the arena and PVP 3D (DFO / PvP); sound (PvP — each map's ambience is a request to PvP as it lands: wind and birds, water, forge, the den's drip); the party sync of the den (PvP, on David's decision); new maps or quests (none until the rebuild is through).

### 3.4 Open questions for David
1. The camera's distance in the world (9.0 proposed: the hero a quarter of the screen; nearer = bigger hero, less map): a number to feel, set on map 1 with you.
2. Map crossings as a short fade (proposed) or MapleStory's black cut.
3. The chapter openings: skippable with any key (proposed) — or always played.
4. Astra: finish its 2D art later for the 3D version only (proposed), or drop Astra from the first pass until the island is done.


