class_name DemoDriver
extends Node
## The review recordings: run with `-- --demo`, the game goes straight to the arena and this node plays a fixed script
## of touches through the engine's own input — the same path a finger takes — so the on-screen controls show the thumb
## on the stick and the taps. M4 Stage D (SCRIPT_D, the default — GPT's v1.5 / v1.6): Explosive Execution at real
## speed — Basic 1 → 2 → 3 on the Training Automaton, SEAL as it shows, the mark and its detonation, EXECUTE as it
## shows — then a missed strike (Basic 3 at empty air: no SEAL), a SEAL left to expire, an EXECUTE refused from 4 m (a
## clearly captioned test command moves the automaton away) that then expires, an Execution whose target is moved out
## of its path (captioned the same way) and misses; and the branch again at half speed. Between examples he steps back
## and the automaton is put back on its mark with its health restored (the next example starts the same way).
## The integrated M4 review (SCRIPT_M4, `-- --demo --demo-m4`): the three Legacy Chain branches one after another at
## real speed against the same Training Automaton, nothing reset between them — Phantom Control (CHAIN → PULL → RISE →
## PURSUE), Defensive Counterplay (its sweep, STEP through it, COUNTER) and Explosive Execution (Basic 1 → 2 → 3 → SEAL
## → its detonation → EXECUTE, which defeats it: 150 − 44 − 14 − 40 − 24 leaves 28).
## M4 Stage C (SCRIPT_C, `-- --demo --demo-c`): defensive counterplay. The Samurai walks up to the
## Training Automaton (its sparring script off: the script starts each of its attacks, so every example begins the
## same way) and, at real speed: its telegraphed sweep (the raised, kindling sword and the amber arc), Shadow Step
## timed into the cut — the blade passes through his fading shadow — COUNTER appearing and pressed, the counter's dash
## and cut landing; then three failed evasions: too late (struck in the step's startup), a plain roll (no shadow — no
## COUNTER), too early (his shadow has faded before the blade comes); and the success once more at half speed. Presses
## timed against the sweep are made when its attack has run a set time, a frame or two of input latency included, as a
## practised thumb would. Captions in the HUD's prompt line name each part. Recorded with Godot's Movie Maker
## (--write-movie, fixed frame rate), so the clip is smooth however slowly the machine renders; the script runs in game
## time. It quits when the script ends — or, looped (the device test's benchmark, GPT's v1.7: the same encounter at each
## graphics preset), starts it again, the automaton back on its mark once it has risen. Its touches go through the
## window's own coordinates (the canvas's stretched to the screen), so they land on the buttons on any screen.

