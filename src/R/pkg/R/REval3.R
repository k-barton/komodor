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


`TclReval2` <- 
function(id) .Reval2(id)


# Note:
# iconv(sub="byte") replaces high chars with <hh>, so to distinguish from a
# literal string "<hh>", all "<" are first substituted for "<3c>" 
.encodeResult <-
function(text)
#iconv(gsub("(<[0-9a-f]{2}>)", "\x1a{\\1}", encodeString(enc2utf8(text))), "UTF-8", "ASCII", "byte")
iconv(encodeString(enc2utf8(gsub("<", "<3c>", text))), "UTF-8", "ASCII", "byte")


`.Reval` <- 
function(x, id, mode) {
	if (identical(x, "")) {
	    tcl("set", "retval", "")  # is set in the function scope
	    return(invisible())
	}

    # XXX currently hidden eval mode implies: no continuation, no traceback, 
    # no width option set, evaluation in .GlobalEnv. These should eventually 
    # become separate options.

	visible <- ! grepl("h", mode, fixed = TRUE)
	realtime <- grepl("r", mode, fixed = TRUE)
		
	#isEncoded <- grepl("x", mode, fixed = TRUE)
	#if(isEncoded) x <- iconv(x, from = "UTF-8")
	Encoding(x) <- "UTF-8"
	x <- gsub('<3c>', '<', gsub('<5c>', '\\', x, fixed = TRUE), fixed = TRUE)

	markStdErr <- TRUE  # XXX FALSE in hidden mode or separate option ?
	
	message("Reval: id=", id, ", visible=", visible, ", realtime=", realtime)
	
	exprVarName <- paste0("expr.", id)
	rmTemp(exprVarName)
	width <- 0L
	if (visible) {
	    prevcodeVarName <- paste0("part.", id)
	    prevcode <- getTemp(prevcodeVarName)

	    if (startsWith(x, "\005\021")) {
	        cat("<interrupted> \n")
	        x <- substr(x, 3L, nchar(x))
	        prevcode <- NULL
	    } else if(startsWith(x, "\005\022") &&
			(pos <- regexpr(";", x, fixed = TRUE)) > 0L && (pos < 10L)) {
			width <- as.integer(substr(x, 3L, pos - 1L))[1L]
			if(!is.finite(width)) width <- 0L
			x <- substr(x, pos + 1L, nchar(x))
		}
		x <- c(prevcode, x)
	    cat(":> ", x, "\n")  # if mode in [e,u]
	}
	expr <- parseText(x, encoding = "native.enc")
	
	if (!is.expression(expr) && is.na(expr)) {
	    rval <- ""
	    msg <- "more"
	} else {
	    if(inherits(expr, "error")) {
	        rval <- paste0(c("\033\003;", as.character.error(expr), "\033\002;"),
				collapse = "")
	        msg <- "parse-error"
	    } else if(realtime) {
			rval <- normalizePath(file.path(tempdir(), "koroutput"), mustWork = FALSE)
			attr(expr, "visible") <- visible
			attr(expr, "width") <- width
			attr(expr, "file") <- rval
			assignTemp(exprVarName, expr)
	        msg <- "file"
		} else {
			oop <- if(width > 0) options(width = width) else NULL
			
			if(width > 0) message("Reval: width=", getOption("width"))
	        rval <- captureAll(expr, markStdErr = markStdErr,
					envir = if(visible) getEvalEnv() else .GlobalEnv,
					doTraceback = visible)
			if(!is.null(oop)) options(oop)
	        msg <- "done"
	    }
		rval <- .encodeResult(rval)
	}
	
	if(visible)
		if (msg == "more") assignTemp(prevcodeVarName, x) else
			rmTemp(prevcodeVarName)
			
	tcl("set", "retval", paste(msg,
		 visible && identical(msg, "done") && !identical(.GlobalEnv, getEvalEnv()), # == browserMode
		 paste0(rval, collapse = "\n"), sep = "\x1f", collapse = ""))

}

`.Reval2` <-
function(id) {
	message("Reval2 ", id)
	exprVarName <- paste0("expr.", id)
	expr <- getTemp(exprVarName)
	if(is.null(expr) || !is.expression(expr)) return()
	rmTemp(exprVarName)

	as.logical(attr(expr, "visible")) -> visible
	as.integer(attr(expr, "width")) -> width
	attr(expr, "file") -> outfile
	
	message("Reval2: writing to ", outfile)

	markStdErr <- TRUE
	outconn <- file(outfile, "wb", blocking = FALSE)
	on.exit(close(outconn))
	oop <- if(width > 0) options(width = width) else NULL
	captureAll(expr, conn = outconn, markStdErr = markStdErr,
		envir = if(visible) getEvalEnv() else .GlobalEnv,
		doTraceback = visible)
	cat(file = outconn, append = TRUE,
		"\n", # final control sequences have to be in a separate line
		if(visible && !identical(.GlobalEnv, getEvalEnv()))
			"\033B;" else "\033G;",
			"\033\004;")
	if(!is.null(oop)) options(oop)
	message("Reval2: done")
	koCmd(sprintf("kor.fireEvent(\"r-command-executed2\", {filename:%s})",
		deparse(outfile)))
    tcl("set", "retval", 0L)
}
