class_name ShadowStepVisual
extends Node3D
## How Shadow Step and Shadow Counter look (they decide nothing; the directive's "shadow movement effects", GPT's v1.4
## visual direction — never hiding the fighters, no full-screen flash, light on a phone's GPU):
##   - the Shadow Origin: as the step's movement begins, a faint violet afterimage of him stays where he stood — his
##     pose at that moment — for the 120 ms of the defensive window, then fades (the blade passing through it is the
##     genuine evasion); a puff of dark violet mist where he left;
##   - the burst: a trail of smaller puffs along his path, his body sunk into a dark violet while the window lasts;
##   - a genuine evasion: the afterimage fractures — violet shards fly from it and a pale ring swells where the blade
##     passed (with its own sound, CombatSfx);
##   - Shadow Counter's dash trails the same mist.
## The afterimage is his skinned meshes baked once in their current pose (and the katana), drawn unshaded and
## translucent; the puffs and shards are small pools.

const POOL := 18
const LIFE := 0.38 ## s a puff lasts
const TRAIL_EVERY := 0.03 ## s between the trail's puffs
const MIST := Color(0.17, 0.09, 0.28)
const GHOST := Color(0.62, 0.48, 1.0)
const GHOST_HOLD := 0.12 ## the afterimage stays this long (the defensive window)...
const GHOST_FADE := 0.06 ## ...then fades over this
const RING := Color(0.78, 0.66, 1.0)
const RING_LIFE := 0.3
const SHARDS := 10
const SHARD_LIFE := 0.28

var combat: CombatController
var fighter: Fighter
var _puffs: Array[MeshInstance3D] = []
var _mats: Array[StandardMaterial3D] = []
var _age: Array[float] = []
var _grow: Array[float] = []
var _next := 0
var _trail := 0.0
var _moving := false
var _shadow := 0.0
var _ring: MeshInstance3D
var _ring_mat: StandardMaterial3D
var _ring_age := 10.0
var _ghosts: Array[MeshInstance3D] = []
var _ghost_mat: StandardMaterial3D
var _ghost_age := 10.0
var _shards: Array[MeshInstance3D] = []
var _shard_vel: Array[Vector3] = []
var _shard_spin: Array[Vector3] = []
var _shard_mat: StandardMaterial3D
var _shard_age := 10.0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.seed = 7
	var sphere := SphereMesh.new()
	sphere.radius = 0.5
	sphere.height = 1.0
	sphere.radial_segments = 10
	sphere.rings = 5
	for i in POOL:
		var m := _unshaded(Color(MIST, 0.0), false)
		var p := _instance(sphere, m)
		_puffs.append(p)
		_mats.append(m)
		_age.append(LIFE)
		_grow.append(1.0)
	var torus := TorusMesh.new()
	torus.inner_radius = 0.42
	torus.outer_radius = 0.5
	torus.rings = 28
	torus.ring_segments = 6
	_ring_mat = _unshaded(Color(RING, 0.0), true)
	_ring = _instance(torus, _ring_mat)
	_ghost_mat = _unshaded(Color(GHOST, 0.0), false)
	_ghost_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	var shard := PrismMesh.new()
	shard.size = Vector3(0.07, 0.2, 0.02)
	_shard_mat = _unshaded(Color(GHOST, 0.0), true)
	for i in SHARDS:
		_shards.append(_instance(shard, _shard_mat))
		_shard_vel.append(Vector3.ZERO)
		_shard_spin.append(Vector3.ZERO)
	if combat:
		combat.attack_evaded.connect(func(_a: int, _d: int, _id: String) -> void: _evaded())


func _process(delta: float) -> void:
	if combat == null or fighter == null:
		return
	var a := combat.melee.current()
	var phase := combat.melee.phase
	var stepping := a != null and a.kind == "step" and combat.melee.is_attacking() and phase == MeleeState.Phase.ACTIVE
	var dashing := a != null and not a.dash.is_empty() and combat.melee.is_attacking() and phase == MeleeState.Phase.STARTUP
	var moving := (stepping or dashing) and not combat.is_frozen()
	var at := fighter.global_position
	if moving and not _moving:
		if stepping:
			_afterimage()
		_puff(at + Vector3(0, 0.55, 0), 1.25) # where he left
		_trail = 0.0
	elif moving:
		_trail += delta
		if _trail >= TRAIL_EVERY:
			_trail = 0.0
			_puff(at + Vector3(0, 0.7, 0), 0.75)
	elif _moving:
		_puff(at + Vector3(0, 0.6, 0), 0.85) # where he arrives
	_moving = moving
	_shadow = move_toward(_shadow, 1.0 if combat.evading() else 0.0, delta * 14.0)
	fighter.visual.set_shadow(_shadow)
	_age_puffs(delta)
	_age_ghost(delta)
	_age_fracture(delta)


