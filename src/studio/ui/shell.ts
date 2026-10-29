// God of Legacy Studio — the window: the top bar (mode, undo / redo, save, export / import), the tools on the left, the
// Live Preview in the middle, the inspector's tabs on the right, the status bar; keyboard shortcuts, dialogs, files.
import type { StudioStore, Tool } from '../model/store';
import type { StudioScene } from '../engine/StudioScene';
import { isTyping } from '../engine/editor';
import type { Ctx } from './controls';
import { h, icon, ICONS, stateName } from './dom';
import { App, TABS } from './panels';

const TAB_KEY = 'gol-studio-tab';
const TOOLS: { t: Tool; ic: string; title: string; key: string }[] = [
  { t: 'select', ic: ICONS.select, title: 'בחירה והזזה', key: 'V' },
  { t: 'pan', ic: ICONS.pan, title: 'הזזת התצוגה', key: 'H' },
  { t: 'level', ic: ICONS.level, title: 'מפלס — שטח מוגבה', key: 'L' },
  { t: 'platform', ic: ICONS.platform, title: 'פלטפורמה — בלוק לקפיצה', key: 'P' },
  { t: 'oneway', ic: ICONS.oneway, title: 'פלטפורמה צפה — נוחתים מלמעלה', key: 'O' },
  { t: 'ramp', ic: ICONS.ramp, title: 'רמפה — מעבר בין מפלסים', key: 'R' },
  { t: 'spawn', ic: ICONS.spawn, title: 'נקודת התחלה', key: 'S' },
];

export interface Shell { root: HTMLElement; canvasHost: HTMLElement; app: App }

