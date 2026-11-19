class_name DevicePanel
extends Control
## The device test's screen (?device=1, GPT's v1.7), over the arena; it decides nothing about the combat.
## Top right, small and clear of the target's health bar: the preset and its 3D resolution; the frame rate and this
## frame's time; the last 10 s's p50 and p95 (refreshed four times a second — not rebuilt every frame). TEST opens the
## panel, the game paused while it is open (paused time is not measured): LOW / MEDIUM / HIGH (at once; each keeps its
## own measurement, after a warm-up), RESTART ENCOUNTER, BENCHMARK (the same scripted encounter at each preset, about
## three and a half minutes), FULLSCREEN (only where the browser can do it), and the report — one screen to photograph.
## Held in portrait: "Turn your phone sideways" over the paused game.

const REFRESH := 0.25 ## s between two updates of the small lines
const EDGE := 24.0 ## px from the screen's top-right corner

var _lines: Label
var _test: Button
var _panel: Control
var _report: Label
var _presets: Array[Button] = []
var _bench: Button
var _full: Button
var _portrait: Control
var _refresh := 0.0
var _open := false
var _sideways := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	theme = UiTheme.build()
	_build_overlay()
	_build_panel()
	_build_portrait()
	if Game.report_due:
		Game.report_due = false
		open() # (the benchmark has just finished: its results)
	Game.bench_changed.connect(_refresh_buttons)


## The TEST button (the touch controls leave touches on it to it).
func test_button() -> Control:
	return _test


func open() -> void:
	_open = true
	_panel.visible = true
	_refresh_buttons()
	_report.text = report()
	_pause()
	QA.flag("device_panel", true)


func _toggle() -> void:
	if _open:
		close()
	else:
		open()


func close() -> void:
	_open = false
	_panel.visible = false
	_pause()
	QA.flag("device_panel", false)


func _pause() -> void:
	get_tree().paused = _open or _sideways


func _process(delta: float) -> void:
	var s := get_viewport().get_visible_rect().size
	var sideways := s.y > s.x
	if sideways != _sideways:
		_sideways = sideways
		_portrait.visible = sideways
		_pause()
		QA.flag("portrait", sideways)
	_refresh -= delta
	if _refresh > 0.0:
		return
	_refresh = REFRESH
	_lines.text = overlay()
	if _open:
		_report.text = report()
		_refresh_buttons()


## The three small lines.
func overlay() -> String:
	var r := Game.render_size()
	var head := "%s · %d %% 3D (%d×%d)" % [Game.QUALITY_NAMES[Game.quality].to_upper(),
		int(round(float(Game.preset()["scale"]) * 100.0)), r.x, r.y]
	if not Game.bench.is_empty():
		head = "BENCHMARK · " + head
	var now := "%d FPS · %.1f ms" % [Engine.get_frames_per_second(), Game.stats.last_ms()]
	var tail := ""
	if get_tree().paused:
		tail = "paused — not measured"
	elif Game.stats.warming():
		tail = "warming up — not measured"
	else:
		var rec := Game.stats.recent()
		tail = "10 s: p50 %.1f · p95 %.1f ms" % [float(rec["p50"]), float(rec["p95"])] if not rec.is_empty() \
			else "awaiting device data"
	if not Game.bench.is_empty():
		tail += " · %d / %d s" % [int(Game.stats.valid_seconds(Game.stats_key())), int(Game.bench_seconds)]
	return "%s\n%s\n%s" % [head, now, tail]


