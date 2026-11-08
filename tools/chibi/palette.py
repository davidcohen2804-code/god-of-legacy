"""The chibi characters' fixed palette: one letter per colour (the ASCII sources in tools/chibi/<class>/src use these
letters; '.' is transparent). Materials keep 2–4 tones each, lit from the upper left."""
PALETTE = {
    # taken from the approved archer guide's own colours (GPT, 7 Nov), merged to a few tones per material
    'O': '#18130e',  # outline (near-black brown)
    # cloth green (hood, cape)
    'L': '#8e9457', 'G': '#727846', 'g': '#525537', 'D': '#393c29',
    # gold trim / buckle
    'Y': '#c9ac5e', 'y': '#a8834f',
    # hair
    'J': '#a8754b', 'H': '#8b5b3d', 'h': '#5e3e2b',
    # skin
    'S': '#f7d1b2', 's': '#dbac86',
    # eyes
    'E': '#211a14', 'e': '#6b4630', 'W': '#fbf7f1',
    # tunic (cream, tan)
    'T': '#ece2c8', 't': '#c09b5e',
    # the base's foot wraps (the tunic's colours, their own letters: sandals recolour them alone)
    'U': '#ece2c8', 'u': '#c09b5e',
    # the Moonstep Sandals (GPT): the straps light / mid, the sole
    'V': '#D8BE94', 'v': '#B08E63', 'Q': '#6B4E2C',
    # leather (belt, bracers, boots, quiver, bow)
    'R': '#9c6c46', 'B': '#704932', 'b': '#4a3122', 'K': '#30261c',
    # trousers
    'P': '#4f4036', 'p': '#352b24',
    # feathers, bowstring
    'F': '#f5f1ea', 'f': '#a39d98',
    # the minimal-motion test's outfit B (David 7 Nov): a red tunic, dark boots (archer/src/minimal_R.py)
    'M': '#b4423a', 'm': '#7c2b27', 'N': '#4b4a52', 'n': '#2c2b31', 'X': '#74737c',
}
RGB = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in PALETTE.items()}
