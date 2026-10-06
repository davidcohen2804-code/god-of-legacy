// Chat box (bottom-left, MapleStory style): channel tabs, message log, typing row and send button.
// DOM inside the HUD overlay (1920x1080 design px). Enter opens the typing row, Enter sends, Esc closes;
// while typing every key stays in the chat (the game never sees it).
import { FONT_FAMILY, HUD } from '../config/layout';

export type ChatKind = 'all' | 'party' | 'whisper' | 'system';
export interface ChatLine { kind: ChatKind; text: string; name?: string; me?: boolean; to?: string }

const K = (f: string) => `assets/final/ui/kit/${f}.png`;
const TABS: [ChatKind, string][] = [['all', 'ALL'], ['party', 'PARTY'], ['whisper', 'WHISPER'], ['system', 'SYSTEM']];
export const CHAT_MAX_LEN = 120;
/** Emote stickers (kit emote_0..7: happy, laugh, love, angry, sad, surprised, cool, embarrassed). */
export const EMOTES = 8;
const MAX_LINES = 120;
/** Layout (design px): tabs row, log frame, typing row. */
const L = { x: 16, y: 792, w: 364, tabW: 84, tabH: 30, logY: 826, logH: 176, inY: 1008, inH: 36, send: 40 };
/** chat_frame_log.png (1390x407) nine-slice: art insets and the same scale as the width (gems keep their shape). */
const F = { k: L.w / 1390, t: 115, r: 112, b: 112, l: 112 };
const COLOR: Record<ChatKind, string> = { all: '#ffffff', party: '#ffb35c', whisper: '#ff9be0', system: '#ffd76e' };
const STYLE_ID = 'gol-chat-style';

const CSS = `
.gol-chat{position:absolute;left:${L.x}px;top:${L.y}px;width:${L.w}px;height:${L.inY + L.inH - L.y}px;pointer-events:none;font-family:${HUD.bodyFont}}
.gol-chat .tabs{position:absolute;left:0;top:0;display:flex;gap:4px}
.gol-chat .tab{width:${L.tabW}px;height:${L.tabH}px;padding:0;border:0;background:url("${K('chat_tab')}") center/100% 100% no-repeat;
  color:#d9c8a0;font:700 10px ${FONT_FAMILY};letter-spacing:.5px;padding:0 12px;pointer-events:auto;cursor:pointer;text-shadow:0 1px 2px #000}
.gol-chat .tab.on{background-image:url("${K('chat_tab_sel')}");color:#ffe9a8}
.gol-chat .tab .n{display:none;margin-left:3px;color:#ff9be0}
.gol-chat .tab.new .n{display:inline}
.gol-chat .log{position:absolute;left:0;top:${L.logY - L.y}px;width:${L.w}px;height:${L.logH}px;box-sizing:border-box;
  border-style:solid;border-width:${Math.round(F.t * F.k)}px ${Math.round(F.r * F.k)}px ${Math.round(F.b * F.k)}px ${Math.round(F.l * F.k)}px;
  border-image:url("${K('chat_frame_log')}") ${F.t} ${F.r} ${F.b} ${F.l} fill / ${Math.round(F.t * F.k)}px ${Math.round(F.r * F.k)}px ${Math.round(F.b * F.k)}px ${Math.round(F.l * F.k)}px stretch}
.gol-chat .fill{position:absolute;left:10px;top:${L.logY - L.y + 17}px;width:${L.w - 20}px;height:${L.logH - 28}px;background:rgba(5,9,18,.58);border-radius:3px}
.gol-chat .lines{position:absolute;left:24px;top:${L.logY - L.y + 26}px;width:${L.w - 44}px;height:${L.logH - 48}px;padding-right:4px;overflow-y:auto;pointer-events:auto;
  font-size:13px;line-height:17px;color:#fff;text-shadow:0 1px 1px #000,0 0 2px #000;overflow-wrap:anywhere;scrollbar-width:thin;scrollbar-color:#b48a3c transparent}
.gol-chat .lines::-webkit-scrollbar{width:5px}.gol-chat .lines::-webkit-scrollbar-thumb{background:#b48a3c;border-radius:3px}
.gol-chat .ln b{font-weight:700}
.gol-chat .row{position:absolute;left:0;top:${L.inY - L.y}px;width:${L.w - 2 * L.send - 8}px;height:${L.inH}px;box-sizing:border-box;
  border-style:solid;border-width:0 22px;border-image:url("${K('chat_input')}") 0 80 fill / 0 22px stretch;pointer-events:auto}
.gol-chat input{position:absolute;inset:0 2px;width:calc(100% - 4px);height:100%;box-sizing:border-box;border:0;outline:0;background:transparent;
  color:#fff;font:14px ${HUD.bodyFont};caret-color:#ffd76e;padding:0 8px}
.gol-chat input::placeholder{color:#a99f86;font-style:italic}
.gol-chat .send{position:absolute;left:${L.w - L.send}px;top:${L.inY - L.y - 2}px;width:${L.send}px;height:${L.send}px;padding:0;border:0;
  background:url("${K('send_btn')}") center/100% 100% no-repeat;pointer-events:auto;cursor:pointer}
.gol-chat .send:hover,.gol-chat .emo:hover{filter:brightness(1.18)}
.gol-chat .emo{position:absolute;left:${L.w - 2 * L.send - 4}px;top:${L.inY - L.y - 2}px;width:${L.send}px;height:${L.send}px;padding:0;border:0;
  background:url("${K('ico_emote')}") center/30px 30px no-repeat;pointer-events:auto;cursor:pointer}
.gol-chat .emos{position:absolute;left:${L.w - 2 * L.send - 150}px;bottom:${L.inH + 12}px;width:228px;padding:16px 18px;box-sizing:border-box;display:none;
  grid-template-columns:repeat(4,1fr);gap:8px;pointer-events:auto;background:url("${K('tooltip_panel')}") center/100% 100% no-repeat}
.gol-chat .emos.open{display:grid}
.gol-chat .emos button{width:40px;height:40px;padding:0;border:0;background:center/100% 100% no-repeat;cursor:pointer;transition:transform .08s}
.gol-chat .emos button:hover{transform:scale(1.15)}
.gol-chat.typing .row{filter:drop-shadow(0 0 6px rgba(255,210,110,.55))}
`;

