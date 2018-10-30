#' @md
#' @rdname koBrowse
#' @title Environment browser
#' @description Interrupt the execution of an expression and allow the inspection of the environment where
#' `koBrowseHere` was called from.
#' @details These functions are only useful when used in Komodo editor. Unlike `browser`, `koBrowseHere` does
#'          not allow for continuing the interrupted execution. `koBrowseEnd` returns evalution to the global
#'          environment.

#' @rdname koBrowse
#' @param refresh logical, if `TRUE` (default), R Object Browser widget is refreshed.
#' @export
koBrowseHere <-
function(refresh = TRUE) {
	if(!identical(sys.frame(sys.nframe()), .GlobalEnv)) {
	    expr <- sys.call(sys.nframe() - 1L)
		if(all(c(".._captureAll.expr_..", ".._captureAll.envir_..") %in% all.vars(expr))) {
			# called from top level
			message("koBrowseHere called from top level")
		} else {
			envName <- format(expr)[1L]
			setEvalEnv(eval.parent(expression(sys.frame(sys.nframe()))),
				envName)
			env <- getEvalEnv()
			attr(env, "name") <- envName 
		}
	}
}

#' @rdname koBrowse
#' @export
koBrowseEnd <-
function(refresh = TRUE) {
	if(!identical(getEvalEnv(), .GlobalEnv)) {
		setEvalEnv(.GlobalEnv, ".GlobalEnv")
	} else message("Already in '.GlobalEnv'")
	invisible()
}
