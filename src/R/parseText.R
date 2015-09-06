`parseText` <-
function (text) {
	## Parse R instructions provided as a string and return the expression if it
	## is correct, or a 'try-error' object if it is an incorrect code, or NA if
	## the (last) instruction is incomplete
	res <- tryCatch(parse(text = text), error = identity)

	if(inherits(res, "error")) {

		.regcaptures <- function (x, m, ...) {
			mstart <- attr(m, "capture.start")
			mstop <- mstart + attr(m, "capture.length") - 1L
			n <- length(mstart)
			rval <- character(n)
			for(i in 1L:n) 	rval[i] <- substr(x, mstart[i], mstop[i])
			rval
		}

		# Check if this is incomplete code
		msg <- conditionMessage(res)

		#m <- regexpr("^<text>:\\d+:\\d+: ([^\n]+)",  msg, perl = TRUE)
		#m <- regexpr("^<text>:\\d+:\\d+: ([^\n]+)\n\\d+: *([^\n]+)\n", msg, perl = TRUE)
		m <- regexpr("^<text>:\\d+:\\d+: ([^\n]+)\n\\d+: ", msg, perl = TRUE)
		if(m != -1) {
			if(identical(.regcaptures(msg, m)[1L], gettext("unexpected end of input", domain = "R")))
				return(NA)
			# remove "<text>:n:n:" from the beginning of message
			res$message <- substr(msg, attr(m,"capture.start")[1L], nchar(msg))
		}

		#'res$message <- paste0("(parser) ", res$message)
		res$call <- NULL

		# XXX: Removes line numbers (we don't do that currently)
		#if(m != -1) {
		#	mstart <- attr(m,"capture.start")
		#	mstop <- mstart + attr(m,"capture.length") - 1
		#	#'for(i in 1:length(mstart)) print(substr(msg, mstart[i], mstop[i]))
		#	e$message <- gettextf("%s in \"%s\"",
		#						  substr(msg, mstart[1L], mstop[1L]),
		#						  substr(msg, mstart[2L], mstop[2L]),
		#						  domain = "R")
		#	e$call <- NULL
		#}

		# for legacy uses, make it a try-error
		e <- res
		res <- .makeMessage(res)
		class(res) <- "try-error"
		attr(res, 'error') <- e
	}
    return(res)
}


#'msg <- "<text>:2:0: nieoczekiwany koniec wejścia\n1: rere(\n   ^"
#'msg <- "<text>:3:0: nieoczekiwany koniec wejścia\n1: re\n2: re(\n  ^"
#'msg <- "<text>:4:0: nieoczekiwany koniec wejścia\n2: \n3: re(\n  ^"
#'msg <- "<text>:6:0: unexpected end of input\n4: \n5: re(\n  ^"
#'
#'cat(msg)
#'
#'regexpr("^<text>:\\d+:\\d+: ([^\n]+)\n\\d+: *([^\n]+)\n", msg, perl = TRUE)
