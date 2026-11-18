class_name SettingsPanel
extends Control
## The settings window (graphics quality, camera sensitivity, fps counter), saved by Game.

signal closed

var _sens_value: Label


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	visible = false

	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.62)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(dim)

	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(680, 0)
	panel.add_theme_stylebox_override("panel", UiTheme.box(UiTheme.PANEL, UiTheme.GOLD_DIM, 20, 2, 40.0, 32.0))
	center.add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 22)
	panel.add_child(col)
	col.add_child(UiTheme.title("SETTINGS", 44, 3))

	var quality := OptionButton.new()
	for i in Game.QUALITY_NAMES.size():
		quality.add_item(Game.QUALITY_NAMES[i], i)
	quality.selected = Game.quality
	quality.custom_minimum_size = Vector2(240, 64)
	quality.item_selected.connect(func(i: int) -> void: Game.set_setting("quality", i))
	col.add_child(_row("Graphics quality", quality))
	QA.register("settings_quality", quality)

	var sens := HSlider.new()
	sens.min_value = 0.3
	sens.max_value = 3.0
	sens.step = 0.1
	sens.value = Game.camera_sensitivity
	sens.custom_minimum_size = Vector2(260, 48)
	sens.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_sens_value = UiTheme.label("%.1f×" % Game.camera_sensitivity, 24, UiTheme.GOLD, true)
	_sens_value.custom_minimum_size = Vector2(70, 0)
	sens.value_changed.connect(_on_sensitivity)
	var sens_box := HBoxContainer.new()
	sens_box.add_theme_constant_override("separation", 16)
	sens_box.add_child(sens)
	sens_box.add_child(_sens_value)
	col.add_child(_row("Camera sensitivity", sens_box))

	var fps := CheckButton.new()
	fps.button_pressed = Game.show_fps
	fps.toggled.connect(func(on: bool) -> void: Game.set_setting("show_fps", on))
	col.add_child(_row("Show FPS", fps))

	var close := Button.new()
	close.text = "CLOSE"
	close.custom_minimum_size = Vector2(260, 80)
	close.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	close.pressed.connect(close_panel)
	col.add_child(close)
	QA.register("settings_close", close)


func open() -> void:
	visible = true
	QA.flag("settings_open", true)


func close_panel() -> void:
	visible = false
	QA.flag("settings_open", false)
	closed.emit()


func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("ui_cancel"):
		close_panel()
		get_viewport().set_input_as_handled()


func _on_sensitivity(v: float) -> void:
	Game.set_setting("camera_sensitivity", v)
	_sens_value.text = "%.1f×" % v


func _row(text: String, control: Control) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 24)
	var l := UiTheme.label(text, 26, UiTheme.TEXT_DIM)
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(l)
	row.add_child(control)
	return row
