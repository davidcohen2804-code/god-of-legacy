# 3D hero pieces (?hero3d=1)

| File | From |
|---|---|
| `beginner_m.glb` | The Beginner, made here (`tools/hero3d/README.md`): GPT drawings of the painted Beginner (front, back, sides), its shape by Hunyuan3D 2.1 (Tencent, the public Space), the drawings baked onto it, the skeleton and weights of Quaternius' Universal Base Characters (CC0) fitted into it |
| `w_sword.glb`, `w_katana.glb`, `w_bow.glb`, `w_staff.glb`, `w_cane.glb` | Made here from GPT drawings (`tools/hero3d/weapons`) |
| `w_sword_dragon.glb`, `w_katana_moon.glb`, `w_bow_sylvan.glb`, `w_staff_astral.glb`, `w_cane_royal.glb` | The classes' item weapons, made here the same way from GPT drawings (`tools/hero3d/src/weapons`) |
| `beginner_m_reg.png`, `beginner_f_reg.png` | The outfit's regions on each body's whole atlas, made here (`tools/hero3d/items/regions.mjs`; the collar band in the head's band by `tools/hero3d/ai/bust.mjs`) |
| `moves_1.glb` | Quaternius, Universal Animation Library (Standard), CC0, on the 65 standard bones (as imported by Kiikurage/game-test, CC0) |
| `moves_2.glb` | Quaternius, Universal Animation Library 2 (Standard), CC0 |
| `moves_3.glb` | Quaternius, Universal Animation Library (its Godot build, CC0): the moves the standard import lacks — spells, punches, aim, crouch, kneel — renamed onto the 65 standard bones (`tools/hero3d/moves3.mjs`) |
| `moves_4.glb` | Quaternius, Universal Animation Library 1 and 2 (CC0): the heavy combo, the thrusting dash, the farm and shield moves (`tools/hero3d/moves4.mjs`) |
| `beginner_f.glb` | The Beginner as a woman, made the same way as `beginner_m.glb` |
| (both bodies' hands) | The hands of Quaternius' Universal Base Characters (`Superhero_Male_FullBody`, `Superhero_Female_FullBody`, CC0) — fingers on their own bones, laid into the drawn hands' place and coloured from them (`tools/hero3d/ai/hands.mjs`) |
| (both bodies' heads) | The heads of Quaternius' Universal Base Characters (`Superhero_Male_FullBody`, `Superhero_Female_FullBody`, their light skin textures, eyes and brows) and its hair pieces (`Hair_SimpleParted` the man's; `Hair_Buns` without its buns the woman's, her ponytail and its tie made here), CC0 — laid on the drawn neck and coloured to the Beginner's skin and hair (`tools/hero3d/ai/head.mjs`) |
| (both bodies' necks and chests) | The next part of the same Quaternius base bodies under their heads (neck root, collarbones, chest, upper back), their skin texture and weights, CC0 — laid on the drawn body under its clothes (`tools/hero3d/ai/bust.mjs`) |
| (both bodies' normal and roughness maps) | The skin's, hair's and eyes' from the same Quaternius textures (`T_Superhero_*_Normal`, `T_Superhero_*_Roughness`, `T_Hair_1_Normal`, `T_Hair_2_Normal`, `T_Eye_Normal`, CC0); the clothes' made here from their painting (`tools/hero3d/ai/maps.mjs`) |
| `art/*.webp` | The Beginner's pictures (VS, loading, portraits, the fighter select): painted by GPT from the Beginner's sheets, framed here (`tools/hero3d/art/splash.py`) |

The Quaternius files were fetched from the CC0 copies in moritzbrantner/asset-tooling (`assets/canonical/quaternius.*`)
and Kiikurage/game-test (`public/assets/animations.glb`); the moves are packed by `tools/hero3d/build.mjs`.
Moves the libraries have none of (the bow's shots, a rising kick into a back flip, a call to the sky, a seize, a coin
flip, cards thrown backhand, dice rolled, a vault's double kick) are built at load on the body's own skeleton
(`Hero3D.makeBowShoot`).
