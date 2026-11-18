class_name MeleeState
extends RefCounted
## The combat state machine for one fighter's sword (M3): pure logic on the fixed physics tick, no nodes, no animation
## — the controller feeds it presses, ticks and confirmed hits, and reads its phases and events; the tests drive it
## directly.
##
##   FREE ──attack──▶ STARTUP ──▶ ACTIVE ──▶ RECOVERY ──▶ FREE
##                                   │ confirmed hit: hit-stop (timers frozen), the chain may go on
## Each tick: step(dt), then the controller sweeps the blade over `swept` and reports hits (hit_confirmed).
##   HITSTUN (taking a hit) interrupts everything; a dodge may cancel the later part of RECOVERY.
##
## The three-hit chain: only a confirmed hit opens the next strike. A press from the active window on is held as the
## next strike's request; after a hit it fires once half the recovery is past (or as soon as the chain resumes from
## FREE within CHAIN_GRACE); after a miss the chain starts again from the first strike. A hit on another target than
## the chain's, an interruption, a dodge or the chain's expiry start it over.

enum Phase { FREE, STARTUP, ACTIVE, RECOVERY, HITSTUN }

## How much of the recovery must pass before a confirmed strike may chain into the next, or a dodge cancel it.
const CHAIN_CANCEL_FROM := 0.5
const DODGE_CANCEL_FROM := 0.5
## After a confirmed strike's recovery, how long the next strike may still follow.
const CHAIN_GRACE := 0.35

var attacks: Array[AttackData] = []
var phase := Phase.FREE
var step_index := -1 ## the current (or last) strike, 0..2
var t := 0.0 ## time in the current phase
var hitstop := 0.0
var hitstun := 0.0
var confirmed := false ## the current strike has hit
var chain_target := 0 ## the instance id the chain is on (0: none)
var next_step := 0
var chain_open := 0.0
var queued := false
## [{type: String, ...}] since the owner last drained them.
var events: Array[Dictionary] = []

## The part of the active window this tick swept, as (from, to) fractions 0..1 — (-1, -1) when it swept nothing.
## The controller tests the blade's arc over exactly this span after each step(), so no slice is skipped.
var swept := Vector2(-1, -1)

var _hit_ids := {}


func _init(p_attacks: Array[AttackData] = []) -> void:
	attacks = p_attacks if not p_attacks.is_empty() else AttackData.samurai_basics()


func current() -> AttackData:
	return attacks[step_index] if step_index >= 0 else null


func is_attacking() -> bool:
	return phase == Phase.STARTUP or phase == Phase.ACTIVE or phase == Phase.RECOVERY


func locks_movement() -> bool:
	return is_attacking() or phase == Phase.HITSTUN


func can_dodge() -> bool:
	return phase == Phase.FREE or (phase == Phase.RECOVERY and t >= current().recovery * DODGE_CANCEL_FROM)


## An attack press. True when it was taken (a strike started, or held as the chain's next request); false when it
## cannot be used now (the caller may keep it in its input buffer and offer it again).
func attack_pressed() -> bool:
	match phase:
		Phase.FREE:
			_start(next_step if chain_open > 0.0 else 0)
			return true
		Phase.ACTIVE, Phase.RECOVERY:
			if queued:
				return true
			queued = true
			return true
	return false


## A dodge has started (the caller checked can_dodge): it cancels what is left of the strike and the chain.
func dodge_started() -> void:
	if phase == Phase.RECOVERY or phase == Phase.FREE:
		_reset_chain("dodge")
		_set_phase(Phase.FREE)


## The fighter is hit (M5): the strike and the chain are interrupted.
func take_hit(stun: float) -> void:
	hitstun = stun
	_reset_chain("interrupted")
	_set_phase(Phase.HITSTUN)


## The sweep found `target_id` in the span this tick swept. True when this is a new hit for this activation (damage
## it); false for a target already hit by this swing (once per target per activation) or when nothing was swept.
func hit_confirmed(target_id: int) -> bool:
	if swept.x < 0.0 or _hit_ids.has(target_id):
		return false
	_hit_ids[target_id] = true
	var a := current()
	if not confirmed:
		confirmed = true
		if step_index > 0 and chain_target != 0 and chain_target != target_id:
			next_step = 0 # another target: the chain starts over after this strike
			events.append({"type": "chain_reset", "why": "target"})
		else:
			next_step = (step_index + 1) % attacks.size()
		chain_target = target_id
	hitstop = maxf(hitstop, a.hit_stop)
	events.append({"type": "hit", "step": step_index, "target": target_id, "damage": a.damage})
	return true


## One fixed tick. Afterwards `swept` holds the part of the active window covered by it.
func step(dt: float) -> void:
	swept = Vector2(-1, -1)
	if hitstop > 0.0:
		hitstop = maxf(0.0, hitstop - dt) # everything holds still, the blade too
		return
	if chain_open > 0.0:
		chain_open = maxf(0.0, chain_open - dt)
		if chain_open == 0.0 and phase == Phase.FREE and next_step != 0:
			_reset_chain("expired")
	match phase:
		Phase.FREE:
			return
		Phase.HITSTUN:
			hitstun -= dt
			if hitstun <= 0.0:
				_set_phase(Phase.FREE)
			return
	var a := current()
	var before := t
	t += dt
	if phase == Phase.STARTUP:
		if t < a.startup:
			return
		t -= a.startup
		before = 0.0
		_set_phase(Phase.ACTIVE)
	if phase == Phase.ACTIVE:
		swept = Vector2(clampf(before / a.active, 0.0, 1.0), clampf(t / a.active, 0.0, 1.0))
		if t >= a.active:
			t -= a.active
			_set_phase(Phase.RECOVERY)
		return
	# RECOVERY
	if queued and confirmed and step_index < attacks.size() - 1 and t >= a.recovery * CHAIN_CANCEL_FROM:
		_start(next_step)
	elif t >= a.recovery:
		var go_on := queued
		_end_strike()
		if go_on:
			_start(next_step if chain_open > 0.0 else 0)


func _start(k: int) -> void:
	step_index = k
	confirmed = false
	queued = false
	_hit_ids.clear()
	chain_open = 0.0
	if k == 0:
		chain_target = 0
	t = 0.0
	events.append({"type": "start", "step": k})
	_set_phase(Phase.STARTUP)


func _end_strike() -> void:
	queued = false
	if not confirmed:
		events.append({"type": "miss", "step": step_index})
	if confirmed and step_index < attacks.size() - 1:
		chain_open = CHAIN_GRACE
	else:
		if not confirmed or step_index == attacks.size() - 1:
			next_step = 0
			if step_index == attacks.size() - 1 and confirmed:
				events.append({"type": "chain_done"})
		chain_target = 0 if not confirmed else chain_target
	_set_phase(Phase.FREE)


func _reset_chain(why: String) -> void:
	if next_step != 0 or chain_open > 0.0 or queued:
		events.append({"type": "chain_reset", "why": why})
	next_step = 0
	chain_open = 0.0
	chain_target = 0
	queued = false


func _set_phase(p: Phase) -> void:
	phase = p
	events.append({"type": "phase", "phase": Phase.keys()[p], "step": step_index})
