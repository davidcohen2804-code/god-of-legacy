class_name ExecutionVisual
extends Node3D
## How Phantom Execution looks (GPT's v1.5 / v1.6: its power comes from the preparation pose, a readable dash, the
## precise slash, a controlled camera and a concentrated impact — its beginning, contact and ending never hidden behind
## effects). It decides nothing; it only follows the combat controller:
##   - the dash: three faint violet afterimages left along his path through the startup (his pose baked at GHOSTS s),
##     each fading over GHOST_FADE s;
##   - the camera: its view narrows by at most PUSH degrees through the startup, holds through the cut and widens back
##     through the recovery — eased, never turning it;
##   - the contact: a thin bright streak along the katana tip's own path through the cut for STREAK_LIFE s, and a
##     concentrated crimson-violet flash where the blade bit (the hit's sparks and dust are HitVfx's); his low finishing
##     pose stays clear.

const ID := "phantom_execution"
const GHOSTS := [0.05, 0.1, 0.15] ## s into the startup
const GHOST := Color(0.62, 0.48, 1.0)
const GHOST_ALPHA := 0.3
const GHOST_FADE := 0.2
const PUSH := 2.0 ## degrees (GPT's v1.6: at most 2° until tested on a phone)
const STREAK_LIFE := 0.12
const FLASH := Color(0.95, 0.3, 0.62)
const FLASH_LIFE := 0.1

var combat: CombatController
var fighter: Fighter
var rig: CameraRig
## Afterimages left and contacts shown (for the tests and the report).
var ghosts_left := 0
var contacts := 0

var _next_ghost := 0
var _ghosts: Array[Dictionary] = [] ## {nodes: [MeshInstance3D], mat, age}
var _streak: MeshInstance3D
var _streak_mat: StandardMaterial3D
var _streak_age := 10.0
var _flash: MeshInstance3D
var _flash_mat: StandardMaterial3D
var _flash_age := 10.0


func _ready() -> void:
	_streak_mat = _additive(Color(1, 1, 1, 0))
	_streak = MeshInstance3D.new()
	_streak.material_override = _streak_mat
	_streak.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_streak.visible = false
	_streak.top_level = true
	add_child(_streak)
	var sphere := SphereMesh.new()
	sphere.radius = 0.5
	sphere.height = 1.0
	sphere.radial_segments = 12
	sphere.rings = 6
	_flash_mat = _additive(Color(FLASH, 0.0))
	_flash = MeshInstance3D.new()
	_flash.mesh = sphere
	_flash.material_override = _flash_mat
	_flash.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_flash.visible = false
	add_child(_flash)
	if combat:
		combat.strike_started.connect(func(a: AttackData, _s: int) -> void:
			if a.id == ID:
				_next_ghost = 0)
		combat.strike_hit.connect(_on_hit)


func _process(delta: float) -> void:
	if combat == null or fighter == null:
		return
	var a := combat.melee.current()
	var running := a != null and a.id == ID and combat.melee.is_attacking()
	# the afterimages through the startup's dash
	if running and combat.melee.phase == MeleeState.Phase.STARTUP and not combat.is_frozen():
		while _next_ghost < GHOSTS.size() and combat.melee.t >= float(GHOSTS[_next_ghost]):
			_leave_ghost()
			_next_ghost += 1
	_age_ghosts(delta)
	# the camera's push-in: in through the startup, held through the cut, out through the recovery
	if rig:
		var k := 0.0
		if running:
			match combat.melee.phase:
				MeleeState.Phase.STARTUP:
					k = clampf(combat.melee.t / maxf(a.startup, 0.001), 0.0, 1.0)
				MeleeState.Phase.ACTIVE:
					k = 1.0
				MeleeState.Phase.RECOVERY:
					k = 1.0 - clampf(combat.melee.t / maxf(a.recovery, 0.001), 0.0, 1.0)
		rig.fov_push = PUSH * k
	if _streak_age < STREAK_LIFE:
		_streak_age += delta
		var s := clampf(_streak_age / STREAK_LIFE, 0.0, 1.0)
		_streak.visible = s < 1.0
		_streak_mat.albedo_color = Color(1.0, 0.9, 0.97, 0.9 * (1.0 - s))
	if _flash_age < FLASH_LIFE:
		_flash_age += delta
		var f := clampf(_flash_age / FLASH_LIFE, 0.0, 1.0)
		_flash.visible = f < 1.0
		_flash.scale = Vector3.ONE * lerpf(0.25, 0.7, 1.0 - (1.0 - f) * (1.0 - f))
		_flash_mat.albedo_color = Color(FLASH, 0.9 * (1.0 - f))