## [time (s), action, args...]. "go": the thumb steers the stick toward a point of the courtyard (x, z) at a push
## (0..1; 1 = the rim, which sprints after 0.25 s) until he is there; "approach": he walks at a push toward the
## automaton until he stands `d` m from it; "point": a light push toward a direction of the courtyard (x, z) for a
## moment, so he turns to face it; "stick": a fixed push (x right, y up); "stick_up": the thumb lifts; "tap": a button;
## "tap_shown": a button tapped `delay` s after it appears (within 2 s); "tap_on_attack": a button tapped when the
## automaton's attack has run `at` s; "stick_on_attack": the stick pushed so then; "attack": the automaton attacks (as
## soon as it can, within 2 s); "spar": its
## sparring script on or off; "drag": a second finger turns the camera; "caption": a line in the HUD for some seconds;
## "slowmo": the game's speed. The Samurai starts 7 m south of the dummy looking north; the automaton stands north-west
## of the dummy, at (-3.5, -2.5).
const SCRIPT_C := [
	[0.2, "spar", false],
	[0.4, "caption", "Shadow Counter: evade the automaton's telegraphed sweep, then answer it", 3.0],
	[0.5, "go", Vector2(-3.5, 1.4), 0.85], # run up to it (the stick lets go 0.8 m short of the point)
	[2.2, "approach", 1.75, 0.35], # walk in to 1.75 m from it, facing it
	[3.7, "caption", "Its telegraph: the sword raised and kindling amber, an amber arc where the cut will pass", 2.0],
	[3.7, "attack"],
	[3.7, "tap_on_attack", "skill2", 0.43], # Shadow Step, timed into the cut (idle stick: backward)
	[4.35, "caption", "SHADOW STEP — the blade passes through his fading shadow: COUNTER", 1.5],
	[4.35, "tap_shown", "cond1", 0.15],
	[4.95, "caption", "SHADOW COUNTER — he dashes back at it; the cut must connect (14)", 1.8],
	# (STEP's cooldown is 5 s: each example that uses it comes at least 5 s after the last)
	[9.2, "caption", "Failed evasion 1 — too late: struck in the step's startup", 2.2],
	[9.3, "attack"],
	[9.3, "tap_on_attack", "skill2", 0.53],
	[12.3, "caption", "Failed evasion 2 — a plain roll: no shadow, no COUNTER", 2.2],
	[12.4, "attack"],
	[12.4, "stick_on_attack", Vector2(0.45, 0), 0.48], # the thumb leans right (east, along the cut's sweep)...
	[12.4, "tap_on_attack", "dodge", 0.54], # ...and DODGE rolls that way as the blade comes
	[12.4, "stick_on_attack", Vector2.ZERO, 0.75], # (the thumb lifts)
	[13.6, "approach", 1.75, 0.6], # back to it at a run
	[15.4, "caption", "Failed evasion 3 — too early: his shadow fades before the blade arrives", 2.2],
	[15.5, "attack"],
	[15.5, "tap_on_attack", "skill2", 0.25],
	[16.8, "approach", 1.75, 0.6],
	[20.1, "caption", "The evasion and the counter again, at half speed", 2.4],
	[20.3, "slowmo", 0.5],
	[20.6, "attack"],
	[20.6, "tap_on_attack", "skill2", 0.43],
	[21.1, "tap_shown", "cond1", 0.15],
	[22.6, "slowmo", 1.0],
	[24.2, "end"],
]

