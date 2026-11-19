class_name TrainingAutomaton
extends CharacterBody3D
## The Training Automaton (M4, GPT's v1.2 decision): a humanoid sparring construct of lacquered wood, bronze and stone
## (AutomatonVisual) — the courtyard's opponent for the Samurai's skills. 150 HP; a small target the Phantom Chain can
## capture and pull and Rising Slash can launch (data/targets.json). In M4 it does not chase or attack (its telegraphed
## attacks come with Shadow Counter, Stage C): it stands on its mark facing the Samurai, and each reaction is a state of
## its own on the fixed tick, moved with collision — nothing it does passes through the ruins:
##   stand — on guard (Sword_Idle), turning to face the Samurai;
##   stagger — a confirmed blow: a flinch (Hit_Chest, Hit_Head) or, for a pushing blow, a stagger back
##     (Idle_Shield_Break) and a 0.5 m push over 0.2 s, stopped by whatever it backs into;
##   captured — held by the chain: no movement and no action for the hold (repeated captures hold it less, then not
##     at all — diminishing returns, then immunity);
##   pulled — dragged straight toward a point over a set time: it stops where something solid blocks it ("blocked")
##     or reaches the point ("arrived");
##   air — launched: it rises to the launch's height and falls along the exact arc (the same at any tick rate); a
##     ceiling stops the rise and it falls from there. Blows in the air count toward the juggle cap (3 follow-ups or
##     1.5 s in the air), after which it cannot be launched again until it is back on its feet;
##   down → getup — it lands on its back (Hit_Knockback), lies a moment and rises (LayToIdle);
##   defeated — at 0 HP it collapses (Death01) and, 2.6 s later, rises again whole.
## Through hit-stop it holds still, pose and all. After 4 s without a blow it walks back to its mark when it was moved
## more than a metre from it.

signal hp_changed(hp: int, max_hp: int)
signal defeated
## A pull ended: "arrived" (it reached the point) or "blocked" (something solid stopped it on the way).
signal pull_finished(result: String)
## It came down from a launch after `airtime` s in the air.
signal landed(airtime: float)

const RADIUS := 0.3
const HEIGHT := 1.8
const LIFT := 0.03 ## the collision capsule floats this far above the floor, so moving along it never rubs the flagstones
const PUSH_TIME := 0.2
const FLASH_TIME := 0.1
const WALK_SPEED := 1.3
const DOWN_HEIGHT := 0.55 ## the hurt capsule's height while it lies on the floor

## What it is and resists (data/targets.json).
var target_data := TargetData.of("training_automaton")
var max_hp := 150
var hp := 150
## The upright capsule the katana's sweep tests (for every target in the "hurtbox" group) — lower while it lies down.
var hurt_radius := RADIUS
var hurt_height := HEIGHT
## Where it stood when this tick began: the sweep tests the blade against its movement through the tick, not only
## where it ended up, so a body moving fast cannot slip through a cut between two ticks.
var prev_position := Vector3.ZERO
var visual: AutomatonVisual
var facing := 0.0 ## yaw in radians; the model faces +Z at 0
## Whom it keeps facing (the Samurai).
var watch: Node3D
## stand | walk | stagger | captured | pulled | air | down | getup | defeated
var state := "stand"
var numbers := DamageNumbers.new()
## For the tests and the report: the last launch's highest point (m) and time in the air (s), the last push's distance,
## the last pull ({result, dist, time}) and the counts so far.
var last_apex := 0.0
var last_airtime := 0.0
var last_push := 0.0
var last_pull := {}
var pushes := 0
var captures := 0
var launches := 0

