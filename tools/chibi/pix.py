"""A tiny pixel-art kit for the chibi characters: layers as letter grids (tools/chibi/palette.py letters, '.' empty),
shapes given row by row (y → (x0, x1) spans), automatic outlines, mirroring, compositing, and rendering.
Every chibi part (head, hood, cape, torso, limbs, bow…) is built with these, so each class uses one method."""
from __future__ import annotations
from typing import Callable, Dict, Iterable, List, Tuple
from PIL import Image
try:
    from .palette import RGB
except ImportError:  # run as a script
    from palette import RGB


class Grid:
    def __init__(self, w: int, h: int):
        self.w, self.h = w, h
        self.px = [['.'] * w for _ in range(h)]

    @classmethod
    def from_rows(cls, rows: List[str], w: int | None = None) -> 'Grid':
        g = cls(w or max(len(r) for r in rows), len(rows))
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if x < g.w: g.px[y][x] = ch
        return g

    @classmethod
    def load(cls, path: str) -> 'Grid':
        return cls.from_rows([l.rstrip('\n') for l in open(path) if not l.startswith('#')])

    def copy(self) -> 'Grid':
        g = Grid(self.w, self.h); g.px = [r[:] for r in self.px]; return g

    def get(self, x: int, y: int) -> str:
        return self.px[y][x] if 0 <= x < self.w and 0 <= y < self.h else '.'

    def set(self, x: int, y: int, ch: str) -> None:
        if 0 <= x < self.w and 0 <= y < self.h: self.px[y][x] = ch

    def rows(self) -> List[str]:
        return [''.join(r) for r in self.px]

    def save(self, path: str) -> None:
        open(path, 'w').write('\n'.join(self.rows()) + '\n')

    def put(self, x: int, y: int, text: str, skip: str = ' ') -> None:
        """Write a run of letters from (x, y); `skip` letters leave what is under them."""
        for i, ch in enumerate(text):
            if ch != skip: self.set(x + i, y, ch)

    def stamp(self, other: 'Grid', ox: int, oy: int) -> None:
        """Lay `other` over this grid at (ox, oy) (its empty pixels show this grid)."""
        for y in range(other.h):
            for x in range(other.w):
                ch = other.px[y][x]
                if ch != '.': self.set(ox + x, oy + y, ch)

    def mask(self) -> set:
        return {(x, y) for y in range(self.h) for x in range(self.w) if self.px[y][x] != '.'}

    def bbox(self) -> Tuple[int, int, int, int]:
        m = self.mask()
        xs = [p[0] for p in m]; ys = [p[1] for p in m]
        return min(xs), min(ys), max(xs), max(ys)

    def flip(self) -> 'Grid':
        g = Grid(self.w, self.h); g.px = [r[::-1] for r in self.px]; return g

    def shifted(self, dx: int, dy: int) -> 'Grid':
        g = Grid(self.w, self.h)
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x] != '.': g.set(x + dx, y + dy, self.px[y][x])
        return g

    def render(self, k: int = 1, bg=None) -> Image.Image:
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0) if bg is None else bg + (255,))
        p = im.load()
        for y in range(self.h):
            for x in range(self.w):
                ch = self.px[y][x]
                if ch in RGB: p[x, y] = RGB[ch] + (255,)
        return im if k == 1 else im.resize((self.w * k, self.h * k), Image.NEAREST)


Spans = Dict[int, Tuple[int, int]]


def shape(spans: Spans) -> set:
    """Pixels of a shape given as y → (x0, x1) inclusive spans."""
    return {(x, y) for y, (a, b) in spans.items() for x in range(a, b + 1)}


def mirror_spans(spans: Spans, w: int) -> Spans:
    """A left half (y → (x0, xc)) made whole about the grid's middle (w even: xc → w-1-x0)."""
    return {y: (a, w - 1 - a) for y, (a, b) in spans.items()}


def edge(m: set) -> set:
    """The shape's own rim: its pixels with a 4-neighbour outside it."""
    return {(x, y) for (x, y) in m if any((x + dx, y + dy) not in m for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))}


def paint(g: Grid, m: Iterable[Tuple[int, int]], f: Callable[[int, int], str] | str) -> None:
    for (x, y) in m:
        g.set(x, y, f if isinstance(f, str) else f(x, y))


def outline(g: Grid, m: set, ch: str = 'O') -> None:
    paint(g, edge(m), ch)


def composite(layers: List[Tuple[Grid, int, int]], w: int, h: int) -> Grid:
    out = Grid(w, h)
    for g, ox, oy in layers: out.stamp(g, ox, oy)
    return out


def sheet(frames: List[List[Grid]], k: int = 4, pad: int = 4, bg=(236, 236, 240)) -> Image.Image:
    """Rows of frames side by side (for looking at), ×k."""
    fw = max(f.w for r in frames for f in r); fh = max(f.h for r in frames for f in r)
    im = Image.new('RGBA', ((fw * k + pad) * max(len(r) for r in frames) + pad, (fh * k + pad) * len(frames) + pad), bg + (255,))
    for j, r in enumerate(frames):
        for i, f in enumerate(r):
            im.alpha_composite(f.render(k), (pad + i * (fw * k + pad), pad + j * (fh * k + pad)))
    return im
