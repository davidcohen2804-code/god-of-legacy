class_name LegacyChain
extends RefCounted
## The Legacy Chain (GPT's direction v1.1 and v1.2 decisions, M4): which conditional abilities the player may use right
## now. Pure logic on the fixed tick, like the combat state machine; the tests drive it directly.
##
## It listens only to authoritative combat events — a confirmed capture, a confirmed launch, a genuine evasion, a
## chain completed on one target, a confirmed detonation — never to buttons or UI state. Each edge of its graph (data:
## "graph" in data/abilities/samurai.json) turns such an event into an opportunity: an ability, against the event's
## target, for a window of time. An edge carries what the opportunity needs: {on, unlock, window (s), rank (GPT's
## priority: 1 first), requires (the target's state it needs: "captured", "airborne"…), cancel ({from: the action
## whose recovery it may cut, at: from what fraction of that recovery})}. An opportunity closes when its window runs
## out, when its target no longer qualifies (gone, defeated, no longer held…), when the player is interrupted, or when
## it is used — consumed: the same event does not open it twice. A miss opens nothing. The windows' clocks are run by
## the owner, who holds them through hit-stop.
##
## Two conditional buttons: the opportunities in them are the two of best rank (then the one expiring first), but a
## button keeps its opportunity while it stays among those two — and always while a finger is on it (`lock`): button
## identities never change under a press. The rest wait in the overflow — shown as a small count, never silently
## dropped — and surface as soon as a button frees; `promote` lets the player bring the best waiting one onto the
## buttons in place of the lesser one shown. The same ability against the same target is one opportunity (a repeat event renews its window).

## A new opportunity was earned (not a renewal of one already open): the interface's cue (GPT's v1.7: the chime).
signal opened(ability: String, target: int)

var edges: Array[Dictionary] = []
## Open opportunities: [{ability, target, left, window, rank, on, requires, cancel, pinned}].
var open: Array[Dictionary] = []
var slots := 2
## The opportunity on each button (an entry of `open`), or an empty dictionary.
var shown: Array = []
## A finger is on that button: it keeps what it shows.
var locked: Array[bool] = []
## [{type: "opened" | "closed" | "used", ability, target, why}] since the owner last drained them.
var events: Array[Dictionary] = []


func _init(graph: Array = []) -> void:
	for e in graph:
		edges.append({"on": String(e.get("on", "")), "unlock": String(e.get("unlock", "")),
			"window": float(e.get("window", 0.7)), "rank": int(e.get("rank", 9)),
			"requires": String(e.get("requires", "")), "cancel": e.get("cancel", {})})
	for i in slots:
		shown.append({})
		locked.append(false)


## The edge that unlocks `ability` (empty when none).
func edge_for(ability: String) -> Dictionary:
	for e in edges:
		if e["unlock"] == ability:
			return e
	return {}


## An authoritative combat event (`name`) about `target` (an instance id; 0 when none).
func event(name: String, target: int) -> void:
	for e in edges:
		if e["on"] != name:
			continue
		var found := _find(String(e["unlock"]), target)
		if found >= 0:
			open[found]["left"] = float(e["window"])
			continue
		open.append({"ability": e["unlock"], "target": target, "left": e["window"], "window": e["window"],
			"rank": e["rank"], "on": name, "requires": e["requires"], "cancel": e["cancel"], "pinned": false})
		events.append({"type": "opened", "ability": e["unlock"], "target": target})
		opened.emit(String(e["unlock"]), target)
	_reslot()


## Age the windows by `dt` (the owner skips its hit-stop); close the expired ones.
func step(dt: float) -> void:
	var changed := false
	for i in range(open.size() - 1, -1, -1):
		open[i]["left"] = float(open[i]["left"]) - dt
		if float(open[i]["left"]) <= 0.0:
			_close(i, "expired")
			changed = true
	if changed:
		_reslot()


## The opportunities on the buttons, in button order (empty buttons left out).
func visible() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for o in shown:
		if not (o as Dictionary).is_empty():
			out.append(o)
	return out


