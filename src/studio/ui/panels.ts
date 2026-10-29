// God of Legacy Studio — the inspector's panels: Camera Studio, Depth Editor, Character Studio, Movement Editor,
// Live Preview and Save / Load. Every control is bound to the profile: the preview follows it as it moves.
import { CAMERA_PRESETS, DEFAULT_CAMERA, DEFAULT_CHARACTER, DEFAULT_MOVEMENT, STAGE_CHOICES, defaultMap, defaultProfile, stageMap } from '../model/profile';
import type { ObjKind, StudioObject } from '../model/profile';
import type { StudioStore, Tool } from '../model/store';
import type { StudioScene } from '../engine/StudioScene';
import { footprint, outsideFloor } from '../engine/geometry';
import { KIND_COLOR } from '../engine/mapView';
import { kitOf } from '../engine/character';
import { CharacterStore } from '../../characters/CharacterStore';
import { genderOf, headLookOf } from '../../characters/Look';
import { wornLook } from '../../items/Gear';
import { NAKED_LOOK } from '../../game/Body';
import SKIN from '../../data/skin-tones.json';
import HAIR from '../../data/hair-colors.json';
import EYES from '../../data/eye-colors.json';
import OUTFIT from '../../data/outfit-colors.json';
import { Ctx, buttons, note, readout, section, segmented, select, showIf, slider, swatches, text, toggle } from './controls';
import { h, icon, ICONS, stateName } from './dom';

