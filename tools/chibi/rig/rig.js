// A paper-doll rig of painted pieces: each bone carries a piece (an image) turned about its pivot (the joint it hangs
// from); a child bone's pivot sits at a point of its parent's piece. Facing right; a pose turns the bones (degrees,
// clockwise on screen) and may shift the root. Drawn back to front by the bones' order.
//
// rig = { pieces: { name: { src, pivot: [x, y], scale?, dark? } },
//         bones: [ { name, parent?, piece, at: [x, y] (in the parent's piece px, before its scale) , z } ] }
// pose = { boneName: degrees, ..., _x, _y (root shift, px) }

export async function loadRig(rig, base = '') {
  const imgs = {};
  await Promise.all(Object.entries(rig.pieces).map(([k, p]) => new Promise((res, rej) => {
    const im = new Image(); im.onload = () => { imgs[k] = im; res(); }; im.onerror = () => rej(new Error('piece ' + k)); im.src = base + p.src;
  })));
  return { ...rig, imgs };
}

/** Each bone's matrix in the figure's space (DOMMatrix), its piece's pixels mapped by it. */
export function boneMatrices(rig, pose) {
  const F = {}, M = {};
  for (const b of rig.bones) {
    const pc = rig.pieces[b.piece], s = pc.scale ?? 1;
    let f;
    if (!b.parent) f = new DOMMatrix().translate(pose._x ?? 0, pose._y ?? 0);
    else {
      const pb = rig.bones.find((q) => q.name === b.parent), pp = rig.pieces[pb.piece], sp = pp.scale ?? 1;
      // (the joint: a point of the parent's piece, in the parent's turned frame, at the parent piece's scale)
      f = F[b.parent].translate((b.at[0] - pp.pivot[0]) * sp, (b.at[1] - pp.pivot[1]) * sp);
    }
    F[b.name] = f.rotate(pose[b.name] ?? 0);
    M[b.name] = F[b.name].scale(s, s); // (the piece's pixels about its pivot; the scale is the piece's own, not handed down)
  }
  return M;
}

export function drawRig(ctx, rig, pose, o = {}) {
  const { x = 0, y = 0, scale = 1, left = false } = o;
  const M = boneMatrices(rig, pose);
  const base = new DOMMatrix().translate(x, y).scale(left ? -scale : scale, scale);
  const z = (b) => pose['_z_' + b.name] ?? b.z; // (a pose may lift a bone over the others: the big head over a sword arm raised across it)
  const order = [...rig.bones].sort((a, b) => z(a) - z(b));
  for (const b of order) {
    if (b.hidden || pose['_hide_' + b.name]) continue;
    const pk = pose['_piece_' + b.name] ?? b.piece, pc = rig.pieces[pk], im = rig.imgs[pk];
    ctx.save();
    if (pose._clipGround && pose._clipGround.includes(b.name)) { // (a blade driven into the floor: nothing of it below the ground line)
      ctx.setTransform(base); ctx.beginPath(); ctx.rect(-1e5, -1e5, 2e5, 1e5); ctx.clip();
    }
    ctx.setTransform(base.multiply(M[b.name]));
    if (b.dark && b.dark < 1) ctx.filter = `brightness(${b.dark})`;
    ctx.drawImage(im, -pc.pivot[0], -pc.pivot[1]);
    ctx.restore();
  }
}

/** A point of a bone's piece (its own px) in the figure's space under a pose. */
export function pointOf(rig, pose, bone, pt) {
  const M = boneMatrices(rig, pose), b = rig.bones.find((q) => q.name === bone), pc = rig.pieces[b.piece];
  const q = M[bone].transformPoint(new DOMPoint(pt[0] - pc.pivot[0], pt[1] - pc.pivot[1]));
  return [q.x, q.y];
}

/** A pose between keys (each key { t: 0..1, pose }), eased (smooth in and out between keys). */
export function sample(keys, t) {
  const n = keys.length;
  let i = 0;
  while (i < n - 1 && keys[i + 1].t <= t) i++;
  const a = keys[i], b = keys[Math.min(n - 1, i + 1)];
  const span = (b.t - a.t) || 1, u = Math.max(0, Math.min(1, (t - a.t) / span)), e = u * u * (3 - 2 * u);
  const out = {};
  for (const k of new Set([...Object.keys(a.pose), ...Object.keys(b.pose)])) {
    const va = a.pose[k] ?? 0, vb = b.pose[k] ?? 0;
    out[k] = typeof va === 'number' ? va + (vb - va) * e : va;
  }
  return out;
}

/** The legs placed by their feet (2-bone IK): `pose._ikF` / `pose._ikB` = [ankleX, w] — that ankle at x (figure px), its
 *  foot turned to w degrees in the world (0 flat; + the heel lifted), its sole's lowest point on the ground line y = 0
 *  (the pose's root already set at its height: pose._y = -hips height). The knee bends forward. `plant`: the foot's
 *  sole points (heel, toe) in its piece px. A foot out of reach stretches its leg straight toward it. */
