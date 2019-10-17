#' @rdname kor-internal
#' @md
#' @description `qParse` parses R code in a file and returns error message in case of error or an empty string. Used by Komodo's R-linter.
#' @param filename name of the file to parse 
#' @param encoding The name of the encoding to be assumed. See \sQuote{Encoding} section in `file`.
#' @export
`qParse` <- function(filename, encoding = "UTF-8") {
	if(file.exists(filename)) {
		on.exit(close(fconn))
		fconn <- file(filename, open = "r", encoding = encoding)
		x <- tryCatch({
			parse(file = fconn, encoding = encoding)
			NA
		}, error = function(e) e)
		return(invisible(if(is.na(x[1L])) "" else conditionMessage(x)))
	}
	# be quiet about errors:
	# else stop("File ", filename, " not found")
}
