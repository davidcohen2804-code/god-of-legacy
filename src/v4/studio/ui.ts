// The studio's controls: animation, clock (play / pause / one frame back or forward / speed), the worn pieces, overlays.
import type { WardrobeSlot } from '../wardrobe/types';
import { KIT, type StudioScene } from './StudioScene';

// with no weapon in hand each state plays its unarmed animation (the kit's own set): the light slash becomes the punch
const ANIMS = [['rest', 'Source pose'], ['idle', 'Idle'], ['run', 'Run'], ['jump', 'Jump'], ['attack', 'Light slash'], ['attack_heavy', 'Heavy slash']] as const;
const UNARMED_LABEL: Record<string, string> = { attack: 'Punch' };
// a dagger or a staff has its own attack (its kit's): the slash buttons read as that attack, the heavy one steps aside
const KIT_LABEL: Record<string, Record<string, string>> = { dagger_1h: { attack: 'Dagger thrust' }, staff_2h: { attack: 'Staff thrust' } };

export function buildStudioUI(scene: StudioScene): void {
  const $ = (id: string) => document.getElementById(id)!;
  const press = (group: string, value: string) => document.querySelectorAll<HTMLButtonElement>(`[data-${group}]`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[group] === value)));
  const animBox = $('anims');
  for (const [id, label] of ANIMS) {
    const b = document.createElement('button'); b.textContent = label; b.dataset.anim = id;
    b.onclick = () => { scene.setAnim(id); scene.playing = true; press('anim', id); sync(); };
    animBox.appendChild(b);
  }
  press('anim', 'rest');
  // the list follows the hand: unarmed, the slash reads Punch and the heavy slash (a weapon move) steps aside
  const labels = () => {
    const bare = scene.unarmed && !!KIT.animFor;
    const kitL = !bare && KIT.animFor ? KIT_LABEL[scene.weaponKit] : undefined;
    animBox.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      const id = b.dataset.anim!, base = ANIMS.find(([a]) => a === id)![1];
      b.textContent = bare && UNARMED_LABEL[id] ? UNARMED_LABEL[id] : kitL?.[id] ?? base;
      b.hidden = (bare || !!kitL) && id === 'attack_heavy';
    });
    if ((bare || kitL) && scene.animName === 'attack_heavy') { scene.setAnim('attack'); scene.playing = true; press('anim', 'attack'); }
  };
  const clock = () => { $('clock').textContent = `${scene.anim.name} · frame ${Math.round(scene.t * 30)} / ${scene.frameCount()} · ${scene.playing ? 'playing' : 'paused'} · ×${scene.speed}`; };
  const sync = () => { $('play').textContent = scene.playing ? 'Pause' : 'Play'; clock(); };
  $('play').onclick = () => { scene.playing = !scene.playing; sync(); };
  const stepBy = (n: number) => { scene.playing = false; const f = Math.round(scene.t * 30) + n, N = scene.frameCount(); scene.t = (((f % (N + 1)) + N + 1) % (N + 1)) / 30; sync(); };
  $('back').onclick = () => stepBy(-1);
  $('fwd').onclick = () => stepBy(1);
  $('speed').onclick = () => { scene.speed = scene.speed === 1 ? 0.25 : 1; sync(); };
  // the wardrobe: per slot, nothing or one of its items (the change shows at once, mid-animation)
  const wear = $('wear');
  for (const w of KIT.wear) {
    const row = document.createElement('div'); row.className = 'slotrow';
    const t = document.createElement('span'); t.className = 'slotname'; t.textContent = w.label; row.appendChild(t);
    const opts: { id: string | null; name: string }[] = [{ id: null, name: 'None' }, ...w.items];
    for (const o of opts) {
      const b = document.createElement('button'); b.textContent = o.name; b.dataset[`w${w.slot}`] = o.id ?? 'none';
      b.onclick = () => {
        if (o.id) scene.worn[w.slot as WardrobeSlot] = o.id; else delete scene.worn[w.slot as WardrobeSlot];
        scene.applyLook(); press(`w${w.slot}`, o.id ?? 'none'); labels();
      };
      row.appendChild(b);
    }
    wear.appendChild(row);
    press(`w${w.slot}`, scene.worn[w.slot as WardrobeSlot] ?? 'none');
  }
  for (const [key, label] of [['joints', 'Skeleton'], ['layers', 'Layers']] as const) {
    const l = document.createElement('label'); l.className = 'check';
    const c = document.createElement('input'); c.type = 'checkbox'; c.checked = scene.overlays[key];
    c.onchange = () => { scene.overlays[key] = c.checked; };
    l.append(c, document.createTextNode(label)); $('overlays').appendChild(l);
  }
  window.setInterval(clock, 200);
  labels();
  sync();
}
