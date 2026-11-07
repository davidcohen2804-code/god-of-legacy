# The chibi characters — the method (the Archer first)

Anime pixel art, light chibi, on a 64 px grid. Each class is drawn facing right only (the game mirrors it for left) in a
near-side three-quarter view: 96 × 96 frames, the feet at (48, 88), one fixed palette (`palette.py`, one letter per
tone), no anti-aliasing, nearest-neighbour scaling. In the game behind the flag `?chibi` (`?chibi=2` / `?chibi=3`: the
pixel scale), `src/chibi/ChibiBody.ts`; without the flag nothing changes.

1. **Guides** (`<class>/guides/`): GPT draws each pose at full size on a plain background, keyed to the approved
   reference; a weapon is left out of the body art.
2. **Native pixels**: `figures.py` finds the figures on a sheet, `native.py` reduces each one to the grid (every pixel
   named by its nearest palette tone, then a majority vote per block). The pitch is the one where the master's hood
   fits best (`PITCH=… python3 native.py sheet.png out_dir prefix 64`).
3. **Master** (`<class>/src/master_R.py`): one guide frame cleaned by hand. It holds the identity: its head and its
   palette are laid on every other frame (`head_lock` in `frames_R.py`).
4. **Frames** (`<class>/src/frames_R.py`): each animation from the master (a pixel of breathing, the cape a beat
   behind, a blink) or from guide frames with the master's head locked on. The weapon is its own layer, drawn through
   the hand's anchor in every frame (`procbow.path_bow`, the Archer's carry read off the reference): it moves and turns
   only with the hand, and another bow is another colour style.
5. **Build** (`<class>/build.py`): the atlas and `<class>.anims.json` (frames, ms, loop) into
   `public/assets/chibi/<class>/`.
6. **Review**: every pose goes to GPT next to the reference and at game scale (×2 / ×3) before David sees it.
