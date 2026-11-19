class_name StrikeSequence
extends RefCounted
## Explosive Execution's entry (GPT's v1.2): the Attack chain's strikes in order — Basic 1, 2, 3 — each a confirmed hit
## on the same target, each no more than `gap` s after the previous confirmed hit, measured on the combat clock (held
## through hit-stop, like the Legacy Chain's windows). The controller reports each confirmed basic hit; the one that
## completes the sequence is the authoritative event that opens Explosive Seal. Kept per target: a hit out of order, a
## pause too long or a blow on him (reset) starts it over. Pure logic; the tests drive it directly.

var strikes: Array[String] = []
var gap := 0.9
## target id → {done: strikes confirmed in order, at: the clock at the last one}
var _on := {}


func _init(p_strikes: Array = [], p_gap: float = 0.9) -> void:
	for s in p_strikes:
		strikes.append(String(s))
	gap = p_gap


## The sequence as the data defines it (samurai.json: "sequence").
static func from_data() -> StrikeSequence:
	var d: Dictionary = AttackData.load_set().get("_sequence", {})
	return StrikeSequence.new(d.get("strikes", ["basic1", "basic2", "basic3"]), float(d.get("gap", 0.9)))


## Strike `id` confirmed a hit on `target` at clock `now`: true when that completes the sequence on it.
func confirm(id: String, target: int, now: float) -> bool:
	var k := strikes.find(id)
	if k < 0:
		return false
	if k == 0:
		_on[target] = {"done": 1, "at": now}
	else:
		var s: Dictionary = _on.get(target, {})
		if s.is_empty() or int(s["done"]) != k or now - float(s["at"]) > gap + 1e-6:
			_on.erase(target) # (out of order, another target's sequence, or too slow: it starts over)
			return false
		s["done"] = k + 1
		s["at"] = now
	if int(_on[target]["done"]) >= strikes.size():
		_on.erase(target)
		return true
	return false


## How many strikes stand confirmed in order on `target`.
func progress(target: int) -> int:
	return int((_on.get(target, {}) as Dictionary).get("done", 0))


## Everything starts over (a blow on him).
func reset() -> void:
	_on.clear()
