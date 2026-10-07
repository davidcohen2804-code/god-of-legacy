// Speech bubbles over the speakers' heads (MapleStory style): parchment balloon (kit nine-slice) + tail, the line wrapped
// inside, a few seconds then a fade. One bubble per speaker; a new line replaces the old one.
import Phaser from 'phaser';
import { HUD } from '../config/layout';

const S = 0.28; // kit art px -> world px (rim ~11 px)
const SLICE = { l: 40, r: 40, t: 34, b: 34 }; // bubble_light.png (344x143) borders
const PAD = { x: 22, y: 15 }; // text keeps clear of the gold rim (rim + ~10 px air)
const GAP = 7; // air between the tail tip and the top of the head (world px)
const TAIL = { w: 20, h: 13 };

interface Bubble { box: Phaser.GameObjects.Container; until: number; born: number }

export class SpeechBubbles {
  private list = new Map<string, Bubble>();

  constructor(private scene: Phaser.Scene) {}

  /** Show `text` over speaker `id` (its position comes from update's posOf). */
  say(id: string, text: string, now: number): void {
    this.list.get(id)?.box.destroy();
    const sc = this.scene;
    if (!sc.textures.exists('kit.bubble_light')) return;
    const t = sc.add.text(0, 0, text, {
      fontFamily: HUD.bodyFont, fontSize: '15px', color: '#2b1d0a', align: 'center',
      wordWrap: { width: 220, useAdvancedWrap: true }, maxLines: 4, resolution: 2,
    }).setOrigin(0.5, 1);
    const w = Math.max(64, t.width + PAD.x * 2), h = t.height + PAD.y * 2;
    const box = sc.add.container(0, 0).setDepth(1e6);
    // Container origin = the tail tip: tail above it, the balloon above the tail (tail overlaps the rim by 3 px).
    const bottom = -(TAIL.h - 3);
    const bg = sc.add.nineslice(0, bottom, 'kit.bubble_light', undefined, w / S, h / S, SLICE.l, SLICE.r, SLICE.t, SLICE.b).setOrigin(0.5, 1).setScale(S);
    const tail = sc.add.image(0, 0, 'kit.tail_light').setOrigin(0.5, 1).setDisplaySize(TAIL.w, TAIL.h);
    t.setPosition(0, bottom - PAD.y + 1);
    box.add([tail, bg, t]);
    const life = Math.min(8000, 4000 + text.length * 60);
    this.list.set(id, { box, until: now + life, born: now });
  }

  /** An emote sticker over the speaker's head (replaces its bubble) for 3 s. */
  emote(id: string, n: number, now: number): void {
    this.list.get(id)?.box.destroy();
    const key = `kit.emote_${n}`;
    if (!this.scene.textures.exists(key)) return;
    const box = this.scene.add.container(0, 0).setDepth(1e6);
    box.add(this.scene.add.image(0, 0, key).setOrigin(0.5, 1).setDisplaySize(48, 48));
    this.list.set(id, { box, until: now + 3000, born: now });
  }

  /** Follow the speakers; fade and drop finished bubbles (and those whose speaker is gone). */
  update(now: number, posOf: (id: string) => { x: number; y: number; z: number; head: number } | null): void {
    for (const [id, b] of this.list) {
      const p = posOf(id);
      if (!p || now >= b.until) { b.box.destroy(); this.list.delete(id); continue; }
      const pop = Math.min(1, (now - b.born) / 120);
      b.box.setPosition(Math.round(p.x), Math.round(p.y - p.z - p.head - GAP)).setAlpha(Math.min(1, (b.until - now) / 300)).setScale(0.85 + 0.15 * pop);
    }
  }

  clear(id: string): void { this.list.get(id)?.box.destroy(); this.list.delete(id); }

  destroy(): void { for (const b of this.list.values()) b.box.destroy(); this.list.clear(); }
}
