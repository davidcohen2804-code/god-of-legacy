extends SceneTree
## Headless tests (CI: godot --headless --path reborn -s res://tests/run_tests.gd).
## 1. Every script and scene in the project must load and compile.
## 2. The unit tests in res://tests/unit: each method named test_* returns "" when it passes, else what went wrong.
## They run from the first frame, once the tree is up (the autoloads ready, nodes can join it), so a test may put real
## nodes in the tree — and must take them out again. A test may wait (await) for frames — for instance one physics
## frame, so the physics server has taken in the bodies it just made — and is failed if it has not finished within
## 10 s.

var failures: Array[String] = []
var _ran := false


func _initialize() -> void:
	for dir in ["res://scripts", "res://scenes"]:
		_check_loads(dir)


func _process(_delta: float) -> bool:
	if not _ran:
		_ran = true
		_run_all()
	return false


func _run_all() -> void:
	await _run_units("res://tests/unit")
	if failures.is_empty():
		print("[TESTS] all passed")
		quit(0)
	else:
		for f in failures:
			printerr("[TESTS] FAIL ", f)
		quit(1)


func _check_loads(dir: String) -> void:
	for path in _files(dir, ["gd", "tscn"]):
		var res := ResourceLoader.load(path)
		if res == null:
			failures.append("cannot load " + path)
		elif res is GDScript and not (res as GDScript).can_instantiate():
			failures.append("script does not compile: " + path)
		else:
			print("[TESTS] ok ", path)


func _files(dir: String, exts: Array) -> Array[String]:
	var out: Array[String] = []
	var d := DirAccess.open(dir)
	if d == null:
		return out
	d.list_dir_begin()
	var f := d.get_next()
	while f != "":
		var p := dir.path_join(f)
		if d.current_is_dir():
			if not f.begins_with("."):
				out.append_array(_files(p, exts))
		elif f.get_extension() in exts:
			out.append(p)
		f = d.get_next()
	out.sort()
	return out


func _run_units(dir: String) -> void:
	for path in _files(dir, ["gd"]):
		var s: Variant = load(path)
		if s == null or not (s as GDScript).can_instantiate():
			failures.append("cannot load test " + path)
			continue
		var t: Object = (s as GDScript).new()
		for m in t.get_method_list():
			var n: String = m["name"]
			if not n.begins_with("test_"):
				continue
			var err: Variant = await _finish(t.call(n))
			if typeof(err) != TYPE_STRING:
				# (a script error aborts the test and returns nothing: that is a failure too)
				failures.append("%s %s: did not finish (script error?)" % [path.get_file(), n])
			elif not (err as String).is_empty():
				failures.append("%s %s: %s" % [path.get_file(), n, err])
			else:
				print("[TESTS] pass ", path.get_file(), " ", n)


## A test's result: what it returned — or, when it waits on frames, what it returns once it finishes (null when it
## does not finish within 10 s, or a script error stopped it).
func _finish(r: Variant) -> Variant:
	if not (r is Object and is_instance_valid(r) and (r as Object).has_signal("completed")):
		return r
	var out := {"done": false, "value": null}
	(r as Object).connect("completed", func(v: Variant) -> void:
		out["done"] = true
		out["value"] = v)
	var start := Time.get_ticks_msec()
	while not out["done"] and Time.get_ticks_msec() - start < 10000:
		await process_frame
	return out["value"]