export class ChatBox {
  private root: HTMLDivElement;
  private list: HTMLDivElement;
  private input: HTMLInputElement;
  private tabs = new Map<ChatKind, HTMLButtonElement>();
  private lines: ChatLine[] = [];
  private tab: ChatKind = 'all';
  private closeEmotes = () => {};
  private onDocDown = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.('.gol-chat .emos, .gol-chat .emo')) this.closeEmotes(); };
  private onWindowKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || this.typing || e.repeat) return;
    const a = document.activeElement as HTMLElement | null;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) return;
    e.preventDefault(); e.stopPropagation();
    this.focus();
  };

  /** onSend(text, channel); onTyping(true) while the typing row has the keyboard; onEmote(n) for a sticker. */
  constructor(parent: HTMLElement, private onSend: (text: string, kind: ChatKind) => void, private onTyping: (on: boolean) => void, onEmote?: (n: number) => void) {
    if (!document.getElementById(STYLE_ID)) { const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st); }
    this.root = document.createElement('div'); this.root.className = 'gol-chat';
    const tabs = document.createElement('div'); tabs.className = 'tabs'; this.root.appendChild(tabs);
    for (const [k, label] of TABS) {
      const b = document.createElement('button'); b.type = 'button'; b.className = `tab${k === this.tab ? ' on' : ''}`;
      b.textContent = label; const n = document.createElement('span'); n.className = 'n'; n.textContent = '•'; b.appendChild(n);
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => this.setTab(k));
      tabs.appendChild(b); this.tabs.set(k, b);
    }
    const fill = document.createElement('div'); fill.className = 'fill'; this.root.appendChild(fill);
    const log = document.createElement('div'); log.className = 'log'; this.root.appendChild(log);
    this.list = document.createElement('div'); this.list.className = 'lines'; this.root.appendChild(this.list);
    const row = document.createElement('div'); row.className = 'row'; this.root.appendChild(row);
    this.input = document.createElement('input');
    Object.assign(this.input, { type: 'text', maxLength: CHAT_MAX_LEN, placeholder: 'Press Enter to chat', spellcheck: false, autocomplete: 'off' });
    this.input.setAttribute('aria-label', 'Chat message');
    row.appendChild(this.input);
    const send = document.createElement('button'); send.type = 'button'; send.className = 'send'; send.setAttribute('aria-label', 'Send');
    send.addEventListener('mousedown', (e) => e.preventDefault());
    send.addEventListener('click', () => this.submit());
    this.root.appendChild(send);
    // Emote stickers (smiley button): shown over your head for everyone around.
    const emo = document.createElement('button'); emo.type = 'button'; emo.className = 'emo'; emo.setAttribute('aria-label', 'Emotes'); emo.title = 'Emotes';
    const grid = document.createElement('div'); grid.className = 'emos';
    for (let n = 0; n < EMOTES; n++) {
      const b = document.createElement('button'); b.type = 'button'; b.style.backgroundImage = `url("${K(`emote_${n}`)}")`;
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => { grid.classList.remove('open'); onEmote?.(n); });
      grid.appendChild(b);
    }
    emo.addEventListener('mousedown', (e) => e.preventDefault());
    emo.addEventListener('click', () => grid.classList.toggle('open'));
    this.root.append(emo, grid);
    this.closeEmotes = () => grid.classList.remove('open');
    document.addEventListener('mousedown', this.onDocDown);
    // While typing the keyboard belongs to the chat: nothing reaches the game's key handlers.
    const keep = (e: KeyboardEvent) => e.stopPropagation();
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); this.submit(); this.input.blur(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.input.value = ''; this.input.blur(); }
    });
    this.input.addEventListener('keyup', keep);
    this.input.addEventListener('keypress', keep);
    this.input.addEventListener('focus', () => { this.root.classList.add('typing'); this.input.placeholder = this.tab === 'whisper' ? '/w Name message' : 'Type a message…'; this.onTyping(true); });
    this.input.addEventListener('blur', () => { this.root.classList.remove('typing'); this.input.placeholder = 'Press Enter to chat'; this.onTyping(false); });
    window.addEventListener('keydown', this.onWindowKey);
    parent.appendChild(this.root);
  }

  get typing(): boolean { return document.activeElement === this.input; }

  focus(): void { this.input.focus(); }

  add(line: ChatLine): void {
    this.lines.push(line);
    if (this.lines.length > MAX_LINES) this.lines.shift();
    if (this.shows(line)) this.append(line);
    else this.tabs.get(line.kind)?.classList.add('new');
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onWindowKey);
    document.removeEventListener('mousedown', this.onDocDown);
    if (this.typing) this.input.blur();
    this.root.remove();
  }

  private shows(l: ChatLine): boolean { return this.tab === 'all' || l.kind === this.tab; }

  private setTab(k: ChatKind): void {
    this.tab = k;
    for (const [t, b] of this.tabs) b.classList.toggle('on', t === k);
    this.tabs.get(k)?.classList.remove('new');
    this.list.textContent = '';
    for (const l of this.lines) if (this.shows(l)) this.append(l);
  }

  private append(l: ChatLine): void {
    const stick = this.list.scrollTop + this.list.clientHeight >= this.list.scrollHeight - 4;
    const d = document.createElement('div'); d.className = 'ln'; d.style.color = COLOR[l.kind];
    if (l.name) {
      const b = document.createElement('b');
      b.textContent = l.kind === 'whisper' ? (l.me ? `To ${l.to ?? '?'}: ` : `${l.name} whispers: `) : `${l.name}: `;
      if (l.kind === 'all') b.style.color = l.me ? '#9fe0ff' : '#ffe39a';
      d.appendChild(b);
    }
    d.appendChild(document.createTextNode(l.text));
    this.list.appendChild(d);
    while (this.list.childElementCount > MAX_LINES) this.list.firstElementChild?.remove();
    if (stick) this.list.scrollTop = this.list.scrollHeight;
  }

  private submit(): void {
    const text = this.input.value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, CHAT_MAX_LEN);
    this.input.value = '';
    if (text) this.onSend(text, this.tab === 'system' ? 'all' : this.tab);
  }
}