## Stage D's actions besides: "mash": Attack tapped as a quick thumb would — a strike's tap taken at once, the next
## tapped while the strike cuts (held for it by the chain), never one too many — until `n` strikes have started;
## "after_mash": a step `delay` s after the mash's last strike has ended; "when_cond": a step once an opportunity for
## `ability` has been on a button `delay` s (within 6 s); "when_action": a step once his action `id` has run `at` s
## (within 6 s); "reset": the automaton back on its mark facing him, its health restored; "auto_away": the automaton
## placed `d` m from him, where it stands relative to him (a test command, captioned as such); "auto_side": it moved
## `d` m sideways, across his line to it (likewise).
const SCRIPT_D := [
	[0.2, "spar", false],
	[0.4, "caption", "Explosive Execution: 3 confirmed strikes → SEAL → detonation → EXECUTE", 3.0],
	[0.5, "go", Vector2(-3.5, 1.4), 0.85], # run up to it (the stick lets go 0.8 m short of the point)
	[2.2, "approach", 1.75, 0.35], # walk in to 1.75 m from it, facing it
	[3.6, "when_cond", "explosive_seal", 0.0, [0.0, "caption", "BASIC 1 → 2 → 3, each confirmed on it: EXPLOSIVE SEAL", 1.2]],
	[3.6, "when_cond", "explosive_seal", 0.1, [0.0, "tap", "cond1"]],
	[3.6, "when_action", "explosive_seal", 0.12, [0.0, "caption", "The mark is planted — it bursts 650 ms later (24)", 1.3]],
	[3.6, "when_cond", "phantom_execution", 0.0, [0.0, "caption", "PHANTOM EXECUTION — the dash, the cleave (45), the low finishing stance", 2.6]],
	[3.6, "when_cond", "phantom_execution", 0.3, [0.0, "tap", "cond1"]],
	[3.6, "mash", 3],
	[7.6, "go", Vector2(-3.5, 1.2), 0.85], # he steps back...
	[7.6, "caption", "A missed strike: Basic 3 swings at empty air — not confirmed, so no SEAL", 3.0],
	[8.8, "reset"], # ...and the automaton is back on its mark, its health restored
	[8.9, "approach", 1.75, 0.6],
	[10.2, "mash", 2],
	[10.2, "after_mash", 0.0, [0.0, "stick", Vector2(0, -0.7)]], # the thumb pulls back, away from it...
	[10.2, "after_mash", 0.1, [0.0, "tap", "attack"]], # ...and Basic 3 cuts that way
	[10.2, "after_mash", 0.45, [0.0, "stick_up"]],
	[12.6, "go", Vector2(-3.5, 1.2), 0.85],
	[12.6, "caption", "SEAL left unused: after 1.2 s it is gone — no mark, nothing follows", 3.2],
	[13.8, "reset"],
	[13.9, "approach", 1.75, 0.6],
	[15.2, "mash", 3],
	[18.0, "go", Vector2(-3.5, 1.2), 0.85],
	[18.0, "caption", "Test command: moved 4 m away — EXECUTE is refused, then it expires", 3.8],
	[19.2, "reset"],
	[19.3, "approach", 1.75, 0.6],
	[20.6, "when_cond", "explosive_seal", 0.1, [0.0, "tap", "cond1"]],
	[20.6, "when_cond", "phantom_execution", 0.05, [0.0, "auto_away", 4.0]],
	[20.6, "when_cond", "phantom_execution", 0.3, [0.0, "tap", "cond1"]],
	[20.6, "mash", 3],
	[24.4, "go", Vector2(-3.5, 1.2), 0.85],
	[24.4, "caption", "Test command: moved out of the cleave's path — the Execution misses", 3.8],
	[25.6, "reset"],
	[25.7, "approach", 1.75, 0.6],
	[27.0, "when_cond", "explosive_seal", 0.1, [0.0, "tap", "cond1"]],
	[27.0, "when_cond", "phantom_execution", 0.3, [0.0, "tap", "cond1"]],
	[27.0, "when_action", "phantom_execution", 0.08, [0.0, "auto_side", 2.6]],
	[27.0, "mash", 3],
	[30.8, "go", Vector2(-3.5, 1.2), 0.85],
	[30.8, "caption", "The whole branch again, at half speed", 2.4],
	[32.0, "reset"],
	[32.1, "approach", 1.75, 0.6],
	[33.4, "slowmo", 0.5],
	[33.4, "when_cond", "explosive_seal", 0.1, [0.0, "tap", "cond1"]],
	[33.4, "when_cond", "phantom_execution", 0.3, [0.0, "tap", "cond1"]],
	[33.4, "mash", 3],
	[36.6, "slowmo", 1.0],
	[38.0, "end"],
]

const SCRIPT_M4 := [
	[0.2, "spar", false],
	[0.4, "caption", "M4 — three Legacy Chain branches, each opened by a confirmed event", 3.2],
	[0.5, "go", Vector2(-10.4, 0.6), 0.85], # run west, past the dummy
	[3.2, "go", Vector2(-9.4, -0.9), 0.3], # walk to his place
	[4.2, "point", Vector2(1.0, -0.3), 0.25], # face the automaton, about 6 m away
	[4.8, "caption", "1 · PHANTOM CONTROL — chain → pull → rising slash → aerial pursuit", 3.6],
	[4.9, "tap", "skill1"],
	[5.3, "tap_shown", "cond1", 0.25], # PULL
	[6.5, "tap", "skill3"],
	[6.6, "tap_shown", "cond1", 0.1], # PURSUE (it waits for Rising Slash's 50 %)
	[9.6, "caption", "2 · DEFENSIVE COUNTERPLAY — its sweep → Shadow Step → Shadow Counter", 3.6],
	[9.6, "approach", 1.75, 0.35],
	[11.2, "attack"],
	[11.2, "tap_on_attack", "skill2", 0.43],
	[11.8, "tap_shown", "cond1", 0.15], # COUNTER
	[13.6, "caption", "3 · EXPLOSIVE EXECUTION — 3 strikes → SEAL → detonation → EXECUTE", 3.6],
	[13.6, "approach", 1.75, 0.35],
	[15.0, "when_cond", "explosive_seal", 0.1, [0.0, "tap", "cond1"]],
	[15.0, "when_cond", "phantom_execution", 0.3, [0.0, "tap", "cond1"]],
	[15.0, "mash", 3],
	[20.0, "end"],
]

