extends Node3D
## Arena — M3–M4: sword combat in the Fallen Moon Courtyard. The Samurai, the straw training dummy in the middle (a
## fixed diagnostic target) and, north-west of it, the Training Automaton (M4: the humanoid opponent the skills are
## tried on — pulled, launched, knocked down — and, from Stage C, a sparring partner whose telegraphed sweep he can
## take, roll from, or evade with Shadow Step and answer with Shadow Counter): walk, run, sprint, jump and dodge
## relative to the camera, the three-strike katana chain, Heavy and the skills — from the touch controls (several
## fingers at once), the keyboard or a gamepad. The camera
## frames him with the target he is fighting (the one he struck in the last seconds, else the nearest) and roams free
## otherwise; the HUD's bar shows that target. With ?qa=1 the page can place him, switch the camera to inspection
## viewpoints, put the automaton through its reactions, and the HUD shows the developer's notes.

## Within this distance of a target the camera takes its combat framing and the target's bar shows.
const COMBAT_RANGE := 9.0
## The automaton's mark: north-west of the dummy, in view from the start, clear of the runs the tests make.
const AUTOMATON_HOME := Vector3(-3.5, 0.0, -2.5)

var player: Fighter
var input: PlayerInput
var controller: PlayerController
var combat: CombatController
var rig: CameraRig
var touch: TouchControls
var hud: CombatHud
var dummy: TrainingDummy
var automaton: TrainingAutomaton
var vfx: HitVfx
## Foreground columns and the arch fading out of the fight's way (M4.2-A; off until a camera is chosen).
var fader: OcclusionFader
## The device test's screen (?device=1), when it runs.
var device: DevicePanel
var _cam: Camera3D
var _player_numbers := DamageNumbers.new()
## (QA) a press armed for a moment of the automaton's attack: {action, at (s into the attack), sent}.
var _armed := {}
var _t := 0.0
var _view := "game"
var _shown: Node3D ## the target on the HUD's bar
var _last_hit: Node3D
var _last_hit_t := -100.0


func _ready() -> void:
	process_physics_priority = -12 # (QA's armed presses: after the automaton's tick, before the player's controller)
	QA.mark("arena") # (first: marking a screen clears the previous one's rectangles and tracked values)
	_build_world()
	_spawn_player()
	_build_camera()
	_build_combat()
	_build_hud()
	QA.track("player", _player_state)
	QA.track("camera", _camera_state)
	QA.track("controls", touch.layout_info)
	QA.track("combat", combat.state)
	QA.track("dummy", dummy.state)
	QA.track("automaton", automaton.info)
	QA.track("render", Game.render_state)
	QA.track("framing", _framing_state)
	QA.command.connect(_on_qa_command)
	# the graphics preset's shadows on the moon, now and whenever the preset changes (GPT's v1.7)
	FallenMoonCourtyard.apply_quality(Game.preset())
	Game.settings_changed.connect(_on_settings_changed)
	if Game.device_test:
		var layer := CanvasLayer.new()
		layer.layer = 20
		add_child(layer)
		device = DevicePanel.new()
		device.name = "DeviceTest"
		layer.add_child(device)
		touch.reserved_controls.append(device.test_button())
		QA.track("device", device.qa_state)
	if Game.demo or not Game.bench.is_empty():
		# (the recordings; or the device test's benchmark: the integrated review, looped, at each preset in turn)
		var d := DemoDriver.new()
		d.name = "DemoDriver"
		d.touch = touch
		d.player = player
		d.rig = rig
		d.automaton = automaton
		d.combat = combat
		d.caption = hud.prompt
		if not Game.bench.is_empty():
			d.use("m4", true)
		add_child(d)
	Game.arena_ready()


func _on_settings_changed() -> void:
	FallenMoonCourtyard.apply_quality(Game.preset())


func _physics_process(_delta: float) -> void:
	# (QA) an armed press goes into the input buffer at its moment of the automaton's attack — the same path a key takes
	if _armed.is_empty():
		return
	if bool(_armed.get("sent", false)):
		input.release(String(_armed["action"]))
		_armed = {}
		return
	if automaton.attack_time() >= float(_armed["at"]):
		input.press(String(_armed["action"]))
		_armed["sent"] = true
		QA.flag("armed_press", "%s:%.3f" % [_armed["action"], automaton.attack_time()])


