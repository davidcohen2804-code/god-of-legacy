# The 3D world's tiles — what to paint with GPT (from 19:00, when the image quota is back)

Every tile: **seamless / tileable, 1024 × 1024, top-down flat lighting (no shadows baked in, no vignette), painted in the game's
warm storybook style (ART_STYLE.md), no text, no watermark**. Saved by `python3 tools/world3d/tile.py <image> <kit> <name> --strength <n>` as
`public/assets/world3d/tex/<kit>/<name>.webp` (quality 82; the tool squares, resizes to 1024, cross-fades the seams, writes the
normal map `<name>_n.webp` — a Sobel of the tile, strength per tile below — and a 2 × 2 preview under /tmp/claude-0/tiles to
check the tiling; `--atlas` for the clump / flower atlases on transparency: no seam blend, no normal map). The builders fall back to their procedural stand-ins until a tile exists, and
swap it in when it loads — no code change per tile.

Prompt frame (English, for GPT): *"Seamless tileable texture, 1024x1024, top-down, even flat lighting, no shadows, no
vignette, painted fantasy game style, warm colours, high detail: {description}. The texture must tile perfectly on all
four edges."* Check the tile by placing four copies in a 2 × 2 grid before saving.

## Kit A — the island (`island/`)
| name | description | normal |
|---|---|---|
| `sandstone_paving` | warm sandstone flagstones, large irregular slabs, fine joints with a little moss, worn edges, golden-beige with pink | 1.8 |
| `sandstone_wall` | dressed sandstone ashlar wall, staggered courses, thin dark joints, a few chipped blocks, warm beige-gold | 2.0 |
| `sandstone_moulding` | smooth pale sandstone with a soft grain (for copings, balusters, cornices) | 0.8 |
| `cobble_worn` | small rounded cobbles in sand, uneven, for paths | 2.2 |
| `ivy_autumn` (atlas, 2 × 2 clumps on transparency, 1024²) | four clumps of autumn ivy: heart-shaped leaves in crimson, orange and a little green, hanging in loose masses, painted edges, transparent background | — |
| `maple_crown` (atlas 2 × 2 on transparency) | four round clumps of maple foliage in red, orange and gold, soft painted masses with a few single leaves at the edge, transparent background | — |
| `flowers_red` (atlas 2 × 2 on transparency) | four tufts of red and pink garden flowers with green leaves, seen from the side, transparent background | — |
| `urn_terracotta` | terracotta clay with a fine crackle and a painted sun band | 1.0 |
| `roof_slate_tower` | blue-grey slate shingles, overlapping, a little lichen | 1.6 |
| `mountain_far` (strip 2048 × 512) | a far mountain range at golden hour: violet-blue peaks with snow, haze at their feet, a waterfall or two as pale threads, painted | — |
| `mist_soft` | a soft white mist puff on transparency (512²) | — |
| `banner_red` (512 × 1536) | a red cloth banner with a gold border and a gold sun emblem (a disc with twelve rays), tassels at the hem | — |
| `wood_dark` | dark oak planks, worn, with grain | 1.4 |
| `bark_maple` | maple bark, grey-brown, shallow furrows | 1.6 |
| `gold_leaf` | hammered gold leaf, warm, slightly worn | 0.6 |

## Kit B — the twilight gardens (`twilight/`)
| `stone_violet` | grey-violet dressed stone, dusk-cool, moss in the joints | 2.0 |
| `moss` | thick green moss with tiny flowers | 1.4 |
| `bark_elder` | ancient deep-furrowed bark, dark, with moss in the cracks | 2.4 |
| `wisteria` (atlas 2 × 2 on transparency) | four hanging wisteria racemes, violet to pale lilac, with small green leaves, transparent background | — |
| `lantern_paper_warm` | warm paper lantern surface with faint bamboo ribs, lit from inside | 0.6 |
| `water_fall` (512 × 2048, tiles vertically) | falling white water with streaks and foam, semi-transparent, vertical | — |
| `river` | a slow river surface, dark teal with ripples and reflected sky | 0.8 |
| `thatch_moss` | mossy thatch roof | 1.6 |
| `wood_dark_planks` | dark weathered planks | 1.4 |
| `lilypad` | a lily pad from above on transparency (512²) | — |

## Kit C — the den (`den/`)
| `root_bark` | a wall of woven living roots, brown with violet bioluminescent veins | 2.4 |
| `earth_packed` | packed dark earth with small roots and pebbles | 1.8 |
| `mushroom_glow` (atlas 2 × 2 on transparency) | four clusters of glowing blue-violet mushrooms, transparent background | — |
| `coin_heap` | a heap of gold coins seen from above, overlapping, glinting | 1.6 |
| `wood_crate` | rough crate boards with iron corners | 1.4 |
| `cloth_purple` | thieves' purple silk with gold thread | 0.6 |
| `sigil_spiral` | a glowing violet spiral sigil on dark bark (1024², on transparency) | — |

## Kit D — Sakura (`sakura/`) — the arena's `assets/arena3d/temple/*` tiles serve first (stone, paving, plaster, lacquer, roof, bark, blossom)
| `moss_stone_steps` | mossy stone steps' treads, worn, with petals | 1.8 |
| `bamboo_culm` (strip 256 × 1024) | a bamboo culm's surface, green with pale nodes, vertical | 1.0 |
| `bamboo_leaves` (atlas 2 × 2 on transparency) | four sprays of bamboo leaves, transparent background | — |
| `torii_lacquer_worn` | vermilion lacquer, slightly worn, with faint wood grain | 0.8 |
| `stream_bed` | a shallow mountain stream bed: pebbles under clear water | 2.0 |
| `fox_stone` | grey granite with lichen (statues) | 1.2 |

## Kit E — Ironhold (`ironhold/`)
| `crag_red_strata` | red sandstone crag face with horizontal strata, cracks and ochre bands | 2.6 |
| `red_ashlar` | dressed red sandstone blocks, a fortress wall, soot in places | 2.0 |
| `iron_rust` | riveted iron plate with rust bloom | 1.6 |
| `timber_rough` | rough-sawn mine timber, dark | 1.6 |
| `lava_glow` | lava: black crust with glowing orange-yellow cracks | 2.4 |
| `ore_pile` | a heap of ore chunks with glints of copper and iron | 2.2 |
| `rails_sleepers` (512 × 1024) | mine rails on sleepers in gravel, vertical | 1.8 |
| `banner_crimson` (512 × 1536) | a crimson banner with a gold lion | — |

## Kit F — Astra (`astra/`)
| `marble_white` | white marble with faint grey-gold veins, polished | 0.6 |
| `gold_inlay` (atlas, on transparency) | gold star-chart inlay lines and stars for a marble floor | — |
| `crystal_blue` | translucent blue crystal faces with inner light | 1.2 |
| `cloud_below` | a sea of soft clouds from above, pink-violet | — |
| `book_spines` | a shelf of old book spines, blue, red and gold | 1.4 |
| `hedge_pale` (atlas 2 × 2 on transparency) | four clumps of pale silver-green foliage, transparent background | — |

## Painted NPC onlookers (no new paintings needed)
The Masters, guards, Aldric, Mira and Bren already exist as sheets under `assets/world/npc/` and stand in 3D through
`src/world3d/life/spectators.ts`.
