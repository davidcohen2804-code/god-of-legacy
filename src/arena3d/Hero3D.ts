// THE 3D HERO (David 24 Oct: heroes in 3D on a skeleton, so clothes and items can be changed; then "a BEGINNER whose
// ITEMS are the classes' weapons — the magic staff, the bow, the sword, the gambler's cane, the samurai sword — the
// rest of the clothes simple and the same; clothing sets later"). Behind ?hero3d=1 only; the game is untouched without it.
// The Beginner: drawn by GPT from the painted Beginner (front, back and both sides), its shape made from the front
// view (Hunyuan3D 2.1), the four views baked onto it, the skeleton fitted into it and the weights carried over from a
// base body (tools/hero3d/ai: prep, bake, rigfit; public/assets/hero3d/PROVENANCE.md).
// The moves: Quaternius Universal Animation Library 1 + 2 (CC0), laid onto this body's own bones by name.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Motion } from '../skills/ArcherMotion';

export { Doubles3D } from './Doubles3D'; // (loaded with the hero: three.js stays out of the game until a 3D place opens)

const DIR = 'assets/hero3d/';
/** The Beginner, man and woman (the player's choice in the character's creation). */
const MODEL = { m: 'beginner_m.glb', f: 'beginner_f.glb' };
const MOVES = ['moves_1.glb', 'moves_2.glb', 'moves_3.glb'];

/** The Beginner's items: the classes' weapons (one in hand at a time), each drawn by GPT and made solid from the
 *  drawing (tools/hero3d/weapons). `hand`: the hand that holds it; `loose`: how it is held standing or walking — 'hang'
 *  (a sword's point down and forward) or 'upright' (a staff, the cane, the bow: standing up at the side). */
export const WEAPONS = {
  sword: { name: 'SWORD', file: 'w_sword.glb', hand: 'r', loose: 'hang', girth: 1.25 },
  katana: { name: 'KATANA', file: 'w_katana.glb', hand: 'r', loose: 'hang', girth: 1.25 },
  bow: { name: 'BOW', file: 'w_bow.glb', hand: 'l', loose: 'upright', girth: 1.5 },
  staff: { name: 'STAFF', file: 'w_staff.glb', hand: 'r', loose: 'upright', girth: 1.7 },
  cane: { name: 'CANE', file: 'w_cane.glb', hand: 'r', loose: 'upright', girth: 2.1 },
} as const;
// (`girth`: the weapon drawn thicker than true across its length — at the fight's distance a true cane is a pixel and a
// half wide and vanishes against the trousers; game weapons read by their bulk)
export type WeaponId = keyof typeof WEAPONS;
/** Each class's weapon. */
export const CLASS_WEAPON: Record<string, WeaponId> = { warrior: 'sword', samurai: 'katana', archer: 'bow', book_mage: 'staff', gambler: 'cane' };

/** Each class skill's move from the library (a chain: one per stage), until each skill gets its own: the sword's cuts,
 *  the staff's spells, the bow's draw (built here: Bow_Shoot), the cane's swings and throws. Unlisted: by the weapon. */
const SKILL_MOVE: Record<string, string | string[]> = {
  // warrior
  warrior_basic: ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Attack'], dash_slash: 'Sword_Dash_RM', rising_slash: 'Sword_Regular_C', ground_breaker: 'Sword_Attack',
  whirlwind: 'Sword_Regular_Combo', sanctuary: 'Sword_Block', blade_storm: 'Sword_Regular_Combo', titans_verdict: 'Sword_Attack', leap_crash: 'Sword_Attack', wave_slash: 'Sword_Regular_B',
  lance_thrust: 'Sword_Dash_RM', war_cry: 'Idle_Shield_Break', judgment_blade: 'Sword_Attack', thunder_circle: 'Idle_Shield_Break', judgment_hook: 'Melee_Hook', sky_breaker: 'Sword_Regular_C',
  earthsplitter: 'Sword_Attack', shield_charge: 'Sword_Block', lions_maw: 'Sword_Regular_Combo',
  // book mage
  arcane_bolt: 'Spell_Simple_Shoot', arcane_wave: 'Spell_Simple_Shoot', binding_rune: 'Spell_Simple_Shoot', astral_burst: 'Spell_Simple_Shoot', frost_nova: 'Sword_Attack',
  lightning_chain: 'Spell_Simple_Shoot', storm_field: 'Idle_Shield_Break', time_collapse: 'Spell_Simple_Shoot', blink: 'NinjaJump_Start', glacial_spikes: 'Sword_Attack', levity_field: 'Idle_Shield_Break',
  origami_flock: 'OverhandThrow', arcane_ward: 'Sword_Block', paper_curse: 'Spell_Simple_Shoot', elemental_ascension: 'Idle_Shield_Break', rift_gates: 'Spell_Simple_Shoot', tempest_ride: 'Sword_Dash_RM',
  // archer
  quick_shot: 'Bow_Shoot', rising_arrow: 'Bow_Shoot', bow_haste: 'Roll', multi_shot: 'Bow_Shoot', explosive_arrow: 'Bow_Shoot', backstep_shot: 'Bow_Shoot', retreat_kick: 'Punch_Cross',
  vine_trap: 'Fixing_Kneeling', skyhunters_step: 'Bow_Shoot', rain_of_arrows: 'Bow_Shoot', piercing_arrow: 'Bow_Shoot', hunters_roar: 'Idle_Shield_Break', leaping_arrow: 'Bow_Shoot',
  spirit_hawk: 'Spell_Simple_Shoot', sky_rain: 'Bow_Shoot', tree_of_life: 'Fixing_Kneeling', hunters_spirit: 'Spell_Simple_Shoot', arrow_storm: 'Bow_Shoot', eagle_arrow: 'Bow_Shoot',
  // samurai
  quick_slash: ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C'], shadow_step: 'Sword_Dash_RM', sheathe: 'Sword_Block', iai_strike: 'Sword_Regular_A', sword_wave: 'Sword_Regular_B',
  mirage: 'Sword_Block', blossom_storm: 'Sword_Regular_Combo', dragon_eclipse: 'Sword_Attack', swallow_cut: 'Sword_Regular_C', hundred_cuts: 'Sword_Regular_Combo', kagemusha: 'Idle_Shield_Break',
  tornado_blade: 'Sword_Regular_Combo', falcon_dive: 'Sword_Attack', rising_sun: 'Sword_Regular_C', phantom_blades: 'OverhandThrow', god_of_blades: 'Sword_Attack', sakura_bind: 'Spell_Simple_Shoot',
  dragon_ascension: 'Sword_Regular_C',
  // gambler
  cut_the_deck: ['Melee_Hook', 'Sword_Regular_A', 'Sword_Regular_B'], charged_deal: 'OverhandThrow', staff_vault: 'Sword_Dash_RM', fuse_slam: 'Sword_Attack', riffle_shuffle: 'OverhandThrow',
  rotor_staff: 'Sword_Regular_Combo', showdown: 'OverhandThrow', coin_flip: 'OverhandThrow', roulette_wheel: 'Spell_Simple_Shoot', dice_bomb: 'OverhandThrow', light_staff: 'Idle_Shield_Break',
  ace_in_the_hole: 'OverhandThrow', long_guard: 'Sword_Block', grand_slam: 'Sword_Regular_C', staff_flurry: 'Sword_Regular_Combo', card_swap: 'OverhandThrow', call_the_deck: 'Spell_Simple_Shoot',
};