func _process(delta: float) -> void:
	_t += delta
	_player_numbers.advance(delta)
	if _view != "game":
		_place_camera()
	# (the camera's framing keeps the fighters clear of the HUD: its areas, from the controls' layout — M4.2-A)
	rig.screen = get_viewport().get_visible_rect().size
	rig.exclusions = touch.exclusion_rects()
	# (a target keeps the framing while it is down: it stands up again)
	var focus := _focus_target()
	rig.focus = focus
	rig.mode = CameraRig.Mode.COMBAT if focus else CameraRig.Mode.EXPLORATION
	hud.set_near(focus != null)
	if focus and focus != _shown:
		_show_target(focus)
	_update_buttons()
	for i in FallenMoonCourtyard.flames.size():
		var f := FallenMoonCourtyard.flames[i]
		f.light_energy = 1.25 + 0.18 * sin(_t * 7.3 + i * 1.7) + 0.1 * sin(_t * 13.1 + i * 2.9)


func _build_world() -> void:
	FallenMoonCourtyard.build(self)
	dummy = TrainingDummy.create()
	add_child(dummy)
	automaton = TrainingAutomaton.create()
	automaton.position = AUTOMATON_HOME
	automaton.facing = atan2(-AUTOMATON_HOME.x, 7.0 - AUTOMATON_HOME.z) # toward where the Samurai starts
	add_child(automaton)


func _spawn_player() -> void:
	player = Fighter.new()
	player.name = "Samurai"
	player.setup(CharacterVisual.create())
	player.facing = PI # looking north, at the target, the arch and the moon
	add_child(player)
	player.global_position = Vector3(0, 0, 7)
	automaton.watch = player
	input = PlayerInput.new()
	input.name = "PlayerInput"
	add_child(input)
	controller = PlayerController.new()
	controller.name = "PlayerController"
	controller.fighter = player
	controller.input = input
	add_child(controller)
	player.state_changed.connect(func(st: String) -> void: QA.flag("player_state", st))


func _build_camera() -> void:
	rig = CameraRig.new()
	rig.name = "CameraRig"
	rig.target = player
	add_child(rig)
	rig.snap_behind(player.facing)
	# (the framing it starts in — combat when a target is within range — at once: the first frame drawn is the game view)
	rig.focus = _focus_target()
	rig.mode = CameraRig.Mode.COMBAT if rig.focus else CameraRig.Mode.EXPLORATION
	rig.settle()
	_cam = rig.cam
	controller.rig = rig
	fader = OcclusionFader.new()
	fader.name = "OcclusionFader"
	fader.rig = rig
	add_child(fader)
	for g: Array in FallenMoonCourtyard.occluders:
		fader.add_group(g)


func _build_combat() -> void:
	combat = CombatController.new()
	combat.name = "Combat"
	combat.fighter = player
	combat.rig = rig
	add_child(combat)
	var trail := BladeTrail.new()
	trail.name = "BladeTrail"
	trail.blade = player.visual.katana
	add_child(trail)
	combat.trail = trail
	controller.combat = combat
	var sfx := CombatSfx.new()
	sfx.name = "CombatSfx"
	add_child(sfx)
	sfx.bind(combat)
	vfx = HitVfx.new()
	vfx.name = "HitVfx"
	add_child(vfx)
	vfx.bind(combat)
	automaton.impacted.connect(func(at: Vector3) -> void:
		vfx.impact(at)
		rig.shake(0.3))
	automaton.foe = combat # (its sweep is resolved against him)
	sfx.bind_attacker(automaton)
	var shadow := ShadowStepVisual.new()
	shadow.name = "ShadowStep"
	shadow.combat = combat
	shadow.fighter = player
	add_child(shadow)
	combat.blow_taken.connect(func(a: AttackData, _by: Node3D, _dir: Vector3) -> void:
		_player_numbers.spawn(player, a.damage, 2.1, UiTheme.CRIMSON))
	var chain := PhantomChainVisual.new()
	chain.name = "PhantomChain"
	chain.combat = combat
	chain.fighter = player
	add_child(chain)
	var seal := SealVisual.new()
	seal.name = "ExplosiveSeal"
	seal.combat = combat
	seal.fighter = player
	add_child(seal)
	var execution := ExecutionVisual.new()
	execution.name = "PhantomExecution"
	execution.combat = combat
	execution.fighter = player
	execution.rig = rig
	add_child(execution)


