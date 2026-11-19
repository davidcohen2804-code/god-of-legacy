class_name LegacyChain
extends RefCounted
## The Legacy Chain (GPT's direction v1.1, M4): which conditional abilities the player may use right now. Pure logic
## on the fixed tick, like the combat state machine; the tests drive it directly.
##
## It listens only to authoritative combat events — a confirmed capture, a confirmed launch, a genuine evasion, a
## chain completed on one target, a confirmed detonation — never to buttons or UI state. Each edge of its graph (data:
## "graph" in data/abilities/samurai.json: {on, unlock, window, priority}) turns such an event into an opportunity: an
## ability, against the event's target, for a window of time. An opportunity closes when its window runs out, when its
## target becomes invalid (gone, defeated), when the player is interrupted, or when it is used. A miss opens nothing.
##
## At most `slots` opportunities are shown at once (the two conditional buttons), chosen by the data's priority (then
## the one expiring first); the others stay valid and waiting — never silently dropped — and surface as soon as a
## slot frees. The same ability against the same target is one opportunity (a repeat event renews its window).

var edges: Array[Dictionary] = []
## Open opportunities: [{ability, target, left, window, priority, on}].
var open: Array[Dictionary] = []
var slots := 2
## [{type: "opened" | "closed" | "used", ability, target, why}] since the owner last drained them.
var events: Array[Dictionary] = []


func _init(graph: Array = []) -> void:
	for e in graph:
		edges.append({"on": String(e.get("on", "")), "unlock": String(e.get("unlock", "")),
			"window": float(e.get("window", 0.7)), "priority": int(e.get("priority", 0))})


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
			"priority": e["priority"], "on": name})
		events.append({"type": "opened", "ability": e["unlock"], "target": target})


## Age the windows; close the expired ones.
func step(dt: float) -> void:
	for i in range(open.size() - 1, -1, -1):
		open[i]["left"] = float(open[i]["left"]) - dt
		if float(open[i]["left"]) <= 0.0:
			_close(i, "expired")


## The opportunities shown on the conditional buttons, best first: [{ability, target, left, window}].
func visible() -> Array[Dictionary]:
	var sorted := open.duplicate()
	sorted.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		if a["priority"] != b["priority"]:
			return a["priority"] > b["priority"]
		return a["left"] < b["left"])
	var out: Array[Dictionary] = []
	for i in mini(slots, sorted.size()):
		out.append(sorted[i])
	return out


## The opportunity on button `slot` (0 or 1), or an empty dictionary.
func in_slot(slot: int) -> Dictionary:
	var v := visible()
	return v[slot] if slot >= 0 and slot < v.size() else {}


## The player used the opportunity on `slot`: it is consumed (and returned) — empty when that slot holds nothing.
func take(slot: int) -> Dictionary:
	var o := in_slot(slot)
	if o.is_empty():
		return {}
	var i := _find(String(o["ability"]), int(o["target"]))
	open.remove_at(i)
	events.append({"type": "used", "ability": o["ability"], "target": o["target"]})
	return o


## Is there an open opportunity for `ability`?
func has(ability: String) -> bool:
	for o in open:
		if o["ability"] == ability:
			return true
	return false


## The target is no longer valid (gone, defeated…): its opportunities close.
func target_invalid(target: int, why: String = "target") -> void:
	for i in range(open.size() - 1, -1, -1):
		if int(open[i]["target"]) == target:
			_close(i, why)


## The player was interrupted: every opportunity closes.
func interrupt(why: String = "interrupted") -> void:
	for i in range(open.size() - 1, -1, -1):
		_close(i, why)


func _find(ability: String, target: int) -> int:
	for i in open.size():
		if open[i]["ability"] == ability and int(open[i]["target"]) == target:
			return i
	return -1


func _close(i: int, why: String) -> void:
	var o: Dictionary = open[i]
	open.remove_at(i)
	events.append({"type": "closed", "ability": o["ability"], "target": o["target"], "why": why})