## The report: the build and the engine, the device, the errors, then each preset's frame times — in free play and in
## the benchmark. What cannot be known reliably says Unavailable.
func report() -> String:
	var p := Game.probe
	var web := not p.is_empty()
	var rs := Game.render_state()
	var v := Engine.get_version_info()
	var out: Array[String] = []
	out.append("DEVICE TEST — REBORN build %s · Godot %s" % [_or(p.get("build")), String(v.get("string", "?"))])
	out.append("Browser: %s" % _or(p.get("ua")))
	if web:
		out.append("Screen %d×%d CSS px · pixel ratio %.2f · canvas %d×%d · 3D %d×%d (%d %%) · GPU: %s" % [
			int(p.get("vw", 0)), int(p.get("vh", 0)), float(p.get("dpr", 0.0)), int(p.get("cw", 0)), int(p.get("ch", 0)),
			int(rs["w3d"]), int(rs["h3d"]), int(round(float(rs["scale"]) * 100.0)), _or(p.get("gpu"))])
	else:
		out.append("Screen Unavailable · 3D %d×%d (%d %%) · GPU: %s" % [int(rs["w3d"]), int(rs["h3d"]),
			int(round(float(rs["scale"]) * 100.0)), _or(RenderingServer.get_video_adapter_name())])
	var eng: Dictionary = Game.logger.snapshot() if Game.logger else {}
	var lost := "Unavailable"
	if web:
		lost = "no" if int(p.get("lost", 0)) == 0 else "%d times (restored %d)" % [int(p.get("lost", 0)), int(p.get("restored", 0))]
	out.append("Errors — JavaScript: %s · engine: %s (warnings %s) · WebGL context lost: %s" % [
		_count(p.get("js")) if web else "Unavailable", _count(eng.get("errors")), _count(eng.get("warnings")), lost])
	for e in (p.get("jsLast", []) as Array):
		out.append("  JS: " + String(e).left(130))
	for e in (eng.get("last", []) as Array):
		out.append("  engine: " + String(e).left(130))
	out.append("Frame times: the actual intervals between rendered frames, in ms. Left out: %d s of warm-up after each start, restart and preset change; paused, hidden-tab and loading time; %d suspensions over 1 s." % [
		int(FrameStats.WARMUP), Game.stats.stalls])
	for group: String in ["play", "bench"]:
		var title := "PLAY" if group == "play" else "BENCHMARK — the same scripted encounter, %d s per preset" % int(Game.bench_seconds)
		if group == "bench" and not Game.bench.is_empty():
			title += " (running)"
		out.append(title)
		for q in Game.QUALITY_NAMES:
			out.append("  " + _row(Game.stats.summary("%s:%s" % [group, q]), q.to_upper()))
	return "\n".join(out)


func _row(s: Dictionary, label: String) -> String:
	if int(s.get("frames", 0)) == 0:
		return "%s — not measured" % label
	return "%s · %.1f s, %d frames · p50 %.1f · p95 %.1f · p99 %.1f · worst %.1f ms · over 33 ms %.1f %% · over 50 ms %.1f %% · %d warm-up frames left out" % [
		label, float(s["seconds"]), int(s["frames"]), float(s["p50"]), float(s["p95"]), float(s["p99"]), float(s["worst"]),
		float(s["over33"]), float(s["over50"]), int(s["excluded"])]


## A value the page or the engine gave, or Unavailable.
static func _or(x: Variant) -> String:
	return "Unavailable" if x == null or str(x) == "" else str(x)


## A count the page or the engine gave (JSON numbers arrive as floats), or Unavailable.
static func _count(x: Variant) -> String:
	return "Unavailable" if x == null else str(int(x))


## For the tests and QA.
func qa_state() -> Dictionary:
	return {"open": _open, "paused": get_tree().paused, "portrait": _sideways, "lines": _lines.text,
		"report_lines": _report.text.count("\n") + 1 if _report.text != "" else 0, "report": _report.text if _open else "",
		"fullscreen_offered": _full.visible,
		"render": Game.render_state(), "keys": Game.stats.keys(), "bench": Game.bench.duplicate()}


func _build_overlay() -> void:
	_test = Button.new()
	_test.text = "TEST"
	_test.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	_test.offset_left = -EDGE - 128.0
	_test.offset_right = -EDGE
	_test.offset_top = EDGE
	_test.offset_bottom = EDGE + 72.0
	_test.pressed.connect(_toggle)
	add_child(_test)
	QA.register("device_test", _test)
	_lines = UiTheme.label("", 15, UiTheme.TEXT, true)
	_lines.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_lines.add_theme_color_override("font_outline_color", Color(0.07, 0.05, 0.1, 0.9))
	_lines.add_theme_constant_override("outline_size", 5)
	_lines.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	_lines.offset_right = -EDGE - 128.0 - 12.0
	_lines.offset_left = _lines.offset_right - 300.0
	_lines.offset_top = EDGE - 2.0
	_lines.offset_bottom = EDGE + 74.0
	_lines.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_lines.text = "awaiting device data"
	add_child(_lines)


