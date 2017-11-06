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

    cmd <- paste0(gsub("\f", "\\f", gsub("\r", "\\r", gsub("\n", "\\n",
				gsub("\\", "\\\\", cmd, fixed = TRUE), fixed = TRUE),
				fixed = TRUE), fixed = TRUE), collapse = "\\n")

	#set command [string map [list "\\" {\\} "\n" {\n} "\r" {\r} "\f" {\f}] $command]
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

    writeLines(paste0("{js}", cmd), con)
    res <- readLines(con)
    return(res)
}