// THE CHIBI CHARACTER CREATION (David 8 Nov, behind ?chibi: choose the Archer, then make the character — the base body
// with a first bow, then hair styles, eyes, skin, a first outfit, a first bow; GPT's art direction). START → Archer →
// ENTER WORLD opens it (with the look chosen before, if any); ENTER WORLD here keeps the look in this browser and goes on
// to the world, where the hero wears it.
import Phaser from 'phaser';
import { DESIGN } from '../config/layout';
import { ensureTheme } from '../ui/theme';
import { syncOverlay } from '../ui/CharacterSelectUI';
import { composeSpec, dollData, loadDoll } from './ChibiBody';
import { ChibiPreview } from './ChibiPreview';
import { NEW_SPEC, saveSpec, savedSpec, type LookSpec } from './ChibiLooks';

const CSS = `
.gc{position:absolute;left:0;top:0;width:${DESIGN.width}px;height:${DESIGN.height}px;transform-origin:0 0;font-family:var(--gl-body);color:var(--gl-text);user-select:none;-webkit-user-select:none}
.gc *{box-sizing:border-box}
.gc .ttl{position:absolute;left:0;right:0;top:40px;text-align:center;font:700 40px var(--gl-title);letter-spacing:6px;color:#f3e3bd;text-shadow:0 3px 10px rgba(0,0,0,.7)}
.gc .sub{position:absolute;left:0;right:0;top:98px;text-align:center;font:500 16px var(--gl-body);color:var(--gl-text2)}
.gc .stage{position:absolute;left:150px;top:150px;width:700px;height:790px;border-radius:22px;background:radial-gradient(90% 60% at 50% 42%,#26385a,#101a2c 72%);
  border:1px solid rgba(231,196,124,.28);box-shadow:0 18px 40px rgba(0,0,0,.45);overflow:hidden}
.gc .stage .ped{position:absolute;left:180px;top:618px;width:340px;height:74px;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.55),rgba(0,0,0,0));}
.gc .stage .ring{position:absolute;left:150px;top:600px;width:400px;height:110px;border-radius:50%;border:1.5px solid rgba(231,196,124,.35)}
.gc .stage canvas{position:absolute;left:30px;top:20px;image-rendering:pixelated}
.gc .stage .bar{position:absolute;left:0;right:0;bottom:22px;display:flex;justify-content:center;gap:12px}
.gc .opts{position:absolute;left:910px;top:150px;width:860px;height:790px;border-radius:22px;background:rgba(12,19,32,.93);border:1px solid rgba(231,196,124,.22);
  box-shadow:0 18px 40px rgba(0,0,0,.45);padding:26px 34px;display:flex;flex-direction:column;gap:18px}
.gc .grp .lab{font:700 15px var(--gl-title);letter-spacing:2.5px;color:var(--gl-gold);text-transform:uppercase;margin-bottom:10px;display:flex;justify-content:space-between}
.gc .grp .lab i{font:500 14px var(--gl-body);letter-spacing:.3px;color:var(--gl-text2);font-style:normal;text-transform:none}
.gc .row{display:flex;flex-wrap:wrap;gap:10px}
.gc .pill{cursor:pointer;padding:10px 18px;border-radius:999px;background:#18233a;border:1px solid rgba(255,255,255,.1);font:600 15px var(--gl-body);color:var(--gl-text);transition:transform 120ms,border-color 120ms,background 120ms}
.gc .pill:hover{border-color:rgba(231,196,124,.5);transform:translateY(-1px)}
.gc .pill.on{background:linear-gradient(180deg,#3a2f1b,#251d10);border-color:var(--gl-gold);color:var(--gl-gold2);box-shadow:0 0 0 3px rgba(231,196,124,.15)}
.gc .sw{cursor:pointer;width:44px;height:44px;border-radius:50%;border:2px solid rgba(255,255,255,.18);box-shadow:inset 0 -6px 10px rgba(0,0,0,.25);transition:transform 120ms}
.gc .sw:hover{transform:scale(1.08)}
.gc .sw.on{border-color:var(--gl-gold2);box-shadow:0 0 0 3px rgba(231,196,124,.35),inset 0 -6px 10px rgba(0,0,0,.25)}
.gc .btn{cursor:pointer;position:absolute;top:968px;height:64px;padding:0 44px;display:flex;align-items:center;justify-content:center;border-radius:14px;font:700 20px var(--gl-title);letter-spacing:3px;border:1px solid rgba(231,196,124,.45);
  background:linear-gradient(180deg,#1e2a43,#121b2d);color:#f3e3bd;box-shadow:0 10px 24px rgba(0,0,0,.4);transition:transform 120ms,filter 120ms}
.gc .btn:hover{transform:translateY(-1px);filter:brightness(1.12)}
.gc .btn.go{background:linear-gradient(180deg,#f2d38e,#c99a4b);color:#2a1a06;border-color:#f6dfa6}
.gc .tg{cursor:pointer;padding:8px 16px;border-radius:10px;background:rgba(10,16,28,.75);border:1px solid rgba(255,255,255,.12);font:600 14px var(--gl-body);color:var(--gl-text2)}
.gc .tg.on{color:var(--gl-gold2);border-color:rgba(231,196,124,.5)}
`;

export class ChibiCreateScene extends Phaser.Scene {
  private root?: HTMLDivElement;
  private preview?: ChibiPreview;
  private spec: LookSpec = { ...NEW_SPEC, equip: {} };
  private cls = 'archer';
  private rect = '';
  private n = 0;

