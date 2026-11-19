extends Node
## Game state (autoload "Game"): the flow between screens, the chosen character and the player's settings.
## Screens ask it to move on; it never reaches into their nodes, and the combat code never depends on it for rules.
## The graphics presets (M4.1, GPT's v1.7) are applied here — the 3D image's resolution (the HUD always at the screen's
## own) and the shadow map's size; the arena gives its moon the preset's shadows.
## The device test (?device=1 in the web build's address, GPT's v1.7 — apart from ?qa=1's test bridge): it goes
## straight into the arena; frame times are measured here (they outlive a restart), the page watched (DeviceProbe), the
## engine's errors counted (DeviceLogger); and the benchmark — the same scripted encounter at each preset — runs from
## here, preset by preset. It never changes a combat rule.

signal settings_changed
## The benchmark began, moved on or ended (the device panel shows it).
signal bench_changed

const SCREENS := {
	"main_menu": "res://scenes/menu/main_menu.tscn",
	"character_select": "res://scenes/menu/character_select.tscn",
	"arena": "res://scenes/arena/arena.tscn",
}
const SETTINGS_PATH := "user://settings.cfg"
const QUALITY_NAMES: Array[String] = ["Low", "Medium", "High"]
## Each preset (GPT's v1.7): the 3D image's scale per axis, the moon's shadow splits (0: no shadows) and the shadow
## map's size (px). The fog, the braziers and the HUD are the same in all three; the frame rate is never capped.
const QUALITY: Array[Dictionary] = [
	{"scale": 0.5, "splits": 0, "map": 0},
	{"scale": 0.75, "splits": 1, "map": 2048},
	{"scale": 1.0, "splits": 2, "map": 4096},
]
const BENCH_SECONDS := 60.0 ## valid seconds measured at each preset in the benchmark (GPT's v1.7: at least 60)

var roster: Roster
var selected_character := "samurai"
## 0 Low, 1 Medium, 2 High — until the player chooses: Medium on a touch screen, High otherwise.
var quality := 2
var camera_sensitivity := 1.0
var show_fps := false
## Master volume, 0..1.
var sound_volume := 0.8
## The movement demo for the recordings (`-- --demo`): straight to the arena, driven by qa/demo_driver.gd.
var demo := false
## The device test (?device=1).
var device_test := false
## Its frame times, and what the page and the engine report (read a few times a second).
var stats := FrameStats.new()
var probe := {}
var logger: DeviceLogger
## The benchmark while it runs: {i: the preset measured now, back: the player's own preset}; {} otherwise.
var bench := {}
## Its valid seconds per preset: BENCH_SECONDS (a browser test run with ?qa=1 may shorten it: &bench=N).
var bench_seconds := BENCH_SECONDS
## The benchmark's results are to be shown when the arena is back.
var report_due := false

## A short fade through the menus' midnight violet between screens (and in from it at start).
var _fade: ColorRect
var _changing := false
var _last_us := 0
var _probe_left := 0.0
var _measure := false ## the arena is built and in play (menus, loading and restarts are never measured)
var _hidden := false
var _flips := 0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS # (the device test's clock runs through a pause: it is left out, not lost)
	roster = Roster.load_default()
	quality = 1 if DisplayServer.is_touchscreen_available() else 2
	_load_settings()
	_apply_sound()
	var layer := CanvasLayer.new()
	layer.layer = 100
	add_child(layer)
	_fade = ColorRect.new()
	_fade.color = Color("#111020")
	_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	layer.add_child(_fade)
	QA.command.connect(_on_qa_command)
	if "--demo" in OS.get_cmdline_user_args():
		demo = true
		quality = 2 # (the recordings keep the reviewed look; not saved)
		apply_quality()
		_fade.color.a = 0.0
		selected_character = "samurai"
		get_tree().call_deferred("change_scene_to_file", SCREENS["arena"])
		return
	if OS.has_feature("web"):
		var search: Variant = JavaScriptBridge.eval("window.location.search", true)
		var q := String(search) if typeof(search) == TYPE_STRING else ""
		device_test = q.contains("device=1")
		if q.contains("qa=1") and q.contains("bench="):
			bench_seconds = clampf(float(q.get_slice("bench=", 1).get_slice("&", 0)), 3.0, BENCH_SECONDS)
	apply_quality()
	if device_test:
		DeviceProbe.install()
		logger = DeviceLogger.new()
		OS.add_logger(logger)
		selected_character = "samurai"
		get_tree().call_deferred("change_scene_to_file", SCREENS["arena"])
	create_tween().tween_property(_fade, "color:a", 0.0, 0.45)


func go(screen: String) -> void:
	var path: String = SCREENS.get(screen, "")
	if path.is_empty():
		push_error("Game.go: unknown screen '%s'" % screen)
		return
	if _changing:
		return
	_changing = true
	var out := create_tween()
	out.tween_property(_fade, "color:a", 1.0, 0.16)
	await out.finished
	get_tree().paused = false
	_measure = false # (only the arena in play is measured: it says when it is ready)
	get_tree().change_scene_to_file(path)
	await get_tree().process_frame
	await get_tree().process_frame
	_changing = false
	create_tween().tween_property(_fade, "color:a", 0.0, 0.28)


## The authoritative check: a locked character can never become the selected one, whatever the interface does.
func choose_character(id: String) -> bool:
	if roster == null or not roster.can_play(id):
		return false
	selected_character = id
	return true


