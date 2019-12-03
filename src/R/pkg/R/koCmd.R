#' Send JavaScript command to Komodo editor.
#' @md
#' @param cmd character string. a JavaScript command to be evaluated by Komodo. 
#' @param async logical. If `TRUE` the command returns immediately, if `FALSE` it waits for the response or
#'        until timeout.
#' @param host character string. Host name for the port.
#' @param port integer. The TCP port number.
#' @param timeout numeric. The timeout (in seconds) to be used for this connection. 
#' @param \dots additional arguments. Currently ignored.
#' @export
# from svGUI::koCmd (modified)
`koCmd` <- function (cmd, async = FALSE,
				   host = getOption("ko.host"),
				   port = getOption("ko.port"),
				   timeout = 1,
				   ...) {

	if(!is.numeric(port)) stop("Invalid port: ", port)

    prevopt <- options(timeout = max(1, floor(timeout)))

	con <- NULL
	on.exit({
		options(prevopt)
		if(inherits(con, "connection") && isOpen(con))
			close(con)
	})

	tryCatch(con <- socketConnection(host = host, port = port, blocking = !async),
		warning = function(e) stop(simpleError(paste("timeout on ", host, ":",
		    port, sep = ""))))

	# kor/connector defaultRequestHandler uses decodeURI 
    writeLines(paste0("{js}", .encodeResult(cmd)), con)
    res <- readLines(con)
    return(res)
}