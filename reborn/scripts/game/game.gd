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


func _ready() -> void:
	roster = Roster.load_default()
	_load_settings()


func go(screen: String) -> void:
	var path: String = SCREENS.get(screen, "")
	if path.is_empty():
		push_error("Game.go: unknown screen '%s'" % screen)
		return
	get_tree().call_deferred("change_scene_to_file", path)


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


func _save_settings() -> void:
	var cf := ConfigFile.new()
	cf.set_value("graphics", "quality", quality)
	cf.set_value("graphics", "show_fps", show_fps)
	cf.set_value("controls", "camera_sensitivity", camera_sensitivity)
	cf.save(SETTINGS_PATH)
