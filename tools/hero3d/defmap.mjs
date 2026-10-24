export function defToStd(n) {
  if (n === 'root') return 'root';
  const side = n.endsWith('.L') ? '_l' : n.endsWith('.R') ? '_r' : '';
  const b = n.replace(/^DEF-/, '').replace(/\.[LR]$/, '');
  const M = { hips: 'pelvis', 'spine.001': 'spine_01', 'spine.002': 'spine_02', 'spine.003': 'spine_03', neck: 'neck_01', head: 'Head', shoulder: 'clavicle', upper_arm: 'upperarm', forearm: 'lowerarm', hand: 'hand', thigh: 'thigh', shin: 'calf', foot: 'foot', toe: 'ball' };
  if (M[b]) return M[b] + side;
  let m = b.match(/^f_(index|middle|pinky|ring)\.0(\d)$/); if (m) return `${m[1]}_0${m[2]}${side}`;
  m = b.match(/^thumb\.0(\d)$/); if (m) return `thumb_0${m[1]}${side}`;
  return null;
}
