// Chat box (bottom-left, MapleStory style): channel tabs, message log, typing row and send button.
// DOM inside the HUD overlay (1920x1080 design px). Enter opens the typing row, Enter sends, Esc closes;
// while typing every key stays in the chat (the game never sees it).
import { ICONS, ensureTheme } from './theme';

export type ChatKind = 'all' | 'party' | 'whisper' | 'system';
export interface ChatLine { kind: ChatKind; text: string; name?: string; me?: boolean; to?: string }

const K = (f: string) => `assets/final/ui/kit/${f}.png`;
const TABS: [ChatKind, string][] = [['all', 'All'], ['party', 'Party'], ['whisper', 'Whisper'], ['system', 'System']];
export const CHAT_MAX_LEN = 120;
/** Emote stickers (kit emote_0..7: happy, laugh, love, angry, sad, surprised, cool, embarrassed). */
export const EMOTES = 8;
const MAX_LINES = 120;
/** Layout (design px): one panel — channel tabs on top, the messages, the typing row at the bottom. */
const L = { x: 18, y: 778, w: 400, h: 284, tabH: 42, inH: 54 };
/** The chat's right edge (design px): the skill dock keeps clear of it. */
export const CHAT_RIGHT = L.x + L.w;
const COLOR: Record<ChatKind, string> = { all: '#f4f1ea', party: '#ffbb6e', whisper: '#ffa3e2', system: '#f0d28a' };
const STYLE_ID = 'gol-chat-style';

const CSS = `
.gol-chat{position:absolute;left:${L.x}px;top:${L.y}px;width:${L.w}px;height:${L.h}px;pointer-events:none;font-family:var(--gl-body);display:flex;flex-direction:column}
.gol-chat .tabs{flex:none;height:${L.tabH}px;display:flex;gap:2px;padding:0 10px;border-bottom:1px solid var(--gl-line);pointer-events:auto}
.gol-chat .tab{position:relative;height:100%;padding:0 12px;border:0;background:transparent;color:var(--gl-text2);font:600 13px var(--gl-body);letter-spacing:.3px;cursor:pointer;
  transition:color 120ms}
.gol-chat .tab:hover{color:var(--gl-text)}
.gol-chat .tab.on{color:var(--gl-gold2)}
.gol-chat .tab.on::after{content:'';position:absolute;left:10px;right:10px;bottom:-1px;height:2px;border-radius:2px;background:var(--gl-gold)}
.gol-chat .tab .n{display:none;position:absolute;right:3px;top:9px;width:6px;height:6px;border-radius:50%;background:#ff9be0}
.gol-chat .tab.new .n{display:block}
.gol-chat .lines{flex:1;min-height:0;margin:8px 6px 0 0;padding:2px 10px 6px 16px;pointer-events:auto;
  font:500 14.5px/1.45 var(--gl-body);color:#fff;overflow-wrap:anywhere}
.gol-chat .ln + .ln{margin-top:3px}
.gol-chat .ln b{font-weight:700}
.gol-chat .inbar{flex:none;height:${L.inH}px;display:flex;align-items:center;gap:6px;padding:0 10px 2px;pointer-events:auto}
.gol-chat .row{flex:1;height:38px;position:relative}
.gol-chat input{position:absolute;inset:0;width:100%;height:100%;box-sizing:border-box;border-radius:10px;border:1px solid rgba(255,255,255,.1);outline:0;background:#0a101c;
  color:#fff;font:500 14.5px var(--gl-body);caret-color:var(--gl-gold2);padding:0 12px;transition:border-color 120ms,box-shadow 120ms}
.gol-chat input::placeholder{color:#7d8696}
.gol-chat.typing input{border-color:rgba(231,196,124,.55);box-shadow:0 0 0 3px rgba(231,196,124,.12)}
.gol-chat .ib{flex:none;width:38px;height:38px;padding:0;border-radius:10px;border:1px solid transparent;background:transparent;cursor:pointer;display:grid;place-items:center;
  color:var(--gl-text2);transition:background 120ms,color 120ms}
.gol-chat .ib::before{content:'';width:20px;height:20px;background:currentColor;-webkit-mask:var(--i) center/contain no-repeat;mask:var(--i) center/contain no-repeat}
.gol-chat .ib:hover{background:rgba(255,255,255,.06);color:var(--gl-text)}
.gol-chat .emo{--i:${ICONS.smile}}
.gol-chat .send{--i:${ICONS.send};color:var(--gl-gold2)}
.gol-chat .send:hover{color:#fff1c8}
.gol-chat .emos{position:absolute;left:${L.w - 230}px;bottom:${L.inH + 4}px;width:220px;padding:12px;display:none;grid-template-columns:repeat(4,1fr);gap:8px;pointer-events:auto}
.gol-chat .emos.open{display:grid}
.gol-chat .emos button{width:40px;height:40px;padding:0;border:0;border-radius:8px;background:center/88% 88% no-repeat;cursor:pointer;transition:transform .08s,background-color .08s}
.gol-chat .emos button:hover{transform:scale(1.12);background-color:rgba(255,255,255,.05)}
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
    ensureTheme();
    if (!document.getElementById(STYLE_ID)) { const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st); }
    this.root = document.createElement('div'); this.root.className = 'gol-chat gl-panel';
    const tabs = document.createElement('div'); tabs.className = 'tabs'; this.root.appendChild(tabs);
    for (const [k, label] of TABS) {
      const b = document.createElement('button'); b.type = 'button'; b.className = `tab${k === this.tab ? ' on' : ''}`;
      b.textContent = label; const n = document.createElement('span'); n.className = 'n'; b.appendChild(n);
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => this.setTab(k));
      tabs.appendChild(b); this.tabs.set(k, b);
    }
    this.list = document.createElement('div'); this.list.className = 'lines gl-scroll'; this.root.appendChild(this.list);
    const bar = document.createElement('div'); bar.className = 'inbar'; this.root.appendChild(bar);
    const row = document.createElement('div'); row.className = 'row'; bar.appendChild(row);
    this.input = document.createElement('input');
    Object.assign(this.input, { type: 'text', maxLength: CHAT_MAX_LEN, placeholder: 'Press Enter to chat', spellcheck: false, autocomplete: 'off' });
    this.input.setAttribute('aria-label', 'Chat message');
    row.appendChild(this.input);
    const send = document.createElement('button'); send.type = 'button'; send.className = 'ib send'; send.setAttribute('aria-label', 'Send'); send.title = 'Send';
    send.addEventListener('mousedown', (e) => e.preventDefault());
    send.addEventListener('click', () => this.submit());
    // Emote stickers (smiley button): shown over your head for everyone around.
    const emo = document.createElement('button'); emo.type = 'button'; emo.className = 'ib emo'; emo.setAttribute('aria-label', 'Emotes'); emo.title = 'Emotes';
    bar.append(emo, send);
    const grid = document.createElement('div'); grid.className = 'emos gl-tip';
    for (let n = 0; n < EMOTES; n++) {
      const b = document.createElement('button'); b.type = 'button'; b.style.backgroundImage = `url("${K(`emote_${n}`)}")`;
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => { grid.classList.remove('open'); onEmote?.(n); });
      grid.appendChild(b);
    }
    emo.addEventListener('mousedown', (e) => e.preventDefault());
    emo.addEventListener('click', () => grid.classList.toggle('open'));
    this.root.append(grid);
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
