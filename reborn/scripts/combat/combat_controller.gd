class_name CombatController
extends Node
## Binds the sword's state machine (MeleeState) to the Samurai's body, moves and targets, one fixed physics tick at a
## time (the player controller calls tick() each physics step, after handing it the tick's presses):
##   1. the state machine steps (startup → active → recovery, hit-stop, the chain);
##   2. the part of the blade's arc that this tick's slice of the active window swept is tested against every target
##      in the "hurtbox" group (SwordSweep) — each target is damaged at most once per strike, and a confirmed hit
##      starts hit-stop and the target's reaction;
##   3. its events start the moves; through startup he turns toward the target the strike picked (assist: the nearest
##      within 3.6 m and 60° of the stick, or of his facing when the stick is idle — never a full turn-around) or else
##      toward the stick, steps into the cut (stopping short of the target), and through hit-stop body, move, blade
##      trail and target all hold still; a landed blow jolts the camera, the finisher harder (restrained: mobile).
## Animation, camera and effects only follow what the state machine decided; nothing here reads the animation back.
## Sound and hit effects listen to its signals.

## A strike began (0-based step).
signal strike_started(step: int)
## A strike's active window opened (the blade is cutting).
signal strike_active(step: int)
## A strike landed on `target` (its attack data, and the flat direction from the attacker to the target).
signal strike_hit(step: int, target: Node3D, attack: AttackData, dir: Vector3)
## A strike ended without a hit.
signal strike_missed(step: int)

const STOP_SHORT := 1.1 ## the step into a cut stops this close to the target's centre, m
const STANCE_TIME := 4.0 ## the drawn-sword stance after a strike, s

## The target assist (GPT's M3 review: 3.6 m, ±60°, at most 12 rad/s through startup; it turns, never moves him).
var assist_range := 3.6
var assist_cone := 60.0 ## degrees either side of the stick (or of his facing when the stick is idle)
var assist_turn := 12.0 ## rad/s

var fighter: Fighter
var rig: CameraRig
var trail: BladeTrail
var melee := MeleeState.new()
## Totals and the last strikes, for the tests and the report: strike_log = [{step (1..3), hits, damage}], newest last.
var stats := {"strikes": 0, "hits": 0, "misses": 0, "damage": 0, "chains": 0}
var strike_log: Array[Dictionary] = []

var _target: Node3D
var _aim := Vector3.ZERO
var _stance := 0.0


## Dodging is allowed from free movement, or in the later part of a strike's recovery (cancelling it and the chain).
func can_dodge() -> bool:
	return melee.can_dodge() and fighter.state == "ground" and fighter.is_on_floor() and not fighter.frozen


func on_dodge() -> void:
	melee.dodge_started()
	fighter.action_lock = false
	fighter.action_velocity = Vector3.ZERO


func busy() -> bool:
	return melee.locks_movement()


## An attack press from the input buffer: true when the state machine took it (a strike started, or the next one
## held). Not in the air or mid-roll. During hit-stop a press is held for the next strike like any other.
func try_attack() -> bool:
	if fighter.state != "ground":
		return false
	return melee.attack_pressed()


func is_frozen() -> bool:
	return melee.hitstop > 0.0


func tick(dt: float, stick_dir: Vector3) -> void:
	melee.step(dt)
	_events(stick_dir) # (a strike's start and its active window before its hits: the swing sounds before the impact)
	var a := melee.current()
	if melee.swept.x >= 0.0:
		for t in get_tree().get_nodes_in_group("hurtbox"):
			var target := t as Node3D
			if target == null or (target.has_method("is_alive") and not target.is_alive()):
				continue
			if SwordSweep.hits(a, fighter.global_position, fighter.facing, melee.swept, target.global_position,
					float(target.get("hurt_radius")), float(target.get("hurt_height"))):
				if melee.hit_confirmed(target.get_instance_id()):
					_land(a, target)
	_events(stick_dir)
	# the body: held still through hit-stop, driven by the strike while it lasts
	var frozen := melee.hitstop > 0.0
	fighter.frozen = frozen
	fighter.action_lock = melee.locks_movement()
	if melee.is_attacking() and fighter.visual.anim and fighter.visual.current == a.anim:
		fighter.visual.anim.speed_scale = 0.0 if frozen else a.anim_speed
	fighter.action_velocity = Vector3.ZERO
	if not frozen and (melee.phase == MeleeState.Phase.STARTUP or melee.phase == MeleeState.Phase.ACTIVE):
		var step := fighter.forward() * a.lunge / (a.startup + a.active)
		if _target and is_instance_valid(_target):
			if _flat(_target.global_position - fighter.global_position).length() < STOP_SHORT:
				step = Vector3.ZERO
			if melee.phase == MeleeState.Phase.STARTUP:
				fighter.face_toward(_target.global_position, assist_turn, dt)
		elif melee.phase == MeleeState.Phase.STARTUP and _aim != Vector3.ZERO:
			fighter.face_toward(fighter.global_position + _aim, assist_turn, dt)
		fighter.action_velocity = step
	_stance = maxf(0.0, _stance - dt)
	fighter.combat_ready = _stance > 0.0
	if trail:
		var cutting := melee.phase == MeleeState.Phase.ACTIVE
		var near_cut := (melee.phase == MeleeState.Phase.STARTUP and melee.t > a.startup - 0.05) \
			or (melee.phase == MeleeState.Phase.RECOVERY and melee.t < 0.07)
		trail.emitting = cutting or near_cut
		trail.frozen = frozen


