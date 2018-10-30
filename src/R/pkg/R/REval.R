	# TODO: mode: Hidden, Traceback, Dynamic (via file?)
	#modestrAll <- c("hidden", "traceback", "dynamic", "raw", "mark-streams")
	#modestr <- c("h", "t", "r")
	#modestr <- match.arg(modestr, choices = modestrAll, several.ok = TRUE)
	# mode is specified as single integer (0-255) or raw or character

    # XXX Encode mode (in JS)	
	# mode <- 128L # hi tb dn rw .. .. .. xx
	# for(j in which(modestrAll %in% modestr)) mode <- bitwOr(mode, 2L^(j - 1L))
	# intToBits(mode)
	# rawToChar(as.raw(mode))
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

	.encodeResult <- function(text)
		iconv(gsub("(<[0-9a-f]{2}>)", "\x1a{\\1}", encodeString(enc2utf8(text))), "UTF-8", "ASCII", "byte")

	
	evalShown <- ! grepl("h", mode, fixed = TRUE)
	isEncoded <- grepl("x", mode, fixed = TRUE)

	if(isEncoded) x <- iconv(x, from = "UTF-8")
	Encoding(x) <- "UTF-8"

	markStdErr <- TRUE  # XXX FALSE in hidden mode ?
	
	optWidth <- 0L
	if (evalShown) {
	    prevcodeVarName <- paste0("part.", id)
	    prevcode <- getTemp(prevcodeVarName)
	    
	    if (substr(x, 1L, 1L) == "\033") {
	        cat("<interrupted>\n")
	        x <- substr(x, 2L, nchar(x))
	        prevcode <- NULL
	    } else if(substr(x, 1L, 1L) == "\005" &&
			(pos <- regexpr(";", x, fixed = TRUE)) > 0L) {
			opt <- substr(x, 2L, pos - 1L)
			optWidth <- as.integer(opt)[1L]
			if(!is.finite(optWidth)) optWidth <- 0L
			x <- substr(x, pos + 1L, nchar(x))
		}
	    cat(":> ", c(prevcode, x), "\n")  # if mode in [e,u]
	    expr <- parseText(c(prevcode, x))
	} else {
	    expr <- parseText(x)
	}
	
	if (!is.expression(expr) && is.na(expr)) {
	    rval <- ""
	    msg <- "more"
	} else {
	    if (inherits(expr, "error")) {
	        rval <- c("\x03", .encodeResult(as.character.error(expr)), "\x02")
	        msg <- "parse-error"
	    } else {
			# XXX currently hidden eval mode implies: no traceback, evaluation in .GlobalEnv.
			# These should become separate options.
			
			oop <- if(optWidth > 0)
				options(width = optWidth) else NULL
	        rval <- captureAll(expr, markStdErr = markStdErr,
					envir = if(evalShown) getEvalEnv() else .GlobalEnv,
					doTraceback = evalShown)
			
			rval <- iconv(gsub("(<[0-9a-f]{2}>)", "\x1a{\\1}", encodeString(enc2utf8(rval))), "UTF-8", "ASCII", "byte")

			if(!is.null(oop)) options(oop)
	        msg <- "done"
	    }
	}
	
	if (evalShown)
		if (msg == "more") assignTemp(prevcodeVarName, c(prevcode, x)) else
			rmTemp(prevcodeVarName)
			
	tcl("set", "retval", paste(msg,
		 evalShown && identical(msg, "done") && !identical(.GlobalEnv, getEvalEnv()), # = browserMode
		 paste0(rval, collapse = "\n"), sep = "\x1f", collapse = ""))
}