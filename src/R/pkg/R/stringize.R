#' @title Serialize R objects
#' @description A simple JSON-serializer for lists containing character strings.
#' @note All values are taken as strings.
#' @param x a `list`
stringize <- 
function(x) {
	if(!is.list(x) && length(x) == 1L) return(encodeString(x, quote = '"'))
	x <- lapply(x, stringize)
	x <- if(is.list(x) || length(x) > 1L) {
		nms <- names(x)
		if(is.null(nms))
			paste('[', paste(x, collapse = ','), ']', sep = "")
		else
			paste("{", paste(paste(encodeString(make.unique(nms, sep = '#'),
				quote = '"'), ":", x, sep = ""), collapse = ","),"}",
				  sep = "")
	}
	x
}