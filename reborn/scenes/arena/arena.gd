extends Node3D
## Arena — M2, step 3 of 5 (GPT's M2 order): the real Samurai in a minimal arena under twilight moonlight — walk,
## run, sprint, jump and dodge relative to the camera, from the touch controls (several fingers at once), the
## keyboard or a gamepad. The Fallen Moon Courtyard and the camera's framing pass come in step 4. With ?qa=1 the page
## can switch the camera to inspection viewpoints.

var player: Fighter
var input: PlayerInput
var controller: PlayerController
var rig: CameraRig
var touch: TouchControls
var _cam: Camera3D
var _fps: Label
var _view := "game"


func _ready() -> void:
	QA.mark("arena") # (first: marking a screen clears the previous one's rectangles and tracked values)
	_build_world()
	_spawn_player()
	_build_camera()
	_build_hud()
	QA.track("player", _player_state)
	QA.track("camera", _camera_state)
	QA.track("controls", touch.layout_info)
	QA.command.connect(_on_qa_command)


func _process(_delta: float) -> void:
	if _view != "game":
		_place_camera()
	if _fps.visible:
		_fps.text = "%d FPS" % Engine.get_frames_per_second()


func _build_world() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var mat := ProceduralSkyMaterial.new()
	mat.sky_top_color = Color("#151233")
	mat.sky_horizon_color = Color("#4a3d72")
	mat.sky_curve = 0.12
	mat.ground_horizon_color = Color("#2b2440")
	mat.ground_bottom_color = Color("#0d0b16")
	mat.sun_angle_max = 2.6
	mat.sun_curve = 0.08
	sky.sky_material = mat
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#4d5174")
	env.ambient_light_energy = 0.5
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.05
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	# The moon: the one shadow-casting light, cool blue-violet, low in the sky.
	var moon := DirectionalLight3D.new()
	moon.name = "Moon"
	moon.rotation_degrees = Vector3(-34, 152, 0)
	moon.light_color = Color("#bcc0ec")
	moon.light_energy = 1.15
	moon.shadow_enabled = true
	moon.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	moon.directional_shadow_max_distance = 32.0
	add_child(moon)

	# A warm accent from one side, so the armour's gold and the blade read (the braziers take this role in M2.4).
	var warm := OmniLight3D.new()
	warm.position = Vector3(-3.2, 2.2, 1.6)
	warm.light_color = Color("#ff9a52")
	warm.light_energy = 0.9
	warm.omni_range = 7.0
	add_child(warm)

	# The floor: 28 × 28 m of worn flagstones (the courtyard's size; its ruins come in M2.4).
	var floor_body := StaticBody3D.new()
	floor_body.collision_layer = 1
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(28, 1, 28)
	shape.shape = box
	shape.position = Vector3(0, -0.5, 0)
	floor_body.add_child(shape)
	var ground := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(28, 28)
	ground.mesh = plane
	ground.material_override = TexLoader.material("res://assets/env/flagstones.webp.bin", Vector2(7, 7),
		Color(0.7, 0.7, 0.74), 0.92)
	floor_body.add_child(ground)
	add_child(floor_body)
	# The courtyard's edge: invisible walls until its ruins are built (M2.4).
	for side: Vector3 in [Vector3(14.5, 1.5, 0), Vector3(-14.5, 1.5, 0), Vector3(0, 1.5, 14.5), Vector3(0, 1.5, -14.5)]:
		var wall := CollisionShape3D.new()
		var wb := BoxShape3D.new()
		wb.size = Vector3(1, 3, 30) if absf(side.x) > 0.0 else Vector3(30, 3, 1)
		wall.shape = wb
		wall.position = side
		floor_body.add_child(wall)


func _spawn_player() -> void:
	player = Fighter.new()
	player.name = "Samurai"
	player.setup(CharacterVisual.create())
	player.facing = PI # facing away from the camera, into the courtyard
	add_child(player)
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
	_cam = rig.cam
	controller.rig = rig


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
	elif cmd == "cam" and not args.is_empty():
		_view = str(args[0])
		rig.active = _view == "game"
		if _view != "game":
			_place_camera()
		QA.flag("view", _view)


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
		"view": _view,
	}


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
	var hud := Control.new()
	hud.theme = UiTheme.build()
	hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(hud)

	# The touch controls under the buttons of the bar (their touches are left to those buttons).
	touch = TouchControls.new()
	touch.name = "TouchControls"
	touch.input = input
	hud.add_child(touch)

	var back := Button.new()
	back.text = "MENU"
	back.custom_minimum_size = Vector2(160, 64)
	back.position = Vector2(28, 24)
	back.pressed.connect(func() -> void: Game.go("main_menu"))
	hud.add_child(back)
	QA.register("arena_menu", back)
	touch.reserved = [Rect2(Vector2.ZERO, Vector2(220, 110))]

	var hp := _hp_bar(200, 200)
	hp.position = Vector2(212, 30)
	hud.add_child(hp)

	var note := UiTheme.label("M2 · step 3 of 5 — stick: move (rim 0.25 s: sprint) · drag: camera · JUMP · DODGE", 18,
		UiTheme.TEXT_DIM)
	note.position = Vector2(212, 66)
	hud.add_child(note)

	_fps = UiTheme.label("", 22, UiTheme.GOLD, true)
	_fps.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	_fps.offset_left = -180
	_fps.offset_top = 40
	_fps.offset_right = -32
	_fps.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_fps.visible = Game.show_fps or QA.enabled
	hud.add_child(_fps)


## The Samurai's health (200, GPT's M3 numbers); damage arrives with M3.
func _hp_bar(value: int, total: int) -> Control:
	var box := Control.new()
	box.custom_minimum_size = Vector2(300, 30)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var back := Panel.new()
	back.add_theme_stylebox_override("panel", UiTheme.box(Color(0.07, 0.06, 0.11, 0.8), UiTheme.GOLD_DIM, 6, 2, 0.0, 0.0))
	back.size = Vector2(300, 22)
	box.add_child(back)
	var fill := ColorRect.new()
	fill.color = UiTheme.CRIMSON
	fill.position = Vector2(4, 4)
	fill.size = Vector2(292.0 * float(value) / float(total), 14)
	box.add_child(fill)
	var t := UiTheme.label("%d / %d" % [value, total], 16, UiTheme.TEXT, true)
	t.position = Vector2(310, -1)
	box.add_child(t)
	return box