export interface App {
  ctx: Ctx;
  store: StudioStore;
  scene(): StudioScene | null;
  confirm(title: string, body: string, ok: string): Promise<boolean>;
  prompt(title: string, label: string, value: string): Promise<string | null>;
  exportJSON(): void;
  importJSON(): void;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

// ==================================================================== Camera Studio
export function cameraPanel(app: App): HTMLElement {
  const c = app.ctx, s = app.store;
  const presets = h('div', { class: 'st-row st-presets' },
    ...CAMERA_PRESETS.map((p) => h('button', { class: 'st-btn', onclick: () => s.setMany(Object.fromEntries(Object.entries({ ...DEFAULT_CAMERA, ...p.set }).map(([k, v]) => [`camera.${k}`, v]))) }, p.label)),
    h('button', { class: 'st-btn st-btn-ghost', onclick: () => s.setMany(Object.fromEntries(Object.entries(DEFAULT_CAMERA).map(([k, v]) => [`camera.${k}`, v]))) }, 'כמו במשחק'));
  return h('div', { class: 'st-panel' },
    note('המצלמה לא מסתובבת אף פעם — רק זום ותזוזה. הכול מתעדכן בתצוגה מיד; גלגלת העכבר במצב משחק משנה את הזום.'),
    presets,
    section('זום ומרחק', true,
      slider(c, { path: 'camera.zoom', label: 'זום', min: 0.3, max: 3, step: 0.01, unit: '×', help: '1 = העולם בגודל המקורי. גדול יותר = קרוב יותר.' }),
      slider(c, { path: 'camera.leash', label: 'מרחק מקסימלי מהדמות', min: 40, max: 1400, step: 10, unit: 'px', help: 'הכי רחוק שהדמות יכולה להגיע ממרכז המסך — מעבר לזה המצלמה נמשכת איתה מיד.' }),
      slider(c, { path: 'camera.runZoomOut', label: 'התרחקות בזמן ריצה', min: 0, max: 0.4, step: 0.01, show: 100, unit: '%', help: 'כמה המצלמה מתרחקת כשהדמות רצה במהירות מלאה (מצלמה דינמית).' }),
      slider(c, { path: 'camera.heightZoomOut', label: 'התרחקות בגובה', min: 0, max: 0.5, step: 0.01, show: 100, unit: '%', help: 'כמה המצלמה מתרחקת כשהדמות עומדת גבוה (לכל 300 פיקסלים של גובה).' }),
      slider(c, { path: 'character.minScreenPx', label: 'גובה דמות מינימלי במסך', min: 0, max: 400, step: 2, unit: 'px', help: 'הדמות אף פעם לא תיראה קטנה מזה, גם כשהזום רחוק — היא נשארת גדולה וברורה.' })),
    section('מעקב מצלמה', true,
      toggle(c, { path: 'camera.followX', label: 'מעקב לרוחב' }),
      toggle(c, { path: 'camera.followY', label: 'מעקב לגובה' }),
      slider(c, { path: 'camera.offsetX', label: 'היסט אופקי', min: -500, max: 500, step: 5, unit: 'px', help: 'איפה הדמות יושבת במסך לרוחב.' }),
      slider(c, { path: 'camera.offsetY', label: 'היסט אנכי', min: -500, max: 300, step: 5, unit: 'px', help: 'מינוס = המצלמה מסתכלת מעל הרגליים (הדמות יורדת במסך).' }),
      slider(c, { path: 'camera.lookAhead', label: 'הקדמה לכיוון ההליכה', min: 0, max: 500, step: 5, unit: 'px', help: 'המצלמה מקדימה את הדמות לצד שאליו היא מסתכלת, כדי שיראו מה בא.' }),
      slider(c, { path: 'camera.lookMs', label: 'זמן מעבר בהקדמה', min: 0, max: 3000, step: 25, unit: 'ms' }),
      slider(c, { path: 'camera.deadW', label: 'אזור מת — רוחב', min: 0, max: 1000, step: 5, unit: 'px', help: 'מלבן באמצע המסך שבו הדמות זזה בלי שהמצלמה זזה.' }),
      slider(c, { path: 'camera.deadH', label: 'אזור מת — גובה', min: 0, max: 600, step: 5, unit: 'px' }),
      slider(c, { path: 'camera.heightFollow', label: 'מעקב אחרי גובה הקרקע', min: 0, max: 1, step: 0.01, show: 100, unit: '%', help: 'כמה המצלמה עולה כשהדמות עומדת על משטח גבוה.' }),
      slider(c, { path: 'camera.jumpFollow', label: 'מעקב אחרי קפיצה', min: 0, max: 1, step: 0.01, show: 100, unit: '%', help: '0 = קפיצה לא מזיזה את המצלמה (כמו במשחק).' })),
    section('מהירות והחלקת מעברים', true,
      slider(c, { path: 'camera.smoothX', label: 'החלקה לרוחב', min: 0, max: 2000, step: 10, unit: 'ms', help: 'כמה זמן לוקח למצלמה להשיג את הדמות. 0 = צמודה.' }),
      slider(c, { path: 'camera.smoothY', label: 'החלקה לגובה', min: 0, max: 2000, step: 10, unit: 'ms' }),
      slider(c, { path: 'camera.maxSpeed', label: 'מהירות מקסימלית', min: 100, max: 8000, step: 50, unit: 'px/s' }),
      slider(c, { path: 'camera.zoomMs', label: 'החלקת שינויי זום', min: 0, max: 3000, step: 25, unit: 'ms' })),
    section('גבולות', false,
      toggle(c, { path: 'camera.bounds', label: 'לא לצאת מגבולות המפה' }),
      note('סיבוב מצלמה חופשי: נעול (חוק יסוד).')));
}

// ==================================================================== Depth Editor
const KIND_NAMES: Record<ObjKind, string> = { level: 'מפלס', platform: 'פלטפורמה', oneway: 'פלטפורמה צפה', ramp: 'רמפה / מעבר', prop: 'אובייקט מהמפה' };
const TOOL_BTNS: [Tool, string, string, string][] = [
  ['level', 'מפלס', ICONS.level, 'שטח מוגבה רחב שהולכים עליו (L)'], ['platform', 'פלטפורמה', ICONS.platform, 'בלוק שקופצים עליו (P)'],
  ['oneway', 'פלטפורמה צפה', ICONS.oneway, 'משטח באוויר — עוברים מתחתיו ונוחתים עליו מלמעלה (O)'], ['ramp', 'רמפה', ICONS.ramp, 'מעבר משופע בין מפלסים (R)'],
  ['spawn', 'נקודת התחלה', ICONS.spawn, 'לחץ על הרצפה (S)'],
];

export function depthPanel(app: App): HTMLElement {
  const c = app.ctx, s = app.store, m = () => s.profile.map;
  // the map
  const stagePick = h('select', { class: 'st-select' }, ...STAGE_CHOICES.map((st) => h('option', { value: st.id }, st.name))) as HTMLSelectElement;
  const loadStage = async () => {
    const map = stageMap(stagePick.value); if (!map) return;
    if (!(await app.confirm('לטעון מפה קיימת?', `המפה הנוכחית תוחלף ב-${map.name} — הרצפה, האובייקטים והציור שלה. אפשר לבטל עם ↶.`, 'טען'))) return;
    s.profile.map = map; s.select(null); s.touchMap(true); app.scene()?.respawn(); app.scene()?.frameMap();
  };
  const newMap = async () => {
    if (!(await app.confirm('מפת סטודיו חדשה?', 'המפה הנוכחית תוחלף במפת הדוגמה של הסטודיו. אפשר לבטל עם ↶.', 'החלף'))) return;
    s.profile.map = defaultMap(); s.select(null); s.touchMap(true); app.scene()?.respawn(); app.scene()?.frameMap();
  };
  const mapSec = section('מפה', true,
    text(c, { path: 'map.name', label: 'שם המפה' }),
    h('div', { class: 'st-row st-select-row' }, h('div', { class: 'st-label' }, 'מפה קיימת מהמשחק'), stagePick),
    buttons({ label: 'טען אותה לעריכה', onClick: () => void loadStage(), kind: 'primary' }, { label: 'מפת דוגמה', onClick: () => void newMap(), kind: 'ghost' }),
    segmented(c, { path: 'map.backdrop.kind', label: 'רקע', options: [['sky', 'שמיים + רצפה מצוירת'], ['stage', 'ציור של מפה']] }),
    showIf(c, () => m().backdrop.kind === 'stage', select(c, { path: 'map.backdrop.stage', label: 'הציור', options: () => STAGE_CHOICES.map((st) => [st.id, st.name]) })),
    showIf(c, () => m().backdrop.kind === 'stage', slider(c, { path: 'map.backdrop.opacity', label: 'שקיפות הציור', min: 0.1, max: 1, step: 0.05, show: 100, unit: '%' })),
    slider(c, { path: 'map.w', label: 'רוחב המפה', min: 600, max: 12000, step: 20, unit: 'px', help: 'גבולות המפה (המצלמה לא יוצאת מהם).' }),
    slider(c, { path: 'map.h', label: 'גובה המפה', min: 400, max: 4000, step: 20, unit: 'px' }),
    slider(c, { path: 'map.grid', label: 'גודל רשת', min: 5, max: 100, step: 5, unit: 'px' }),
    toggle(c, { path: 'map.snap', label: 'הצמדה לרשת' }));
  // adding
  const addSec = section('הוספה', true,
    note('בחר כלי וגרור מלבן על הרצפה בתצוגה. אחר כך: גרירה מזיזה, הידיות בצדדים משנות גודל, העיגול עם החיצים משנה גובה.'),
    h('div', { class: 'st-tool-grid' }, ...TOOL_BTNS.map(([t, label, ic, title]) => {
      const b = h('button', { class: 'st-tool-card', title, onclick: () => s.setTool(t) }, icon(ic, 22), h('span', {}, label));
      c.refreshers.push(() => b.classList.toggle('on', s.tool === t && s.mode === 'edit'));
      return b;
    })));
  // the objects
  const list = h('div', { class: 'st-objlist' });
  let listSig = '';
  const rowOf = (id: string, name: string, kind: string, color: string, meta: string, hidden?: boolean, obj?: StudioObject) => {
    const r = h('div', { class: `st-objrow ${s.selection === id ? 'on' : ''} ${hidden ? 'off' : ''}`, onclick: () => { s.select(id); if (s.mode !== 'edit') s.setMode('edit'); } },
      h('span', { class: 'st-objdot', style: { background: color } }), h('span', { class: 'st-objname' }, name), h('span', { class: 'st-objmeta' }, `${kind} · ${meta}`));
    if (obj) r.append(
      h('button', { class: 'st-icon-btn', title: obj.hidden ? 'הצג' : 'הסתר (בלי התנגשות)', onclick: (e: Event) => { e.stopPropagation(); obj.hidden = !obj.hidden; s.touchMap(true); } }, icon(obj.hidden ? ICONS.eyeOff : ICONS.eye, 15)),
      h('button', { class: 'st-icon-btn', title: 'מחק', onclick: (e: Event) => { e.stopPropagation(); s.select(obj.id); app.scene()?.editor.deleteSelection(); } }, icon(ICONS.trash, 15)));
    return r;
  };
  const height = (o: StudioObject) => (o.kind === 'ramp' ? `${Math.round(o.z0)}→${Math.round(o.z1)}` : o.kind === 'prop' ? `${Math.round(o.top ?? o.h ?? 0)}` : `${Math.round(o.z)}`);
  c.refreshers.push(() => {
    const sig = JSON.stringify([s.selection, m().objects.map((o) => [o.id, o.name, o.kind, o.hidden, height(o)]), m().floor.length]);
    if (sig === listSig) return; listSig = sig;
    list.replaceChildren(
      rowOf('floor', 'רצפה', 'רצפה', '#2a3241', `${m().floor.length} פינות`),
      rowOf('spawn', 'נקודת התחלה', 'START', '#6fe08a', `${Math.round(m().spawn.x)}, ${Math.round(m().spawn.y)}`),
      ...m().objects.map((o) => rowOf(o.id, o.name, KIND_NAMES[o.kind], KIND_COLOR[o.kind], `גובה ${height(o)}`, o.hidden, o)));
  });
  const warn = h('div');
  c.refreshers.push(() => {
    const out = outsideFloor(m());
    warn.replaceChildren(...(out.length ? [note(`${out.length} אובייקטים יוצאים מהרצפה — אי אפשר לעמוד על החלק שבחוץ.`, 'warn'), buttons({ label: 'הרחב את הרצפה שתכיל הכול', onClick: () => fitFloor(app) })] : []));
  });
  const objSec = section('אובייקטים', true, list, warn);
  // the selected one
  const inspector = h('div', { class: 'st-inspector-body' });
  const sub: Ctx = { store: s, refreshers: [], live: [] };
  let inspSig = '', inspObj: StudioObject | undefined, inspMap = m();
  c.refreshers.push(() => {
    const sel = s.selection, i = m().objects.findIndex((o) => o.id === sel), o = m().objects[i];
    const sig = `${sel}:${i}:${o?.kind}:${o?.axis}`;
    if (sig !== inspSig || o !== inspObj || m() !== inspMap) { // (another object, or the profile replaced: undo, a load)
      inspSig = sig; inspObj = o; inspMap = m(); sub.refreshers = []; sub.live = [];
      inspector.replaceChildren(...inspectorFor(app, sub, sel, i));
    }
    for (const r of sub.refreshers) r();
  });
  const selSec = section('הנבחר', true, inspector);
  return h('div', { class: 'st-panel' }, mapSec, addSec, objSec, selSec);
}

function inspectorFor(app: App, c: Ctx, sel: string | null, i: number): HTMLElement[] {
  const s = app.store, m = s.profile.map, ed = () => app.scene()?.editor;
  if (!sel) return [note('לא נבחר כלום. לחץ על אובייקט בתצוגה (במצב עריכה) או ברשימה.')];
  if (sel === 'spawn') return [
    slider(c, { path: 'map.spawn.x', label: 'X', min: 0, max: m.w, step: 1, unit: 'px', onChange: () => s.touchMap(false) }),
    slider(c, { path: 'map.spawn.y', label: 'עומק (Y)', min: 0, max: m.h, step: 1, unit: 'px', onChange: () => s.touchMap(false) }),
    buttons({ label: 'הדמות לכאן', onClick: () => app.scene()?.respawn(), kind: 'primary' })];
  if (sel === 'floor') return [
    note(`לרצפה ${m.floor.length} פינות. גרור פינה כדי להזיז אותה, ➕ על צלע מוסיף פינה, Alt + לחיצה על פינה מוחקת אותה.`),
    buttons({ label: 'רצפה מלבנית', onClick: () => rectFloor(app) }, { label: 'הרחב שתכיל הכול', onClick: () => fitFloor(app) })];
  const o = m.objects[i]; if (!o) return [];
  const P = (k: string) => `map.objects.${i}.${k}`, touch = () => s.touchMap(false);
  const rows: HTMLElement[] = [text(c, { path: P('name'), label: 'שם' })];
  if (o.kind === 'prop') {
    rows.push(
      note('אובייקט מהמפה המקורית: אפשר להזיז, לגרור פינות ולשנות גובה. הציור עצמו לא זז.'),
      slider(c, { path: P('h'), label: 'גובה (חוסם מתחתיו)', min: 0, max: 1200, step: 1, unit: 'px', onChange: touch }),
      toggle(c, { path: '', label: 'אפשר לעמוד עליו', get: () => o.top !== null && o.top !== undefined, set: (v) => { o.top = v ? Math.max(20, o.h ?? 60) : null; s.touchMap(true); } }),
      showIf(c, () => o.top !== null && o.top !== undefined, slider(c, { path: P('top'), label: 'גובה המשטח', min: 0, max: 1200, step: 1, unit: 'px', onChange: touch })),
      toggle(c, { path: P('soft'), label: 'חד־כיווני (נוחתים מלמעלה בלבד)', set: (v) => { o.soft = v; s.touchMap(true); } }));
  } else {
    rows.push(
      select(c, { path: P('kind'), label: 'סוג', options: () => (['level', 'platform', 'oneway', 'ramp'] as ObjKind[]).map((k) => [k, KIND_NAMES[k]]), onChange: () => { if (o.kind === 'ramp' && o.z1 === 0) o.z1 = Math.max(20, o.z); s.touchMap(true); } }),
      slider(c, { path: P('x'), label: 'X (משמאל)', min: -200, max: m.w, step: 1, unit: 'px', onChange: touch }),
      slider(c, { path: P('y'), label: 'עומק (Y, מאחור)', min: -200, max: m.h, step: 1, unit: 'px', onChange: touch }),
      slider(c, { path: P('w'), label: 'רוחב', min: 10, max: 4000, step: 1, unit: 'px', onChange: touch }),
      slider(c, { path: P('d'), label: 'עומק (קדימה)', min: 10, max: 1500, step: 1, unit: 'px', onChange: touch }));
    if (o.kind === 'ramp') rows.push(
      segmented(c, { path: P('axis'), label: 'כיוון השיפוע', options: [['x', 'לרוחב (שמאל→ימין)'], ['y', 'לעומק (אחור→קדימה)']] }),
      slider(c, { path: P('z0'), label: o.axis === 'x' ? 'גובה בצד שמאל' : 'גובה מאחור', min: 0, max: 1200, step: 1, unit: 'px', onChange: touch }),
      slider(c, { path: P('z1'), label: o.axis === 'x' ? 'גובה בצד ימין' : 'גובה מקדימה', min: 0, max: 1200, step: 1, unit: 'px', onChange: touch }),
      note('רמפה מחברת מפלסים: הולכים עליה למעלה ולמטה. כדאי שהקצה הגבוה ייגע במפלס באותו גובה.'));
    else rows.push(slider(c, { path: P('z'), label: o.kind === 'oneway' ? 'גובה מעל הרצפה' : 'גובה', min: 0, max: 1200, step: 1, unit: 'px', onChange: touch, extra: () => jumpHint(s, o) }));
  }
  rows.push(buttons({ label: 'שכפל', icon: ICONS.copy, onClick: () => ed()?.duplicate() }, { label: 'מחק', icon: ICONS.trash, kind: 'danger', onClick: () => ed()?.deleteSelection() }));
  return rows;
}

/** Can a jump from the floor (or the block next to it) reach this height? */
function jumpHint(s: StudioStore, o: StudioObject): string {
  const mv = s.profile.movement, hmax = (mv.jumpVz * mv.jumpVz) / (2 * mv.gravity), z = o.z;
  return z <= hmax + mv.mantle ? `קפיצה מהרצפה מגיעה (עד ${Math.round(hmax + mv.mantle)})` : `גבוה מקפיצה אחת מהרצפה (${Math.round(hmax + mv.mantle)})`;
}
function boundsOfAll(app: App): [number, number, number, number] {
  const m = app.store.profile.map, ps = [...m.floor, ...m.objects.filter((o) => !o.hidden).flatMap((o) => footprint(o))];
  const xs = ps.map((p) => p[0]), ys = ps.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function fitFloor(app: App): void {
  const [x0, y0, x1, y1] = boundsOfAll(app), pad = 12;
  app.store.profile.map.floor = [[x0 - pad, y0 - pad], [x1 + pad, y0 - pad], [x1 + pad, y1 + pad], [x0 - pad, y1 + pad]];
  app.store.touchMap(true);
}
function rectFloor(app: App): void {
  const f = app.store.profile.map.floor, xs = f.map((p) => p[0]), ys = f.map((p) => p[1]);
  app.store.profile.map.floor = [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)], [Math.min(...xs), Math.max(...ys)]];
  app.store.touchMap(true);
}

