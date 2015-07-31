# <LICENSE BLOCK:KomodoR->Rserver>

# 'imports'
if(exists("getSrcFilename", where = "package:utils", mode = "function")) {
	getSrcFilename <- utils::getSrcFilename
}

# Replacement for 'base::as.character.error', which does not translate "Error"
`as.character.error` <- function (x, ...) {
    msg <- conditionMessage(x)
    call <- conditionCall(x)
    if (!is.null(call))
		paste(.gettextx("Error in "), deparse(call, control = NULL)[1L], " : ",
			msg, "\n", sep = "")
    else paste(.gettextx("Error: "), msg, "\n", sep = "")
}

# Replacement for 'base::print.warnings'. Deparses using control=NULL to produce
#  result identical to that in console
`print.warnings` <- function (x, ...) {
    if (n <- length(x)) {
        cat(ngettext(n, "Warning message:\n", "Warning messages:\n"))
        msgs <- names(x)
        for (i in seq_len(n)) {
            ind <- if (n == 1L) ""
            else paste(i, ": ", sep = "")
            out <- if (length(x[[i]])) {
                temp <- deparse(x[[i]], width.cutoff = 50L, nlines = 2L,
					control = NULL) # the only modification
                sm <- strsplit(msgs[i], "\n")[[1L]]
                nl <- if (nchar(ind, "w") + nchar(temp[1L], "w") +
                  nchar(sm[1L], "w") <= 75L)
                  " "
                else "\n  "
                paste(ind, "In ", temp[1L], if (length(temp) >
                  1L)
                  " ...", " :", nl, msgs[i], sep = "")
            }
            else paste(ind, msgs[i], sep = "")
            do.call("cat", c(list(out), attr(x, "dots"), fill = TRUE))
        }
    }
    invisible(x)
}

# use ngettext instead of gettext, which fails to translate many strings in "R" domain
# bug in R or a weird feature?
`.gettextfx` <- function (fmt, ..., domain = "R")
sprintf(ngettext(1, fmt, "", domain = domain), ...)

`.gettextx` <- function (..., domain = "R") {
    args <- lapply(list(...), as.character)
	 unlist(lapply(unlist(args), function(x) .Internal(ngettext(1, x, "", domain))))
}

unsink <- function() {
    sink(type = "m")
    sink(type = "o")
}

