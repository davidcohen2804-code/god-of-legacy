class_name FrameStats
extends RefCounted
## The device test's frame times (GPT's v1.7 and v1.8), from the actual intervals between rendered frames — never the
## physics tick's fixed step. Kept per set (a preset in free play, or in the benchmark): every valid frame's time, the
## valid seconds they add up to, the frames left out while it warmed up. A set begins with a warm-up (WARMUP s after the
## arena is built, after a restart and after a preset change — the interval that spans the change itself left out
## first, however long) whose frames are counted as excluded, not measured; the caller leaves out the frames of a paused
## game, a hidden tab and a loading screen. An interval over STALL ms while the game ran and showed is a severe stall
## (GPT's v1.8): measured like any other frame — in the percentiles, the worst, the average — and counted apart with its
## time, so a struggling device never looks healthy. Pure logic: the tests drive it directly.

const WARMUP := 2.0 ## s
const WINDOW := 10.0 ## s of the rolling view
const STALL := 1000.0 ## ms: an interval this long, the game running and shown, is a severe stall

var key := "" ## the set measured now
var stalls := 0 ## severe stalls, in all sets
var stall_ms := 0.0 ## their time
## key → {ms: Array[float], valid: s, excluded: warm-up frames, stalls: n, stall_ms: ms, end: "" or why it ended short}
var _sets := {}
var _hold := 0.0 ## s of warm-up left
var _skip := false ## the next interval spans a change (a build, a preset, a hidden tab): left out, whatever its length
var _recent: Array[float] = [] ## the last WINDOW s of valid frames (ms), oldest first
var _recent_sum := 0.0
var _last := 0.0 ## the last frame's time (ms), valid or not


## A set begins (or goes on) as `k`, with a warm-up first.
func begin(k: String) -> void:
	key = k
	hold(WARMUP)
	if not _sets.has(k):
		var ms: Array[float] = []
		_sets[k] = {"ms": ms, "valid": 0.0, "excluded": 0, "stalls": 0, "stall_ms": 0.0, "end": ""}


## Set `k` ended before its measure was complete — "timeout" or "stopped" (GPT's v1.8): its row says so.
func end(k: String, why: String) -> void:
	if _sets.has(k):
		_sets[k]["end"] = why


## Leave out the next `seconds` s of frames (a warm-up).
func hold(seconds: float) -> void:
	_hold = maxf(_hold, seconds)
	_skip = true
	_recent.clear()
	_recent_sum = 0.0


## Forget every set whose key begins with `prefix` (a new benchmark).
func clear(prefix: String) -> void:
	for k in _sets.keys():
		if String(k).begins_with(prefix):
			_sets.erase(k)


## One rendered frame, `ms` after the last; `valid` when the game ran and showed it (not paused, hidden or loading).
func frame(ms: float, valid: bool) -> void:
	_last = ms
	if key == "" or ms <= 0.0:
		return
	if _skip:
		_skip = false
		if valid:
			_sets[key]["excluded"] = int(_sets[key]["excluded"]) + 1
		return
	if not valid:
		return
	var s: Dictionary = _sets[key]
	if _hold > 0.0:
		_hold -= ms / 1000.0
		s["excluded"] = int(s["excluded"]) + 1
		return
	(s["ms"] as Array).append(ms)
	s["valid"] = float(s["valid"]) + ms / 1000.0
	if ms > STALL: # (a severe stall: measured with the rest, and counted apart)
		s["stalls"] = int(s["stalls"]) + 1
		s["stall_ms"] = float(s["stall_ms"]) + ms
		stalls += 1
		stall_ms += ms
	_recent.append(ms)
	_recent_sum += ms
	while _recent_sum > WINDOW * 1000.0 and _recent.size() > 1:
		_recent_sum -= float(_recent.pop_front())


func warming() -> bool:
	return _hold > 0.0 or _skip


func last_ms() -> float:
	return _last


## The valid seconds measured in set `k`.
func valid_seconds(k: String) -> float:
	return float((_sets.get(k, {}) as Dictionary).get("valid", 0.0))


func keys() -> Array:
	return _sets.keys()


## The last WINDOW s: {frames, fps, p50, p95} (empty before any).
func recent() -> Dictionary:
	if _recent.is_empty():
		return {}
	var sorted := _recent.duplicate()
	sorted.sort()
	return {"frames": sorted.size(), "fps": 1000.0 * sorted.size() / maxf(_recent_sum, 0.001),
		"p50": pick(sorted, 0.5), "p95": pick(sorted, 0.95)}


## Set `k`: {frames, seconds, fps (the average: frames / valid seconds), excluded, stalls, stall_s, end, p50, p95,
## p99, worst, over33, over50 (shares, %)} — frames 0 when none measured.
func summary(k: String) -> Dictionary:
	var s: Dictionary = _sets.get(k, {})
	var ms: Array = s.get("ms", [])
	var secs := float(s.get("valid", 0.0))
	var out := {"frames": ms.size(), "seconds": secs, "excluded": int(s.get("excluded", 0)),
		"stalls": int(s.get("stalls", 0)), "stall_s": float(s.get("stall_ms", 0.0)) / 1000.0, "end": String(s.get("end", ""))}
	if ms.is_empty():
		return out
	var sorted := ms.duplicate()
	sorted.sort()
	var n := float(sorted.size())
	var over33 := 0
	var over50 := 0
	for v: float in sorted:
		if v > 1000.0 / 30.0:
			over33 += 1
		if v > 50.0:
			over50 += 1
	out.merge({"fps": n / maxf(secs, 0.001), "p50": pick(sorted, 0.5), "p95": pick(sorted, 0.95),
		"p99": pick(sorted, 0.99), "worst": float(sorted[-1]), "over33": 100.0 * over33 / n, "over50": 100.0 * over50 / n})
	return out


## The `p` quantile of `sorted` (ascending), nearest rank.
static func pick(sorted: Array, p: float) -> float:
	if sorted.is_empty():
		return 0.0
	var i := clampi(int(ceil(p * sorted.size())) - 1, 0, sorted.size() - 1)
	return float(sorted[i])
