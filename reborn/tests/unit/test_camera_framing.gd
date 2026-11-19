extends RefCounted
## M4.2-A (GPT's v2.1): the three combat framings compared — A the current one unchanged, B closer, C adaptive from the
## projected heads and feet (its emergency extension counted) — and the foreground columns fading out of the fight.

func _tree() -> SceneTree:
	return Engine.get_main_loop() as SceneTree


## A rig framing `player` and `foe` (a body each: hurt_radius and hurt_height like the fighters'), settled.
func _rig(variant: String, foe_at: Vector3, exclusions: Array[Rect2] = []) -> Dictionary:
	var root := _tree().root
	var player := _body(Vector3(0, 0, 4))
	var foe := _body(foe_at)
	var rig := CameraRig.new()
	rig.target = player
	root.add_child(rig)
	rig.screen = rig.get_viewport().get_visible_rect().size
	rig.exclusions = exclusions
	CameraRig.variant = variant
	var to := foe.global_position - player.global_position
	rig.yaw = atan2(-to.x, -to.z)
	rig.focus = foe
	rig.mode = CameraRig.Mode.COMBAT
	rig.settle()
	return {"rig": rig, "player": player, "foe": foe}


## (a body the rig frames: without a hurt box of its own it takes a fighter's — 0.35 m either side, 1.9 m tall)
func _body(at: Vector3) -> Node3D:
	var n := Node3D.new()
	_tree().root.add_child(n)
	n.global_position = at
	return n


func _done(d: Dictionary) -> void:
	CameraRig.variant = "B"
	for k: String in ["rig", "player", "foe"]:
		(d[k] as Node).free()



func test_framing_a_is_the_baseline() -> String:
	# (the current framing, unchanged: 7.2 m, 44°, 33°, a quarter metre more per metre apart beyond 3 m)
	var d := _rig("A", Vector3(0, 0, -3)) # (7 m apart: 7.2 + 1.0)
	var rig: CameraRig = d["rig"]
	var got := [snappedf(rig.distance(), 0.01), snappedf(rig.cam.fov, 0.01), snappedf(rig.elevation(), 0.01)]
	_done(d)
	return "" if str(got) == str([8.2, 44.0, 33.0]) else "A settled at %s (want distance 8.2, 44°, 33°)" % [got]


func test_framing_b_is_closer() -> String:
	var d := _rig("B", Vector3(0, 0, -3))
	var rig: CameraRig = d["rig"]
	var got := [snappedf(rig.distance(), 0.01), snappedf(rig.cam.fov, 0.01), snappedf(rig.elevation(), 0.01)]
	_done(d)
	return "" if str(got) == str([6.6, 42.0, 32.0]) else "B settled at %s (want 6.6 m, 42°, 32° whatever the gap)" % [got]


func test_the_projection_is_the_cameras() -> String:
	# (C fits its distance with this projection: it must put a point where the camera itself draws it)
	var d := _rig("B", Vector3(0, 0, 1.5))
	var rig: CameraRig = d["rig"]
	var b := rig.cam.global_transform.basis
	var centre := rig.cam.global_transform.origin - b.z * rig.distance()
	var worst := 0.0
	for p: Vector3 in [Vector3(0, 0, 4), Vector3(0.6, 1.9, 1.5), Vector3(-2.0, 0.2, -1.0), Vector3(1.5, 2.5, 2.0)]:
		var s := CameraRig.project(p, centre, b, rig.distance(), rig.cam.fov, rig.screen)
		worst = maxf(worst, Vector2(s.x, s.y).distance_to(rig.cam.unproject_position(p)))
	_done(d)
	return "" if worst < 0.5 else "the projection is %.2f px off the camera's own (want under half a pixel)" % worst


func test_framing_c_keeps_both_whole_and_clear_of_the_hud() -> String:
	var view := _tree().root.get_visible_rect().size
	var band: Array[Rect2] = [Rect2(0, 0, view.x, view.y * 0.153), Rect2(view.x * 0.62, view.y * 0.5, view.x * 0.38, view.y * 0.5)]
	var near := _rig("C", Vector3(0, 0, 1.5), band) # (2.5 m apart: the near end of its band holds them)
	var rig: CameraRig = near["rig"]
	var d_near := rig.distance()
	var clear := true
	for n: Node3D in [near["player"], near["foe"]]:
		var box: Dictionary = rig.screen_box(n, 1.0)
		if bool(box["in_hud"]) or bool(box["off_screen"]):
			clear = false
	var fell := rig.fallback
	_done(near)
	var far := _rig("C", Vector3(4, 0, -4), band) # (9 m apart: past the band — the emergency extension)
	rig = far["rig"]
	var d_far := rig.distance()
	var fell_far := rig.fallback
	var count := rig.fallbacks
	var whole := true
	for n: Node3D in [far["player"], far["foe"]]:
		var box: Dictionary = rig.screen_box(n, 1.0)
		if bool(box["off_screen"]):
			whole = false
	_done(far)
	if absf(d_near - CameraRig.C_NEAR) > 0.01 or fell or not clear:
		return "2.5 m apart, C sat at %.2f m (fallback %s), both clear %s (want 6.6 m, no fallback, both clear)" % [d_near, fell, clear]
	if not fell_far or count != 1 or d_far <= CameraRig.C_FAR or d_far > CameraRig.FALLBACK_MAX + 0.001 or not whole:
		return "far apart, C sat at %.2f m (fallback %s, counted %d, both whole %s) — want past 7.2 m, at most 8.7, counted once, both whole" % [
			d_far, fell_far, count, whole]
	return ""


