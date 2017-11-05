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