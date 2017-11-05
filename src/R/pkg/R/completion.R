#' @title Code completion
#' @description These functions provide choices for code completion.
#' @md
#' @examples 
#' completeArgs("anova", fm1) # if 'fm1' is of class 'glm', it returns argument
#'    						  #names for 'anova.glm'
#' completeArgs("[", object)
#' completeArgs("stats::`anova`", fm1) # function names may be backtick quoted,
#'                                     # and have a namespace extractor

#' @describeIn completion generic code completion.
#' @param code character string, the code to be completed.
#' @param pos cursor position. Defaults to at end of the `code`.
#' @param min.length minimum length of the code.
#' @param skip.used.args logical. Should alredy used argument be omitted?
#' @param field.sep character string to be used as a field separator.
#' @param sep character string to be used as a record separator.
#' @examples
#' completion("print(x")
#' completeSpecial("data")
#' @export
completion <- 
function (code, field.sep = "\x1e", sep = "\n",
		  pos = nchar(code), min.length = 2L,
		  skip.used.args = FALSE) {

	types <- list(fun = "function", var = "variable",
		env = "environment", args = "argument", keyword = "keyword")

	## Default values for completion context
	token <- ""
	## Is there some code provided?
	code <- paste(as.character(code), collapse = "\n")
	if (is.null(code) || !length(code) || code == "" ||
		nchar(code, type = "chars") < min.length) {
		return(invisible(NULL))
	}

	## If code ends with a single [, then look for names in the object
	if (regexpr("[^[][[]$", code) > 0L) {
		## TODO: look for object names... currently, return nothing
		return(invisible(""))
	}

	## If code ends with a double [[, then, substitute $ instead and indicate
	## to quote returned arguments (otherwise, [[ is not correctly handled)!
	if (regexpr("[[][[]$", code) > 0L) {
		code <- sub("[[][[]$", "$", code)
		dblBrackets <- TRUE
	} else dblBrackets <- FALSE
	
	
	## Save funarg.suffix and use " = " locally
	ComplEnv <- getFrom("utils", ".CompletionEnv")
	## Calculate completion with standard R completion tools
	cplutils$.assignLinebuffer(code)
	cplutils$.assignEnd(pos)
	cplutils$.guessTokenFromLine()
	cplutils$.completeToken()
	completions <- cplutils$.retrieveCompletions()
	#triggerPos <- pos - ComplEnv[["start"]]
	
	## For tokens like "a[m", the actual token should be "m"
    ## completions are modified accordingly
    rx <- regexpr("[[]+", ComplEnv[["token"]])
    if (rx > 0L) {
    	## Then we need to trim out whatever is before the [ in the completion
    	## and the token
    	start <- rx + attr(rx, "match.length")
    	ComplEnv$token <- substring(ComplEnv[["token"]], start)
    	completions <- substring(completions, start)
    }
	if (!length(completions)) return(invisible(""))

	## Remove weird object names (useful when the token starts with ".")
    i <- grep("^[.]__[[:alpha:]]__", completions)
	if (length(i) > 0L) completions <- completions[-i]
    if (!length(completions)) return(invisible(""))

	## Eliminate function arguments that are already used
	#fguess <- ComplEnv$fguess
	#if (skip.used.args && length(fguess) && nchar(fguess))
		#completions <- completions[!(completions %in% ComplEnv$funargs)]
	#if (!length(completions)) return(invisible(""))

	## Eliminate function names like `names<-`
	i <- grep("<-.+$", completions)
	if (length(i) > 0L) completions <- completions[-i]

	## In case of [[, restore original code
	if (dblBrackets) {  # Substitute var$name by var[["name"
		completions <- sub("\\$(.+)$", '[["\\1"', completions)
		#token <- sub("\\$$", "[[", token)
		#triggerPos <- triggerPos + 1L
	}

	## Finalize processing of the completion list
	#funargs <- ComplEnv$funargs
	#isFirstArg <- ComplEnv$isFirstArg

	tl <- integer(length(completions))
	tl[grep(" = $", completions)] <- 4L
	tl[grep("::$", completions)] <- 3L
	tl[grep("<-$", completions)] <- 1L
	tl[completions %in% .reserved.words] <- 5L
	tl[!tl] <- ifelse(sapply(strsplit(completions[!tl], ":::?"), function(x) {
		if(length(x) == 2L) exists(x[2L], where = asNamespace(x[1L]),
								  mode = "function")
		else exists(x, where = getEvalEnv(), mode = "function")	}),  1L, 2L)
	tl <- factor(tl, levels = seq_len(5L), labels = types)

	if(!is.null(sep)) cat(paste(tl, completions, sep = field.sep), sep = sep)
	invisible(completions)
}

