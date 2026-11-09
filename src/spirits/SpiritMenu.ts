// LEGACY OF SPIRITS — the opening screen (GPT's reference, 9 Nov: the Spectral Samurai in the night courtyard on the
// left, the title and the menu on the right): GPT's painted background, the title (its art when it comes; until then
// its words in the game's title face), and the menu drawn here as in the reference — long six-sided plates, dark violet
// with a fine gold frame and a diamond at each point, the line icon at the left, the chosen one crimson; a gold rule
// with a diamond above and below the menu. Only behind ?spirits; the regular menu is untouched.
import Phaser from 'phaser';
import { DESIGN, FONT_FAMILY } from '../config/layout';

export const SPIRIT_MENU = {
  bg: { key: 'spirit-menu-bg', file: 'assets/spirits/menu_bg.jpg' },
  logo: { key: 'spirit-menu-logo', file: 'assets/spirits/menu_logo.png' },
} as const;

/** The reference's layout, measured on it (1672 × 941 → the game's 1920 × 1080). */
const R = 1920 / 1672;
const COL = 1180 * R; // the title's and the menu's centre line
const PLATE = { w: 372 * R, h: 58 * R, wMain: 410 * R, hMain: 64 * R };
const ROWS = [412, 490, 565, 640, 715].map((y) => y * R);
const RULE_TOP = 325 * R, RULE_BOTTOM = 778 * R;

const C = {
  plate: [0x2b1a44, 0x170e26], plateMain: [0x8c1426, 0x4c0814], gold: 0xd9b46a, goldHi: 0xf3d9a0, goldDim: 0x8a6a36,
  text: '#fbf3e2', textMain: '#fff6e4', sub: '#e6d6b4', // (the plain ones' words a little brighter — GPT, 9 Nov: faint at 1280 × 720)
} as const;

export interface SpiritMenuItem { label: string; icon: IconId; go: () => void }
type IconId = 'swords' | 'arena' | 'training' | 'gear' | 'exit';

