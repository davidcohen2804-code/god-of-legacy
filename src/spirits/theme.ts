// LEGACY OF SPIRITS — the interface's colours (GPT, 9 Nov: "the UI must feel like the opening screen, but less ornate
// during gameplay"): base #1B1230, accent #733D98, gold #E4C26A, crimson #C81F46. Laid over the game's own design
// language (src/ui/theme.ts: its tokens and gl-* pieces, the HUD's classes) by a sheet of its own, only behind
// ?spirits; every rule here is one step more specific (html …) than the one it re-colours, so the order the sheets
// are added in never matters.
import { SPIRITS } from './flag';

const BASE = '#1b1230', INK = '#120b21', PANEL2 = '#241940', INSET = '#130c23', VIOLET = '#733d98', GOLD = '#e4c26a', CRIMSON = '#c81f46';

const CSS = `
html:root{
  --gl-ink:${INK};--gl-panel:${BASE};--gl-panel2:${PANEL2};--gl-inset:${INSET};
  --gl-line:rgba(206,184,255,.10);--gl-line2:rgba(206,184,255,.18);
  --gl-gold:${GOLD};--gl-gold2:#f2d98f;--gl-gold3:#b89645;--gl-goldline:rgba(228,194,106,.34);--gl-goldsoft:rgba(228,194,106,.12);
  --gl-text:#f2ebdc;--gl-text2:#c7bad9;--gl-text3:#8f81a8;--gl-red:#e05273;--gl-blue:#a493ff;
  --sp-violet:${VIOLET};--sp-crimson:${CRIMSON};
}
/* windows: the opening screen's violet and gold, a diamond on the top rule */
html .gl-win{background:linear-gradient(180deg,#251a40 0%,#170f2a 100%);border:1px solid rgba(228,194,106,.36);border-radius:14px;
  box-shadow:0 30px 80px rgba(4,2,10,.6),0 4px 14px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.05),inset 0 0 0 1px rgba(115,61,152,.22)}
html .gl-win::after{content:'';position:absolute;left:50%;top:-6px;width:10px;height:10px;margin-left:-5px;transform:rotate(45deg);
  background:${GOLD};box-shadow:0 0 0 2px ${BASE};pointer-events:none}
html .gl-title{color:#f4dfab}
html .gl-cap{color:#d9b86e}
html .gl-btn:hover:not(:disabled){border-color:rgba(228,194,106,.5)}
html .gl-btn.pri{background:linear-gradient(180deg,#d8304f,#9a1232);border-color:${GOLD};color:#fff3dc;box-shadow:0 6px 18px rgba(200,31,70,.25),inset 0 1px 0 rgba(255,255,255,.18)}
html .gl-btn.pri:hover:not(:disabled){filter:brightness(1.08);background:linear-gradient(180deg,#e03a59,#a61638)}
html .gl-seg button.on{background:#2c1d4a;color:var(--gl-gold2);box-shadow:inset 0 0 0 1px rgba(228,194,106,.4)}
html .gl-key{background:${PANEL2};border-color:rgba(206,184,255,.2)}
html .gl-chip{background:rgba(164,147,255,.1);border-color:rgba(164,147,255,.3);color:#d4caff}
html .gl-slot{background:${INSET};border-color:rgba(206,184,255,.09)}
html .gl-slot.can:hover{border-color:rgba(228,194,106,.55)}
html .gl-tip{background:${BASE};box-shadow:0 14px 34px rgba(4,2,10,.6),inset 0 0 0 1px rgba(115,61,152,.22)}
/* the HUD's panels: quiet, the same violet, a gold hairline (no ornaments while fighting) */
html .gl-panel{background:linear-gradient(180deg,rgba(34,23,58,.94),rgba(22,14,38,.94));border:1px solid rgba(228,194,106,.28);border-radius:12px;
  box-shadow:0 10px 28px rgba(4,2,10,.45),inset 0 1px 0 rgba(255,255,255,.04),inset 0 0 0 1px rgba(115,61,152,.18)}
html .gol-hud .pf{background:${INK};box-shadow:0 0 0 2px rgba(228,194,106,.8),0 0 0 5px rgba(27,18,48,.92),0 4px 12px rgba(0,0,0,.5)}
html .gol-hud .bar{background:${INK}}
html .gol-hud .bar.hp .fill,html .gol-hud .bar.thp .fill{background:linear-gradient(180deg,#e8506d,#a8163a)}
html .gol-hud .bar.mp .fill{background:linear-gradient(180deg,#a98bff,#5d39b8)}
html .gol-hud .bar.xp .fill{background:linear-gradient(180deg,#f2d98f,#c9a24c)}
html .gol-hud .aslot{background:${INSET}}
html .gol-hud .key{background:rgba(27,18,48,.92);border-color:rgba(206,184,255,.22)}
html .gol-hud .feed .it{background:rgba(27,18,48,.8);border-color:rgba(206,184,255,.12)}
html .gol-hud .mm .view{background:#100a1c}
html .gol-hud .target .tpf{background:${INK}}
html .gol-hud .dim{background:rgba(8,4,16,.55)}
html .gol-hud .combo .n{background:rgba(27,18,48,.88)}
html .gol-hud .menu button{background:rgba(27,18,48,.92);border-color:rgba(228,194,106,.24)}
html .gol-hud .menu button:hover:not(:disabled){background:rgba(44,29,74,.96)}
html .gol-chat input{background:${INK}}
html .open .gear{background:rgba(44,29,74,.97)}
html .gol-pf .hb{background:${INK}}
html .gol-sb .card .lv{background:rgba(27,18,48,.9)}
html .gol-sb .job.lk .em::after{background:${BASE}}
html .gol-cp .sl.worn{background:linear-gradient(180deg,#2a1d47,#181029);border-color:rgba(228,194,106,.38)}
html .gol-keys .chip.none{background:${PANEL2}}
`;

/** Lay the spirits' colours over the interface (once; only behind ?spirits). */
export function ensureSpiritTheme(): void {
  if (!SPIRITS.on || typeof document === 'undefined' || document.getElementById('gol-spirit-theme')) return;
  const st = document.createElement('style'); st.id = 'gol-spirit-theme'; st.textContent = CSS; document.head.appendChild(st);
}
