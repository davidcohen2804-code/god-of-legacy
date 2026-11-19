class_name StrikeSequence
extends RefCounted
## Explosive Execution's entry (GPT's v1.2, v1.7): the Attack chain's strikes in order — Basic 1, 2, 3 — each a confirmed
## hit on the chain's primary target, each no more than `gap` s after the previous one, measured on the combat clock
## (held through hit-stop, like the Legacy Chain's windows). One record — the primary target and how far the sequence
## has gone on it — never one per target: the primary is the chain's (MeleeState's primary-target rule, the one
## authority), begun by Basic 1 on it; Basic 2 and 3 count only on it; a hit on any other target changes nothing here
## (the chain decides whether it was a switch, and then this starts over). The hit that completes it is the
## authoritative event that opens Explosive Seal. A hit out of order, a pause too long, a target switch or a blow on
## him (reset) starts it over. Pure logic; the tests drive it directly.

var strikes: Array[String] = []
var gap := 0.9
var primary := 0 ## the primary target's instance id (0: none)
var done := 0 ## strikes confirmed in order on it
var at := 0.0 ## the clock at the last of them


func _init(p_strikes: Array = [], p_gap: float = 0.9) -> void:
	for s in p_strikes:
		strikes.append(String(s))
	gap = p_gap


## The sequence as the data defines it (samurai.json: "sequence").
static func from_data() -> StrikeSequence:
	var d: Dictionary = AttackData.load_set().get("_sequence", {})
	return StrikeSequence.new(d.get("strikes", ["basic1", "basic2", "basic3"]), float(d.get("gap", 0.9)))


## Basic 1 confirmed its hit on `target`, the chain's primary, at clock `now`: the sequence begins on it.
func begin(target: int, now: float) -> void:
	primary = target
	done = 1
	at = now


## Strike `id` confirmed a hit on `target` at clock `now`: true when that completes the sequence. Basic 1 begins it on
## `target` (the primary); a later strike counts only on the primary — in order and in time, or it starts over.
func confirm(id: String, target: int, now: float) -> bool:
	var k := strikes.find(id)
	if k < 0:
		return false
	if k == 0:
		begin(target, now)
		return false
	if primary == 0 or target != primary:
		return false # (not the primary: an incidental hit changes nothing)
	if done != k or now - at > gap + 1e-6:
		reset() # (out of order or too slow: it starts over)
		return false
	done = k + 1
	at = now
	if done >= strikes.size():
		reset()
		return true
	return false


## How many strikes stand confirmed in order on `target` (0 unless it is the primary).
func progress(target: int) -> int:
	return done if target != 0 and target == primary else 0


## Everything starts over (a target switch, a miss, the chain let go, a blow on him).
func reset() -> void:
	primary = 0
	done = 0
	at = 0.0
