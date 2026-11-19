extends RefCounted
## M4.1 (GPT's v1.7): the device test's frame times, the graphics presets, the camera's first frame, the damage numbers
## kept apart, the Seal glyph's contrast, the conditional buttons' cue and chime, the engine's errors counted.

func _tree() -> SceneTree:
	return Engine.get_main_loop() as SceneTree


# --- frame times ---------------------------------------------------------------------------------------------------


func test_frame_times_and_their_percentiles() -> String:
	var f := FrameStats.new()
	f.begin("play:Low")
	f.frame(3000.0, true) # (the interval spanning the build itself: left out, not a suspension)
	while f.warming(): # (then 2 s of 16.7 ms frames left out)
		f.frame(16.7, true)
	var lead := f.summary("play:Low")
	if int(lead["frames"]) != 0 or int(lead["excluded"]) < 120 or f.stalls != 0:
		return "the warm-up was measured: %s, %d suspensions" % [lead, f.stalls]
	for i in 100: # 1..100 ms, shuffled: the quantiles are exact
		f.frame(float((i * 37) % 100 + 1), true)
	var s := f.summary("play:Low")
	var got := [s["frames"], s["p50"], s["p95"], s["p99"], s["worst"], snappedf(float(s["over33"]), 0.1),
		snappedf(float(s["over50"]), 0.1), snappedf(float(s["seconds"]), 0.001)]
	var want := [100, 50.0, 95.0, 99.0, 100.0, 67.0, 50.0, 5.05]
	if str(got) != str(want):
		return "the summary: %s (want %s)" % [got, want]
	var r := f.recent() # (only the last 10 s: 5.05 s of frames, all of them)
	return "" if int(r["frames"]) == 100 and is_equal_approx(float(r["p50"]), 50.0) else "the rolling view: %s" % r


func test_frame_times_leave_out_what_they_must() -> String:
	var f := FrameStats.new()
	f.begin("play:High")
	for i in 130: # (past its warm-up)
		f.frame(16.0, true)
	var before := int(f.summary("play:High")["frames"])
	f.frame(16.0, false) # (paused, hidden or loading)
	f.frame(2500.0, true) # (the app put away: a suspension, not a frame)
	f.frame(16.0, true)
	f.begin("play:Medium") # (a new preset: its own set, after a warm-up)
	f.frame(16.0, true)
	var a := f.summary("play:High")
	var b := f.summary("play:Medium")
	var got := [int(a["frames"]) - before, f.stalls, b["frames"], b["excluded"], int(a["excluded"]) >= 124]
	if str(got) != str([1, 1, 0, 1, true]):
		return "left out: %s (want High 1 more frame, 1 suspension, Medium 0 frames and 1 warm-up frame)" % [got]
	for i in 12 * 60 + 130: # (past Medium's warm-up, then 12 s: the rolling view keeps 10 s)
		f.frame(16.0, true)
	var r := f.recent()
	return "" if int(r["frames"]) == 625 else "the rolling view kept %d frames of 16 ms (want 625: 10 s)" % r["frames"]


# --- the graphics presets -------------------------------------------------------------------------------------------


func test_the_presets_are_gpts() -> String:
	var want := [[0.5, 0, 0], [0.75, 1, 2048], [1.0, 2, 4096]]
	for i in 3:
		var q: Dictionary = Game.QUALITY[i]
		if str([q["scale"], q["splits"], q["map"]]) != str(want[i]):
			return "%s: %s (want %s)" % [Game.QUALITY_NAMES[i], q, want[i]]
	var moon := DirectionalLight3D.new()
	_tree().root.add_child(moon)
	FallenMoonCourtyard.moon = moon
	var keep := Game.quality
	var rows := []
	for i in 3:
		Game.quality = i
		Game.apply_quality()
		FallenMoonCourtyard.apply_quality(Game.preset())
		rows.append([snappedf(_tree().root.scaling_3d_scale, 0.01), moon.shadow_enabled,
			moon.directional_shadow_mode if moon.shadow_enabled else -1])
	Game.quality = keep
	Game.apply_quality()
	FallenMoonCourtyard.moon = null
	moon.free()
	var expect := [[0.5, false, -1], [0.75, true, DirectionalLight3D.SHADOW_ORTHOGONAL],
		[1.0, true, DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS]]
	return "" if str(rows) == str(expect) else "the presets applied: %s (want %s)" % [rows, expect]