## M4.2 — how it plays (`-- --demo --demo-feel`, recorded at the Android phone's shape): free movement at real speed —
## walking, running and sprinting at the stick's rim, a second finger turning the camera, a jump, a roll, a Shadow Step
## in open space, the three strikes on the air and Heavy — then (A2) a run in to 2.6 m from the automaton and a
## side-step to his left, so the automaton drifts into the right-hand buttons and the camera's assist turns it clear;
## then the integrated review's three branches (SCRIPT_M4).
const FEEL_PRELUDE := [
	[0.2, "spar", false],
	[0.3, "caption", "How it plays at real speed — the white rings are the thumbs on the stick and on the buttons", 3.2],
	[0.5, "go", Vector2(-5.0, 8.5), 0.45], # a walk to the west
	[3.6, "go", Vector2(5.5, 8.5), 1.0], # a run east, sprinting once the thumb has held the rim 0.25 s
	[6.0, "drag", Vector2(300, 0), 0.9], # a second finger turns the camera
	[7.2, "tap", "jump"],
	[8.3, "tap", "dodge"],
	[9.4, "tap", "skill2"], # Shadow Step in open space (its cooldown is over before the review's)
	[10.5, "caption", "Basic 1 → 2 → 3 on the air, then HEAVY", 2.2],
	[10.6, "mash", 3],
	[12.6, "tap", "heavy"],
	[14.0, "approach", 2.6, 0.85], # a run in to 2.6 m from the automaton
	[16.6, "behind"], # (the camera behind him — a cut)
	[16.8, "caption", "A side-step: the automaton drifts into the buttons — the camera turns a little to keep it clear", 3.4],
	[17.0, "stick", Vector2(-0.42, 0.0)], # a walk to his left
	[18.5, "stick_up"],
	[20.2, "go", Vector2(0.0, 7.0), 0.85], # back to where the review starts
]
const FEEL_REVIEW_AT := 24.0 ## s: SCRIPT_M4 starts here, after the prelude

## M4.2-A2 — the exploration framing (`-- --demo --demo-explore`, the phone's shape): a walk in to the automaton from
## 15 m with exploration A (as before), then the same with exploration B (GPT's v2.2 proposal) — each crossing the
## 9 m at which the combat framing takes over.
const SCRIPT_EXPLORE := [
	[0.2, "spar", false],
	[0.2, "expvar", "A"],
	[0.3, "caption", "Exploration A (as before: 8 m, 36°, 55°) — a walk in; the combat framing takes over at 9 m", 4.0],
	[0.4, "go", Vector2(4.0, 10.5), 0.85],
	[3.6, "point", Vector2(-0.5, -0.866), 0.3],
	[4.0, "behind"],
	[4.2, "approach", 3.0, 0.4],
	[11.5, "caption", "Exploration B (proposal: 7.35 m, 35°, 50°) — the same walk in", 4.0],
	[11.5, "expvar", "B"],
	[11.6, "go", Vector2(4.0, 10.5), 0.85],
	[14.8, "point", Vector2(-0.5, -0.866), 0.3],
	[15.2, "behind"],
	[15.4, "approach", 3.0, 0.4],
	[23.0, "end"],
]

