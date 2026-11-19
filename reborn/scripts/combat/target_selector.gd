class_name TargetSelector
extends RefCounted
## The current target — the one the target bar shows and the camera frames (GPT's v2.1 rule, M4.2-A2):
##   1. the Legacy Chain's target while an opportunity against it is open (the combo's target);
##   2. else the one he last struck or that last struck him, within ENGAGED s (alive, within RANGE);
##   3. else the nearest alive within RANGE.
## A better-ranked candidate takes over at once; one of the same rank (a nearer bystander, the other of two at one
## distance) only after it has stayed the better RETAIN s — no flicker; a bystander never takes it from one he is
## fighting (it ranks lower). None when no candidate qualifies: dead, gone or out of range — the bar clears.

const RANGE := 9.0 ## m (flat)
const RETAIN := 0.4 ## s
const ENGAGED := 4.0 ## s a blow given or taken keeps a target his opponent (provisional: the earlier rule's 4 s)

var current: Object = null
var rank := 0 ## the current one's rank now (0: none)
var _pending: Object = null
var _pending_t := 0.0


## One step: `candidates` — [{node, alive: bool, dist: float}]; `combo` — the chain's target (or null); `engaged` —
## {node: s since the last blow between him and it}. Returns the current target (or null).
func pick(candidates: Array, combo: Object, engaged: Dictionary, delta: float) -> Object:
	var best: Object = null
	var best_rank := 0
	var best_d := INF
	var cur_rank := 0
	for c: Dictionary in candidates:
		var r := rank_of(c, combo, engaged)
		if c["node"] == current:
			cur_rank = r
		if r > best_rank or (r == best_rank and r > 0 and float(c["dist"]) < best_d):
			best = c["node"]
			best_rank = r
			best_d = float(c["dist"])
	if best == null:
		_take(null, 0)
	elif current == null or cur_rank == 0 or best_rank > cur_rank:
		_take(best, best_rank)
	elif best != current:
		# the same rank: it takes over only once it has stayed the better RETAIN s
		if _pending != best:
			_pending = best
			_pending_t = 0.0
		_pending_t += delta
		if _pending_t >= RETAIN:
			_take(best, best_rank)
		else:
			rank = cur_rank
	else:
		_pending = null
		_pending_t = 0.0
		rank = cur_rank
	return current


## A candidate's rank (0: it does not qualify).
static func rank_of(c: Dictionary, combo: Object, engaged: Dictionary) -> int:
	if not bool(c["alive"]) or float(c["dist"]) >= RANGE:
		return 0
	if combo != null and c["node"] == combo:
		return 3
	if engaged.has(c["node"]) and float(engaged[c["node"]]) < ENGAGED:
		return 2
	return 1


func _take(node: Object, r: int) -> void:
	current = node
	rank = r
	_pending = null
	_pending_t = 0.0
