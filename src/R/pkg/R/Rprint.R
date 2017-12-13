`TclRprint` <- function(x, debug = 0L) {
	if(debug < getOption('ko.debug', -1L)) {
		Encoding(x) <- "UTF-8"
		cat(sprintf("[[ %s ]]", x), "\n")
	}
	#invisible(x)
}