// LEGACY OF SPIRITS — the character select (GPT's reference and decisions, 9 Nov: "Choose your hero"): the night
// courtyard painted by GPT behind, the real 3D Spectral Samurai in the middle on a violet rune circle, the heroes' list
// on the left (the Samurai the only one playable in this phase, the others sealed: dimmed, a lock, no promise), his
// panel on the right, BACK and ENTER WORLD below. The opening screen's language: Cinzel, cream words, gold frames with
// diamonds, the chosen one crimson. The character is the hero's own saved record (CharacterStore.startHero: nothing is
// made or written until he enters the world, as before). Only behind ?spirits; the regular select is untouched.
import Phaser from 'phaser';
import { DESIGN, FONT_FAMILY } from '../config/layout';
import { C, SPIRIT_MENU, drawRule, glowTex, leafTex } from './SpiritMenu';
import type { SpiritPreview } from './SpiritPreview';

export const SPIRIT_SELECT = { bg: { key: 'spirit-select-bg', file: 'assets/spirits/select_bg.jpg' } } as const;
const BODY = 'Inter, "Segoe UI", Arial, sans-serif';

/** The reference's layout (its screen panel, measured at 1920 × 1080). */
const L = {
  logo: { x: 368, y: 24, w: 540 },
  title: { x: 1085, y: 62, rule: 106 },
  rows: [{ cy: 300, h: 134 }, { cy: 440, h: 110 }, { cy: 565, h: 110 }, { cy: 690, h: 110 }, { cy: 815, h: 110 }],
  list: { x0: 68, x1: 636, sel: { x0: 58, x1: 660 } },
  hero: { x: 1045, feet: 905, w: 520, h: 760 },
  circle: { rx: 380, ry: 62 },
  panel: { x0: 1445, x1: 1865, y0: 270, y1: 700 },
  back: { x: 228, y: 995, w: 260, h: 66 },
  enter: { x: 1065, y: 995, w: 560, h: 86 },
} as const;

/** The heroes in the list: the Samurai playable, the others sealed for this phase (their data and the regular game
 *  untouched). */
const HEROES: { cls: string; name: string }[] = [
  { cls: 'samurai', name: 'Spectral Samurai' }, { cls: 'warrior', name: 'Warrior' }, { cls: 'book_mage', name: 'Book Mage' },
  { cls: 'archer', name: 'Archer' }, { cls: 'gambler', name: 'Gambler' },
];
const SEALED = 'Sealed';
const BLURB = 'A swordsman who walks between the human world and the spirit realm.';

