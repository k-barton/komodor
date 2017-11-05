#' @title Communication between R and Komodo
#' @rdname rserver
#' @name rserver
#' @aliases startServer enumServers stopAllServers enumConnections stopAllConnections
# @keywords internal
#' @encoding utf-8
#' @md
#' @description
#' Communication between R and a client through a socket connection.
#' @details
#' Result is evaluated in R and sent back serialized in JSON format.
#' The client should format the data in a following way:
#'
#'   * escape newline, carriage returns, formfeeds and backslashes with a backslash
#'   * if the first character is ASCII #001 then the next character is interpreted as evaluation mode specifier
#      [currently mode is ignored].
#'   * command ends with a newline.
#'
#' @return The result is an object with two components `"result"` and `"message"`.
#' The "message" can be one of: "more" (incomplete code, waiting for continuation), "parse-error" or "done".
#' In the "result", element 'stdout' and 'stdin' streams are delimited by ASCII characters #003 and #002.
#' @note
#' Multiple servers can be started (on different ports), and each can
#' simultanously accept multiple connections.
# TODO: how to send user interrupt?
#' @author Kamil Barto\enc{ń}{n}

#.init.Rserver()
# startServer(11111)
# listConnections()
# enumServers()
# stopAllServers()
# stopAllConnections()
# tcl("Rserver::Reval", "runif(4)", "")


#' @export
#' @param port integer. The port number.
`startServer` <-
function(port) tcl("Rserver::Start", port)

#' @export
#' @describeIn rserver enumerate running servers
`enumServers` <-
function() as.character(.Tcl("array names Rserver::Server"))

#' @export
#' @describeIn rserver stop all running servers
`stopAllServers` <- function() {
	num <- as.numeric(.Tcl("array size Rserver::Server"))
	.Tcl('foreach {name} [array names Rserver::Server] { Rserver::Stop $name }')
	return(num)
}

#' @export
#' @describeIn rserver enumerate all open connections
`enumConnections` <-
function() as.character(.Tcl("array names Rserver::Connection"))

#' @export
#' @describeIn rserver close all open connections
`stopAllConnections` <- function() {
	num <- as.numeric(.Tcl("array size Rserver::Connection"))
	.Tcl('Rserver::CloseAllConnections')
	return(num)
}

## tcl-based JSON - not working properly so far.
#tclJSON <- function(x, msg = "Done") {
#	.Tcl("set result {}")
#	tcl(if(length(x) == 1) "lappend" else "set", "result", x)
#	.Tcl("set retval [dict create]")
#	.Tcl("dict set retval result $result")
#	tcl("dict", "set", "retval", "message", msg)
#	.Tcl("set retval [compile_json {dict result list message string} $retval]")
#}

init.Rserver <- function() {
	tclscripts <- dir(path <- system.file(package = .packageName, "exec"), 
		full.names = TRUE)
	for(script in tclscripts) tcl('source', script)
	tclfun(TclReval, "Rserver::Reval", retval = "retval")
	tclfun(TclRprint, 'Rserver::Rprint')
	# tclfun(tcJSON, "TestJSON", retval = "retval")
	# message("R server tcl functions defined.")
}
