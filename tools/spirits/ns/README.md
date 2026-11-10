# The new Spectral Samurai (Legacy of Spirits, behind ?spirits) — how his body is made

GPT's art direction, 10 Nov; David: "it must look and feel exactly like this character" (the approved illustration).

1. **Views**: GPT's four full-body views (front, right, back, left) redrawn to match the illustration, approved by GPT and
   David; four bust views for the head (the face, the mask, the bangs, the tie).
2. **Shapes**: Hunyuan3D-2mv (the four views) for the body, the bust views for the head and the hair; each baked from its
   drawings (tools/hero3d/ai: prep, views, bake).
3. **`graft2.py`**: the bust's head (mask, eyes, bangs, crown, crimson tie, scarf) laid on the body by its torso (ICP),
   moved to the drawings' head height, the scarf eased to the collar and flared onto it, its back repainted crimson;
   the bust's own ponytail and crumbs dropped; the jaw / nape strips eased (Taubin) and their greys re-tinted;
   a new ponytail (**`pony.py`**): ten closed tapered locks from the tie along the right drawing's arc (envelope from the
   side and back drawings), its own lavender-white strip texture. **`texfix.py`** first: the body texture's right
   pauldron from the left's mirror, the sash tails' streaks refilled, the chest sharpened.
4. **One atlas**: `repack.mjs` (xatlas) + `rebake2.py` (the three textures carried into one 2048 atlas).
5. **Rig**: `tools/hero3d/ai/rigfit.mjs` with `lm_ns.json` (the 65-bone skeleton fitted, weights carried over);
   `handsns.mjs` (the drawn one-piece hands replaced by the base body's hands with finger bones, all glove);
   `tools/hero3d/ai/normals.mjs`; **`addbones.mjs`**: 19 supplementary bones — hair_01…05 (the ponytail, its vertices
   found by `ponyidx.py`), the skirt shell cut into left / rear / right panels (vertices doubled along the cuts), the
   front panels and the sash tails, each a 2-bone chain on the pelvis, and the hip plates (tassets) on their own bones;
   the arms' and hands' faces stay on their own bones (a fingertip on a panel's bone stretched into a claw).
6. **Pack**: `tools/hero3d/ai/pack1.mjs` → `public/assets/hero3d/spirit_samurai_ns.glb`.
7. **Gameplay body**: `node tools/spirits/lite.mjs public/assets/hero3d/spirit_samurai_ns.glb
   public/assets/hero3d/spirit_samurai_ns_lite.glb 18000 0.02 5000` (49k → 18k triangles, the UV seams locked; its floor
   shadow 4.7k) — the world's; the select and the windows keep the full one.
8. **Region mask**: `python3 nsmask.py ns_bones.glb ATLAS.png public/assets/hero3d/spirit_samurai_ns_mask.png 1024` —
   in the atlas's own layout: R the hair (the ponytail by its bones, the head's by its zone), G the eyes, B the face
   under the hair (the dark mask, the skin round the eyes); the spirit material reads it (`src/spirits/Spectral.ts`).
9. **In the game**: `src/spirits/Secondary.ts` moves the extra bones each frame after the move (the ponytail hangs and
   lags, restrained, kept off the back and the scarf; the panels pushed by their thighs and draping back; the sash tails
   swinging); `src/spirits/Spectral.ts` draws him as a spirit (behind `?spirits&ns`).

10. **Proportion variants** (GPT's experiment P1, behind `?spirits&ns&prop=a|b`): `node reprop.mjs IN.glb OUT_raw.glb
    '{"head":0.8,"legs":0.09,"shoulders":0.04,"waist":0.06,"hakama":0.08}'` (his rest pose re-set: the legs longer from
    the soles up, the head smaller about its joint with the ponytail moved and shrunk less, the arms out, the waist and
    the hakama slimmed; every vertex carried by its own bones, the binds made again) → `node pack.mjs OUT_raw.glb
    OUT.glb` (quantized and compressed as the game reads it, the texture untouched) → `lite.mjs` as in step 7.

`build_ns.sh` runs 3–6 end to end (its paths are the working folders it was made in).
