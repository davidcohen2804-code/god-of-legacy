extends RefCounted
## The Legacy Chain graph (LegacyChain): only its events open opportunities; windows expire; a used opportunity is
## consumed; an invalid target or an interruption closes them; two are shown at once by priority and the rest wait —
## never silently dropped; a repeated event renews a window instead of doubling it.

const T1 := 101
const T2 := 202
const DT := 1.0 / 60.0

const GRAPH := [
	{"on": "captured", "unlock": "chain_pull", "window": 0.7, "priority": 2},
	{"on": "launched", "unlock": "aerial_pursuit", "window": 0.7, "priority": 4},
	{"on": "evaded", "unlock": "shadow_counter", "window": 0.6, "priority": 3},
	{"on": "chain_complete", "unlock": "explosive_seal", "window": 1.2, "priority": 1},
	{"on": "detonated", "unlock": "phantom_execution", "window": 1.0, "priority": 5},
]


func _ticks(g: LegacyChain, seconds: float) -> void:
	for i in int(round(seconds / DT)):
		g.step(DT)


func _shown(g: LegacyChain) -> Array:
	return g.visible().map(func(o: Dictionary) -> String: return String(o["ability"]))


func test_only_its_events_open_opportunities() -> String:
	var g := LegacyChain.new(GRAPH)
	g.event("missed", T1)
	g.event("pressed_dodge", T1)
	if not g.open.is_empty():
		return "an event outside the graph opened %s" % [_shown(g)]
	g.event("captured", T1)
	return "" if _shown(g) == ["chain_pull"] else "a capture showed %s" % [_shown(g)]


func test_windows_expire() -> String:
	var g := LegacyChain.new(GRAPH)
	g.event("evaded", T1)
	_ticks(g, 0.55)
	if not g.has("shadow_counter"):
		return "the counter's 0.6 s window closed early"
	_ticks(g, 0.1)
	if g.has("shadow_counter"):
		return "the counter's window did not close after 0.6 s"
	var closed := g.events.any(func(e: Dictionary) -> bool: return e["type"] == "closed" and e["why"] == "expired")
	return "" if closed else "no expiry reported"


func test_using_an_opportunity_consumes_it() -> String:
	var g := LegacyChain.new(GRAPH)
	g.event("launched", T1)
	var o := g.take(0)
	if o.get("ability", "") != "aerial_pursuit" or int(o.get("target", 0)) != T1:
		return "taking slot 0 gave %s" % [o]
	if g.has("aerial_pursuit") or not g.take(0).is_empty():
		return "a used opportunity could be used again"
	return ""


func test_an_invalid_target_or_an_interruption_closes_them() -> String:
	var g := LegacyChain.new(GRAPH)
	g.event("captured", T1)
	g.event("evaded", T2)
	g.target_invalid(T1)
	if g.has("chain_pull") or not g.has("shadow_counter"):
		return "after T1 became invalid: %s" % [_shown(g)]
	g.interrupt()
	return "" if g.open.is_empty() else "an interruption left %s" % [_shown(g)]


func test_two_shown_by_priority_and_the_rest_wait() -> String:
	var g := LegacyChain.new(GRAPH)
	g.event("chain_complete", T1) # priority 1
	g.event("captured", T1) # 2
	g.event("evaded", T2) # 3
	if _shown(g) != ["shadow_counter", "chain_pull"]:
		return "three eligible showed %s (want counter, pull)" % [_shown(g)]
	if not g.has("explosive_seal"):
		return "the third opportunity was dropped"
	g.take(0) # the counter is used: the seal surfaces
	if _shown(g) != ["chain_pull", "explosive_seal"]:
		return "after using one: %s (want pull, seal)" % [_shown(g)]
	return ""


func test_a_repeated_event_renews_rather_than_doubles() -> String:
	var g := LegacyChain.new(GRAPH)
	g.event("captured", T1)
	_ticks(g, 0.5)
	g.event("captured", T1)
	if g.open.size() != 1:
		return "a repeated capture made %d opportunities" % g.open.size()
	_ticks(g, 0.6)
	if not g.has("chain_pull"):
		return "the renewed window did not run its full 0.7 s"
	g.event("captured", T2) # the same ability on another target is another opportunity
	return "" if g.open.size() == 2 else "a capture of another target did not add its own opportunity"


func test_the_shipped_graph_is_well_formed() -> String:
	var data: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/abilities/samurai.json"))
	var graph: Array = (data as Dictionary).get("graph", [])
	if graph.is_empty():
		return ""  # (until the graph's edges are confirmed and shipped)
	var all := AttackData.load_set()
	for e in graph:
		if not all.has(String(e.get("unlock", ""))):
			return "the graph unlocks %s, which is not an ability in the data" % e.get("unlock", "")
		if float(e.get("window", 0.0)) <= 0.0:
			return "the edge to %s has no window" % e.get("unlock", "")
	return ""
