class_name DamageNumbers
extends RefCounted
## A target's damage numbers (M3): each confirmed blow shows its damage above the target, rising RISE_BY m over RISE s
## and fading out by LIFE s. While earlier numbers of the target are still showing, a new one takes the nearest place
## beside its target, along the view's right, whose column on screen clears every one of them (GPT's v1.7: kept apart
## through their whole visible lives, measured in the view so it holds from any angle — 24 then 45 never read as 2445;
## M3: 12 and 10 never as 120). One per target.

const LIFE := 1.0 ## s a number shows (it fades through its last 0.75 s)
const RISE := 0.75 ## s it rises for
const RISE_BY := 0.7 ## m it rises
const STEP := 0.8 ## m between two places beside the target, along the view's right
const PLACES: Array[int] = [0, 1, -1, 2, -2]
const CHAR_W := 0.27 ## m, a digit's width at the numbers' size (Inter Bold 96 px at 0.004 m a pixel, its outline included — measured in the recording)
const GAP := 0.18 ## m kept clear between two numbers' columns: most of a digit, so two never read as one

var _clock := 0.0 ## game time seen by the owner (advance())
var _shown: Array[Dictionary] = [] ## the numbers still showing: {label, born (clock), at (where it appeared), width}


func advance(delta: float) -> void:
	_clock += delta


## Show `damage` above `owner` (a node in the tree), `height` m over its origin — in `tint` when given (the Samurai's
## own wounds), else ivory, gold for a heavy blow.
func spawn(owner: Node3D, damage: int, height: float = 2.2, tint: Color = Color(0, 0, 0, 0)) -> void:
	if not owner.is_inside_tree() or owner.get_parent() == null:
		return
	for i in range(_shown.size() - 1, -1, -1):
		if _clock - float(_shown[i]["born"]) >= LIFE or not is_instance_valid(_shown[i]["label"]):
			_shown.remove_at(i)
	var cam := owner.get_viewport().get_camera_3d()
	var view := cam.global_transform if cam else \
		Transform3D(Basis.IDENTITY, owner.global_position + Vector3(0, 3.0, 8.0)) # (no camera: seen from the south)
	var others: Array[Vector3] = []
	var widths: Array[float] = []
	for s in _shown:
		others.append(rise_at(s["at"] as Vector3, _clock - float(s["born"])))
		widths.append(float(s["width"]))
	var text := str(damage)
	var width := text.length() * CHAR_W
	var at := place(view, owner.global_position + Vector3(0, height, 0), width, others, widths)
	var l := Label3D.new()
	l.text = text
	l.font = UiTheme.font("inter-latin-700-normal")
	l.font_size = 96
	l.pixel_size = 0.004
	l.outline_size = 18
	l.modulate = tint if tint.a > 0.0 else (Color("#F2E9DD") if damage < 18 else Color("#D9B778"))
	l.outline_modulate = Color(0.07, 0.05, 0.1, 0.9)
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.fixed_size = false
	owner.get_parent().add_child(l)
	l.global_position = at
	_shown.append({"label": l, "born": _clock, "at": at, "width": width})
	var tw := l.create_tween()
	tw.set_parallel(true)
	tw.tween_property(l, "global_position:y", at.y + RISE_BY, RISE)
	tw.tween_property(l, "modulate:a", 0.0, LIFE - 0.25).set_delay(0.25)
	tw.chain().tween_callback(l.queue_free)


## Where a number that appeared at `at` is `age` s later.
static func rise_at(at: Vector3, age: float) -> Vector3:
	return at + Vector3(0, RISE_BY * clampf(age / RISE, 0.0, 1.0), 0)


## Where a new number `width` m wide goes: `base` (above its target), or the nearest place beside it along the view's
## right whose column on screen clears every number still showing (`others`: where they are now, `widths`: theirs) by
## GAP; when none clears them all, the one with the most room.
static func place(view: Transform3D, base: Vector3, width: float, others: Array[Vector3], widths: Array[float]) -> Vector3:
	var right := view.basis.x
	right.y = 0.0
	right = right.normalized() if right.length() > 0.01 else Vector3.RIGHT
	var inv := view.affine_inverse()
	var best := base
	var most := -INF
	for k: int in PLACES:
		var p := base + right * STEP * k
		var room := INF
		for i in others.size():
			room = minf(room, clearance(inv, p, width, others[i], widths[i]))
		if room >= GAP:
			return p
		if room > most:
			most = room
			best = p
	return best


## The room between two numbers' columns as the view sees them (`inv`: the view's inverse), in metres at the first
## one's depth — negative where they overlap.
static func clearance(inv: Transform3D, p: Vector3, w: float, q: Vector3, wq: float) -> float:
	var a := inv * p
	var b := inv * q
	var da := maxf(-a.z, 0.1)
	var db := maxf(-b.z, 0.1)
	return (absf(a.x / da - b.x / db) - 0.5 * w / da - 0.5 * wq / db) * da