#TODO: should check whether the name of the argument is also the first
#argument for the generic function.


#' @describeIn completion returns function argument names.
#' @md
#' @details If 'object' is provided and 
#'    `FUNC` is generic (either S3 or S4), `completeArgs` returns only arguments for 
#'    the appropriate method and/or default method if not found.
#' @note The function assumes that method is dispatched based on the first
#'    argument which may be incorrect.
#' @export
#' @param FUNC.NAME name of the function of which arguments are to be listed.
#' @param \dots optional arguments for the `FUNC` to be used in determining the 
#'        appropriate method.
# @param field.sep character string to be used as a field separator.
#' @export
`completeArgs` <-
function(FUNC.NAME, ..., field.sep = "\x1e") {
	rx <- regexpr("^([\\w\\.]+):{2,3}(`|)([\\w\\.\\[\\%]+)\\2$", FUNC.NAME, perl = TRUE)
	if (rx == 1L) {
		cs <- attr(rx,"capture.start")
		fn <- substring(FUNC.NAME, cs, cs - 1L + attr(rx,"capture.length"))[c(1L, 3L)]
		FUNC.NAME <- fn[2L]
		envir <- tryCatch(asNamespace(fn[1L]), error = function(e) NULL)
		if(is.null(envir)) return(invisible(NULL))
		inherit <- FALSE
	} else {
		envir <- getEvalEnv()
		inherit <- TRUE
	}

	if(exists(FUNC.NAME, envir = envir, mode = "function", inherits = inherit)) {
		fun <- get(FUNC.NAME, envir = envir, mode = "function", inherits = inherit)
	} else
		fun <- NULL

	if(is.null(fun) || mode(fun) != "function") return(invisible(NULL))
	if (findGeneric(FUNC.NAME, envir) != "" || is.primitive(fun)) {

		cl <- sys.call()
		cl$field.sep <- NULL
		cls <- NA_character_
		if(length(cl) > 2L){
			object <- cl[[3L]]
			if (!missing(object)) {
				if(mode(object) == "call") {
					if ("~" %in% all.names(object, functions = TRUE, max.names = 4L))
						cls <- "formula"
					#else {
					    # list classes for commonly used objects
						# perhaps scan global environment?
					#}
				} else {
					object <- tryCatch(eval(object, parent.frame()), error = function(e) NULL)
					cls <- class(object)
				}
			}
		}


		if(is.na(cls[1L])) {
			ret <- argNamesFun(.getS3method(FUNC.NAME, "default"))
		} else {
			# XXX:  always include 'default' arguments??
			cls <- c(cls, "default")
			ncls <- length(cls)
			ret <- vector(ncls + 2L, mode = "list")
			if(isS4(fun)) ret[[1L]] <- unique(unlist(lapply(cls, function(x)
				argNamesFun(selectMethod(FUNC.NAME, x, optional = TRUE)))))
				
			ret[1L + seq_len(ncls)] <- lapply(cls, function(x)
				argNamesFun(.getS3method(FUNC.NAME, x)))
				
			if(all(vapply(ret, is.null, TRUE))) {
				ret <- argNamesFun(.getS3method(FUNC.NAME, "default"))
			} else {
				ret <- unique(unlist(ret, FALSE, FALSE))
			}
		}
	} else ret <- character(0L)
	ret <- unique(c(ret, names(formals(args(fun)))))
	if (length(ret) > 1L && (FUNC.NAME == "[" || FUNC.NAME == "[["))
		ret <- ret[-1L]
	if(FUNC.NAME %in% names(.completion_specfun))
		ret <- unique(c(ret, .completion_specfun[[FUNC.NAME]]))


	ret <- ret[ret != "..."]
	if(length(ret))
		cat(paste("argument", field.sep, ret, " =", sep = ""), sep = "\n")
	return(invisible(NULL))
}

