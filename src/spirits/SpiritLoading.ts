// LEGACY OF SPIRITS — the way into the world (David, 9 Nov: the loading screen still showed the old game's art and
// title; GPT: the opening presentation belongs to the spirit form's stage). The select's night courtyard dimmed, the
// Legacy of Spirits title, the place's name between gold rules, a violet-to-gold bar. It stays up until the Samurai
// himself is there — the world built and his spirit body loaded: no empty courtyard, no hero popping in late — then
// lifts. Only behind ?spirits (the regular game keeps its loading screen).
import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/layout';
import { C, SPIRIT_MENU, glowTex } from './SpiritMenu';

const BG = { key: 'spirit-select-bg', file: 'assets/spirits/select_bg.jpg' };
const BODY = 'Inter, "Segoe UI", Arial, sans-serif';
const D = 2000000; // (over everything the world adds while it is built)

export interface SpiritCurtain {
  /** How far the way in has come (0..1): the loader's files are its first half, the world and the hero the rest. */
  progress(p: number): void;
  /** He is there: the bar fills, the curtain lifts. */
  lift(): void;
}

export function showSpiritLoading(scene: Phaser.Scene, place: string): SpiritCurtain {
  const W = scene.scale.width, H = scene.scale.height, load = scene.load;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { (o as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor?.(0); objs.push(o); return o; };
  add(scene.add.rectangle(0, 0, W, H, 0x07040e, 1).setOrigin(0, 0).setDepth(D));
  let bg: Phaser.GameObjects.Image | null = null;
  const showBg = () => {
    if (bg || !scene.textures.exists(BG.key)) return;
    bg = add(scene.add.image(W / 2, H / 2, BG.key).setDepth(D + 1).setAlpha(0.5)); // (no fade: a scene still loading runs no tweens)
    bg.setScale(Math.max(W / bg.width, H / bg.height) * 1.04);
  };
  const shade = add(scene.add.graphics().setDepth(D + 2));
  shade.fillGradientStyle(0x07040e, 0x07040e, 0x07040e, 0x07040e, 0.15, 0.15, 0.85, 0.85).fillRect(0, H * 0.45, W, H * 0.55);
  shade.fillGradientStyle(0x07040e, 0x07040e, 0x07040e, 0x07040e, 0.6, 0.6, 0, 0).fillRect(0, 0, W, H * 0.25);
  // a soft violet light behind the title
  add(scene.add.image(W / 2, H * 0.32, glowTex(scene, 'spirit-glow', 64)).setDisplaySize(W * 0.62, H * 0.42).setTint(0x6a3cc4).setAlpha(0.28).setDepth(D + 2));
  let logo: Phaser.GameObjects.Image | null = null;
  const showLogo = () => {
    if (logo || !scene.textures.exists(SPIRIT_MENU.logo.key)) return;
    logo = add(scene.add.image(W / 2, H * 0.31, SPIRIT_MENU.logo.key).setDepth(D + 3));
    logo.setScale((W * 0.36) / logo.width);
  };
  // the place's name between gold rules
  const py = H * 0.6;
  add(scene.add.text(W / 2, py, place.toUpperCase(), { fontFamily: FONT_FAMILY, fontStyle: '700', fontSize: '34px', color: C.text, resolution: 2 })
    .setOrigin(0.5).setLetterSpacing(6).setShadow(0, 2, '#05030a', 12, true, true).setDepth(D + 4));
  const rules = add(scene.add.graphics().setDepth(D + 4));
  for (const y of [py - 40, py + 40]) {
    rules.lineStyle(1.2, C.gold, 0.7); rules.lineBetween(W / 2 - 230, y, W / 2 - 14, y); rules.lineBetween(W / 2 + 14, y, W / 2 + 230, y);
    rules.fillStyle(C.gold, 1); rules.fillPoints([new Phaser.Math.Vector2(W / 2, y - 7), new Phaser.Math.Vector2(W / 2 + 7, y), new Phaser.Math.Vector2(W / 2, y + 7), new Phaser.Math.Vector2(W / 2 - 7, y)], true);
  }
  // the bar: a dark track in a fine gold frame, its fill violet into gold, a spark at its head
  const fw = Math.min(680, W * 0.42), fh = 6, fx = W / 2 - fw / 2, fy = H * 0.84;
  const track = add(scene.add.graphics().setDepth(D + 4));
  track.fillStyle(0x0d0818, 0.95).fillRoundedRect(fx - 3, fy - 3, fw + 6, fh + 6, 6);
  track.lineStyle(1, C.goldDim, 0.9).strokeRoundedRect(fx - 3, fy - 3, fw + 6, fh + 6, 6);
  const fill = add(scene.add.graphics().setDepth(D + 5));
  const spark = add(scene.add.image(fx, fy + fh / 2, glowTex(scene, 'spirit-glow', 64)).setDisplaySize(46, 46).setTint(0xc9a0ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(D + 6));
  const pct = add(scene.add.text(W / 2, fy + 26, '', { fontFamily: BODY, fontStyle: '600', fontSize: '15px', color: C.sub, resolution: 2 })
    .setOrigin(0.5, 0).setLetterSpacing(2).setShadow(0, 1, '#000000', 4, true, true).setDepth(D + 5));

  let want = 0.04, shown = 0, lifting = false, gone = false, t = 0;
  const draw = () => {
    fill.clear();
    const w = Math.max(fh, fw * shown);
    fill.fillStyle(0x7b3fc4, 1).fillRoundedRect(fx, fy, w, fh, fh / 2);
    fill.fillStyle(C.gold, 1).fillRoundedRect(fx + w * 0.55, fy, w * 0.45, fh, fh / 2); // (into gold toward its head)
    spark.setPosition(fx + w, fy + fh / 2).setAlpha(0.6 + 0.4 * Math.sin(t / 180));
    pct.setText(`Entering  ${Math.round(shown * 100)}%`);
  };
  const tick = (_t: number, ms: number) => {
    if (gone) return;
    t += ms;
    // eased toward where the way in is, creeping on a little while a stage takes its time (never stuck, never full early)
    const goal = lifting ? 1 : Math.min(0.97, want + Math.min(0.08, t / 60000));
    shown += (goal - shown) * Math.min(1, ms / (lifting ? 160 : 420));
    draw();
    if (lifting && shown > 0.995) finish();
  };
  const finish = () => {
    if (gone) return; gone = true;
    scene.events.off(Phaser.Scenes.Events.UPDATE, tick);
    scene.tweens.add({ targets: objs, alpha: 0, duration: 520, ease: 'Sine.easeIn', onComplete: () => { for (const o of objs) o.destroy(); } });
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { gone = true; scene.events.off(Phaser.Scenes.Events.UPDATE, tick); });
  // the preload: its files are the first half (the update runs only once the scene is created: the bar is drawn here)
  const onProgress = (p: number) => { want = Math.max(want, 0.04 + 0.46 * p); shown = Math.max(shown, want * 0.9); draw(); };
  load.on(Phaser.Loader.Events.PROGRESS, onProgress);
  load.once(Phaser.Loader.Events.COMPLETE, () => { load.off(Phaser.Loader.Events.PROGRESS, onProgress); want = Math.max(want, 0.5); showBg(); showLogo(); });
  // the night courtyard and the title: from the select (already here), else loaded with the rest
  if (!scene.textures.exists(BG.key)) load.image(BG.key, BG.file);
  if (!scene.textures.exists(SPIRIT_MENU.logo.key)) load.image(SPIRIT_MENU.logo.key, SPIRIT_MENU.logo.file);
  load.on(`filecomplete-image-${BG.key}`, showBg); load.on(`filecomplete-image-${SPIRIT_MENU.logo.key}`, showLogo);
  showBg(); showLogo(); draw();
  // (a way in that never ends — a body that failed to load — lifts after a while anyway)
  scene.time.delayedCall(16000, () => { lifting = true; });
  return { progress: (p) => { want = Math.max(want, p); }, lift: () => { lifting = true; } };
}
