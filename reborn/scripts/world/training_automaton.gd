class_name TrainingAutomaton
extends CharacterBody3D
## The Training Automaton (M4, GPT's v1.2 decision): a humanoid sparring construct of lacquered wood, bronze and stone
## (AutomatonVisual) — the courtyard's opponent for the Samurai's skills. 150 HP; a small target the Phantom Chain can
## capture and pull and Rising Slash can launch (data/targets.json). It never chases; it stands on its mark facing the
## Samurai and spars with him (Stage C: a scripted training attacker, no full AI) — and each reaction is a state of
## its own on the fixed tick, moved with collision — nothing it does passes through the ruins:
##   stand — on guard (Sword_Idle), turning to face the Samurai; when he stands within 3 m in front of it, a second
##     after the last blow it took and no sooner than its cadence allows, it attacks;
##   attack — its telegraphed sweep (data/abilities/automaton.json, run through the same combat state machine as the
##     Samurai's actions): through the 550 ms startup it raises its practice sword and holds it, trembling, as the
##     sword and its eyes kindle amber and a faint amber arc on the flagstones marks where the cut will pass; it keeps
##     turning toward him until 300 ms in, then its direction is locked; it steps 0.3 m into the 130 ms cut (with
##     collision), whose blade — its baked path — is resolved against him each tick after he has moved (his
##     CombatController: hit, evaded through Shadow Step's defensive window, avoided by a roll, or nothing); then 400 ms
##     of recovery, open to his counter. A blow it takes cuts the attack off (it flinches as ever);
##   stagger — a confirmed blow: a flinch (Hit_Chest, Hit_Head) or, for a pushing blow, a stagger back
##     (Idle_Shield_Break) and a 0.5 m push over 0.2 s, stopped by whatever it backs into;
##   captured — held by the chain: no movement and no action for the hold (repeated captures hold it less, then not
##     at all — diminishing returns, then immunity);
##   pulled — dragged straight toward a point over a set time: it stops where something solid blocks it ("blocked")
##     or reaches the point ("arrived");
##   air — launched: it rises to the launch's height and falls along the exact arc (the same at any tick rate); a
##     ceiling stops the rise and it falls from there. Blows in the air count toward the juggle cap (3 follow-ups or
##     1.5 s in the air), after which it cannot be launched again until it is back on its feet. Aerial Pursuit's
##     confirmed blow spikes it: an accelerating descent, with collision, capped at 10 m/s, onto the floor — a compact
##     impact (dust, a jolt; no damage of its own);
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
## A spiked body struck the floor at `at`.
signal impacted(at: Vector3)
## Its attack began; its cut began; it was resolved against its foe: "hit" | "evaded" | "avoided" | "missed" (nothing
## touched him) | "interrupted" (a blow, a capture… cut it off first).
signal attack_started
signal attack_active
signal attack_resolved(result: String)

const RADIUS := 0.3
const HEIGHT := 1.8
const LIFT := 0.03 ## the collision capsule floats this far above the floor, so moving along it never rubs the flagstones
const PUSH_TIME := 0.2
const FLASH_TIME := 0.1
const WALK_SPEED := 1.3
const DOWN_HEIGHT := 0.55 ## the hurt capsule's height while it lies on the floor
const LUNGE_LEAD := 0.1 ## its step into the cut begins this long before the cut

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
## The Samurai's combat — whom it spars with: its blows are resolved against him (his body, his defensive windows).
var foe: CombatController
## Its sparring script is on: it attacks its foe when he stands in reach (off: it only stands and reacts, as in Stage B).
var spar := true
## Its attack (data/abilities/automaton.json), run through its own combat state machine.
var attack_data: AttackData
var attacks := 0
## How its last attack ended against its foe (see attack_resolved).
var last_attack := ""
## The telegraph's strength now (0..1; 1 through the cut) — the sword's and eyes' kindling, the arc on the floor.
var telegraph := 0.0
## The arc on the flagstones where the cut will pass.
var arc: TelegraphArc

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
## A spike (Aerial Pursuit): falling at `_spike_v` m/s, accelerating at `_spike_accel` up to `_spike_top`.
var _spiked := false
var _spike_v := 0.0
var _spike_accel := 45.0
var _spike_top := 10.0
## For the tests and the report: spikes so far, and the fastest the last one fell (m/s).
var spikes := 0
var last_spike_speed := 0.0
var _captures_n := 0 ## captures in the current diminishing-returns run
var _last_capture := -1000.0
var _melee: MeleeState
var _e0 := 0.0 ## how far into its attack it was when this tick began
var _attack_from := Vector3.ZERO ## where it stood when the attack began (the arc's place)
var _locked := false
var _outcome := ""


