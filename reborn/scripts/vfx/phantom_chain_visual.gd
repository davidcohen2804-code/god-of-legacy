class_name PhantomChainVisual
extends Node3D
## How the Phantom Chain looks (it shows what the combat decided and never decides anything): a spectral chain of
## violet links from the Samurai's left hand to a glowing spearhead, with a restrained pulse of paler energy running
## along it from the hand to the head (GPT's Stage B review: a violet spectral core, distinct from the katana's
## near-white trail). Thrown, it runs out behind the head with a little
## play in it; on a hit the head sits on the target's chest and the chain draws taut between them for as long as the
## capture holds — shortening as the target is pulled in; after a miss, or when the chain lets go, it draws back into
## the hand over a moment. Additive and unshaded: no light of its own (light on a phone's GPU).

const LINK_STEP := 0.085 ## m between links
const MAX_LINKS := 112
const RETRACT := 0.16 ## s to draw the chain back into the hand
const CORE := Color(0.5, 0.32, 1.0, 0.72)
const PULSE := Color(0.84, 0.72, 1.0, 0.95)

var combat: CombatController
var fighter: Fighter
var _links: MultiMeshInstance3D
var _head: MeshInstance3D
var _glow: MeshInstance3D
var _mat: StandardMaterial3D
var _t := 0.0


func _ready() -> void:
	_mat = StandardMaterial3D.new()
	_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	_mat.vertex_color_use_as_albedo = true # (each link's own colour: the violet core and the travelling pulse)
	_mat.albedo_color = Color(1, 1, 1, 1)
	var link := TorusMesh.new()
	link.inner_radius = 0.016
	link.outer_radius = 0.03
	link.rings = 10
	link.ring_segments = 6
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = link
	mm.instance_count = MAX_LINKS
	mm.visible_instance_count = 0
	_links = MultiMeshInstance3D.new()
	_links.multimesh = mm
	_links.material_override = _mat
	_links.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_links)
	var tip := CylinderMesh.new()
	tip.top_radius = 0.0
	tip.bottom_radius = 0.05
	tip.height = 0.2
	tip.radial_segments = 8
	_head = MeshInstance3D.new()
	_head.mesh = tip
	var head_mat := _mat.duplicate() as StandardMaterial3D
	head_mat.vertex_color_use_as_albedo = false
	head_mat.albedo_color = Color(0.78, 0.62, 1.0, 1.0)
	_head.material_override = head_mat
	_head.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_head)
	var glow := SphereMesh.new()
	glow.radius = 0.13
	glow.height = 0.26
	glow.radial_segments = 12
	glow.rings = 6
	_glow = MeshInstance3D.new()
	_glow.mesh = glow
	var glow_mat := _mat.duplicate() as StandardMaterial3D
	glow_mat.vertex_color_use_as_albedo = false
	glow_mat.albedo_color = Color(0.5, 0.3, 1.0, 0.32)
	_glow.material_override = glow_mat
	_glow.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_glow)
	_show(false)


func _process(delta: float) -> void:
	_t += delta
	var shot: ChainShot = combat.shot if combat else null
	if shot == null or fighter == null:
		_show(false)
		return
	var hand := _hand()
	var end := shot.head
	var taut := false
	match shot.state:
		"hit":
			if shot.target and is_instance_valid(shot.target):
				end = shot.target.global_position + Vector3(0, 1.15, 0)
			taut = true
		"blocked", "spent", "done":
			var k := clampf(shot.since / RETRACT, 0.0, 1.0)
			if k >= 1.0:
				_show(false)
				return
			if shot.state == "done" and shot.target and is_instance_valid(shot.target):
				end = shot.target.global_position + Vector3(0, 1.15, 0)
			end = end.lerp(hand, k * k)
	_show(true)
	_draw_chain(hand, end, taut)


func _draw_chain(from: Vector3, to: Vector3, taut: bool) -> void:
	var span := to - from
	var dist := span.length()
	var d := span / dist if dist > 0.001 else Vector3.FORWARD
	var side := d.cross(Vector3.UP)
	side = side.normalized() if side.length() > 0.01 else Vector3.RIGHT
	var n := mini(MAX_LINKS, int(dist / LINK_STEP) + 1)
	var mm := _links.multimesh
	mm.visible_instance_count = n
	for i in n:
		var f := float(i) / maxf(1.0, float(n - 1))
		var p := from.lerp(to, f)
		if not taut:
			# a little play in the thrown chain, dying out toward the head
			p += side * sin(f * 9.0 - _t * 30.0) * 0.035 * (1.0 - f) + Vector3(0, -0.06 * sin(f * PI), 0)
		# each link's long axis along the chain, every other one turned a quarter about it
		var x := d
		var y := side if i % 2 == 0 else d.cross(side).normalized()
		var z := x.cross(y).normalized()
		var b := Basis(x * 1.7, y, z)
		mm.set_instance_transform(i, Transform3D(b, p))
		# the violet core, and a narrow paler pulse travelling from the hand toward the head
		var pulse := pow(0.5 + 0.5 * sin(f * 12.0 - _t * 16.0), 6.0)
		mm.set_instance_color(i, CORE.lerp(PULSE, pulse))
	_head.global_transform = Transform3D(Basis(Quaternion(Vector3.UP, d)), to + d * 0.06)
	_glow.global_position = to


func _hand() -> Vector3:
	var v := fighter.visual
	if v and v.skeleton:
		var i := v.skeleton.find_bone("hand_l")
		if i >= 0:
			return (v.skeleton.global_transform * v.skeleton.get_bone_global_pose(i)).origin
	return fighter.global_position + Vector3(0, 1.2, 0)


func _show(on: bool) -> void:
	_links.visible = on
	_head.visible = on
	_glow.visible = on
	if not on:
		_links.multimesh.visible_instance_count = 0
