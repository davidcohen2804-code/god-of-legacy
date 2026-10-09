// The game's design language (every window, panel and HUD piece): calm, clear and roomy. Deep navy surfaces, one warm
// gold accent used sparingly, rounded shapes, soft shadows, a fine gold hairline instead of ornaments. Titles in Cinzel,
// everything you read in Inter. Tokens live as CSS variables on :root; the shared pieces are the gl-* classes below.
import { FONT_FAMILY, HUD } from '../config/layout';

export const UI = {
  title: FONT_FAMILY,
  body: HUD.bodyFont,
  gold: '#e7c47c', gold2: '#f4d896', gold3: '#b9914c',
  text: '#eee8da', text2: '#aeb6c3', text3: '#737d8c',
  green: '#7ed492', red: '#ef7f6f', blue: '#86bdf0',
} as const;

/** Small line icons (24 px grid, stroke) used as CSS masks: they take the element's text colour. */
const svg = (body: string, sw = 2) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`)}")`;
export const ICONS = {
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 2.2),
  gear: svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M4.2 7.5l2.3 1.3M17.5 15.2l2.3 1.3M4.2 16.5l2.3-1.3M17.5 8.8l2.3-1.3"/><circle cx="12" cy="12" r="7"/>', 1.8),
  send: svg('<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>', 1.9),
  smile: svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2"/><path d="M9 9.5h.01M15 9.5h.01"/>', 1.9),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2.2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 1.9),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 2.4),
  left: svg('<path d="M15 5l-7 7 7 7"/>', 2.2),
  right: svg('<path d="M9 5l7 7-7 7"/>', 2.2),
  rotate: svg('<path d="M4 9a8 8 0 0 1 14-3l2 2"/><path d="M20 4v4h-4"/><path d="M20 15a8 8 0 0 1-14 3l-2-2"/><path d="M4 20v-4h4"/>', 1.9),
  scroll: svg('<path d="M7 4h11a2 2 0 0 1 2 2v11"/><path d="M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2"/><path d="M9 9h7M9 13h7M9 17h4"/>', 1.8),
  sort: svg('<path d="M4 7h11M4 12h8M4 17h5"/><path d="M18 8v10M15 15l3 3 3-3"/>', 1.9),
  filter: svg('<path d="M4 5h16l-6 7.5V19l-4 1.5v-8z"/>', 1.9),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>', 2),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>', 1.9),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 2.2),
  minus: svg('<path d="M5 12h14"/>', 2.2),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', 1.9),
  // equipment slots (empty: the slot's own pictogram)
  helmet: svg('<path d="M4 18v-4a8 8 0 0 1 16 0v4z"/><path d="M4 18h16M9 13.5h6"/>', 1.8),
  sword: svg('<path d="M14.5 3.5H20.5V9.5L10.5 19.5L4.5 13.5Z"/><path d="M6.5 17.5L3.5 20.5M4.5 13.5l6 6"/>', 1.8),
  shirt: svg('<path d="M8.5 4L3.5 7l2 4 2.5-1.2V20h8V9.8l2.5 1.2 2-4-5-3c-.6 1.6-2 2.6-3.5 2.6S9.1 5.6 8.5 4z"/>', 1.8),
  pants: svg('<path d="M7 3h10l1.2 18h-4.6L12 10l-1.6 11H5.8z"/>', 1.8),
  boots: svg('<path d="M7 3h6v9l6.5 3.2V20H5v-4c1.2-1.2 2-3.2 2-6.2z"/>', 1.8),
  ring: svg('<circle cx="12" cy="15" r="5.5"/><path d="M9.6 6.8L12 3.5l2.4 3.3L12 9.8z"/>', 1.8),
  necklace: svg('<path d="M5 3.5c0 6.5 3 10 7 10s7-3.5 7-10"/><circle cx="12" cy="17" r="3"/>', 1.8),
  earring: svg('<circle cx="12" cy="5" r="2"/><path d="M12 7v3"/><path d="M12 10l4 5.5-4 5.5-4-5.5z"/>', 1.8),
  shield: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>', 1.8),
  belt: svg('<rect x="3" y="9" width="18" height="6" rx="1.5"/><rect x="9.5" y="7.5" width="5" height="9" rx="1"/>', 1.8),
  sparkle: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>', 1.7),
  bag: svg('<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>', 1.8),
  // actions (Key Settings)
  chat: svg('<path d="M4 5h16v11H9l-5 4z"/>', 1.9),
  users: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>', 1.8),
  book: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>', 1.8),
  stats: svg('<path d="M5 20V11M12 20V4M19 20v-6"/>', 2.2),
  jump: svg('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/>', 2),
  up: svg('<path d="M12 19V5M6 11l6-6 6 6"/>', 2.2),
  down: svg('<path d="M12 5v14M6 13l6 6 6-6"/>', 2.2),
  // the camera on its arc over the floor (the half moon): higher, toward straight down / lower, toward eye level
  tiltUp: svg('<path d="M2 20h9"/><path d="M20 20A11 11 0 0 0 9 9"/><path d="M12.5 5.5L9 9l3.5 3.5"/>', 2),
  tiltDown: svg('<path d="M2 20h9"/><path d="M20 20A11 11 0 0 0 9 9"/><path d="M16.5 16.5L20 20l3.5-3.5"/>', 2),
  arrowL: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>', 2.2),
  arrowR: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 2.2),
} as const;
export type IconName = keyof typeof ICONS;