## (QA) an inspection viewpoint; the rig holds the camera in the game view.
func _place_camera() -> void:
	if player == null or _cam == null:
		return
	var p := player.global_position
	var fwd := player.forward()
	var right := fwd.cross(Vector3.UP).normalized()
	match _view:
		"front":
			_look(p + fwd * 2.6 + Vector3(0, 1.35, 0), p + Vector3(0, 1.0, 0), 45.0)
		"side":
			_look(p - right * 2.4 + Vector3(0, 1.2, 0), p + Vector3(0, 1.0, 0), 45.0)
		"hand":
			var h := _hand_position()
			_look(h - right * 0.9 + fwd * 0.5 + Vector3(0, 0.15, 0), h + Vector3(0, -0.05, 0), 40.0)
		"feet":
			_look(p - right * 1.8 + fwd * 0.6 + Vector3(0, 0.25, 0), p + Vector3(0, 0.15, 0), 40.0)
		"vista":
			# a low view of the courtyard toward the arch and the moon (the establishing shot)
			_look(Vector3(1.5, 1.6, 11.5), Vector3(0, 4.2, -14.0), 55.0)
		"auto_front", "auto_side", "auto_back", "auto_face":
			# the automaton (following it up in the air and down on the floor)
			var a := automaton.global_position
			var af := automaton.forward()
			var ar := af.cross(Vector3.UP).normalized()
			match _view:
				"auto_front":
					_look(a + af * 2.8 + Vector3(0, 1.4, 0), a + Vector3(0, 0.95, 0), 45.0)
				"auto_side":
					_look(a - ar * 2.7 + Vector3(0, 1.3, 0), a + Vector3(0, 0.95, 0), 45.0)
				"auto_back":
					_look(a - af * 2.8 + Vector3(0, 1.5, 0), a + Vector3(0, 0.95, 0), 45.0)
				"auto_face":
					# (at its head as the pose holds it: its guard stance crouches)
					var head := a + Vector3(0, 1.62, 0)
					var sk := automaton.visual.skeleton
					if sk and sk.find_bone("Head") >= 0:
						head = (sk.global_transform * sk.get_bone_global_pose(sk.find_bone("Head"))).origin + Vector3(0, 0.08, 0)
					_look(head + af * 0.8 + ar * 0.22 + Vector3(0, 0.05, 0), head, 40.0)


func _look(from: Vector3, at: Vector3, fov: float) -> void:
	_cam.global_position = from
	_cam.look_at(at, Vector3.UP)
	_cam.fov = fov


func _hand_position() -> Vector3:
	var v := player.visual
	if v.skeleton:
		var i := v.skeleton.find_bone("hand_r")
		if i >= 0:
			return (v.skeleton.global_transform * v.skeleton.get_bone_global_pose(i)).origin
	return player.global_position + Vector3(0, 1.0, 0)


