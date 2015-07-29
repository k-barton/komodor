`sv_quickParse` <- function(filename, encoding = "UTF-8") {
	if(file.exists(filename)) {
		on.exit(close(fconn))
		fconn <- file(filename, open = "r", encoding = encoding)
		x <- tryCatch({ parse(file = fconn); NA }, error = function(e) e)
		return(invisible(if(is.na(x[1L])) "" else conditionMessage(x)))
	}
	# be quiet about errors:
	# else stop("File ", filename, " not found")
}
