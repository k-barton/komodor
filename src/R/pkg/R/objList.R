#' @title Functions used by R object browser
#' @description Internal functions for Komodo's R object browser.
#' @rdname rbrowser
# @keywords internal
#' @md
#' @param id character string.
#' @param envir which environment to use in listing the objects. Defaults to the current evaluation environment.
#' @param expr optional, the object of which elements should be listed.
#' @param all.names logical. If `FALSE`, names which begin with a `.` are omitted.
#' @param pattern optional, a regular expression. Only names matching pattern are returned. 
#' @param group optional, name of the group of object classes. If provided, only object of that group are returned.
#' @param all.info if `TRUE`, the first column holds the environment name.
#' @param compare if `TRUE` and the result is identical to the previous one with the same `id`, an empty list is returned. 
#' @param \dots additional arguments. Ignored.
#' @examples
#'  objList()
#'  
#' if(require(datasets)) {
#'    write.objList(objList(expr=npk, compare=FALSE))
#'    objList(expr=Loblolly)
#'    objList(expr=Loblolly) ## an empty list (compare is TRUE)
#' }

# new function:
#objls(expr = NULL, envir = getEvalEnv(), all.names = FALSE, attrib = FALSE)

objList <-
function (id = "default", envir = getEvalEnv(), expr = NULL,
all.names = FALSE, pattern = NULL, group = NULL, all.info = FALSE, 
compare = TRUE, ...) {
	## Make sure that id is character
	id <- as.character(id)[1L]
	if (id == "") id <- "default"
	ename <- NA_character_
	
	if(!missing(expr)) {
		expr <- substitute(expr)
		objName <- deparse(expr, nlines = 1L, control = NULL, backtick = TRUE)
	} else {
		objName <- NULL
	}

	## Format envir as character (use only first item provided!)
	if (!is.environment(envir)) {
		if(is.numeric(envir) && envir > 0) envir <- search()[envir]
		if (is.character(envir)) {
			ename <- envir[1L]
			envir <- tryCatch(as.environment(envir), error = function(e) NULL)
			if (is.null(envir) || inherits(envir, "error"))
				return(.createEmptyObjList(all.info, "", objName))
		}
	}

	# base and .GlobalEnv do not have name attribute
    if(identical(envir, baseenv()))
	    ename <- "package:base" else
	if(identical(envir, .BaseNamespaceEnv))
		ename <- "namespace:base" else
	if (identical(envir, .GlobalEnv))
		ename <- ".GlobalEnv" else
	if (!is.null(attr(envir, "name")))
		ename <- attr(envir, "name") else
	if (is.na(ename)) ename <- deparse(substitute(envir))
	
	if (is.null(envir)) return(.createEmptyObjList(all.info, ename, objName))

	pkgName <- ename
	isPackage <- !is.null(ename) && grepl("^package:", ename)
	pkgName <- if(isPackage) substr(pkgName, 9L, nchar(pkgName)) else character(0L)
	envir0 <- envir
	if(isPackage && all.names)
		envir <- tryCatch(asNamespace(pkgName), error = function(e) envir)

	if (!is.null(objName)) {
		rval <- .lsObj(expr, envir, objName)
	} else {
	
		## Get the list of objects in this environment
		items <- ls(envir = envir, all.names = all.names)
		
		lditems <- character(0L)
		if(all.names && isNamespace(envir)) {
			lazydata <- envir[[".__NAMESPACE__."]]$lazydata
			if(!is.null(lazydata)) lditems <- ls(lazydata)
		}
		
		if(!missing(pattern) && is.character(pattern)) {
			items <- items[grep(pattern, items)]
			lditems <- lditems[grep(pattern, lditems)]
		}
	
		n <- length(items)
		m <- length(lditems)
		if (n + m == 0L) return(.createEmptyObjList(all.info, ename, objName))
	
		rval <- .createObjListResultMatrix(n + m)
		rval[, 1L] <- c(items, lditems)
		j <- 3L:6L
		# 'get' throws error on missing values, e.g. baseenv()[['.Last.value']]

		for(i in seq.int(n))
			rval[i, j] <- .objDescr(envir[[items[i]]])
		if(m) for(i in seq.int(m))
			rval[n + i, j] <- .objDescr(lazydata[[lditems[i]]])
		
		items <- rval[, 1L]
	
		# Quote non-syntactic names
		nsx <- items != make.names(items)
		#rval[!nsx, 2L] <- "" # items[!nsx]
		rval[nsx, 2L] <- paste0("`", items[nsx], "`")
		
		hiddenItems <- if(all.names)
			!items %in% ls(envir = envir0, all.names = FALSE) else FALSE
		
		rval[hiddenItems, 6L] <- paste0(rval[hiddenItems, 6L], "h")
		#if(isPackage) {
		#	 rval[hiddenItems, 2L] <- paste0(pkgName, ":::", rval[hiddenItems, 2L])
		#    rval[!hiddenItems, 2L] <- paste0(pkgName, "::", rval[!hiddenItems, 2L])
		#}
	}

	if (NROW(rval) == 0L) return(.createEmptyObjList(all.info, ename, objName))

	if (isTRUE(all.info)) rval <- cbind(Envir = ename, rval)

	vGroup <- rval[, 4L] # Group
	vClass <- rval[, 5L]
	vGroup[vGroup %in% c("name", "environment", "promise", "language", "char",
		"...", "any", "(", "call", "expression", "bytecode", "weakref",
		"externalptr")] <- "language"
	vGroup[vGroup == "pairlist"] <- "list"
	vGroup[!(vGroup %in% c("language", "function", "S4")) & rval[, 4L] != vClass] <- "S3"
	vGroup[vClass == "factor"] <- "factor"
	vGroup[vClass == "data.frame"] <- "data.frame"
	vGroup[vClass == "Date" | vClass == "POSIXt"] <- "DateTime"
	rval[, 4L] <- vGroup
	rval[, 5L][rval[, 5L] == rval[, 4L]] <- ""

	## Possibly filter according to group
	if (!is.null(group) && is.character(group) && group[1L] != "")
		rval <- rval[vGroup == group[1L], ]

	## Determine if it is required to refresh something
	changed <- TRUE
	if (isTRUE(compare)) {
		objListCache <- getTemp(".objListCache", default = new.env(hash = TRUE))
		if (identical(rval, objListCache[[id]])) {
			return(.createEmptyObjList(all.info, ename, objName))
		} else
			objListCache[[id]] <- rval
	}
	
	attr(rval, "all.info") <- all.info
	attr(rval, "envir") <- ename
	attr(rval, "object") <- objName
	attr(rval, "class") <- c("objList", "matrix")
	return(rval)
}