func _on_qa_command(cmd: String, args: Array) -> void:
	if cmd == "place" and args.size() >= 3:
		# (tests) stand the Samurai at (x, z) facing `facing` degrees, the camera behind him
		player.global_position = Vector3(float(args[0]), 0.0, float(args[1]))
		player.velocity = Vector3.ZERO
		player.facing = deg_to_rad(float(args[2]))
		rig.snap_behind(player.facing)
		QA.flag("placed", "%s,%s,%s" % [args[0], args[1], args[2]])
	elif cmd == "auto" and not args.is_empty():
		# (tests and inspection shots) put the automaton through a reaction directly
		var n := args.size()
		match str(args[0]):
			"launch":
				automaton.launch(2.2, 0.9)
			"capture":
				automaton.capture(float(args[1]) if n > 1 else 0.7)
			"pull":
				if n > 2:
					automaton.pull_to(Vector3(float(args[1]), 0.0, float(args[2])), float(args[3]) if n > 3 else 0.4)
			"hit":
				automaton.take_hit(int(args[1]) if n > 1 else 10, float(args[2]) if n > 2 else 0.08,
					float(args[3]) if n > 3 else 0.0, automaton.global_position - player.global_position)
			"freeze":
				automaton.freeze_for(float(args[1]) if n > 1 else 5.0)
			"thaw":
				automaton.thaw()
			"place":
				if n > 2:
					automaton.place(Vector3(float(args[1]), 0.0, float(args[2])))
				if n > 3:
					automaton.facing = deg_to_rad(float(args[3]))
			"attack":
				automaton.attack()
			"spar":
				automaton.spar = n < 2 or str(args[1]) != "0"
			"heal":
				automaton.heal()
		QA.flag("auto_cmd", str(args[0]))
	elif cmd == "arm" and args.size() >= 2:
		# (tests) press `action` when the automaton's attack has run `at` s (its telegraph: a timed defence)
		_armed = {"action": str(args[0]), "at": float(args[1]), "sent": false}
		QA.flag("armed", "%s:%s" % [args[0], args[1]])
	elif cmd == "speed" and not args.is_empty():
		# (inspection shots) the game's speed, so a slow renderer catches a quick moment
		Engine.time_scale = clampf(float(args[0]), 0.05, 4.0)
		QA.flag("speed", Engine.time_scale)
	elif cmd == "cam" and not args.is_empty():
		_view = str(args[0])
		rig.active = _view == "game"
		if _view != "game":
			_place_camera()
		QA.flag("view", _view)
	elif cmd == "camvar" and not args.is_empty() and CameraRig.VARIANTS.has(str(args[0])):
		# (M4.2-A's comparison) the combat framing A, B or C — the player's default stays A
		CameraRig.variant = str(args[0])
		QA.flag("camvar", CameraRig.variant)
	elif cmd == "fade" and not args.is_empty():
		# (M4.2-A's comparison) the foreground columns' fading on or off, and its opacity
		OcclusionFader.enabled = str(args[0]) != "0"
		if args.size() > 1:
			OcclusionFader.opacity = clampf(float(args[1]), 0.05, 1.0)
		QA.flag("fade", "%s:%s" % [OcclusionFader.enabled, OcclusionFader.opacity])
	elif cmd == "frame":
		# (M4.2-A's comparison: identical shots) the camera behind him toward his foe ("foe") or along his facing
		# ("facing"), settled at once in its framing
		rig.focus = _focus_target()
		rig.mode = CameraRig.Mode.COMBAT if rig.focus else CameraRig.Mode.EXPLORATION
		if (args.is_empty() or str(args[0]) == "foe") and rig.focus:
			var to := rig.focus.global_position - player.global_position
			rig.yaw = atan2(-to.x, -to.z)
		else:
			rig.snap_behind(player.facing)
		rig.settle()
		QA.flag("framed", "%s:%s" % [CameraRig.variant, args[0] if not args.is_empty() else "foe"])
	elif cmd == "devtext" and not args.is_empty():
		# (M4.2-A's comparison) the HUD as a player sees it: no developer's notes, no frame rate
		hud.set_dev_text(str(args[0]) != "off")
		QA.flag("devtext", str(args[0]) != "off")
	elif cmd == "dummy" and not args.is_empty():
		# (M4.2-A's comparison) the straw dummy out of the shot, or back
		dummy.visible = str(args[0]) != "off"
		QA.flag("dummy", dummy.visible)


func _player_state() -> Dictionary:
	var p := player.global_position
	var k := player.visual.katana.global_position if player.visual.katana else Vector3.ZERO
	return {
		"pos": [snappedf(p.x, 0.01), snappedf(p.y, 0.01), snappedf(p.z, 0.01)],
		"on_floor": player.is_on_floor(),
		"state": player.state,
		"speed": snappedf(player.ground_speed(), 0.01),
		"sprinting": player.sprinting,
		"invulnerable": player.invulnerable,
		"facing": snappedf(rad_to_deg(player.facing), 0.1),
		"anim": player.visual.current,
		"feet": snappedf(player.visual.feet_height(), 0.001),
		"katana_to_hand": snappedf(k.distance_to(_hand_position()), 0.001),
		"action_lock": player.action_lock,
		"dodges": player.dodges,
		"view": _view,
	}


## (QA, M4.2-A's comparison) the framing now: the variant, the camera's distance (and whether C is past its preferred
## band), each fighter's box on the screen — its height in CSS px, in a HUD area or off the screen — the HUD's areas,
## the fading and the frame's draw calls.
func _framing_state() -> Dictionary:
	var css := touch.css_per_px
	var areas: Array = []
	for r: Rect2 in rig.exclusions:
		areas.append([snappedf(r.position.x, 0.1), snappedf(r.position.y, 0.1), snappedf(r.size.x, 0.1),
			snappedf(r.size.y, 0.1)])
	return {"variant": CameraRig.variant, "distance": snappedf(rig.distance(), 0.01),
		"camera_to_player": snappedf(_cam.global_position.distance_to(rig.target.global_position), 0.01),
		"fallback": rig.fallback, "fallbacks": rig.fallbacks, "player": rig.screen_box(player, css),
		"foe": rig.screen_box(rig.focus, css), "areas": areas, "screen": [rig.screen.x, rig.screen.y],
		"css_per_px": snappedf(css, 0.001), "fade": fader.info(),
		"draws": RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME)}


