#' @rdname koDebug
#' @name koDebug
#' @title Browsing after an error
#' @md
#' @description This function allows for debugging (browsing) after an error occurred in the environment
#'    (frame) that caused the error. Similar to `recover` with only the innermost frame available.
#'    It does not set a debug flag like `debug` does, instead returns a modified function `FUN`.
#' @param FUN the function to modify 
#' @return a new function, being `FUN` wrapped in a debugging code that executes `koBrowseHere` after an error.
#' @export
koDebug <-
function(FUN) {
	expr <- expression(tryCatch(BODY, error = function(e) {
		cat("Debug error: ", conditionMessage(e), "\n")
		cat("in: ", deparse(conditionCall(e), control = NULL), sep = "\n", "\n")
		eval.parent(expression(eval(expression(koBrowseHere()), parentenv)))
	}))
	debugFun <- function() {} 
	formals(debugFun) <- formals(FUN)
	
	.subst <- function (expr, envir = NULL, ...) 
    eval.parent(call("substitute", expr, c(envir, list(...))))
	
	body(debugFun) <- .subst(expr[[1L]], BODY = body(FUN))
	environment(debugFun) <- environment(FUN)
	invisible(debugFun)
}