/** What the body is doing (the scene's own state, read each frame). */
export interface HeroDrive {
  x: number; y: number; z: number; vx: number; vy: number; grounded: boolean; vz: number;
  /** -1 left, 1 right */ face: number;
  /** A fixed turn (radians, 0: facing the viewer) instead of the fighter's side view (the menus' pedestal). */
  yaw?: number;
  /** the scene's body mode: idle, alert (the guard held after a blow), walk, run, air, takeoff, land, hurt, stunned, launched, down, getup, quickrise, skill, backstep, dead */
  mode: string;
  /** the cast in hand: its skill, its stage (a chain), how far in (ms), its timings */
  cast?: { id: string; stage: number; elapsed: number; startup: number; active: number; recovery: number; dash: boolean; air: boolean } | null;
}

export class Hero3D {
  /** Its own picture's scene (the arena draws it as a layer of its own, sorted among the bodies). */
  readonly scene = new THREE.Scene();
  /** In world units (1 = 100 game px), on the floor at its feet. */
  readonly root = new THREE.Group();
  /** Its cast shadow: each piece's twin on the same bones, laid flat on the floor away from the sun. */
  private shadows: [THREE.Object3D, THREE.Mesh][] = [];
  private model = new THREE.Group();
  private bones = new Map<string, THREE.Bone>();
  private body: THREE.SkinnedMesh | null = null;
  private mixer!: THREE.AnimationMixer;
  private clips = new Map<string, THREE.AnimationClip>();
  private action: THREE.AnimationAction | null = null;
  private clipNow = '';
  private castKey = '';
  private yaw = Math.PI / 2;
  /** The weapons, each in a holder on its hand's bone; one shown. */
  private weapons = new Map<WeaponId, THREE.Group>();
  /** Each weapon's two ends along its length (its own units): below the grip (-y: a cane's ferrule) and beyond it (+y: a
   *  blade's point, a staff's head). */
  private armEnds = new Map<WeaponId, [number, number]>();
  /** Each fist's grip (fitGrip): where a weapon's grip sits in the hand bone, turned as the closed fist holds it. */
  private grip: Record<'r' | 'l', { q: THREE.Quaternion; p: THREE.Vector3 }> = { r: { q: new THREE.Quaternion(), p: new THREE.Vector3() }, l: { q: new THREE.Quaternion(), p: new THREE.Vector3() } };
  /** How far the weapon is held loose (standing, walking) instead of gripped for a move. */
  private looseK = 0;
  /** The bow's string drawn back to the right hand while it aims, and the arrow on it. */
  private bowString: THREE.Line | null = null;
  private bowArrow: THREE.Group | null = null;
  private aimK = 0;
  /** A hanging blade turned flat to the viewer, its point down and a little out from the leg (the menus' pedestal faces
   *  the hero: held as in a fight, edge-on to the viewer, a sword reads as a wire). */
  flatToView = false;
  private static tq = new THREE.Quaternion(); private static tm = new THREE.Matrix4();
  weapon: WeaponId = 'sword';
  /** The standing height it is scaled to (units): the painted heroes' 124 world px and a little hair. */
  static HEIGHT = 1.3;

  /** A twin (clone()): its shape, textures, weapons and moves are its source's — never disposed with it. */
  private shared = false;
  /** What this one made for itself (a twin's own skin material, its shadows', its bowstring's): disposed with it. */
  private own: { dispose(): void }[] = [];

  private constructor() { this.root.rotation.order = 'ZYX'; this.root.add(this.model); this.scene.add(this.root); } // (ZYX: turned to face first, then tipped in the picture's plane — a somersault, a lean)

