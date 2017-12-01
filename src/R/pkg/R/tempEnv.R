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
function (x)
   if(existsTemp(x)) rm(list = x, envir = tempEnv(), inherits = FALSE)
     
#' @rdname tempEnv
#' @export
`getTemp` <- 
function (x, default = NULL, mode = "any", item = NULL) {
    Mode <- if (is.null(item)) mode else "any"
	env <- tempEnv()
    if  (exists(x, envir = env, mode = Mode, inherits = FALSE)) {
        value <- get(x, envir = env, mode = Mode, inherits = FALSE)
        if (is.null(item)) {
			return(value)
		} else {
            item <- as.character(item)[1L]
            if (inherits(value, "list") && item %in% names(value)) {
                value <- value[[item]]
                if (mode != "any" && mode(value) != mode) 
					value <- default
                return(value)
            } else {
				if(!missing(default)) assign(x, default, envir = env, inherits = FALSE)
				return(default)
			}
        }
    } else  { # Variable not found, return the default value
		if(!missing(default)) assign(x, default, envir = env, inherits = FALSE)
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
setEvalEnv <-
function(envir = .GlobalEnv) 
assignTemp(".EvalEnv", envir)
