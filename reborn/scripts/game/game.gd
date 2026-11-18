extends Node
## Game state (autoload "Game"): the flow between screens, the chosen character and the player's settings.
## Screens ask it to move on; it never reaches into their nodes, and the combat code never depends on it for rules.

signal settings_changed

const SCREENS := {
	"main_menu": "res://scenes/menu/main_menu.tscn",
	"character_select": "res://scenes/menu/character_select.tscn",
	"arena": "res://scenes/arena/arena.tscn",
}
const SETTINGS_PATH := "user://settings.cfg"
const QUALITY_NAMES: Array[String] = ["Low", "Medium", "High"]

var roster: Roster
var selected_character := "samurai"
## 0 Low, 1 Medium, 2 High.
var quality := 1
var camera_sensitivity := 1.0
var show_fps := false
## Master volume, 0..1.
var sound_volume := 0.8
## The movement demo for the recordings (`-- --demo`): straight to the arena, driven by qa/demo_driver.gd.
var demo := false

## A short fade through the menus' midnight violet between screens (and in from it at start).
var _fade: ColorRect
var _changing := false


func _ready() -> void:
	roster = Roster.load_default()
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
	if "--demo" in OS.get_cmdline_user_args():
		demo = true
		_fade.color.a = 0.0
		selected_character = "samurai"
		get_tree().call_deferred("change_scene_to_file", SCREENS["arena"])
		return
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


func _load_settings() -> void:
	var cf := ConfigFile.new()
	if cf.load(SETTINGS_PATH) != OK:
		return
	quality = clampi(int(cf.get_value("graphics", "quality", quality)), 0, 2)
	show_fps = bool(cf.get_value("graphics", "show_fps", show_fps))
	camera_sensitivity = clampf(float(cf.get_value("controls", "camera_sensitivity", camera_sensitivity)), 0.3, 3.0)
	sound_volume = clampf(float(cf.get_value("audio", "sound_volume", sound_volume)), 0.0, 1.0)


func _save_settings() -> void:
	var cf := ConfigFile.new()
	cf.set_value("graphics", "quality", quality)
	cf.set_value("graphics", "show_fps", show_fps)
	cf.set_value("controls", "camera_sensitivity", camera_sensitivity)
	cf.set_value("audio", "sound_volume", sound_volume)
	cf.save(SETTINGS_PATH)


func _apply_sound() -> void:
	AudioServer.set_bus_mute(0, sound_volume <= 0.001)
	AudioServer.set_bus_volume_db(0, linear_to_db(maxf(sound_volume, 0.001)))
