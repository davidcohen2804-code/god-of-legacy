// The 3D hero's items panel (the arena's and the world's HUD): the weapon in hand (the classes' weapons), then what it
// wears — a tab per slot (weapon, hat, cloak, shirt, trousers, boots, aura) with each class's piece for it, and each
// class's whole set at once. What is worn is saved for the character (items3d: this browser) and put on again next time.
import { CLASS_NAME3D, CLASS_TINT3D, CLASSES3D, ITEMS3D, SLOT_NAME, SLOTS3D, fits3D, saveEquip3D, type Slot3D } from './items3d';
import type { Hero3D, WeaponId } from './Hero3D';

export function buildItems3DPanel(o: { host: HTMLElement; hero: () => Hero3D | undefined; weapons: Record<string, { name: string }>; who: string; font: string; at?: Partial<CSSStyleDeclaration>; folded?: boolean }): HTMLElement {
  const F = o.font;
  if (!document.getElementById('gol-h3d-style2')) {
    const st = document.createElement('style'); st.id = 'gol-h3d-style2';
    st.textContent = `
.gol-h3d{position:absolute;left:24px;bottom:42px;width:430px;display:flex;flex-direction:column;gap:9px;padding:13px 15px 14px;box-sizing:border-box;pointer-events:auto;
  background:linear-gradient(rgba(6,10,18,.86),rgba(6,10,18,.72));border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.45),inset 0 0 0 1px rgba(201,154,69,.5);font-family:${F}}
.gol-h3d .hd{display:flex;justify-content:space-between;align-items:center;font:700 12px ${F};letter-spacing:2.5px;color:#f3d58a;text-shadow:0 1px 2px #000}
.gol-h3d .hd .fold{height:22px;padding:0 8px;font-size:11px;letter-spacing:1px}
.gol-h3d .row{display:flex;flex-wrap:wrap;gap:6px}
.gol-h3d button{height:30px;padding:0 10px;border-radius:7px;border:1px solid #6a5630;background:#0b121b;color:#c9b48a;font:700 11.5px ${F};letter-spacing:1.2px;cursor:pointer;text-shadow:0 1px 2px #000;white-space:nowrap}
.gol-h3d button:hover:not(:disabled){border-color:#c99a45;box-shadow:0 0 10px rgba(232,178,90,.35)}
.gol-h3d button.on{border-color:#e8b25a;background:linear-gradient(#3a2a10,#22180a);color:#ffe7a8}
.gol-h3d button:disabled{opacity:.38;cursor:default}
.gol-h3d .tabs{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.gol-h3d .tabs button{height:26px;padding:0 2px;font-size:9.5px;letter-spacing:.6px}
.gol-h3d .list{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.gol-h3d .list button{display:flex;align-items:center;gap:7px;justify-content:flex-start}
.gol-h3d .dot{width:9px;height:9px;border-radius:50%;flex:none;box-shadow:0 0 6px currentColor}
.gol-h3d .sets{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
.gol-h3d .sets span{font:700 10.5px ${F};letter-spacing:2px;color:#bfb08e;padding-right:2px}
.gol-h3d .sets button{height:26px;padding:0 8px;font-size:10.5px;letter-spacing:.8px}
.gol-h3d.min .tabs,.gol-h3d.min .list,.gol-h3d.min .sets,.gol-h3d.min .arms{display:none}
.gol-h3d.min{width:auto;padding:9px 12px}`;
    document.head.appendChild(st);
  }
  const el = document.createElement('div'); el.className = 'gol-h3d';
  if (o.at) Object.assign(el.style, o.at);
  el.addEventListener('mousedown', (e) => e.stopPropagation()); // (a click on the panel is not a blow)
  el.innerHTML = '<div class="hd"><span>3D BEGINNER · ITEMS</span><button class="fold" type="button">–</button></div><div class="row arms"></div><div class="tabs"></div><div class="list"></div><div class="sets"><span>SETS</span></div>';
  const arms = el.querySelector('.arms')!, tabs = el.querySelector('.tabs')!, list = el.querySelector('.list')!, sets = el.querySelector('.sets')!;
  const fold = el.querySelector('.fold') as HTMLButtonElement;
  // folded to its title (where the room's chat is below it: o.folded), or as the player left it last
  let was: string | null = null; try { was = localStorage.getItem('gol.items3d.panel'); } catch { /* (no storage) */ }
  const setMin = (m: boolean) => { el.classList.toggle('min', m); fold.textContent = m ? '+' : '–'; };
  setMin(was ? was === 'min' : !!o.folded);
  fold.onclick = () => { const m = !el.classList.contains('min'); setMin(m); try { localStorage.setItem('gol.items3d.panel', m ? 'min' : 'open'); } catch { /* (no storage) */ } };
  let tab: Slot3D = 'weapon';
  const save = () => { const h = o.hero(); if (h) saveEquip3D(o.who, h.worn); };
  const put = async (slot: Slot3D, id: string | null) => { const h = o.hero(); if (!h) return; await h.equip(slot, id); save(); refresh(); };
  const refresh = (): void => {
    const h = o.hero(); if (!h) return;
    arms.querySelectorAll('button').forEach((b) => b.classList.toggle('on', (b as HTMLButtonElement).dataset.id === h.weapon));
    tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', (b as HTMLButtonElement).dataset.id === tab));
    list.innerHTML = '';
    const none = document.createElement('button'); none.type = 'button'; none.textContent = '— THE BEGINNER\'S OWN'; none.classList.toggle('on', !h.worn[tab]); none.onclick = () => void put(tab, null); list.appendChild(none);
    for (const it of ITEMS3D.filter((i) => i.slot === tab)) {
      const b = document.createElement('button'); b.type = 'button';
      const d = document.createElement('i'); d.className = 'dot'; d.style.background = d.style.color = CLASS_TINT3D[it.cls]; b.appendChild(d); b.appendChild(document.createTextNode(it.name.toUpperCase()));
      b.classList.toggle('on', h.worn[tab] === it.id);
      const fits = fits3D(it, h.weapon); b.disabled = !fits; if (!fits) b.title = `The ${CLASS_NAME3D[it.cls].toLowerCase()}'s weapon (${it.weapon})`;
      b.onclick = () => void put(tab, it.id);
      list.appendChild(b);
    }
  };
  for (const [id, w] of Object.entries(o.weapons)) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = w.name; b.dataset.id = id;
    b.onclick = () => { const h = o.hero(); if (!h) return; h.setWeapon(id as WeaponId); const wi = h.worn.weapon; if (wi && !ITEMS3D.some((i) => i.id === wi && fits3D(i, id))) void put('weapon', null); else refresh(); };
    arms.appendChild(b);
  }
  for (const s of SLOTS3D) { const b = document.createElement('button'); b.type = 'button'; b.textContent = SLOT_NAME[s]; b.dataset.id = s; b.onclick = () => { tab = s; refresh(); }; tabs.appendChild(b); }
  for (const c of CLASSES3D) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = CLASS_NAME3D[c]; b.style.color = CLASS_TINT3D[c];
    b.onclick = async () => { const h = o.hero(); if (!h) return; for (const s of SLOTS3D) { const it = ITEMS3D.find((i) => i.cls === c && i.slot === s); await h.equip(s, it && fits3D(it, h.weapon) ? it.id : s === 'weapon' ? null : h.worn[s] ?? null); } save(); refresh(); };
    sets.appendChild(b);
  }
  const clr = document.createElement('button'); clr.type = 'button'; clr.textContent = 'CLEAR'; clr.onclick = async () => { const h = o.hero(); if (!h) return; for (const s of SLOTS3D) await h.equip(s, null); save(); refresh(); }; sets.appendChild(clr);
  refresh();
  o.host.appendChild(el);
  return el;
}
