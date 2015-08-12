`parseText` <-
function (text) {
	## Parse R instructions provided as a string and return the expression if it
	## is correct, or a 'try-error' object if it is an incorrect code, or NA if
	## the (last) instruction is incomplete
	res <- tryCatch(parse(text = text), error = identity)

	if(inherits(res, "error")) {
		# Check if this is incomplete code
		msg <- conditionMessage(res)
		rxUEOI <- sprintf(gsub("%d", "\\\\d+", gettext("%s%d:%d: %s", domain = "R")),
			if (getOption("keep.source")) "<text>:" else "",
			gettextf("unexpected %s",
					 gettext("end of input", domain = "R"),
					 domain = "R"))

		if (regexpr(rxUEOI, msg, perl = TRUE) == 1L) return(NA) 

		# This reformats the message as it would appear in the CLI:
		#msg <- conditionMessage(res)
		errinfo <- strsplit(sub("(?:<text>:)?(\\d+):(\\d+): +([^\n]+)\n([\\s\\S]*)$",
			"\\1\n\\2\n\\3\n\\4", msg, perl = TRUE),
			"\n", fixed = TRUE)[[1L]] 

		if(length(errinfo) == 4L) {
			errpos <- as.numeric(errinfo[1L:2L])
			err <- errinfo[-(1L:3L)]
			rx <- sprintf("^%d:", errpos[1L])
			errcode <- sub(rx, "", err[grep(rx, err)])
			#errcode <- substr(strsplit(text, "(\r?\n|\r)")[[1]][errpos[1]],
			#                  start = 0, stop = errpos[2])
			res <- simpleError(sprintf("%s in \"%s\"", errinfo[3L], errcode))
		}

		e <- res
		# for legacy uses, make it a try-error
		res <- .makeMessage(res)
		class(res) <- "try-error"
		attr(res, 'error') <- e
	}
    return(res)
}

assign("parseText", parseText, "komodoConnection")


