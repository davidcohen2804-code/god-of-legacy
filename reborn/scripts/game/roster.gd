class_name Roster
extends RefCounted
## The playable characters, read from res://data/characters.json. Data-driven: a new class is a new entry in that
## file, not new code. Locking is decided here (and checked again by Game) — never by the interface alone.


class Character:
	var id := ""
	var name := ""
	var title := ""
	var locked := true
	var weapon := ""
	var accent := Color.WHITE
	var summary := ""
	var style := PackedStringArray()

	static func from_dict(d: Dictionary) -> Character:
		var c := Character.new()
		c.id = str(d.get("id", ""))
		c.name = str(d.get("name", c.id))
		c.title = str(d.get("title", ""))
		c.locked = bool(d.get("locked", true))
		c.weapon = str(d.get("weapon", ""))
		c.accent = Color(str(d.get("accent", "#ffffff")))
		c.summary = str(d.get("summary", ""))
		c.style = PackedStringArray(d.get("style", []))
		return c


## Character entries, in their display order.
var characters: Array = []


static func load_from(path: String) -> Roster:
	var r := Roster.new()
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("Roster: cannot read %s" % path)
		return r
	for d in (parsed as Dictionary).get("characters", []):
		if typeof(d) == TYPE_DICTIONARY:
			r.characters.append(Character.from_dict(d))
	return r


static func load_default() -> Roster:
	return load_from("res://data/characters.json")


func find(id: String) -> Character:
	for c in characters:
		if c.id == id:
			return c
	return null


func can_play(id: String) -> bool:
	var c := find(id)
	return c != null and not c.locked
