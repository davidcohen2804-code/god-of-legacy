// Test mode (?qa=1 only): a panel (F8) to look at anything in the open world freely, untouched by the game's rules —
// no damage, monsters that pay no mind, a teleport to every map, any level or class, items, gold, quests done or reset.
// Nothing here runs outside ?qa=1; it drives LegacyCourtyardScene.devApi() only.
import Phaser from 'phaser';
import { ITEM_IDS, ITEMS } from '../game/Loot';

export interface DevApi {
  flags: { god: boolean; peace: boolean; free: boolean };
  areas(): { id: string; name: string }[];
  goto(id: string): void;
  state(): { level: number; hp: number; maxHp: number; gold: number; area: string; x: number; y: number; z: number; cls: string };
  level(n: number): void;
  setClass(job: string): void;
  give(item: string, n: number): void;
  gold(n: number): void;
  heal(): void;
  allSkills(on: boolean): void;
  questsDone(upTo?: string): void;
  questsReset(): void;
  unlockGate(): void;
  killNear(): void;
  quests(): { id: string; title: string; state: string }[];
}

const CLASSES: [string, string][] = [['warrior', 'Warrior'], ['samurai', 'Samurai'], ['archer', 'Archer'], ['book_mage', 'Book Mage'], ['gambler', 'Gambler']];