// ==================================================================== Character Studio
const CLASS_HE: [string, string][] = [['warrior', 'לוחם'], ['samurai', 'סמוראי'], ['archer', 'קשת'], ['book_mage', 'מכשף ספר'], ['gambler', 'מהמר']];
const ANIM_HE: [string, string][] = [['live', 'חי — לפי התנועה'], ['idle', 'עמידה'], ['alert', 'עמידת קרב'], ['walk', 'הליכה'], ['run', 'ריצה'], ['jump', 'קפיצה'], ['land', 'נחיתה'],
  ['attack', 'התקפה רגילה'], ['skill', 'סקיל'], ['hurt', 'פגיעה'], ['stunned', 'המום'], ['launched', 'מועף באוויר'], ['down', 'שוכב'], ['getup', 'קם'], ['win', 'ניצחון'], ['intro', 'כניסה לקרב'], ['runstop', 'עצירה מריצה']];
const sw = (list: { name: string; swatch: string }[]) => list.map((e, i) => ({ value: i, color: e.swatch, name: e.name }));

export function characterPanel(app: App): HTMLElement {
  const c = app.ctx, s = app.store, ch = () => s.profile.character, layered = () => ch().kind === 'layered';
  const mine = CharacterStore.getSelectedCharacter();
  const useMine = () => {
    const me = CharacterStore.getSelectedCharacter(); if (!me) return;
    const l = headLookOf(me), w = wornLook(CharacterStore.getGear(me.id));
    s.setMany({
      'character.kind': 'layered', 'character.gender': genderOf(me), 'character.name': me.name,
      ...(l ? { 'character.look.hair': l.hair, 'character.look.hairColor': l.hairColor, 'character.look.skin': l.skin, 'character.look.face': l.face, 'character.look.eyeColor': l.eyeColor } : {}),
      'character.gear.weapon': w.weapon, 'character.gear.top': w.top, 'character.gear.pants': w.pants, 'character.gear.shoes': w.shoes,
      'character.gear.sword': w.sword ?? '', 'character.gear.helm': w.helm ?? '', 'character.gear.suit': w.suit ?? '', 'character.gear.boots': w.boots ?? '',
    });
  };
  const looks = () => NAKED_LOOK[ch().gender] ?? { styles: 4, faces: 4 };
  return h('div', { class: 'st-panel' },
    note('הדמות מסתכלת רק ימינה או שמאלה, הפנים תמיד גלויות; למעלה ולמטה היא מחליקה לעומק בלי להסתובב.'),
    section('הדמות', true,
      segmented(c, { path: 'character.kind', label: 'סוג', options: [['layered', 'שכבות (מייפל)'], ['beginner', 'בגינר מצויר'], ['hero', 'גיבור מצויר']] }),
      showIf(c, () => ch().kind === 'hero', select(c, { path: 'character.cls', label: 'גיבור', options: () => CLASS_HE })),
      showIf(c, () => ch().kind !== 'hero', segmented(c, { path: 'character.gender', label: 'מין', options: [['male', 'זכר'], ['female', 'נקבה']] })),
      text(c, { path: 'character.name', label: 'שם' }),
      mine ? buttons({ label: `הלבש כמו הדמות שלי (${mine.name})`, onClick: useMine, kind: 'ghost' }) : null),
    section('גודל ומיקום', true,
      slider(c, { path: 'character.scale', label: 'גודל', min: 0.4, max: 3, step: 0.01, unit: '×' }),
      slider(c, { path: 'character.minScreenPx', label: 'גובה מינימלי במסך', min: 0, max: 400, step: 2, unit: 'px', help: 'גם כשהמצלמה רחוקה הדמות לא תיראה קטנה מזה.' }),
      toggle(c, { path: 'character.perspective', label: 'פרספקטיבה לפי עומק', help: 'מאחור קצת קטנה יותר, מקדימה קצת גדולה יותר.' }),
      showIf(c, () => ch().perspective, slider(c, { path: 'character.backScale', label: 'גודל מאחור', min: 0.5, max: 1.3, step: 0.01, unit: '×' })),
      showIf(c, () => ch().perspective, slider(c, { path: 'character.frontScale', label: 'גודל מקדימה', min: 0.7, max: 1.6, step: 0.01, unit: '×' })),
      segmented(c, { path: 'character.facing', label: 'כיוון מבט', options: [['right', 'ימינה ▶'], ['left', '◀ שמאלה']] }),
      readout(c, 'מיקום עכשיו (X · Y · Z)', () => `${s.live.x} · ${s.live.y} · ${s.live.z}`),
      readout(c, 'גובה במסך עכשיו', () => `${s.live.charPx}px`),
      buttons({ label: 'לנקודת ההתחלה', onClick: () => app.scene()?.respawn() }, { label: 'קבע כאן התחלה', kind: 'ghost', onClick: () => { s.profile.map.spawn = { x: s.live.x, y: s.live.y }; s.touchMap(true); } })),
    section('אנימציה', true,
      select(c, { path: 'character.anim.mode', label: 'מה מוצג', options: () => ANIM_HE }),
      showIf(c, () => ch().anim.mode === 'skill', select(c, { path: 'character.anim.skill', label: 'סקיל', options: () => kitOf(ch()).filter((k) => k.slot > 0).map((k) => [k.id, `${k.name}`]) })),
      showIf(c, () => ch().anim.mode === 'attack', slider(c, { path: 'character.anim.stage', label: 'מכה בשרשרת', min: 0, max: 3, step: 1, help: 'השלב בשרשרת ההתקפה הרגילה.' })),
      showIf(c, () => ch().anim.mode !== 'live', slider(c, { path: 'character.anim.speed', label: 'מהירות אנימציה', min: 0.1, max: 3, step: 0.05, unit: '×' })),
      showIf(c, () => ch().anim.mode !== 'live', toggle(c, { path: 'character.anim.paused', label: 'עצור על רגע אחד' })),
      showIf(c, () => ch().anim.mode !== 'live' && ch().anim.paused, slider(c, { path: 'character.anim.time', label: 'הרגע', min: 0, max: 1, step: 0.005, show: 100, unit: '%' })),
      note('במצב משחק: רווח = התקפה רגילה, 1–7 = סקילים (תנועת הגוף בלבד, בלי נזק).')),
    showIf(c, layered, section('שכבות לבוש', true,
      h('div', { class: 'st-layer-grid' }, ...([['body', 'גוף'], ['hair', 'שיער'], ['face', 'פנים'], ['helm', 'קסדה'], ['top', 'חולצה'], ['pants', 'מכנסיים'], ['shoes', 'נעליים'], ['weapon', 'נשק']] as [string, string][])
        .map(([k, t]) => toggle(c, { path: `character.layers.${k}`, label: t }))),
      select(c, { path: 'character.look.hair', label: 'תסרוקת', numeric: true, options: () => [[-1, 'קרחת'], ...Array.from({ length: looks().styles }, (_, i) => [i, `תסרוקת ${i + 1}`] as [number, string])] }),
      swatches(c, { path: 'character.look.hairColor', label: 'צבע שיער', options: sw(HAIR) }),
      swatches(c, { path: 'character.look.skin', label: 'גוון עור', options: sw(SKIN) }),
      select(c, { path: 'character.look.face', label: 'פנים', numeric: true, options: () => Array.from({ length: looks().faces }, (_, i) => [i, i === 0 ? 'פנים מקוריות' : `פנים ${i + 1}`] as [number, string]) }),
      swatches(c, { path: 'character.look.eyeColor', label: 'צבע עיניים', options: sw(EYES) }),
      swatches(c, { path: 'character.gear.top', label: 'חולצה', options: sw(OUTFIT.top), none: 'בלי חולצה' }),
      swatches(c, { path: 'character.gear.pants', label: 'מכנסיים', options: sw(OUTFIT.pants), none: 'בלי מכנסיים' }),
      swatches(c, { path: 'character.gear.shoes', label: 'נעליים', options: sw(OUTFIT.shoes), none: 'בלי נעליים' }),
      select(c, { path: 'character.gear.helm', label: 'קסדה', options: () => [['', 'בלי'], ['warrior_job', 'קסדת לוחם']] }),
      select(c, { path: 'character.gear.suit', label: 'שריון (חולצה + מכנסיים)', options: () => [['', 'בלי'], ['warrior_job', 'שריון לוחם']] }),
      select(c, { path: 'character.gear.boots', label: 'מגפי שריון', options: () => [['', 'בלי'], ['warrior_job', 'מגפי לוחם']] }),
      toggle(c, { path: 'character.gear.weapon', label: 'חרב ביד' }),
      select(c, { path: 'character.gear.sword', label: 'החרב', options: () => [['', 'חרב מתחילים'], ['warrior_job', 'חרב לוחם']] }))),
    section('סימונים', false,
      toggle(c, { path: 'character.layers.shadow', label: 'צל על הרצפה' }),
      toggle(c, { path: 'character.layers.ring', label: 'טבעת קבוצה (DFO)' }),
      toggle(c, { path: 'character.layers.name', label: 'שלט שם' })),
    buttons({ label: 'דמות כברירת המחדל', kind: 'ghost', icon: ICONS.reset, onClick: () => s.setMany(Object.fromEntries(Object.entries(JSON.parse(JSON.stringify(DEFAULT_CHARACTER)) as Record<string, unknown>).map(([k, v]) => [`character.${k}`, v]))) }));
}