var _home := Vector3.ZERO
var _t := 0.0 ## time in the current state
var _clock := 0.0
var _since_hit := 100.0
var _freeze := 0.0
var _flash := 0.0
var _anim_speed := 1.0
var _stuck := 0.0
var _hold := 0.0 ## the capture's time left
var _stagger := 0.0
var _turn_to := Vector3.ZERO ## a reaction turns it toward its attacker
var _push_dir := Vector3.ZERO
var _push_dist := 0.0
var _push_left := 0.0
var _push_from := Vector3.ZERO
var _pull_from := Vector3.ZERO
var _pull_to := Vector3.ZERO
var _pull_t := 0.0
var _pull_time := 0.3
## The launch's arc — y(t) = y0 + v0·(t − t0) − g·(t − t0)²/2 on the air clock — exact at any tick rate.
var _air_t := 0.0
var _air_planned := 0.9
var _arc_t0 := 0.0
var _arc_y0 := 0.0
var _arc_v0 := 0.0
var _arc_g := 24.0
var _juggle_hits := 0
var _protected := false ## the juggle cap was reached: no launch until it is back on its feet
var _captures_n := 0 ## captures in the current diminishing-returns run
var _last_capture := -1000.0


static func create() -> TrainingAutomaton:
	var a := TrainingAutomaton.new()
	a.name = "TrainingAutomaton"
	a.max_hp = int(a.target_data.get("hp", 150))
	a.hp = a.max_hp
	a.collision_layer = 4 # (the target's layer: the Samurai's body stops against it)
	a.collision_mask = 1 | 2 | 4 | 8 # the world, the Samurai, the other target, the courtyard's bounds
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = RADIUS
	cap.height = HEIGHT - LIFT
	shape.shape = cap
	shape.position = Vector3(0, LIFT + (HEIGHT - LIFT) * 0.5, 0)
	a.add_child(shape)
	a.visual = AutomatonVisual.build_new()
	a.add_child(a.visual)
	return a


func _ready() -> void:
	_home = position
	prev_position = global_position
	add_to_group("hurtbox")
	process_physics_priority = -15 # before the player's controller (-10), whose combat tick tests the blade against it
	visual.rotation.y = facing
	_play("Sword_Idle", 0.0)


## Stand it at `p` (in the tree), and make that its mark.
func place(p: Vector3) -> void:
	global_position = p
	prev_position = p
	_home = p


func is_alive() -> bool:
	return hp > 0


func is_airborne() -> bool:
	return state == "air"


func is_captured() -> bool:
	return state == "captured"


## Where it will be `t` s from now if nothing stops it (its launch arc while in the air; where it stands otherwise).
func predict(t: float) -> Vector3:
	var p := global_position
	if state != "air":
		return p
	var tt := _air_t + t - _arc_t0
	p.y = maxf(0.0, _arc_y0 + _arc_v0 * tt - 0.5 * _arc_g * tt * tt)
	return p


func juggle_protected() -> bool:
	return _protected


func forward() -> Vector3:
	return Vector3(sin(facing), 0.0, cos(facing))


func _physics_process(delta: float) -> void:
	step(delta)


## One fixed tick (the tests call it directly).
func step(dt: float) -> void:
	prev_position = global_position
	_clock += dt
	if _freeze > 0.0:
		# hit-stop: everything holds — the move, the pose, the flash
		_freeze -= dt
		if visual.anim:
			visual.anim.speed_scale = 0.0
		return
	if visual.anim:
		visual.anim.speed_scale = _anim_speed
	_flash = maxf(0.0, _flash - dt)
	visual.set_flash(clampf(_flash / 0.06, 0.0, 1.0))
	numbers.advance(dt)
	_t += dt
	_since_hit += dt
	match state:
		"stand":
			_do_stand(dt)
		"walk":
			_do_walk(dt)
		"stagger":
			_do_stagger(dt)
		"captured":
			_do_captured(dt)
		"pulled":
			_do_pulled(dt)
		"air":
			_do_air(dt)
		"down":
			_do_down()
		"getup":
			_do_getup()
		"defeated":
			_do_defeated()
	visual.rotation.y = facing


## A confirmed blow: `damage`, reeling for `reaction` s, pushed `push` m along `dir` (flat, from the attacker). In the
## air, lying, rising or held it keeps its course — the blow lands without a new reaction (in the air it counts
## toward the juggle cap).
func take_hit(damage: int, reaction: float, push: float, dir: Vector3, _sway: Vector3 = Vector3.ZERO) -> void:
	if not is_alive():
		return
	hp = maxi(0, hp - damage)
	hp_changed.emit(hp, max_hp)
	_flash = FLASH_TIME
	visual.set_flash(1.0)
	_since_hit = 0.0
	numbers.spawn(self, damage)
	QA.flag("automaton_hit", "%d:%d" % [damage, hp])
	dir.y = 0.0
	dir = dir.normalized() if dir.length() > 0.01 else -forward()
	match state:
		"air":
			_juggle_hits += 1
		"down", "getup", "captured", "pulled":
			pass
		_:
			if hp > 0:
				_react(reaction, push, dir)
	if hp == 0 and state != "air" and state != "down":
		_defeat() # (a body in the air comes down first)


