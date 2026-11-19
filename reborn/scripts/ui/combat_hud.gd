class_name CombatHud
extends Control
## The arena's heads-up display (M3, GPT: room for the player's health, the target's health, cooldowns and prompts;
## the developer's notes off the gameplay screen):
##   - the player's health, top left beside MENU;
##   - the current target's name and health, top centre — shown while the player is near it and for a few seconds
##     after a blow; a pale chip shows the damage just taken, then drains;
##   - one line for short contextual prompts under it;
##   - only with ?qa=1 (the developer's view): a line of notes and the frame rate (also with Settings ▸ Show FPS).
## The skills' cooldowns will sit on their own buttons (M4). It shows what it is told; it decides nothing.

const BAR_W := 360.0
const BAR_H := 22.0
const PLAYER_W := 240.0
const TARGET_LINGER := 4.0 ## s the target's bar stays after the last blow when the player walks away

var _player_fill: ColorRect
var _player_text: Label
var _target_box: Control
var _target_name: Label
var _target_fill: ColorRect
var _target_chip: ColorRect
var _target_text: Label
var _prompt: Label
var _note: Label
var _fps: Label
var _hp := 0
var _max := 1
var _chip := 0.0
var _chip_wait := 0.0
var _near := false
var _linger := 0.0
var _prompt_t := 0.0


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_build_player()
	_build_target()
	_prompt = UiTheme.label("", 22, UiTheme.TEXT, true)
	_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt.add_theme_color_override("font_outline_color", Color(0.07, 0.05, 0.1, 0.9))
	_prompt.add_theme_constant_override("outline_size", 6)
	_prompt.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	_prompt.offset_left = -460
	_prompt.offset_right = 460
	_prompt.offset_top = 70
	_prompt.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_prompt.modulate.a = 0.0
	add_child(_prompt)
	_note = UiTheme.label("", 16, UiTheme.TEXT_DIM)
	_note.position = Vector2(212, 62)
	_note.visible = QA.enabled
	add_child(_note)
	_fps = UiTheme.label("", 22, UiTheme.GOLD, true)
	_fps.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	_fps.offset_left = -180
	_fps.offset_top = 40
	_fps.offset_right = -32
	_fps.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_fps.visible = (Game.show_fps or QA.enabled) and not Game.device_test # (the device test shows its own)
	add_child(_fps)


func set_player_hp(value: int, total: int) -> void:
	_player_fill.size.x = (PLAYER_W - 8.0) * clampf(float(value) / float(maxi(total, 1)), 0.0, 1.0)
	_player_text.text = "%d / %d" % [value, total]


func set_target(display_name: String, hp: int, total: int) -> void:
	_target_name.text = display_name.to_upper()
	_hp = hp
	_max = maxi(total, 1)
	_chip = float(hp)
	_refresh_target()


## The target's health changed: a loss leaves a chip that drains after a moment; a refill shows at once.
func on_target_hp(hp: int, total: int) -> void:
	_max = maxi(total, 1)
	if hp < _hp:
		_chip_wait = 0.35
		_linger = TARGET_LINGER
	else:
		_chip = float(hp)
	_hp = hp
	_refresh_target()


## Whether the player is close enough to the target for its bar to show.
func set_near(near: bool) -> void:
	_near = near


func prompt(text: String, seconds: float = 2.5) -> void:
	_prompt.text = text
	_prompt_t = seconds


func set_note(text: String) -> void:
	_note.text = text


func _process(delta: float) -> void:
	if _chip_wait > 0.0:
		_chip_wait -= delta
	elif _chip > _hp:
		_chip = move_toward(_chip, _hp, maxf(60.0, (_chip - _hp) * 4.0) * delta)
		_refresh_target()
	_linger = maxf(0.0, _linger - delta)
	var show := _near or _linger > 0.0
	_target_box.modulate.a = move_toward(_target_box.modulate.a, 1.0 if show else 0.0, delta * 4.0)
	_prompt_t -= delta
	_prompt.modulate.a = move_toward(_prompt.modulate.a, 1.0 if _prompt_t > 0.0 else 0.0, delta * 5.0)
	if _fps.visible:
		_fps.text = "%d FPS" % Engine.get_frames_per_second()


func _refresh_target() -> void:
	var w := BAR_W - 8.0
	_target_fill.size.x = w * clampf(float(_hp) / float(_max), 0.0, 1.0)
	_target_chip.size.x = w * clampf(_chip / float(_max), 0.0, 1.0)
	_target_text.text = "%d / %d" % [_hp, _max]


func _build_player() -> void:
	var box := Control.new()
	box.position = Vector2(212, 30)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(box)
	box.add_child(_back(PLAYER_W))
	_player_fill = _fill(UiTheme.CRIMSON, PLAYER_W)
	box.add_child(_player_fill)
	_player_text = _bar_text(PLAYER_W)
	box.add_child(_player_text)


func _build_target() -> void:
	_target_box = Control.new()
	_target_box.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	_target_box.offset_left = -BAR_W * 0.5
	_target_box.offset_right = BAR_W * 0.5
	_target_box.offset_top = 10
	_target_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_target_box.modulate.a = 0.0
	add_child(_target_box)
	_target_name = UiTheme.label("", 15, UiTheme.TEXT_DIM, true)
	_target_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_target_name.size = Vector2(BAR_W, 20)
	_target_box.add_child(_target_name)
	var bar := Control.new()
	bar.position = Vector2(0, 24)
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_target_box.add_child(bar)
	bar.add_child(_back(BAR_W))
	_target_chip = _fill(Color(UiTheme.TEXT, 0.75), BAR_W)
	bar.add_child(_target_chip)
	_target_fill = _fill(UiTheme.ACCENT, BAR_W)
	bar.add_child(_target_fill)
	_target_text = _bar_text(BAR_W)
	bar.add_child(_target_text)


func _back(w: float) -> Panel:
	var p := Panel.new()
	p.add_theme_stylebox_override("panel", UiTheme.box(Color(0.07, 0.06, 0.11, 0.8), UiTheme.GOLD_DIM, 6, 2, 0.0, 0.0))
	p.size = Vector2(w, BAR_H)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return p


func _fill(c: Color, w: float) -> ColorRect:
	var r := ColorRect.new()
	r.color = c
	r.position = Vector2(4, 4)
	r.size = Vector2(w - 8.0, BAR_H - 8.0)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r


func _bar_text(w: float) -> Label:
	var l := UiTheme.label("", 14, UiTheme.TEXT, true)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.size = Vector2(w, BAR_H)
	l.add_theme_color_override("font_outline_color", Color(0.07, 0.05, 0.1, 0.9))
	l.add_theme_constant_override("outline_size", 4)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l
