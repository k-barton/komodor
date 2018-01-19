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

## XXX: make wrapper for TclReval? Whole body shows in call stack

`TclReval` <- 
function(x, id, mode) .Reval(x, id, mode)


`.Reval` <- 
function(x, id, mode) {

	if (identical(x, "")) {
	    tcl("set", "retval", "")  # is set in the function scope
	    return(invisible())
	}
	
	Encoding(x) <- "UTF-8"
	
	evalShown <- mode != "h"
	markStdErr <- TRUE  # XXX FALSE in hidden mode ?
	
	optWidth <- 0L
	if (evalShown) {
	    prevcodeVarName <- paste0("part.", id)
	    prevcode <- getTemp(prevcodeVarName)
	    
	    ## check for ESCape character at the beginning. If one, break multiline
	    if (substr(x, 1L, 1L) == "\033") {
	        cat("<interrupted>\n")
	        x <- substr(x, 2L, nchar(x))
	        prevcode <- NULL
	    } else if(substr(x, 1L, 1L) == "\005" &&
			(pos <- regexpr(";", x, fixed = TRUE)) > 0L
			) {
			opt <- substr(x, 2L, pos - 1L)
			optWidth <- as.integer(opt)[1L]
			if(!is.finite(optWidth)) optWidth <- 0L
			x <- substr(x, pos + 1L, nchar(x))
			#x <- "\005width=80\002print(1:1000)\n"
			#x <- "\00580;print(1:1000)\n"
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
			# XXX currently hidden eval mode implies: no traceback, evaluation in .GlobalEnv.
			#     These should become separate options.
			
			oop <- if(optWidth > 0)
				options(width = optWidth) else NULL
	        ret <- captureAll(expr, markStdErr = markStdErr,
					envir = if(evalShown) getEvalEnv() else .GlobalEnv,
					doTraceback = evalShown)
			if(!is.null(oop)) options(oop)
	        msg <- "done"
	    }
	}
	
	if (evalShown)
		if (msg == "more") assignTemp(prevcodeVarName, c(prevcode, x)) else
			rmTemp(prevcodeVarName)
			
    browserMode <- evalShown && identical(msg, "done") && !identical(.GlobalEnv, getEvalEnv())
	
	tcl("set", "retval", stringize(list(result = c(ret), message = msg, browserMode = browserMode)))
}