#' Send output and error stream to a character string or connection.
#'
#' @md
#' @param expr a single `expression` to be evaluated.
#' @param conn currently not used. A file name or a connection, or `NULL` to return the output as a
#'        character vector. If the connection is not open, it will be opened initially and closed on exit.
#' @param markStdErr logical, should *stdout* be separated from *strerr* by ASCII characters STX (002) and
#'        ETX (#003)
#' @param envir the `environment` in which `expr` is to be evaluated. 
#' @param doTraceback logical, should traceback data be constructed in case of error? If `FALSE` no
#'        `traceback` would be possible for the captured computations. Set `doTraceback=FALSE` for internal commands
#'        to avoid overwriting of most recent user's errors and `warnings`.
#' @note The code is based on functions `capture.output` and `.try_silent` from package \pkg{utils}.
#' @export
`captureAll` <-
function (expr, conn = NULL, markStdErr = FALSE,
		envir = getEvalEnv(), doTraceback = TRUE) {
	# TODO: support for 'file' and 'split'
	## FIXME "./TODO.error.traceback.RData"

	## XXX: delegate some code from tryCatch 'error' expressions to reduce amount of code passed to call stack 

	last.warning <- list()
	Traceback <- NULL

	# warning level may change in course of the evaluation, so must be retrieved dynamically
	.getWarnLevel <- function () getOption("warn")
	
	rval <- NULL
	conn <- textConnection("rval", "w", local = TRUE)
	sink(conn, type = "output")
	sink(conn, type = "message")
	on.exit({
		sink(type = "message")
		sink(type = "output")
		close(conn)
	})

	inStdOut <- TRUE
	if (markStdErr) {
		mark <- function (to.stdout, id) {
			do.mark <- FALSE
			if (inStdOut) {
				if (!to.stdout) {
					cat("\x03")
					inStdOut <<- FALSE
					do.mark <- TRUE
			}} else { # in StdErr stream
				if (to.stdout) {
					cat("\x02")
					inStdOut <<- TRUE
					do.mark <- TRUE
			}}
		}
	} else mark <- function (to.stdout, id) {}
	
	## Marker functions to recognize internal errors
	#`.._captureAll.evalVis_..` <- function (x) withVisible(eval(x, envir))
	`.._captureAll.envir_..` <- envir
	`.._captureAll.evalVis_..` <- function (.._captureAll.expr_..)
	     withVisible(..korInternal(eval(.._captureAll.expr_.., .._captureAll.envir_.., baseenv())))
	     #withVisible(.Internal("eval", .._captureAll.expr_.., .._captureAll.envir_.., baseenv()))
		 
	#dExpr <- quote(eval(.._captureAll.expr_.., .._captureAll.envir_.., baseenv()))
	#deparse(dExpr)
	fooVars <- c(".._captureAll.expr_..", ".._captureAll.envir_..")

	`restartError` <- function (e, calls) { # , foffset
		# remove call (eval(expr, envir, enclos)) from the message
		ncls <- length(calls)

		DEBUG("restartError")
		#if(identical(deparse(calls[[ncls - 2L]]), deparse(conditionCall(e)))) {
		#	e$call <- NULL
		#	e$message <- "WTF"# sub("<text>:\\d+:\\d+: *", "", e$message, perl = TRUE)
		#}
		DEBUG("Call: ", e$call)
		
		if(doTraceback) {
			cfrom <- ncls
			cto <- 1L
			
			# traceback <-- calls[cfrom:cto]
			#    Initially: calls[ncls:1)]
			#    Finally:   calls[find(.handleSimpleError) - 1 : find(.._captureAll.evalVis_..) + 3)]

			for(i in ncls:1L)
				if(length(calls[[i]]) == 4L && is.symbol(calls[[i]][[1L]]) && 
					calls[[i]][[1L]] == ".handleSimpleError") {
					cfrom <- i - 1L
					break
				}
				
			if(cfrom == ncls) cfrom <- cfrom - 1L
			for(i in cfrom:1L)
				if(length(calls[[i]]) == 2L && is.symbol(calls[[i]][[1L]]) && 
					calls[[i]][[1L]] == ".._captureAll.evalVis_..") {
					cto <- i + 3L
					break
				}

			if(any(fooVars %in% all.vars(e$call)))
				e$call <- NULL

			# DEBUG
			#for(i in 1:ncls) cat(">>", i, ": ", deparse(calls[[i]], width.cutoff = 20, nlines = 1), "\n")
			#cat("from: ", cfrom, " to", cto, " [n = ", ncls, "]\n")
			###
			Traceback <<- if(cfrom < cto) list() else
				calls[seq.int(cfrom, cto)]
		}
		#cat("**Traceback**\n")
		#cat("**[", cto, ":", cfrom, "]\n")
		#print(calls)
		#cat("**End Traceback**\n")
		mark(FALSE, 1L)
		cat(as.character.error(e))
		if(.getWarnLevel() == 0L && length(last.warning) > 0L)
			cat(.gettextx("In addition: "))
	}
	
	.onMessage <- function(e) {
	    mark(FALSE, 8L)
	    DEBUG("message")
	    cat(conditionMessage(e), sep = "")
	    mark(TRUE, 9L)
	    invokeRestart("muffleMessage")
	}
	
	.onErrorWCH <- function (e) invokeRestart("grmbl", e, sys.calls())
	
	.onErrorTC <- function (e) { #XXX: this is called if warnLevel=2
		mark(FALSE, 5L)
		DEBUG("error#2")
		cat(as.character.error(e))
		DEBUG("end error#2")
		e #identity
	}
	
	.onAbort <- function (...) {
		mark(FALSE, 4L)
		cat("Execution aborted. \n")
	}
	
	.onWarning <- function (e) {
			DEBUG("warning")
			
			if(".._captureAll.expr_.." %in% all.vars(conditionCall(e)))
				e$call <- NULL

			if(.getWarnLevel() != 0L) {
				mark(FALSE, 2L)
				.RInternal(".signalCondition", e, conditionMessage(e), conditionCall(e))
				.RInternal(".dfltWarn", conditionMessage(e), conditionCall(e))
				mark(TRUE, 3L)
			} else {
				# XXX: error with [[]] when $call is NULL
				el <- list(e$call)
				names(el) <- e$message
				last.warning <<- append(last.warning, el)
			}
			DEBUG("END warning")

			invokeRestart("muffleWarning")
	}



	res <- tryCatch(withRestarts(withCallingHandlers({
			# TODO: allow for multiple expressions and calls (like in
			# 'capture.output'). The problem here is how to tell 'expression'
			# from 'call' without evaluating it?

			for(ex in expr) {
				DEBUG("before eval")
				res1 <- .._captureAll.evalVis_..(ex)
				DEBUG("after eval")

				DEBUG("print")
				if(res1$visible) {
					DEBUG("is visible")

					# print/show should be evaluated also in 'envir'
					resval <- res1$value
					if(!missing(resval)) {
						printfun <- as.name(if(isS4(resval)) "show" else "print")
						if(is.language(resval))
							eval(substitute(printfun(quote(resval))), envir)
						else
							eval(substitute(printfun(resval)), envir)
					} else {
						cat("\n")
					}
				} else DEBUG("not visible")
				DEBUG("after print")
			}
		},

		message = .onMessage,
		error = .onErrorWCH,
		warning = .onWarning),
	# Restarts:

	# Handling user interrupts. Currently it works only from within R.
	# XXX: how to trigger interrupt remotely?
	abort = .onAbort,
	muffleMessage = function () NULL,
	grmbl = restartError),
	error = .onErrorTC, finally = {	}
	)

	if(.getWarnLevel() == 0L) {
		nwarn <- length(last.warning)
		if(doTraceback) {
			if(bindingIsLocked("last.warning", baseenv()))
				unlockBinding("last.warning", baseenv())
			assign("last.warning", last.warning, envir = baseenv())
		}

		if(nwarn != 0L) mark(FALSE, 6L)
		if(nwarn <= 10L) {
			print.warnings(last.warning)
		} else if (nwarn < 50L) {
		  cat(sprintf(ngettext("There was %d warning (use warnings() to see it)", "There were %d warnings (use warnings() to see them)",
			    n = nwarn, domain = "R"), nwarn))
		} else {
			cat(gettextf("There were %d or more warnings (use warnings() to see the first %d)", nwarn, 50, domain = "R"))
		}
	}
	mark(TRUE, 7L)

	sink(type = "message")
	sink(type = "output")
	close(conn)
	on.exit()

	#filename <- attr(attr(sys.function (sys.parent()), "srcref"), "srcfile")$filename
	filename <- getSrcFilename(sys.function (sys.parent()), full.names = TRUE)
	if(length(filename) == 0) filename <- NULL

	#print(sys.function (sys.parent()))

	# allow for tracebacks of this call stack:
	if(doTraceback && !is.null(Traceback)) {
		if(bindingIsLocked(".Traceback", baseenv())) 
			unlockBinding(".Traceback", baseenv())
	
		assign(".Traceback",
			if (is.null(filename)) {
				#lapply(Traceback, deparse, control=NULL)
				# keep only 'srcref' attribute
				lapply(Traceback,  function (x) structure(deparse(x, control = NULL),
					srcref = attr(x, "srcref")))

			} else {
				lapply(Traceback, function (x) {
					srcref <- attr(x, "srcref")
					srcfile <- if(is.null(srcref)) NULL else attr(srcref, "srcfile")
					structure(deparse(x, control = NULL), srcref =
						if(is.null(srcfile) || isTRUE(srcfile$filename == filename))
						NULL else srcref)
				})
			}, envir = baseenv())
	}
	return(rval)
}