## Hold still for `t` s (hit-stop).
func freeze_for(t: float) -> void:
	_freeze = maxf(_freeze, t)


## (QA) end a hold early (an inspection shot's long freeze).
func thaw() -> void:
	_freeze = 0.0


func can_capture() -> bool:
	return is_alive() and bool(target_data.get("pullable", false)) and state in ["stand", "walk", "stagger"]


## The Phantom Chain caught it: held still — no movement, no action — for `seconds`, less for a capture soon after
## another (diminishing returns), not at all while it is immune. Returns how long it is held (0: not captured).
func capture(seconds: float) -> float:
	if not can_capture():
		return 0.0
	var c: Dictionary = target_data.get("capture", {})
	var dr: Array = c.get("dr", [1.0])
	if _clock - _last_capture > float(c.get("reset", 12.0)):
		_captures_n = 0
	var factor := float(dr[_captures_n]) if _captures_n < dr.size() else 0.0
	if factor <= 0.0:
		QA.flag("automaton_capture_immune", true)
		return 0.0
	_captures_n += 1
	_last_capture = _clock
	_hold = seconds * factor
	captures += 1
	_enter("captured")
	QA.flag("automaton_captured", snappedf(_hold, 0.001))
	return _hold


## Let go of it (the chain broke: its holder was interrupted).
func release() -> void:
	if state == "captured":
		_enter("stand")


## Chain Pull: dragged straight to `point` over `seconds` — only while it is held. False when it is not.
func pull_to(point: Vector3, seconds: float) -> bool:
	if state != "captured":
		return false
	_pull_from = global_position
	_pull_to = Vector3(point.x, global_position.y, point.z)
	_pull_time = maxf(seconds, 0.05)
	_pull_t = 0.0
	_enter("pulled")
	return true


func can_launch() -> bool:
	return is_alive() and bool(target_data.get("launchable", false)) and not _protected \
		and state in ["stand", "walk", "stagger", "captured", "pulled"]


## Rising Slash: thrown straight up `height` m, back on the floor `airtime` s later (unless something above stops it).
func launch(height: float, airtime: float) -> bool:
	if not can_launch():
		return false
	_air_planned = maxf(airtime, 0.1)
	_arc_g = 8.0 * height / (_air_planned * _air_planned)
	_arc_v0 = 4.0 * height / _air_planned
	_arc_t0 = 0.0
	_arc_y0 = global_position.y
	_air_t = 0.0
	_juggle_hits = 0
	last_apex = global_position.y
	launches += 1
	_enter("air")
	_anim_speed = 1.0
	visual.pose("Hit_Knockback", 0.13, 0.06)
	QA.flag("automaton_launched", launches)
	return true


func _do_stand(dt: float) -> void:
	if watch and is_instance_valid(watch):
		_turn_toward(watch.global_position - global_position, 5.0, dt)
	if visual.current != "Sword_Idle":
		_play("Sword_Idle", 0.25)
	if _since_hit > float(target_data.get("return_after", 4.0)) and _flat(_home - global_position).length() > 1.0:
		_stuck = 0.0
		_enter("walk")


## Back to its mark at a walk; it gives up (and tries again later) if something keeps it from getting closer.
func _do_walk(dt: float) -> void:
	var away := _flat(_home - global_position)
	if away.length() < 0.06:
		_enter("stand")
		return
	_turn_toward(away, 8.0, dt)
	if visual.current != "Walk_Loop":
		_play("Walk_Loop", 0.2, WALK_SPEED / 1.6)
	var before := away.length()
	_move(away.normalized() * minf(WALK_SPEED * dt, before), true)
	_stuck = _stuck + dt if _flat(_home - global_position).length() > before - WALK_SPEED * dt * 0.3 else 0.0
	if _stuck > 1.0:
		_since_hit = 0.0
		_enter("stand")


