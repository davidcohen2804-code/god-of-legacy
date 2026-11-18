extends Node3D
## Arena — M3: the first playable sword combat. The Samurai in the Fallen Moon Courtyard with the training dummy in
## its middle: walk, run, sprint, jump and dodge relative to the camera, and the three-strike katana chain (Basic
## Attack) against the dummy — from the touch controls (several fingers at once), the keyboard or a gamepad. The
## camera frames both when he is near the dummy (combat framing) and roams free otherwise. With ?qa=1 the page can
## place him and switch the camera to inspection viewpoints, and the HUD shows the developer's notes.

## Within this distance of the target the camera takes its combat framing and the target's bar shows.
const COMBAT_RANGE := 9.0

var player: Fighter
var input: PlayerInput
var controller: PlayerController
var combat: CombatController
var rig: CameraRig
var touch: TouchControls
var hud: CombatHud
var dummy: TrainingDummy
var _cam: Camera3D
var _t := 0.0
var _view := "game"


func _ready() -> void:
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
	QA.command.connect(_on_qa_command)
	if Game.demo:
		var d := DemoDriver.new()
		d.name = "DemoDriver"
		d.touch = touch
		d.player = player
		d.rig = rig
		d.caption = hud.prompt
		add_child(d)


func _process(delta: float) -> void:
	_t += delta
	if _view != "game":
		_place_camera()
	# (the training dummy keeps the framing while it is down: it stands up again)
	var near := player.global_position.distance_to(dummy.global_position) < COMBAT_RANGE
	rig.focus = dummy if near else null
	rig.mode = CameraRig.Mode.COMBAT if near else CameraRig.Mode.EXPLORATION
	hud.set_near(near)
	for i in FallenMoonCourtyard.flames.size():
		var f := FallenMoonCourtyard.flames[i]
		f.light_energy = 1.25 + 0.18 * sin(_t * 7.3 + i * 1.7) + 0.1 * sin(_t * 13.1 + i * 2.9)


func _build_world() -> void:
	FallenMoonCourtyard.build(self)
	dummy = TrainingDummy.create()
	add_child(dummy)


func _spawn_player() -> void:
	player = Fighter.new()
	player.name = "Samurai"
	player.setup(CharacterVisual.create())
	player.facing = PI # looking north, at the target, the arch and the moon
	add_child(player)
	player.global_position = Vector3(0, 0, 7)
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
		"action_lock": player.action_lock,
		"dodges": player.dodges,
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
	hud.set_player_hp(200, 200) # (GPT's M3 numbers; nothing hits the Samurai before M5)
	hud.set_target("Training dummy", dummy.hp, TrainingDummy.MAX_HP)
	dummy.hp_changed.connect(hud.on_target_hp)
	hud.set_note("M3 · stick: move (rim 0.25 s: sprint) · drag: camera · ATTACK ×3 · DODGE · JUMP — keys WASD J K Space")

	var back := Button.new()
	back.text = "MENU"
	back.custom_minimum_size = Vector2(160, 64)
	back.position = Vector2(28, 24)
	back.pressed.connect(func() -> void: Game.go("main_menu"))
	root.add_child(back)
	QA.register("arena_menu", back)
	touch.reserved = [Rect2(Vector2.ZERO, Vector2(220, 110))]
