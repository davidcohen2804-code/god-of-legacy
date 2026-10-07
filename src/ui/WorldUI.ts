// Open-world UI (DOM, 1920x1080 design px inside the HUD overlay):
//   NpcDialog  — MapleStory-style NPC chat: portrait in the round frame, name on the gold plaque, the line typed out,
//                NEXT, then the page's choices (a quest: ACCEPT / NOT YET …); talk key: next / first choice, Esc: close
//   AreaTitle  — the area's name fading in at the top when you walk into it
import { FONT_FAMILY, HUD } from '../config/layout';

const K = (f: string) => `assets/final/ui/kit/${f}.png`;
const STYLE_ID = 'gol-world-style';
/** dialog_box.png (1407x373) shown 1100 wide: round portrait frame, gold name plaque, text panel (art px → design). */
const DS = 1100 / 1407, d = (v: number) => Math.round(v * DS);
const DLG = { x: 410, y: 610, w: 1100, h: d(373) };

const CSS = `
.gol-dlg{position:absolute;left:${DLG.x}px;top:${DLG.y}px;width:${DLG.w}px;height:${DLG.h}px;display:none;pointer-events:auto;
  background:url("${K('dialog_box')}") 0 0/100% 100% no-repeat;filter:drop-shadow(0 10px 22px rgba(0,0,0,.6));font-family:${HUD.bodyFont}}
.gol-dlg.open{display:block;animation:golDlgIn .18s ease-out}
@keyframes golDlgIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.gol-dlg .pt{position:absolute;left:${d(58)}px;top:${d(84)}px;width:${d(256)}px;height:${d(256)}px;border-radius:50%;overflow:hidden;
  background:radial-gradient(circle at 50% 35%,#2a3f6e,#0b1428 70%)}
.gol-dlg .pt img{position:absolute;left:6%;top:4%;width:88%;height:88%;object-fit:contain}
.gol-dlg .nm{position:absolute;left:${d(48)}px;top:${d(24)}px;width:${d(282)}px;height:${d(60)}px;display:flex;align-items:center;justify-content:center;
  font:700 17px ${FONT_FAMILY};letter-spacing:1px;color:#2d1d06;text-shadow:0 1px 0 rgba(255,240,200,.6);white-space:nowrap;overflow:hidden}
.gol-dlg .tt{position:absolute;left:${d(392)}px;top:${d(106)}px;font:700 15px ${FONT_FAMILY};letter-spacing:2px;color:#e8b45f;text-shadow:0 1px 2px #000;text-transform:uppercase}
.gol-dlg .tx{position:absolute;left:${d(392)}px;top:${d(140)}px;width:${d(930)}px;height:${d(96)}px;font-size:19px;line-height:27px;color:#f1e8d3;text-shadow:0 1px 2px #000}
.gol-dlg .bt{position:absolute;right:${d(78)}px;bottom:${d(84)}px;display:flex;gap:12px}
.gol-dlg .bt button{height:48px;padding:0 32px;border:0;background:url("${K('pill_normal')}") center/100% 100% no-repeat;color:#efddb0;
  font:700 15px ${FONT_FAMILY};letter-spacing:1.5px;cursor:pointer;text-shadow:0 1px 2px #000;white-space:nowrap}
.gol-dlg .bt button:hover{background-image:url("${K('pill_hover')}");color:#fff3cf}
.gol-dlg .bt button.main{color:#ffe08a}
.gol-dlg .bt button i{font-style:normal;color:#e8b45f;margin-left:9px;font-size:13px}
.gol-area{position:absolute;left:0;right:0;top:118px;text-align:center;pointer-events:none;opacity:0;transition:opacity .6s}
.gol-area.on{opacity:1}
.gol-area b{display:block;font:700 40px ${FONT_FAMILY};letter-spacing:7px;color:#f8e3a6;text-shadow:0 3px 8px #000,0 0 18px rgba(0,0,0,.6)}
.gol-area i{display:block;width:360px;height:2px;margin:10px auto 0;background:linear-gradient(90deg,transparent,#e8b45f,transparent)}
`;
function style(): void { if (!document.getElementById(STYLE_ID)) { const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st); } }
const el = <T extends keyof HTMLElementTagNameMap>(tag: T, cls: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[T] => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; parent?.appendChild(e); return e;
};