func test_a_foreground_column_fades_and_one_behind_does_not() -> String:
	var d := _rig("A", Vector3(0, 0, 1.5))
	var rig: CameraRig = d["rig"]
	var fader := OcclusionFader.new()
	fader.rig = rig
	_tree().root.add_child(fader)
	# one column between the camera and the Samurai, one behind both fighters
	var mid := (rig.cam.global_transform.origin + Vector3(0, 0, 4)) * 0.5
	var front := _column(Vector3(mid.x + 0.3, 0, mid.z))
	var back := _column(Vector3(0, 0, -3.0))
	fader.add_group([front])
	fader.add_group([back])
	var own: Material = front.material_override
	var was := OcclusionFader.enabled
	OcclusionFader.enabled = true
	for i in 10:
		fader._process(0.05)
	var a := fader.info()["alphas"] as Array
	var faded_mat := front.material_override
	OcclusionFader.enabled = false
	for i in 20:
		fader._process(0.05)
	var back_mat := front.material_override
	var b := fader.info()["alphas"] as Array
	OcclusionFader.enabled = was
	for n: Node in [front, back, fader]:
		n.free()
	_done(d)
	if not (float(a[0]) <= OcclusionFader.opacity + 0.001 and float(a[1]) == 1.0):
		return "the opacities with the fading on: %s (want the column in front at %.2f, the one behind at 1)" % [a, OcclusionFader.opacity]
	if faded_mat == own or (faded_mat as BaseMaterial3D).transparency != BaseMaterial3D.TRANSPARENCY_ALPHA:
		return "the faded column did not take its transparent copy"
	return "" if back_mat == own and float(b[0]) == 1.0 else "switched off, the column is at %s with %s (want 1, its own material)" % [b[0], back_mat]


func test_a_column_stands_across_a_line_through_it_only() -> String:
	# (the review's side view keeps a clear line to the fighters with it)
	var fader := OcclusionFader.new()
	_tree().root.add_child(fader)
	var col := _column(Vector3.ZERO)
	fader.add_group([col])
	var through := fader.blocks(Vector3(-3, 1, 0), Vector3(3, 1, 0))
	var past := fader.blocks(Vector3(-3, 1, 2), Vector3(3, 1, 2))
	col.free()
	fader.free()
	return "" if through and not past else "a line through the column: %s, one 2 m past it: %s (want true, false)" % [through, past]


func _column(at: Vector3) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = 0.4
	c.bottom_radius = 0.45
	c.height = 5.0
	m.mesh = c
	m.material_override = StandardMaterial3D.new()
	_tree().root.add_child(m)
	m.global_position = at + Vector3(0, 2.5, 0)
	return m


# --- B's corrections (M4.2-A2, GPT's v2.2) ---------------------------------------------------------------------------


func test_b_stands_off_his_shoulder_and_keeps_its_aim_centred() -> String:
	var with := _rig("B", Vector3(0, 0, 1.5))
	var rig: CameraRig = with["rig"]
	var side := (rig.cam.global_position - (with["player"] as Node3D).global_position).dot(Basis(Vector3.UP, rig.yaw).x)
	var sx := rig.cam.unproject_position((with["player"] as Node3D).global_position + Vector3(0, 0.9, 0)).x
	var fx := rig.cam.unproject_position((with["foe"] as Node3D).global_position + Vector3(0, 0.9, 0)).x
	var mid := rig.screen.x * 0.5
	_done(with)
	CameraRig.shoulder = 0.0
	var plain := _rig("B", Vector3(0, 0, 1.5))
	rig = plain["rig"]
	var sx0 := rig.cam.unproject_position((plain["player"] as Node3D).global_position + Vector3(0, 0.9, 0)).x
	var fx0 := rig.cam.unproject_position((plain["foe"] as Node3D).global_position + Vector3(0, 0.9, 0)).x
	_done(plain)
	CameraRig.shoulder = 0.35
	var apart := (sx - fx) - (sx0 - fx0)
	if absf(side + 0.35) > 0.02:
		return "the camera stands %.2f m to his right (want 0.35 m to his left)" % side
	return "" if apart > 4.0 and absf((sx + fx) * 0.5 - mid) < 40.0 else \
		"him %.1f px and the foe %.1f px across (plain: %.1f, %.1f): parted by %.1f px more (want > 4, the pair still near the middle %.1f)" % [
			sx, fx, sx0, fx0, apart, mid]


