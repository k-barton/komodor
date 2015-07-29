proc compile_json {spec data} {
  while [llength $spec] {
	set type [lindex $spec 0]
	set spec [lrange $spec 1 end]

	switch -- $type {
	  dict {
		lappend spec * string

		set json {}
		foreach {key val} $data {
		  foreach {keymatch valtype} $spec {
			if {[string match $keymatch $key]} {
			  lappend json [subst {"$key":[compile_json $valtype $val]}]
			  break
			}
		  }
		}
		return "{[join $json ,]}"
	  }
	  list {
		if {![llength $spec]} {
		  set spec string
		} else {
		  set spec [lindex $spec 0]
		}
		set json {}
		foreach {val} $data {
		  lappend json "[compile_json $spec $val]"
		}
		return "\[[join $json ,]\]"
	  }
	  string {
		if {[string is double -strict $data]} {
		  return $data
		} else {
		  return \"[escape_nonprintable $data]\"
		}
	  }
	  num { return "$data" }
	  default {error "Invalid type"}
	}
  }
}

#Convert all low-Ascii characters into \u escape sequences by using regsub and subst in combination:
proc escape_nonprintable {str} {

	set str [string map [list \\ \\\\ \" \\" \n \\n \b \\b \r \\r \t \\t ] $str]

	# meaningful Tcl characters must be escaped too
	#set RE {[\[\]\{\};#\$\u0000-\u001f]}
	set RE {[\[\{\};#\$\u0000-\u001f]}

	# We will substitute with a fragment of Tcl script in brackets
	set substitution {[format \\\\u%04x [scan "\\&" %c]]}

	# Now we apply the substitution to get a subst-string that
	# will perform the computational parts of the conversion.


	#return [subst -nobackslashes -novariables [regsub -all $RE $str $substitution]]
	return [string map {\\u005b [ \\u007b \{} \
		[subst -nobackslashes -novariables [regsub -all $RE $str $substitution]]]
	#return [regsub -all $RE $str $substitution]

}
