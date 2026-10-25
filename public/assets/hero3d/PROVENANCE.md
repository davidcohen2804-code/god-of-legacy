# 3D hero pieces (?hero3d=1)

| File | From |
|---|---|
| `beginner_m.glb` | The Beginner, made here (`tools/hero3d/README.md`): GPT drawings of the painted Beginner (front, back, sides), its shape by Hunyuan3D 2.1 (Tencent, the public Space), the drawings baked onto it, the skeleton and weights of Quaternius' Universal Base Characters (CC0) fitted into it |
| `w_sword.glb`, `w_katana.glb`, `w_bow.glb`, `w_staff.glb`, `w_cane.glb` | Made here from GPT drawings (`tools/hero3d/weapons`) |
| `moves_1.glb` | Quaternius, Universal Animation Library (Standard), CC0, on the 65 standard bones (as imported by Kiikurage/game-test, CC0) |
| `moves_2.glb` | Quaternius, Universal Animation Library 2 (Standard), CC0 |
| `moves_3.glb` | Quaternius, Universal Animation Library (its Godot build, CC0): the moves the standard import lacks — spells, punches, aim, crouch, kneel — renamed onto the 65 standard bones (`tools/hero3d/moves3.mjs`) |
| `moves_4.glb` | Quaternius, Universal Animation Library 1 and 2 (CC0): the heavy combo, the thrusting dash, the farm and shield moves (`tools/hero3d/moves4.mjs`) |
| `beginner_f.glb` | The Beginner as a woman, made the same way as `beginner_m.glb` |
| (both bodies' hands) | The hands of Quaternius' Universal Base Characters (`Superhero_Male_FullBody`, `Superhero_Female_FullBody`, CC0) — fingers on their own bones, laid into the drawn hands' place and coloured from them (`tools/hero3d/ai/hands.mjs`) |
| (both bodies' heads) | The heads of Quaternius' Universal Base Characters (`Superhero_Male_FullBody`, `Superhero_Female_FullBody`, their light skin textures, eyes and brows) and its hair pieces (`Hair_SimpleParted` the man's; `Hair_Buns` without its buns the woman's, her ponytail and its tie made here), CC0 — laid on the drawn neck and coloured to the Beginner's skin and hair (`tools/hero3d/ai/head.mjs`) |
| `art/*.webp` | The Beginner's pictures (VS, loading, portraits, the fighter select): painted by GPT from the Beginner's sheets, framed here (`tools/hero3d/art/splash.py`) |

The Quaternius files were fetched from the CC0 copies in moritzbrantner/asset-tooling (`assets/canonical/quaternius.*`)
and Kiikurage/game-test (`public/assets/animations.glb`); the moves are packed by `tools/hero3d/build.mjs`.
Moves the libraries have none of (the bow's shots, a rising kick into a back flip, a call to the sky, a seize, a coin
flip, cards thrown backhand, dice rolled, a vault's double kick) are built at load on the body's own skeleton
(`Hero3D.makeBowShoot`).
