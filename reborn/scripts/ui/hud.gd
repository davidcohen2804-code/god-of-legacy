class_name Hud
extends CanvasLayer
## The arena's interface: the player's health, the touch controls, the pause button and window (resume, restart,
## main menu), and the fps counter when asked for. It shows the game; it decides nothing.

signal restart_requested

var touch: TouchControls
var root: Control
var _hp_fill: ColorRect
var _hp_back: ColorRect
var _hp_text: Label
var _fps: Label
var _pause: Control
var _pause_btn: Button


func setup(input: PlayerInput, title: String) -> void:
	layer = 5
	process_mode = Node.PROCESS_MODE_ALWAYS
	root = Control.new()
	root.theme = UiTheme.build()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	touch = TouchControls.new()
	touch.input = input
	root.add_child(touch)

	_pause_btn = Button.new()
	_pause_btn.text = "II"
	_pause_btn.custom_minimum_size = Vector2(76, 68)
	_pause_btn.position = Vector2(26, 22)
	_pause_btn.pressed.connect(open_pause)
	root.add_child(_pause_btn)
	touch.reserved.append(Rect2(Vector2(10, 10), Vector2(110, 100)))
	QA.register("pause", _pause_btn)

	var name_label := UiTheme.label(title.to_upper(), 22, UiTheme.GOLD, true)
	name_label.position = Vector2(124, 20)
	root.add_child(name_label)
	_hp_back = ColorRect.new()
	_hp_back.color = Color(0, 0, 0, 0.55)
	_hp_back.position = Vector2(124, 54)
	_hp_back.size = Vector2(340, 18)
	root.add_child(_hp_back)
	_hp_fill = ColorRect.new()
	_hp_fill.color = Color("#d9465a")
	_hp_fill.position = Vector2(126, 56)
	_hp_fill.size = Vector2(336, 14)
	root.add_child(_hp_fill)
	_hp_text = UiTheme.label("", 15, Color(1, 1, 1, 0.85), true)
	_hp_text.position = Vector2(470, 50)
	root.add_child(_hp_text)

	_fps = UiTheme.label("", 20, UiTheme.GOLD, true)
	_fps.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	_fps.offset_left = -170
	_fps.offset_right = -30
	_fps.offset_top = 22
	_fps.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	root.add_child(_fps)
	_build_pause()


func set_health(hp: float, max_hp: float) -> void:
	var k := clampf(hp / maxf(max_hp, 1.0), 0.0, 1.0)
	_hp_fill.size.x = 336.0 * k
	_hp_text.text = "%d" % ceili(hp)


func _process(_delta: float) -> void:
	_fps.visible = Game.show_fps or QA.enabled
	if _fps.visible:
		_fps.text = "%d FPS" % Engine.get_frames_per_second()


func _build_pause() -> void:
	_pause = Control.new()
	_pause.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_pause.visible = false
	root.add_child(_pause)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.6)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_pause.add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_pause.add_child(center)
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", UiTheme.box(UiTheme.PANEL, UiTheme.GOLD_DIM, 20, 2, 44.0, 30.0))
	center.add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 18)
	panel.add_child(col)
	col.add_child(UiTheme.title("PAUSED", 44, 3))
	for item in [["RESUME", close_pause, "pause_resume"], ["RESTART", _on_restart, "pause_restart"],
			["MAIN MENU", _on_menu, "pause_menu"]]:
		var b := Button.new()
		b.text = item[0]
		b.custom_minimum_size = Vector2(340, 78)
		b.pressed.connect(item[1])
		col.add_child(b)
		QA.register(item[2], b)


func open_pause() -> void:
	_pause.visible = true
	touch.visible = false
	get_tree().paused = true
	QA.flag("paused", true)


func close_pause() -> void:
	_pause.visible = false
	touch.visible = true
	get_tree().paused = false
	QA.flag("paused", false)


func _on_restart() -> void:
	close_pause()
	restart_requested.emit()


func _on_menu() -> void:
	close_pause()
	Game.go("main_menu")


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		if _pause.visible:
			close_pause()
		else:
			open_pause()
		get_viewport().set_input_as_handled()