## The opportunity on button `slot` (0 or 1), or an empty dictionary.
func in_slot(slot: int) -> Dictionary:
	return shown[slot] if slot >= 0 and slot < shown.size() else {}


## The open opportunities on no button (the overflow), best first.
func waiting() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for o in _ordered():
		if not _is_shown(o):
			out.append(o)
	return out


## The player used the opportunity on `slot`: it is consumed (and returned) — empty when that slot holds nothing.
func take(slot: int) -> Dictionary:
	var o := in_slot(slot)
	if o.is_empty():
		return {}
	open.erase(o)
	shown[slot] = {}
	events.append({"type": "used", "ability": o["ability"], "target": o["target"]})
	_reslot()
	return o


## Is there an open opportunity for `ability` (against `target`, when given)?
func has(ability: String, target: int = 0) -> bool:
	for o in open:
		if o["ability"] == ability and (target == 0 or int(o["target"]) == target):
			return true
	return false


## A finger went down on (or left) button `slot`.
func lock(slot: int, on: bool) -> void:
	if slot < 0 or slot >= locked.size() or locked[slot] == on:
		return
	locked[slot] = on
	if not on:
		_reslot()


## Bring the best waiting opportunity onto a button (the overflow's "select"), in place of the lesser of the two shown
## — never one with a finger on it. True when it is shown now.
func promote() -> bool:
	var w := waiting()
	if w.is_empty():
		return false
	for o in open:
		o["pinned"] = false
	w[0]["pinned"] = true
	_reslot()
	return _is_shown(w[0])


## The target is no longer valid (gone, defeated…): its opportunities close.
func target_invalid(target: int, why: String = "target") -> void:
	for i in range(open.size() - 1, -1, -1):
		if int(open[i]["target"]) == target:
			_close(i, why)
	_reslot()


## One opportunity no longer qualifies (its target left the state it needs).
func close(ability: String, target: int, why: String) -> void:
	var i := _find(ability, target)
	if i >= 0:
		_close(i, why)
		_reslot()


## The player was interrupted: every opportunity closes.
func interrupt(why: String = "interrupted") -> void:
	for i in range(open.size() - 1, -1, -1):
		_close(i, why)
	_reslot()


## Best first: a pinned one (the player's choice), then by rank, then the one expiring first.
func _ordered() -> Array:
	var sorted := open.duplicate()
	sorted.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		if a["pinned"] != b["pinned"]:
			return a["pinned"]
		if a["rank"] != b["rank"]:
			return a["rank"] < b["rank"]
		return a["left"] < b["left"])
	return sorted


## Which opportunities the buttons hold: the best `slots` of them; one already on a button stays on it (and a locked
## button keeps whatever it holds); the others fill the free buttons in order.
func _reslot() -> void:
	var best := _ordered().slice(0, slots)
	for i in slots:
		var o: Dictionary = shown[i]
		if o.is_empty():
			continue
		if not open.has(o):
			shown[i] = {}
		elif not locked[i] and not best.has(o):
			shown[i] = {}
	for o in best:
		if _is_shown(o):
			continue
		for i in slots:
			if (shown[i] as Dictionary).is_empty() and not locked[i]:
				shown[i] = o
				break


func _is_shown(o: Dictionary) -> bool:
	for s in shown:
		if is_same(s, o):
			return true
	return false


func _find(ability: String, target: int) -> int:
	for i in open.size():
		if open[i]["ability"] == ability and int(open[i]["target"]) == target:
			return i
	return -1


func _close(i: int, why: String) -> void:
	var o: Dictionary = open[i]
	open.remove_at(i)
	events.append({"type": "closed", "ability": o["ability"], "target": o["target"], "why": why})


## The player used the opportunity for `ability` against `target`, wherever it is now (a queued press resolved after
## the buttons moved): consumed and returned — empty when it is no longer open.
func consume(ability: String, target: int) -> Dictionary:
	var i := _find(ability, target)
	if i < 0:
		return {}
	var o: Dictionary = open[i]
	open.remove_at(i)
	for k in shown.size():
		if is_same(shown[k], o):
			shown[k] = {}
	events.append({"type": "used", "ability": o["ability"], "target": o["target"]})
	_reslot()
	return o