# --- the camera's first frame ------------------------------------------------------------------------------------------


func test_the_camera_starts_settled() -> String:
	var root := _tree().root
	var player := Node3D.new()
	player.position = Vector3(0, 0, 7)
	root.add_child(player)
	var foe := Node3D.new()
	root.add_child(foe)
	var rig := CameraRig.new()
	rig.target = player
	root.add_child(rig)
	rig.snap_behind(PI)
	rig.focus = foe
	rig.mode = CameraRig.Mode.COMBAT
	var before := rig.cam.global_transform.origin # (a camera not yet placed: on the floor)
	rig.settle()
	var t0 := rig.cam.global_transform
	var fov0 := rig.cam.fov
	var moved := 0.0
	var turned := 0.0
	var zoomed := 0.0
	for i in 15:
		rig._process(1.0 / 60.0)
		moved = maxf(moved, rig.cam.global_transform.origin.distance_to(t0.origin))
		var b := rig.cam.global_transform.basis # (its axes' angles: a quaternion's acos is too coarse this near 0)
		turned = maxf(turned, rad_to_deg(maxf(b.z.angle_to(t0.basis.z), b.x.angle_to(t0.basis.x))))
		zoomed = maxf(zoomed, absf(rig.cam.fov - fov0))
	var h := t0.origin.y
	for n: Node in [rig, foe, player]:
		n.free()
	if before.y > 0.5:
		return "(the case is wrong: the camera began %.2f m up)" % before.y
	if h < 3.0 or absf(fov0 - 44.0) > 0.01:
		return "settled, the camera is %.2f m up with a %.1f° view (want the combat framing: above 3 m, 44°)" % [h, fov0]
	return "" if moved < 0.01 and turned < 0.02 and zoomed < 0.01 else \
		"over the next 15 frames it still moved %.3f m, turned %.2f°, zoomed %.2f° (want none)" % [moved, turned, zoomed]


# --- the damage numbers kept apart ---------------------------------------------------------------------------------


## A view of `at` from `yaw` degrees around it, 8 m away and 33° down (the combat framing).
func _view(at: Vector3, yaw: float) -> Transform3D:
	var dir := Vector3(sin(deg_to_rad(yaw)), 0, cos(deg_to_rad(yaw)))
	var eye := at + dir * 8.0 * cos(deg_to_rad(33.0)) + Vector3(0, 8.0 * sin(deg_to_rad(33.0)) + 1.0, 0)
	return Transform3D(Basis.IDENTITY, eye).looking_at(at + Vector3(0, 1.0, 0), Vector3.UP)


