#' @rdname kor-internal
#' @md
#' @description `qParse` parses R code in a file and returns error message in case of error or an empty string. Used by Komodo's R-linter.
#' @param filename name of the file to parse 
#' @param encoding The name of the encoding to be assumed. See \sQuote{Encoding} section in `file`.
#' @export
`qParse` <- function(filename, encoding = "UTF-8", max.errors = 6L, sep = "\x1e") {
	if(file.exists(filename)) {
		on.exit(close(fconn))
		
		
		fconn <- file(filename, open = "r", encoding = encoding)
		count <- 0L
		repeat({
			x <- tryCatch({
				parse(file = fconn, encoding = encoding)
				""
			}, error = function(e) {
				mess <- conditionMessage(e)
				# XXX: in R4.0.0 this error message is hardcoded in C code
				#      in future it will probably become translatable
				if(startsWith(mess, "malformed raw string literal at line ")) {
					paste0(as.integer(substr(mess, 38L, 64L)), ":",
						-nchar(readLines(fconn, 1L)),
						 ": malformed raw string literal\n:\n")	
				} else {
					readLines(fconn, 1L) # read current line till EOL
					mess
				}
			})
			if(identical(x, "") || count == max.errors) break
			cat(x, sep)
			count <- count + 1L
		})
		#close(fconn)
		
		return(invisible(x))
	}
	# be quiet about errors:
	# else stop("File ", filename, " not found")
}
