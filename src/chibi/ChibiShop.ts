// THE CHIBI CASH SHOP (David 8 Nov, behind ?chibi: a real cash shop — special hats, face accessories, tops, bottoms,
// overalls, capes, shoes; the classic 2D MMO's cash shop as the idea; GPT's first collection). Opened from the world's
// Cosmetic Shop button / key (O) when the hero is the chibi: every item can be tried on the live preview, bought with a
// test balance (no real money), then worn or taken off — the hero in the world wears it at once.
import Phaser from 'phaser';
import { DESIGN } from '../config/layout';
import { ensureTheme } from '../ui/theme';
import { syncOverlay } from '../ui/CharacterSelectUI';
import { composeSpec, dollData } from './ChibiBody';
import { ChibiPreview } from './ChibiPreview';
import { ARCHER_SPEC, PRICE, SLOTS, SLOT_NAMES, saveShop, saveSpec, savedSpec, shopState, type LookSpec, type Slot } from './ChibiLooks';

const CSS = `
.gcs{position:absolute;left:0;top:0;width:${DESIGN.width}px;height:${DESIGN.height}px;transform-origin:0 0;font-family:var(--gl-body);color:var(--gl-text);pointer-events:none;user-select:none;-webkit-user-select:none;display:none}
.gcs.open{display:block}
.gcs *{box-sizing:border-box}
.gcs .dim{position:absolute;inset:0;background:rgba(4,8,14,.55);pointer-events:auto}
.gcs .win{position:absolute;left:200px;top:90px;width:1520px;height:900px;border-radius:24px;background:linear-gradient(180deg,#152139,#0d1526);border:1px solid rgba(231,196,124,.35);
  box-shadow:0 30px 70px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.05);pointer-events:auto}
.gcs .hd{position:absolute;left:36px;right:36px;top:24px;height:64px;display:flex;align-items:center;gap:18px}
.gcs .hd .t{font:700 32px var(--gl-title);letter-spacing:6px;color:#f3e3bd}
.gcs .hd .s{font:500 15px var(--gl-body);color:var(--gl-text2);flex:1}
.gcs .hd .gem{display:flex;align-items:center;gap:10px;padding:10px 18px;border-radius:999px;background:#0b1221;border:1px solid rgba(231,196,124,.35);font:700 19px var(--gl-body);color:var(--gl-gold2)}
.gcs .hd .gem small{font:500 12px var(--gl-body);color:var(--gl-text3);letter-spacing:.5px}
.gcs .hd .x{cursor:pointer;width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;font:400 28px var(--gl-body);color:var(--gl-text2);background:#0b1221;border:1px solid rgba(255,255,255,.1)}
.gcs .hd .x:hover{color:#fff;border-color:rgba(231,196,124,.5)}
.gcs .side{position:absolute;left:36px;top:104px;width:430px;bottom:30px;display:flex;flex-direction:column;gap:12px}
.gcs .stage{position:relative;height:470px;border-radius:18px;background:radial-gradient(90% 60% at 50% 45%,#27395c,#0f192b 75%);border:1px solid rgba(231,196,124,.22);overflow:hidden}
.gcs .stage canvas{position:absolute;left:5px;top:0;image-rendering:pixelated}
.gcs .stage .ped{position:absolute;left:115px;top:372px;width:200px;height:44px;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.5),rgba(0,0,0,0))}
.gcs .stage .bar{position:absolute;left:0;right:0;bottom:12px;display:flex;justify-content:center;gap:8px}
.gcs .tg{cursor:pointer;padding:6px 14px;border-radius:9px;background:rgba(10,16,28,.75);border:1px solid rgba(255,255,255,.12);font:600 13px var(--gl-body);color:var(--gl-text2)}
.gcs .tg.on{color:var(--gl-gold2);border-color:rgba(231,196,124,.5)}
.gcs .wearing{flex:1;border-radius:18px;background:rgba(8,13,24,.7);border:1px solid rgba(255,255,255,.07);padding:14px 18px;display:flex;flex-direction:column;gap:5px}
.gcs .wearing .lab{font:700 13px var(--gl-title);letter-spacing:2.5px;color:var(--gl-gold);margin-bottom:4px;display:flex;justify-content:space-between;align-items:center}
.gcs .wearing .lab span{cursor:pointer;font:600 12px var(--gl-body);letter-spacing:.3px;color:var(--gl-text2);padding:3px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.12)}
.gcs .wearing .lab span:hover{color:#fff}
.gcs .wr{display:flex;align-items:center;gap:10px;height:30px;font:500 14px var(--gl-body)}
.gcs .wr b{width:78px;font:600 12px var(--gl-body);letter-spacing:1px;color:var(--gl-text3);text-transform:uppercase}
.gcs .wr .v{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gcs .wr .v.try{color:#9fd3ff}
.gcs .wr .off{cursor:pointer;color:var(--gl-text3);font-size:15px;padding:0 6px}
.gcs .wr .off:hover{color:var(--gl-red)}
.gcs .main{position:absolute;left:496px;right:36px;top:104px;bottom:30px}
.gcs .tabs{display:flex;gap:8px;flex-wrap:wrap}
.gcs .tab{cursor:pointer;padding:11px 20px;border-radius:12px;background:#121c31;border:1px solid rgba(255,255,255,.08);font:700 15px var(--gl-body);letter-spacing:.6px;color:var(--gl-text2)}
.gcs .tab:hover{color:#fff}
.gcs .tab.on{background:linear-gradient(180deg,#3a2f1b,#251d10);border-color:var(--gl-gold);color:var(--gl-gold2)}
.gcs .grid{margin-top:18px;display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.gcs .card{position:relative;border-radius:18px;background:linear-gradient(180deg,#18243d,#111a2d);border:1px solid rgba(255,255,255,.08);padding:14px;display:flex;flex-direction:column;gap:10px;cursor:pointer;transition:transform 120ms,border-color 120ms}
.gcs .card:hover{transform:translateY(-2px);border-color:rgba(231,196,124,.45)}
.gcs .card.try{border-color:#7fb8ec;box-shadow:0 0 0 3px rgba(127,184,236,.18)}
.gcs .card.worn{border-color:var(--gl-gold);box-shadow:0 0 0 3px rgba(231,196,124,.18)}
.gcs .card .ic{height:250px;border-radius:12px;background:radial-gradient(80% 70% at 50% 45%,#22345a,#0e1729);display:flex;align-items:center;justify-content:center;overflow:hidden}
.gcs .card .ic canvas{image-rendering:pixelated}
.gcs .card .nm{font:700 17px var(--gl-body);color:#f3e3bd}
.gcs .card .row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.gcs .card .pr{font:700 16px var(--gl-body);color:var(--gl-gold2)}
.gcs .card .pr.own{color:var(--gl-green)}
.gcs .card .b{cursor:pointer;padding:9px 16px;border-radius:10px;font:700 14px var(--gl-body);letter-spacing:.5px;border:1px solid rgba(231,196,124,.5);background:linear-gradient(180deg,#f2d38e,#c99a4b);color:#2a1a06}
.gcs .card .b.ghost{background:#0e1729;color:var(--gl-text);border-color:rgba(255,255,255,.18)}
.gcs .card .b:disabled{opacity:.45;cursor:default}
.gcs .card .new{position:absolute;left:24px;top:24px;padding:3px 9px;border-radius:7px;background:#e86a6a;color:#fff;font:800 11px var(--gl-body);letter-spacing:1px}
.gcs .msg{position:absolute;right:36px;bottom:30px;font:600 14px var(--gl-body);color:var(--gl-text2)}
`;

