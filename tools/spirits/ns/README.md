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
   front panels and the sash tails, each a 2-bone chain on the pelvis.
6. **Pack**: `tools/hero3d/ai/pack1.mjs` → `public/assets/hero3d/spirit_samurai_ns.glb`.
7. **In the game**: `src/spirits/Secondary.ts` moves the extra bones each frame after the move (the ponytail hangs and
   lags, kept off the back and the scarf; the panels pushed by their thighs and draping back; the sash tails swinging).

`build_ns.sh` runs 3–6 end to end (its paths are the working folders it was made in).