print.objList <-
function (x, header = !attr(x, "all.info"), ...) {
	if (!inherits(x, "objList")) stop("x must be an 'objList' object")

	empty <- !is.matrix(x) || NROW(x) == 0L
	cat(if (empty) "An empty objects list\n" else "Objects list:\n")
	if (header) {
		header.fmt <- "\tEnvironment: %s\n\tObject: %s\n"
		objName <- if (is.null(attr(x, "object"))) "<All>" else attr(x, "object")
		cat(sprintf(header.fmt, attr(x, "envir"), objName))
	}
	if (!empty) {
		rownames(x) <- character(nrow(x))
		print.default(as.matrix(x), quote = FALSE)
	}
	return(invisible(x))
}


#' @rdname rbrowser
#' @md
#' @export
#' @param x an object of class `objList` 
#' @param file,sep,eol,fileEncoding see `write.table` 
#' @param header logical. Should a header "Env=environment Obj=object" be printed?
write.objList <-
function (x, file = "", sep = " ", eol = "\n", header = !attr(x, "all.info"),
		  fileEncoding = "", ...) {
	if (!inherits(x, "objList")) stop("x must be an 'objList' object")
		
	if (file == "") file <- stdout() else
		if (is.character(file)) {
			file <- if (nzchar(fileEncoding)) file(file, "w", encoding = fileEncoding) else
			file(file, "w")
			on.exit(close(file))
		} else if (!isOpen(file, "w")) {
			open(file, "w")
			on.exit(close(file))
		}
    if (!inherits(file, "connection")) stop("'file' must be a character string or connection")

	empty <- !is.matrix(x) || NROW(x) == 0L
	
	if (header) {
		cat("Env=", attr(x, "envir"), "\n",
		    "Obj=", if (is.null(attr(x, "object"))) "" else attr(x, "object"), 
			"\n", sep = "", file = file, append = TRUE)
	}

	if (!empty) {
		if (!is.null(nrow(x)) && nrow(x) != 0L) {
			write.table(x, file = file, append = TRUE, row.names = FALSE, col.names = FALSE, sep = sep,
				eol = eol, quote = FALSE)
			cat("\n", file = file, append = TRUE)
		}
	}
	return(invisible(x))
}

