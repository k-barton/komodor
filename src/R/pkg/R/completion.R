## TODO: `backtick-quote` non syntactic names
## TODO: ` | ...`  --> style is BQ, trigger if ch[-1] == `
## TODO: % | operators% --> style is OP & ch[first of style] == %, trigger if ch[-1] == %, completePercentOperator()
## TODO: object $ "| ..." --> style is DQ|SQ|BQ & ch[-1] == $ && in variable, trigger if ch[-1] in "`'
## TODO: object $ `| ...`
## TODO: object[["| ..."
## TODO: object[[ ... , |  --> completeArgs("`[[`(object, "
## TODO: object[[1]] $|
## TODO: object[[1]] [[ "| ..."
## TODO: object[[1L]] $|
## TODO: object[[1L]] [[ "| ..."
## TODO: object[[name]] $| --> object $ `name` $
## TODO: object[[name]] [["|  ..."
## TODO: attr(object, "|  ..." -> names(attributes(object))



#' @rdname completion
#' @encoding utf-8
#' @title Code completion
#' @description Provide choices for code completion.
#' @md
#' @examples 
#' ## TODO: define gm1 && object
#' completeArgs("anova", fm1) # if 'fm1' is of class 'glm', it returns argument
#'    						  #names for 'anova.glm'
#' completeArgs("[", object)
#' completeArgs("stats::`anova`", fm1) # function names may be backtick quoted,
#'                                     # and have a namespace extractor
# @describeIn completion generic code completion.
#' @param code character string, the code to be completed.
#' @param pos cursor position within `code`. Defaults to at end of `code`.
#' @param min.length minimum length of the code.
#' @param skip.used.args logical. Should alredy used arguments be omitted from the result?
#' @param field.sep character string to be used as a field separator in the result.
#' @param sep character string to be used as a record separator in the result.
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
	
#	linebuffer <- substr(linebuffer, 1L, end)
#    
#	insideQuotes <- {
#        lbss <- utils:::head.default(unlist(strsplit(linebuffer, "")), end)
#        ((sum(lbss == "'")%%2 == 1) || (sum(lbss == "\"")%%2 == 
#            1))
#    }
#	#insideQuotes
#	
#    start <- if (insideQuotes) 
#        suppressWarnings(gregexpr("['\"]", linebuffer, perl = TRUE))[[1L]] else
#		suppressWarnings(gregexpr("[^\\.\\w:?$@[\\]]+", linebuffer, 
#        perl = TRUE))[[1L]]
#    
#	
#	start
#	
#    gsub("[^\\.\\w:?$@[\\]]+", "*", linebuffer, perl = TRUE)
#    gsub("[^\\w]", "*", linebuffer, perl = TRUE)
#    gsub("\\w", "*", linebuffer)
#	
#	start <- if (all(start < 0L)) 
#        0L else tail.default(start + attr(start, "match.length"), 1L) - 
#        1L
#	
#	start	
#	
#    token <- substr(linebuffer, start + 1L, end)
#    if (update) {
#        .CompletionEnv[["start"]] <- start
#        .CompletionEnv[["token"]] <- token
#        .CompletionEnv[["token"]]
#    }
#    else list(start = start, token = token)

	
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

	if(is.null(fun) || mode(fun) != "function" || FUNC.NAME == "function")
		return(invisible(NULL))

	if (is.primitive(fun) || isS3stdGeneric(fun) || isGeneric(FUNC.NAME, envir)) {

		cl <- sys.call()
		cl$field.sep <- NULL
		cls <- NA_character_
		if(length(cl) > 2L){
			object <- cl[[3L]]
			if (!missing(object)) {
				if(is.call(object)) {
					if ("~" %in% all.names(object, functions = TRUE, max.names = 4L))
						cls <- "formula"
					#else {
					    # list classes for commonly used objects
						# perhaps scan global environment?
					#}
				} else {
					object <- tryCatch(eval(object, getEvalEnv()), error = function(e) NULL) # ? or eval in parent.frame()
					cls <- class(object)
					if(isS4(object))
						cls <- c(cls, selectSuperClasses(getClass(cls)))
						# XXX compare with: extends(cls)
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
	
	if(!is.null(a <- args(fun))) ret <- unique(c(ret, names(formals(a))))
		
	if (length(ret) > 1L && (FUNC.NAME == "[" || FUNC.NAME == "[["))
		ret <- ret[ ! ret %in% c("x", "i", "j") ]
	
    if(isTRUE(FUNC.NAME %in% names(.passDots))) {
        ret <- unique(c(ret, getTemp("cpl_cached_arg",
			item = .passDots[[FUNC.NAME]],
			default = argNamesFun(get(.passDots[[FUNC.NAME]],
				mode = "function", envir = 2L)))))
    } else if(isTRUE(FUNC.NAME %in% names(.completion_specfun)))
		ret <- unique(c(ret, .completion_specfun[[FUNC.NAME]]))

	ret <- ret[ret != "..."]
	if(length(ret))
		cat(paste("argument", field.sep, ret, " =", sep = ""), sep = "\n")
	invisible()
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
				"komodoConnection", "package:methods", "Autoloads",
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
			tryCatch(paste0("\"", dimnames(x)[[argpos]], "\""),
				error = function(e) "")
	   }, attr = {
		    type <- "$variable"
			tryCatch(paste0("\"", names(attributes(x)), "\""),
				error = function(e) "")
	   }, demo = {
    	    type <- "demo"
	        demo()$results[, "Item"]
       }, # default:
            return(invisible())
	   )
	cat(paste(type, res, sep = field.sep), sep = "\n")
	invisible()
}

getFrom <- 
function (pkg, name) {
    get(name, envir = asNamespace(pkg), inherits = FALSE)
}

findGeneric <- getFrom("utils", "findGeneric")
argNames <- getFrom("utils", "argNames")

.getS3method <- function(f, class, envir = .GlobalEnv)
	eval(call("getS3method", f, class, optional = TRUE), envir = envir)

argNamesFun <- function(f) if(is.function(f)) names(formals(f)) else NULL

.completion_specfun <- list(
	rep = c('times', 'length.out', 'each')
)

# "imports" from unexported "utils"
cplutils <- list()
for(i in c(".assignLinebuffer", ".assignEnd", ".guessTokenFromLine", 
    ".completeToken", ".retrieveCompletions")) 
	cplutils[[i]] <- getFrom("utils", i)
rm(i)


.reserved.words <- 
    c("if", "else", "repeat", "while", "function", "for", "in",
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

.passDots <- list(
    read.delim = "read.table",
    read.delim2 = "read.table",
    read.csv = "read.table",
    read.csv2 = "read.table",
    boxplot = "bxp",
	plot = "par",
	heatmap = "image",
	filled.contour = "title",
	spineplot = "rect",
	rug = "axis",
	smoothScatter = "image",
	loess.smooth = "loess.control",
	loess = "loess.control"
)
