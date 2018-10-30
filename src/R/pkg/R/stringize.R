#' @title Serialize R objects
#' @description A simple JSON-serializer for lists containing character strings.
#' @note All values are taken as strings.
#' @param x a `list`
stringize <- 
function(x) {
	if(!is.list(x) && length(x) == 1L) return(encodeString(x, quote = '"'))
	x <- lapply(x, stringize)
	if(is.list(x) || length(x) > 1L) {
		nms <- names(x)
		if(is.null(nms))
			paste0('[', paste0(x, collapse = ','), ']')
		else if(length(nms) != 0L)
			paste0("{", paste0(paste0(encodeString(make.unique(nms, sep = '#'),
				quote = '"'), ":", x), collapse = ","), "}") else "{}"
	}
}