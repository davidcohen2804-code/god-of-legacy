extends Control
## Character selection: five slots from the roster (Samurai playable, the other four locked with a lock indicator).
## A locked slot can be looked at but never chosen; Game.choose_character() refuses it as well.

const ICONS := {
	"katana": "res://assets/ui/katana.svg",
	"sword": "res://assets/ui/sword.svg",
	"bow": "res://assets/ui/bow.svg",
	"staff": "res://assets/ui/staff.svg",
	"cards": "res://assets/ui/cards.svg",
}

var _cards := {}
var _contents := {}
var _selected := ""
var _name_label: Label
var _title_label: Label
var _summary_label: Label
var _tags_label: Label
var _enter: Button
var _toast: PanelContainer
var _toast_label: Label
var _toast_tween: Tween


func _ready() -> void:
	theme = UiTheme.build()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(Backdrop.new())

	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 44)
	margin.add_theme_constant_override("margin_right", 44)
	margin.add_theme_constant_override("margin_top", 26)
	margin.add_theme_constant_override("margin_bottom", 26)
	add_child(margin)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 20)
	margin.add_child(col)

	col.add_child(UiTheme.title("CHOOSE YOUR LEGACY", 46, 3))

	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 18)
	col.add_child(row)
	for c in Game.roster.characters:
		var card := _make_card(c)
		row.add_child(card)
		_cards[c.id] = card
		QA.register("slot_" + c.id, card)

	col.add_child(_make_details())
	_make_toast()

	var first := Game.selected_character if Game.roster.can_play(Game.selected_character) else "samurai"
	_select(first)
	(_cards[first] as Button).grab_focus()
	QA.mark("character_select")


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		Game.go("main_menu")
		get_viewport().set_input_as_handled()


func _make_card(c: Roster.Character) -> Button:
	var b := Button.new()
	b.custom_minimum_size = Vector2(200, 272)
	b.focus_mode = Control.FOCUS_ALL
	b.pressed.connect(_on_card.bind(c.id))

	var content := VBoxContainer.new()
	content.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	content.offset_left = 14
	content.offset_right = -14
	content.offset_top = 18
	content.offset_bottom = -18
	content.alignment = BoxContainer.ALIGNMENT_CENTER
	content.add_theme_constant_override("separation", 10)
	b.add_child(content)
	_contents[c.id] = content

	var icon := TextureRect.new()
	icon.texture = load(ICONS.get(c.weapon, ICONS["katana"]))
	icon.custom_minimum_size = Vector2(0, 112)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.modulate = c.accent if not c.locked else Color(0.55, 0.58, 0.66)
	content.add_child(icon)

	var n := Label.new()
	n.text = c.name.to_upper()
	n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	n.add_theme_font_override("font", UiTheme.display_font(2))
	n.add_theme_font_size_override("font_size", 28)
	n.add_theme_color_override("font_color", UiTheme.TEXT if not c.locked else UiTheme.TEXT_DIM)
	content.add_child(n)

	var t := UiTheme.label(c.title if not c.locked else "Coming later", 18, UiTheme.TEXT_DIM)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	content.add_child(t)

	if c.locked:
		var veil := ColorRect.new()
		veil.color = Color(0.03, 0.02, 0.06, 0.62)
		veil.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		b.add_child(veil)
		var lock_box := VBoxContainer.new()
		lock_box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		lock_box.alignment = BoxContainer.ALIGNMENT_CENTER
		lock_box.add_theme_constant_override("separation", 8)
		b.add_child(lock_box)
		var lock := TextureRect.new()
		lock.texture = load("res://assets/ui/lock.svg")
		lock.custom_minimum_size = Vector2(0, 64)
		lock.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		lock.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		lock.modulate = UiTheme.GOLD
		lock_box.add_child(lock)
		var lt := UiTheme.label("LOCKED", 20, UiTheme.GOLD, true)
		lt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		lock_box.add_child(lt)
	_ignore_mouse(b)
	_style_card(b, c, false)
	return b


func _ignore_mouse(n: Node) -> void:
	for child in n.get_children():
		if child is Control:
			(child as Control).mouse_filter = Control.MOUSE_FILTER_IGNORE
		_ignore_mouse(child)