  static async load(o: { female?: boolean } = {}, onProgress?: (k: number) => void): Promise<Hero3D> {
    const h = new Hero3D();
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    const ids = Object.keys(WEAPONS) as WeaponId[];
    const files = [o.female ? MODEL.f : MODEL.m, ...MOVES, ...ids.map((w) => WEAPONS[w].file)];
    let done = 0;
    const got = await Promise.all(files.map((f) => loader.loadAsync(DIR + f).then((g) => { onProgress?.(++done / files.length); return g; })));
    const [model, ...rest2] = got, moves = rest2.slice(0, MOVES.length), arms = rest2.slice(MOVES.length);
    // the body and its own skeleton (fitted into it)
    h.model.add(model.scene);
    model.scene.traverse((o) => { if ((o as THREE.Bone).isBone) h.bones.set(o.name, o as THREE.Bone); if ((o as THREE.SkinnedMesh).isSkinnedMesh) h.body = o as THREE.SkinnedMesh; });
    model.scene.updateMatrixWorld(true);
    // the moves: in place (the game moves the body), turning the bones only — the library's bone lengths are its own
    // body's; its hips' travel is laid onto this body's hips, scaled to its height
    const pel = h.bones.get('pelvis')!, rest = pel.position.clone();
    let lib: THREE.Vector3 | null = null; moves[0]?.scene.traverse((o) => { if (o.name === 'pelvis' && !lib) lib = o.position.clone(); });
    const L = (lib as THREE.Vector3 | null) ?? new THREE.Vector3(0, 0.0501, 0.9167), k = rest.z / Math.max(0.1, L.z);
    for (const g of moves) for (const c of g.animations) {
      c.tracks = c.tracks.filter((t) => t.name.endsWith('.quaternion') || t.name === 'pelvis.position');
      for (const t of c.tracks) if (t.name === 'pelvis.position') {
        const v = t.values; for (let i = 0; i < v.length; i += 3) { v[i] = rest.x + (v[i] - L.x) * k; v[i + 1] = rest.y + (v[i + 1] - L.y) * k; v[i + 2] = rest.z + (v[i + 2] - L.z) * k; }
      }
      h.clips.set(c.name, c);
    }
    h.mixer = new THREE.AnimationMixer(h.model);
    ids.forEach((w, i) => { const bx = new THREE.Box3().setFromObject(arms[i].scene, true); h.armEnds.set(w, [bx.min.y, bx.max.y]); const g = new THREE.Group(); g.name = 'weapon'; g.add(arms[i].scene); g.visible = false; h.bones.get(`hand_${WEAPONS[w].hand}`)?.add(g); h.weapons.set(w, g); });
    h.look();
    // the size: the painted heroes' standing height, measured on the body as it stands at rest (before any move)
    h.model.updateMatrixWorld(true);
    const box = new THREE.Box3(); if (h.body) box.expandByObject(h.body, true);
    const tall = Math.max(0.5, box.max.y - box.min.y);
    // the fists' grips, from the hands as they close on a hilt (the sword stance)
    h.play('Sword_Idle', { fade: 0 }); h.mixer.update(0.3); h.model.updateMatrixWorld(true);
    h.fitGrip('r'); h.fitGrip('l');
    h.makeBowShoot(); h.makeBowString();
    h.model.scale.setScalar(Hero3D.HEIGHT / tall);
    h.setWeapon('sword');
    return h;
  }

  /** A twin of this body (Kagemusha's doubles): the same shape, textures, weapons and moves — nothing loaded or decoded
   *  again — on a skeleton of its own, doing its own move with its own weapon in hand; its skin's colour wash its own.
   *  Its root can be put into any scene (it is drawn where it is put). */
  clone(): Hero3D {
    const h = new Hero3D(); h.shared = true;
    // the shadows stay out of the copy (it lays its own: makeShadow)
    const tw = this.shadows.map(([, t]) => { const p = t.parent!; p.remove(t); return [p, t] as const; });
    const m = cloneSkinned(this.model) as THREE.Group;
    const A: THREE.Object3D[] = [], B: THREE.Object3D[] = [];
    this.model.traverse((o) => A.push(o)); m.traverse((o) => B.push(o));
    for (const [p, t] of tw) p.add(t);
    const twin = <T extends THREE.Object3D>(o: T): T => B[A.indexOf(o)] as T;
    h.root.remove(h.model); h.model = m; h.root.add(m);
    for (const [n, b] of this.bones) h.bones.set(n, twin(b));
    if (this.body) {
      h.body = twin(this.body);
      const mt = (this.body.material as THREE.MeshStandardMaterial).clone(); mt.emissive.setRGB(0, 0, 0); h.body.material = mt; h.own.push(mt);
    }
    for (const [w, g] of this.weapons) h.weapons.set(w, twin(g));
    h.armEnds = this.armEnds;
    if (this.bowString) {
      const s = twin(this.bowString); s.geometry = s.geometry.clone(); h.own.push(s.geometry);
      s.userData = { tips: (this.bowString.userData.tips as THREE.Vector3[]).map((v) => v.clone()) }; h.bowString = s;
    }
    if (this.bowArrow) h.bowArrow = twin(this.bowArrow);
    h.clips = this.clips;
    h.grip = { r: { q: this.grip.r.q.clone(), p: this.grip.r.p.clone() }, l: { q: this.grip.l.q.clone(), p: this.grip.l.p.clone() } };
    h.mixer = new THREE.AnimationMixer(h.model);
    h.flatToView = this.flatToView;
    h.setWeapon(this.weapon);
    return h;
  }

  /** A fist's grip, from the hand's own bones (the bone's own units): the grip through the fingers' second joints, a
   *  weapon's long axis out past the index side, its edge (the drawing's width) toward the knuckles. */
  private fitGrip(side: 'r' | 'l'): void {
    const hand = this.bones.get(`hand_${side}`); if (!hand) return;
    const at = (n: string) => { const b = this.bones.get(`${n}_${side}`); return b ? hand.worldToLocal(b.getWorldPosition(new THREE.Vector3())) : new THREE.Vector3(); };
    const i1 = at('index_01'), p1 = at('pinky_01'), i2 = at('index_02'), p2 = at('pinky_02'), m1 = at('middle_01');
    const y = i1.clone().add(i2).sub(p1).sub(p2).normalize();
    const x = m1.clone().normalize(); x.sub(y.clone().multiplyScalar(x.dot(y))).normalize();
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    const g = this.grip[side];
    g.q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    g.p.copy(i2.clone().add(p2).multiplyScalar(0.5).lerp(i1.clone().add(p1).multiplyScalar(0.5), 0.35));
  }

