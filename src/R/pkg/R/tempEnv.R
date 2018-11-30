#' @title temporary environment
#' @aliases getTemp assignTemp rmTemp setEvalEnv getEvalEnv
#' @rdname tempEnv
#' @encoding utf-8
#' @keywords internal
#' @description
#' Maintain temporary environment. Set evaluation environment.
#' @param x,item a variable or list item name, given as a character string.
#' @param value a value to be assigned to x.
#' @param mode the mode or type of object sought.

#' @rdname tempEnv
#' @export
`assignTemp` <- 
function (x, value) 
assign(x, value, envir = tempEnv(), inherits = FALSE)

#' @rdname tempEnv
#' @export
`existsTemp` <- 
function (x, mode = "any")
   exists(x, envir = tempEnv(), mode = mode, inherits = FALSE)
  
#' @rdname tempEnv
#' @export
`rmTemp` <- 
function (x, item = NULL) {
	envir <- tempEnv()
	if(exists(x, envir = envir, inherits = FALSE)) {
		if(is.null(item))
			rm(list = x, envir = envir, inherits = FALSE)
		else if(exists(x, mode = "list", envir = envir, inherits = FALSE)) {
		    value <- get(x, envir = envir, inherits = FALSE)
			value[item] <- NULL
			assignTemp(x, value)
		}
	}
}

#' @rdname tempEnv
#' @export
`getTemp` <- 
function (x, default = NULL, mode = "any", item = NULL) {
    Mode <- if (is.null(item)) mode else "list"
	env <- tempEnv()
    if(exists(x, envir = env, mode = Mode, inherits = FALSE)) {
        value <- get(x, envir = env, mode = Mode, inherits = FALSE)
        if (is.null(item))
			return(value)
		else {
            item <- as.character(item)[1L]
			if(item %in% names(value)) {
				value <- value[[item]]
				if (mode != "any" && mode(value) != mode) 
					value <- default
				return(value)
			} else { # x is a list, but has no item
				if(!missing(default)) {
					value[[item]] <- default
					assign(x, value, envir = env, inherits = FALSE)
				}
				return(default)
			}
        }
	} else { # Variable does not exist, or is not a list and item is given.
			 # Return the default value
		if(!missing(default)) {
	        if (is.null(item))
				assign(x, default, envir = env, inherits = FALSE)
			else if(!exists(x, envir = env, inherits = FALSE)) {
				value <- list(default)
				names(value)[1L] <- as.character(item)[1L]
				assign(x, value, envir = env, inherits = FALSE)
			}
		}
        return(default)
	}
}

.tempEnv <- new.env(hash = FALSE)

`tempEnv` <- 
function() .tempEnv

#' @rdname tempEnv
#' @export
getEvalEnv <-
function() 
getTemp(".EvalEnv", default = .GlobalEnv)

#' @rdname tempEnv
#' @md
#' @export
#' @param envir the `environment` to use for evaluation of commands in Komodo.
#' @param envName optional character string, the name of the `environment` to
#         use in Komodo's R Object Browser. Set to `NULL` to skip firing 
#         Komodo event.
#  @param quiet if `TRUE`, no message is displayed
setEvalEnv <-
function(envir = .GlobalEnv, envName = deparse(substitute(envir)), quiet = FALSE) {
	
    # TODO optimize:
    envir <- as.environment(envir)
    korenv <- as.environment(paste0("package:", kor:::.packageName))
    empty <- emptyenv()
    if(!identical(curEvalEnv <- getTemp(".EvalEnv", .GlobalEnv), .GlobalEnv) &&
        isTRUE(getTemp("remove.kor.parent", FALSE))) {
        e <- pe <- curEvalEnv
        while(!(hasKorParent <- identical(e, korenv)) && !identical(e, empty))
            e <- parent.env(pe <- e)
        parent.env(pe) <- korenv
        rmTemp("remove.kor.parent")    
    }
    while(!(hasKorParent <- identical(e, korenv)) && !identical(e, empty))
        e <- parent.env(pe <- e)
    if(!hasKorParent) {
        warning("appending 'package:kor' environment as the top parent environment")
        parent.env(pe) <- korenv
        assignTemp("remove.kor.parent", TRUE)
    }        

    assignTemp(".EvalEnv", envir)
	if(is.null(envName)) return()

# XXX: [1] "illegal character"
#      [1] "missing ) after argument list"
 koCmd(paste0("kor.envChangeEvent(", deparse(envName, control = NULL), ")"))
	if(quiet) return()
	if(identical(envir, .GlobalEnv))
		message("Evaluating in the global environment") else
		stop(simpleMessage(paste0("Current evaluation environment is now inside\n\t",
			envName,
			"\nUse 'koBrowseEnd()' to return to the global environment.",
			"\n(Note this will not resume execution)")))
}
