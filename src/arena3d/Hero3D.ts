// THE 3D HERO TEST (David 24 Oct 12:15: "start the test — mind the game's frame, the character's size and the map"):
// a hero built as one body on a skeleton, every piece of clothing its own file on that same skeleton — so any piece
// fits every move (walk, run, jump, a blow, a fall, getting up) with nothing drawn again. Behind ?hero3d=1 only; the
// game is untouched without it.
// Pieces: Quaternius (CC0) — Universal Base Characters (the body, head, eyes, brows, hair), Modular Character Outfits –
// Fantasy (the Ranger and the Peasant), Universal Animation Library 1 + 2 (the moves); packed by tools/hero3d/build.mjs
// into public/assets/hero3d (see its PROVENANCE.md).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const DIR = 'assets/hero3d/';

/** The test's outfits: which pieces each wears, its hair, a colour turn per piece (the same shirt in another colour). */
export const OUTFITS = {
  ranger: { name: 'RANGER', hair: 'simpleparted', parts: ['Male_Ranger_Acc_Pauldron', 'Male_Ranger_Arms', 'Male_Ranger_Arms_Bracer', 'Male_Ranger_Body', 'Male_Ranger_Body_Belt_1', 'Male_Ranger_Body_Belt_2', 'Male_Ranger_Feet_Boots', 'Male_Ranger_Head_Hood', 'Male_Ranger_Legs'], hue: {} as Record<string, number>, hairTint: 0x3a2618 },
  villager: { name: 'VILLAGER', hair: 'simpleparted', parts: ['Male_Peasant_Arms', 'Male_Peasant_Body', 'Male_Peasant_Feet', 'Male_Peasant_Legs'], hue: {} as Record<string, number>, hairTint: 0x5b3b24 },
  wanderer: { name: 'WANDERER', hair: 'buzzed', parts: ['Male_Peasant_Arms', 'Male_Peasant_Body', 'Male_Ranger_Legs', 'Male_Ranger_Feet_Boots', 'Male_Ranger_Arms_Bracer', 'Male_Ranger_Body_Belt_1'], hue: { Male_Peasant_Body: 3.6, Male_Peasant_Arms: 3.6 } as Record<string, number>, hairTint: 0x1c1714 },
} as const;
export type OutfitId = keyof typeof OUTFITS;
const HAIRS = ['simpleparted', 'buzzed'];
const MOVES = ['moves_1.glb', 'moves_2.glb'];

/** What the body is doing (the scene's own state, read each frame). */
export interface HeroDrive {
  x: number; y: number; z: number; vx: number; vy: number; grounded: boolean; vz: number;
  /** -1 left, 1 right */ face: number;
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
  private pieces = new Map<string, THREE.Object3D>();
  private hairs = new Map<string, THREE.Object3D>();
  private mixer!: THREE.AnimationMixer;
  private clips = new Map<string, THREE.AnimationClip>();
  private action: THREE.AnimationAction | null = null;
  private clipNow = '';
  private castKey = '';
  private yaw = Math.PI / 2;
  private sword = new THREE.Group();
  /** The sword as the fist grips it (fitSword), and how far it hangs loose instead (standing, walking). */
  private gripQ = new THREE.Quaternion();
  private looseK = 0;
  private static tq = new THREE.Quaternion(); private static tm = new THREE.Matrix4();
  outfit: OutfitId = 'ranger';
  /** The standing height it is scaled to (units): the painted heroes' 124 world px and a little hair. */
  static HEIGHT = 1.3;

  private constructor() { this.root.add(this.model); this.scene.add(this.root); }

