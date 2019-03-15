#' @rdname tempEnv
#' @md
#' @export
#' @param envir the `environment` to use for evaluation of commands in Komodo.
#' @param envName optional character string, the name of the `environment` to
#         use in Komodo's R Object Browser. Set to `NULL` to skip firing 
#         Komodo event.
#  @param quiet if `TRUE`, no message is displayed
setEvalEnv <-
function(envir = .GlobalEnv, envName = deparse(substitute(envir), control = NULL), quiet = FALSE) {
	envName # force evaluation
    envir <- as.environment(envir)
	
    korenv <- as.environment(paste0("package:", .packageName))
    empty <- emptyenv()
    curEvalEnv <- getTemp(".EvalEnv", .GlobalEnv)
    e <- pe <- curEvalEnv
    # if not in GE and have to kor parent environment is set to be removed
    if (
        !identical(curEvalEnv, .GlobalEnv) && isTRUE(getTemp("remove.kor.parent", FALSE))
        ) {
        while (!identical(e, korenv) && !identical(e, empty)) {
            e <- parent.env(pe <- e)
        }
        if(identical(e, korenv)) parent.env(pe) <- empty
        rmTemp("remove.kor.parent")
    }
	
	# Cannot set parent.env on baseenv or emptyenv. We put a new.env instead:
	if(identical(envir, baseenv()) || identical(envir, empty) ||
	    startsWith(environmentName(envir), "package:")) {
		envir <- new.env(parent = korenv)
		envName <- "new.env()"
		warning("using a new environment instead of 'envir'")
	} else {
	   # check if kor is present up the parent environment path
	   e <- pe <- envir
	   while (!(hasKorParent <- identical(e, korenv)) && !identical(e, empty))
		   e <- parent.env(pe <- e)
	   if (!hasKorParent) {
		   warning("appending 'package:kor' environment as the top parent environment")
		   parent.env(pe) <- korenv
		   assignTemp("remove.kor.parent", TRUE)
	   }
	}

	if(identical(environmentName(envir), ""))
	   attr(envir, "name") <- envName
    
    assignTemp(".EvalEnv", envir)
    if (is.null(envName)) return()
# XXX: [1] "illegal character"
#      [1] "missing ) after argument list"
    koCmd(paste0("kor.envChangeEvent(", deparse(envName, control = NULL), ")"))
    if (quiet) return()
    if (identical(envir, .GlobalEnv)) 
        message("Evaluating in the global environment")
    else stop(simpleMessage(paste0("Current evaluation environment is now inside\n\t", 
        envName, "\nUse 'koBrowseEnd()' to return to the global environment.", 
        "\n(Note this will not resume execution)\n")))
}
