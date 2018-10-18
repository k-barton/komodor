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
	warnings.shown <- FALSE
	
	Traceback <- NULL

	# warning level may change in course of the evaluation, so must be retrieved dynamically
	.getWarnLevel <- function () getOption("warn")

	rval <- NULL
	conn <- textConnection("rval", "w", local = TRUE)
	sink(conn, type = "output"); sink(conn, type = "message")
	#sink(stdout(), type = "output"); sink(stderr(), type = "message")
	on.exit({
		sink(type = "message")
		sink(type = "output")
		close(conn)
	})
	
	inStdOut <- TRUE
	if (markStdErr) {
		mark <- function (to.stdout, id) {
			#cat("<", if(to.stdout) "OUT" else "ERR", ">", sep = "")
			if (inStdOut) {
				if (!to.stdout) {
					cat("\x03")
					inStdOut <<- FALSE
			}} else { # in StdErr stream
				if (to.stdout) {
					cat("\x02")
					inStdOut <<- TRUE
			}}
		}
	} else mark <- function (to.stdout, id) {}
	
	
	printWarnings <-
		function() {
			if(warnings.shown) return()
			x <- last.warning
			nwarn <- length(x)
			DEBUG("printWarnings: N = ", nwarn)
			if(nwarn == 0L) return()
			mark(FALSE, 6L)
			if(nwarn <= 10L)
				print.warnings(x)
			else if (nwarn < 50L)
				cat(sprintf(ngettext("There was %d warning (use warnings() to see it)",
					"There were %d warnings (use warnings() to see them)",
						n = nwarn, domain = "R"), nwarn))
			else
				cat(gettextf("There were %d or more warnings (use warnings() to see the first %d)",
					nwarn, 50, domain = "R"))
			mark(TRUE, 7L)
			warnings.shown <<- TRUE
		}
	
	## Marker functions to recognize internal errors
	`.._captureAll.envir_..` <- envir
	`.._captureAll.evalVis_..` <- function (.._captureAll.expr_..) {
		DEBUG("before eval")
		on.exit(DEBUG("after eval"))
	    rval <- withVisible(..korInternal(eval(.._captureAll.expr_.., .._captureAll.envir_.., baseenv())))
		rval
	}
	#withVisible(.Internal("eval", .._captureAll.expr_.., .._captureAll.envir_.., baseenv()))
		 
	#dExpr <- quote(eval(.._captureAll.expr_.., .._captureAll.envir_.., baseenv()))
	#deparse(dExpr)
	fooVars <- c(".._captureAll.expr_..", ".._captureAll.envir_..")

	assignTraceback <- function(e, calls) {
		ncls <- length(calls)
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
	
	.onErrorWCH <- function (e) {
		DEBUG("error handler:", conditionMessage(e))
		on.exit(DEBUG("after error handler:", conditionMessage(e)))

		if(doTraceback) assignTraceback(e, sys.calls())

		#cat("**Traceback**\n")
		#cat("**[", cto, ":", cfrom, "]\n")
		#print(calls)
		#cat("**End Traceback**\n")
		mark(FALSE, 1L)
		cat(as.character.error(e))
		if(.getWarnLevel() == 0L && length(last.warning) > 0L) {
			cat(.gettextx("In addition: "))
			printWarnings()
		}
		mark(TRUE, 1L)
		invokeRestart("grmbl") # restartError
	}	
	
	`restartError` <- function () {
		DEBUG("restartError")
	}
	
	.onMessage <- function(e) {
	    mark(FALSE, 8L)
	    DEBUG("message")
	    cat(conditionMessage(e), sep = "")
	    mark(TRUE, 9L)
	    invokeRestart("muffleMessage")
	}
	
	
	.onErrorTC <- function (e) { #XXX: this is called if warnLevel=2
		mark(FALSE, 5L)
		DEBUG("tryCatch error", conditionMessage(e))
		if(doTraceback) assignTraceback(e, sys.calls())
		cat(as.character.error(e))
		DEBUG("end tryCatch error")
		e
	}
	
	.onAbort <- function (...) {
		mark(FALSE, 4L)
		cat("Execution aborted. \n")
	}
	
	.print <- function(x, envir) {
		DEBUG("print")
		if(x$visible) {
			DEBUG("is visible")
			# print/show should be evaluated also in 'envir'
			resval <- x$value
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
	
	.onWarning <- function (e) {
			DEBUG("warning handler", conditionMessage(e))
			on.exit(DEBUG("END warning"))
			
			if(".._captureAll.expr_.." %in% all.vars(conditionCall(e)))
				e$call <- NULL
			
			if((warn <- .getWarnLevel()) == 1L) {
				mark(FALSE, 2L)

				#if(warn >= 2)
					#signalCondition(simpleError(.gettextfx("(converted from warning) %s", conditionMessage(e)), conditionCall(e)))
				#else
				.signalSimpleWarning(conditionMessage(e), conditionCall(e))
				mark(TRUE, 3L)
			} else if (warn <= 0) {
				# XXX: error with [[]] when $call is NULL
				el <- list(e$call)
				names(el) <- e$message
				ws <- warnings.shown
				last.warning <<- if(ws) el else append(last.warning, el)
				warnings.shown <<- FALSE
			}
			if(warn < 2) invokeRestart("muffleWarning")
	}
	
	res <- tryCatch(
		withRestarts(
			withCallingHandlers({
					# TODO: allow for multiple expressions and calls (as in
					# 'capture.output'). The problem here is how to tell 'expression'
					# from 'call' without evaluating it?
					for(ex in expr) .print(.._captureAll.evalVis_..(ex), envir)
				},
				message = .onMessage,
				error = .onErrorWCH,
				warning = .onWarning
				), # withCallingHandlers

			# Restarts:
			# Handling user interrupts. Currently it works only from within R.
			# XXX: how to trigger interrupt remotely?
			abort = .onAbort,
			muffleMessage = function () NULL,
			grmbl = restartError,
			muffleWarning = function() DEBUG("muffleWarning")
			), # withRestarts
		error = .onErrorTC, finally = {	}
		) # tryCatch
	
	if(.getWarnLevel() == 0L) {
		if(doTraceback)
			assignLocked("last.warning", last.warning, envir = baseenv())
		printWarnings()
	}

	sink(type = "message")
	sink(type = "output")
	close(conn)
	on.exit()

	# allow for tracebacks of this call stack:
	if(doTraceback && !is.null(Traceback)) {
		#filename <- attr(attr(sys.function (sys.parent()), "srcref"), "srcfile")$filename
		filename <- getSrcFilename(sys.function (sys.parent()), full.names = TRUE)
		DEBUG(filename)
		if(length(filename) == 0) filename <- NULL
		assignLocked(".Traceback",
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
	DEBUG("print.warnings")
    if (n <- length(x)) {
        cat(ngettext(n, "Warning message:", "Warning messages:", domain = "R"), "\n")
        tags <- if (n == 1L) "" else paste0(seq_len(n), ": ")
        msgs <- names(x)
		fmt <- .gettextfx("In %s :", "%s")
		
		for (i in seq_len(n)) {
            out <- if (length(x[[i]])) {
                temp <- deparse(x[[i]], width.cutoff = 50L, nlines = 2L, control = NULL) # MOD
                sm <- strsplit(msgs[i], "\n")[[1L]]
                nl <- if (nchar(tags[i], "w") + nchar(temp[1L], "w") + nchar(sm[1L], "w") <= 75L)
					" " else "\n  "
				paste0(tags[i], sprintf(fmt, paste0(temp[1L], if (length(temp) > 1L) " ...", " :")), nl, msgs[i])
            } else
				paste0(tags[i], msgs[i])
            do.call("cat", c(list(out), attr(x, "dots"), fill = TRUE))
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

assignLocked <- function(x, value, envir) {
	if(bindingIsLocked(x, envir)) { 
		unlockBinding(x, envir)
		on.exit(lockBinding(x, envir))
	}
	assign(x, value, envir = envir)
}


unsink <- function () {
    sink(type = "message")
    sink(type = "output")
}

#DEBUG <- function (x, ...) {
#	 cat("DEBUG: ")
#	 if(!is.character(substitute(x)))
#		 cat("[", deparse(substitute(x)), "] ")
#	 cat(x)
#	 if(length(list(...))) cat("[", sapply(list(...), as.character), "]")
#	 cat("\n")
# }
 DEBUG <- function (...) {}
