
# importFrom("tcltk", ".Tcl", "tcl", ".Tcl.callback")

# # Example: make the R function return a value in Tcl:
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
	
	# TODO: mode: Hidden, Traceback, Dynamic (via file?)
	#modestrAll <- c("hidden", "traceback", "dynamic", "raw", "mark-streams")
	#modestr <- c("h", "t", "r")
	#modestr <- match.arg(modestr, choices = modestrAll, several.ok = TRUE)
	# mode is specified as single integer (0-255) or raw or character

    # XXX Encode mode (in JS)	
	#mode <- 128L # hi tb dn rw .. .. .. xx
	#for(j in which(modestrAll %in% modestr)) mode <- bitwOr(mode, 2L^(j - 1L))
	#intToBits(mode)
	#rawToChar(as.raw(mode))
	# XXX Decode mode:
	# evalHidden <- bitwAnd(1L, mode) == 1L
	# doTraceback <- bitwAnd(2L, mode) == 2L
	# dynamicOutput <- bitwAnd(4L, mode) == 4L
	# stringizeOutput <- bitwAnd(4L, mode) == 0L # zero
	
	if (identical(x, "")) {
	    tcl("set", "retval", "")  # is set in the function scope
	    return(invisible())
	}
	
	Encoding(x) <- "UTF-8"
	
	evalShown <- mode != "h"
	markStdErr <- TRUE  # XXX FALSE in hidden mode ?
	
	if (evalShown) {
	    prevcodeVarName <- paste0("part.", id)
	    prevcode <- getTemp(prevcodeVarName)
	    
	    ## check for ESCape character at the beginning. If one, break multiline
	    if (substr(x, 1L, 1L) == "\033") {
	        cat("<interrupted>\n")
	        x <- substr(x, 2L, nchar(x))
	        prevcode <- NULL
	    }
		# prints in R console:
	    cat(":> ", c(prevcode, x), "\n")  # if mode in [e,u]
	    expr <- parseText(c(prevcode, x))
	} else {
		#cat("~> ", x, "\n")  # if mode in [e,u]
	    expr <- parseText(x)
	}
	
	if (!is.expression(expr) && is.na(expr)) {
	    ret <- ""
	    msg <- "more"
	} else {
	    if (inherits(expr, "try-error")) {
	        ret <- c("\003", c(expr), "\002")
	        msg <- "parse-error"
	    } else {
	        ret <- captureAll(expr, markStdErr = markStdErr, envir = getEvalEnv(), doTraceback = evalShown)
	        msg <- "done"
	    }
	}
	
	if (evalShown) if (msg == "more") assignTemp(prevcodeVarName, c(prevcode, x)) else rmTemp(prevcodeVarName)
	
	tcl("set", "retval", stringize(list(result = c(ret), message = msg)))
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
			msg <- 'more'
			assign(prevcodeVarName, c(prevcode, x), .tempEnv)
		} else {
			if(inherits(expr, "try-error")) {
				ret <- c('\x03', c(expr), '\x02')
				msg <- 'parse-error'
			} else {
				ret <- ""
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

`TclRprint` <- function(x, debug = 0L) {
	if(debug < getOption('warn')) {
		Encoding(x) <- "UTF-8"
		cat(sprintf("[[ %s ]]", x), "\n")
	}
	invisible(x)
}