func test_the_damage_numbers_stay_apart() -> String:
	# [the time it appears, its text, the target's place then] — a detonation's 24 then the Execution's 45 0.6 s later
	# on a target pushed 0.6 m; and three quick strikes 10, 12, 18
	var cases := [
		[[0.0, "24", Vector3.ZERO], [0.6, "45", Vector3(0, 0, -0.6)]],
		[[0.0, "10", Vector3.ZERO], [0.15, "12", Vector3.ZERO], [0.3, "18", Vector3(0, 0, -0.5)]],
	]
	for yaw: float in [0.0, 70.0, 150.0, 235.0]:
		for c: Array in cases:
			var view := _view(Vector3.ZERO, yaw)
			var inv := view.affine_inverse()
			var placed: Array = [] # [when, where, width]
			for n: Array in c:
				var others: Array[Vector3] = []
				var widths: Array[float] = []
				for p: Array in placed:
					if float(n[0]) - float(p[0]) < DamageNumbers.LIFE:
						others.append(DamageNumbers.rise_at(p[1], float(n[0]) - float(p[0])))
						widths.append(float(p[2]))
				var w := String(n[1]).length() * DamageNumbers.CHAR_W
				placed.append([float(n[0]), DamageNumbers.place(view, (n[2] as Vector3) + Vector3(0, 2.2, 0), w, others, widths), w])
			# every pair, through every moment both show: their columns never touch
			for i in placed.size():
				for j in range(i + 1, placed.size()):
					var a: Array = placed[i]
					var b: Array = placed[j]
					var t := float(b[0])
					while t < float(a[0]) + DamageNumbers.LIFE:
						var room := DamageNumbers.clearance(inv, DamageNumbers.rise_at(b[1], t - float(b[0])), float(b[2]),
							DamageNumbers.rise_at(a[1], t - float(a[0])), float(a[2]))
						if room < 0.12: # (a clear space between them, about half a digit, all the while)
							return "seen from %.0f°, %s and %s overlap %.2f s in (room %.2f m)" % [yaw,
								c[i][1], c[j][1], t, room]
						t += 0.05
	return ""


# --- the Seal glyph's contrast --------------------------------------------------------------------------------------


func test_the_glyphs_contrast_is_gpts() -> String:
	var rest := SealVisual.glyph_look(0.2, 0.45) # (between the first and second pulses)
	var peak := SealVisual.glyph_look(0.33 + 0.06, 0.26) # (the second pulse at its height)
	var early := SealVisual.glyph_look(0.65 - 0.10, 0.10) # (20 ms into the last 120 ms)
	var flared := SealVisual.glyph_look(0.65 - 0.08, 0.08) # (40 ms in)
	var last := SealVisual.glyph_look(0.65 - 0.001, 0.001)
	var rows := [[snappedf(rest.y, 0.01), snappedf(rest.z, 0.01)], [snappedf(peak.y, 0.01), snappedf(peak.z, 0.01)],
		[snappedf(flared.y, 0.01), snappedf(flared.z, 0.01)], [snappedf(last.y, 0.01), snappedf(last.z, 0.01), snappedf(last.x, 0.01)]]
	var want := [[0.0, 0.5], [0.85, 1.0], [1.0, 1.0], [1.0, 1.0, 0.56]]
	if str(rows) != str(want):
		return "the glyph (hot, alpha[, size]) at rest, a peak, 40 ms into its flare, its last moment: %s (want %s)" % [rows, want]
	return "" if early.z > rest.z and early.z < 1.0 else "20 ms into its flare its alpha is %.2f (want between rest and full)" % early.z


# --- the conditional buttons' cue and chime --------------------------------------------------------------------------