  static async load(onProgress?: (k: number) => void): Promise<Hero3D> {
    const h = new Hero3D();
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    const files = ['base_m.glb', 'outfit_ranger_m.glb', 'outfit_peasant_m.glb', ...HAIRS.map((n) => `hair_${n}.glb`), ...MOVES];
    let done = 0;
    const got = await Promise.all(files.map((f) => loader.loadAsync(DIR + f).then((g) => { onProgress?.(++done / files.length); return g; })));
    const [base, ranger, peasant] = got, hairs = got.slice(3, 3 + HAIRS.length), moves = got.slice(3 + HAIRS.length);
    // the base: its armature is the one skeleton every piece is bound to
    h.model.add(base.scene);
    base.scene.traverse((o) => { if ((o as THREE.Bone).isBone) h.bones.set(o.name, o as THREE.Bone); });
    base.scene.updateMatrixWorld(true);
    base.scene.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) h.pieces.set(o.name, o); });
    // every clothing piece: bound to the base's bones by name (its own bind matrices kept), under the hero
    for (const g of [ranger, peasant]) {
      g.scene.updateMatrixWorld(true);
      const skinned: THREE.SkinnedMesh[] = [];
      g.scene.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(o as THREE.SkinnedMesh); });
      for (const m of skinned) {
        const bones = m.skeleton.bones.map((b) => h.bones.get(b.name) ?? b);
        m.bind(new THREE.Skeleton(bones, m.skeleton.boneInverses), m.bindMatrix);
        const key = (m.parent && !(m.parent as THREE.Bone).isBone && m.parent.type === 'Group' ? m.parent.name : m.name) || m.name;
        let holder = h.pieces.get(key);
        if (!holder) { holder = new THREE.Group(); holder.name = key; h.pieces.set(key, holder); h.model.add(holder); }
        holder.add(m);
      }
    }
    // hair: a rigid piece on the head bone (laid on it where it sits over the base's head)
    const head = h.bones.get('Head')!;
    HAIRS.forEach((n, i) => {
      const s = hairs[i].scene; s.updateMatrixWorld(true);
      const grp = new THREE.Group(); grp.name = `hair_${n}`;
      const meshes: THREE.Object3D[] = []; s.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o); });
      for (const m of meshes) { h.model.add(m); m.matrixWorld.decompose(m.position, m.quaternion, m.scale); grp.add(m); }
      h.model.add(grp); head.attach(grp); h.hairs.set(n, grp);
    });
    // the moves: in place (the game moves the body: the clip's own travel on its root bone is dropped)
    for (const g of moves) for (const c of g.animations) {
      c.tracks = c.tracks.filter((t) => t.name !== 'root.position');
      h.clips.set(c.name, c);
    }
    h.mixer = new THREE.AnimationMixer(h.model);
    h.makeSword();
    h.look();
    // the size: the painted heroes' standing height, measured on the body as it stands at rest (before any move)
    h.model.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const k of ['HeadSkin', 'BaseBody']) { const p = h.pieces.get(k); if (p) box.expandByObject(p, true); }
    const tall = Math.max(0.5, box.max.y - box.min.y);
    // the sword laid in the fist as it grips (the sword stance)
    h.play('Sword_Idle', { fade: 0 }); h.mixer.update(0.3); h.model.updateMatrixWorld(true);
    h.fitSword();
    h.model.scale.setScalar(Hero3D.HEIGHT / tall);
    h.setOutfit('ranger');
    return h;
  }

  /** A sword in the right hand: a long steel blade, a gold guard (the warrior's own is painted; the test carries this). */
  private makeSword(): void {
    const steel = new THREE.MeshStandardMaterial({ color: 0xd7dde6, metalness: 0.85, roughness: 0.28 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc8963c, metalness: 0.8, roughness: 0.35 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x3a2418, metalness: 0, roughness: 0.8 });
    const L = 0.95, blade = new THREE.Shape();
    blade.moveTo(-0.028, 0); blade.lineTo(0.028, 0); blade.lineTo(0.024, L - 0.09); blade.lineTo(0, L); blade.lineTo(-0.024, L - 0.09); blade.closePath();
    const bg = new THREE.ExtrudeGeometry(blade, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 }); bg.translate(0, 0, -0.004);
    const parts: THREE.Mesh[] = [
      new THREE.Mesh(bg, steel),
      new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.028, 0.04), gold),
      new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.17, 8), leather),
      new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), gold),
    ];
    parts[1].position.y = 0; parts[2].position.y = -0.095; parts[3].position.y = -0.19;
    for (const p of parts) { p.castShadow = true; this.sword.add(p); }
    this.sword.name = 'sword';
    this.bones.get('hand_r')?.add(this.sword);
  }
  /** The sword laid in the closed fist, from the hand's own bones in the sword stance (the bone's own units): the grip
   *  through the fingers' second joints, the blade out past the index side, its edge toward the knuckles. */
  private fitSword(): void {
    const hand = this.bones.get('hand_r'); if (!hand) return;
    const at = (n: string) => { const b = this.bones.get(n); return b ? hand.worldToLocal(b.getWorldPosition(new THREE.Vector3())) : new THREE.Vector3(); };
    const i1 = at('index_01_r'), p1 = at('pinky_01_r'), i2 = at('index_02_r'), p2 = at('pinky_02_r'), m1 = at('middle_01_r');
    const y = i1.clone().add(i2).sub(p1).sub(p2).normalize();
    const x = m1.clone().normalize(); x.sub(y.clone().multiplyScalar(x.dot(y))).normalize();
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    this.sword.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); this.gripQ.copy(this.sword.quaternion);
    const grip = i2.clone().add(p2).multiplyScalar(0.5).lerp(i1.clone().add(p1).multiplyScalar(0.5), 0.35);
    this.sword.position.copy(grip).addScaledVector(y, 0.09);
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
        if (o.parent?.name !== 'sword') { mt.metalness = Math.min(mt.metalness, 0.15); mt.roughness = Math.max(mt.roughness, 0.55); }
      }
    });
  }

  /** The cast shadow, from the room's sun (`sunDir`: towards the sun, world; kept up to date by the arena): every piece
   *  drawn again flattened onto the floor along the light, dark and see-through, each floor pixel once (a stencil). */
  makeShadow(sunDir: THREE.Vector3): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0x160a10, transparent: true, opacity: 0.24, depthWrite: false }); // (as faint as the painted bodies' sun shadows)
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

  /** Wear an outfit: its pieces on, every other piece off (the bare body only where nothing covers it). */
  setOutfit(id: OutfitId): void {
    this.outfit = id;
    const O = OUTFITS[id], on = new Set<string>(O.parts);
    for (const [k, p] of this.pieces) {
      if (k === 'HeadSkin' || k === 'Eyes' || k === 'Eyebrows') { p.visible = true; continue; }
      if (k === 'BaseBody') { p.visible = false; continue; }
      p.visible = on.has(k);
      p.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) this.hue(m, (O.hue as Record<string, number>)[k] ?? 0); });
    }
    for (const [n, g] of this.hairs) g.visible = n === O.hair;
    const tint = new THREE.Color(O.hairTint);
    for (const g of [...this.hairs.values(), this.pieces.get('Eyebrows')]) g?.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const mt = m.material as THREE.MeshStandardMaterial;
      if (!mt.userData.tinted) { m.material = mt.clone(); (m.material as THREE.MeshStandardMaterial).userData.tinted = true; }
      (m.material as THREE.MeshStandardMaterial).color.copy(tint);
    });
  }

  /** A piece's cloth turned round the colour wheel (its skin left as it is): the same shirt in another colour. */
  private hue(m: THREE.Mesh, turn: number): void {
    const mat = m.material as THREE.MeshStandardMaterial & { userData: { hue?: { value: number }; cloned?: boolean } };
    if (!mat || /Regular_Male|Skin|Superhero/i.test(mat.name)) return;
    if (!mat.userData.hue) {
      if (!turn) return;
      const c = mat.clone() as typeof mat; c.userData = { hue: { value: 0 }, cloned: true }; m.material = c;
      c.onBeforeCompile = (sh) => {
        sh.uniforms.uHue = c.userData.hue!;
        sh.fragmentShader = 'uniform float uHue;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          { float cs = cos(uHue), sn = sin(uHue); vec3 k = vec3(0.57735);
            vec3 c = diffuseColor.rgb * cs + cross(k, diffuseColor.rgb) * sn + k * dot(k, diffuseColor.rgb) * (1.0 - cs);
            float l = dot(c, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = max(vec3(0.0), mix(vec3(l), c, 1.9)) * 0.72; }`);
      };
      c.customProgramCacheKey = () => 'hero-hue';
      c.userData.hue!.value = turn; return;
    }
    mat.userData.hue.value = turn;
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
    const want = d.face >= 0 ? Math.PI / 2 - 0.42 : -Math.PI / 2 + 0.42;
    this.yaw += (want - this.yaw) * Math.min(1, ms / 70);
    this.root.rotation.y = this.yaw;
    const sp = Math.hypot(d.vx, d.vy), k = this.model.scale.x;
    const c = d.cast;
    if (d.mode === 'skill' && c) {
      const key = `${c.id}:${c.stage}:${Math.round(c.startup)}`;
      if (key !== this.castKey) {
        this.castKey = key;
        const clip = this.attackClip(c), len = this.clipLength(clip), lock = Math.max(150, c.startup + c.active + c.recovery);
        this.play(clip, { once: true, restart: true, fade: 0.06, speed: Math.min(3, Math.max(0.6, (len * 1000 * this.hitShare(clip)) / Math.max(60, c.startup + c.active * 0.5))) * 1 });
        void lock;
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
        case 'alert': this.play('Sword_Idle', { fade: 0.2 }); break; // (after a blow or a hit: the guard held a moment)
        default: this.play('Idle_Loop', { fade: 0.25 });
      }
    }
    this.mixer.update(ms / 1000);
    this.swordHang(ms);
    for (const [m, t] of this.shadows) t.visible = this.shown(m);
  }

  /** Standing or walking the sword hangs loose in the hand, its point down and forward (the painted warrior's idle);
   *  in the guard, a blow or a run it is gripped as the move holds it. */
  private swordHang(ms: number): void {
    const loose = this.clipNow === 'Idle_Loop' || this.clipNow === 'Walk_Loop';
    this.looseK += ((loose ? 1 : 0) - this.looseK) * Math.min(1, ms / 140);
    const hand = this.bones.get('hand_r');
    if (!hand || this.looseK < 0.002) { this.sword.quaternion.copy(this.gripQ); return; }
    hand.updateWorldMatrix(true, false);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const y = new THREE.Vector3(fx * 0.5, -0.86, fz * 0.5).normalize();
    const x = new THREE.Vector3(fx, 0, fz); x.addScaledVector(y, -x.dot(y)).normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    const want = Hero3D.tq.setFromRotationMatrix(Hero3D.tm.makeBasis(x, y, z));
    const hung = hand.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(want);
    this.sword.quaternion.slerpQuaternions(this.gripQ, hung, this.looseK);
  }

  /** Each skill one of the sword's moves (the test's stand-in: every skill draws its own in the real build). */
  private attackClip(c: NonNullable<HeroDrive['cast']>): string {
    if (c.id === 'warrior_basic') return ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Attack'][c.stage % 4];
    if (c.dash) return 'Sword_Dash_RM';
    if (c.air) return 'Sword_Attack';
    if (/war_cry|oath|banner|sanctuary|radiant/.test(c.id)) return 'Idle_Shield_Break';
    if (/whirl|storm|tide|circle/.test(c.id)) return 'Sword_Regular_Combo';
    if (/rising|sky|lance|hook/.test(c.id)) return 'Sword_Regular_C';
    if (/ground|earth|leap|crash|verdict|maw/.test(c.id)) return 'Sword_Attack';
    return 'Sword_Regular_B';
  }
  /** Where in a sword clip its blow falls (share of its length): the clip is timed so the blow meets the skill's hit. */
  private hitShare(clip: string): number {
    return ({ Sword_Regular_A: 0.45, Sword_Regular_B: 0.42, Sword_Regular_C: 0.3, Sword_Attack: 0.45, Sword_Dash_RM: 0.35, Sword_Regular_Combo: 0.25, Idle_Shield_Break: 0.4 } as Record<string, number>)[clip] ?? 0.4;
  }

  dispose(): void {
    this.mixer?.stopAllAction();
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
