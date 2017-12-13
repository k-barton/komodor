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

`TclReval` <- 
function(x, id, mode) {

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
	    if (inherits(expr, "error")) {
	        ret <- c("\003", as.character.error(expr), "\002")
	        msg <- "parse-error"
	    } else {
	        ret <- captureAll(expr, markStdErr = markStdErr, envir = getEvalEnv(), doTraceback = evalShown)
	        msg <- "done"
	    }
	}
	
	if (evalShown)
		if (msg == "more") assignTemp(prevcodeVarName, c(prevcode, x)) else
			rmTemp(prevcodeVarName)
	
	tcl("set", "retval", stringize(list(result = c(ret), message = msg)))
}