func _do_stagger(dt: float) -> void:
	if _turn_to != Vector3.ZERO:
		_turn_toward(_turn_to, 20.0, dt)
	if _push_left > 0.0:
		var k0 := 1.0 - _push_left / PUSH_TIME
		_push_left = maxf(0.0, _push_left - dt)
		var k1 := 1.0 - _push_left / PUSH_TIME
		var blocked := _move(_push_dir * _push_dist * (_ease3(k1) - _ease3(k0)))
		if blocked or _push_left <= 0.0:
			_push_left = 0.0
			last_push = _flat(global_position - _push_from).length()
			pushes += 1
			QA.flag("automaton_pushed", snappedf(last_push, 0.01))
	if _t >= _stagger and _push_left <= 0.0:
		_enter("stand")


func _do_captured(dt: float) -> void:
	_hold -= dt
	if watch and is_instance_valid(watch):
		_turn_toward(watch.global_position - global_position, 10.0, dt)
	visual.pose("Idle_Shield_Break", 0.2 + 0.025 * sin(_clock * 38.0)) # straining against the chain
	_anim_speed = 1.0
	if _hold <= 0.0:
		QA.flag("automaton_released", true)
		_enter("stand")


func _do_pulled(dt: float) -> void:
	_pull_t += dt
	var k := clampf(_pull_t / _pull_time, 0.0, 1.0)
	var want := _pull_from.lerp(_pull_to, 1.0 - (1.0 - k) * (1.0 - k)) # a yank that eases into its end
	visual.pose("Idle_Shield_Break", 0.16)
	_anim_speed = 1.0
	if _move(_flat(want - global_position)):
		_end_pull("blocked")
	elif k >= 1.0:
		_end_pull("arrived")


func _end_pull(result: String) -> void:
	var dist := _flat(global_position - _pull_from).length()
	last_pull = {"result": result, "dist": snappedf(dist, 0.01), "time": snappedf(_pull_t, 0.001)}
	QA.flag("automaton_pull", "%s:%.2f" % [result, dist])
	_enter("stagger") # a stumble where it ends up
	_stagger = 0.3
	_push_left = 0.0
	_turn_to = Vector3.ZERO
	_play("Hit_Chest", 0.06, 1.2, 0.03)
	pull_finished.emit(result)


func _do_air(dt: float) -> void:
	_air_t += dt
	if not _protected:
		var j: Dictionary = target_data.get("juggle", {})
		if _juggle_hits >= int(j.get("max_hits", 3)) or _air_t >= float(j.get("max_time", 1.5)):
			_protected = true
			QA.flag("automaton_juggle_protected", _juggle_hits)
	var tt := _air_t - _arc_t0
	var y_next := _arc_y0 + _arc_v0 * tt - 0.5 * _arc_g * tt * tt
	var floor_reached := y_next <= 0.0
	var dy := (0.0 if floor_reached else y_next) - global_position.y
	if absf(dy) > 0.00001:
		var c := move_and_collide(Vector3(0.0, dy, 0.0))
		if c:
			var n := c.get_normal()
			if n.y > 0.7:
				_land() # it came down on something
				return
			if n.y < -0.3:
				# a ceiling: the rise stops there and it falls from rest
				_arc_t0 = _air_t
				_arc_y0 = global_position.y
				_arc_v0 = 0.0
				floor_reached = false
				QA.flag("automaton_ceiling", snappedf(global_position.y, 0.01))
	last_apex = maxf(last_apex, global_position.y)
	if floor_reached:
		global_position.y = 0.0
		_land()
		return
	# the thrown pose: leaning back as it rises, laid out as it falls
	visual.pose("Hit_Knockback", lerpf(0.13, 0.25, clampf(_air_t / _air_planned, 0.0, 1.0)))
	_anim_speed = 1.0


func _land() -> void:
	last_airtime = _air_t
	_enter("down")
	_play("Hit_Knockback", 0.08, 1.0, 0.27) # onto its back
	QA.flag("automaton_landed", "%.3f:%.2f" % [_air_t, last_apex])
	landed.emit(_air_t)