/** Line icons on a 24 grid (gold strokes), as the reference's. */
const ICON: Record<IconId, string> = {
  swords: '<path d="M4 4l9.5 9.5M4 4h3.5L15 11.5M4 4v3.5L11.5 15"/><path d="M20 4l-9.5 9.5M20 4h-3.5L9 11.5M20 4v3.5L12.5 15"/><path d="M6.5 15.5l2 2M15.5 17.5l2-2M5 20l3-3M19 20l-3-3"/>',
  arena: '<path d="M12 3l7 3v5.5c0 4.6-3 7.8-7 9.5-4-1.7-7-4.9-7-9.5V6z"/><path d="M8.5 9.5l7 7M15.5 9.5l-7 7"/>',
  training: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/><path d="M12 1.5v4M22.5 12h-4"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M4.2 7.5l2.3 1.3M17.5 15.2l2.3 1.3M4.2 16.5l2.3-1.3M17.5 8.8l2.3-1.3"/><circle cx="12" cy="12" r="7"/>',
  exit: '<path d="M10 4H5v16h5"/><path d="M14 8l4 4-4 4M18 12H9"/>',
};
// (base64: Phaser's loader reads a data address with atob)
const iconUrl = (id: IconId) => `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="#f4d9a0" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICON[id]}</svg>`)}`;

export function preloadSpiritMenu(scene: Phaser.Scene): void {
  scene.load.image(SPIRIT_MENU.bg.key, SPIRIT_MENU.bg.file);
  scene.load.image(SPIRIT_MENU.logo.key, SPIRIT_MENU.logo.file);
  for (const id of Object.keys(ICON) as IconId[]) if (!scene.textures.exists(`spirit-ico-${id}`)) scene.load.svg(`spirit-ico-${id}`, iconUrl(id), { width: 96, height: 96 });
}

/** A six-sided plate (pointed ends), its frame and the diamonds at its points, drawn into g around (0, 0). */
function drawPlate(g: Phaser.GameObjects.Graphics, w: number, h: number, main: boolean, lit: number): void {
  g.clear();
  const hw = w / 2, hh = h / 2, tip = hh * 0.9;
  const pts = (inset: number) => [
    new Phaser.Math.Vector2(-hw + tip + inset * 0.4, -hh + inset), new Phaser.Math.Vector2(hw - tip - inset * 0.4, -hh + inset),
    new Phaser.Math.Vector2(hw - inset, 0), new Phaser.Math.Vector2(hw - tip - inset * 0.4, hh - inset),
    new Phaser.Math.Vector2(-hw + tip + inset * 0.4, hh - inset), new Phaser.Math.Vector2(-hw + inset, 0),
  ];
  // a soft dark halo under it (the plate reads on the painting)
  g.fillStyle(0x05030a, 0.45); g.fillPoints(pts(-5), true);
  // the fill: top to bottom, its two colours (the chosen one crimson), brightened a little when lit
  const [c0, c1] = main ? C.plateMain : C.plate;
  const mix = (c: number) => Phaser.Display.Color.IntegerToColor(c).brighten(Math.round(lit * 12)).color;
  g.fillGradientStyle(mix(c0), mix(c0), mix(c1), mix(c1), 0.94);
  g.fillPoints(pts(0), true);
  // the frame: gold, and a finer line inside it
  g.lineStyle(2.2, main ? C.goldHi : C.gold, 0.95); g.strokePoints(pts(0), true);
  g.lineStyle(1, C.goldDim, 0.7); g.strokePoints(pts(5), true);
  // a diamond at each point
  for (const sx of [-1, 1]) {
    const x = sx * (hw + 7), d = main ? 9 : 7;
    g.fillStyle(main ? C.goldHi : C.gold, 1);
    g.fillPoints([new Phaser.Math.Vector2(x, -d), new Phaser.Math.Vector2(x + d * 0.75, 0), new Phaser.Math.Vector2(x, d), new Phaser.Math.Vector2(x - d * 0.75, 0)], true);
    g.fillStyle(0x2b1a10, 1); g.fillCircle(x, 0, d * 0.28);
  }
}

/** A gold rule with a diamond in the middle (above and below the menu). */
function drawRule(scene: Phaser.Scene, x: number, y: number, w: number): void {
  const g = scene.add.graphics().setDepth(6);
  g.lineStyle(1.4, C.gold, 0.85); g.lineBetween(x - w / 2, y, x - 18, y); g.lineBetween(x + 18, y, x + w / 2, y);
  g.fillStyle(C.gold, 1);
  g.fillPoints([new Phaser.Math.Vector2(x, y - 11), new Phaser.Math.Vector2(x + 11, y), new Phaser.Math.Vector2(x, y + 11), new Phaser.Math.Vector2(x - 11, y)], true);
  g.fillStyle(0x1a1028, 1);
  g.fillPoints([new Phaser.Math.Vector2(x, y - 5), new Phaser.Math.Vector2(x + 5, y), new Phaser.Math.Vector2(x, y + 5), new Phaser.Math.Vector2(x - 5, y)], true);
  for (const sx of [-1, 1]) { g.fillStyle(C.gold, 0.9); g.fillCircle(x + sx * (w / 2 + 4), y, 2.2); }
}

/** The painting's places (its own 1920 × 1080 px): the sword's blade (guard → tip), the fire, the lanterns. */
const ART = {
  blade: { a: [412, 572], b: [196, 948] }, fire: [150, 468], lanterns: [[915, 438, 46], [1695, 553, 54], [1650, 733, 40]] as [number, number, number][],
} as const;

/** Soft round light (white, faded to nothing at its edge), made once. */
function glowTex(scene: Phaser.Scene, key: string, r: number): string {
  if (scene.textures.exists(key)) return key;
  const c = scene.textures.createCanvas(key, r * 2, r * 2)!; const x = c.getContext();
  const gr = x.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, r * 2, r * 2); c.refresh(); return key;
}

/** A leaf or a petal (made once each): an almond shape, its vein a shade darker. */
function leafTex(scene: Phaser.Scene, key: string, col: number, w: number, h: number): string {
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  g.fillStyle(col, 1); g.fillEllipse(w / 2, h / 2, w, h);
  g.lineStyle(1, Phaser.Display.Color.IntegerToColor(col).darken(25).color, 0.8); g.lineBetween(w * 0.15, h / 2, w * 0.85, h / 2);
  g.generateTexture(key, w, h); g.destroy(); return key;
}

/** The screen's restrained life: sparse falling leaves and petals, the sword's slow violet pulse, the fire's and the
 *  lanterns' warm flicker, a slow mist over the stones. A few cached textures, a few dozen objects; nothing on the
 *  Samurai's own picture moves. */
function addLife(scene: Phaser.Scene, bg: Phaser.GameObjects.Image): void {
  const k = bg.scaleX, ox = bg.x - bg.displayWidth / 2, oy = bg.y - bg.displayHeight / 2;
  const at = (x: number, y: number) => ({ x: ox + x * k, y: oy + y * k });
  const glow = glowTex(scene, 'spirit-glow', 64);
  // the sword: a long soft violet light along its blade, breathing slowly (never a flare)
  const A = at(ART.blade.a[0], ART.blade.a[1]), B = at(ART.blade.b[0], ART.blade.b[1]);
  const len = Math.hypot(B.x - A.x, B.y - A.y), ang = Math.atan2(B.y - A.y, B.x - A.x);
  const blade = scene.add.image((A.x + B.x) / 2, (A.y + B.y) / 2, glow).setRotation(ang).setDisplaySize(len * 1.15, 46 * k)
    .setTint(0xa46bff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.16).setDepth(2);
  scene.tweens.add({ targets: blade, alpha: 0.34, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  // the fire and the lanterns: warm lights that flicker a little
  const lights: [Phaser.GameObjects.Image, number][] = [];
  const F = at(ART.fire[0], ART.fire[1]);
  lights.push([scene.add.image(F.x, F.y, glow).setDisplaySize(230 * k, 200 * k).setTint(0xffa24a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setDepth(2), 0.3]);
  for (const [x, y, r] of ART.lanterns) { const p = at(x, y); lights.push([scene.add.image(p.x, p.y, glow).setDisplaySize(r * 2.2 * k, r * 2.2 * k).setTint(0xffc773).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.28).setDepth(2), 0.28]); }
  scene.time.addEvent({ delay: 110, loop: true, callback: () => { for (const [l, a0] of lights) l.setAlpha(Phaser.Math.Clamp(l.alpha + (Math.random() - 0.5) * 0.06, a0 * 0.75, a0 * 1.25)); } });
  // a slow mist over the stones
  const mist = scene.add.image(DESIGN.width * 0.55, DESIGN.height * 0.86, glow).setDisplaySize(DESIGN.width * 1.3, 220).setTint(0xb9a3e6).setAlpha(0.07).setDepth(2);
  scene.tweens.add({ targets: mist, x: DESIGN.width * 0.45, duration: 26000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  // leaves and petals: a few at a time, slow, drifting down and left, turning
  const kinds = [leafTex(scene, 'spirit-leaf-r', 0xb3203a, 22, 12), leafTex(scene, 'spirit-leaf-o', 0xc9502c, 20, 11), leafTex(scene, 'spirit-petal', 0xf2a6c8, 14, 9)];
  const spawn = () => {
    const key = Phaser.Utils.Array.GetRandom(kinds), x = Phaser.Math.Between(200, DESIGN.width + 80), y = -20;
    const leaf = scene.add.image(x, y, key).setDepth(8).setAlpha(0.85).setRotation(Math.random() * 6.28).setScale(Phaser.Math.FloatBetween(0.8, 1.3));
    const dur = Phaser.Math.Between(11000, 16000), dx = -Phaser.Math.Between(180, 420);
    scene.tweens.add({ targets: leaf, y: DESIGN.height + 30, duration: dur, ease: 'Linear', onComplete: () => leaf.destroy() });
    scene.tweens.add({ targets: leaf, x: x + dx, duration: dur, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: leaf, rotation: leaf.rotation + Phaser.Math.FloatBetween(-4, 4), scaleY: leaf.scaleY * 0.4, duration: Phaser.Math.Between(1600, 2600), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  };
  for (let i = 0; i < 4; i++) scene.time.delayedCall(i * 900, spawn);
  scene.time.addEvent({ delay: 1500, loop: true, callback: spawn }); // (about ten in the air at a time)
}

/** The opening screen: background, title, menu. Returns a teardown. */
export function buildSpiritMenu(scene: Phaser.Scene, items: SpiritMenuItem[]): () => void {
  const bg = scene.add.image(DESIGN.width / 2, DESIGN.height / 2, SPIRIT_MENU.bg.key);
  bg.setScale(Math.max(DESIGN.width / bg.width, DESIGN.height / bg.height));
  addLife(scene, bg);
  // the title: GPT's logo art (its subtitle in it), else its words
  const art = scene.textures.exists(SPIRIT_MENU.logo.key);
  if (art) {
    const logo = scene.add.image(COL, 82 * R, SPIRIT_MENU.logo.key).setOrigin(0.5, 0).setDepth(6);
    logo.setScale((660 * R) / logo.width);
  } else {
    scene.add.text(COL, 128 * R, 'LEGACY OF', { fontFamily: FONT_FAMILY, fontSize: `${Math.round(54 * R)}px`, fontStyle: 'bold', color: '#efd9a6', resolution: 2 })
      .setOrigin(0.5).setLetterSpacing(4).setShadow(0, 3, '#1a0b2a', 10, true, true).setDepth(6);
    scene.add.text(COL, 205 * R, 'SPIRITS', { fontFamily: FONT_FAMILY, fontSize: `${Math.round(104 * R)}px`, fontStyle: 'bold', color: '#f4dfad', resolution: 2 })
      .setOrigin(0.5).setLetterSpacing(6).setShadow(0, 4, '#1a0b2a', 14, true, true).setDepth(6);
  }
  if (!art) scene.add.text(COL, 296 * R, 'A new path for GOD OF LEGACY', { fontFamily: FONT_FAMILY, fontSize: `${Math.round(17 * R)}px`, color: C.sub, resolution: 2 })
    .setOrigin(0.5).setLetterSpacing(1.5).setShadow(0, 2, '#000', 6, true, true).setDepth(6);
  drawRule(scene, COL, RULE_TOP, 500 * R);
  drawRule(scene, COL, RULE_BOTTOM, 400 * R);

  // the menu: one plate each; the chosen one (the pointer's, or the keys') crimson
  let chosen = 0;
  const rows = items.map((it, i) => {
    const y = ROWS[i] ?? ROWS[ROWS.length - 1] + (i - ROWS.length + 1) * 75 * R;
    const c = scene.add.container(COL, y).setDepth(7);
    const g = scene.add.graphics(); c.add(g);
    const icon = scene.add.image(0, 0, `spirit-ico-${it.icon}`); c.add(icon);
    const bar = scene.add.graphics(); c.add(bar);
    const label = scene.add.text(0, 0, it.label, { fontFamily: FONT_FAMILY, fontSize: `${Math.round(26 * R)}px`, color: C.text, resolution: 2 })
      .setOrigin(0.5).setLetterSpacing(0.6).setShadow(0, 2, '#0a0510', 4, true, true);
    c.add(label);
    const st = { lit: 0 };
    const zone = scene.add.zone(0, 0, PLATE.wMain + 30, PLATE.hMain + 8).setInteractive({ useHandCursor: true }); c.add(zone);
    return { it, c, g, icon, bar, label, st, zone };
  });
  const draw = () => rows.forEach((r, i) => {
    const main = i === chosen, w = main ? PLATE.wMain : PLATE.w, h = main ? PLATE.hMain : PLATE.h;
    drawPlate(r.g, w, h, main, r.st.lit);
    const ix = -w / 2 + h * 0.9 + 26 * R;
    r.icon.setPosition(ix, 0).setDisplaySize(30 * R, 30 * R).setAlpha(0.95);
    r.bar.clear(); if (main) { r.bar.lineStyle(1.4, C.goldHi, 0.8); r.bar.lineBetween(ix + 30 * R, -h * 0.28, ix + 30 * R, h * 0.28); }
    r.label.setPosition(main ? 8 * R : 0, 0).setFontSize(Math.round((main ? 28 : 25) * R)).setColor(main ? C.textMain : C.text);
  });
  const choose = (i: number) => { if (i === chosen) return; chosen = i; draw(); };
  rows.forEach((r, i) => {
    r.zone.on('pointerover', () => { choose(i); scene.tweens.add({ targets: r.st, lit: 1, duration: 120, onUpdate: draw }); });
    r.zone.on('pointerout', () => { scene.tweens.add({ targets: r.st, lit: 0, duration: 160, onUpdate: draw }); });
    r.zone.on('pointerdown', () => { r.c.setScale(0.985); });
    r.zone.on('pointerup', () => { r.c.setScale(1); r.it.go(); });
  });
  draw();
  // the keys: up / down to choose, Enter or Space to go
  const kb = scene.input.keyboard;
  const up = () => choose((chosen + rows.length - 1) % rows.length), down = () => choose((chosen + 1) % rows.length), go = () => rows[chosen]?.it.go();
  kb?.on('keydown-UP', up); kb?.on('keydown-DOWN', down); kb?.on('keydown-ENTER', go); kb?.on('keydown-SPACE', go);
  return () => { kb?.off('keydown-UP', up); kb?.off('keydown-DOWN', down); kb?.off('keydown-ENTER', go); kb?.off('keydown-SPACE', go); };
}