  constructor() { super('ChibiCreateScene'); }

  init(data: { cls?: string }): void { this.cls = data?.cls ?? 'archer'; }

  preload(): void { loadDoll(this, this.cls); }

  create(): void {
    const saved = savedSpec(this.cls);
    this.spec = saved ? { ...saved, equip: { ...saved.equip } } : { ...NEW_SPEC, equip: {} };
    this.cameras.main.fadeIn(240, 0, 0, 0);
    if (this.textures.exists('characterSelect.background')) {
      const bg = this.add.image(DESIGN.width / 2, DESIGN.height / 2, 'characterSelect.background');
      bg.setScale(Math.max(DESIGN.width / bg.width, DESIGN.height / bg.height)).setTint(0x9aa6bd);
    }
    ensureTheme();
    if (!document.getElementById('gol-chibi-create')) { const st = document.createElement('style'); st.id = 'gol-chibi-create'; st.textContent = CSS; document.head.appendChild(st); }
    const host = this.game.canvas.parentElement!;
    const root = this.root = document.createElement('div');
    root.className = 'gc';
    host.appendChild(root);
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, text?: string) => {
      const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; parent.appendChild(e); return e;
    };
    el('div', 'ttl', root, 'CREATE YOUR ARCHER');
    el('div', 'sub', root, 'Your look, your first outfit and your first bow — more clothes wait in the Cash Shop.');
    const stage = el('div', 'stage', root);
    el('div', 'ring', stage); el('div', 'ped', stage);
    const pv = this.preview = new ChibiPreview(640, 700, 7, [320, 628]);
    stage.appendChild(pv.canvas);
    const bar = el('div', 'bar', stage);
    const tIdle = el('div', 'tg on', bar, 'Idle'), tWalk = el('div', 'tg', bar, 'Walk'), tTurn = el('div', 'tg', bar, 'Turn');
    tIdle.onclick = () => { pv.mode = 'idle'; tIdle.classList.add('on'); tWalk.classList.remove('on'); };
    tWalk.onclick = () => { pv.mode = 'walk'; tWalk.classList.add('on'); tIdle.classList.remove('on'); };
    tTurn.onclick = () => { pv.flip = !pv.flip; };

    const opts = el('div', 'opts', root);
    const cat = dollData(this, this.cls)?.looks?.catalog;
    if (!cat) { el('div', 'grp', opts, 'The looks are still loading…'); return; }
    const group = (label: string, note = '') => {
      const g = el('div', 'grp', opts), lab = el('div', 'lab', g, label), i = el('i', '', lab, note);
      return { row: el('div', 'row', g), note: i };
    };
    const pills = (label: string, items: [string, string][], key: keyof Omit<LookSpec, 'equip'>) => {
      const { row } = group(label);
      const els = items.map(([id, name]) => {
        const p = el('div', 'pill', row, name);
        p.onclick = () => { this.spec[key] = id; els.forEach((e, k) => e.classList.toggle('on', items[k][0] === id)); this.recompose(); };
        p.classList.toggle('on', this.spec[key] === id);
        return p;
      });
    };
    const swatches = (label: string, items: [string, string, string][], key: keyof Omit<LookSpec, 'equip'>) => {
      const { row, note } = group(label);
      const name = () => { note.textContent = items.find((x) => x[0] === this.spec[key])?.[1] ?? ''; };
      const els = items.map(([id, nm, hex]) => {
        const s = el('div', 'sw', row); s.style.background = hex; s.title = nm;
        s.onclick = () => { this.spec[key] = id; els.forEach((e, k) => e.classList.toggle('on', items[k][0] === id)); name(); this.recompose(); };
        s.classList.toggle('on', this.spec[key] === id);
        return s;
      });
      name();
    };
    pills('Hair style', cat.hairStyles, 'hair');
    swatches('Hair colour', cat.hairColours.map(([id, n, m]) => [id, n, m.H]), 'hairColour');
    pills('Eyes', cat.eyes, 'eyes');
    swatches('Skin', cat.skins.map(([id, n, m]) => [id, n, m.S]), 'skin');
    pills('First outfit', [...cat.outfits.map(([id, n]) => [id, n] as [string, string]), ['archer', 'Archer Kit']], 'outfit');
    pills('First bow', cat.bows.filter(([id]) => id !== 'hunter').map(([id, n]) => [id, n] as [string, string]).concat([['hunter', "Hunter's Bow"]]), 'bow');

    const back = el('div', 'btn', root, 'BACK'); back.style.left = '150px';
    back.onclick = () => this.scene.start('CharacterSelectScene');
    const go = el('div', 'btn go', root, 'ENTER WORLD'); go.style.right = `${DESIGN.width - 1770}px`;
    go.onclick = () => { saveSpec(this.cls, this.spec); this.scene.start('LegacyCourtyardScene', { pvpRoom: null }); };
    this.recompose();
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => { if (this.root) this.rect = syncOverlay(this.root, host, this.game.canvas, this.rect); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE);
      this.preview?.destroy(); this.preview = undefined;
      this.root?.remove(); this.root = undefined;
    });
  }

  private recompose(): void {
    const key = `chibi-${this.cls}-create`;
    const anims = composeSpec(this, this.cls, this.spec, key);
    if (anims) this.preview?.set(this, key, anims);
    this.n++;
  }
}
