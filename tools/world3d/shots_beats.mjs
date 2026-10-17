// The story camera's beats on the 3D stage (docs/WORLD_3D_SPEC.md §1.8): the chapter opening's start, a talk's push-in
// and its release, a quest accepted turning the camera, a boss entrance. Usage: node tools/world3d/shots_beats.mjs
import { open, W, OUT } from './harness.mjs';
const { b, p, errors, state, shot, tele, settleCam, openGate } = await open({ settle: 2000 });
const cam = () => p.evaluate(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); return { punch: +s.a3d.punch.toFixed(3), fx: Math.round(s.a3d.focus.x), dim: +s.a3d.dimWant.toFixed(2), swing: +s.a3d.swing.toFixed(2), talk: !!s.npcDialog?.isOpen, title: document.querySelector('.gol-area b')?.textContent, on: document.querySelector('.gol-area')?.classList.contains('on') }; });
console.log('opening', JSON.stringify(await cam())); await W(p, 4000); console.log('opening+4s', JSON.stringify(await cam()));
await p.keyboard.press('KeyA'); await W(p, 2500); console.log('skipped', JSON.stringify(await cam()));
// a talk with Aldric: nearer, then back
await tele(820, 455); await settleCam(); await W(p, 2000);
await p.keyboard.press('KeyY'); await W(p, 3500); const t1 = await cam(); console.log('talk', JSON.stringify(t1)); await shot(`${OUT}/b_talk.jpg`);
await p.keyboard.press('KeyY'); await W(p, 1500); await p.keyboard.press('KeyY'); await W(p, 1500); await p.keyboard.press('KeyY'); await W(p, 2500); console.log('after talk', JSON.stringify(await cam()));
// accept the quest if offered: the camera turns to show the way (east)
const choice = await p.$('.gol-dlg .main, .gol-npc .main, button:has-text("I\'m ready")'); if (choice) { await choice.click(); await W(p, 1200); console.log('show', JSON.stringify(await cam())); }
// a boss entrance: the Shade Fox at the Elder Hollow
await openGate(); await tele(31640 + 560, 520); await settleCam(); await W(p, 1500); console.log('boss', JSON.stringify(await cam()), JSON.stringify(await state())); await shot(`${OUT}/b_boss.jpg`);
await W(p, 4000); console.log('boss+4s', JSON.stringify(await cam()));
console.log('errors', errors.length, errors.slice(0, 12).join('\n'));
await b.close();
