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
  const order = [...rig.bones].sort((a, b) => a.z - b.z);
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
