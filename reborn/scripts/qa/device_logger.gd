class_name DeviceLogger
extends Logger
## (Device test) The engine's own errors and warnings, counted as they are raised (GPT's v1.7: kept apart from the
## page's JavaScript errors and WebGL context losses — a listener on the browser's console alone would not see them
## all). Registered with OS.add_logger() in the device test only. The engine calls it from any thread, possibly at once:
## a mutex guards its counts; it never prints (that would call it again).

var _mutex := Mutex.new()
var _errors := 0
var _warnings := 0
var _last: Array[String] = []


func _log_error(_function: String, file: String, line: int, code: String, rationale: String, _editor_notify: bool,
		error_type: int, _script_backtraces: Array[ScriptBacktrace]) -> void:
	_mutex.lock()
	if error_type == ERROR_TYPE_WARNING:
		_warnings += 1
	else:
		_errors += 1
		var what := rationale if rationale != "" else code
		_last.append(("%s (%s:%d)" % [what, file.get_file(), line]).left(150))
		if _last.size() > 3:
			_last.pop_front()
	_mutex.unlock()


func _log_message(_message: String, _error: bool) -> void:
	pass


## {errors, warnings, last: the last three errors}.
func snapshot() -> Dictionary:
	_mutex.lock()
	var d := {"errors": _errors, "warnings": _warnings, "last": _last.duplicate()}
	_mutex.unlock()
	return d
