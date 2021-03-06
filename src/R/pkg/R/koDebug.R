#' @rdname koDebug
#' @name koDebug
#' @title Browsing after an error
#' @md
#' @description This function allows for debugging (browsing) after an error occurred in the environment
#'    (frame) that caused the error. Similar to `recover` with only the innermost frame available.
#'    It does not set a debug flag like `debug` does, instead returns a modified function `FUN`.
#' @param FUN the function to modify
#' @param refresh logical, if `TRUE` (default), R Object Browser widget is refreshed.
#' @return a new function, being `FUN` wrapped in a debugging code that executes `koBrowseHere` after an error.
#' @export
koDebug <-
function(FUN, refresh = TRUE) {
	expr <- expression(tryCatch(BODY, error = function(e) {
		cat("Error: ", conditionMessage(e), "\n")
		cat("in: ", deparse(conditionCall(e), control = NULL), sep = "\n", "\n")
		nframe <- sys.nframe() - 4L
		envName <- format(sys.call(nframe))[1L]
        setEvalEnv(sys.frame(nframe), envName, FALSE)
		env <- getEvalEnv()
		attr(env, "name") <- envName
	}))
	if(!refresh) expr[[1L]]$error[[3L]][[8L]] <- NULL
	
	debugFun <- function() {} 
	formals(debugFun) <- formals(FUN)
	
	.subst <- function (expr, envir = NULL, ...) 
    eval.parent(call("substitute", expr, c(envir, list(...))))
	
	body(debugFun) <- .subst(expr[[1L]], BODY = body(FUN))
	environment(debugFun) <- environment(FUN)
	invisible(debugFun)
}