## Called by objList() when object is provided
.lsObj <-
function (expr, envir, objName, ...) {
	
	error <- FALSE
	obj <- tryCatch(eval(expr, envir), error = function(e) error <<- TRUE)
	if (error) return(NULL)

	if (is.environment(obj)) obj <- as.list(obj)

	if (mode(obj) == "S4") {
		return(.lsObjS4(obj, objName))
	} else if (is.function(obj)) {
		return(.lsObjFunction(obj, objName))
	} else {  # S3

		if((!is.language(obj) || is.symbol(obj)) && (!is.list(obj) || length(obj) == 0L))
			return(NULL)
		
		# TODO: merge repeated code 
		if(is.language(obj)) {
			itemidx <- seq.int(l <- length(obj))
			itemnames <- character(l)
			for(i in itemidx) itemnames[i] <- deparse(obj[[i]], nlines = 1L, control = NULL)
			#itemnames <- vapply(obj, deparse, "", nlines = 1L, control = NULL)
			fullnames <- names(obj)
			if(is.null(fullnames)) fullnames <- character(l)
			if(any(i <- fullnames == ""))
				fullnames[i] <- paste0(objName, "[[", itemidx[i], "]]")
			fullnames[!i] <- paste0(objName, "$", fullnames[!i])
		} else {
			itemnames <- fullnames <- names(obj)
			if (is.null(itemnames)) {
				itemnames <- seq_along(obj)
				fullnames <- paste0(objName, "[[", itemnames, "]]")
			} else {
				w.names <- itemnames != ""
				.names <- itemnames[w.names]
				nsx <- .names != make.names(.names)  # Non-syntactic names
				.names[nsx] <- paste0("`", .names[nsx], "`")
				fullnames[w.names] <- paste0(objName, "$", .names)
				fullnames[!w.names] <- paste0(objName, "[[", seq_along(itemnames)[!w.names], "]]")
			}
		}
		
		n <- length(itemnames)
		rval <- .createObjListResultMatrix(n)
		rval[, 1L] <- itemnames
		rval[, 2L] <- fullnames
		j <- 3L:6L
		for(i in seq.int(n))
			rval[i, j] <- .objDescr(obj[[i]])
	}
	return(rval)
}

.createObjListResultMatrix <- function(n) {
	matrix("", ncol = 6L, nrow = n,
	dimnames = list(NULL, c("Name", "Full.name", "Dims", "Group", "Class", "Recursive")))
}

# Called by .lsObj for functions
.lsObjFunction <-
function (obj, objName = deparse(substitute(obj))) {
	## formals(obj) returns NULL if only arg is ..., try: formals(expression)
	obj <- formals(args(obj))
	objName <- paste0("formals(args(", objName, "))")

	if(length(obj) == 0L) return(NULL)

	itemnames <- fullnames <- names(obj)
	nsx <- itemnames != make.names(itemnames) # non-syntactic names
	itemnames[nsx] <- paste0("`", itemnames[nsx], "`")
	fullnames <- paste0(objName, "$", itemnames)
	
	n <- length(itemnames)
	rval <- .createObjListResultMatrix(n)
	rval[, 1L] <- itemnames
	rval[, 2L] <- fullnames
	j <- 3L:6L
	for(i in seq.int(n)) {
		x <- obj[[i]]
		lang <- is.language(obj[[i]])
		o.class <- class(obj[[i]])[1L]
		o.mode <- mode(obj[[i]])
		d <- deparse(obj[[i]])
		if (lang && o.class == "name") {
			o.class <- ""
			o.mode <- ""
		}
		rval[i, j] <- c(paste0(d, collapse = "x"), o.class, o.mode, "")		
	}
	return(rval)
}

## Called by .lsObj in S4 case
.lsObjS4 <-
function (obj, objName = deparse(substitute(obj))) {
	
	itemnames <- slotNames(obj)
	isClassDef <- is(obj, "classRepresentation")

	nsx <- itemnames != make.names(itemnames)
	itemnames[nsx] <- paste0("`", itemnames[nsx], "`")

	n <- length(itemnames)
	rval <- .createObjListResultMatrix(n)
	rval[, 1L] <- itemnames
	#rval[, 2L] <- paste0(objName, "@", itemnames)
	rval[, 2L] <- paste0(objName, if(isClassDef) "@slots$" else "@", itemnames)
	j <- 3L:6L
	
	if(isClassDef)
		for(i in seq.int(n)) rval[i, j] <- .objDescr(obj@slots[[i]])
		else
			for(i in seq.int(n)) rval[i, j] <-  .objDescr(slot(obj, itemnames[i]))
	return(rval)
}


## Returns a *character* vector with unnamed elements: dims, mode, class, 'r'(ecursive) or ''
.objDescr <-
function (x) {
	xClass <- class(x)
	xMode <- mode(x)

	tryCatch({
		if(is.function(x))
			d <- length(formals(x))
		else
			d <- dim(x)
		if (is.null(d))
			d <- if(xMode == "S4") length(slotNames(x)) else length(x)
	}, error = function(x) NULL)
	
	isRecursive <- (xMode == "S4" || is.function(x) ||
	    (is.recursive(x) && !inherits(x, 'POSIXlt'))) && !is.symbol(x) &&
			 sum(d) != 0L
	
	c(paste0(d, collapse = "x"), xMode, xClass[1L], if(isRecursive) "r" else "")
}

.createEmptyObjList <- function(all.info, envir, object) {
    rval <- character(0L)
	class(rval) <- "objList"
	attr(rval, "all.info") <- all.info
	attr(rval, "envir") <- envir
	attr(rval, "object") <- object
	return(rval)
}