export function buildShell(store: StudioStore, getScene: () => StudioScene | null): Shell {
  const ctx: Ctx = { store, refreshers: [], live: [] };
  const modalRoot = h('div', { class: 'st-modal-root' });
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } }) as HTMLInputElement;

  // ---------------------------------------------------------------- dialogs and files
  const modal = (title: string, body: HTMLElement[], actions: { label: string; kind?: string; value: unknown }[]): Promise<unknown> => new Promise((resolve) => {
    const close = (v: unknown) => { box.remove(); resolve(v); };
    const box = h('div', { class: 'st-modal-back', onclick: (e: Event) => { if (e.target === box) close(null); } },
      h('div', { class: 'st-modal', role: 'dialog' },
        h('h3', {}, title), ...body,
        h('div', { class: 'st-modal-actions' }, ...actions.map((a) => h('button', { class: `st-btn ${a.kind ? `st-btn-${a.kind}` : ''}`, onclick: () => close(typeof a.value === 'function' ? (a.value as () => unknown)() : a.value) }, a.label)))));
    box.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(null); });
    modalRoot.append(box);
    (box.querySelector('input') ?? box.querySelector('.st-btn-primary') as HTMLElement | null)?.focus();
  });
  const app: App = {
    ctx, store, scene: getScene,
    confirm: async (title, body, ok) => (await modal(title, [h('p', {}, body)], [{ label: 'ביטול', kind: 'ghost', value: false }, { label: ok, kind: 'primary', value: true }])) === true,
    prompt: async (title, label, value) => {
      const inp = h('input', { type: 'text', class: 'st-text', value }) as HTMLInputElement;
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') (inp.closest('.st-modal')?.querySelector('.st-btn-primary') as HTMLButtonElement | null)?.click(); });
      const v = await modal(title, [h('label', { class: 'st-modal-label' }, label), inp], [{ label: 'ביטול', kind: 'ghost', value: null }, { label: 'אישור', kind: 'primary', value: () => inp.value.trim() || null }]);
      return typeof v === 'string' ? v : null;
    },
    exportJSON: () => {
      const blob = new Blob([store.toJSON()], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(store.profile.name || 'studio').replace(/[^\w֐-׿ -]+/g, '').trim() || 'studio'}.gol-studio.json`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      store.markSaved(); store.say('הקובץ יוצא');
    },
    importJSON: () => { fileInput.value = ''; fileInput.click(); },
  };
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0]; if (!f) return;
    const ok = store.fromJSON(await f.text());
    store.say(ok ? `נטען: ${f.name}` : 'הקובץ לא נקרא — זה לא קובץ של הסטודיו');
    if (ok) { getScene()?.respawn(); getScene()?.frameMap(); }
  });

  // ---------------------------------------------------------------- the top bar
  const modeBtns = ([['edit', 'עריכה', ICONS.edit], ['play', 'משחק', ICONS.play]] as const).map(([m, t, ic]) => {
    const b = h('button', { class: 'st-seg-btn st-mode-btn', title: 'Tab', onclick: () => store.setMode(m) }, icon(ic, 15), h('span', {}, t));
    ctx.refreshers.push(() => b.classList.toggle('on', store.mode === m));
    return b;
  });
  const undoB = h('button', { class: 'st-icon-btn', title: 'ביטול (Ctrl+Z)', onclick: () => store.undo() }, icon(ICONS.undo, 18));
  const redoB = h('button', { class: 'st-icon-btn', title: 'חזרה (Ctrl+Y)', onclick: () => store.redo() }, icon(ICONS.redo, 18));
  ctx.refreshers.push(() => { undoB.disabled = !store.canUndo; redoB.disabled = !store.canRedo; });
  const dirty = h('span', { class: 'st-pill' });
  ctx.refreshers.push(() => { dirty.textContent = store.dirty ? 'לא נשמר' : 'נשמר'; dirty.classList.toggle('st-pill-warn', store.dirty); });
  const update = h('button', { class: 'st-btn st-btn-small st-update', style: { display: 'none' } }, 'גרסה חדשה — רענן');
  window.addEventListener('gol-new-version', (e) => {
    update.style.display = '';
    update.onclick = async () => { if (!store.dirty || await app.confirm('לרענן לגרסה החדשה?', 'הטיוטה נשמרת בדפדפן וחוזרת אחרי הרענון.', 'רענן')) location.replace((e as CustomEvent<string>).detail); };
  });
  const gameUrl = (() => { const u = new URL(location.href); u.searchParams.delete('studio'); return u.toString(); })();
  const top = h('header', { class: 'st-top' },
    h('div', { class: 'st-brand' }, h('span', { class: 'st-brand-gol' }, 'GOD OF LEGACY'), h('span', { class: 'st-brand-studio' }, 'STUDIO')),
    h('div', { class: 'st-top-mid' }, h('div', { class: 'st-seg st-mode' }, ...modeBtns), h('div', { class: 'st-top-sep' }), undoB, redoB),
    h('div', { class: 'st-top-end' },
      update, dirty,
      h('button', { class: 'st-btn st-btn-primary', title: 'Ctrl+S', onclick: () => { if (store.saveNamed()) store.say(`נשמר: ${store.profile.name}`); } }, icon(ICONS.save, 16), h('span', {}, 'שמור')),
      h('button', { class: 'st-btn', title: 'ייצוא לקובץ JSON', onclick: () => app.exportJSON() }, icon(ICONS.download, 16), h('span', { class: 'st-btn-label' }, 'ייצוא')),
      h('button', { class: 'st-btn', title: 'ייבוא מקובץ JSON', onclick: () => app.importJSON() }, icon(ICONS.upload, 16), h('span', { class: 'st-btn-label' }, 'ייבוא')),
      h('a', { class: 'st-btn st-btn-ghost', title: 'פתח את המשחק', href: gameUrl, target: '_blank', rel: 'noopener' }, icon(ICONS.external, 16), h('span', { class: 'st-btn-label' }, 'המשחק'))));

  // ---------------------------------------------------------------- the tools
  const toolBtns = TOOLS.map(({ t, ic, title, key }) => {
    const b = h('button', { class: 'st-tool', title: `${title} (${key})`, onclick: () => store.setTool(t) }, icon(ic, 21));
    ctx.refreshers.push(() => b.classList.toggle('on', store.mode === 'edit' && store.tool === t));
    return b;
  });
  const viewBtn = (k: 'grid' | 'collisions' | 'cameraFrame', ic: string, title: string) => {
    const b = h('button', { class: 'st-tool st-tool-view', title, onclick: () => store.setView(k, !store.view[k]) }, icon(ic, 20));
    ctx.refreshers.push(() => b.classList.toggle('on', store.view[k]));
    return b;
  };
  const tools = h('aside', { class: 'st-tools' }, ...toolBtns, h('div', { class: 'st-tools-sep' }),
    viewBtn('grid', ICONS.grid, 'רשת (G)'), viewBtn('collisions', ICONS.collide, 'קווי התנגשות (C)'), viewBtn('cameraFrame', ICONS.camera, 'מסגרת מצלמה'),
    h('div', { class: 'st-tools-sep' }),
    h('button', { class: 'st-tool', title: 'הצג את כל המפה', onclick: () => { store.setMode('edit'); getScene()?.frameMap(); } }, icon(ICONS.frameAll, 20)),
    h('button', { class: 'st-tool', title: 'התמקד בדמות (F)', onclick: () => getScene()?.frameCharacter() }, icon(ICONS.focus, 20)));

  // ---------------------------------------------------------------- the preview
  const canvasHost = h('div', { class: 'st-canvas' });
  const hudMode = h('div', { class: 'st-chip st-chip-mode' });
  const hudInfo = h('div', { class: 'st-chip st-chip-info', dir: 'rtl' });
  const hudLoad = h('div', { class: 'st-chip st-chip-load' }, 'טוען…');
  const hint = h('div', { class: 'st-hint' });
  ctx.refreshers.push(() => {
    const play = store.mode === 'play';
    hudMode.replaceChildren(h('span', { class: `st-dot ${play ? 'play' : 'edit'}` }), h('b', {}, play ? 'משחק' : 'עריכה'), h('span', { class: 'st-chip-hint' }, play ? 'חצים / WASD · E קפיצה · רווח התקפה' : 'גרירה עורכת · גלגלת זום · כפתור ימני מזיז תצוגה'));
    hint.textContent = play ? 'Tab — לעריכה' : 'Tab — למשחק';
  });
  ctx.live.push(() => {
    hudInfo.textContent = `זום \u2066${store.live.zoom.toFixed(2)}×\u2069   ·   ${store.live.fps} פריימים לשנייה`;
    hudLoad.style.display = store.live.loading ? '' : 'none';
  });
  const stage = h('main', { class: 'st-stage' }, canvasHost, h('div', { class: 'st-hud' }, h('div', { class: 'st-hud-top' }, hudMode, hudLoad, h('div', { class: 'st-hud-flex' }), hudInfo), hint));

  // ---------------------------------------------------------------- the inspector
  let active = (() => { try { return localStorage.getItem(TAB_KEY) ?? 'camera'; } catch { return 'camera'; } })();
  if (!TABS.some((t) => t.id === active)) active = 'camera';
  const bodies = new Map<string, HTMLElement>();
  const tabBtns = TABS.map((t) => {
    const b = h('button', { class: 'st-tab', onclick: () => show(t.id) }, h('span', { class: 'st-tab-name' }, t.label), h('span', { class: 'st-tab-sub' }, t.sub));
    return [t.id, b] as const;
  });
  const tabBody = h('div', { class: 'st-tab-body', dir: 'rtl' });
  for (const t of TABS) { const el = t.build(app); el.dataset.tab = t.id; bodies.set(t.id, el); tabBody.append(el); }
  function show(id: string): void {
    active = id;
    try { localStorage.setItem(TAB_KEY, id); } catch { /* not kept */ }
    for (const [tid, b] of tabBtns) b.classList.toggle('on', tid === id);
    for (const [tid, el] of bodies) el.style.display = tid === id ? '' : 'none';
    tabBody.scrollTop = 0;
  }
  show(active);
  const side = h('aside', { class: 'st-side' }, h('nav', { class: 'st-tabs' }, ...tabBtns.map((b) => b[1])), tabBody);

  // ---------------------------------------------------------------- the status bar
  const sMode = h('span', { class: 'st-status-mode' }), sPos = h('span', { dir: 'ltr' }), sState = h('span', {}), sSel = h('span', {}), sMsg = h('span', { class: 'st-status-msg' });
  const status = h('footer', { class: 'st-status' }, sMode, sPos, sState, sSel, h('span', { class: 'st-hud-flex' }), sMsg);
  ctx.live.push(() => {
    const L = store.live;
    sPos.textContent = `x ${L.x}   y ${L.y}   z ${L.z}`;
    const on = L.support ? store.profile.map.objects.find((o) => o.id === L.support)?.name ?? L.support : 'הרצפה';
    sState.textContent = `${stateName(L.state)}${L.grounded ? ` · על ${on}` : ''} · ${Math.round(Math.hypot(L.vx, L.vy))} px/s · ${L.charPx}px במסך`;
  });
  ctx.refreshers.push(() => {
    sMode.textContent = store.mode === 'play' ? '● משחק' : '● עריכה';
    sMode.className = `st-status-mode ${store.mode}`;
    const sel = store.selection, o = store.profile.map.objects.find((x) => x.id === sel);
    sSel.textContent = sel ? `נבחר: ${sel === 'floor' ? 'רצפה' : sel === 'spawn' ? 'נקודת התחלה' : o?.name ?? sel}` : '';
  });
  let msgTimer = 0;
  store.on((c) => { if (c.kind === 'message') { sMsg.textContent = store.message; sMsg.classList.add('show'); clearTimeout(msgTimer); msgTimer = window.setTimeout(() => sMsg.classList.remove('show'), 3800); } });

  const root = h('div', { class: 'st-root', id: 'studio' }, top, tools, stage, side, status, modalRoot, fileInput);
  // a click on a control hands the keyboard straight back to the preview (Space must not press the last button again,
  // the arrows must move the character, not the last slider)
  root.addEventListener('click', (e) => { const t = (e.target as HTMLElement).closest('button, a') as HTMLElement | null; if (t && !modalRoot.contains(t)) t.blur(); });
  root.addEventListener('change', (e) => { const t = e.target as HTMLInputElement; if (t.type === 'range' || t.type === 'checkbox' || t.tagName === 'SELECT') t.blur(); });
  canvasHost.addEventListener('pointerdown', () => (document.activeElement as HTMLElement | null)?.blur?.());

  // ---------------------------------------------------------------- refreshing (one pass a frame at most)
  let queued = false;
  const refreshAll = () => { queued = false; for (const r of ctx.refreshers) { try { r(); } catch (e) { console.error('[studio ui]', e); } } };
  store.on((c) => {
    if (c.kind === 'live') { for (const r of ctx.live) r(); return; }
    if (c.kind === 'message') return;
    if (!queued) { queued = true; requestAnimationFrame(refreshAll); }
  });
  refreshAll();

  // ---------------------------------------------------------------- keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (isTyping() || modalRoot.childElementCount) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(), edit = store.mode === 'edit', sc = getScene();
    if (e.key === 'Tab') { e.preventDefault(); store.setMode(edit ? 'play' : 'edit'); return; }
    if (ctrl && k === 'z') { e.preventDefault(); if (e.shiftKey) store.redo(); else store.undo(); return; }
    if (ctrl && k === 'y') { e.preventDefault(); store.redo(); return; }
    if (ctrl && k === 's') { e.preventDefault(); if (store.saveNamed()) store.say(`נשמר: ${store.profile.name}`); return; }
    if (!edit) return;   // playing: every other key is the game's
    if (ctrl && k === 'd') { e.preventDefault(); sc?.editor.duplicate(); return; }
    if (ctrl) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); sc?.editor.deleteSelection(); return; }
    if (e.key === 'Escape') { store.select(null); store.setTool('select'); return; }
    const step = e.shiftKey ? store.profile.map.grid : 1;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (arrows[e.key] && store.selection) { e.preventDefault(); sc?.editor.nudge(...arrows[e.key]); return; }
    const tool = TOOLS.find((t) => t.key.toLowerCase() === k);
    if (tool) { store.setTool(tool.t); return; }
    if (k === 'g') store.setView('grid', !store.view.grid);
    else if (k === 'c') store.setView('collisions', !store.view.collisions);
    else if (k === 'f') sc?.frameCharacter();
  });

  return { root, canvasHost, app };
}
