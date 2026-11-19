class_name OcclusionFader
extends Node
## Foreground columns and the broken arch fade while they would hide the fight (M4.2-A, GPT's v2.1). Each column, and
## the arch, is one group: all its pieces fade together. A group fades — to `opacity` in OUT s, back in BACK s — while
## it is nearer to the camera than a fighter and its box on the screen overlaps that fighter's (feet to head, a body's
## width either side), or while it is nearer than the player and overlaps the screen's middle (a column filling the
## side of the frame without crossing the line to him). Never one behind both fighters. Its screen box is grown a
## little while it is faded, and it stays faded HOLD s after it stops obstructing (hysteresis: no flicker at a
## threshold). Collision is untouched. Materials: each group's transparent copies are made once, when it is added —
## nothing is created per frame; a group back at full opacity has its own opaque materials again (the opaque pass).
## Off unless switched on (`enabled`: QA, until a camera is chosen — the production view unchanged).

static var enabled := false
static var opacity := 0.25
const OUT := 0.15 ## s to fade out
const BACK := 0.3 ## s to come back
const HOLD := 0.25 ## s a group stays faded once it stops obstructing
const GROW := 0.08 ## share of its screen box's size added each side while faded
const MIDDLE := 0.7 ## the share of the screen's width that counts as its middle
const NEARER := 0.3 ## m nearer than a fighter before a group counts as in front of it

var rig: CameraRig
var _groups: Array[Dictionary] = []


func _ready() -> void:
	process_priority = 20 # (after the camera has moved this frame)


## A group of pieces that fade as one; their transparent copies made here, once.
func add_group(meshes: Array) -> void:
	var box := AABB()
	var first := true
	var own: Array[Material] = []
	var faded: Array[Material] = []
	var copies := {}
	for m: MeshInstance3D in meshes:
		var a := m.global_transform * m.get_aabb()
		box = a if first else box.merge(a)
		first = false
		var mat := m.material_override
		own.append(mat)
		if not copies.has(mat):
			var t := mat.duplicate() as BaseMaterial3D
			t.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			copies[mat] = t
		faded.append(copies[mat])
	_groups.append({"meshes": meshes, "own": own, "faded": faded, "copies": copies.values(), "box": box,
		"alpha": 1.0, "hold": 0.0, "shown": 1.0})


func _process(delta: float) -> void:
	var cam := rig.cam if rig else null
	var on := enabled and cam != null and rig.active and rig.target != null
	var fighters: Array[Dictionary] = []
	if on:
		for n: Node3D in [rig.target, rig.focus]:
			if n and is_instance_valid(n):
				fighters.append(_fighter_box(cam, n))
	var view := rig.screen if rig else Vector2(1280, 720)
	var middle := Rect2(view.x * (1.0 - MIDDLE) * 0.5, 0.0, view.x * MIDDLE, view.y)
	for g in _groups:
		var hides := false
		if on and not fighters.is_empty():
			var s := _project(cam, g["box"], view)
			if not s.is_empty():
				var r: Rect2 = s["rect"]
				if float(g["alpha"]) < 1.0:
					r = r.grow_individual(r.size.x * GROW, r.size.y * GROW, r.size.x * GROW, r.size.y * GROW)
				var near := float(s["near"])
				for f in fighters:
					if near < float(f["depth"]) - NEARER and r.intersects(f["rect"]):
						hides = true
				if near < float(fighters[0]["depth"]) - NEARER and r.intersects(middle):
					hides = true
		g["hold"] = HOLD if hides else maxf(0.0, float(g["hold"]) - delta)
		var goal := opacity if (hides or float(g["hold"]) > 0.0) else 1.0
		var a := float(g["alpha"])
		if goal < a:
			a = maxf(goal, a - (1.0 - opacity) / OUT * delta)
		else:
			a = minf(goal, a + (1.0 - opacity) / BACK * delta)
		g["alpha"] = a
		_show(g, a)


## Whether a column or the arch (any group's box) stands across the line from `from` to `to` — the review's side view
## uses it to keep a clear line to the fighters.
func blocks(from: Vector3, to: Vector3) -> bool:
	for g in _groups:
		if (g["box"] as AABB).intersects_segment(from, to) != null:
			return true
	return false


## (QA) how many groups are faded now, and each one's opacity.
func info() -> Dictionary:
	var faded := 0
	var alphas: Array[float] = []
	for g in _groups:
		alphas.append(snappedf(float(g["alpha"]), 0.01))
		if float(g["alpha"]) < 0.999:
			faded += 1
	return {"enabled": enabled, "opacity": opacity, "faded": faded, "alphas": alphas}


func _show(g: Dictionary, a: float) -> void:
	if is_equal_approx(a, float(g["shown"])):
		return
	g["shown"] = a
	var meshes: Array = g["meshes"]
	if a >= 0.999:
		for i in meshes.size():
			(meshes[i] as MeshInstance3D).material_override = g["own"][i]
		return
	for t: BaseMaterial3D in g["copies"]:
		t.albedo_color.a = a
	for i in meshes.size():
		(meshes[i] as MeshInstance3D).material_override = g["faded"][i]


## A fighter's box on the screen (feet to head, a body's width either side) and its depth from the camera.
static func _fighter_box(cam: Camera3D, n: Node3D) -> Dictionary:
	var pts := CameraRig.framing_points(n, cam.global_transform.basis)
	var box := Rect2()
	for i in pts.size():
		var at := cam.unproject_position(pts[i])
		box = Rect2(at, Vector2.ZERO) if i == 0 else box.expand(at)
	var depth := -(cam.global_transform.affine_inverse() * (n.global_position + Vector3(0, 0.9, 0))).z
	return {"rect": box, "depth": depth}


## A group's box on the screen and its nearest depth; a box reaching behind the camera covers the whole screen.
static func _project(cam: Camera3D, box: AABB, view: Vector2) -> Dictionary:
	var inv := cam.global_transform.affine_inverse()
	var rect := Rect2()
	var near := INF
	var first := true
	var behind := false
	var ahead := false
	for i in 8:
		var p := box.get_endpoint(i)
		var depth := -(inv * p).z
		near = minf(near, depth)
		if depth <= 0.05:
			behind = true
			continue
		ahead = true
		var at := cam.unproject_position(p)
		rect = Rect2(at, Vector2.ZERO) if first else rect.expand(at)
		first = false
	if not ahead:
		return {}
	if behind:
		return {"rect": Rect2(Vector2.ZERO, view), "near": maxf(near, 0.0)}
	return {"rect": rect, "near": near}