func test_b_rises_and_flattens_for_a_target_in_the_air() -> String:
	var view := _tree().root.get_visible_rect().size
	var band: Array[Rect2] = [Rect2(0, 0, view.x, view.y * 0.153)]
	var up := _rig("B", Vector3(0, 2.2, 1.5), band) # (launched: 2.2 m up, 2.5 m ahead)
	var rig: CameraRig = up["rig"]
	var got := [snappedf(rig.lift, 0.01), snappedf(rig.elevation(), 0.01)]
	var head := float((rig.screen_box(up["foe"], 1.0)["box"] as Array)[1])
	_done(up)
	CameraRig.air_framing = false
	var flat := _rig("B", Vector3(0, 2.2, 1.5), band)
	rig = flat["rig"]
	var head0 := float((rig.screen_box(flat["foe"], 1.0)["box"] as Array)[1])
	_done(flat)
	CameraRig.air_framing = true
	if got != [0.8, 30.0]:
		return "a target 2.2 m up: the aim rose %s m, the pitch %s° (want 0.8, 30)" % got
	return "" if head > head0 + 10.0 else "its head at %.1f px from the top (without the correction %.1f): want it lower on the screen" % [head, head0]


func test_b_turns_a_little_when_the_target_enters_the_cluster() -> String:
	var d := _rig("B", Vector3(0, 0, 1.5))
	var rig: CameraRig = d["rig"]
	rig.yaw += deg_to_rad(18.0) # (the camera turned left: the target sits right of the middle)
	rig.settle()
	rig.assist_zone = Rect2(rig.screen.x * 0.56, 0.0, rig.screen.x * 0.44, rig.screen.y)
	var yaw0 := rig.yaw
	var in0: bool = Rect2(rig.screen_box(d["foe"], 1.0)["box"][0], rig.screen_box(d["foe"], 1.0)["box"][1],
		rig.screen_box(d["foe"], 1.0)["box"][2], rig.screen_box(d["foe"], 1.0)["box"][3]).intersects(rig.assist_zone)
	for i in 90:
		rig._update(1.0 / 30.0, false)
	var turned := rad_to_deg(yaw0 - rig.yaw)
	var count := rig.assists
	# a drag stops it at once and it waits before acting again
	rig.yaw += deg_to_rad(12.0)
	rig.turn(Vector2(1, 0))
	var y1 := rig.yaw
	for i in 6: # 0.2 s: inside its pause
		rig._update(1.0 / 30.0, false)
	var during := absf(rad_to_deg(rig.yaw - y1))
	_done(d)
	if not in0:
		return "the setup did not put the target in the zone"
	if count < 1 or turned <= 1.0 or turned > CameraRig.ASSIST_MAX + 0.01:
		return "it turned %.2f° (%d times) with the target in the cluster (want some, %.0f° at most)" % [turned, count, CameraRig.ASSIST_MAX]
	return "" if during < 0.01 else "it turned %.2f° within its pause after a drag (want none)" % during


func test_a_column_beside_the_camera_does_not_fade() -> String:
	# (M4.2-A2: a box reaching behind the camera is cut at the camera, not taken as covering the screen — a column
	# beside it, out of view, faded unseen and its shadow went with it)
	var d := _rig("A", Vector3(0, 0, 1.5))
	var rig: CameraRig = d["rig"]
	var fader := OcclusionFader.new()
	fader.rig = rig
	_tree().root.add_child(fader)
	var cam := rig.cam.global_transform
	var side := _column(Vector3(cam.origin.x, 0, cam.origin.z) + cam.basis.x.slide(Vector3.UP).normalized() * 1.6)
	fader.add_group([side])
	var was := OcclusionFader.enabled
	OcclusionFader.enabled = true
	for i in 10:
		fader._process(0.05)
	var a := float((fader.info()["alphas"] as Array)[0])
	OcclusionFader.enabled = was
	for n: Node in [side, fader]:
		n.free()
	_done(d)
	return "" if a == 1.0 else "a column 1.6 m beside the camera, out of its view, faded to %.2f (want 1)" % a