# Replacement for 'base::as.character.error', which does not translate "Error"
`as.character.error` <- function (x, ...) {
	DEBUG("as.character.error")
    msg <- conditionMessage(x)
    call <- conditionCall(x)
    if (!is.null(call)) {
		#if(getRversion() < "3.4.1") {
			#paste(.gettextx("Error in "), deparse(call, control = NULL)[1L], " : ",
				#msg, "\n", sep = "") ## 
		#} else {
			ermsg1 <- .gettextfx("Error in %s : ", deparse(call, control = NULL)[1L])
			paste(ermsg1, if(nchar(ermsg1) + nchar(msg) > 80) "\n  " else "", msg, "\n", sep = "") ## 	
		#}
	} else paste(.gettextx("Error: "), msg, "\n", sep = "")
}

# Replacement for 'base::print.warnings'. Deparses using control=NULL to produce
#  result identical to that in console
`print.warnings` <-
function (x, ...) {
    if (n <- length(x)) {
        cat(ngettext(n, "Warning message:", "Warning messages:", domain = "R"), "\n")
        msgs <- names(x)
        for (i in seq_len(n)) {
            ind <- if (n == 1L) ""
            else paste(i, ": ", sep = "")
            out <- if (length(x[[i]])) {
                temp <- deparse(x[[i]], width.cutoff = 50L, nlines = 2L,
					control = NULL) # the only modification

				sm <- strsplit(msgs[i], "\n")[[1L]]
                nl <- if (nchar(ind, "w") + nchar(temp[1L], "w") +
                  nchar(sm[1L], "w") <= 75L) " " else "\n  "
                paste(ind, "In ", temp[1L], if (length(temp) > 1L)
                  " ...", " :", nl, msgs[i], sep = "")
            } else paste(ind, msgs[i], sep = "")
            do.call("cat", c(list(out), attr(x, "dots"), fill = TRUE))

			#do.call(get("captureAll", "komodoConnection"), list(1,2,3))
        }
    }
    invisible(x)
}

..korInternal <- .Internal


# use ngettext instead of gettext, which fails to translate many strings in "R" domain
# bug in R or a weird feature?
`.gettextfx` <- function (fmt, ..., domain = "R")
sprintf(ngettext(1, fmt, "", domain = domain), ...)

`.gettextx` <-
function (..., domain = "R") {
    args <- lapply(list(...), as.character)
	unlist(lapply(unlist(args), function (x) .RInternal("ngettext", 1, x, "", domain)))
}

unsink <- function () {
    sink(type = "message")
    sink(type = "output")
}


DEBUG <- function (...) {}
#DEBUG <- function (x, ...) {
#	cat("DEBUG: ")
#	if(!is.character(substitute(x)))
#		cat("[", deparse(substitute(x)), "] ")
#	cat(x, "\n")
#}