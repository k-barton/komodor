# <LICENSE BLOCK:Rserver>

namespace eval Rserver {

variable Server; array set Server {}; # Rserver
variable Connection; array set Connection {}
# variable Results; array set Results {}

namespace export Start Stop CloseAllConnections Rprint

# This code relies on functions defined from R: 'Rprint' and 'Reval'
# Just to avoid errors, define dummy functions here
proc Rprint {args} {}
proc Reval {args} {}

#proc bgerror {err} { Rprint "$err \n" }

proc Start {port} {
	variable Server
	if {[expr ! [ info exists Server($port) ] ]} {

	if [catch {
		set Server($port) [socket -server Rserver::ConnectionAccept $port]
	} err1] {
			Rprint "Error: in 'Rserver::Start': $err1" 1
			return 0
		}
	}
	return $Server($port)
}

proc Stop {port} {
    variable Server
	if {[ info exists Server($port) ]} {

		if [catch { close $Server($port) } err1] {
			Rprint "Error: in 'Rserver::Stop': $err1" 1
		}
		#close $Server($port)
		unset Server($port)
		Rprint "Server at port $port closed" 1
		return 1
	}
	return 0
}

proc CloseAllConnections {} {
	variable Connection
	foreach {id conn} [array get Connection] {
		if [catch { close [lindex $conn 2] } err1] {
			Rprint "Error in 'Rserver::CloseAllConnections': $err1" 1
		}
		#close [lindex $conn 2]
		unset Connection($id)
	}
}

proc ConnectionAccept {sock addr port} {
	variable Connection

	Rprint "Accept $sock from $addr port $port" 0

    set Connection(addr,$sock) [list $addr $port $sock]

    # Ensure that each "puts" by the server
    # results in a network transmission
    fconfigure $sock -buffering line -blocking 0 -encoding "utf-8" 
    # -translation {auto lf} # XXX: Setting this breaks the completion 

    # Set up a callback for when the client sends data
    fileevent $sock readable [list Rserver::DoServe $sock]
}

#can't read "Rserver::Results(addr,sock448)": no such element in array
#    while executing
#"return $Rserver::Results($id) "
#    (procedure "Reval" line 1)
#    invoked from within
#"Reval $line "addr,$sock""
#    (procedure "Rserver::DoServe" line 16)
#    invoked from within
#"Rserver::DoServe sock448"

proc DoServe {sock} {
    variable Connection
    # Check end of file or abnormal connection drop,
    # then send evaluated data back to the client.

    if {[eof $sock] || [catch {gets $sock line}]} {
		if [catch { close $sock } err1] {
			Rprint "Error: in 'Rserver::DoServe': $err1" 1
		}
		#close $sock
		#set x Connection(addr,$sock)
		Rprint "Close $Connection(addr,$sock)" 1
		unset Connection(addr,$sock)
    } else {

#		Unescape special chars
		set line [string map [list {\n} "\n" {\r} "\r" {\f} "\f" {\\} "\\" ] $line]
#		Replace different newlines with \n
		set line [string map [list "\r\n" "\n" "\r" "\n"] $line]
		
		if {$line == ""} {
			return
		}

		if [catch {
			regexp  {(?s)\A\x01([a-z]*)(?:\<([^\>]+)\>|)(.*)\Z} $line ->>> r_mode r_sid r_command
			
			Rprint "command line was '$line', mode: $r_mode" 1
			
			#Rprint ":> $r_command [mode=$r_mode, sid=$r_sid]" 2

			#set line [Reval $line "addr,$sock"]
			set line [Reval "$r_command" $r_sid $r_mode]
			# XXX Here Raccept "$r_command" $r_sid $r_mode
			#          assign command to tempEnv$commands$r_sid
			if [catch { puts $sock $line } err1] {
				Rprint "Error: in 'Rserver::DoServe': $err1" 1
				close $sock
				unset Connection(addr,$sock)
			}
			# XXX Here Reval $r_sid -> start connection with ko-server -> sink output thereinto
		} err2] {
			Rprint "Error: in 'Rserver::DoServe': $err2" 1
		}
	}
}

}
# END namespace Rserver


# A simple client

namespace eval Rclient {

variable Connected
namespace export Socket_Client Start Ask

proc Start_TO { port {host "127.0.0.1"} {timeout 5} } {
	 variable Connected
	 set Connected {}
	 after $timeout { set Rclient::Connected timeout }
	 set conn [socket -async $host $port]
	 fconfigure $conn -buffering line
	 fileevent $conn w {set Connected ok}
	 vwait Connected
	 fileevent $conn w {}
	 puts "Connected = '$Connected'"
	 if {$Connected == "timeout"} {
		return -code error timeout
	 } else {
		set Connected {}
		return $conn
	 }
}

proc Start { port {host "127.0.0.1"} {timeout 5}} {
	if [catch { set conn [socket $host $port] } err1] {
		Rserver::Rprint "Error: in 'Rclient::Start': $err1" 1
		return -1
	}

    fconfigure $conn -buffering line
	return $conn
	#after $timeout {set connected timeout}
	#fileevent $conn w {set connected ok}
	#vwait connected
	#if {$connected == "timeout"} {
	#	return -code error timeout
	#} else {
	#	return $conn
	#}
}

proc Ask {command conn {prefix "\u0001e"}} {
	set command [string map [list "\\" {\\} "\n" {\n} "\r" {\r} "\f" {\f}] $command]

	puts $conn "$prefix$command"
	gets $conn line
	return $line
}

}
# END namespace Rclient

## Example:
#% set s [::Rclient::Start 11111]
#% Rclient::Ask runif(5) $s
#% close $s

# Example: two concurent connections in tcl:
#% set s [::Rclient::Start 11111]; set s1 [::Rclient::Start 11111]l
#% Rclient::Ask "runif(5" $s;  Rclient::Ask "Sys.time(" $s1; Rclient::Ask ", 0, 10)" $s; Rclient::Ask ")" $s1;
