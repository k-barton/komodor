`TclRprint` <- function(x, level = 0L) {
	if(level < getOption('ko.info.level', -1L)) {
		Encoding(x) <- "UTF-8"
		cat(sprintf("[[ %s ]]", x), "\n")
	}
	#invisible(x)
}