// ==================================================================== Movement Editor
export function movementPanel(app: App): HTMLElement {
  const c = app.ctx, s = app.store, mv = () => s.profile.movement;
  const jumpH = () => { const m = mv(); return `גובה קפיצה: ${Math.round((m.jumpVz * m.jumpVz) / (2 * m.gravity))}px · זמן באוויר: ${Math.round((2 * m.jumpVz / m.gravity) * 1000)}ms`; };
  return h('div', { class: 'st-panel' },
    note('המקשים של המשחק: חצים או WASD לתנועה, לחיצה כפולה על כיוון = ריצה, E = קפיצה (לפי הגדרות המקשים שלך). רק במצב משחק.'),
    section('כיוונים ומהירות', true,
      toggle(c, { path: 'movement.allowDepth', label: 'תנועה לעומק (למעלה / למטה)', help: 'כבוי = כמו גלילה צדדית: למעלה ולמטה לא מזיזים.' }),
      slider(c, { path: 'movement.walk', label: 'מהירות הליכה', min: 30, max: 700, step: 1, unit: 'px/s' }),
      slider(c, { path: 'movement.run', label: 'מהירות ריצה', min: 60, max: 1000, step: 1, unit: 'px/s' }),
      slider(c, { path: 'movement.depth', label: 'מהירות לעומק', min: 0.2, max: 1.5, step: 0.01, show: 100, unit: '%', help: 'למעלה / למטה, ביחס להליכה ולריצה (100% = כמו במשחק).' })),
    section('תאוצה ושליטה', false,
      slider(c, { path: 'movement.accel', label: 'תאוצה', min: 200, max: 8000, step: 50, unit: 'px/s²' }),
      slider(c, { path: 'movement.decel', label: 'בלימה', min: 200, max: 10000, step: 50, unit: 'px/s²' }),
      slider(c, { path: 'movement.turn', label: 'אחיזה בפנייה', min: 1, max: 3, step: 0.05, unit: '×' }),
      slider(c, { path: 'movement.air', label: 'שליטה באוויר', min: 0, max: 1.5, step: 0.05, show: 100, unit: '%' }),
      slider(c, { path: 'movement.keep', label: 'שמירת מהירות בקפיצה', min: 0, max: 1.2, step: 0.01, show: 100, unit: '%' })),
    section('קפיצה', true,
      slider(c, { path: 'movement.jumpVz', label: 'עוצמת קפיצה', min: 150, max: 1400, step: 5, unit: 'px/s', extra: jumpH }),
      slider(c, { path: 'movement.gravity', label: 'כוח משיכה', min: 300, max: 5000, step: 25, unit: 'px/s²', extra: jumpH }),
      slider(c, { path: 'movement.airJumps', label: 'קפיצות נוספות באוויר', min: 0, max: 3, step: 1 }),
      showIf(c, () => mv().airJumps > 0, slider(c, { path: 'movement.airJumpVz', label: 'עוצמת קפיצה באוויר', min: 100, max: 1400, step: 5, unit: 'px/s' })),
      slider(c, { path: 'movement.mantle', label: 'עזרה בטיפוס על שפה', min: 0, max: 80, step: 1, unit: 'px', help: 'קפיצה שנגמרת קצת מתחת לשפה של משטח — מעלה את הדמות עליו.' }),
      slider(c, { path: 'movement.landMs', label: 'עצירה קצרה בנחיתה', min: 0, max: 500, step: 5, unit: 'ms' })),
    section('התנגשויות', true,
      toggle(c, { path: 'movement.collideProps', label: 'התנגשות עם אובייקטים', help: 'כבוי = עוברים דרכם (ועדיין נוחתים עליהם מלמעלה).' }),
      toggle(c, { path: 'movement.collideWalls', label: 'קצוות הרצפה הם קירות' }),
      slider(c, { path: 'movement.footR', label: 'רדיוס הרגליים', min: 2, max: 40, step: 1, unit: 'px' }),
      toggle(c, { path: '', label: 'הצג קווי התנגשות בתצוגה', get: () => s.view.collisions, set: (v) => s.setView('collisions', v) })),
    buttons({ label: 'תנועה כמו במשחק', kind: 'ghost', icon: ICONS.reset, onClick: () => s.setMany(Object.fromEntries(Object.entries(DEFAULT_MOVEMENT).map(([k, v]) => [`movement.${k}`, v]))) },
      { label: 'לנקודת ההתחלה', onClick: () => app.scene()?.respawn() }));
}