## M4.2-A2 — the fading as the camera moves (`-- --demo --demo-columns`, the phone's shape): the two fighters near the
## east of the courtyard, the Samurai facing its middle, so the camera behind him sweeps past the neighbouring columns
## as a second finger turns it one way, then slowly the other, then back — first with the fading off, then the same
## move with it on. At the end the log lists each column's fading and return (when) and the shortest time it held
## either way (a flicker shows as a very short one).
const SCRIPT_COLUMNS := [
	[0.2, "spar", false],
	[0.2, "fade", false],
	[0.2, "place", Vector2(5.5, 0.0), -90.0, Vector2(3.0, 0.0)],
	[0.3, "caption", "The camera passing the columns — the fading OFF", 3.0],
	[1.0, "drag", Vector2(-130, 0), 1.4],
	[2.8, "drag", Vector2(260, 0), 4.6],
	[7.8, "drag", Vector2(-130, 0), 1.2],
	[9.6, "fade", true],
	[9.6, "place", Vector2(5.5, 0.0), -90.0, Vector2(3.0, 0.0)],
	[9.7, "caption", "The same move — the fading ON (25 %)", 3.0],
	[10.4, "drag", Vector2(-130, 0), 1.4],
	[12.2, "drag", Vector2(260, 0), 4.6],
	[17.2, "drag", Vector2(-130, 0), 1.2],
	[19.0, "end"],
]

var touch: TouchControls
var combat: CombatController
var player: Fighter
var rig: CameraRig
var automaton: TrainingAutomaton
var caption: Callable
var fader: OcclusionFader ## (the columns' script: their fading's timeline)
var _fades := {} ## column group → [fading now, times faded, times back, s since its last change, shortest hold]
var _fade_log: Array[String] = []
var _t := 0.0
var _i := 0
var _stick_down := false
var _drag := {} ## the camera finger: from, to, start, length
var _goal := Vector3.INF
var _push := 0.0
var _point_left := 0.0 ## the light push toward a direction: time left
var _point_dir := Vector3.ZERO
var _wait := {} ## a button to tap once it shows: key, delay, since (when it appeared), limit
var _on_attack: Array[Dictionary] = [] ## taps (key) or stick pushes (stick) at a moment of the automaton's attack: at
var _attack_left := 0.0 ## an "attack" still trying (s)
var _approach := {} ## walking in to the automaton: d, push
var _script: Array = SCRIPT_D
var _mash := {} ## n, from (strikes then), next (s to the next tap allowed)
var _after: Array = [] ## the mash's after-steps: [delay, step]
var _deferred: Array = [] ## [time, step]
var _watch: Array[Dictionary] = [] ## when_cond / when_action: kind, id, at, step, since, limit
var _home := Vector3.INF ## the automaton's mark
var _loop := false
var _named := "" ## the script chosen by use() (else the command line's)


## Run the script `name` ("m4", "c", "d"), looped when `loop` (before it joins the tree).
func use(name_: String, loop: bool = false) -> void:
	_named = name_
	_loop = loop


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if _named == "c" or (_named == "" and "--demo-c" in args):
		_script = SCRIPT_C
	elif _named == "m4" or (_named == "" and ("--demo-m4" in args or "--demo-side" in args)):
		_script = SCRIPT_M4
	elif _named == "feel" or (_named == "" and "--demo-feel" in args):
		_script = FEEL_PRELUDE + shifted(SCRIPT_M4, FEEL_REVIEW_AT)
	elif _named == "explore" or (_named == "" and "--demo-explore" in args):
		_script = SCRIPT_EXPLORE
	elif _named == "columns" or (_named == "" and "--demo-columns" in args):
		_script = SCRIPT_COLUMNS


## A script's steps `by` s later (their own nested steps keep their relative delays).
static func shifted(script: Array, by: float) -> Array:
	var out := []
	for st: Array in script:
		var c := st.duplicate()
		c[0] = float(c[0]) + by
		out.append(c)
	return out


