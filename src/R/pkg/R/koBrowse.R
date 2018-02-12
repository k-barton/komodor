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
			eval.parent(expression(setEvalEnv(sys.frame(sys.nframe()))))
			env <- getEvalEnv()
			attr(env, "name") <- envName <- format(expr)[1L]
            
			#if(refresh) koCmd("_W.setTimeout(() => kor.rbrowser.refresh(), 100)");
			if(refresh) koCmd(paste0("kor.fireEvent(\"r-evalenv-change\", {evalEnvName:",
                deparse(envName, control = NULL), "})"))

			stop(simpleMessage(paste0("Current evaluation environment is now inside\n\t",
				envName,
				"\nUse 'koBrowseEnd()' to return to '.GlobalEnv'.",
				"\n(Note this will not resume execution of the function)")))
		}
	}
}


#' @rdname koBrowse
#' @export
koBrowseEnd <-
function(refresh = TRUE) {
	if(!identical(getEvalEnv(), .GlobalEnv)) {
		setEvalEnv(.GlobalEnv)
		message("Evaluating in '.GlobalEnv'")
		if(refresh) koCmd(paste0("kor.fireEvent(\"r-evalenv-change\", {evalEnvName:\".GlobalEnv\"})"));
		
	} else message("Already in '.GlobalEnv'")
	invisible()
}
