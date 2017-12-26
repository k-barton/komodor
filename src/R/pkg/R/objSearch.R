#' @rdname rbrowser
#' @md
#' @export
`objSearch` <-
function(sep = "\t") {
    rval <- search()
	if(!identical(ee <- getEvalEnv(), .GlobalEnv)) {
		eeName <- attr(ee, "name")
		rval <- c(if(is.null(eeName)) "EvalEnv" else paste0("<EvalEnv[", eeName[1L], "]>"), rval)
	}
	return(paste(rval, collapse = sep))
}