#' @describeIn completion provides special completions.
#' @md
#' @details `completeSpecial` prints newline separated completions for some 
#'          special cases. Currently these are: package, namespace, graphical 
#'          parameters, 'options' names and quoted items for use with `[` or `[[`.
#' @param what character string. Should be one of "search", "library", "par", 
#'        "options", "data" or "[".
#' @param x used only with `what = "["`, the name of the object of which the 
#' elements should be listed.
# @param field.sep character string to be used as a field separator.
#' @param argpos used only with `what = "["`, specifies which argument inside 
#'    the square brackets to complete.
#' @export
`completeSpecial` <- function(what, x = NULL, field.sep = "\x1e",
								 argpos = 1L) {
	res <- switch(what, search = {
			type <- "namespace"
			res <- search()
			res[!(res %in% c(".GlobalEnv", "package:tcltk", "package:utils",
				"komodoConnection", "package:methods", "tempEnv", "Autoloads",
				"package:base"))]
	   }, library = {
			type <- "module"
			unique(unlist(lapply(.libPaths(), dir), use.names = FALSE))
	   }, par = {
			type <- "grapharg"
			paste(argNames("par"), "=")
	   }, options = {
			type <- "argument"
			paste(names(options()), "=")
	   }, data = {
			type <- "dataset"
			unique(sub("^.+\\(([^\\)]+)\\)$", "\\1",
				data(verbose = FALSE)$results[, "Item"], perl = TRUE))
	   }, "[" = {
			type <- "$variable"
			tryCatch(paste("\"", dimnames(x)[[argpos]], "\"", sep = ""),
							error = function(e) "")
	   }, return(invisible(NULL)))
	cat(paste(type, res, sep = field.sep), sep = "\n")
	return(invisible(NULL))
}


getFrom <- function (pkg, name) {
    get(name, envir = asNamespace(pkg), inherits = FALSE)
}

findGeneric <- getFrom("utils", "findGeneric")
argNames <- getFrom("utils", "argNames")

.getS3method <- function(f, class, envir = .GlobalEnv)
	eval(call("getS3method", f, class, optional = TRUE), envir = envir)

argNamesFun <- function(f) if(is.function(f)) names(formals(f)) else NULL

.completion_specfun <- list(
	rep = c('times', 'length.out', 'each'),
	bxp = c('boxwex', 'staplewex', 'outwex','boxlty', 'boxlwd', 'boxcol',
		'boxfill', 'medlty', 'medlwd', 'medpch', 'medcex', 'medcol', 'medbg',
		'whisklty', 'whisklwd', 'whiskcol', 'staplelty', 'staplelwd',
		'staplecol', 'outlty', 'outlwd', 'outpch', 'outcex', 'outcol', 'outbg')
	)
.completion_specfun[['boxplot']] <- .completion_specfun[['bxp']]

# "imports" from unexported "utils"
cplutils <- list()
for(i in c(".assignLinebuffer", ".assignEnd", ".guessTokenFromLine", ".completeToken", ".retrieveCompletions")) 
	cplutils[[i]] <- getFrom("utils", i)


.reserved.words <- c("if", "else", "repeat", "while", "function", "for", "in",
	"next", "break", "TRUE", "FALSE", "NULL", "Inf", "NaN", "NA", "NA_integer_",
	"NA_real_", "NA_complex_", "NA_character_")


## Similar to `find` but "what" can be a vector
## also, this one only searches in packages (position of the search path
## matching '^package:') and only gives one result per "what"
.find.multiple <- function (what) {
    stopifnot(is.character(what))
    sp <- grep( "^package:", search(), value = TRUE)
    out <- rep( "" , length(what))
    for (i in sp) {
        ok <- what %in% ls(i, all.names = TRUE) & out == ""
        out[ok] <- i
        if (all(out != "")) break
    }
    names(out) <- what
    return(sub("^package:", "", out))
}
