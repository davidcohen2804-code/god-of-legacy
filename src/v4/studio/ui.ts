// The studio's controls: animation, clock (play / pause / one frame back or forward / speed), the worn pieces, overlays.
import type { WardrobeSlot } from '../wardrobe/types';
import { BASE_OUTFIT_T } from './catalogT';
import type { StudioScene } from './StudioScene';

const ANIMS = [['rest', 'Source pose'], ['idle', 'Idle'], ['run', 'Run'], ['jump', 'Jump'], ['attack', 'Attack']] as const;
const WEAR: [WardrobeSlot, string][] = [['top', 'Shirt'], ['bottom', 'Trousers'], ['shoes', 'Boots'], ['weapon', 'Sword']];

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
  const clock = () => { $('clock').textContent = `${scene.anim.name} · frame ${Math.round(scene.t * 30)} / ${scene.frameCount()} · ${scene.playing ? 'playing' : 'paused'} · ×${scene.speed}`; };
  const sync = () => { $('play').textContent = scene.playing ? 'Pause' : 'Play'; clock(); };
  $('play').onclick = () => { scene.playing = !scene.playing; sync(); };
  const stepBy = (n: number) => { scene.playing = false; const f = Math.round(scene.t * 30) + n, N = scene.frameCount(); scene.t = (((f % (N + 1)) + N + 1) % (N + 1)) / 30; sync(); };
  $('back').onclick = () => stepBy(-1);
  $('fwd').onclick = () => stepBy(1);
  $('speed').onclick = () => { scene.speed = scene.speed === 1 ? 0.25 : 1; sync(); };
  const wear = $('wear');
  for (const [slot, label] of WEAR) {
    const l = document.createElement('label'); l.className = 'check';
    const c = document.createElement('input'); c.type = 'checkbox'; c.checked = true;
    c.onchange = () => { if (c.checked) scene.worn[slot] = BASE_OUTFIT_T[slot]; else delete scene.worn[slot]; scene.applyLook(); };
    l.append(c, document.createTextNode(label)); wear.appendChild(l);
  }
  for (const [key, label] of [['joints', 'Skeleton'], ['layers', 'Layers'], ['drawing', 'Source drawing (source pose)']] as const) {
    const l = document.createElement('label'); l.className = 'check';
    const c = document.createElement('input'); c.type = 'checkbox'; c.checked = scene.overlays[key];
    c.onchange = () => { scene.overlays[key] = c.checked; };
    l.append(c, document.createTextNode(label)); $('overlays').appendChild(l);
  }
  window.setInterval(clock, 200);
  sync();
}