## Its late tick (priority +10, after the Samurai's body has moved): its blade is resolved against him then, so both
## stand where they are at the end of the same tick.
class LateTick extends Node:
	var body: TrainingAutomaton

	func _ready() -> void:
		process_physics_priority = 10

	func _physics_process(_delta: float) -> void:
		if body and body.is_physics_processing():
			body.strike_check()


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
	var sp: Dictionary = a.target_data.get("spar", {})
	a.attack_data = AttackData.automaton_attack(String(sp.get("attack", "sweep")))
	var moves: Array[AttackData] = []
	if a.attack_data:
		moves.append(a.attack_data)
		a.arc = TelegraphArc.for_attack(a.attack_data)
		a.add_child(a.arc)
	a._melee = MeleeState.new(moves)
	var late := LateTick.new()
	late.name = "LateTick"
	late.body = a
	a.add_child(late)
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
	_e0 = _melee.elapsed()
	_melee.step(dt) # (its attack's phases, and its cadence: the attack's cooldown)
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
		"attack":
			_do_attack(dt)
	for e in _melee.events:
		if String(e["type"]) == "phase" and String(e["phase"]) == "ACTIVE":
			attack_active.emit()
	_melee.events.clear()
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
	return is_alive() and bool(target_data.get("pullable", false)) and state in ["stand", "walk", "stagger", "attack"]


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
		and state in ["stand", "walk", "stagger", "captured", "pulled", "attack"]


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
	_spiked = false
	last_apex = global_position.y
	launches += 1
	_enter("air")
	_anim_speed = 1.0
	visual.pose("Hit_Knockback", 0.13, 0.06)
	QA.flag("automaton_launched", launches)
	return true


## Aerial Pursuit's spike: its blow in the air drives it down — from `start` m/s, accelerating at `accel` m/s² up to
## `top` m/s, straight down, with collision — onto the floor. Only while it is airborne.
func spike(start: float, accel: float, top: float) -> bool:
	if state != "air":
		return false
	_spiked = true
	_spike_v = start
	_spike_accel = accel
	_spike_top = top
	last_spike_speed = start
	spikes += 1
	QA.flag("automaton_spiked", spikes)
	return true


## Attack now (its sparring script, or the tests and QA): only on guard, alive, with its cadence allowing it. True when
## it began.
func attack() -> bool:
	if attack_data == null or not is_alive() or state != "stand" or _melee.cooldown_left(attack_data.id) > 0.0:
		return false
	if not _melee.action_pressed(attack_data):
		return false
	_melee.events.clear()
	attacks += 1
	_outcome = ""
	_locked = false
	_attack_from = global_position
	_enter("attack")
	QA.flag("automaton_attack_start", attacks)
	attack_started.emit()
	return true


## How far into its attack it is (s from its start; -1 when it is not attacking).
func attack_time() -> float:
	return _melee.elapsed() if state == "attack" and _melee.is_attacking() else -1.0


## Its late tick: the slice of its active window this tick swept, resolved against its foe (after he moved this
## tick) — once per attack: the first result against him spends the attack on him. (The game calls it from LateTick;
## the tests call it after stepping his body.)
func strike_check() -> void:
	var a := _melee.current()
	if state != "attack" or a == null or _melee.swept.x < 0.0 or foe == null or not is_instance_valid(foe):
		return
	var span := _melee.swept
	_melee.swept = Vector2(-1, -1) # (once per tick)
	var id := foe.fighter.get_instance_id()
	if _melee.touched(id):
		return
	var r := foe.incoming(a, self, span)
	match r:
		"hit":
			_melee.hit_confirmed(id) # (its own hit-stop: the cut holds still for a moment)
		"evaded", "avoided":
			_melee.spent_on(id)
	if r != "":
		_resolved(r)


func _resolved(r: String) -> void:
	_outcome = r
	last_attack = r
	QA.flag("automaton_attack", r)
	attack_resolved.emit(r)


func _wants_attack() -> bool:
	if foe == null or not is_instance_valid(foe) or foe.fighter == null:
		return false
	var sp: Dictionary = target_data.get("spar", {})
	if _since_hit < float(sp.get("after_hit", 1.0)):
		return false
	var to := _flat(foe.fighter.global_position - global_position)
	if to.length() > float(sp.get("trigger", 3.0)):
		return false
	return absf(rad_to_deg(wrapf(atan2(to.x, to.z) - facing, -PI, PI))) <= float(sp.get("cone", 45.0))


