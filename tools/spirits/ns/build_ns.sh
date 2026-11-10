#!/bin/bash
# The new Samurai, end to end (test only): texture fixes -> graft (head, hair, ponytail) -> one atlas -> rig (65 bones)
# -> gloved hands -> normals -> supplementary bones -> packed -> the game's assets (behind ?spirits only).
set -e
SP=/tmp/claude-0/-home-claude/3e5fb49a-8e0a-5558-8b49-0394b00826f4/scratchpad
cd $SP/ns/hair
python3 texfix.py ../h3d/tex3.png ../h3d/tex4.png | tail -1
python3 graft2.py graft4.glb DBG | grep wrote
cd $SP/h3d
cp $SP/ns/hair/graft4.glb ns_graft4.glb; cp $SP/ns/hair/pony_rig.json .
node repack.mjs ns_graft4.glb ns_repack.glb 2048 | tail -1
(cd $SP/ns/hair && python3 ponyidx.py ../../h3d/ns_repack.glb pony_rig.json ../../h3d/pony_idx.json)
(cd $SP/ns/hair && python3 rebake2.py ../../h3d/ns_repack.glb graft2_tex.png ../../h3d/ns_atlas.png 2048 | tail -1)
node addtex.mjs ns_repack.glb ns_atlas.png ns_tex.glb
node rigfit.mjs tmpl_m.glb ns_tex.glb lm_ns.json ns_rig.glb | tail -2
node handsns.mjs ns_rig.glb ../quat/base_m.gltf ns_righ.glb | tail -1
node normals.mjs ns_righ.glb ns_rign.glb | tail -1
node addbones.mjs ns_rign.glb pony_rig.json ns_bones.glb pony_idx.json | tail -3
node pack1.mjs ns_bones.glb ns_samurai.glb 2048 86 | tail -1
cp ns_samurai.glb /home/claude/god-of-legacy/public/assets/hero3d/spirit_samurai_ns.glb
echo built
