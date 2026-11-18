extends Control
## Main menu: the GOD OF LEGACY logo, Play and Settings (touch, mouse, keyboard or gamepad).

var _settings: SettingsPanel


func _ready() -> void:
	theme = UiTheme.build()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(Backdrop.new())

	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var col := VBoxContainer.new()
	col.alignment = BoxContainer.ALIGNMENT_CENTER
	col.add_theme_constant_override("separation", 10)
	center.add_child(col)

	col.add_child(UiTheme.title("GOD OF LEGACY", 100, 5))
	var sub := UiTheme.title("REBORN", 30, 18)
	sub.add_theme_color_override("font_color", UiTheme.ACCENT)
	col.add_child(sub)

	var gap := Control.new()
	gap.custom_minimum_size = Vector2(0, 46)
	col.add_child(gap)

	var buttons := VBoxContainer.new()
	buttons.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	buttons.add_theme_constant_override("separation", 22)
	col.add_child(buttons)
	var play := _button("PLAY", _on_play)
	buttons.add_child(play)
	var settings := _button("SETTINGS", _on_settings)
	buttons.add_child(settings)
	QA.register("play", play)
	QA.register("settings", settings)

	var ver := UiTheme.label("Vertical slice · M1", 20, UiTheme.TEXT_DIM)
	ver.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	ver.offset_left = -330
	ver.offset_top = -56
	ver.offset_right = -36
	ver.offset_bottom = -24
	ver.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	add_child(ver)

	play.grab_focus()
	QA.mark("main_menu")


## A wide panel button with a small gold diamond at each end (bright while focused or hovered).
func _button(text: String, cb: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(460, 86)
	b.pressed.connect(cb)
	b.draw.connect(func() -> void:
		var mode := b.get_draw_mode()
		var col := UiTheme.GOLD if b.has_focus() or mode == BaseButton.DRAW_HOVER else UiTheme.GOLD_DIM
		if mode == BaseButton.DRAW_PRESSED or mode == BaseButton.DRAW_HOVER_PRESSED:
			col = UiTheme.INK
		var y := b.size.y * 0.5
		for x: float in [26.0, b.size.x - 26.0]:
			b.draw_colored_polygon(PackedVector2Array([
				Vector2(x, y - 7), Vector2(x + 7, y), Vector2(x, y + 7), Vector2(x - 7, y)]), col))
	return b


func _on_play() -> void:
	Game.go("character_select")


func _on_settings() -> void:
	if _settings == null:
		_settings = SettingsPanel.new()
		add_child(_settings)
	_settings.open()
