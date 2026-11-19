class_name TargetData
extends RefCounted
## What each combat target is and what it resists (data/targets.json, GPT's v1.2 decisions): its health, its size, and
## whether the Phantom Chain's pull and Rising Slash's launch can move it — explicit, so the skills ask the target's
## data instead of guessing. Loaded once.

const PATH := "res://data/targets.json"

static var _all := {}


static func of(id: String) -> Dictionary:
	if _all.is_empty():
		var d: Variant = JSON.parse_string(FileAccess.get_file_as_string(PATH))
		_all = d if typeof(d) == TYPE_DICTIONARY else {"_failed": true}
	return _all.get(id, {})