  /** The bow's move (the library has none): from the sword stance, the chest turned side-on, the bow arm straight out
   *  at the target and the string hand drawn back to the cheek — each arm reached there through its own two bones — then
   *  the loose (the string hand flies back) and home again. Built on this body's own skeleton. */
  private makeBowShoot(): void {
    const B = (n: string) => this.bones.get(n)!;
    if (!B('upperarm_l') || !B('spine_03')) return;
    const all = [...this.bones.values()];
    const snap = () => all.map((b) => b.quaternion.clone());
    const put = (qs: THREE.Quaternion[]) => { all.forEach((b, i) => b.quaternion.copy(qs[i])); this.model.updateMatrixWorld(true); };
    this.play('Sword_Idle', { fade: 0 }); this.mixer.update(0.05); this.mixer.stopAllAction(); this.action = null; this.clipNow = '';
    this.model.updateMatrixWorld(true);
    const base = snap();
    const wq = (b: THREE.Object3D) => b.getWorldQuaternion(new THREE.Quaternion()), wp = (b: THREE.Object3D) => b.getWorldPosition(new THREE.Vector3());
    // turn a bone by a world rotation
    const turn = (b: THREE.Bone, q: THREE.Quaternion) => { const pq = wq(b.parent!); b.quaternion.copy(pq.clone().invert().multiply(q).multiply(wq(b))); b.updateMatrixWorld(true); };
    // reach a two-bone arm's hand to a target, the elbow towards a pole
    const reach = (side: string, T: THREE.Vector3, pole: THREE.Vector3) => {
      const ua = B(`upperarm_${side}`), la = B(`lowerarm_${side}`), hd = B(`hand_${side}`);
      const S = wp(ua), E = wp(la), H = wp(hd), a = S.distanceTo(E), b = E.distanceTo(H);
      const d = Math.min(a + b - 1e-3, Math.max(0.05, S.distanceTo(T)));
      const u = T.clone().sub(S).normalize(), v = pole.clone().sub(S); v.addScaledVector(u, -v.dot(u)).normalize();
      const cA = (a * a + d * d - b * b) / (2 * a * d), sA = Math.sqrt(Math.max(0, 1 - cA * cA));
      const E2 = S.clone().addScaledVector(u, a * cA).addScaledVector(v, a * sA);
      turn(ua, new THREE.Quaternion().setFromUnitVectors(E.clone().sub(S).normalize(), E2.clone().sub(S).normalize()));
      const E3 = wp(la), H3 = wp(hd);
      turn(la, new THREE.Quaternion().setFromUnitVectors(H3.clone().sub(E3).normalize(), T.clone().sub(E3).normalize()));
    };
    const pose = (draw: number) => {
      put(base);
      const twist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.32 * draw);
      turn(B('spine_02'), twist); turn(B('spine_03'), twist);
      const sl = wp(B('upperarm_l')), sr = wp(B('upperarm_r')), head = wp(B('Head'));
      // the bow hand: out at the target (forward, +z), at the shoulder's height
      reach('l', sl.clone().add(new THREE.Vector3(0.06, 0.02, 0.56).multiplyScalar(1)), sl.clone().add(new THREE.Vector3(0.5, -0.3, 0)));
      // the string hand: by the cheek (drawn), from the bow forward when only nocking
      const cheek = head.clone().add(new THREE.Vector3(-0.07, -0.08, 0.06));
      const nock = sl.clone().add(new THREE.Vector3(-0.12, 0.0, 0.3));
      reach('r', nock.lerp(cheek, Math.min(1, draw)).add(new THREE.Vector3(-0.05, 0, -0.05).multiplyScalar(Math.max(0, draw - 1) * 4)), sr.clone().add(new THREE.Vector3(-0.4, 0.1, -0.5)));
      return snap();
    };
    const keys: [number, THREE.Quaternion[]][] = [[0, base], [0.22, pose(0.35)], [0.5, pose(1)], [0.6, pose(1)], [0.66, pose(1.25)], [0.95, base]];
    put(base);
    const tracks = all.map((b, i) => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, keys.map((k) => k[0]), keys.flatMap((k) => k[1][i].toArray())));
    this.clips.set('Bow_Shoot', new THREE.AnimationClip('Bow_Shoot', 0.95, tracks));
  }

  /** The bow's string as a line the right hand can draw (the drawing's straight string hidden), and an arrow. */
  private makeBowString(): void {
    const g = this.weapons.get('bow'); if (!g) return;
    let tips: THREE.Vector3[] = [];
    const root = g.children[0]; if (!root) return;
    g.updateMatrixWorld(true);
    g.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh || !/String/.test((m.material as THREE.Material).name)) return;
      m.visible = false;
      // its two ends, in the bow's own frame (the packed positions are quantized: the mesh's node carries their scale)
      const p = m.geometry.attributes.position; let lo = 0, hi = 0;
      for (let i = 0; i < p.count; i++) { if (p.getY(i) > p.getY(hi)) hi = i; if (p.getY(i) < p.getY(lo)) lo = i; }
      const at = (i: number) => root.worldToLocal(new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(m.matrixWorld));
      tips = [at(hi), at(lo)];
    });
    if (tips.length < 2) return;
    const geo = new THREE.BufferGeometry().setFromPoints([tips[0], tips[0].clone().lerp(tips[1], 0.5), tips[1]]);
    this.bowString = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xd8cfb8 }));
    this.bowString.userData.tips = tips; this.bowString.frustumCulled = false;
    root.add(this.bowString);
    // the arrow: a shaft, a steel head, three feathers (made here; the archer's own arrows fly as the skills' effects)
    const a = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.8 }), steel = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.6, roughness: 0.35 }), fl = new THREE.MeshStandardMaterial({ color: 0x2f6a3a, roughness: 0.9, side: THREE.DoubleSide });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.72, 5), wood); shaft.position.y = 0.36; a.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.06, 6), steel); tip.position.y = 0.75; a.add(tip);
    for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.09), fl); f.position.set(0, 0.07, 0); f.rotation.y = (i / 3) * Math.PI; f.translateX(0.013); a.add(f); }
    a.visible = false; this.bowArrow = a; this.model.add(a);
  }

  /** The look: the pieces' painted textures, lit like the courtyard (soft, a little rough), never mirror-bright. */
  private look(): void {
    this.model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true; m.frustumCulled = false;
      const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[];
      for (const mt of mats) {
        if (!mt || !(mt as THREE.MeshStandardMaterial).isMeshStandardMaterial) continue;
        mt.envMapIntensity = 0.6;
        mt.metalness = Math.min(mt.metalness, 0.15); mt.roughness = Math.max(mt.roughness, 0.55);
      }
    });
  }

  /** The cast shadow, from the room's sun (`sunDir`: towards the sun, world; kept up to date by the arena): every piece
   *  drawn again flattened onto the floor along the light, dark and see-through, each floor pixel once (a stencil). */
  makeShadow(sunDir: THREE.Vector3): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0x160a10, transparent: true, opacity: 0.24, depthWrite: false }); // (as faint as the painted bodies' sun shadows)
    this.own.push(mat);
    mat.stencilWrite = true; mat.stencilRef = 0; mat.stencilFunc = THREE.EqualStencilFunc; mat.stencilZPass = THREE.IncrementStencilOp;
    const uSun = { value: sunDir };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uSun = uSun;
      sh.vertexShader = 'uniform vec3 uSun;\n' + sh.vertexShader.replace('#include <project_vertex>', `
        vec4 wsp = modelMatrix * vec4( transformed, 1.0 );
        wsp.xyz -= uSun * ( max( wsp.y, 0.0 ) / max( uSun.y, 0.2 ) );
        wsp.y = 0.004;
        vec4 mvPosition = viewMatrix * wsp;
        gl_Position = projectionMatrix * mvPosition;`);
    };
    mat.customProgramCacheKey = () => 'hero-shadow';
    const src: THREE.Mesh[] = [];
    this.model.traverse((o) => { if ((o as THREE.Mesh).isMesh) src.push(o as THREE.Mesh); });
    for (const m of src) {
      const sk = m as THREE.SkinnedMesh;
      let t: THREE.Mesh;
      if (sk.isSkinnedMesh) { const tw = new THREE.SkinnedMesh(sk.geometry, mat); tw.bind(sk.skeleton, sk.bindMatrix); t = tw; } else t = new THREE.Mesh(m.geometry, mat);
      t.frustumCulled = false; t.renderOrder = 5;
      t.position.copy(m.position); t.quaternion.copy(m.quaternion); t.scale.copy(m.scale);
      m.parent!.add(t); this.shadows.push([m, t]);
    }
  }
  private shown(o: THREE.Object3D): boolean { for (let p: THREE.Object3D | null = o; p && p !== this.model; p = p.parent) if (!p.visible) return false; return true; }

  /** The body's colour wash (a blow taken, a freeze, armour): its cloth and skin glow faintly in it; null: none. */
  private tintNow: number | null = -1;
  tintBody(tint: number | null): void {
    if (tint === this.tintNow) return;
    this.tintNow = tint;
    const m = this.body?.material as THREE.MeshStandardMaterial | undefined; if (!m) return;
    if (tint === null) m.emissive.setRGB(0, 0, 0); else m.emissive.setHex(tint).multiplyScalar(0.32);
  }

  /** Afterimages (a dash's blur, a leap's trail): the body's pose a moment ago, flat in a colour, fading — a small pool of
   *  meshes, each a copy of the body's skin computed once per image (no new buffers while it runs). */
  private ghosts: { m: THREE.Mesh; t: number }[] = [];
  private lastGhost = -Infinity;
  ghost(now: number, on: boolean, tint: number, every = 45): void {
    if (!on || !this.body || now - this.lastGhost < every) return;
    this.lastGhost = now;
    const src = this.body, P = src.geometry.attributes.position, n = P.count;
    let g = this.ghosts.find((x) => x.t >= 1);
    if (!g) {
      if (this.ghosts.length >= 8) g = this.ghosts.reduce((a, b) => (a.t > b.t ? a : b));
      else {
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
        if (src.geometry.index) geo.setIndex(new THREE.BufferAttribute((src.geometry.index.array as Uint32Array).slice(), 1));
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        m.frustumCulled = false; m.renderOrder = 4; (this.root.parent ?? this.scene).add(m); g = { m, t: 1 }; this.ghosts.push(g); this.own.push(geo, m.material as THREE.Material); // (in the scene the body is drawn in)
      }
    }
    const out = (g.m.geometry.attributes.position as THREE.BufferAttribute), v = Hero3D.tv;
    this.root.updateMatrixWorld(true); // (the bones where the move has them now)
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(P, i); src.applyBoneTransform(i, v); v.applyMatrix4(src.matrixWorld); out.setXYZ(i, v.x, v.y, v.z); }
    out.needsUpdate = true;
    (g.m.material as THREE.MeshBasicMaterial).color.setHex(tint);
    g.t = 0; g.m.visible = true;
  }
  /** The body as it stands this moment, drawn flat into `out` (its shadow and afterimages left out) — a frame for the
   *  effects that copy a body (Arena3D.bodyShot). */
  snapshot(a3: { bodyShot(sc: THREE.Scene, feet: THREE.Vector3, out: HTMLCanvasElement, ppu: number, ox: number, oy: number): void }, out: HTMLCanvasElement, ppu: number, ox: number, oy: number): void {
    const hide = [...this.shadows.map(([, t]) => t), ...this.ghosts.map((g) => g.m)].filter((o) => o.visible);
    for (const o of hide) o.visible = false;
    this.root.updateMatrixWorld(true);
    a3.bodyShot(this.scene, this.root.position, out, ppu, ox, oy);
    for (const o of hide) o.visible = true;
  }

  /** The weapon in hand as a line, its grip → an end (px from the feet: x along the picture, y down): `beyond` the grip
   *  (a sword's point: Radiant Blade's light) or below it (the cane's shaft: the gambler's Light Staff). */
  weaponLine(beyond = false): number[] | null {
    const g = this.weapons.get(this.weapon), e = this.armEnds.get(this.weapon); if (!g || !e) return null;
    g.updateWorldMatrix(true, false);
    const a = new THREE.Vector3().applyMatrix4(g.matrixWorld), t = new THREE.Vector3(0, beyond ? e[1] : e[0], 0).applyMatrix4(g.matrixWorld), r = this.root.position;
    return [(a.x - r.x) * 100, -(a.y - r.y) * 100, (t.x - r.x) * 100, -(t.y - r.y) * 100];
  }

  /** Where its eyes are (px from the feet: x along the picture, y down) — War Cry's and Radiant Blade's glowing eyes. */
  eyePoint(): [number, number] | null {
    const hd = this.bones.get('Head'); if (!hd) return null;
    hd.updateWorldMatrix(true, false);
    const p = hd.getWorldPosition(new THREE.Vector3()), k = this.model.scale.x, r = this.root.position;
    p.y += 0.095 * k; p.x += Math.sin(this.yaw) * 0.075 * k; p.z += Math.cos(this.yaw) * 0.075 * k; // (above the neck joint, at the face)
    return [(p.x - r.x) * 100, -(p.y - r.y) * 100];
  }

  /** No afterimages left (the body goes away for a while: the next time it shows, none of the last ones linger). */
  clearGhosts(): void { for (const g of this.ghosts) { g.t = 1; g.m.visible = false; } }
  private fadeGhosts(ms: number): void {
    for (const g of this.ghosts) { if (g.t >= 1) { g.m.visible = false; continue; } g.t = Math.min(1, g.t + ms / 260); const k = 1 - g.t; (g.m.material as THREE.MeshBasicMaterial).opacity = 0.42 * k * k; }
  }
  private static tv = new THREE.Vector3();

  /** Take an item in hand (the Beginner's weapons): that one shown, gripped by its hand. */
  setWeapon(id: WeaponId): void {
    this.weapon = id;
    if (this.bowArrow) this.bowArrow.visible = false; // (no arrow left nocked when the bow is put away)
    for (const [w, g] of this.weapons) {
      g.visible = w === id; if (w !== id) continue;
      const gp = this.grip[WEAPONS[w].hand]; g.position.copy(gp.p); g.quaternion.copy(gp.q); g.scale.set(WEAPONS[w].girth, 1, WEAPONS[w].girth);
    }
    this.castKey = ''; this.clipNow = '';
  }

  /** Crossfade to a clip. */
  play(name: string, o: { fade?: number; once?: boolean; speed?: number; restart?: boolean } = {}): void {
    const clip = this.clips.get(name); if (!clip) return;
    const a = this.mixer.clipAction(clip);
    a.timeScale = o.speed ?? 1;
    if (name === this.clipNow && !o.restart) return;
    a.reset(); a.enabled = true;
    a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = !!o.once;
    const f = o.fade ?? 0.14;
    if (this.action && f > 0) a.crossFadeFrom(this.action, f, true); else this.action?.stop();
    a.play(); this.action = a; this.clipNow = name;
  }
  clipLength(name: string): number { return this.clips.get(name)?.duration ?? 1; }

  /** One frame: the body where the game has it, facing its way, the move its state calls for. */
  drive(d: HeroDrive, ms: number): void {
    const U = 100;
    this.root.position.set(d.x / U, d.z / U, (d.y / U) * 1.15);
    // side view, turned a little to the camera (a fighter's three-quarter); a turn eases round
    if (d.yaw !== undefined) this.yaw = d.yaw;
    else { const want = d.face >= 0 ? Math.PI / 2 - 0.42 : -Math.PI / 2 + 0.42; this.yaw += (want - this.yaw) * Math.min(1, ms / 70); }
    this.root.rotation.set(0, this.yaw, 0); this.root.scale.set(1, 1, 1); // (motion() tips and stretches it after)
    const sp = Math.hypot(d.vx, d.vy), k = this.model.scale.x;
    const c = d.cast;
    if (d.mode === 'skill' && c) {
      const key = `${c.id}:${c.stage}:${Math.round(c.startup)}`;
      if (key !== this.castKey) {
        this.castKey = key;
        const clip = this.attackClip(c), len = this.clipLength(clip), speed = Math.min(3, Math.max(0.6, (len * 1000 * this.hitShare(clip)) / Math.max(60, c.startup + c.active * 0.5)));
        this.play(clip, { once: true, restart: true, fade: 0.06, speed });
        if (c.elapsed > 0 && this.action) this.action.time = Math.min(len * 0.98, (c.elapsed / 1000) * speed); // (a cast seen late — another player's, a double joining his swing — picks up where it is)
      }
    } else {
      this.castKey = '';
      switch (d.mode) {
        case 'walk': this.play('Walk_Loop', { speed: Math.max(0.5, sp / (1.25 * U * k / 0.72)) }); break;
        case 'run': this.play(sp > 240 ? 'Sprint_Loop' : 'Jog_Fwd_Loop', { speed: Math.max(0.6, sp / (sp > 240 ? 330 : 250)) }); break;
        case 'takeoff': this.play('Jump_Start', { once: true, fade: 0.06, speed: 1.6 }); break;
        case 'air': case 'backstep': this.play(d.vz > 60 ? 'NinjaJump_Idle_Loop' : 'Jump_Loop', { fade: 0.18 }); break;
        case 'land': this.play('Jump_Land', { once: true, fade: 0.06, speed: 1.8 }); break;
        case 'hurt': this.play('Hit_Chest', { once: true, restart: this.clipNow === 'Hit_Chest' ? false : true, fade: 0.05 }); break;
        case 'stunned': this.play('Hit_Head', { once: true, fade: 0.08, speed: 0.6 }); break;
        case 'launched': this.play('Hit_Knockback', { once: true, fade: 0.06, speed: 0.8 }); break;
        case 'down': case 'dead': this.play('Death01', { once: true, fade: 0.1, speed: 1.5 }); break;
        case 'getup': this.play('LayToIdle', { once: true, fade: 0.1, speed: 1.4 }); break;
        case 'quickrise': this.play('LayToIdle', { once: true, fade: 0.06, speed: 2.4 }); break;
        case 'alert': this.play(this.weapon === 'staff' ? 'Spell_Simple_Idle_Loop' : 'Sword_Idle', { fade: 0.2 }); break; // (after a blow or a hit: the guard held a moment — a staff's, its spell ready)
        default: this.play('Idle_Loop', { fade: 0.25 });
      }
    }
    this.mixer.update(ms / 1000);
    this.hold(ms);
    this.fadeGhosts(ms);
    for (const [m, t] of this.shadows) t.visible = this.shown(m);
  }

  /** Held still in a move, `t` seconds in, turned `yaw` (0: facing the viewer) — the splash art's and the portraits'
   *  poses (tools/hero3d/art). */
  pose(clip: string, t: number, yaw: number): void {
    this.play(clip, { fade: 0, restart: true, once: true });
    if (this.action) this.action.time = Math.min(t, this.clipLength(clip) * 0.99);
    this.yaw = yaw; this.root.position.set(0, 0, 0); this.root.rotation.set(0, yaw, 0); this.root.scale.set(1, 1, 1);
    this.mixer.update(0);
    this.root.updateMatrixWorld(true); // (the hands where the move has them: the bowstring is drawn to them)
    this.hold(1000); // (the weapon settled at once)
    this.root.updateMatrixWorld(true);
  }

  /** The painted bodies' motion layer laid on this one (after drive): the recoil and the lean of a shot, a leap's arc,
   *  a somersault turned round a point above the feet in the picture's plane, a spin (facing the other way), a squash —
   *  the same numbers every client draws the painted body by (ArcherMotion, SamuraiMotion). */
  motion(m: Motion | null): void {
    if (!m) return;
    const r = this.root, U = 100;
    r.position.x += m.dx / U; r.position.y -= m.dy / U;
    if (m.flip) r.rotation.y = -this.yaw; // (a spin seen from the side: the other way, still three-quarter to the viewer)
    const th = -(m.ang * Math.PI) / 180; // (the picture's clockwise is the 3D's negative turn about the axis toward the viewer)
    if (th) { const h = m.pivot / U; r.position.x += h * Math.sin(th); r.position.y += h - h * Math.cos(th); r.rotation.z = th; }
    if (m.sx !== 1 || m.sy !== 1) r.scale.set(1, m.sy, m.sx); // (the body faces along x: its length on screen is its local z)
  }

  /** Standing or walking the weapon is held loose — a sword hangs, its point down and forward (the painted warrior's
   *  idle); a staff, the cane and the bow stand upright at the side — and in a move it is gripped as the move holds it. */
  private hold(ms: number): void {
    const W = WEAPONS[this.weapon], g = this.weapons.get(this.weapon); if (!g) return;
    const grip = this.grip[W.hand];
    if (this.weapon === 'bow' && this.aimBow(ms, g)) return;
    const loose = this.clipNow === 'Idle_Loop' || this.clipNow === 'Walk_Loop' || W.loose === 'upright' && /^(Sword_Idle|Spell_Simple|Idle_Shield_Break|Fixing_Kneeling|Idle_Talking|Dance|Bow_Shoot)/.test(this.clipNow); // (a staff, the cane, the bow stand upright through a spell, a rallying cry, a kneel)
    this.looseK += ((loose ? 1 : 0) - this.looseK) * Math.min(1, ms / 140);
    const hand = this.bones.get(`hand_${W.hand}`);
    if (!hand || this.looseK < 0.002) { g.quaternion.copy(grip.q); return; }
    hand.updateWorldMatrix(true, false);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const side = W.hand === 'r' ? 1 : -1, rx = -fz * side, rz = fx * side; // (the holding hand's side, outward)
    const y = W.loose === 'hang' ? (this.flatToView ? new THREE.Vector3(rx * 0.3 + fx * 0.12, -0.95, rz * 0.3 + fz * 0.12) : new THREE.Vector3(fx * 0.5, -0.86, fz * 0.5)).normalize() : new THREE.Vector3(fx * 0.12, 1, fz * 0.12).normalize();
    const x = W.loose === 'hang' && this.flatToView ? new THREE.Vector3(rx, 0, rz) : W.loose === 'hang' || W.hand === 'r' ? new THREE.Vector3(fx, 0, fz) : new THREE.Vector3(-fx, 0, -fz); x.addScaledVector(y, -x.dot(y)).normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    const want = Hero3D.tq.setFromRotationMatrix(Hero3D.tm.makeBasis(x, y, z));
    const held = hand.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(want);
    g.quaternion.slerpQuaternions(grip.q, held, this.looseK);
  }

  /** The bow in the draw: upright, its string toward the archer, the string pulled to the right hand and the arrow on
   *  it until the loose. Returns false when the bow is not in a shot. */
  private aimBow(ms: number, g: THREE.Group): boolean {
    const shooting = this.clipNow === 'Bow_Shoot' && !!this.action?.isRunning();
    const t = shooting ? this.action!.time : 0;
    this.aimK += ((shooting ? 1 : 0) - this.aimK) * Math.min(1, ms / 90);
    const S = this.bowString, A = this.bowArrow, hand = this.bones.get('hand_l'), rh = this.bones.get('hand_r');
    const drawn = shooting && t > 0.12 && t < 0.62, aiming = this.aimK >= 0.002 && !!hand;
    if (aiming) { // upright, its string toward the archer, held as it stood (the draw never passes through the fist's own turn)
      hand!.updateWorldMatrix(true, false);
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      const y = new THREE.Vector3(0, 1, 0), x = new THREE.Vector3(-fx, 0, -fz), z = new THREE.Vector3().crossVectors(x, y);
      const want = Hero3D.tq.setFromRotationMatrix(Hero3D.tm.makeBasis(x, y, z));
      g.quaternion.copy(hand!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(want));
      g.updateMatrixWorld(true); // (the string's hand point is taken in the bow as it is held now)
    }
    rh?.updateWorldMatrix(true, false);
    if (S) {
      const pos = S.geometry.attributes.position as THREE.BufferAttribute, tips = S.userData.tips as THREE.Vector3[];
      const mid = tips[0].clone().lerp(tips[1], 0.5);
      if (drawn && rh) { const p = this.grip.r.p.clone(); rh.localToWorld(p); S.parent!.worldToLocal(p); mid.copy(p); }
      pos.setXYZ(1, mid.x, mid.y, mid.z); pos.needsUpdate = true;
    }
    if (A && rh && hand) {
      A.visible = drawn;
      if (drawn) {
        const from = rh.localToWorld(this.grip.r.p.clone()), to = hand.localToWorld(this.grip.l.p.clone());
        this.model.worldToLocal(from); this.model.worldToLocal(to);
        A.position.copy(from); A.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
      }
    }
    return aiming;
  }

  /** Each skill one of the library's moves for the weapon in hand (stand-ins: the skills get their own moves later). */
  private attackClip(c: NonNullable<HeroDrive['cast']>): string {
    const w = this.weapon, id = c.id;
    const m = SKILL_MOVE[id], pick = Array.isArray(m) ? m[c.stage % m.length] : m;
    if (pick && this.clips.has(pick)) return pick;
    const buff = /war_cry|oath|banner|sanctuary|radiant|aura|ward|barrier|haste|focus|sheathe|meditat|all_in|lucky/.test(id);
    if (w === 'sword' || w === 'katana') {
      if (/_basic$|quick_slash/.test(id)) return ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Attack'][c.stage % 4];
      if (c.dash) return 'Sword_Dash_RM';
      if (c.air) return 'Sword_Attack';
      if (buff) return 'Idle_Shield_Break';
      if (/whirl|storm|tide|circle|spin/.test(id)) return 'Sword_Regular_Combo';
      if (/rising|sky|lance|hook|swallow/.test(id)) return 'Sword_Regular_C';
      if (/ground|earth|leap|crash|verdict|maw|iai/.test(id)) return 'Sword_Attack';
      return 'Sword_Regular_B';
    }
    if (buff) return 'Idle_Shield_Break';
    if (c.dash) return w === 'bow' ? 'Roll' : 'Sword_Dash_RM';
    if (w === 'cane') {
      if (/deal|card|deck|ace|joker|throw|fuse/.test(id)) return 'OverhandThrow';
      if (/_basic$/.test(id)) return ['Melee_Hook', 'Sword_Regular_A', 'Sword_Regular_B'][c.stage % 3];
      return /rotor|vault|spin/.test(id) ? 'Sword_Regular_Combo' : 'Sword_Regular_C';
    }
    if (w === 'staff') {
      if (/_basic$|flurry|strike/.test(id)) return ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C'][c.stage % 3];
      return 'OverhandThrow';
    }
    return this.clips.has('Bow_Shoot') ? 'Bow_Shoot' : 'OverhandThrow'; // the bow
  }
  /** Where in a sword clip its blow falls (share of its length): the clip is timed so the blow meets the skill's hit. */
  private hitShare(clip: string): number {
    return ({ Sword_Regular_A: 0.45, Sword_Regular_B: 0.42, Sword_Regular_C: 0.3, Sword_Attack: 0.45, Sword_Dash_RM: 0.35, Sword_Regular_Combo: 0.25, Idle_Shield_Break: 0.4, OverhandThrow: 0.42, Melee_Hook: 0.4, Roll: 0.3, Bow_Shoot: 0.62, Spell_Simple_Shoot: 0.3, Punch_Jab: 0.35, Punch_Cross: 0.35, Fixing_Kneeling: 0.25, Sword_Block: 0.25, NinjaJump_Start: 0.4 } as Record<string, number>)[clip] ?? 0.4;
  }

  dispose(): void {
    this.mixer?.stopAllAction();
    for (const g of this.ghosts) g.m.removeFromParent();
    for (const o of this.own) o.dispose();
    if (this.shared) { this.root.removeFromParent(); return; } // (a twin: the shape, textures and weapons are its source's)
    this.root.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      m.geometry?.dispose();
      for (const mt of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.Material[]) {
        for (const v of Object.values(mt)) if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
        mt.dispose();
      }
    });
    this.root.removeFromParent();
  }
}
