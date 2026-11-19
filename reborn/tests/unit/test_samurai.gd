extends RefCounted
## The Samurai's game files: the body, its skeleton and moves (the three sword strikes too), the katana in the right
## hand, and the runtime textures.

const MOVES: Array[String] = ["Idle_Loop", "Sword_Idle", "Walk_Loop", "Jog_Fwd_Loop", "Sprint_Loop", "Roll",
	"Jump_Start", "Jump_Loop", "Jump_Land", "Sword_Regular_A", "Sword_Regular_B", "Sword_Regular_C", "Sword_Attack",
	"Sword_Heavy_Combo", "Spell_Simple_Enter", "Spell_Simple_Exit", "Air_Chop"]


func test_body_has_its_skeleton_and_moves() -> String:
	var v := CharacterVisual.create()
	var err := ""
	if v.anim == null:
		err = "no AnimationPlayer"
	elif v.skeleton == null:
		err = "no Skeleton3D"
	else:
		for m in MOVES:
			if not v.has_move(m):
				err = "missing move %s (has %s)" % [m, v.anim.get_animation_list()]
				break
		for b in ["pelvis", "hand_r", "foot_l", "foot_r"]:
			if v.skeleton.find_bone(b) < 0:
				err = "missing bone " + b
	v.free()
	return err


func test_locomotion_cycles_loop() -> String:
	var v := CharacterVisual.create()
	var err := ""
	for m in ["Idle_Loop", "Walk_Loop", "Jog_Fwd_Loop", "Sprint_Loop", "Sword_Idle"]:
		if not v.has_move(m) or v.anim.get_animation(v._alias[m]).loop_mode != Animation.LOOP_LINEAR:
			err = m + " does not loop"
			break
	v.free()
	return err


func test_katana_rides_the_right_hand() -> String:
	var v := CharacterVisual.create()
	var err := ""
	if v.katana == null:
		err = "no katana"
	else:
		var hand := v.katana.get_parent() as BoneAttachment3D
		if hand == null or hand.bone_name != "hand_r":
			err = "the katana is not on hand_r"
		elif v.katana.find_children("*", "MeshInstance3D", true, false).is_empty():
			err = "the katana has no mesh"
	v.free()
	return err


func test_runtime_textures_decode() -> String:
	for p in ["res://assets/characters/samurai/samurai_albedo.webp.bin", "res://assets/characters/samurai/samurai_orm.webp.bin",
			"res://assets/characters/samurai/katana_albedo.webp.bin", "res://assets/env/flagstones.webp.bin"]:
		var bytes := FileAccess.get_file_as_bytes(p)
		var img := Image.new()
		if bytes.is_empty() or img.load_webp_from_buffer(bytes) != OK:
			return "cannot decode " + p
		if img.get_width() < 64:
			return "%s is only %d px wide" % [p, img.get_width()]
	return ""