const TAB_NAMES: Record<Slot, string> = { hat: 'Hats', face: 'Face', top: 'Tops', bottom: 'Bottoms', overall: 'Overalls', cape: 'Capes', shoes: 'Shoes' };
/** Where each slot's picture is cut from a frame (frame px x, y, w, h) and how big it is drawn. */
const BODY: [number, number, number, number, number] = [16, 22, 64, 70, 3.5];
const CROP: Record<Slot, [number, number, number, number, number]> = {
  hat: [16, 6, 58, 50, 5], face: [36, 34, 32, 26, 9], top: BODY, bottom: BODY, overall: BODY, cape: BODY, shoes: [26, 64, 46, 28, 6.5],
};

export class ChibiShop {
  private root: HTMLDivElement;
  private preview: ChibiPreview;
  private tab: Slot = 'hat';
  private tries: Partial<Record<Slot, string>> = {};
  private grid!: HTMLDivElement;
  private wearing!: HTMLDivElement;
  private gemEl!: HTMLElement;
  private msg!: HTMLElement;
  private rect = '';
  private icons = new Map<string, HTMLCanvasElement>();
  private readonly onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'o' || e.key === 'O') { e.preventDefault(); e.stopPropagation(); this.close(); } };

  constructor(private scene: Phaser.Scene, private cls: string, private h: { onOpen: (open: boolean) => void }) {
    ensureTheme();
    if (!document.getElementById('gol-chibi-shop')) { const st = document.createElement('style'); st.id = 'gol-chibi-shop'; st.textContent = CSS; document.head.appendChild(st); }
    const host = scene.game.canvas.parentElement!;
    this.root = this.el('div', 'gcs', host);
    this.el('div', 'dim', this.root).onclick = () => this.close();
    const win = this.el('div', 'win', this.root);
    const hd = this.el('div', 'hd', win);
    this.el('div', 't', hd, 'CASH SHOP');
    this.el('div', 's', hd, 'The first collection — try anything on, buy with your test gems, wear it in the world.');
    const gem = this.el('div', 'gem', hd); this.gemEl = this.el('span', '', gem); this.el('small', '', gem, 'TEST GEMS');
    this.el('div', 'x', hd, '×').onclick = () => this.close();
    const side = this.el('div', 'side', win);
    const stage = this.el('div', 'stage', side);
    this.el('div', 'ped', stage);
    this.preview = new ChibiPreview(420, 470, 5, [215, 392]);
    stage.appendChild(this.preview.canvas);
    const bar = this.el('div', 'bar', stage);
    const tI = this.el('div', 'tg on', bar, 'Idle'), tW = this.el('div', 'tg', bar, 'Walk'), tT = this.el('div', 'tg', bar, 'Turn');
    tI.onclick = () => { this.preview.mode = 'idle'; tI.classList.add('on'); tW.classList.remove('on'); };
    tW.onclick = () => { this.preview.mode = 'walk'; tW.classList.add('on'); tI.classList.remove('on'); };
    tT.onclick = () => { this.preview.flip = !this.preview.flip; };
    this.wearing = this.el('div', 'wearing', side);
    const main = this.el('div', 'main', win);
    const tabs = this.el('div', 'tabs', main);
    const tabEls = SLOTS.map((s) => {
      const t = this.el('div', 'tab', tabs, TAB_NAMES[s]);
      t.onclick = () => { this.tab = s; tabEls.forEach((e, i) => e.classList.toggle('on', SLOTS[i] === s)); this.renderGrid(); };
      return t;
    });
    tabEls[0].classList.add('on');
    this.grid = this.el('div', 'grid', main);
    this.msg = this.el('div', 'msg', win);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.sync, this);
  }

  private sync(): void { if (this.isOpen) this.rect = syncOverlay(this.root, this.scene.game.canvas.parentElement!, this.scene.game.canvas, this.rect); }
  private el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; parent.appendChild(e); return e;
  }
  private cat() { return dollData(this.scene, this.cls)?.looks?.catalog; }
  private saved(): LookSpec { return savedSpec(this.cls) ?? { ...ARCHER_SPEC, equip: {} }; }
  /** The equips with one item put on (an overall takes the top's and the bottom's place, and the other way round). */
  private withItem(eq: Partial<Record<Slot, string>>, slot: Slot, id: string | undefined): Partial<Record<Slot, string>> {
    const e = { ...eq };
    if (id === undefined) { delete e[slot]; return e; }
    e[slot] = id;
    if (slot === 'overall') { delete e.top; delete e.bottom; }
    if (slot === 'top' || slot === 'bottom') delete e.overall;
    return e;
  }
  private previewSpec(): LookSpec {
    const s = this.saved();
    let eq = { ...s.equip };
    for (const slot of SLOTS) if (this.tries[slot]) eq = this.withItem(eq, slot, this.tries[slot]);
    return { ...s, equip: eq };
  }

  get isOpen(): boolean { return this.root.classList.contains('open'); }
  toggle(): void { if (this.isOpen) this.close(); else this.open(); }
  open(): void {
    if (this.isOpen || !this.cat()) return;
    this.tries = {}; this.msg.textContent = '';
    this.root.classList.add('open'); this.rect = '';
    this.sync();
    window.addEventListener('keydown', this.onEsc, true);
    this.refresh(); this.h.onOpen(true);
  }
  close(): void {
    if (!this.isOpen) return;
    this.root.classList.remove('open');
    window.removeEventListener('keydown', this.onEsc, true);
    this.h.onOpen(false);
  }
  destroy(): void {
    window.removeEventListener('keydown', this.onEsc, true);
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.sync, this);
    this.preview.destroy(); this.root.remove();
    for (const k of [`chibi-${this.cls}-shop`]) if (this.scene.textures.exists(k)) this.scene.textures.remove(k);
  }

  private refresh(): void {
    const key = `chibi-${this.cls}-shop`;
    const anims = composeSpec(this.scene, this.cls, this.previewSpec(), key);
    if (anims) this.preview.set(this.scene, key, anims);
    this.gemEl.textContent = `◆ ${shopState(this.cls).gems.toLocaleString('en-US')}`;
    this.renderWearing(); this.renderGrid();
  }

  private name(slot: Slot, id?: string): string { return (id && this.cat()?.shop[slot]?.find((x) => x[0] === id)?.[1]) || ''; }

  private renderWearing(): void {
    const w = this.wearing; w.textContent = '';
    const lab = this.el('div', 'lab', w, 'WEARING');
    if (Object.keys(this.tries).length) { const r = this.el('span', '', lab, 'Clear try-on'); r.onclick = () => { this.tries = {}; this.refresh(); }; }
    const sv = this.saved(), pv = this.previewSpec();
    for (const slot of SLOTS) {
      const row = this.el('div', 'wr', w);
      this.el('b', '', row, SLOT_NAMES[slot]);
      const id = pv.equip[slot], trying = !!this.tries[slot] && this.tries[slot] === id && sv.equip[slot] !== id;
      this.el('div', `v${trying ? ' try' : ''}`, row, id ? `${this.name(slot, id)}${trying ? '  (trying on)' : ''}` : '—');
      if (id) {
        const off = this.el('span', 'off', row, '✕'); off.title = trying ? 'Stop trying on' : 'Take off';
        off.onclick = () => {
          if (trying) delete this.tries[slot];
          else { delete this.tries[slot]; const s = this.saved(); saveSpec(this.cls, { ...s, equip: this.withItem(s.equip, slot, undefined) }); }
          this.refresh();
        };
      }
    }
  }

  private renderGrid(): void {
    const cat = this.cat(); if (!cat) return;
    this.grid.textContent = '';
    const st = shopState(this.cls), sv = this.saved(), pv = this.previewSpec();
    for (const [id, name] of cat.shop[this.tab] ?? []) {
      const owned = st.owned.includes(id), worn = sv.equip[this.tab] === id, trying = pv.equip[this.tab] === id && !worn;
      const card = this.el('div', `card${worn ? ' worn' : trying ? ' try' : ''}`, this.grid);
      if (!owned) this.el('div', 'new', card, 'NEW');
      const ic = this.el('div', 'ic', card);
      ic.appendChild(this.icon(this.tab, id));
      this.el('div', 'nm', card, name);
      const row = this.el('div', 'row', card);
      this.el('div', `pr${owned ? ' own' : ''}`, row, owned ? (worn ? 'Owned · worn' : 'Owned') : `◆ ${PRICE[this.tab].toLocaleString('en-US')}`);
      const btn = this.el('button', `b${owned && worn ? ' ghost' : ''}`, row, owned ? (worn ? 'Take off' : 'Wear') : 'Buy');
      if (!owned && st.gems < PRICE[this.tab]) btn.disabled = true;
      btn.onclick = (e) => {
        e.stopPropagation();
        const s = this.saved();
        if (!owned) {
          const sh = shopState(this.cls);
          if (sh.gems < PRICE[this.tab]) { this.msg.textContent = 'Not enough gems.'; return; }
          sh.gems -= PRICE[this.tab]; sh.owned.push(id); saveShop(this.cls, sh);
          saveSpec(this.cls, { ...s, equip: this.withItem(s.equip, this.tab, id) });
          this.msg.textContent = `${name} — bought and worn.`;
        } else if (worn) { saveSpec(this.cls, { ...s, equip: this.withItem(s.equip, this.tab, undefined) }); this.msg.textContent = `${name} — taken off.`; }
        else { saveSpec(this.cls, { ...s, equip: this.withItem(s.equip, this.tab, id) }); this.msg.textContent = `${name} — worn.`; }
        delete this.tries[this.tab];
        this.refresh();
      };
      card.onclick = () => { if (this.tries[this.tab] === id) delete this.tries[this.tab]; else this.tries[this.tab] = id; this.refresh(); };
    }
  }

  /** The item on the character (the look as worn, with this item), cut to the slot's part of the frame. */
  private icon(slot: Slot, id: string): HTMLCanvasElement {
    const sv = this.saved(), sig = `${slot}:${id}:${JSON.stringify(sv)}`;
    const have = this.icons.get(sig);
    if (have) return have;
    const [x, y, w, h, s] = CROP[slot];
    const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
    const key = `chibi-${this.cls}-icon`;
    const spec: LookSpec = { ...sv, equip: this.withItem(sv.equip, slot, id) };
    const anims = composeSpec(this.scene, this.cls, spec, key, ['idle'], { nobow: true });
    if (anims) {
      const tex = this.scene.textures.get(key), fr = tex.get(anims.idle.frames[0]);
      const ctx = c.getContext('2d')!; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tex.getSourceImage() as CanvasImageSource, fr.cutX + x, fr.cutY + y, w, h, 0, 0, c.width, c.height);
      this.scene.textures.remove(key);
    }
    this.icons.set(sig, c);
    return c;
  }
}