func _build_panel() -> void:
	_panel = Control.new()
	_panel.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	_panel.visible = false
	add_child(_panel)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.7)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_panel.add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_panel.add_child(center)
	var box := PanelContainer.new()
	box.add_theme_stylebox_override("panel", UiTheme.box(UiTheme.PANEL, UiTheme.GOLD_DIM, 16, 2, 28.0, 20.0))
	center.add_child(box)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	box.add_child(col)
	var row1 := HBoxContainer.new()
	row1.add_theme_constant_override("separation", 12)
	col.add_child(row1)
	var title := UiTheme.label("GRAPHICS", 22, UiTheme.GOLD, true)
	title.custom_minimum_size = Vector2(150, 0)
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row1.add_child(title)
	for i in Game.QUALITY_NAMES.size():
		var b := _button(Game.QUALITY_NAMES[i].to_upper(), 170.0)
		var q := i
		b.pressed.connect(func() -> void:
			Game.set_setting("quality", q)
			_refresh_buttons()
			_report.text = report())
		row1.add_child(b)
		_presets.append(b)
		QA.register("device_" + Game.QUALITY_NAMES[i].to_lower(), b)
	var row2 := HBoxContainer.new()
	row2.add_theme_constant_override("separation", 12)
	col.add_child(row2)
	var restart := _button("RESTART ENCOUNTER", 300.0)
	restart.pressed.connect(func() -> void:
		QA.flag("device_restart", true)
		Game.restart_arena())
	row2.add_child(restart)
	QA.register("device_restart", restart)
	_bench = _button("BENCHMARK", 250.0)
	_bench.pressed.connect(func() -> void:
		if Game.bench.is_empty():
			close()
			Game.start_benchmark()
		else:
			Game.stop_benchmark())
	row2.add_child(_bench)
	QA.register("device_bench", _bench)
	_full = _button("FULLSCREEN", 230.0)
	_full.pressed.connect(func() -> void: DeviceProbe.toggle_fullscreen())
	_full.visible = false
	row2.add_child(_full)
	QA.register("device_fullscreen", _full)
	var shut := _button("CLOSE", 170.0)
	shut.pressed.connect(close)
	row2.add_child(shut)
	QA.register("device_close", shut)
	_report = UiTheme.label("", 14, UiTheme.TEXT, false)
	_report.custom_minimum_size = Vector2(1080, 0)
	_report.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(_report)


func _build_portrait() -> void:
	_portrait = Control.new()
	_portrait.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_portrait.mouse_filter = Control.MOUSE_FILTER_STOP
	_portrait.visible = false
	add_child(_portrait)
	var dim := ColorRect.new()
	dim.color = Color(0.03, 0.03, 0.06, 0.88)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_portrait.add_child(dim)
	var l := UiTheme.label("Turn your phone sideways", 56, UiTheme.GOLD, true)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_portrait.add_child(l)


func _button(text: String, w: float) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(w, 76)
	b.focus_mode = Control.FOCUS_NONE
	return b


## The preset buttons show the one in use; BENCHMARK reads STOP while it runs; FULLSCREEN only where the page can.
func _refresh_buttons() -> void:
	for i in _presets.size():
		_presets[i].modulate = Color(1, 1, 1) if i == Game.quality else Color(1, 1, 1, 0.55)
		_presets[i].disabled = not Game.bench.is_empty()
	_bench.text = "STOP BENCHMARK" if not Game.bench.is_empty() else "BENCHMARK (3½ min)"
	_full.visible = bool(Game.probe.get("fs", false))
	_full.text = "EXIT FULLSCREEN" if bool(Game.probe.get("full", false)) else "FULLSCREEN"
