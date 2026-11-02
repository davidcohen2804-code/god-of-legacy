// The lab's control rail (plain DOM beside the game canvas): art, motion, wardrobe, view, crowd, tests and benchmark.
import { EMBER_SET_B, GOLD_SET_B } from '../real/catalogB';
import type { BenchResult } from './bench';
import type { Forced, LabScene, RenderMode } from './LabScene';
import type { TestResult } from './tests';
import { WEARABLE } from '../wardrobe/resolve';
import type { WardrobeSlot } from '../wardrobe/types';
import type { Art, ZoomPreset } from './world';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, text = ''): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) el.setAttribute(k, v);
  if (text) el.textContent = text;
  return el;
};

const SLOT_LABEL: Record<string, string> = {
  hair: 'Hair', head: 'Head', eyeacc: 'Eyes', faceacc: 'Face', earring: 'Earring', top: 'Upper body', bottom: 'Lower body', overall: 'Overall',
  gloves: 'Gloves', shoes: 'Footwear', back: 'Back', weapon: 'Weapon',
};
const GEAR_SLOTS = new Set(['head', 'top', 'bottom', 'shoes', 'weapon']);

/** A row of mutually exclusive buttons. */
function segmented(host: HTMLElement | null, options: [string, string][], current: string, onPick: (v: string) => void): (v: string) => void {
  if (!host) return () => {};
  const buttons = options.map(([v, label]) => {
    const b = h('button', { type: 'button', 'data-v': v, 'aria-pressed': String(v === current) }, label);
    b.addEventListener('click', () => { set(v); onPick(v); });
    host.append(b);
    return b;
  });
  const set = (v: string) => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  return set;
}

const INTRO: Record<Art, string> = {
  base01: 'BASE-01: the base character locked by the art director, playable at the game\'s real size on the courtyard, with the items drawn on it (Traveler\'s Tunic, Wanderer Pants, Traveler Boots, Knight\'s Sword) and the animations authored for this body. Arrows to move (double-tap to run), Space to attack, E to jump.',
  b: 'Phase 5: candidate B with the second premium set, the Ember Duelist: a long split coat whose loose pieces (the near and far front panels, the split back tails, the sash end and the scarf end) each swing on their own chain, a half-cape on the near shoulder, slim trousers, riding boots and fingerless gloves. The Golden tabard keeps the trousers\' own chain, so the Ember coat can be worn over the Golden trousers. Nothing on this page changes the game.',
  placeholder: 'Phase 1 technical prototype with placeholder art: one rig, swappable outfits, two renderers. Nothing on this page changes the game.',
};
const HINT: Record<Art, string> = {
  base01: 'Every item is one picture of the base wearing it, cut automatically by the template. Pick None to take an item off; the animation keeps playing.',
  b: 'A = basic clothing, B = Golden Warrior set and the test helmet, C = Ember Duelist set, X = the plain coat stand-in (rule test). Cosmetics beat gear looks; gear keeps its stats. Job gear shows the Golden top, trousers and boots, and the job helmet shows the test helmet.',
  placeholder: 'A = cloth set, B = plate set, X = oversized and rule tests. Cosmetics beat gear looks; gear keeps its stats.',
};