func set_setting(key: String, value: Variant) -> void:
	match key:
		"quality":
			quality = clampi(int(value), 0, 2)
			apply_quality()
		"camera_sensitivity":
			camera_sensitivity = clampf(float(value), 0.3, 3.0)
		"show_fps":
			show_fps = bool(value)
		"sound_volume":
			sound_volume = clampf(float(value), 0.0, 1.0)
			_apply_sound()
		_:
			push_warning("Game.set_setting: unknown key '%s'" % key)
			return
	_save_settings()
	settings_changed.emit()


## The current preset's settings.
func preset() -> Dictionary:
	return QUALITY[quality]


## The preset on the screen at once: the 3D image's scale (bilinear) and the shadow map's size; the arena's moon
## follows settings_changed. In the device test a new preset begins its own measurement, after a warm-up.
func apply_quality() -> void:
	var q := preset()
	var root := get_tree().root
	root.scaling_3d_mode = Viewport.SCALING_3D_MODE_BILINEAR
	root.scaling_3d_scale = float(q["scale"])
	if int(q["map"]) > 0:
		RenderingServer.directional_shadow_atlas_set_size(int(q["map"]), true)
	if device_test and _measure:
		stats.begin(stats_key())


## The 3D image's size in pixels now (the screen's, scaled by the preset).
func render_size() -> Vector2i:
	return Vector2i((Vector2(get_tree().root.size) * float(preset()["scale"])).round())


## For QA and the device test: the preset, its scale, the 3D image's size and the video memory in use.
func render_state() -> Dictionary:
	var r := render_size()
	return {"quality": quality, "scale": get_tree().root.scaling_3d_scale, "w3d": r.x, "h3d": r.y,
		"window": [get_tree().root.size.x, get_tree().root.size.y],
		"tex_mem": RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TEXTURE_MEM_USED),
		"video_mem": RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_VIDEO_MEM_USED)}


# --- the device test --------------------------------------------------------------------------------------------------


## The measurement set now: the benchmark's or free play's, at the preset on screen.
func stats_key() -> String:
	return ("bench:" if not bench.is_empty() else "play:") + QUALITY_NAMES[quality]


## The arena is built (it calls this in the device test): measuring may begin, after a warm-up.
func arena_ready() -> void:
	_measure = true
	stats.begin(stats_key())


## The training encounter from the start: the arena built again (both fighters whole at their marks).
func restart_arena() -> void:
	_measure = false
	get_tree().paused = false
	get_tree().reload_current_scene()


## The benchmark: the same scripted encounter (the integrated M4 review, looped), from a fresh arena, at Low, Medium and
## High in turn — bench_seconds valid seconds each after its warm-up — then the player's own preset again.
func start_benchmark() -> void:
	if not bench.is_empty():
		return
	stats.clear("bench:")
	bench = {"i": 0, "back": quality}
	_bench_preset()


func stop_benchmark(finished: bool = false) -> void:
	if bench.is_empty():
		return
	quality = int(bench["back"])
	bench = {}
	report_due = finished
	apply_quality()
	bench_changed.emit()
	restart_arena()


func _bench_preset() -> void:
	quality = int(bench["i"])
	apply_quality()
	bench_changed.emit()
	restart_arena()


func _process(_delta: float) -> void:
	if not device_test:
		return
	var now := Time.get_ticks_usec()
	var ms := (now - _last_us) / 1000.0 if _last_us > 0 else 0.0
	_last_us = now
	_probe_left -= ms / 1000.0
	if _probe_left <= 0.0:
		_probe_left = 0.25
		probe = DeviceProbe.read()
		var hidden := bool(probe.get("hidden", false))
		var flips := int(probe.get("flips", 0))
		if (_hidden and not hidden) or flips != _flips:
			stats.hold(0.5) # (back from a hidden tab: its first frames are left out)
		_hidden = hidden
		_flips = flips
	stats.frame(ms, _measure and not get_tree().paused and not _hidden)
	if not bench.is_empty() and _measure and stats.valid_seconds(stats_key()) >= bench_seconds:
		bench["i"] = int(bench["i"]) + 1
		if int(bench["i"]) >= QUALITY.size():
			stop_benchmark(true)
		else:
			_bench_preset()


func _on_qa_command(cmd: String, args: Array) -> void:
	if cmd == "quality" and not args.is_empty():
		set_setting("quality", int(args[0]))
		QA.flag("quality", quality)


# --- settings -----------------------------------------------------------------------------------------------------------


func _load_settings() -> void:
	var cf := ConfigFile.new()
	if cf.load(SETTINGS_PATH) != OK:
		return
	# (the preset under its own key: the old "quality" was saved before the presets did anything — no choice to keep)
	quality = clampi(int(cf.get_value("graphics", "preset", quality)), 0, 2)
	show_fps = bool(cf.get_value("graphics", "show_fps", show_fps))
	camera_sensitivity = clampf(float(cf.get_value("controls", "camera_sensitivity", camera_sensitivity)), 0.3, 3.0)
	sound_volume = clampf(float(cf.get_value("audio", "sound_volume", sound_volume)), 0.0, 1.0)


func _save_settings() -> void:
	var cf := ConfigFile.new()
	cf.set_value("graphics", "preset", quality)
	cf.set_value("graphics", "show_fps", show_fps)
	cf.set_value("controls", "camera_sensitivity", camera_sensitivity)
	cf.set_value("audio", "sound_volume", sound_volume)
	cf.save(SETTINGS_PATH)


func _apply_sound() -> void:
	AudioServer.set_bus_mute(0, sound_volume <= 0.001)
	AudioServer.set_bus_volume_db(0, linear_to_db(maxf(sound_volume, 0.001)))