func _do_down() -> void:
	if hp <= 0:
		_defeat()
		return
	if _t >= float(target_data.get("down", 0.8)):
		_rise(0.15)


func _rise(blend: float) -> void:
	_enter("getup")
	_play("LayToIdle", blend, visual.duration("LayToIdle") / maxf(0.2, float(target_data.get("getup", 1.22))))


func _do_getup() -> void:
	if _t >= float(target_data.get("getup", 1.22)):
		_protected = false
		_juggle_hits = 0
		_enter("stand")


func _defeat() -> void:
	_enter("defeated")
	_hold = 0.0
	_push_left = 0.0
	_play("Death01", 0.12)
	QA.flag("automaton_defeated", true)
	defeated.emit()


func _do_defeated() -> void:
	if _t >= float(target_data.get("defeat_reset", 2.6)):
		hp = max_hp
		_protected = false
		_juggle_hits = 0
		hp_changed.emit(hp, max_hp)
		QA.flag("automaton_reset", true)
		_rise(0.3)


## A flinch for a light blow, a harder one for a medium blow, a stagger back (and the push) for a pushing blow.
func _react(reaction: float, push: float, dir: Vector3) -> void:
	_turn_to = -dir
	var move := "Hit_Chest"
	var speed := 1.25
	var from := 0.03
	if push > 0.0 or reaction >= 0.18:
		move = "Idle_Shield_Break"
		speed = 1.3
		from = 0.0
	elif reaction >= 0.1:
		move = "Hit_Head"
		speed = 1.2
		from = 0.04
	_enter("stagger")
	_stagger = maxf(reaction, (visual.duration(move) - from) / speed - 0.06)
	_play(move, 0.05, speed, from)
	_push_left = 0.0
	if push > 0.0:
		_push_dir = dir
		_push_dist = push
		_push_left = PUSH_TIME
		_push_from = global_position


func _enter(s: String) -> void:
	if s != state:
		QA.flag("automaton_state", s)
	state = s
	_t = 0.0
	hurt_height = DOWN_HEIGHT if s == "down" or s == "defeated" else HEIGHT


func _play(move: String, blend: float, speed: float = 1.0, from: float = 0.0) -> void:
	_anim_speed = speed
	visual.play(move, blend, speed, true, from)


## Move by `motion` with collision; true when something solid stopped it. With `slide` the rest of the motion slides
## along what it touched (walking); without, it stops there (a push, a pull).
func _move(motion: Vector3, slide: bool = false) -> bool:
	if motion.length_squared() < 1e-10:
		return false
	var c := move_and_collide(motion)
	if c == null:
		return false
	if slide:
		var rest := c.get_remainder().slide(c.get_normal())
		rest.y = 0.0
		if rest.length_squared() > 1e-10:
			move_and_collide(rest)
	return true


func _turn_toward(d: Vector3, rate: float, dt: float) -> void:
	if Vector2(d.x, d.z).length() < 0.05:
		return
	var want := atan2(d.x, d.z)
	facing += clampf(wrapf(want - facing, -PI, PI), -rate * dt, rate * dt)


## For the QA bridge.
func info() -> Dictionary:
	var p := global_position
	return {"hp": hp, "alive": is_alive(), "state": state, "pos": [snappedf(p.x, 0.01), snappedf(p.y, 0.01),
		snappedf(p.z, 0.01)], "facing": snappedf(rad_to_deg(facing), 0.1), "anim": visual.current,
		"off_mark": snappedf(_flat(_home - p).length(), 0.01), "apex": snappedf(last_apex, 0.01),
		"airtime": snappedf(last_airtime, 0.001), "juggle_hits": _juggle_hits, "protected": _protected,
		"hold": snappedf(maxf(_hold, 0.0), 0.001), "pull": last_pull, "last_push": snappedf(last_push, 0.01),
		"pushes": pushes, "captures": captures, "launches": launches, "frozen": _freeze > 0.0}


static func _ease3(k: float) -> float:
	return 1.0 - pow(1.0 - k, 3.0)


static func _flat(v: Vector3) -> Vector3:
	return Vector3(v.x, 0.0, v.z)