// ==================================================================== Live Preview
export function previewPanel(app: App): HTMLElement {
  const c = app.ctx, s = app.store;
  const modeSeg = h('div', { class: 'st-seg' },
    ...([['edit', 'עריכה'], ['play', 'משחק']] as const).map(([m, t]) => { const b = h('button', { class: 'st-seg-btn', onclick: () => s.setMode(m) }, t); c.refreshers.push(() => b.classList.toggle('on', s.mode === m)); return b; }));
  const speed = h('input', { type: 'range', class: 'st-range', min: '0.1', max: '2', step: '0.05' }) as HTMLInputElement;
  const speedV = h('span', { class: 'st-unit', dir: 'ltr' });
  speed.addEventListener('input', () => s.setSim(Number(speed.value), s.paused));
  c.refreshers.push(() => { speed.value = String(s.timeScale); speedV.textContent = `${s.timeScale.toFixed(2)}×`; speed.style.setProperty('--fill', `${((s.timeScale - 0.1) / 1.9) * 100}%`); });
  const vt = (k: 'grid' | 'labels' | 'geometry' | 'collisions' | 'cameraFrame', label: string, help?: string) => toggle(c, { path: '', label, help, get: () => s.view[k], set: (v) => s.setView(k, v) });
  return h('div', { class: 'st-panel' },
    section('מצב', true,
      h('div', { class: 'st-row st-seg-row' }, h('div', { class: 'st-label' }, 'עריכה / משחק (Tab)'), modeSeg),
      toggle(c, { path: '', label: 'השהיה', get: () => s.paused, set: (v) => s.setSim(s.timeScale, v) }),
      h('div', { class: 'st-row st-slider' }, h('div', { class: 'st-label' }, 'מהירות סימולציה (הילוך איטי)'), h('div', { class: 'st-slider-line' }, speed, speedV)),
      buttons({ label: 'הצג את כל המפה', icon: ICONS.frameAll, onClick: () => { s.setMode('edit'); app.scene()?.frameMap(); } }, { label: 'התמקד בדמות', icon: ICONS.focus, onClick: () => app.scene()?.frameCharacter() })),
    section('שכבות תצוגה', true,
      vt('grid', 'רשת על הרצפה'), vt('labels', 'שמות וגבהים (עריכה)'), vt('geometry', 'קווי מפה (עריכה)'),
      vt('collisions', 'קווי התנגשות', 'כתום: איפה האובייקט חוסם על הרצפה. תכלת: המשטח שעומדים עליו. לבן: הרגליים.'),
      vt('cameraFrame', 'מסגרת מצלמה (משחק)', 'צהוב: האזור המת והמרחק המקסימלי. אדום: נקודת המבט.')),
    section('מה קורה עכשיו', true,
      readout(c, 'מצב הדמות', () => `${stateName(s.live.state)} · ${s.live.facing === 'left' ? 'פונה שמאלה' : 'פונה ימינה'}`),
      readout(c, 'מיקום X · Y · Z', () => `${s.live.x} · ${s.live.y} · ${s.live.z}`),
      readout(c, 'מהירות', () => `${Math.round(Math.hypot(s.live.vx, s.live.vy))} px/s · vz ${s.live.vz}`),
      readout(c, 'עומד על', () => (s.live.grounded ? (s.live.support ? s.profile.map.objects.find((o) => o.id === s.live.support)?.name ?? s.live.support : 'רצפה') : 'באוויר')),
      readout(c, 'זום מצלמה', () => `${s.live.zoom}×`),
      readout(c, 'גובה הדמות במסך', () => `${s.live.charPx}px`),
      readout(c, 'פריימים לשנייה', () => `${s.live.fps}`)),
    section('מקשים', false,
      h('div', { class: 'st-keys' },
        ...[['Tab', 'עריכה / משחק'], ['חצים / WASD', 'תנועה (משחק)'], ['לחיצה כפולה', 'ריצה'], ['E', 'קפיצה'], ['רווח · 1–7', 'התקפה · סקילים'], ['גלגלת', 'זום'],
          ['V H L P O R S', 'כלים (עריכה)'], ['גרירה ימנית / רווח', 'הזזת תצוגה (עריכה)'], ['Delete', 'מחיקה'], ['Ctrl+D', 'שכפול'], ['חצים', 'הזזה עדינה (עריכה)'],
          ['Ctrl+Z / Ctrl+Y', 'ביטול / חזרה'], ['Ctrl+S', 'שמירה'], ['F', 'התמקד בדמות']].map(([k, t]) => h('div', { class: 'st-key-row' }, h('kbd', { dir: 'ltr' }, k), h('span', {}, t))))));
}