func _age_puffs(delta: float) -> void:
	for i in POOL:
		if _age[i] >= LIFE:
			continue
		_age[i] += delta
		var k := clampf(_age[i] / LIFE, 0.0, 1.0)
		_puffs[i].visible = k < 1.0
		_puffs[i].scale = Vector3.ONE * _grow[i] * lerpf(0.45, 1.0, 1.0 - (1.0 - k) * (1.0 - k))
		_mats[i].albedo_color = Color(MIST, 0.55 * (1.0 - k))


func _age_ghost(delta: float) -> void:
	if _ghosts.is_empty():
		return
	_ghost_age += delta
	var fade := clampf((_ghost_age - GHOST_HOLD) / GHOST_FADE, 0.0, 1.0)
	_ghost_mat.albedo_color = Color(GHOST, 0.42 * (1.0 - fade))
	if fade >= 1.0:
		_clear_ghosts()


func _age_fracture(delta: float) -> void:
	if _ring_age < RING_LIFE:
		_ring_age += delta
		var k := clampf(_ring_age / RING_LIFE, 0.0, 1.0)
		_ring.visible = k < 1.0
		_ring.scale = Vector3.ONE * lerpf(0.7, 2.2, 1.0 - (1.0 - k) * (1.0 - k))
		_ring_mat.albedo_color = Color(RING, 0.7 * (1.0 - k))
	if _shard_age < SHARD_LIFE:
		_shard_age += delta
		var k := clampf(_shard_age / SHARD_LIFE, 0.0, 1.0)
		for i in SHARDS:
			var s := _shards[i]
			s.visible = k < 1.0
			s.global_position += _shard_vel[i] * delta
			_shard_vel[i] *= 1.0 - 3.0 * delta
			s.rotation += _shard_spin[i] * delta
		_shard_mat.albedo_color = Color(GHOST, 0.9 * (1.0 - k))


## The Shadow Origin's afterimage: his meshes baked in the pose he has now, where he stands, and the katana.
func _afterimage() -> void:
	_clear_ghosts()
	for m in fighter.visual.meshes:
		# (Godot 4.3+: the skinned mesh as the skeleton poses it now, baked into a plain mesh)
		var baked: Variant = m.call("bake_mesh_from_current_skeleton_pose") \
			if m.has_method("bake_mesh_from_current_skeleton_pose") else null
		if baked is Mesh:
			_ghost(baked as Mesh, m.global_transform)
	if fighter.visual.katana:
		for n in fighter.visual.katana.find_children("*", "MeshInstance3D", true, false):
			var k := n as MeshInstance3D
			_ghost(k.mesh, k.global_transform)
	_ghost_age = 0.0
	_ghost_mat.albedo_color = Color(GHOST, 0.42)


func _ghost(mesh: Mesh, at: Transform3D) -> void:
	var g := MeshInstance3D.new()
	g.mesh = mesh
	g.material_override = _ghost_mat
	g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(g)
	g.global_transform = at
	_ghosts.append(g)


func _clear_ghosts() -> void:
	for g in _ghosts:
		g.queue_free()
	_ghosts.clear()


func _puff(at: Vector3, size: float) -> void:
	var i := _next
	_next = (_next + 1) % POOL
	_age[i] = 0.0
	_grow[i] = size
	_puffs[i].global_position = at
	_puffs[i].scale = Vector3.ONE * size * 0.45
	_puffs[i].visible = true
	_mats[i].albedo_color = Color(MIST, 0.55)


## A genuine evasion: the afterimage fractures — shards fly from it — and a pale ring swells where the blade passed.
func _evaded() -> void:
	var at := combat.shadow_origin()
	if not at.is_finite():
		at = fighter.global_position
	var chest := at + Vector3(0, 1.05, 0)
	_ring_age = 0.0
	_ring.global_position = chest
	_ring.scale = Vector3.ONE * 0.7
	_ring.visible = true
	_shard_age = 0.0
	for i in SHARDS:
		var yaw := TAU * float(i) / SHARDS + _rng.randf_range(-0.25, 0.25)
		var dir := Vector3(sin(yaw), _rng.randf_range(-0.35, 0.6), cos(yaw)).normalized()
		_shards[i].global_position = chest + dir * 0.25 + Vector3(0, _rng.randf_range(-0.45, 0.45), 0)
		_shards[i].rotation = Vector3(_rng.randf() * TAU, _rng.randf() * TAU, _rng.randf() * TAU)
		_shard_vel[i] = dir * _rng.randf_range(2.2, 4.0)
		_shard_spin[i] = Vector3(_rng.randf_range(-14, 14), _rng.randf_range(-14, 14), _rng.randf_range(-14, 14))
		_shards[i].visible = true
	_shard_mat.albedo_color = Color(GHOST, 0.9)
	_ghost_age = GHOST_HOLD # (the afterimage breaks: it fades from here)


func _unshaded(c: Color, additive: bool) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if additive:
		m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_color = c
	return m


func _instance(mesh: Mesh, mat: Material) -> MeshInstance3D:
	var p := MeshInstance3D.new()
	p.mesh = mesh
	p.material_override = mat
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	p.visible = false
	add_child(p)
	return p
