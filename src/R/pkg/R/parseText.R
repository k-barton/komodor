#' @title Parse expressions
#' @md
#' @description Parses a string and returns an unevaluated expression, an
#'    `"error"` object in case of ' invalid code, or `NA` if the (most recent)
#'     expression is incomplete.
#' @param text character vector. The text to parse. Elements are treated as if
#'     they were lines of a file.
#' @param encoding encoding to be assumed for input strings (passed to `parse`)
#' @param enc.conn encoding to re-encode the input (used as `encoding` 
#'     argument for `textConnection`).
#' @export
`parseText` <-
function (text, encoding = getOption("encoding"), enc.conn = NULL) {
	
	inpcon <- textConnection(text, encoding = enc.conn)
	res <- tryCatch(parse(inpcon, encoding = encoding), error = identity)
	close(inpcon)

	if(inherits(res, "error")) {
		# Check if this is incomplete code
		msg <- conditionMessage(res)
		
		#m <- regexpr("^<text>:\\d+:\\d+: ([^\n]+)",  msg, perl = TRUE)
		#m <- regexpr("^<text>:\\d+:\\d+: ([^\n]+)\n\\d+: *([^\n]+)\n", msg, perl = TRUE)
		m <- regexpr("^\\d+:\\d+: ([^\n]+)\n\\d+: ", msg, perl = TRUE)
		if(m != -1) {
			err <- .regcaptures(msg, m)[1L]
			
			if(identical(err, .cachedGettext("unexpected end of input", id = "unxpEOI"))) return(NA)
		    if(identical(err, .cachedGettext("unexpected end of line", id = "unxpEOL"))) return(NA)
			if(identical(err, .cachedGettext("unexpected %s", "INCOMPLETE_STRING", id = "unxpINCPLSTR"))) return(NA)

			# remove "<text>:n:n:" from the beginning of message
			res$message <- substr(msg, attr(m,"capture.start")[1L], nchar(msg))
		}

		# res$message <- paste0("(parser) ", res$message)
		res$call <- NULL
	}
	return(res)
}

.regcaptures <- function (x, m, ...) {
	mstart <- attr(m, "capture.start")
	mstop <- mstart + attr(m, "capture.length") - 1L
	n <- length(mstart)
	rval <- character(n)
	for(i in 1L:n) 	rval[i] <- substr(x, mstart[i], mstop[i])
	rval
}


.cachedGettext <- function(fmt, ..., id = NULL, domain = "R") {
	dots <- list(...)
	if(is.null(id)) id <- paste0(as.character(c(fmt, dots, domain)), collapse = ".")
	cache <- getTemp(".messages", new.env(hash = TRUE))
	if(exists(id, cache)) {
		return(get(id, cache))
	} else {
		msg <- if(length(dots) == 0L) gettext(fmt, domain = domain) else gettextf(fmt, ..., domain = domain)
		assign(id, msg, cache)
		return(msg)
	}
}