// ==================================================================== Save / Load
export function projectPanel(app: App): HTMLElement {
  const c = app.ctx, s = app.store;
  const list = h('div', { class: 'st-objlist' });
  const fillList = () => {
    const saves = s.savedList();
    list.replaceChildren(...(saves.length ? saves.map((sv) => h('div', { class: 'st-objrow' },
      h('span', { class: 'st-objname' }, sv.name), h('span', { class: 'st-objmeta', dir: 'ltr' }, sv.savedAt ? new Date(sv.savedAt).toLocaleString('he-IL') : ''),
      h('button', { class: 'st-btn st-btn-small', onclick: async () => { if (!s.dirty || await app.confirm('לטעון?', `ההגדרות הנוכחיות לא שמורות. לטעון את "${sv.name}" במקומן? (אפשר לבטל עם ↶)`, 'טען')) { s.loadNamed(sv.name); app.scene()?.respawn(); } } }, 'טען'),
      h('button', { class: 'st-icon-btn', title: 'מחק שמירה', onclick: async () => { if (await app.confirm('למחוק שמירה?', `"${sv.name}" יימחק מהדפדפן.`, 'מחק')) s.deleteNamed(sv.name); } }, icon(ICONS.trash, 15))))
      : [note('אין עדיין שמירות.')]));
  };
  s.on((ch) => { if (ch.kind === 'saved') fillList(); });
  fillList();
  const area = h('textarea', { class: 'st-json', spellcheck: false, dir: 'ltr' }) as HTMLTextAreaElement;
  const showJson = () => { area.value = s.toJSON(); };
  showJson();
  return h('div', { class: 'st-panel' },
    section('שמירה', true,
      text(c, { path: 'name', label: 'שם ההגדרות' }),
      buttons({ label: 'שמור (Ctrl+S)', kind: 'primary', icon: ICONS.save, onClick: () => { if (s.saveNamed()) s.say(`נשמר: ${s.profile.name}`); } },
        { label: 'שמור בשם…', onClick: async () => { const n = await app.prompt('שמור בשם', 'שם חדש להגדרות', `${s.profile.name} 2`); if (n && s.saveNamed(n)) s.say(`נשמר: ${n}`); } }),
      note('השמירות נשמרות בדפדפן הזה. טיוטה נשמרת אוטומטית כל הזמן, גם בלי ללחוץ.')),
    section('שמירות בדפדפן', true, list),
    section('קובץ JSON', true,
      buttons({ label: 'ייצוא לקובץ', icon: ICONS.download, onClick: () => app.exportJSON() }, { label: 'ייבוא מקובץ', icon: ICONS.upload, onClick: () => app.importJSON() }),
      buttons({ label: 'הצג JSON', kind: 'ghost', onClick: showJson }, { label: 'החל את ה-JSON', onClick: () => { if (s.fromJSON(area.value)) { s.say('ה-JSON הוחל'); app.scene()?.respawn(); } else s.say('ה-JSON לא תקין'); } }),
      area),
    section('איפוס', false,
      buttons({ label: 'הכול לברירת המחדל', kind: 'danger', icon: ICONS.reset, onClick: async () => {
        if (await app.confirm('לאפס הכול?', 'המצלמה, התנועה, הדמות והמפה יחזרו לברירת המחדל. אפשר לבטל עם ↶.', 'אפס')) { s.replace(defaultProfile()); app.scene()?.respawn(); app.scene()?.frameMap(); }
      } })));
}

export const TABS: { id: string; label: string; sub: string; build: (app: App) => HTMLElement }[] = [
  { id: 'camera', label: 'Camera Studio', sub: 'מצלמה', build: cameraPanel },
  { id: 'depth', label: 'Depth Editor', sub: 'עומק ומפה', build: depthPanel },
  { id: 'character', label: 'Character Studio', sub: 'דמות', build: characterPanel },
  { id: 'movement', label: 'Movement Editor', sub: 'תנועה', build: movementPanel },
  { id: 'preview', label: 'Live Preview', sub: 'תצוגה', build: previewPanel },
  { id: 'project', label: 'Save / Load', sub: 'שמירה', build: projectPanel },
];