## The attack through its phases (the state machine's): the windup's raise and trembling hold, turning toward its foe
## until the lock; the cut along its baked path; the follow-through; its step into the cut; the telegraph's glow.
func _do_attack(dt: float) -> void:
	var a := attack_data
	var w := a.windup
	var at := 0.0
	match _melee.phase:
		MeleeState.Phase.STARTUP:
			var t := _melee.t
			if t < float(w.get("lock", 0.3)):
				if foe and is_instance_valid(foe):
					_turn_toward(foe.fighter.global_position - global_position, float(w.get("turn", 6.0)), dt)
			elif not _locked:
				_locked = true
				QA.flag("automaton_attack_locked", snappedf(rad_to_deg(facing), 0.1))
			var top := float(w.get("to", 0.36))
			var rise := float(w.get("time", 0.36))
			at = top * clampf(t / rise, 0.0, 1.0)
			if t > rise:
				at -= 0.01 * (0.5 + 0.5 * sin(_clock * 46.0)) # the raised weapon trembles
			telegraph = pow(clampf(t / a.startup, 0.0, 1.0), 1.5)
		MeleeState.Phase.ACTIVE:
			_locked = true
			at = a.move_time(clampf(_melee.t / maxf(_melee.active_length(), 0.0001), 0.0, 1.0))
			telegraph = 1.0
		MeleeState.Phase.RECOVERY:
			at = lerpf(a.move_time(1.0), float(a.follow.get("to", 0.8)), clampf(_melee.t / a.recovery, 0.0, 1.0))
			telegraph = maxf(0.0, 1.0 - _melee.t / 0.15)
		_:
			_finish_attack()
			return
	_lunge(a)
	visual.pose(a.anim, at, 0.1)
	_anim_speed = 1.0
	_show_telegraph()


## Its step into the cut: `lunge` m along its facing from LUNGE_LEAD s before the cut to the cut's end, with collision.
func _lunge(a: AttackData) -> void:
	if a.lunge <= 0.0:
		return
	var from := a.startup - LUNGE_LEAD
	var to := a.startup + a.active
	var d := (clampf(_melee.elapsed(), from, to) - clampf(_e0, from, to)) / (to - from) * a.lunge
	if d > 0.0:
		_move(forward() * d)


func _finish_attack() -> void:
	if _outcome == "":
		_resolved("missed")
	telegraph = 0.0
	_show_telegraph()
	_enter("stand")


## Its attack was cut off (a blow, a capture, a launch, defeat): the state machine drops it, the telegraph goes out.
func _leave_attack() -> void:
	if _melee.is_attacking():
		_melee.take_hit(0.0)
		if _outcome == "":
			_resolved("interrupted")
	telegraph = 0.0
	_show_telegraph()


func _show_telegraph() -> void:
	visual.set_telegraph(telegraph, _melee.phase == MeleeState.Phase.ACTIVE)
	if arc:
		arc.show_at(_attack_from, facing, telegraph, _melee.phase == MeleeState.Phase.ACTIVE)


func _do_stand(dt: float) -> void:
	if watch and is_instance_valid(watch):
		_turn_toward(watch.global_position - global_position, 5.0, dt)
	if visual.current != "Sword_Idle":
		_play("Sword_Idle", 0.25)
	if spar and _wants_attack() and attack():
		return
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
	if _spiked:
		_do_spike(dt)
		return
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


## The spiked descent: accelerating straight down to the floor (or onto whatever is under it).
func _do_spike(dt: float) -> void:
	_spike_v = minf(_spike_top, _spike_v + _spike_accel * dt)
	last_spike_speed = maxf(last_spike_speed, _spike_v)
	var dy := -_spike_v * dt
	var floor_reached := global_position.y + dy <= 0.0
	if floor_reached:
		dy = -global_position.y
	if absf(dy) > 0.00001:
		var c := move_and_collide(Vector3(0.0, dy, 0.0))
		if c and c.get_normal().y > 0.7:
			_land()
			return
	if floor_reached:
		global_position.y = 0.0
		_land()
		return
	visual.pose("Hit_Knockback", 0.25)
	_anim_speed = 1.0


func _land() -> void:
	last_airtime = _air_t
	var spiked := _spiked
	_spiked = false
	_enter("down")
	_play("Hit_Knockback", 0.06 if spiked else 0.08, 1.15 if spiked else 1.0, 0.25 if spiked else 0.27) # onto its back
	QA.flag("automaton_landed", "%.3f:%.2f%s" % [_air_t, last_apex, ":spiked" if spiked else ""])
	landed.emit(_air_t)
	if spiked:
		impacted.emit(global_position)


func _do_down() -> void:
	if hp <= 0:
		_defeat()
		return
	if _t >= float(target_data.get("down", 0.45)):
		_rise(0.15)


func _rise(blend: float) -> void:
	_enter("getup")
	_play("LayToIdle", blend, visual.duration("LayToIdle") / maxf(0.2, float(target_data.get("getup", 0.9))))


func _do_getup() -> void:
	if _t >= float(target_data.get("getup", 0.9)):
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
	if state == "attack" and s != "attack":
		_leave_attack()
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
		"spikes": spikes, "spike_speed": snappedf(last_spike_speed, 0.01),
		"pushes": pushes, "captures": captures, "launches": launches, "frozen": _freeze > 0.0,
		"spar": spar, "attacks": attacks, "last_attack": last_attack,
		"attack_t": snappedf(attack_time(), 0.001), "locked": _locked, "telegraph": snappedf(telegraph, 0.01),
		"cadence": snappedf(_melee.cooldown_left(attack_data.id) if attack_data else 0.0, 0.01)}


static func _ease3(k: float) -> float:
	return 1.0 - pow(1.0 - k, 3.0)


static func _flat(v: Vector3) -> Vector3:
	return Vector3(v.x, 0.0, v.z)