## His meshes baked in the pose he has now, where he is, and the katana: faint violet, fading.
func _leave_ghost() -> void:
	var mat := _additive(Color(GHOST, GHOST_ALPHA))
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	var nodes: Array[MeshInstance3D] = []
	for m in fighter.visual.meshes:
		var baked: Variant = m.call("bake_mesh_from_current_skeleton_pose") \
			if m.has_method("bake_mesh_from_current_skeleton_pose") else null
		if baked is Mesh:
			nodes.append(_ghost_node(baked as Mesh, m.global_transform, mat))
	if fighter.visual.katana:
		for n in fighter.visual.katana.find_children("*", "MeshInstance3D", true, false):
			var k := n as MeshInstance3D
			nodes.append(_ghost_node(k.mesh, k.global_transform, mat))
	_ghosts.append({"nodes": nodes, "mat": mat, "age": 0.0})
	ghosts_left += 1


func _ghost_node(mesh: Mesh, at: Transform3D, mat: Material) -> MeshInstance3D:
	var g := MeshInstance3D.new()
	g.mesh = mesh
	g.material_override = mat
	g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	g.top_level = true
	add_child(g)
	g.global_transform = at
	return g


func _age_ghosts(delta: float) -> void:
	for i in range(_ghosts.size() - 1, -1, -1):
		var g := _ghosts[i]
		g["age"] = float(g["age"]) + delta
		var k := clampf(float(g["age"]) / GHOST_FADE, 0.0, 1.0)
		(g["mat"] as StandardMaterial3D).albedo_color = Color(GHOST, GHOST_ALPHA * (1.0 - k))
		if k >= 1.0:
			for n: Node in g["nodes"]:
				n.queue_free()
			_ghosts.remove_at(i)


## The cleave landed: the streak along the tip's path through the whole cut, as he stands, and the flash where it bit.
func _on_hit(a: AttackData, _step: int, target: Node3D, dir: Vector3) -> void:
	if a.id != ID or target == null or not is_instance_valid(target):
		return
	var basis := Basis(Vector3.UP, fighter.facing)
	var at := fighter.global_position
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var n := a.blade_tip.size()
	for i in n - 1:
		var t0 := at + basis * a.blade_tip[i]
		var t1 := at + basis * a.blade_tip[i + 1]
		var b0 := at + basis * a.blade_tip[i].lerp(a.blade_base[i], 0.08) # (a thin ribbon at the edge's very end)
		var b1 := at + basis * a.blade_tip[i + 1].lerp(a.blade_base[i + 1], 0.08)
		for v: Vector3 in [b0, t0, t1, b0, t1, b1]:
			st.set_normal(Vector3.UP)
			st.add_vertex(v)
	_streak.mesh = st.commit()
	_streak.global_transform = Transform3D.IDENTITY
	_streak.visible = true
	_streak_age = 0.0
	var r: Variant = target.get("hurt_radius")
	_flash.global_position = target.global_position + Vector3(0, 1.0, 0) - dir * (float(r) if r != null else 0.3) * 0.7
	_flash.visible = true
	_flash_age = 0.0
	contacts += 1


func _additive(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.albedo_color = c
	return m