func _physics_process(delta: float) -> void:
	_t += delta
	if _home == Vector3.INF and automaton:
		_home = automaton.global_position
	while _i < _script.size() and _t >= float(_script[_i][0]):
		_run(_script[_i])
		_i += 1
	_tick_mash(delta)
	_tick_watch(delta)
	if fader and _script == SCRIPT_COLUMNS:
		_tick_fades(delta)
	for i in range(_deferred.size() - 1, -1, -1):
		if _t >= float(_deferred[i][0]):
			var st: Array = _deferred[i][1]
			_deferred.remove_at(i)
			_run(st)
	if _goal != Vector3.INF:
		var to := _goal - player.global_position
		to.y = 0.0
		if to.length() < 0.8:
			_goal = Vector3.INF
			_stick(Vector2.ZERO, false)
		else:
			# the stick push that moves him toward the goal from this camera (controller: dir = basis * (x, 0, -y))
			var local := rig.ground_basis().inverse() * to.normalized()
			_stick(Vector2(local.x, -local.z).normalized() * _push, true)
	if _point_left > 0.0:
		_point_left -= delta
		if _point_left <= 0.0:
			_stick(Vector2.ZERO, false)
		else:
			var local := rig.ground_basis().inverse() * _point_dir
			_stick(Vector2(local.x, -local.z).normalized() * 0.25, true)
	if _attack_left > 0.0:
		_attack_left -= delta
		if automaton and automaton.attack():
			_attack_left = 0.0
	for i in range(_on_attack.size() - 1, -1, -1):
		if automaton and automaton.attack_time() >= float(_on_attack[i]["at"]):
			var e: Dictionary = _on_attack[i]
			_on_attack.remove_at(i)
			if e.has("stick"):
				_goal = Vector3.INF
				var v: Vector2 = e["stick"]
				_stick(v, v != Vector2.ZERO) # (a zero push lifts the thumb)
			else:
				_tap(String(e["key"]))
	if not _approach.is_empty() and automaton:
		var to := automaton.global_position - player.global_position
		to.y = 0.0
		if to.length() <= float(_approach["d"]):
			_approach = {}
			_stick(Vector2.ZERO, false)
		else:
			var local := rig.ground_basis().inverse() * to.normalized()
			_stick(Vector2(local.x, -local.z).normalized() * float(_approach["push"]), true)
	if not _wait.is_empty():
		_wait["limit"] = float(_wait["limit"]) - delta
		if touch.is_shown(String(_wait["key"])):
			_wait["since"] = float(_wait["since"]) + delta
			if float(_wait["since"]) >= float(_wait["delay"]):
				_tap(String(_wait["key"]))
				_wait.clear()
		if not _wait.is_empty() and float(_wait["limit"]) <= 0.0:
			_wait.clear()
	if not _drag.is_empty():
		var k := clampf((_t - float(_drag["start"])) / float(_drag["length"]), 0.0, 1.0)
		var p: Vector2 = (_drag["from"] as Vector2).lerp(_drag["to"], k)
		var d := InputEventScreenDrag.new()
		d.index = 1
		d.position = _window(p)
		d.relative = _window_delta(p - (_drag["last"] as Vector2))
		_drag["last"] = p
		Input.parse_input_event(d)
		if k >= 1.0:
			_touch(1, p, false)
			_drag.clear()


