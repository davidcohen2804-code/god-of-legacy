class_name PlayerInput
extends Node
## Input system: turns the touch controls, the keyboard and a gamepad into the player's intents — a move vector, a
## sprint wish, a camera turn and action presses. A press waits in a short buffer (GPT: configurable, 0.12 s by
## default) so one made just before an action becomes possible is not lost; the code that acts decides whether it
## can use it. The buffer runs on the fixed physics tick, like the combat it feeds, and stands still while `paused`
## (hit-stop: a press made during the freeze is kept for after it). It knows nothing of the rules.

const ACTIONS: Array[String] = ["attack", "heavy", "skill1", "skill2", "skill3", "dodge", "jump", "cond1", "cond2"]
## Sprint from the stick: held at its rim this long (GPT: 250 ms).
const SPRINT_HOLD := 0.25

## How long a press stays usable, in seconds.
var buffer_time := 0.12
## While true the buffered presses do not age (set by the player controller through hit-stop).
var paused := false
## From the on-screen joystick: x right, y forward, length 0..1; `touch_rim` while it is pushed to its rim.
var touch_move := Vector2.ZERO
var touch_rim := false
var camera_drag := Vector2.ZERO
var _pressed := {}
var _held := {}
var _rim_time := 0.0


func _ready() -> void:
	_ensure_actions()
	process_physics_priority = -20 # each tick: the buffer ages before the controller reads it


func press(action: String) -> void:
	_pressed[action] = buffer_time
	_held[action] = true


func release(action: String) -> void:
	_held[action] = false


## True once per press, while it is still in the buffer.
func consume(action: String) -> bool:
	if _pressed.has(action):
		_pressed.erase(action)
		return true
	return false


func peek(action: String) -> bool:
	return _pressed.has(action)


func is_held(action: String) -> bool:
	return bool(_held.get(action, false))


func clear() -> void:
	_pressed.clear()


func move_vector() -> Vector2:
	var k := Input.get_vector("mv_left", "mv_right", "mv_back", "mv_fwd")
	var v := touch_move if touch_move.length() >= k.length() else k
	return v.limit_length(1.0)


## Sprint: the stick held at its rim for SPRINT_HOLD, or the keyboard's Shift / the gamepad's stick click.
func wants_sprint() -> bool:
	return _rim_time >= SPRINT_HOLD or Input.is_action_pressed("kb_sprint")


## The camera turn since the last call (pixels of drag; keys and the right stick add to it).
func take_camera_drag(delta: float) -> Vector2:
	var d := camera_drag
	camera_drag = Vector2.ZERO
	return d + Input.get_vector("cam_left", "cam_right", "cam_up", "cam_down") * 520.0 * delta


func _physics_process(delta: float) -> void:
	if paused:
		return
	for a in _pressed.keys():
		_pressed[a] -= delta
		if _pressed[a] <= 0.0:
			_pressed.erase(a)


func _process(delta: float) -> void:
	_rim_time = _rim_time + delta if touch_rim else 0.0


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch or event is InputEventScreenDrag or event is InputEventMouse:
		return
	for a in ACTIONS:
		var act := "kb_" + a
		if not InputMap.has_action(act):
			continue
		if event.is_action_pressed(act, false):
			press(a)
		elif event.is_action_released(act):
			release(a)


static func _add(action: String, keys: Array, buttons: Array = [], axes: Array = []) -> void:
	if InputMap.has_action(action):
		return
	InputMap.add_action(action, 0.25)
	for k in keys:
		var e := InputEventKey.new()
		e.physical_keycode = k
		InputMap.action_add_event(action, e)
	for b in buttons:
		var j := InputEventJoypadButton.new()
		j.button_index = b
		InputMap.action_add_event(action, j)
	for ax in axes:
		var m := InputEventJoypadMotion.new()
		m.axis = ax[0]
		m.axis_value = ax[1]
		InputMap.action_add_event(action, m)


func _ensure_actions() -> void:
	_add("mv_fwd", [KEY_W, KEY_UP], [], [[JOY_AXIS_LEFT_Y, -1.0]])
	_add("mv_back", [KEY_S, KEY_DOWN], [], [[JOY_AXIS_LEFT_Y, 1.0]])
	_add("mv_left", [KEY_A, KEY_LEFT], [], [[JOY_AXIS_LEFT_X, -1.0]])
	_add("mv_right", [KEY_D, KEY_RIGHT], [], [[JOY_AXIS_LEFT_X, 1.0]])
	_add("cam_left", [KEY_Q], [], [[JOY_AXIS_RIGHT_X, -1.0]])
	_add("cam_right", [KEY_E], [], [[JOY_AXIS_RIGHT_X, 1.0]])
	_add("cam_up", [KEY_R], [], [[JOY_AXIS_RIGHT_Y, -1.0]])
	_add("cam_down", [KEY_F], [], [[JOY_AXIS_RIGHT_Y, 1.0]])
	_add("kb_sprint", [KEY_SHIFT], [JOY_BUTTON_LEFT_STICK])
	_add("kb_attack", [KEY_J], [JOY_BUTTON_X])
	_add("kb_heavy", [KEY_H], [JOY_BUTTON_Y])
	_add("kb_skill1", [KEY_1, KEY_U], [JOY_BUTTON_LEFT_SHOULDER])
	_add("kb_skill2", [KEY_2, KEY_I], [JOY_BUTTON_RIGHT_SHOULDER])
	_add("kb_skill3", [KEY_3, KEY_O], [JOY_BUTTON_DPAD_UP])
	_add("kb_dodge", [KEY_K, KEY_CTRL], [JOY_BUTTON_B])
	_add("kb_jump", [KEY_SPACE], [JOY_BUTTON_A])
	_add("kb_cond1", [KEY_4, KEY_Z], [JOY_BUTTON_DPAD_LEFT])
	_add("kb_cond2", [KEY_5, KEY_X], [JOY_BUTTON_DPAD_RIGHT])