func _camera_state() -> Dictionary:
	return {
		"yaw": snappedf(rad_to_deg(rig.yaw), 0.1),
		"elevation": snappedf(rig.elevation(), 0.1),
		"distance": snappedf(rig.distance(), 0.01),
		"mode": CameraRig.Mode.keys()[rig.mode],
	}


func _build_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var root := Control.new()
	root.theme = UiTheme.build()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(root)

	# The touch controls under the buttons of the bar (their touches are left to those buttons).
	touch = TouchControls.new()
	touch.name = "TouchControls"
	touch.input = input
	root.add_child(touch)

	hud = CombatHud.new()
	hud.name = "HUD"
	root.add_child(hud)
	hud.set_player_hp(combat.hp, combat.max_hp) # (GPT's M3 numbers: 200)
	combat.hp_changed.connect(hud.set_player_hp)
	_show_target(dummy)
	dummy.hp_changed.connect(func(hp: int, total: int) -> void: _on_target_hp(dummy, hp, total))
	automaton.hp_changed.connect(func(hp: int, total: int) -> void: _on_target_hp(automaton, hp, total))
	hud.set_note("M4 · stick: move (rim 0.25 s: sprint) · drag: camera · ATTACK ×3 · HEAVY · CHAIN (then PULL) · STEP through its sweep (then COUNTER) · RISE (then PURSUE) · DODGE · JUMP — keys WASD J H 1 2 3 K Space, 4 / 5 the conditional buttons")
	combat.notice.connect(func(text: String) -> void: hud.prompt(text, 1.6))

	var back := Button.new()
	back.text = "MENU"
	back.custom_minimum_size = Vector2(160, 64)
	back.position = Vector2(28, 24)
	back.pressed.connect(func() -> void: Game.go("main_menu"))
	root.add_child(back)
	QA.register("arena_menu", back)
	touch.reserved = [Rect2(Vector2.ZERO, Vector2(220, 110))]


## The target he is fighting: the one he struck in the last 4 s (while it is within the framing's range), else the
## nearest within range; none when he is away from both.
func _focus_target() -> Node3D:
	if _last_hit and _t - _last_hit_t < 4.0 and _flat_dist(_last_hit) < COMBAT_RANGE:
		return _last_hit
	var best: Node3D = null
	var best_d := COMBAT_RANGE
	for t: Node3D in [dummy, automaton]:
		if not t.visible:
			continue # (QA: the dummy put away for a shot)
		var d := _flat_dist(t)
		if d < best_d:
			best = t
			best_d = d
	return best


func _flat_dist(t: Node3D) -> float:
	var d := t.global_position - player.global_position
	return Vector2(d.x, d.z).length()


func _show_target(t: Node3D) -> void:
	_shown = t
	if t == automaton:
		hud.set_target(String(automaton.target_data.get("name", "Training Automaton")), automaton.hp, automaton.max_hp)
	else:
		hud.set_target(String(dummy.target_data.get("name", "Training dummy")), dummy.hp, TrainingDummy.MAX_HP)


func _on_target_hp(t: Node3D, hp: int, total: int) -> void:
	if t != _shown:
		_show_target(t)
	hud.on_target_hp(hp, total)
	if hp < total:
		_last_hit = t
		_last_hit_t = _t


## The buttons' state from the combat (they only draw what they are told): what each conditional button holds and how
## much of its window is left, how many wait beyond them, and each skill's cooldown.
func _update_buttons() -> void:
	var cs := combat.conditionals()
	var slots: Array = cs["slots"]
	for i in slots.size():
		var o: Dictionary = slots[i]
		var a: AttackData = AttackData.get_attack(String(o.get("ability", ""))) if not o.is_empty() else null
		touch.set_conditional("cond%d" % (i + 1), a.label if a else "", not o.is_empty(),
			float(o.get("left", 0.0)) / maxf(float(o.get("window", 1.0)), 0.001),
			"%s:%d" % [String(o.get("ability", "")), int(o.get("target", 0))])
	touch.set_waiting(int(cs["waiting"]))
	for key: String in ["heavy", "skill1", "skill2", "skill3"]:
		var s := AttackData.for_button(key)
		if s and s.cooldown > 0.0:
			touch.set_cooldown(key, combat.melee.cooldown_left(s.id), s.cooldown)