export interface DialogChoice { label: string; run: () => void; main?: boolean }
/** One conversation: the NPC's lines one after another; the last page shows `choices` (none = CLOSE). */
export interface DialogScript { name: string; title: string; portrait: string; lines: string[]; choices?: DialogChoice[] }

export class NpcDialog {
  private root: HTMLDivElement;
  private img: HTMLImageElement;
  private nm: HTMLDivElement;
  private tt: HTMLDivElement;
  private tx: HTMLDivElement;
  private bt: HTMLDivElement;
  private sc: DialogScript | null = null;
  private page = 0;
  private shown = 0;
  private timer = 0;
  talkKey = 'Y';
  constructor(parent: HTMLElement, private onClose: () => void) {
    style();
    this.root = el('div', 'gol-dlg', parent);
    const pt = el('div', 'pt', this.root); this.img = el('img', '', pt); this.img.alt = '';
    this.nm = el('div', 'nm', this.root); this.tt = el('div', 'tt', this.root); this.tx = el('div', 'tx', this.root);
    this.bt = el('div', 'bt', this.root);
  }
  get isOpen(): boolean { return this.root.classList.contains('open'); }
  open(sc: DialogScript): void {
    this.sc = sc; this.page = 0;
    this.img.src = sc.portrait; this.nm.textContent = sc.name; this.tt.textContent = sc.title;
    this.root.classList.add('open');
    this.showPage();
  }
  close(): void { if (!this.isOpen) return; this.root.classList.remove('open'); window.clearInterval(this.timer); this.sc = null; this.onClose(); }
  /** Talk key: finish the line being typed, else the next line, else the first (main) choice, else close. */
  advance(): void {
    const sc = this.sc; if (!sc) return;
    const line = sc.lines[this.page] ?? '';
    if (this.shown < line.length) { this.shown = line.length; this.tx.textContent = line; return; }
    if (this.page < sc.lines.length - 1) { this.page++; this.showPage(); return; }
    const main = sc.choices?.find((c) => c.main) ?? sc.choices?.[0];
    if (main) { this.close(); main.run(); } else this.close();
  }
  private showPage(): void {
    const sc = this.sc!; const line = sc.lines[this.page] ?? '';
    this.shown = 0; this.tx.textContent = '';
    window.clearInterval(this.timer);
    const t0 = performance.now(); // typed out at ~90 characters a second (real time: a busy frame never slows it)
    this.timer = window.setInterval(() => { this.shown = Math.min(line.length, Math.max(this.shown, Math.floor((performance.now() - t0) * 0.09))); this.tx.textContent = line.slice(0, this.shown); if (this.shown >= line.length) window.clearInterval(this.timer); }, 22);
    this.bt.replaceChildren();
    const b = (label: string, fn: () => void, main = false, key = '') => { const x = el('button', main ? 'main' : '', this.bt, label); x.type = 'button'; if (key) el('i', '', x, key); x.addEventListener('click', fn); };
    if (this.page < sc.lines.length - 1) { b('NEXT', () => this.advance(), true, this.talkKey); b('CLOSE', () => this.close(), false, 'ESC'); return; }
    if (!sc.choices?.length) { b('CLOSE', () => this.close(), true, this.talkKey); return; }
    sc.choices.forEach((c, i) => b(c.label.toUpperCase(), () => { this.close(); c.run(); }, !!c.main || (i === 0 && !sc.choices!.some((x) => x.main)), c.main || (i === 0 && !sc.choices!.some((x) => x.main)) ? this.talkKey : ''));
  }
  destroy(): void { window.clearInterval(this.timer); this.root.remove(); }
}

export class AreaTitle {
  private root: HTMLDivElement;
  private name: HTMLElement;
  private t = 0;
  constructor(parent: HTMLElement) {
    style();
    this.root = el('div', 'gol-area', parent);
    this.name = el('b', '', this.root); el('i', '', this.root);
  }
  show(name: string): void {
    this.name.textContent = name.toUpperCase();
    this.root.classList.add('on');
    window.clearTimeout(this.t); this.t = window.setTimeout(() => this.root.classList.remove('on'), 2400);
  }
  destroy(): void { window.clearTimeout(this.t); this.root.remove(); }
}