func _run(step: Array) -> void:
	match String(step[1]):
		"go":
			var g: Vector2 = step[2]
			_goal = Vector3(g.x, 0.0, g.y)
			_push = float(step[3])
		"stick":
			_goal = Vector3.INF
			_stick(step[2], true)
		"stick_up":
			_goal = Vector3.INF
			_stick(Vector2.ZERO, false)
		"approach":
			_goal = Vector3.INF
			_approach = {"d": float(step[2]), "push": float(step[3])}
		"attack":
			_attack_left = 2.0
		"tap_on_attack":
			_on_attack.append({"key": String(step[2]), "at": float(step[3])})
		"stick_on_attack":
			_on_attack.append({"stick": step[2] as Vector2, "at": float(step[3])})
		"spar":
			if automaton:
				automaton.spar = bool(step[2])
		"tap":
			_tap(String(step[2]))
		"tap_shown":
			_wait = {"key": String(step[2]), "delay": float(step[3]), "since": 0.0, "limit": 2.0}
		"point":
			var d: Vector2 = step[2]
			_goal = Vector3.INF
			_point_dir = Vector3(d.x, 0.0, d.y).normalized()
			_point_left = float(step[3])
		"drag":
			var from := Vector2(touch.size.x * 0.42, touch.size.y * 0.32)
			_touch(1, from, true)
			_drag = {"from": from, "to": from + (step[2] as Vector2), "start": _t, "length": float(step[3]), "last": from}
		"caption":
			if caption.is_valid():
				caption.call(String(step[2]), float(step[3]))
		"slowmo":
			Engine.time_scale = float(step[2])
		"mash":
			_mash = {"n": int(step[2]), "from": int(combat.stats["strikes"]), "next": 0.0}
			_after = []
		"after_mash":
			_after.append([float(step[2]), step[3]])
		"when_cond", "when_action":
			_watch.append({"kind": String(step[1]), "id": String(step[2]), "at": float(step[3]), "step": step[4],
				"since": 0.0, "limit": 6.0})
		"reset":
			if automaton and _home != Vector3.INF:
				automaton.place(_home)
				var to := player.global_position - _home
				automaton.facing = atan2(to.x, to.z)
				automaton.heal()
		"auto_away", "auto_side":
			if automaton:
				var dir := automaton.global_position - player.global_position
				dir.y = 0.0
				dir = dir.normalized() if dir.length() > 0.01 else -player.forward()
				if String(step[1]) == "auto_away":
					automaton.place(player.global_position + dir * float(step[2]))
				else:
					automaton.place(automaton.global_position + Vector3(dir.z, 0.0, -dir.x) * float(step[2]))
				automaton.facing = atan2(-dir.x, -dir.z)
		"behind":
			rig.snap_behind(player.facing)
		"expvar":
			CameraRig.explore = String(step[2])
		"fade":
			OcclusionFader.enabled = bool(step[2])
		"place":
			var at: Vector2 = step[2]
			player.global_position = Vector3(at.x, 0.0, at.y)
			player.velocity = Vector3.ZERO
			player.facing = deg_to_rad(float(step[3]))
			if automaton:
				var au: Vector2 = step[4]
				automaton.place(Vector3(au.x, 0.0, au.y))
				var to := player.global_position - automaton.global_position
				automaton.facing = atan2(to.x, to.z)
			rig.snap_behind(player.facing)
			rig.settle()
		"end":
			if not _fades.is_empty():
				_report_fades()
			Engine.time_scale = 1.0
			if _loop:
				_again()
			else:
				get_tree().quit()


## (Looped) the script from its start, wherever he stands now; the automaton put back on its mark, whole, once it has
## risen from its defeat (it rises 2.6 s after it).
func _again() -> void:
	_t = 0.0
	_i = 0
	_goal = Vector3.INF
	_point_left = 0.0
	_wait = {}
	_on_attack.clear()
	_attack_left = 0.0
	_approach = {}
	_mash = {}
	_after = []
	_watch.clear()
	_deferred = [[3.0, [3.0, "reset"]]]
	_stick(Vector2.ZERO, false)


## The mash: Attack tapped when a strike would take it — free (it starts one) or while one cuts or recovers with none
## held yet (the chain holds it for the next) — never in a startup (it would wait in the input buffer and come late),
## and never one strike too many; then, once the last has ended, its after-steps.
func _tick_mash(delta: float) -> void:
	if _mash.is_empty() or combat == null:
		return
	_mash["next"] = float(_mash["next"]) - delta
	var m := combat.melee
	var started := int(combat.stats["strikes"]) - int(_mash["from"])
	var asked := started + (1 if m.queued else 0)
	if asked < int(_mash["n"]):
		var takes := m.phase == MeleeState.Phase.FREE or ((m.phase == MeleeState.Phase.ACTIVE \
			or m.phase == MeleeState.Phase.RECOVERY) and not m.queued)
		if takes and float(_mash["next"]) <= 0.0:
			_tap("attack")
			_mash["next"] = 0.16 # (the tap's release first)
	elif started >= int(_mash["n"]) and m.phase == MeleeState.Phase.FREE:
		for e in _after:
			_deferred.append([_t + float(e[0]), e[1]])
		_after = []
		_mash = {}


