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
/* ---- the gameplay HUD (GPT, step 4A): one cohesive frame language, larger at 1280×720, a clear centre ---- */
/* the player card: his 3D portrait in a gold ring, Lv and name, the job title small under it, HP / MP / EXP */
html .gol-hud .card{border-radius:16px}
html .gol-hud .pf{box-shadow:0 0 0 2px ${GOLD},0 0 0 6px rgba(27,18,48,.95),0 0 18px rgba(115,61,152,.55),0 6px 16px rgba(0,0,0,.55);background:radial-gradient(circle at 50% 40%,#3a2563,#140c24)}
html .gol-hud .pf .img{background-size:cover!important;background-position:center!important}
html .gol-hud .nm{overflow:visible}
html .gol-hud .lvl{height:28px;padding:0 11px;font:700 14px/26px var(--gl-body);background:rgba(228,194,106,.14);border-color:rgba(228,194,106,.55)}
html .gol-hud .pname{font:700 23px/30px var(--gl-title);letter-spacing:1.6px;color:#f6e7c4;text-shadow:0 2px 6px rgba(0,0,0,.7)}
html .gol-hud .pjob{position:absolute;left:2px;top:33px;font:600 12px/18px var(--gl-body);letter-spacing:.8px;color:#a796c4}
html .gol-hud .bar .val{font-size:13.5px}
html .gol-hud .bar.xp .val{font-size:11.5px;letter-spacing:.8px;color:#fff3d6}
/* the skill dock: the main row dominant, the tray over it smaller and quieter, the potions beside */
html .gol-hud .dock{border-radius:18px}
html .gol-hud .aslot{border-radius:14px;box-shadow:inset 0 0 0 1px rgba(228,194,106,.16)}
/* the skills' states (GPT, 4A notes): ready — a clear gold edge and a soft violet light from below; cooling — darkened with a
   large gold count; unusable — dimmed and grey; empty — a quiet socket */
html .gol-hud .aslot.cool .ic{filter:brightness(.62) saturate(.7)}
html .gol-hud .aslot:not(.off):not(.empty):not(.tray):not(.cool){box-shadow:inset 0 0 0 1.5px rgba(228,194,106,.55),inset 0 -14px 18px -10px rgba(164,107,255,.55)}
html .gol-hud .aslot.tray:not(.off):not(.empty){box-shadow:inset 0 0 0 1px rgba(228,194,106,.4)}
html .gol-hud .aslot.off .ic{opacity:.28!important;filter:grayscale(1) brightness(.75)!important}
html .gol-hud .aslot.empty{background:rgba(14,9,25,.7);box-shadow:inset 0 0 0 1px rgba(206,184,255,.1)}
html .gol-hud .aslot .cd{background-color:rgba(8,4,16,.35);color:#f2d98f;font-weight:800}
html .gol-hud .aslot .cd{border-radius:14px;font-size:26px}
html .gol-hud .aslot.tray{border-radius:10px;opacity:.9;box-shadow:inset 0 0 0 1px rgba(206,184,255,.14),inset 0 2px 6px rgba(0,0,0,.45)}
html .gol-hud .aslot.tray .cd{border-radius:10px;font-size:17px}
html .gol-hud .key{height:20px;min-width:22px;font:700 11.5px/18px var(--gl-body);border-radius:7px}
html .gol-hud .aslot.pot .ic{left:6px;top:6px;width:44px;height:44px}
/* the panels' buttons: one row of icons at the bottom right, each its key on a cap and its name under it */
html .gol-hud .menu.sp{right:82px!important;bottom:10px!important;width:auto!important;flex-direction:row!important;gap:5px!important}
html .gol-hud .menu.sp button.ico{position:relative;width:54px;height:60px;padding:9px 0 5px;flex-direction:column;justify-content:flex-start;align-items:center;gap:5px;border-radius:14px;
  background:rgba(27,18,48,.72);border:1px solid rgba(228,194,106,.2);box-shadow:none;color:${GOLD};font-size:10px}
html .gol-hud .menu.sp button.ico:hover:not(:disabled){border-color:rgba(228,194,106,.75);background:linear-gradient(180deg,rgba(58,38,96,.96),rgba(30,19,52,.96))}
html .gol-hud .menu.sp .mi{width:26px;height:26px;flex:none;background:currentColor;-webkit-mask:var(--i) center/contain no-repeat;mask:var(--i) center/contain no-repeat}
html .gol-hud .menu.sp b{font:500 9.5px/11px var(--gl-body);letter-spacing:.2px;color:rgba(222,210,240,.62);white-space:nowrap}
html .gol-hud .menu.sp .gl-key{position:absolute;right:3px;top:3px;min-width:15px;height:15px;padding:0 3px;font:700 9.5px/13px var(--gl-body);border-radius:5px;background:rgba(18,11,33,.9);border:1px solid rgba(228,194,106,.3);color:#e4c26a}
/* the camera's buttons: one quiet row over the panels' buttons */
html .gol-hud .camc{right:16px!important;left:auto!important;top:auto!important;bottom:88px!important;flex-direction:row;padding:5px 8px;border-radius:12px}
html .gol-hud .camc .cl{display:none}
html .gol-hud .camc .sep{width:1px;height:22px;margin:0 3px}
html .gol-hud .camc button{width:30px;height:30px}
/* the map: the place drawn from its data; its name under it */
html .gol-hud .mm .view{background:#0e0919;border-radius:12px}
html .gol-hud .region{font-size:15px;letter-spacing:1.6px;color:#f4dfab}
/* the chat: quieter than the fight */
html .gol-chat{background:linear-gradient(180deg,rgba(27,18,48,.62),rgba(18,11,33,.72))!important;border-color:rgba(228,194,106,.16)!important;box-shadow:none!important}
html .gol-chat .tab{font-size:12.5px}
/* ---- the windows (GPT, step 4B) ---- */
/* the inventory: the 3D Samurai on a night stage; the slots' states clear — a quiet socket when empty, a gold edge and a
   violet light from below when worn, the bag's cells readable */
html .gol-cp .stage.sp3d{overflow:hidden;background:radial-gradient(ellipse 44% 6% at 50% 88%,rgba(228,194,106,.32),rgba(228,194,106,0) 72%),
  radial-gradient(ellipse 72% 46% at 50% 34%,rgba(115,61,152,.42),rgba(115,61,152,0) 72%),linear-gradient(180deg,#2b1d4b 0%,#170f2a 70%,#120b21 100%);
  box-shadow:inset 0 0 0 1px rgba(228,194,106,.24)}
html .gol-cp .sl{background:rgba(16,10,29,.85);border-color:rgba(206,184,255,.16);border-radius:12px}
html .gol-cp .sl > i{background:rgba(206,184,255,.26)}
html .gol-cp .sl.later > i{background:rgba(206,184,255,.12)}
html .gol-cp .sl.worn{background:linear-gradient(180deg,#33234f,#1c1232);border-color:rgba(228,194,106,.62);box-shadow:inset 0 -12px 18px -12px rgba(164,107,255,.6)}
html .gol-cp .es small{color:#a99cc2}
html .gol-cp .sl.it{border-color:rgba(228,194,106,.34)}
html .gol-cp .sl.it.sel{border-color:${GOLD};box-shadow:0 0 0 2px rgba(228,194,106,.35)}
html .gol-cp .gstat b{color:#f6e7c4}
/* the skill book: the job tabs and the list's tabs clearer, the cards' hierarchy, a larger featured skill, the description
   readable, its sections in the HUD's panels */
html .gol-sb .job{background:rgba(18,11,33,.5);border-color:rgba(206,184,255,.12)}
html .gol-sb .job:hover{background:rgba(44,29,74,.55)}
html .gol-sb .job.on{background:linear-gradient(180deg,#36245d,#22163d);border-color:rgba(228,194,106,.8);box-shadow:0 6px 18px rgba(0,0,0,.35),inset 0 -2px 0 ${GOLD}}
html .gol-sb .job span{color:#9d8fb9}
html .gol-sb .job.on span{color:#d9cdec}
html .gol-sb .mid .gl-seg{background:rgba(18,11,33,.7);border-color:rgba(206,184,255,.14)}
html .gol-sb .mid .gl-seg button{font-size:14px}
html .gol-sb .mid .gl-seg button.on{background:#36245d;box-shadow:inset 0 0 0 1px rgba(228,194,106,.6)}
html .gol-sb .card{background:linear-gradient(180deg,#21163a,#150d27);border-color:rgba(206,184,255,.12)}
html .gol-sb .card:hover{border-color:rgba(228,194,106,.5)}
html .gol-sb .card.sel{background:linear-gradient(180deg,#38265f,#1e1336);border-color:${GOLD};box-shadow:0 0 0 3px rgba(228,194,106,.18),0 10px 24px rgba(0,0,0,.4)}
html .gol-sb .card .nm{font-weight:700;color:#d9cfea}
html .gol-sb .card.sel .nm{color:#f6e7c4}
html .gol-sb .det{grid-template-columns:1.4fr 1fr}
html .gol-sb .gl-sec{background:linear-gradient(180deg,rgba(34,23,58,.94),rgba(22,14,38,.94));border:1px solid rgba(228,194,106,.26);border-radius:14px;box-shadow:inset 0 0 0 1px rgba(115,61,152,.18)}
html .gol-sb .hero{min-height:248px}
html .gol-sb .hero > img{width:136px;height:136px;border-radius:18px;box-shadow:0 0 0 2px rgba(228,194,106,.7),0 0 22px rgba(115,61,152,.5),0 10px 24px rgba(0,0,0,.5)}
html .gol-sb .hero .nm{font-size:30px;color:#f6e7c4}
html .gol-sb .facts b{font-size:16px}
html .gol-sb .desc{min-height:248px}
html .gol-sb .desc .ds{font-size:17px;line-height:1.65;color:#efe8f8}
html .gol-sb .desc .ds.long{font-size:16px;line-height:1.6}
html .gol-sb .desc .rel{font-size:15px;color:#f2d98f}
`;

/** Lay the spirits' colours over the interface (once; only behind ?spirits). */
export function ensureSpiritTheme(): void {
  if (!SPIRITS.on || typeof document === 'undefined' || document.getElementById('gol-spirit-theme')) return;
  const st = document.createElement('style'); st.id = 'gol-spirit-theme'; st.textContent = CSS; document.head.appendChild(st);
}