const STYLE_ID = 'gl-theme';
const CSS = `
:root{
  --gl-ink:#0b1220;--gl-panel:#111a2b;--gl-panel2:#162236;--gl-inset:#0b1220;
  --gl-line:rgba(255,255,255,.08);--gl-line2:rgba(255,255,255,.14);
  --gl-gold:${UI.gold};--gl-gold2:${UI.gold2};--gl-gold3:${UI.gold3};--gl-goldline:rgba(231,196,124,.28);--gl-goldsoft:rgba(231,196,124,.12);
  --gl-text:${UI.text};--gl-text2:${UI.text2};--gl-text3:${UI.text3};
  --gl-green:${UI.green};--gl-red:${UI.red};--gl-blue:${UI.blue};
  --gl-title:${UI.title};--gl-body:${UI.body};
}
/* window */
.gl-win{position:absolute;box-sizing:border-box;color:var(--gl-text);font-family:var(--gl-body);pointer-events:auto;
  background:linear-gradient(180deg,#152035 0%,#0f1828 100%);border:1px solid var(--gl-goldline);border-radius:18px;
  box-shadow:0 30px 80px rgba(0,0,0,.55),0 4px 14px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.06)}
.gl-win::before{content:'';position:absolute;left:18%;right:18%;top:-1px;height:1px;pointer-events:none;
  background:linear-gradient(90deg,rgba(231,196,124,0),rgba(244,216,150,.85),rgba(231,196,124,0))}
.gl-win.pop{animation:glIn 200ms ease-out}
@keyframes glIn{from{opacity:0;transform:translateY(8px) scale(.99)}to{opacity:1;transform:none}}
.gl-head{position:relative;display:flex;align-items:center;gap:14px;height:72px;padding:0 24px 0 28px;border-bottom:1px solid var(--gl-line);box-sizing:border-box}
.gl-title{font:700 22px/1.2 var(--gl-title);letter-spacing:2.5px;color:#f3e3bd;white-space:nowrap}
.gl-sub{font:500 13.5px/1.3 var(--gl-body);color:var(--gl-text2);letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gl-head .gl-sp{flex:1}
/* close */
.gl-x{flex:none;width:38px;height:38px;padding:0;border-radius:50%;border:1px solid var(--gl-line2);background:rgba(255,255,255,.04);color:var(--gl-text2);
  cursor:pointer;pointer-events:auto;display:grid;place-items:center;transition:background 120ms,color 120ms,border-color 120ms}
.gl-x::before{content:'';width:16px;height:16px;background:currentColor;-webkit-mask:${ICONS.close} center/contain no-repeat;mask:${ICONS.close} center/contain no-repeat}
.gl-x:hover{background:rgba(255,255,255,.09);color:#fff;border-color:var(--gl-goldline)}
/* icon (mask) */
.gl-ico{display:inline-block;flex:none;width:18px;height:18px;background:currentColor;-webkit-mask:var(--i) center/contain no-repeat;mask:var(--i) center/contain no-repeat}
/* buttons */
.gl-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 20px;box-sizing:border-box;border-radius:10px;cursor:pointer;pointer-events:auto;
  border:1px solid var(--gl-line2);background:rgba(255,255,255,.05);color:var(--gl-text);font:600 14px var(--gl-body);letter-spacing:.6px;white-space:nowrap;
  transition:background 120ms,border-color 120ms,color 120ms,filter 120ms,transform 120ms}
.gl-btn:hover:not(:disabled){background:rgba(255,255,255,.09);border-color:rgba(231,196,124,.45)}
.gl-btn:active:not(:disabled){transform:translateY(1px)}
.gl-btn:disabled{opacity:.42;cursor:default}
.gl-btn.pri{background:linear-gradient(180deg,#f2d493,#d2a65a);border-color:#f6dc9f;color:#24180a;font-weight:700;box-shadow:0 6px 18px rgba(210,166,90,.22),inset 0 1px 0 rgba(255,255,255,.35)}
.gl-btn.pri:hover:not(:disabled){filter:brightness(1.06);background:linear-gradient(180deg,#f6dca2,#d8ad62)}
.gl-btn.ghost{background:transparent;border-color:transparent;color:var(--gl-text2)}
.gl-btn.ghost:hover:not(:disabled){background:rgba(255,255,255,.05);color:var(--gl-text);border-color:transparent}
.gl-btn.lg{height:52px;padding:0 30px;font-size:16px;border-radius:12px;letter-spacing:1px}
.gl-btn.sq{width:40px;padding:0}
/* tabs: underline (window navigation) and segmented (small switches) */
.gl-tabs{display:flex;gap:4px;border-bottom:1px solid var(--gl-line)}
.gl-tab{position:relative;display:inline-flex;align-items:center;gap:9px;height:46px;padding:0 18px;border:0;background:transparent;cursor:pointer;pointer-events:auto;
  color:var(--gl-text2);font:600 14px var(--gl-body);letter-spacing:.5px;white-space:nowrap;transition:color 120ms,background 120ms;border-radius:10px 10px 0 0}
.gl-tab:hover{color:var(--gl-text);background:rgba(255,255,255,.03)}
.gl-tab.on{color:var(--gl-gold2)}
.gl-tab.on::after{content:'';position:absolute;left:12px;right:12px;bottom:-1px;height:2px;border-radius:2px;background:var(--gl-gold)}
.gl-seg{display:inline-flex;gap:4px;padding:4px;border-radius:12px;background:var(--gl-inset);border:1px solid var(--gl-line)}
.gl-seg button{height:34px;padding:0 16px;border:0;border-radius:9px;background:transparent;cursor:pointer;pointer-events:auto;color:var(--gl-text2);
  font:600 13px var(--gl-body);letter-spacing:.4px;white-space:nowrap;transition:background 120ms,color 120ms}
.gl-seg button:hover{color:var(--gl-text)}
.gl-seg button.on{background:#1f2c44;color:var(--gl-gold2);box-shadow:inset 0 0 0 1px rgba(231,196,124,.35)}
/* sections, captions, rows */
.gl-sec{box-sizing:border-box;border-radius:14px;background:rgba(255,255,255,.025);border:1px solid var(--gl-line)}
.gl-cap{font:700 11.5px/1 var(--gl-body);letter-spacing:1.6px;text-transform:uppercase;color:#c9ae78}
.gl-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:34px;border-bottom:1px solid var(--gl-line);font-size:14.5px}
.gl-row:last-child{border-bottom:0}
.gl-row > span{color:var(--gl-text2)}
.gl-row > b{color:var(--gl-text);font-weight:600}
.gl-div{height:1px;background:var(--gl-line);border:0;margin:0}
/* slots, keycaps, chips, badges */
.gl-slot{position:relative;box-sizing:border-box;border-radius:12px;background:var(--gl-inset);border:1px solid rgba(255,255,255,.07);
  box-shadow:inset 0 2px 6px rgba(0,0,0,.35);transition:border-color 120ms,box-shadow 120ms,transform 120ms}
.gl-slot.can:hover{border-color:rgba(231,196,124,.5);cursor:pointer}
.gl-slot.sel{border-color:var(--gl-gold);box-shadow:0 0 0 3px rgba(231,196,124,.16),inset 0 2px 6px rgba(0,0,0,.35)}
.gl-key{display:inline-block;min-width:24px;height:22px;padding:0 6px;box-sizing:border-box;border-radius:6px;background:#1c2639;border:1px solid rgba(255,255,255,.16);
  border-bottom-width:2px;font:700 11px/19px var(--gl-body);letter-spacing:.3px;color:#ebe4d2;text-align:center;white-space:nowrap}
.gl-chip{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;font:600 12px var(--gl-body);letter-spacing:.2px;white-space:nowrap;
  background:rgba(134,189,240,.1);border:1px solid rgba(134,189,240,.28);color:#c3dcf3}
.gl-chip.gold{background:var(--gl-goldsoft);border-color:rgba(231,196,124,.35);color:var(--gl-gold2)}
.gl-chip.ok{background:rgba(126,212,146,.1);border-color:rgba(126,212,146,.3);color:#a8e5b4}
.gl-chip.no{background:rgba(239,127,111,.1);border-color:rgba(239,127,111,.3);color:#f3aea3}
.gl-badge{display:inline-flex;align-items:center;justify-content:center;min-width:36px;height:24px;padding:0 9px;box-sizing:border-box;border-radius:999px;
  background:var(--gl-goldsoft);border:1px solid rgba(231,196,124,.35);color:var(--gl-gold2);font:700 12.5px var(--gl-body);letter-spacing:.3px;font-variant-numeric:tabular-nums}
/* HUD panel: opaque, quiet */
.gl-panel{box-sizing:border-box;border-radius:14px;background:rgba(13,20,33,.94);border:1px solid rgba(231,196,124,.22);box-shadow:0 10px 28px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.05)}
/* tooltips */
.gl-tip{box-sizing:border-box;border-radius:12px;background:#0f1828;border:1px solid var(--gl-goldline);box-shadow:0 14px 34px rgba(0,0,0,.55);color:var(--gl-text);font-family:var(--gl-body)}
/* scrollbars */
.gl-scroll{overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(231,196,124,.35) transparent}
.gl-scroll::-webkit-scrollbar{width:6px}
.gl-scroll::-webkit-scrollbar-thumb{background:rgba(231,196,124,.35);border-radius:3px}
.gl-scroll::-webkit-scrollbar-track{background:transparent}
/* currencies */
.gl-coin{display:inline-block;flex:none;width:18px;height:18px;border-radius:50%;background:radial-gradient(circle at 35% 32%,#fff0b8,#e2ad48 58%,#9a6a1e);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.22),0 1px 3px rgba(0,0,0,.4)}
.gl-gem{display:inline-block;flex:none;width:14px;height:14px;margin:2px;transform:rotate(45deg);border-radius:3px;background:linear-gradient(135deg,#d8f3ff,#59b6f2 55%,#2462b8);box-shadow:inset 0 0 0 1px rgba(255,255,255,.3),0 1px 3px rgba(0,0,0,.4)}
/* empty states */
.gl-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;color:var(--gl-text2);font:500 15px/1.5 var(--gl-body)}
.gl-empty b{font:700 18px var(--gl-title);letter-spacing:2px;color:#e9d7ae}
`;

/** "BACK TO CHARACTERS" → "Back to Characters": labels written in capitals read calmer in title case. */
export const titleCase = (t: string): string => (t === t.toUpperCase()
  ? t.toLowerCase().replace(/[a-z']+/g, (w, i: number) => (i > 0 && ['to', 'of', 'the', 'and', 'a', 'an', 'in', 'on'].includes(w) ? w : w[0].toUpperCase() + w.slice(1)))
  : t);

/** Inject the design language once (every UI module calls this before building). */
export function ensureTheme(): void {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st);
}

/** An icon element (mask, coloured by currentColor). */
export function icon(name: IconName, size = 18): HTMLElement {
  const i = document.createElement('i'); i.className = 'gl-ico';
  i.style.setProperty('--i', ICONS[name]); i.style.width = i.style.height = `${size}px`;
  return i;
}