func _style_card(b: Button, c: Roster.Character, selected: bool) -> void:
	var border := UiTheme.ACCENT if selected else (UiTheme.GOLD_DIM if not c.locked else Color(1, 1, 1, 0.14))
	var bg := Color(0.16, 0.12, 0.27, 0.96) if selected else Color(0.075, 0.063, 0.12, 0.92)
	var w := 4 if selected else 2
	for state in ["normal", "hover", "pressed", "disabled"]:
		var sb := UiTheme.box(bg, border, 14, w, 0.0, 0.0)
		if selected:
			sb.shadow_color = Color(UiTheme.ACCENT.r, UiTheme.ACCENT.g, UiTheme.ACCENT.b, 0.45)
			sb.shadow_size = 16
		if state == "hover" and not selected:
			sb.border_color = UiTheme.GOLD if not c.locked else Color(1, 1, 1, 0.3)
		b.add_theme_stylebox_override(state, sb)
	b.add_theme_stylebox_override("focus", UiTheme.box(Color(0, 0, 0, 0), Color(1, 1, 1, 0.5), 20, 2, 0.0, 0.0))


func _make_details() -> Control:
	var panel := PanelContainer.new()
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", UiTheme.box(UiTheme.PANEL, UiTheme.GOLD_DIM, 20, 2, 36.0, 24.0))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 32)
	panel.add_child(row)

	var info := VBoxContainer.new()
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	info.add_theme_constant_override("separation", 8)
	row.add_child(info)
	_name_label = UiTheme.title("", 40, 3)
	_name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	info.add_child(_name_label)
	_title_label = UiTheme.label("", 22, UiTheme.ACCENT, true)
	info.add_child(_title_label)
	_summary_label = UiTheme.label("", 22, UiTheme.TEXT)
	_summary_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_summary_label.custom_minimum_size = Vector2(560, 0)
	info.add_child(_summary_label)
	_tags_label = UiTheme.label("", 20, UiTheme.TEXT_DIM)
	info.add_child(_tags_label)

	var actions := VBoxContainer.new()
	actions.alignment = BoxContainer.ALIGNMENT_CENTER
	actions.add_theme_constant_override("separation", 16)
	row.add_child(actions)
	_enter = Button.new()
	_enter.text = "ENTER ARENA"
	_enter.custom_minimum_size = Vector2(320, 84)
	_enter.pressed.connect(_on_enter)
	actions.add_child(_enter)
	var back := Button.new()
	back.text = "BACK"
	back.custom_minimum_size = Vector2(320, 72)
	back.pressed.connect(func() -> void: Game.go("main_menu"))
	actions.add_child(back)
	QA.register("enter", _enter)
	QA.register("back", back)
	return panel


func _make_toast() -> void:
	_toast = PanelContainer.new()
	_toast.add_theme_stylebox_override("panel", UiTheme.box(Color(0.12, 0.08, 0.03, 0.96), UiTheme.GOLD, 16, 2, 30.0, 16.0))
	_toast.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_toast.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	_toast.position.y = 96
	_toast.modulate.a = 0.0
	_toast_label = UiTheme.label("", 24, UiTheme.GOLD, true)
	_toast.add_child(_toast_label)
	add_child(_toast)


func _show_toast(text: String) -> void:
	_toast_label.text = text
	_toast.reset_size()
	_toast.position.x = (size.x - _toast.size.x) * 0.5
	if _toast_tween:
		_toast_tween.kill()
	_toast.modulate.a = 1.0
	_toast_tween = create_tween()
	_toast_tween.tween_interval(1.4)
	_toast_tween.tween_property(_toast, "modulate:a", 0.0, 0.5)
	QA.flag("toast", text)


func _on_card(id: String) -> void:
	var c := Game.roster.find(id)
	if c == null:
		return
	if c.locked:
		QA.flag("locked_tap", id)
		_show_toast("%s is locked — coming later" % c.name)
		_shake(id)
		return
	_select(id)


func _select(id: String) -> void:
	_selected = id
	for c in Game.roster.characters:
		_style_card(_cards[c.id], c, c.id == id)
	var sel := Game.roster.find(id)
	_name_label.text = sel.name.to_upper()
	_title_label.text = sel.title
	_summary_label.text = sel.summary
	_tags_label.text = "  ·  ".join(sel.style)
	_enter.disabled = not Game.roster.can_play(id)
	QA.flag("selected", id)


func _shake(id: String) -> void:
	var content: Control = _contents[id]
	var x0 := content.position.x
	var tw := create_tween()
	for dx in [14.0, -12.0, 9.0, -6.0, 0.0]:
		tw.tween_property(content, "position:x", x0 + dx, 0.05)


func _on_enter() -> void:
	if Game.choose_character(_selected):
		QA.flag("entered", _selected)
		Game.go("arena")
	else:
		_show_toast("Choose an unlocked character")
