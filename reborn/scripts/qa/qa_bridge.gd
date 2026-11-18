extends Node
## QA bridge (autoload "QA"). With ?qa=1 in the web build's address, the game publishes its state to the page as
## window.__gol — the current screen, fps, the named controls' rectangles, live values (the player's state...) and
## test flags — so automated browser tests can drive the real touch interface, and it takes a few test commands
## through window.__golCmd(name, ...args) (camera viewpoints for inspection shots). Without ?qa=1, and outside the
## web, it does nothing.

## A test command from the page: its name and arguments.
signal command(cmd: String, args: Array)

var enabled := false
var scene := ""
var _controls := {}
var _rects := {}
var _tracks := {}
var _flags := {}
var _events: Array = []
var _acc := 0.0
var _cmd_callback: JavaScriptObject


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	if OS.has_feature("web"):
		var search: Variant = JavaScriptBridge.eval("window.location.search", true)
		enabled = typeof(search) == TYPE_STRING and String(search).contains("qa=1")
	if enabled:
		_cmd_callback = JavaScriptBridge.create_callback(_on_page_command)
		var win := JavaScriptBridge.get_interface("window")
		win.set("__golCmd", _cmd_callback)


## Called by each screen when it is ready (the previous screen's controls drop out once they are freed).
func mark(scene_name: String) -> void:
	scene = scene_name
	_rects.clear()
	_tracks.clear()
	print("[QA] scene=%s" % scene_name)
	_publish()


func register(key: String, c: Control) -> void:
	_controls[key] = weakref(c)


## A rectangle drawn by hand (not a Control), in the canvas's coordinates; an empty one hides it.
func set_rect(key: String, r: Rect2) -> void:
	if r.size == Vector2.ZERO:
		_rects.erase(key)
	else:
		_rects[key] = [r.position.x, r.position.y, r.size.x, r.size.y]


## A value read at every publish (the player's state...).
func track(key: String, getter: Callable) -> void:
	_tracks[key] = getter


func flag(key: String, value: Variant) -> void:
	_flags[key] = value
	_events.append("%s=%s" % [key, str(value)])
	if _events.size() > 40:
		_events.pop_front()


func _on_page_command(args: Array) -> void:
	if args.is_empty():
		return
	var cmd := str(args[0])
	print("[QA] command %s %s" % [cmd, str(args.slice(1))])
	command.emit(cmd, args.slice(1))


func _process(delta: float) -> void:
	if not enabled:
		return
	_acc += delta
	if _acc >= 0.2:
		_acc = 0.0
		_publish()


func _publish() -> void:
	if not enabled:
		return
	var rects := {}
	for key in _controls.keys():
		var c: Object = _controls[key].get_ref()
		if c == null:
			_controls.erase(key)
		elif c is Control and (c as Control).is_visible_in_tree():
			var r: Rect2 = (c as Control).get_global_rect()
			rects[key] = [r.position.x, r.position.y, r.size.x, r.size.y]
	for key in _rects:
		rects[key] = _rects[key]
	var live := {}
	for key in _tracks:
		var g: Callable = _tracks[key]
		if g.is_valid():
			live[key] = g.call()
	var vp := get_viewport().get_visible_rect().size
	var state := {
		"scene": scene,
		"fps": Engine.get_frames_per_second(),
		"vp": [vp.x, vp.y],
		"rects": rects,
		"live": live,
		"flags": _flags,
		"events": _events,
	}
	JavaScriptBridge.eval("window.__gol = %s;" % JSON.stringify(state), true)
