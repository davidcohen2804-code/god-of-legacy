class_name CharacterVisual
extends Node3D
## A character's look and animation controller: the model, its material, its katana, and which move plays. It reads
## what the body is doing (told by Fighter) and never decides anything about the fight.
## Model and moves: assets/characters/samurai (tools/build_samurai.mjs; sources in PROVENANCE.md).

const DIR := "res://assets/characters/samurai/"
const LOOPS: Array[String] = ["Idle_Loop", "Walk_Loop", "Jog_Fwd_Loop", "Sprint_Loop", "Sword_Idle", "Jump_Loop",
	"NinjaJump_Idle_Loop", "Idle_FoldArms_Loop"]
## The katana in the right hand's bone space (tools/build_samurai.mjs → tools/grip.json): across the closed fist,
## the blade beyond the index finger, its edge toward the knuckles.
const GRIP := Transform3D(
	Basis(Vector3(-0.0375, 0.9692, -0.2434), Vector3(-0.01446, 0.24307, 0.9699), Vector3(0.99919, 0.03989, 0.0049)),
	Vector3(-0.03174, 0.11066, 0.0413))

var anim: AnimationPlayer
var skeleton: Skeleton3D
var meshes: Array[MeshInstance3D] = []
var katana: Node3D
var current := ""
var body_material: StandardMaterial3D
var _flash := 0.0
var _flash_color := Color.WHITE
var _base_emission := Color.BLACK
var _base_energy := 0.0


## The Samurai; `shade` dresses the same body as a shadow warrior (the enemies), tinted `tint`.
static func create(shade: bool = false, tint: Color = Color(0.55, 0.3, 1.0)) -> CharacterVisual:
	var v := CharacterVisual.new()
	v._build(shade, tint)
	return v


func _build(shade: bool, tint: Color) -> void:
	var model: Node3D = (load(DIR + "samurai.glb") as PackedScene).instantiate()
	add_child(model)
	for n in model.find_children("*", "AnimationPlayer", true, false):
		anim = n as AnimationPlayer
	for n in model.find_children("*", "Skeleton3D", true, false):
		skeleton = n as Skeleton3D
	for n in model.find_children("*", "MeshInstance3D", true, false):
		meshes.append(n as MeshInstance3D)

	body_material = StandardMaterial3D.new()
	body_material.albedo_texture = TexLoader.load_webp(DIR + "samurai_albedo.webp.bin")
	body_material.roughness = 0.78
	body_material.cull_mode = BaseMaterial3D.CULL_DISABLED
	body_material.diffuse_mode = BaseMaterial3D.DIFFUSE_LAMBERT_WRAP
	body_material.rim_enabled = true
	body_material.rim = 0.35
	body_material.rim_tint = 0.6
	body_material.emission_enabled = true
	if shade:
		body_material.albedo_color = Color(0.2, 0.2, 0.26)
		body_material.emission = tint
		body_material.emission_energy_multiplier = 0.22
		body_material.rim = 0.9
		body_material.rim_tint = 0.0
	else:
		body_material.emission = Color.BLACK
		body_material.emission_energy_multiplier = 0.0
	_base_emission = body_material.emission
	_base_energy = body_material.emission_energy_multiplier
	for m in meshes:
		m.material_override = body_material
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON

	if anim:
		for n in LOOPS:
			if anim.has_animation(n):
				anim.get_animation(n).loop_mode = Animation.LOOP_LINEAR
		anim.playback_default_blend_time = 0.12

	if skeleton:
		var hand := BoneAttachment3D.new()
		hand.bone_name = "hand_r"
		skeleton.add_child(hand)
		katana = Node3D.new()
		katana.transform = GRIP
		hand.add_child(katana)
		var k: Node3D = (load(DIR + "katana.glb") as PackedScene).instantiate()
		katana.add_child(k)
		var km := StandardMaterial3D.new()
		km.albedo_texture = TexLoader.load_webp(DIR + "katana_albedo.webp.bin")
		km.metallic = 0.55
		km.roughness = 0.32
		km.cull_mode = BaseMaterial3D.CULL_DISABLED
		if shade:
			km.albedo_color = Color(0.35, 0.3, 0.45)
			km.emission_enabled = true
			km.emission = tint
			km.emission_energy_multiplier = 0.6
		for n in k.find_children("*", "MeshInstance3D", true, false):
			(n as MeshInstance3D).material_override = km


func duration(name: String) -> float:
	return anim.get_animation(name).length if anim and anim.has_animation(name) else 0.5


## Play a move (restarting it when asked); `from` seconds into it.
func play(name: String, blend: float = 0.12, speed: float = 1.0, restart: bool = false, from: float = 0.0) -> void:
	if anim == null or not anim.has_animation(name):
		return
	if name == current and not restart and anim.is_playing():
		anim.speed_scale = speed
		return
	anim.play(name, blend)
	anim.speed_scale = speed
	if restart or from > 0.0:
		anim.seek(from, true)
	current = name


## Locomotion from the body's ground speed (m/s) and whether it is sprinting, in or out of a fight.
func locomotion(speed: float, sprinting: bool, combat_ready: bool) -> void:
	if speed < 0.35:
		play("Sword_Idle" if combat_ready else "Idle_Loop", 0.18)
	elif sprinting and speed > 6.0:
		play("Sprint_Loop", 0.15, clampf(speed / 7.6, 0.7, 1.4))
	elif speed < 1.6:
		play("Walk_Loop", 0.15, clampf(speed / 1.4, 0.6, 1.3))
	else:
		play("Jog_Fwd_Loop", 0.15, clampf(speed / 4.6, 0.7, 1.35))


## A short glow when hit (or for effects).
func flash(color: Color, time: float = 0.12) -> void:
	_flash = time
	_flash_color = color


func _process(delta: float) -> void:
	if _flash > 0.0:
		_flash -= delta
		body_material.emission = _flash_color
		body_material.emission_energy_multiplier = 1.4 * clampf(_flash / 0.12, 0.0, 1.0) + _base_energy
		if _flash <= 0.0:
			body_material.emission = _base_emission
			body_material.emission_energy_multiplier = _base_energy
