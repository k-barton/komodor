
# importFrom("tcltk", ".Tcl", "tcl", ".Tcl.callback")

# # Example: make a R function return a value in Tcl:
# # R function should assign the result to some Tcl value
# # .Tcl("set retval") # <- retval is set locally within the function scope
# # funTest <- function(x) tcl("set", "retval", round(runif(as.numeric(x)), 3))
# # then, include it the 'retval' argument
# # tclfun(funTest, retval="retval")
# # .Tcl("funTest 10")

`tclfun` <- function(f, fname = deparse(substitute(f)), retval = NA,
					 body = "%s") {
	cmd <- .Tcl.callback(f)
	if (is.character(retval))
		body <- paste("%s; return $", retval, sep = "")
	cmd2 <- sprintf(paste("proc %s {%s} {", body, "}"),
		fname,
		paste(names(formals(f)), collapse = " "),
		gsub("%", "$", cmd, fixed = TRUE))
	.Tcl(cmd2)
	cmd2
}

`TclReval` <- 
function(x, id, mode) {

	if (x != "") {
		Encoding(x) <- "UTF-8"
		prevcodeVarName <- paste("part", id, sep = ".")
		.tempEnv <- tempEnv()

		prevcode <- if(exists(prevcodeVarName, .tempEnv, inherits = FALSE))
			get(prevcodeVarName, .tempEnv, inherits = FALSE) else NULL

		## check for ESCape character at the beginning. If one, break multiline
		if(substr(x, 1L, 1L) == "\x1b") {
			cat("ESC!\n")
			x <- substr(x, 2L, nchar(x))
			prevcode <- NULL
		}

		if (mode != "h") cat(":> ", c(prevcode, x), "\n") # if mode in [e,u]

		expr <- parseText(c(prevcode, x))

		if(!is.expression(expr) && is.na(expr)) {
			ret <- ''
			msg <- 'more'
			assign(prevcodeVarName, c(prevcode, x), .tempEnv)
		} else {
			if(inherits(expr, "try-error")) {
				ret <- c('\x03', c(expr), '\x02')
				msg <- 'parse-error'
			} else {
				ret <- captureAll(expr, markStdErr = TRUE, envir = getEvalEnv())
				msg <- 'done'
			}

			if(exists(prevcodeVarName, .tempEnv, inherits = FALSE))
				rm(list = prevcodeVarName, envir = .tempEnv)
		}
		tcl("set", "retval", stringize(list(result = c(ret), message = msg)))
	} else {
		tcl("set", "retval", "") # is set in the function scope
	}
}

`TclReval2` <- function(x, id, mode) {
	if (x != "") {
		Encoding(x) <- "UTF-8"

		prevcodeVarName <- paste("part", id, sep=".")
		.tempEnv <- tempEnv()

		prevcode <- if(exists(prevcodeVarName, .tempEnv, inherits = FALSE))
			get(prevcodeVarName, .tempEnv, inherits = FALSE) else NULL

		# check for ESCape character at the beginning. If one, break multiline
		if(substr(x, 1L, 1L) == "\x1b") {
			x <- substr(x, 2L, nchar(x))
			prevcode <- NULL
		}

		if (mode != "h") cat(":> ", c(prevcode, x), "\n") # if mode in [e,u]

		expr <- parseText(c(prevcode, x))

		if(!is.expression(expr) && is.na(expr)) {
			ret <- ''
			msg <- 'Want more'
			assign(prevcodeVarName, c(prevcode, x), .tempEnv)
		} else {
			if(inherits(expr, "try-error")) {
				ret <- c('\x03', c(expr), '\x02')
				msg <- 'Parse error'
			} else {
				ret <- ""
				msg <- 'OK'
			}
			if(exists(prevcodeVarName, .tempEnv, inherits = FALSE))
				rm(list = prevcodeVarName, envir = .tempEnv)
		}
		tcl("set", "retval", stringize(list(result = c(ret), message = msg)))
	} else {
		tcl("set", "retval", "") # is set in the function scope
	}
}

`TclRprint` <- function(x, debug = 0) {
	if(debug < getOption('warn')) {
		Encoding(x) <- "UTF-8"
		cat(sprintf("[[ %s ]]", x), "\n")
	}
	invisible(x)
}