## when_cond: an opportunity for `id` on a button for `at` s; when_action: his action `id` has run `at` s.
func _tick_watch(delta: float) -> void:
	if combat == null:
		return
	for i in range(_watch.size() - 1, -1, -1):
		var w := _watch[i]
		w["limit"] = float(w["limit"]) - delta
		var ready := false
		if String(w["kind"]) == "when_cond":
			var shown := false
			for o in combat.conditionals()["slots"]:
				shown = shown or String((o as Dictionary).get("ability", "")) == String(w["id"])
			if shown:
				w["since"] = float(w["since"]) + delta
				ready = float(w["since"]) >= float(w["at"])
		else:
			var a := combat.melee.current()
			ready = a != null and a.id == String(w["id"]) and combat.melee.is_attacking() \
				and combat.melee.elapsed() >= float(w["at"])
		if ready:
			_watch.remove_at(i)
			_run(w["step"])
		elif float(w["limit"]) <= 0.0:
			_watch.remove_at(i)


## A short tap on a button (a second finger: the stick's thumb may stay down).
func _tap(key: String) -> void:
	var b: Dictionary = touch._btn[key]
	_touch(2, b["c"], true)
	create_tween().tween_callback(_touch.bind(2, b["c"], false)).set_delay(0.12) # (gone with the driver if the arena is rebuilt)


## The thumb on the stick: pushed by v (x right, y up, 0..1), or lifted.
func _stick(v: Vector2, down: bool) -> void:
	var stick: Dictionary = touch._btn["stick"]
	var c: Vector2 = stick["c"]
	var r: float = stick["r_hit"]
	if not down:
		if _stick_down:
			_touch(0, c, false)
			_stick_down = false
		return
	if not _stick_down:
		_touch(0, c, true)
		_stick_down = true
	var p := c + Vector2(v.x, -v.y) * r
	var d := InputEventScreenDrag.new()
	d.index = 0
	d.position = _window(p)
	d.relative = _window_delta(p - c)
	Input.parse_input_event(d)


func _touch(index: int, p: Vector2, pressed: bool) -> void:
	var e := InputEventScreenTouch.new()
	e.index = index
	e.position = _window(p)
	e.pressed = pressed
	Input.parse_input_event(e)


## A point of the canvas (the touch controls' coordinates) in the window's, where input events arrive.
func _window(p: Vector2) -> Vector2:
	return get_viewport().get_final_transform() * p


func _window_delta(v: Vector2) -> Vector2:
	return get_viewport().get_final_transform().basis_xform(v)


## (The columns' script) each column group's fading: when it starts fading or coming back, and how long it held.
func _tick_fades(delta: float) -> void:
	var alphas: Array = fader.info()["alphas"]
	for i in alphas.size():
		var f: Array = _fades.get(i, [false, 0, 0, 0.0, INF])
		f[3] = float(f[3]) + delta
		var now := float(alphas[i]) < 0.999
		if now != bool(f[0]):
			_fade_log.append("%.2f s: group %d %s" % [_t, i, "fades" if now else "comes back"])
			if int(f[1]) + int(f[2]) > 0:
				f[4] = minf(float(f[4]), float(f[3]))
			f[0] = now
			if now:
				f[1] = int(f[1]) + 1
			else:
				f[2] = int(f[2]) + 1
			f[3] = 0.0
		_fades[i] = f


func _report_fades() -> void:
	var changed := 0
	for i: int in _fades:
		var f: Array = _fades[i]
		if int(f[1]) + int(f[2]) > 0:
			changed += 1
			print("[COLUMNS] group %d: faded %d times, back %d times, shortest hold %s s" % [i, f[1], f[2],
				"%.2f" % float(f[4]) if float(f[4]) < INF else "-"])
	print("[COLUMNS] groups that changed: %d of %d" % [changed, _fades.size()])
	for line in _fade_log:
		print("[COLUMNS] " + line)