type Ico = 'lock' | 'back' | 'swords' | 'emblem';
const ICON: Record<Ico, string> = {
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="1.6"/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9"/><circle cx="12" cy="15.1" r="1.2"/><path d="M12 16.3v1.7"/>',
  back: '<path d="M19.5 12H5"/><path d="M11 6l-6 6 6 6"/>',
  swords: '<path d="M4 4l9.5 9.5M4 4h3.5L15 11.5M4 4v3.5L11.5 15"/><path d="M20 4l-9.5 9.5M20 4h-3.5L9 11.5M20 4v3.5L12.5 15"/><path d="M6.5 15.5l2 2M15.5 17.5l2-2M5 20l3-3M19 20l-3-3"/>',
  // the spirit's sign: a diamond frame, a violet flame rising through a blade
  emblem: '<path d="M12 1.6l9.4 10.4L12 22.4 2.6 12z"/><path d="M12 5.2c2.6 2.6 4.3 4.9 4.3 7.5a4.3 4.3 0 0 1-8.6 0c0-1.5.7-2.8 1.8-3.9.2 1.4.9 2.3 1.9 2.7-.6-2.2-.2-4.3.6-6.3z" fill="#7b3fc4" stroke="#c9a0ff"/><path d="M12 9v11.5M10.3 17.6h3.4"/>',
};
const icoUrl = (id: Ico) => `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="128" height="128" fill="none" stroke="#f4d9a0" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[id]}</svg>`)}`;

export function preloadSpiritSelect(scene: Phaser.Scene): void {
  if (!scene.textures.exists(SPIRIT_SELECT.bg.key)) scene.load.image(SPIRIT_SELECT.bg.key, SPIRIT_SELECT.bg.file);
  if (!scene.textures.exists(SPIRIT_MENU.logo.key)) scene.load.image(SPIRIT_MENU.logo.key, SPIRIT_MENU.logo.file);
  for (const id of Object.keys(ICON) as Ico[]) if (!scene.textures.exists(`spirit-sel-${id}`)) scene.load.svg(`spirit-sel-${id}`, icoUrl(id), { width: 128, height: 128 });
}

const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);
/** A plate with cut corners (the list's rows, the info panel, the buttons), its frame and, if `ends`, a diamond at each
 *  end; drawn into g around its own box. */
function plate(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, o: { fill: [number, number]; alpha?: number; frame: number; frameA?: number; inner?: number; cut?: number; ends?: boolean; lit?: number }): void {
  const c = o.cut ?? 10, lit = o.lit ?? 0;
  const pts = (i: number) => [V(x0 + c + i, y0 + i), V(x1 - c - i, y0 + i), V(x1 - i, y0 + c + i), V(x1 - i, y1 - c - i), V(x1 - c - i, y1 - i), V(x0 + c + i, y1 - i), V(x0 + i, y1 - c - i), V(x0 + i, y0 + c + i)];
  g.fillStyle(0x05030a, 0.4); g.fillPoints(pts(-5), true);
  const mix = (v: number) => Phaser.Display.Color.IntegerToColor(v).brighten(Math.round(lit * 10)).color;
  g.fillGradientStyle(mix(o.fill[0]), mix(o.fill[0]), mix(o.fill[1]), mix(o.fill[1]), o.alpha ?? 0.92); g.fillPoints(pts(0), true);
  g.lineStyle(2, o.frame, o.frameA ?? 0.95); g.strokePoints(pts(0), true);
  if (o.inner !== undefined) { g.lineStyle(1, o.inner, 0.6); g.strokePoints(pts(5), true); }
  if (o.ends) {
    const cy = (y0 + y1) / 2;
    for (const x of [x0 - 8, x1 + 8]) {
      const d = 10; g.fillStyle(C.goldHi, 1); g.fillPoints([V(x, cy - d), V(x + d * 0.75, cy), V(x, cy + d), V(x - d * 0.75, cy)], true);
      g.fillStyle(0x3a0c18, 1); g.fillCircle(x, cy, d * 0.3);
    }
  }
}

/** The rune circle under his feet: three rings, a band of rune marks turning slowly, a soft violet light breathing. */
function runeCircle(scene: Phaser.Scene, x: number, y: number): void {
  const { rx, ry } = L.circle;
  const glow = scene.add.image(x, y, glowTex(scene, 'spirit-glow', 64)).setDisplaySize(rx * 2.3, ry * 2.6).setTint(0x9a5cff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.32).setDepth(3);
  scene.tweens.add({ targets: glow, alpha: 0.48, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const g = scene.add.graphics().setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
  const ring = (k: number, w: number, col: number, a: number) => { g.lineStyle(w, col, a); g.strokeEllipse(x, y, rx * 2 * k, ry * 2 * k); };
  let t = 0;
  scene.events.on(Phaser.Scenes.Events.UPDATE, (_: number, ms: number) => {
    t += ms;
    const p = 0.85 + 0.15 * Math.sin(t / 900);
    g.clear();
    ring(1, 3, 0xb27cff, 0.75 * p); ring(0.93, 1.2, 0xd9b8ff, 0.5 * p); ring(0.62, 2, 0xa46bff, 0.55 * p); ring(0.34, 1.4, 0xd9b8ff, 0.45 * p);
    // the rune marks: short arcs and ticks round the band between the outer rings, turning
    const a0 = t / 9000, n = 36;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2, k = 0.78, len = i % 3 === 0 ? 0.07 : 0.035;
      const px = x + Math.cos(a) * rx * k, py = y + Math.sin(a) * ry * k, qx = x + Math.cos(a + len) * rx * k, qy = y + Math.sin(a + len) * ry * k;
      g.lineStyle(i % 3 === 0 ? 2.4 : 1.4, 0xc9a0ff, (0.35 + 0.35 * (0.5 + 0.5 * Math.sin(a * 3 + t / 700))) * p);
      g.lineBetween(px, py, qx, qy);
    }
  });
}

/** The painting's lanterns (its 1920 × 1080 px): x, y, the size of their light. */
const LANTERNS: [number, number, number][] = [[37, 534, 48], [800, 553, 40], [1156, 563, 36], [1292, 591, 32], [1539, 367, 52], [1881, 591, 46]];

/** The restrained life of the opening screen: a few falling maple leaves, the lanterns' warm flicker. */
function addLife(scene: Phaser.Scene, painted: boolean): void {
  if (painted) {
    const glow = glowTex(scene, 'spirit-glow', 64), lights: [Phaser.GameObjects.Image, number][] = [];
    for (const [x, y, r] of LANTERNS) lights.push([scene.add.image(x, y, glow).setDisplaySize(r * 2.4, r * 2.4).setTint(0xffc773).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.26).setDepth(2), 0.26]);
    scene.time.addEvent({ delay: 110, loop: true, callback: () => { for (const [l, a0] of lights) l.setAlpha(Phaser.Math.Clamp(l.alpha + (Math.random() - 0.5) * 0.06, a0 * 0.75, a0 * 1.25)); } });
  }
  const kinds = [leafTex(scene, 'spirit-leaf-r', 0xb3203a, 22, 12), leafTex(scene, 'spirit-leaf-o', 0xc9502c, 20, 11)];
  const spawn = () => {
    const key = Phaser.Utils.Array.GetRandom(kinds), x = Phaser.Math.Between(300, DESIGN.width + 80);
    const leaf = scene.add.image(x, -20, key).setDepth(8).setAlpha(0.8).setRotation(Math.random() * 6.28).setScale(Phaser.Math.FloatBetween(0.8, 1.25));
    const dur = Phaser.Math.Between(12000, 17000), dx = -Phaser.Math.Between(180, 420);
    scene.tweens.add({ targets: leaf, y: DESIGN.height + 30, duration: dur, ease: 'Linear', onComplete: () => leaf.destroy() });
    scene.tweens.add({ targets: leaf, x: x + dx, duration: dur, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: leaf, rotation: leaf.rotation + Phaser.Math.FloatBetween(-4, 4), scaleY: leaf.scaleY * 0.4, duration: Phaser.Math.Between(1600, 2600), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  };
  for (let i = 0; i < 3; i++) scene.time.delayedCall(i * 1100, spawn);
  scene.time.addEvent({ delay: 1900, loop: true, callback: spawn });
}

const txt = (scene: Phaser.Scene, x: number, y: number, s: string, size: number, color: string, o: { bold?: boolean; body?: boolean; spacing?: number; wrap?: number; line?: number } = {}) =>
  scene.add.text(x, y, s, { fontFamily: o.body ? BODY : FONT_FAMILY, fontSize: `${size}px`, fontStyle: o.bold === false ? 'normal' : 'bold', color, resolution: 2, ...(o.wrap ? { wordWrap: { width: o.wrap } } : {}), ...(o.line ? { lineSpacing: o.line } : {}) })
    .setLetterSpacing(o.spacing ?? 0).setShadow(0, 2, '#07030d', 5, true, true);

export interface SpiritSelectHandlers { level: number; onBack: () => void; onEnter: () => void }

/** The select screen. The 3D Samurai is loaded after the frame shows (his place waits on the circle). Returns a teardown. */
export function buildSpiritSelect(scene: Phaser.Scene, h: SpiritSelectHandlers): () => void {
  const W = DESIGN.width, H = DESIGN.height;
  // the night courtyard (GPT's painting; if it is missing, the palette's night)
  const painted = scene.textures.exists(SPIRIT_SELECT.bg.key);
  if (painted) {
    const bg = scene.add.image(W / 2, H / 2, SPIRIT_SELECT.bg.key); bg.setScale(Math.max(W / bg.width, H / bg.height));
  } else {
    const g = scene.add.graphics(); g.fillGradientStyle(0x2a1a4a, 0x2a1a4a, 0x0d0918, 0x0d0918, 1); g.fillRect(0, 0, W, H);
  }
  addLife(scene, painted);
  // the logo (its subtitle in it) and the title
  if (scene.textures.exists(SPIRIT_MENU.logo.key)) { const lg = scene.add.image(L.logo.x, L.logo.y, SPIRIT_MENU.logo.key).setOrigin(0.5, 0).setDepth(6); lg.setScale(L.logo.w / lg.width); }
  // (the painting's moon stands behind the title: a soft shade under the words keeps them clear)
  scene.add.image(L.title.x, L.title.y + 4, glowTex(scene, 'spirit-glow', 64)).setDisplaySize(820, 150).setTint(0x000000).setAlpha(0.42).setDepth(5);
  txt(scene, L.title.x, L.title.y, 'CHOOSE YOUR HERO', 44, '#f6ecd9', { spacing: 5 }).setOrigin(0.5).setDepth(6).setShadow(0, 2, '#0a0614', 12, true, true);
  { const g = scene.add.graphics().setDepth(6); for (const sx of [-1, 1]) { const x = L.title.x + sx * 300, y = L.title.y; g.fillStyle(C.gold, 1); g.fillPoints([V(x, y - 6), V(x + 5, y), V(x, y + 6), V(x - 5, y)], true); } }
  drawRule(scene, L.title.x, L.title.rule, 620);

  // the circle where he stands, then himself (loaded now: the screen is there at once)
  runeCircle(scene, L.hero.x, L.hero.feet);
  let pv: SpiritPreview | null = null, gone = false;
  void import('./SpiritPreview').then(async ({ SpiritPreview }) => {
    const p = await SpiritPreview.create(scene, { w: L.hero.w, h: L.hero.h });
    if (gone || !scene.sys.isActive()) { p.destroy(); return; }
    pv = p; p.image.setPosition(L.hero.x, L.hero.feet).setOrigin(0.5, 0.99).setDepth(5).setAlpha(0);
    scene.tweens.add({ targets: p.image, alpha: 1, duration: 420, ease: 'Sine.easeOut' });
    p.portrait('spirit-portrait', 136);
    portraits();
  }).catch((e) => console.warn('spirit select: the 3D Samurai did not load', e)); // (the screen and Enter World work without him)

  // the heroes' list
  const faces: { img: Phaser.GameObjects.Image; dark: boolean; r: number }[] = [];
  HEROES.forEach((hero, i) => {
    const row = L.rows[i], sel = i === 0, y0 = row.cy - row.h / 2, y1 = row.cy + row.h / 2;
    const x0 = sel ? L.list.sel.x0 : L.list.x0, x1 = sel ? L.list.sel.x1 : L.list.x1;
    const g = scene.add.graphics().setDepth(6);
    const draw = (lit: number) => { g.clear(); if (sel) plate(g, x0, y0, x1, y1, { fill: [0x8c1426, 0x4c0814], frame: C.goldHi, inner: C.goldDim, cut: 12, ends: true, lit }); else plate(g, x0, y0, x1, y1, { fill: [0x1a1430, 0x0f0b1d], alpha: 0.86, frame: 0x4a3d6a, frameA: 0.85, cut: 10, lit }); };
    draw(0);
    const fx = sel ? x0 + 112 : x0 + 92, r = sel ? 66 : 54;
    const ring = scene.add.graphics().setDepth(7);
    ring.fillStyle(sel ? 0x2a0a14 : 0x15102a, 1).fillCircle(fx, row.cy, r);
    // behind a sealed one's dark bust, a dim violet light (it reads as a shadow standing in the spirit realm)
    if (!sel) scene.add.image(fx, row.cy - 4, glowTex(scene, 'spirit-glow', 64)).setDisplaySize(r * 1.9, r * 1.9).setTint(0x7a5cc0).setAlpha(0.7).setDepth(7);
    const img = scene.add.image(fx, row.cy, '__DEFAULT').setDepth(7).setVisible(false);
    const edge = scene.add.graphics().setDepth(7);
    edge.lineStyle(sel ? 2.4 : 1.6, sel ? C.goldHi : 0x5a4c7c, sel ? 1 : 0.8).strokeCircle(fx, row.cy, r);
    faces.push({ img, dark: !sel, r: r - 3 });
    if (sel) {
      txt(scene, fx + r + 34, row.cy, hero.name.toUpperCase().replace(' ', '\n'), 34, '#fff6e4', { spacing: 2, line: -2 }).setOrigin(0, 0.5).setDepth(7);
      const zone = scene.add.zone((x0 + x1) / 2, row.cy, x1 - x0, row.h).setInteractive({ useHandCursor: true }).setDepth(7);
      zone.on('pointerover', () => draw(1)); zone.on('pointerout', () => draw(0));
    } else {
      txt(scene, fx + r + 30, row.cy - 17, hero.name.toUpperCase(), 28, '#d9d0e8', { spacing: 1.5 }).setOrigin(0, 0.5).setDepth(7).setAlpha(0.8);
      txt(scene, fx + r + 31, row.cy + 21, SEALED, 21, '#a99cc4', { body: true, bold: false }).setOrigin(0, 0.5).setDepth(7).setAlpha(0.85);
      scene.add.image(x1 - 50, row.cy, 'spirit-sel-lock').setDisplaySize(36, 36).setDepth(7).setAlpha(0.85);
    }
  });
  const portraits = () => {
    for (const f of faces) {
      const k = f.dark ? 'spirit-portrait-dark' : 'spirit-portrait';
      if (!scene.textures.exists(k)) continue;
      f.img.setTexture(k).setDisplaySize(f.r * 2, f.r * 2).setVisible(true).setAlpha(f.dark ? 0.9 : 1);
    }
  };

  // his panel: his sign and name, the line about him, his level
  const P = L.panel;
  { const g = scene.add.graphics().setDepth(6); plate(g, P.x0, P.y0, P.x1, P.y1, { fill: [0x1d1533, 0x110c20], alpha: 0.9, frame: C.gold, frameA: 0.8, inner: 0x3d2f5c, cut: 14 }); }
  scene.add.image(P.x0 + 76, P.y0 + 74, 'spirit-sel-emblem').setDisplaySize(84, 84).setDepth(7);
  txt(scene, P.x0 + 140, P.y0 + 74, 'SPECTRAL\nSAMURAI', 33, '#fff3dc', { spacing: 2, line: -2 }).setOrigin(0, 0.5).setDepth(7);
  const rule = (y: number) => { const g = scene.add.graphics().setDepth(7); g.lineStyle(1, C.gold, 0.55); g.lineBetween(P.x0 + 30, y, P.x1 - 30, y); g.fillStyle(C.gold, 0.9); g.fillPoints([V((P.x0 + P.x1) / 2, y - 4), V((P.x0 + P.x1) / 2 + 4, y), V((P.x0 + P.x1) / 2, y + 4), V((P.x0 + P.x1) / 2 - 4, y)], true); };
  rule(P.y0 + 140);
  txt(scene, P.x0 + 36, P.y0 + 166, BLURB, 23, '#e8def2', { body: true, bold: false, wrap: P.x1 - P.x0 - 72, line: 9 }).setDepth(7);
  rule(P.y0 + 300);
  txt(scene, P.x0 + 36, P.y0 + 344, 'LEVEL', 22, '#d9b86e', { spacing: 2 }).setOrigin(0, 0.5).setDepth(7);
  txt(scene, P.x1 - 36, P.y0 + 344, String(h.level), 30, '#fff3dc', { spacing: 1 }).setOrigin(1, 0.5).setDepth(7);

  // BACK and ENTER WORLD
  const button = (b: { x: number; y: number; w: number; h: number }, main: boolean, label: string, ico: Ico, go: () => void) => {
    const c = scene.add.container(b.x, b.y).setDepth(7);
    const g = scene.add.graphics(); c.add(g);
    const draw = (lit: number) => { g.clear(); if (main) plate(g, -b.w / 2, -b.h / 2, b.w / 2, b.h / 2, { fill: [0x9a1a2e, 0x55091a], frame: C.goldHi, inner: C.goldDim, cut: 16, ends: true, lit }); else plate(g, -b.w / 2, -b.h / 2, b.w / 2, b.h / 2, { fill: [0x1d1533, 0x110c20], frame: C.gold, frameA: 0.75, cut: 10, lit }); };
    draw(0);
    const t = txt(scene, main ? 26 : 22, 0, label, main ? 36 : 26, main ? '#fff6e4' : '#f3e8d2', { spacing: main ? 3 : 2 }).setOrigin(0.5); c.add(t);
    const icon = scene.add.image(-t.width / 2 + (main ? 26 : 22) - (main ? 34 : 28), 0, `spirit-sel-${ico}`).setDisplaySize(main ? 40 : 30, main ? 40 : 30); c.add(icon);
    const zone = scene.add.zone(0, 0, b.w + 20, b.h + 6).setInteractive({ useHandCursor: true }); c.add(zone);
    const st = { lit: 0 };
    zone.on('pointerover', () => scene.tweens.add({ targets: st, lit: 1, duration: 120, onUpdate: () => draw(st.lit) }));
    zone.on('pointerout', () => scene.tweens.add({ targets: st, lit: 0, duration: 160, onUpdate: () => draw(st.lit) }));
    zone.on('pointerdown', () => c.setScale(0.985));
    zone.on('pointerup', () => { c.setScale(1); go(); });
  };
  let left = false;
  const leave = (go: () => void) => { if (left) return; left = true; const cam = scene.cameras.main; cam.fadeOut(240, 0, 0, 0); cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, go); };
  button(L.back, false, 'BACK', 'back', () => leave(h.onBack));
  button(L.enter, true, 'ENTER WORLD', 'swords', () => leave(h.onEnter));
  const kb = scene.input.keyboard;
  const enter = (e?: KeyboardEvent) => { if (!e?.repeat) leave(h.onEnter); }, back = () => leave(h.onBack); // (a held key from the menu's Enter never walks straight through)
  kb?.on('keydown-ENTER', enter); kb?.on('keydown-ESC', back);
  return () => { gone = true; kb?.off('keydown-ENTER', enter); kb?.off('keydown-ESC', back); pv?.destroy(); };
}