export function startTestMode(game: Phaser.Game): void {
  const root = document.createElement('div');
  Object.assign(root.style, {
    position: 'fixed', right: '8px', top: '8px', zIndex: '99999', width: '300px', display: 'none',
    font: '12px/1.5 Inter, Segoe UI, sans-serif', color: '#f1ead8', background: 'rgba(10,14,24,.92)',
    border: '1px solid rgba(201,154,69,.7)', borderRadius: '10px', padding: '10px 12px', boxShadow: '0 8px 30px rgba(0,0,0,.5)',
  } as CSSStyleDeclaration);
  root.innerHTML = `<style>
    .gl-tm b{color:#f3d58c;letter-spacing:1px;font-size:11px;text-transform:uppercase}
    .gl-tm .row{display:flex;gap:6px;align-items:center;margin:6px 0;flex-wrap:wrap}
    .gl-tm button{font:600 12px Inter,Segoe UI,sans-serif;color:#24180a;background:#e9c777;border:0;border-radius:6px;padding:4px 9px;cursor:pointer}
    .gl-tm button.off{background:#4a4a52;color:#ddd}
    .gl-tm select,.gl-tm input{font:12px Inter,Segoe UI,sans-serif;background:#1b2130;color:#f1ead8;border:1px solid #555;border-radius:6px;padding:3px 6px;max-width:170px}
    .gl-tm input{width:56px}
    .gl-tm .st{color:#cfd8c9;font:11px ui-monospace,Consolas,monospace;white-space:pre;margin-top:6px;border-top:1px solid rgba(255,255,255,.12);padding-top:6px}
  </style>
  <div class="gl-tm">
    <div class="row"><b>Test mode</b><span style="flex:1"></span><span style="opacity:.6">F8 hide</span></div>
    <div class="row"><button data-t="god" class="off">God</button><button data-t="peace" class="off">Peace</button><button data-t="skills" class="off">All skills</button><button data-a="heal">Heal</button></div>
    <div class="row"><select data-s="area"></select><button data-a="goto">Go</button></div>
    <div class="row">Level <input data-i="level" type="number" min="1" max="200" value="10"><button data-a="level">Set</button><button data-a="lv1">+1</button><button data-a="lv5">+5</button></div>
    <div class="row"><select data-s="class"></select><button data-a="class">Switch class</button></div>
    <div class="row"><select data-s="item"></select><input data-i="qty" type="number" min="1" max="999" value="10"><button data-a="give">Give</button></div>
    <div class="row"><button data-a="gold">+10,000 gold</button><button data-a="gate">Open Sun Gate</button><button data-a="kill">Kill near</button></div>
    <div class="row"><select data-s="quest"></select><button data-a="qdone">Done up to</button><button data-a="qreset">Reset quests</button></div>
    <div class="st" data-st></div>
  </div>`;
  document.body.appendChild(root);
  const q = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const api = (): DevApi | null => {
    const sc = game.scene.getScene('LegacyCourtyardScene') as unknown as { devApi?: () => DevApi; scene: Phaser.Scenes.ScenePlugin } | null;
    return sc && sc.scene.isActive() && sc.devApi ? sc.devApi() : null;
  };
  const fill = () => {
    const a = api(); if (!a) return;
    const area = q<HTMLSelectElement>('[data-s=area]'), cls = q<HTMLSelectElement>('[data-s=class]'), item = q<HTMLSelectElement>('[data-s=item]'), quest = q<HTMLSelectElement>('[data-s=quest]');
    if (!area.options.length) for (const x of a.areas()) area.add(new Option(x.name, x.id));
    if (!cls.options.length) for (const [id, name] of CLASSES) cls.add(new Option(name, id));
    if (!item.options.length) for (const id of ITEM_IDS) item.add(new Option(ITEMS[id].name, id));
    if (!quest.options.length) for (const x of a.quests()) quest.add(new Option(x.title, x.id));
    const st = a.state();
    for (const [k, v] of [['god', a.flags.god], ['peace', a.flags.peace]] as const) q<HTMLButtonElement>(`[data-t=${k}]`).classList.toggle('off', !v);
    q('[data-st]').textContent = `${st.area}   x ${st.x}  y ${st.y}  z ${st.z}\nLv ${st.level} ${st.cls}   HP ${st.hp}/${st.maxHp}   gold ${st.gold.toLocaleString('en-US')}`;
    for (const [i, o] of [...quest.options].entries()) { const s = a.quests()[i]; if (s) o.text = `${s.title}  (${s.state})`; }
  };
  let timer = 0;
  const show = (on: boolean) => { root.style.display = on ? '' : 'none'; window.clearInterval(timer); if (on) { fill(); timer = window.setInterval(fill, 500); } };
  window.addEventListener('keydown', (e) => { if (e.key === 'F8') { e.preventDefault(); show(root.style.display === 'none'); } });
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!b) return;
    const a = api(); if (!a) return;
    const t = b.dataset.t, act = b.dataset.a;
    if (t === 'god') a.flags.god = !a.flags.god;
    else if (t === 'peace') a.flags.peace = !a.flags.peace;
    else if (t === 'skills') { const on = b.classList.contains('off'); a.allSkills(on); b.classList.toggle('off', !on); }
    else if (act === 'heal') a.heal();
    else if (act === 'goto') a.goto(q<HTMLSelectElement>('[data-s=area]').value);
    else if (act === 'level') a.level(Number(q<HTMLInputElement>('[data-i=level]').value));
    else if (act === 'lv1') a.level(a.state().level + 1);
    else if (act === 'lv5') a.level(a.state().level + 5);
    else if (act === 'class') a.setClass(q<HTMLSelectElement>('[data-s=class]').value);
    else if (act === 'give') a.give(q<HTMLSelectElement>('[data-s=item]').value, Number(q<HTMLInputElement>('[data-i=qty]').value) || 1);
    else if (act === 'gold') a.gold(10000);
    else if (act === 'gate') a.unlockGate();
    else if (act === 'kill') a.killNear();
    else if (act === 'qdone') a.questsDone(q<HTMLSelectElement>('[data-s=quest]').value);
    else if (act === 'qreset') a.questsReset();
    fill();
    (document.activeElement as HTMLElement | null)?.blur?.();   // the game's keys again
  });
  // the game listens to the keyboard on window: typing a number in the panel must not move the hero
  root.addEventListener('keydown', (e) => e.stopPropagation());
  root.addEventListener('keyup', (e) => e.stopPropagation());
}