# inspired by 'capture.output' and utils:::.try_silent
# Requires: R >= 2.13.0 [??]
`sv_captureAll` <- function(expr, split = FALSE, file = NULL, markStdErr = FALSE,
		envir = sv_CurrentEnvir) {
	# TODO: support for 'file' and 'split'

	# markStdErr: if TRUE, stderr is separated from sddout by STX/ETX character

	last.warning <- list()
	Traceback <- NULL
	NframeOffset <- sys.nframe() + 19L + 3L # frame of reference (used in traceback) +
								 # length of the call stack when a condition
								 # occurs
	# Note: if 'expr' is a call not expression, 'NframeOffset' is lower by 2
	# (i.e. 21): -1 for lapply, -1 for unwrapping 'expression()'

	getWarnLev <- function() options('warn')[[1L]] # this may change in course of
		# evaluation, so must be retrieved dynamically

	rval <- NULL
	tconn <- textConnection("rval", "w", local = TRUE)
	sink(tconn, type = "output"); sink(tconn, type = "message")
	on.exit({
		sink(type = "message"); sink(type = "output")
		close(tconn)
	})

	inStdOut <- TRUE

	if (markStdErr) {
		putMark <- function(to.stdout, id) {
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
	} else 	putMark <- function(to.stdout, id) {}

	`evalVis` <- function(x) withVisible(eval(x, envir))

	`restartError` <- function(e, calls, foffset) {
		# remove call (eval(expr, envir, enclos)) from the message
		ncls <- length(calls)

		if(identical(calls[[NframeOffset + foffset]], conditionCall(e)))
			e$call <- NULL

		cfrom <- ncls - 2L
		cto <- NframeOffset + foffset

		Traceback <<- if(cfrom < cto) list() else
			calls[seq.int(cfrom, cto, by=-1L)]

		putMark(FALSE, 1L)
		cat(as.character.error(e))
		if(getWarnLev() == 0L && length(last.warning) > 0L)
			cat(.gettextx("In addition: "))
	}

	res <- tryCatch(withRestarts(withCallingHandlers({
			# TODO: allow for multiple expressions and calls (like in
			# 'capture.output'). The problem here is how to tell 'expression'
			# from 'call' without evaluating it?
			off <- 0L

			for(i in expr) {
				# 'off' is passed to 'restartError'
				off <- 0L # TODO: better way to find the right sys.call...
				res1 <- evalVis(i)
				off <- -2L

				if(res1$visible) {
					# print/show should be evaluated also in 'envir'
					resval <- res1$value
					if(!missing(resval)) {
						printfun <- as.name(if(isS4(resval)) "show" else "print")
						if(is.language(resval)) {
							eval(substitute(printfun(quote(resval))), envir)
						}	else
							eval(substitute(printfun(resval)), envir)
					} else {
						cat("\n")
					}
				}
			}
		},

		message = function(e)  {
			putMark(FALSE, 8L)
			cat(conditionMessage(e), sep = "")
			putMark(TRUE, 9L)
			invokeRestart("muffleMessage")
		},
		error = function(e) invokeRestart("grmbl", e, sys.calls(), off),
		warning = function(e) {
			# remove call (eval(expr, envir, enclos)) from the message
			if(isTRUE(all.equal(sys.call(NframeOffset + off), e$call,
				check.attributes = FALSE)))
				e$call <- NULL

			if(getWarnLev() != 0L) {
				putMark(FALSE, 2L)
				.Internal(.signalCondition(e, conditionMessage(e), conditionCall(e)))
				.Internal(.dfltWarn(conditionMessage(e), conditionCall(e)))
				putMark(TRUE, 3L)
			} else {
				last.warning <<- c(last.warning, structure(list(e$call),
					names = e$message))
			}
			invokeRestart("muffleWarning")
		}),
	# Restarts:

	# Handling user interrupts. Currently it works only from within R.
	# TODO: how to trigger interrupt remotely?
	abort = function(...) {
		putMark(FALSE, 4L)
		cat("Execution aborted. \n")
	},

	muffleMessage = function() NULL,
	muffleWarning = function() NULL,
	grmbl = restartError),
	error = function(e) { #XXX: this is called if warnLevel=2
		putMark(FALSE, 5L)
		cat(as.character.error(e))
		e #identity
	}, finally = {	}
	)

	if(getWarnLev() == 0L) {
		nwarn <- length(last.warning)
		assign("last.warning", last.warning, envir = baseenv())

		if(nwarn != 0L) putMark(FALSE, 6L)
		if(nwarn <= 10L) {
			print.warnings(last.warning)
		} else if (nwarn < 50L) {
		   cat(.gettextfx("There were %d warnings (use warnings() to see them)\n", nwarn))
		} else {
			cat(.gettextx("There were 50 or more warnings (use warnings() to see the first 50)\n"))
		}
	}
	putMark(TRUE, 7L)

	sink(type = "message"); sink(type = "output")
	close(tconn)
	on.exit()

	#filename <- attr(attr(sys.function(sys.parent()), "srcref"), "srcfile")$filename
	filename <- getSrcFilename(sys.function(sys.parent()), full.names=TRUE)
	if(length(filename) == 0) filename <- NULL

	#print(sys.function(sys.parent()))

	# allow for tracebacks of this call stack:
	if(!is.null(Traceback)) {
		assign(".Traceback",
			if (is.null(filename)) {
				#lapply(Traceback, deparse, control=NULL)
				# keep only 'srcref' attribute
				lapply(Traceback,  function(x) structure(deparse(x, control=NULL),
					srcref=attr(x, "srcref")))

			} else {
				lapply(Traceback, function(x) {
					srcref <- attr(x, "srcref")
					srcfile <- if(is.null(srcref)) NULL else attr(srcref, "srcfile")
					structure(deparse(x, control=NULL), srcref =
						if(is.null(srcfile) || isTRUE(srcfile$filename == filename))
						NULL else srcref)
				})
			}
			, envir = baseenv())
	}
	return(rval)
}

`captureAllQ` <- function(expr, ...)
	sv_captureAll(as.expression(substitute(expr)), ...)