export function buildUI(scene: LabScene, api: { runTests: (full: boolean) => Promise<TestResult[]>; bench: () => Promise<BenchResult[]> }): void {
  // ---- art ----
  const status = $('test-status'), table = $('test-results'), btable = $('bench-results');
  const syncArt = () => {
    const intro = $('lab-intro'), hint = $('wardrobe-hint'), gold = $('btn-gold'), ember = $('btn-ember');
    if (intro) intro.textContent = INTRO[scene.art];
    if (hint) hint.textContent = HINT[scene.art];
    if (gold) gold.hidden = scene.art !== 'b';
    if (ember) ember.hidden = scene.art !== 'b';
    const tests = $('tests-note');
    if (tests) tests.textContent = scene.art === 'b' ? 'Real-art tests of candidate B (switch to the placeholder for the Phase 1 tests).' : 'Phase 1 tests on the placeholder art.';
  };
  segmented($('seg-art'), [['base01', 'BASE-01'], ['b', 'Candidate B (earlier)'], ['placeholder', 'Placeholder · Phase 1']], scene.art, (v) => {
    scene.setArt(v as Art);
    buildSlots(); syncArt(); setGearSeg('starter'); scene.setGear('starter');
    if (crowd) crowd.checked = scene.npcs.length > 0;
    table?.replaceChildren();
    if (status) status.textContent = 'Not run yet.';
    scene.game.canvas.focus();
  });

  // ---- motion ----
  segmented($('seg-motion'), [['play', 'Play (keys)'], ['idle', 'Idle'], ['run', 'Run'], ['jump', 'Jump'], ['attack', 'Attack']], 'play', (v) => {
    scene.forced = v === 'play' ? null : (v as Forced);
    scene.game.canvas.focus();
  });
  const auto = $<HTMLInputElement>('auto-swap');
  auto?.addEventListener('change', () => { scene.autoSwapMs = auto.checked ? 400 : 0; });

  // ---- wardrobe ----
  const rows = $('slots');
  const selects = new Map<WardrobeSlot, HTMLSelectElement>();
  /** One row per wardrobe slot the art has items for (B: no hair or accessories); B's clothing has no body under it,
   *  so only its sword and cape can be hidden. */
  const buildSlots = () => {
    if (!rows) return;
    rows.querySelectorAll(':scope > :not(.hdr)').forEach((el) => el.remove());
    selects.clear();
    const real = scene.art !== 'placeholder';
    for (const slot of ['hair', ...WEARABLE] as WardrobeSlot[]) {
      if (real && scene.itemsFor(slot).length === 0) continue;
      const id = `slot-${slot}`;
      const label = h('label', { for: id }, SLOT_LABEL[slot] ?? slot);
      const sel = h('select', { id });
      sel.append(h('option', { value: '' }, slot === 'hair' ? 'Base look (short)' : GEAR_SLOTS.has(slot) ? (real ? 'Gear look' : 'Gear look / none') : 'None'));
      for (const it of scene.itemsFor(slot)) sel.append(h('option', { value: it.id }, `${it.set} · ${it.name}`));
      sel.addEventListener('change', () => { scene.equip(slot, sel.value || null); scene.game.canvas.focus(); });
      selects.set(slot, sel);
      const hideCell = h('span');
      if (real ? slot === 'weapon' || slot === 'back' : GEAR_SLOTS.has(slot) || slot === 'back') {
        const cb = h('input', { type: 'checkbox', id: `hide-${slot}`, 'aria-label': `Hide ${SLOT_LABEL[slot]}` });
        cb.addEventListener('change', () => scene.hide(slot, (cb as HTMLInputElement).checked));
        hideCell.append(cb);
      }
      rows.append(label, sel, hideCell);
    }
  };
  buildSlots(); syncArt();
  scene.onSwap = (slot, id) => {
    const sel = selects.get(slot); if (sel) sel.value = id ?? '';
    const clear = (s: WardrobeSlot) => { const x = selects.get(s); if (x) x.value = ''; };
    if (slot === 'overall' && id) { clear('top'); clear('bottom'); }
    if ((slot === 'top' || slot === 'bottom') && id) clear('overall');
  };
  $('btn-random')?.addEventListener('click', () => {
    const eq = scene.randomLook(true);
    for (const slot of ['hair', ...WEARABLE] as WardrobeSlot[]) scene.equip(slot, eq[slot] ?? null);
  });
  $('btn-clear')?.addEventListener('click', () => { for (const slot of ['hair', ...WEARABLE] as WardrobeSlot[]) scene.equip(slot, null); });
  $('btn-gold')?.addEventListener('click', () => { for (const [slot, id] of Object.entries(GOLD_SET_B)) scene.equip(slot as WardrobeSlot, id); });
  // the Ember set has no cape: its coat has its own tails and the scarf
  $('btn-ember')?.addEventListener('click', () => { scene.equip('back', null); for (const [slot, id] of Object.entries(EMBER_SET_B)) scene.equip(slot as WardrobeSlot, id); });
  const setGearSeg = segmented($('seg-gear'), [['starter', 'Starter gear'], ['job', 'Warrior job gear']], 'starter', (v) => scene.setGear(v as 'starter' | 'job'));

  // ---- view ----
  segmented($('seg-render'), [['direct', 'Direct'], ['composite', 'Composite'], ['composite-outline', 'Composite + outline']], scene.renderMode, (v) => { scene.renderMode = v as RenderMode; scene.applyView(); });
  segmented($('seg-zoom'), [['social', 'Social 1.15'], ['grinding', 'Grinding 1.0'], ['boss', 'Boss 0.85']], scene.zoomPreset, (v) => { scene.zoomPreset = v as ZoomPreset; scene.applyView(); });
  segmented($('seg-size'), [['1', '×1'], ['1.12', '×1.12'], ['1.25', '×1.25']], scene.sizeKey, (v) => { scene.sizeKey = v; scene.applyView(); });
  const prev = $<HTMLInputElement>('opt-preview');
  prev?.addEventListener('change', () => { scene.previewOn = prev.checked; scene.applyView(); });
  const bones = $<HTMLInputElement>('opt-bones');
  bones?.addEventListener('change', () => { scene.debug.bones = bones.checked; });
  const ids = $<HTMLInputElement>('opt-slots');
  ids?.addEventListener('change', () => { scene.debug.slots = ids.checked; });
  const crowd = $<HTMLInputElement>('opt-crowd');
  crowd?.addEventListener('change', () => { scene.setStress(crowd.checked ? 49 : 0); scene.applyView(); });

  // ---- readouts ----
  const out = $('readouts');
  const fmt = (v: unknown, d = 1) => (typeof v === 'number' ? v.toFixed(d) : String(v));
  const cells: [string, string, (x: Record<string, number | string>) => string][] = [
    ['ro-fps', 'Frames / s', (x) => fmt(x.fps, 0)], ['ro-frame', 'Frame ms (p95)', (x) => `${fmt(x.frameMs)} (${fmt(x.frameP95)})`],
    ['ro-update', 'Lab CPU ms (composite pass)', (x) => `${fmt(x.updateMs, 2)} (${fmt(x.compMs, 2)})`], ['ro-draws', 'Draw calls', (x) => fmt(x.drawCalls, 0)],
    ['ro-chars', 'Characters', (x) => fmt(x.characters, 0)], ['ro-b', 'Body height on screen', (x) => `${fmt(x.bScreen, 0)} px (720p: ${fmt(x.b720, 0)})`],
    ['ro-anim', 'Animation', (x) => String(x.anim)], ['ro-swaps', 'Swaps', (x) => fmt(x.swaps, 0)],
  ];
  if (out) for (const [id, label] of cells) { const d = h('div', { class: 'ro' }); d.append(h('span', { class: 'k' }, label), h('span', { class: 'v', id }, '—')); out.append(d); }
  const notes = $('ro-notes'), chip = $('chip-live');
  setInterval(() => {
    const x = scene.hud();
    for (const [id, , f] of cells) { const el = $(id); if (el) el.textContent = f(x); }
    if (notes) notes.textContent = x.notes ? `Resolver: ${x.notes}` : 'Resolver: every chosen item is shown.';
    if (chip) chip.textContent = `${fmt(x.fps, 0)} fps · ${x.drawCalls} draws · ${x.mode}`;
  }, 250);

  // ---- tests and benchmark ----
  const runT = async (full: boolean) => {
    if (status) status.textContent = 'Running…';
    const res = await api.runTests(full);
    if (table) {
      table.replaceChildren();
      for (const r of res) {
        const tr = h('tr');
        tr.append(h('td', { class: 'id' }, r.id), h('td', { class: r.pass ? 'pass' : 'fail' }, r.pass ? 'Pass' : 'Fail'), h('td', {}, r.name), h('td', { class: 'detail' }, r.detail));
        table.append(tr);
      }
    }
    if (status) status.textContent = `${res.filter((r) => r.pass).length} of ${res.length} passed`;
  };
  $('btn-tests')?.addEventListener('click', () => void runT(false));
  $('btn-tests-full')?.addEventListener('click', () => void runT(true));
  $('btn-bench')?.addEventListener('click', async () => {
    if (status) status.textContent = 'Benchmark running (about 15 s)…';
    const res = await api.bench();
    if (crowd) crowd.checked = scene.npcs.length > 0;
    if (btable) {
      btable.replaceChildren();
      for (const r of res) {
        const tr = h('tr');
        tr.append(h('td', {}, r.mode), h('td', { class: 'num' }, r.fps.toFixed(1)), h('td', { class: 'num' }, `${r.frameMean.toFixed(1)} / ${r.frameP95.toFixed(1)}`),
          h('td', { class: 'num' }, `${r.updateMean.toFixed(2)} / ${r.updateP95.toFixed(2)}`), h('td', { class: 'num' }, r.compMean ? `${r.compMean.toFixed(2)} / ${r.compP95.toFixed(2)}` : '—'),
          h('td', { class: 'num' }, `${r.drawCallsMean.toFixed(0)} (max ${r.drawCallsMax})`), h('td', { class: 'num' }, r.textureMiB.toFixed(1)));
        btable.append(tr);
      }
    }
    if (status) status.textContent = 'Benchmark done: 50 characters, 4 s per renderer, measured on this computer.';
  });
}