func test_the_cue_marks_each_new_opportunity_on_a_button() -> String:
	var tc := TouchControls.new()
	var pin := PlayerInput.new()
	tc.input = pin
	_tree().root.add_child(tc)
	tc.size = Vector2(1280, 720)
	tc._layout()
	var rows := []
	tc.set_conditional("cond1", "PULL", true, 1.0, "chain_pull:7")
	rows.append(tc.cue_age("cond1") >= 0.0) # a new one: cued
	tc._process(0.2)
	tc.set_conditional("cond1", "PULL", true, 0.8, "chain_pull:7")
	rows.append(is_equal_approx(tc.cue_age("cond1"), 0.2)) # the same one: its cue runs on, none anew
	tc._process(0.2)
	rows.append(tc.cue_age("cond1") < 0.0) # over after 0.3 s
	tc.set_conditional("cond1", "SEAL", true, 1.0, "explosive_seal:7")
	rows.append(tc.cue_age("cond1") >= 0.0) # another one on the same button: cued
	tc.set_conditional("cond1", "", false)
	rows.append(tc.cue_age("cond1") < 0.0) # gone with it
	# the ring stays clear of its neighbours, the waiting chip included
	tc.set_conditional("cond2", "COUNTER", true, 1.0, "shadow_counter:9")
	tc.set_waiting(1)
	var r := float(tc._btn["cond2"]["r_art"])
	var reach := tc.cue_reach("cond2")
	var clear := true
	for k in ["cond1", "more", "skill2", "skill3"]:
		var o: Dictionary = tc._btn[k]
		var extent := float(o["r_art"]) * (1.5 if k == "more" else 1.0)
		if tc.is_shown(k) and (o["c"] as Vector2).distance_to(tc._btn["cond2"]["c"]) - extent < reach:
			clear = false
	rows.append(reach > r and reach <= r * TouchControls.CUE_GROW + 1e-3 and clear)
	var hit_r := float(tc._btn["cond2"]["r_hit"])
	tc.free()
	pin.free()
	return "" if rows == [true, true, true, true, true, true] else \
		"cued: new %s, the same one again (no new cue) %s, over at 0.3 s %s, another %s, gone %s; the ring within %.1f..%.1f px and clear %s (hit radius %.1f unchanged)" % [
			rows[0], rows[1], rows[2], rows[3], rows[4], r, r * TouchControls.CUE_GROW, rows[5], hit_r]


func test_a_newly_earned_opportunity_chimes_once() -> String:
	var g := LegacyChain.new(AttackData.graph())
	var heard: Array = []
	g.opened.connect(func(ability: String, target: int) -> void: heard.append([ability, target]))
	g.event("sequence", 7) # SEAL earned
	g.event("sequence", 7) # the same again: renewed, not new
	g.event("detonated", 7) # EXECUTE earned
	g.promote() # (bringing a waiting one onto a button earns nothing)
	return "" if str(heard) == str([["explosive_seal", 7], ["phantom_execution", 7]]) else \
		"the chime's signal: %s (want SEAL then EXECUTE, once each)" % [heard]


# --- the engine's errors counted --------------------------------------------------------------------------------------


func test_the_engine_errors_are_counted() -> String:
	var l := DeviceLogger.new()
	OS.add_logger(l)
	push_warning("M4.1 test: a warning the device test counts")
	push_error("M4.1 test: an error the device test counts")
	OS.remove_logger(l)
	var s := l.snapshot()
	return "" if int(s["errors"]) == 1 and int(s["warnings"]) == 1 and String(s["last"][0]).contains("device test counts") \
		else "counted %s (want 1 error, 1 warning, its text kept)" % s


# --- the hit bursts where the blade bit ------------------------------------------------------------------------------


func test_a_hit_burst_starts_where_the_blade_bit() -> String:
	var vfx := HitVfx.new()
	_tree().root.add_child(vfx)
	var at := Vector3(-3.2, 1.2, -2.1)
	var seen: Array = []
	vfx.child_entered_tree.connect(func(n: Node) -> void:
		if n is CPUParticles3D:
			seen.append([(n as Node3D).global_position, (n as CPUParticles3D).emitting]))
	vfx._burst(at, Vector3.FORWARD, 10, 1.0)
	var p: CPUParticles3D = null
	for c in vfx.get_children():
		if c is CPUParticles3D:
			p = c
	var res := [seen.size(), seen[0][0].distance_to(at) < 1e-4 if seen.size() > 0 else false,
		not bool(seen[0][1]) if seen.size() > 0 else false, p != null and p.emitting,
		p != null and (p.material_override as BaseMaterial3D).billboard_keep_scale] # (each spark its own size)
	vfx.free()
	return "" if str(res) == str([1, true, true, true, true]) else \
		"a burst joined the tree %s (want once, already where the blade bit, not yet emitting; then emitting, its sparks keeping their size): %s" % [res, seen]