func _land(a: AttackData, target: Node3D) -> void:
	var dir := _flat(target.global_position - fighter.global_position).normalized()
	# the target sways along the blade's travel (its arc runs toward his left or right) as well as away from him
	var side := Vector3(dir.z, 0.0, -dir.x) * signf(a.arc_to - a.arc_from)
	if target.has_method("take_hit"):
		target.take_hit(a.damage, a.reaction, a.knockback, dir, (dir * 0.55 + side * 0.85).normalized())
	if target.has_method("freeze_for"):
		target.freeze_for(a.hit_stop)
	stats["hits"] += 1
	stats["damage"] += a.damage
	if not strike_log.is_empty():
		strike_log[-1]["hits"] += 1
		strike_log[-1]["damage"] += a.damage
	if rig:
		rig.shake(0.6 if a.knockback > 0.0 else 0.22)
	strike_hit.emit(melee.step_index, target, a, dir)


func _events(stick_dir: Vector3) -> void:
	for e in melee.events:
		match String(e["type"]):
			"start":
				var a := melee.attacks[int(e["step"])]
				_target = _pick_target(stick_dir)
				_aim = _flat(stick_dir).normalized() if stick_dir.length() > 0.2 else Vector3.ZERO
				fighter.visual.play(a.anim, 0.05, a.anim_speed, true, a.anim_from)
				_stance = STANCE_TIME
				stats["strikes"] += 1
				strike_log.append({"step": int(e["step"]) + 1, "hits": 0, "damage": 0})
				if strike_log.size() > 12:
					strike_log.pop_front()
				QA.flag("strike", "%d" % (int(e["step"]) + 1))
				strike_started.emit(int(e["step"]))
			"phase":
				if String(e["phase"]) == "ACTIVE":
					strike_active.emit(int(e["step"]))
			"hit":
				QA.flag("strike_hit", "%d:%d" % [int(e["step"]) + 1, int(e["damage"])])
			"miss":
				stats["misses"] += 1
				QA.flag("strike_miss", "%d" % (int(e["step"]) + 1))
				strike_missed.emit(int(e["step"]))
			"chain_done":
				stats["chains"] += 1
				QA.flag("chain_done", stats["chains"])
			"chain_reset":
				QA.flag("chain_reset", String(e["why"]))
	melee.events.clear()


## The target a strike turns to: the nearest living one within the assist's range and cone around the stick's
## direction (or the facing when the stick is idle).
func _pick_target(stick_dir: Vector3) -> Node3D:
	var aim := stick_dir if stick_dir.length() > 0.2 else fighter.forward()
	var aim_yaw := atan2(aim.x, aim.z)
	var best: Node3D = null
	var best_d := assist_range
	for t in get_tree().get_nodes_in_group("hurtbox"):
		var n := t as Node3D
		if n == null or (n.has_method("is_alive") and not n.is_alive()):
			continue
		var to := _flat(n.global_position - fighter.global_position)
		var d := to.length()
		if d > best_d:
			continue
		if absf(rad_to_deg(wrapf(atan2(to.x, to.z) - aim_yaw, -PI, PI))) > assist_cone:
			continue
		best = n
		best_d = d
	return best


## For the QA bridge.
func state() -> Dictionary:
	return {
		"phase": MeleeState.Phase.keys()[melee.phase],
		"step": melee.step_index + 1,
		"next": melee.next_step + 1,
		"hitstop": snappedf(melee.hitstop, 0.001),
		"strikes": stats["strikes"], "hits": stats["hits"], "misses": stats["misses"], "damage": stats["damage"],
		"chains": stats["chains"],
		"log": strike_log.duplicate(true),
	}


static func _flat(v: Vector3) -> Vector3:
	return Vector3(v.x, 0.0, v.z)