export function placeFeet(rig, pose, plant) {
  const bone = (n) => rig.bones.find((q) => q.name === n), deg = 180 / Math.PI;
  for (const L of ['F', 'B']) {
    const ik = pose['_ik' + L]; if (!ik) continue;
    const [ax, w = 0] = ik, th = bone('thigh' + L), sh = bone('shin' + L), ft = bone('foot' + L);
    const tp = rig.pieces[th.piece], spc = rig.pieces[sh.piece], fp = rig.pieces[ft.piece];
    const ts = tp.scale ?? 1, ss = spc.scale ?? 1, fs = fp.scale ?? 1;
    const v1 = [(sh.at[0] - tp.pivot[0]) * ts, (sh.at[1] - tp.pivot[1]) * ts], v2 = [(ft.at[0] - spc.pivot[0]) * ss, (ft.at[1] - spc.pivot[1]) * ss];
    const l1 = Math.hypot(v1[0], v1[1]), l2 = Math.hypot(v2[0], v2[1]), b1 = Math.atan2(-v1[0], v1[1]), b2 = Math.atan2(-v2[0], v2[1]);
    const rad = w / deg, low = plant.map(([px, py]) => { const x = (px - fp.pivot[0]) * fs, y = (py - fp.pivot[1]) * fs; return [x * Math.cos(rad) - y * Math.sin(rad), x * Math.sin(rad) + y * Math.cos(rad)]; }).reduce((m, o) => (o[1] > m[1] ? o : m));
    const A = [ax, -low[1]], J = pointOf(rig, pose, th.name, tp.pivot);
    const d = [A[0] - J[0], A[1] - J[1]], D = Math.min(l1 + l2 - 1e-3, Math.max(Math.abs(l1 - l2) + 1e-3, Math.hypot(d[0], d[1])));
    const td = Math.atan2(-d[0], d[1]), al = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + D * D - l2 * l2) / (2 * l1 * D))));
    const t1 = td - al, K = [J[0] - l1 * Math.sin(t1), J[1] + l1 * Math.cos(t1)], t2 = Math.atan2(-(A[0] - K[0]), A[1] - K[1]);
    const root = pose.root ?? 0;
    pose[th.name] = (t1 - b1) * deg - root;
    pose[sh.name] = (t2 - t1 + b1 - b2) * deg;
    pose[ft.name] = w - (root + pose[th.name] + pose[sh.name]);
  }
  return pose;
}

/** Two bones reaching a point (2-bone IK): `upper` → `lower` → `end` (the end bone's joint is placed on `target`, figure
 *  px). `bend` +1 bends the joint the way a knee bends (the lower bone turned clockwise), -1 the way an elbow does. */
export function reach(rig, pose, upper, lower, end, target, bend = -1) {
  const bone = (n) => rig.bones.find((q) => q.name === n), deg = 180 / Math.PI;
  const ub = bone(upper), lb = bone(lower), eb = bone(end), up = rig.pieces[ub.piece], lp = rig.pieces[lb.piece];
  const us = up.scale ?? 1, ls = lp.scale ?? 1;
  const v1 = [(lb.at[0] - up.pivot[0]) * us, (lb.at[1] - up.pivot[1]) * us], v2 = [(eb.at[0] - lp.pivot[0]) * ls, (eb.at[1] - lp.pivot[1]) * ls];
  const l1 = Math.hypot(v1[0], v1[1]), l2 = Math.hypot(v2[0], v2[1]), b1 = Math.atan2(-v1[0], v1[1]), b2 = Math.atan2(-v2[0], v2[1]);
  let base = 0; for (let b = bone(ub.parent); b; b = b.parent ? bone(b.parent) : null) base += pose[b.name] ?? 0; // (the turn handed down to the upper bone)
  const J = pointOf(rig, pose, upper, up.pivot), d = [target[0] - J[0], target[1] - J[1]];
  const D = Math.min(l1 + l2 - 1e-3, Math.max(Math.abs(l1 - l2) + 1e-3, Math.hypot(d[0], d[1])));
  const td = Math.atan2(-d[0], d[1]), al = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + D * D - l2 * l2) / (2 * l1 * D))));
  const t1 = td - bend * al, K = [J[0] - l1 * Math.sin(t1), J[1] + l1 * Math.cos(t1)], t2 = Math.atan2(-(target[0] - K[0]), target[1] - K[1]);
  pose[upper] = (t1 - b1) * deg - base;
  pose[lower] = (t2 - t1 + b1 - b2) * deg;
  return pose;
}
/** Both hands on the hilt: the far hand placed on the sword's grip behind the near one (`at`: that grip point in the
 *  sword's px), closed and turned with the blade (world angle `sw`). */
export function gripB(rig, pose, at, sw) {
  reach(rig, pose, 'armB', 'foreB', 'handB', pointOf(rig, pose, 'sword', at), -1);
  pose.handB = sw - ((pose.root ?? 0) + (pose.torso ?? 0) + pose.armB + pose.foreB);
  pose._piece_handB = 'fist';
  return pose;
}
