class_name HitResolver
extends RefCounted
## The resolver of an enemy's blow against a defender (GPT's v1.2 / v1.3 direction for Shadow Counter). One fixed tick
## of the attacker's active window — its blade over the slice of the window this tick swept (SwordSweep, the same
## baked-path sweep the Samurai's own cuts use) — is tested against the defender's hurt capsule along the defender's
## own movement through the same tick, at the same moments. Where the blade first touches him, the moment decides:
##   evaded  — he was inside Shadow Step's defensive window then and the blow would have struck him: a genuine evasion
##             (the authoritative event attack_evaded; it opens Shadow Counter). GPT's v1.4 rule B (data: step.evade
##             "shadow"): "would have struck him" is tested against his Shadow Origin — the hurtbox where he stood when
##             the step's movement began — through the whole 120 ms window ("had he not stepped"); the shadow is only
##             that test's reference: it takes no damage, catches nothing and blocks nothing;
##   avoided — he was inside a roll's defensive window (the plain dodge): no damage, and nothing opens;
##   hit     — otherwise: the blow lands.
## No contact at all — he was out of its reach or out of its path, or had moved out of it in time — is nothing: an
## attack that misses naturally opens nothing, however he moved, and a step with no blow coming opens nothing. The
## attacker resolves each of its attacks against a defender at most once (MeleeState: one result per target per
## activation), so a qualifying evasion is reported once per attack. Pure logic; the tests drive it directly.


## The outcome of one tick's slice `span` (fractions of `a`'s active window) of a blow by an attacker standing at
## `attacker` facing `facing` (radians), against a capsule (`radius`, `height`) that moved from `body_from` to
## `body_to` through the tick: {} when the blade does not touch it; else {result: "evaded" | "avoided" | "hit", at:
## the moment of contact, 0..1 through the tick}. `evade` and `iframes` are the parts of the tick (fractions; x < 0:
## none) the defender spent inside Shadow Step's defensive window and inside a roll's. The tick is taken in up to
## three parts — before the defensive window, inside it, after it — and the earliest contact decides:
##   inside the window, with `shadow` (finite, GPT's v1.4 rule B): the blade is tested against the capsule standing at
##     the Shadow Origin — where he stood when the step's movement began; touching it is a genuine evasion ("it would
##     have struck him had he not stepped"). His moving body is in shadow meanwhile: not struck (GPT's v1.5: the
##     window's full protection; normal contact again the moment it ends);
##   inside the window without a shadow (the literal rule): a blow reaching his moving body is evaded;
##   outside it: a blow reaching his moving body lands — or is avoided inside a roll's window.
## A step blocked at once by geometry (`blocked`: GPT's v1.5 — no stationary invulnerability against a wall) has no
## defensive window at all: no evasion, no protection — a blow reaching his body lands.
static func resolve(a: AttackData, attacker: Vector3, facing: float, span: Vector2, body_from: Vector3,
		body_to: Vector3, radius: float, height: float, evade: Vector2, iframes: Vector2,
		shadow: Vector3 = Vector3.INF, blocked: bool = false) -> Dictionary:
	var parts: Array[Vector3] = [] # (from, to, inside the window: 1 / 0)
	if blocked:
		evade = Vector2(-1, -1)
	if evade.x < 0.0:
		parts.append(Vector3(0.0, 1.0, 0.0))
	else:
		if evade.x > 0.0:
			parts.append(Vector3(0.0, evade.x, 0.0))
		parts.append(Vector3(evade.x, evade.y, 1.0))
		if evade.y < 1.0:
			parts.append(Vector3(evade.y, 1.0, 0.0))
	for part in parts:
		var sub := Vector2(lerpf(span.x, span.y, part.x), lerpf(span.x, span.y, part.y))
		var b0 := body_from.lerp(body_to, part.x)
		var b1 := body_from.lerp(body_to, part.y)
		var in_window := part.z > 0.5
		if in_window and shadow.is_finite():
			var g := SwordSweep.first_contact(a, attacker, facing, sub, shadow, radius, height)
			if g >= 0.0:
				return {"result": "evaded", "at": lerpf(part.x, part.y, g)}
			continue # (his body is in shadow through the window: the blade passes him by)
		var f := SwordSweep.first_contact(a, attacker, facing, sub, b1, radius, height, b0)
		if f < 0.0:
			continue
		var at := lerpf(part.x, part.y, f)
		if in_window:
			return {"result": "evaded", "at": at}
		return {"result": "avoided" if inside(at, iframes) else "hit", "at": at}
	return {}


## Is the moment `f` of a tick inside `span` (a part of the same tick; x < 0: none)?
static func inside(f: float, span: Vector2) -> bool:
	return span.x >= 0.0 and f >= span.x - 1e-6 and f <= span.y + 1e-6


## The part of a tick that lay inside `window`, both in seconds of the same clock: the tick ran from `ran.x` to
## `ran.y`. Fractions 0..1 of the tick; (-1, -1) when the tick and the window do not meet (or there is no window).
## A tick in which the clock stood still (hit-stop) lies wholly inside or wholly outside.
static func overlap(window: Vector2, ran: Vector2) -> Vector2:
	if window == Vector2.ZERO or ran.x < 0.0:
		return Vector2(-1, -1)
	if ran.y - ran.x < 1e-9:
		return Vector2(0, 1) if ran.x >= window.x and ran.x <= window.y else Vector2(-1, -1)
	if window.y < ran.x or window.x > ran.y:
		return Vector2(-1, -1)
	var d := ran.y - ran.x
	return Vector2(clampf((window.x - ran.x) / d, 0.0, 1.0), clampf((window.y - ran.x) / d, 0.0, 1.0))
