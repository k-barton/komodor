#' Remove element
#' 
#' @md
#' @description `rmElement` is a helper function to remove object elements by assigning a `NULL` value to them.
#' @note This may also result in removal of the parent element, if the parent element becomes `NULL`.
# ##' See `Examples`.

#' @param expr an object to be set to `NULL`.
#' @param envir the environment in which `expr` is to be evaluated.
#' @export
rmElement <- function(expr, envir) {
    expr <- substitute(expr)
    envir <- as.environment(envir)
    if(!.rmFuncArg(expr, envir))
        eval(call("<-", expr, NULL), envir)
}

# Note: modifying formal arguments has a side-effect of removing source reference.
.rmFuncArg <- function(expr, envir) {

    # test for expr == formals(FUN)$item
    if(!is.call(expr) || length(expr) < 3L || expr[[1L]] != "$" ||
       !is.call(expr[[2L]]) || expr[[2L]][[1L]] != "formals")
        return(FALSE)
    item <- expr[[3L]]
    if(!is.name(item)) return(FALSE)
    fsym <- expr[[2L]][[2L]]
    if(is.call(fsym) && fsym[[1L]] == "args" && length(fsym) == 2L)
        fsym <- fsym[[2L]]
    if(!is.name(fsym)) return(FALSE)
    fname <- as.character(fsym)
    envir <- as.environment(envir)
    if(!exists(fname, envir, inherits = FALSE, mode = "function"))
        return(FALSE)
    FUN <- get(fname, envir)
    
	a <- formals(FUN)	
	argn <- as.character(item)
	which <- match(argn, names(a))[1L]
	if(is.na(which)) return(FALSE)
	formals(FUN) <- a[-which]
	assign(fname, FUN, envir)
	return(TRUE)
}
