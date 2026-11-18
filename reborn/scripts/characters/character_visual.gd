class_name CharacterVisual
extends Node3D
## A character's look and animation player: the model, its materials, its katana, and which move plays. It shows what
## the body is doing (told by Fighter) and never decides anything about movement or the fight.
## Model, moves and textures: assets/characters/samurai (tools/build_samurai.mjs, tools/make_textures.py; sources and
## licences in PROVENANCE.md).

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
var blade_material: StandardMaterial3D


static func create() -> CharacterVisual:
	var v := CharacterVisual.new()
	v._build()
	return v


func _build() -> void:
	var model: Node3D = (load(DIR + "samurai.glb") as PackedScene).instantiate()
	add_child(model)
	for n in model.find_children("*", "AnimationPlayer", true, false):
		anim = n as AnimationPlayer
	for n in model.find_children("*", "Skeleton3D", true, false):
		skeleton = n as Skeleton3D
	for n in model.find_children("*", "MeshInstance3D", true, false):
		meshes.append(n as MeshInstance3D)

	# One opaque, stylised material over the whole atlas: charcoal armour, muted crimson, gold trim (metallic through
	# the surface map), silver-ivory hair. Both faces drawn (the hair locks and thin cloth are single sheets).
	body_material = StandardMaterial3D.new()
	body_material.albedo_texture = TexLoader.load_webp(DIR + "samurai_albedo.webp.bin")
	var orm := TexLoader.load_webp(DIR + "samurai_orm.webp.bin")
	body_material.roughness = 1.0
	body_material.roughness_texture = orm
	body_material.roughness_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_GREEN
	body_material.metallic = 1.0
	body_material.metallic_texture = orm
	body_material.metallic_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_BLUE
	body_material.metallic_specular = 0.45
	body_material.cull_mode = BaseMaterial3D.CULL_DISABLED
	body_material.rim_enabled = true
	body_material.rim = 0.22
	body_material.rim_tint = 0.5
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
		hand.name = "RightHand"
		hand.bone_name = "hand_r"
		skeleton.add_child(hand)
		katana = Node3D.new()
		katana.name = "Katana"
		katana.transform = GRIP
		hand.add_child(katana)
		var k: Node3D = (load(DIR + "katana.glb") as PackedScene).instantiate()
		katana.add_child(k)
		blade_material = StandardMaterial3D.new()
		blade_material.albedo_texture = TexLoader.load_webp(DIR + "katana_albedo.webp.bin")
		blade_material.metallic = 0.85
		blade_material.roughness = 0.3
		blade_material.cull_mode = BaseMaterial3D.CULL_DISABLED
		for n in k.find_children("*", "MeshInstance3D", true, false):
			(n as MeshInstance3D).material_override = blade_material


func has_move(move: String) -> bool:
	return anim != null and anim.has_animation(move)


func duration(move: String) -> float:
	return anim.get_animation(move).length if has_move(move) else 0.5


## Play a move (restarting it when asked); `from` seconds into it.
func play(move: String, blend: float = 0.12, speed: float = 1.0, restart: bool = false, from: float = 0.0) -> void:
	if not has_move(move):
		return
	if move == current and not restart and anim.is_playing():
		anim.speed_scale = speed
		return
	anim.play(move, blend)
	anim.speed_scale = speed
	if restart or from > 0.0:
		anim.seek(from, true)
	current = move


## The lowest point of the body's skeleton above its own origin (the feet's contact with the ground), in metres.
func feet_height() -> float:
	if skeleton == null:
		return 0.0
	var low := INF
	for bone in ["foot_l", "foot_r", "ball_l", "ball_r"]:
		var i := skeleton.find_bone(bone)
		if i >= 0:
			var p := (skeleton.global_transform * skeleton.get_bone_global_pose(i)).origin
			low = minf(low, p.y - global_position.y)
	return 0.0 if low == INF else low
