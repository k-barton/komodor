#' @title Functions used by R object browser
#' @description Internal functions for Komodo's R object browser.
#' @rdname rbrowser
# @keywords internal
#' @md
#' @param envir which environment to use in listing the objects. Defaults to the current evaluation environment.
#' @param expr optional, the object of which elements should be listed.
#' @param all.names logical. If `FALSE`, names which begin with a `.` are omitted.
#' @param attrib logical. If `TRUE` and `expr` is not missing, lists object's `attributes` after object's elements.
#' @param \dots additional arguments. Ignored.
#' @examples
#'  objls()
#'  
#' if(require(datasets)) {
#'    write.objList(objls(npk))
#'    objls(Loblolly)
#'
#' }


objls <-
function (expr = NULL, envir = getEvalEnv(), all.names = FALSE, attrib = FALSE, ...) {
	ename <- NA_character_
	
	if(!missing(expr)) {
		expr <- substitute(expr)
		objName <- deparse(expr, nlines = 1L, width.cutoff = 256L, control = NULL, backtick = TRUE)
	} else 
		objName <- NULL

	if (!is.environment(envir)) {
		if(is.numeric(envir) && envir > 0) envir <- search()[envir]
		if (is.character(envir)) {
			ename <- envir[1L]
			envir <- tryCatch(as.environment(envir), error = function(e) NULL)
			if (is.null(envir) || inherits(envir, "error"))
				return(.createEmptyObjList("", objName))
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
	
	if (is.null(envir)) return(.createEmptyObjList(ename, objName))
		  
	pkgName <- ename
	isPackage <- !is.null(ename) &&  substr(ename, 1L, 8L) == "package:"
	## 4x slower: grepl("^package:", ename)
	pkgName <- if(isPackage) substr(pkgName, 9L, nchar(pkgName)) else character(0L)
	envir0 <- envir
	if(isPackage && all.names)
		envir <- tryCatch(asNamespace(pkgName), error = function(e) envir)

	if (!is.null(objName)) {
			error <- FALSE
			obj <- tryCatch(eval(expr, envir), error = function(e) error <<- TRUE)
			if (error) {
				rval <- NULL
			} else {
				if (is.function(obj)) {
					rval <- objls_function(obj, objName)
					if (all.names && isS4(obj))
						rval <- rbind(rval, objls_s4(obj, objName))
					## TODO: S4 function
				} else if (isS4(obj))
					rval <- objls_s4(obj, objName)
				else
					rval <- objls_s3(obj, objName)
				
				if(attrib) {
					at <- attributes(obj)
					if (isS4(obj)) 
						j <- which(!names(at) %in% slotNames(obj))
				    else j <- seq_along(at)
					rval <- rbind(rval, objls_s3(at[j], objName, isAttrib = TRUE))
				}
			}
	
		#rval <- objls_object(expr, envir, objName, attrib = attrib)
	} else {
	
		## Get the list of objects in this environment
		items <- ls(envir = envir, all.names = all.names)
		
		lditems <- character(0L)
		if(all.names && isNamespace(envir)) {
			lazydata <- envir[[".__NAMESPACE__."]]$lazydata
			if(!is.null(lazydata)) lditems <- ls(lazydata)
		}
		
		n <- length(items)
		m <- length(lditems)
		if (n + m == 0L) return(.createEmptyObjList(ename, objName))
	
		rval <- .createObjListResultMatrix(n + m)
		rval[, 1L] <- c(items, lditems)
		j <- 3L:6L
		# 'get' throws error on missing values, e.g. baseenv()[['.Last.value']]

		for(i in seq.int(n))
			rval[i, j] <- objinfo(envir[[items[i]]])
		if(m) for(i in seq.int(m))
			rval[n + i, j] <- objinfo(lazydata[[lditems[i]]])
		
		items <- rval[, 1L]
	
		# Quote non-syntactic names
		nsx <- items != make.names(items)
		#rval[!nsx, 2L] <- "" # items[!nsx]
		rval[nsx, 2L] <- bqname(items[nsx])
		
		hiddenItems <- if(all.names)
			!items %in% ls(envir = envir0, all.names = FALSE) else FALSE
		
		rval[hiddenItems, 6L] <- paste0(rval[hiddenItems, 6L], "h")
	}

	if (NROW(rval) == 0L) return(.createEmptyObjList( ename, objName))

	vGroup <- rval[, 4L] # Group
	vClass <- rval[, 5L]
	vGroup[vGroup %in% c("name", "environment", "promise", "language", "char",
		"...", "any", "(", "call", "expression", "bytecode", "weakref",
		"externalptr")] <- "language" 
#	vGroup[vGroup == "pairlist"] <- "list"
	vGroup[!(vGroup %in% c("language", "function", "S4", "factor")) & rval[, 4L] != vClass] <- "S3"
	#vGroup[vClass == "factor"] <- "factor"
	#vGroup[vClass == "data.frame"] <- "data.frame"
	vGroup[vClass %in% c("Date", "POSIXct", "POSIXlt")] <- "DateTime"
	rval[, 4L] <- vGroup
	rval[, 5L][rval[, 5L] == rval[, 4L]] <- ""

	attr(rval, "envir") <- ename
	attr(rval, "object") <- objName
	attr(rval, "class") <- c("objList", "matrix")
	return(rval)
}

#NOTE: chained gsub(fixed=TRUE) are much faster than single gsub(perl=TRUE)
dblqname <- function(x)
	paste0("\"", gsub("\"",  "\\\"", gsub("\\",  "\\\\", x, fixed = TRUE), fixed = TRUE), "\"")
bqname <- function(x)
	paste0("`", gsub("`",  "\\`", gsub("\\",  "\\\\", x, fixed = TRUE), fixed = TRUE), "`")


print.objList <-
function (x, ...) {
	if (!inherits(x, "objList")) stop("x must be an 'objList' object")

	empty <- !is.matrix(x) || NROW(x) == 0L
	cat(if (empty) "An empty objects list\n" else "Objects list:\n")
	header.fmt <- "\tEnvironment: %s\n\tObject: %s\n"
	objName <- if (is.null(attr(x, "object"))) "<All>" else attr(x, "object")
	cat(sprintf(header.fmt, attr(x, "envir"), objName))
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
write.objList <-
function (x, file = "", sep = " ", eol = "\n", fileEncoding = "", ...) {
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
	
	cat("Env=", attr(x, "envir"), "\n",
		    "Obj=", if (is.null(attr(x, "object"))) "" else attr(x, "object"), 
			"\n", sep = "", file = file, append = TRUE)

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
#objls_object <-
#function (expr, envir, objName, attrib) {
#	error <- FALSE
#	obj <- tryCatch(eval(expr, envir), error = function(e) error <<- TRUE)
#	if (error) return(NULL)
#
#	if (isS4(obj))
#		return(objls_s4(obj, objName))
#	else if (is.function(obj)) 
#		return(objls_function(obj, objName))
#	else   # S3
#		return(objls_s3(obj, objName))
#}

hasAttributes <- function(obj, omit = NULL) {
	an <- names(attributes(obj))
	if(is.null(an)) return(FALSE)
	any(!an %in% c("names", "class", "dim", "dimnames", "row.names", omit))
}

objls_s3 <-
function (obj, objName, isAttrib = FALSE) {
	#if (is.environment(obj)) obj <- as.list(obj)
	
	if(((!is.language(obj) && !is.environment(obj)) || is.symbol(obj)) && (!is.list(obj) || length(obj) == 0L))
	#if((!is.language(obj) || !is.environment(obj) || is.symbol(obj)) && (!is.list(obj) || length(obj) == 0L))
		return(NULL)
	
	idx <- NULL
	if(isAttrib) {
		itemnames <- names(obj)
		idx <- which(!itemnames %in% c("names", "class", "dim", "dimnames", "row.names"))
		if(length(idx) == 0L) return(NULL)
		itemnames <- itemnames[idx]
		fullnames <- paste0("attr(", objName, ", ", dblqname(itemnames), ")")
	} else if(is.language(obj)) {
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
			.names[nsx] <- bqname(.names[nsx])
			fullnames[w.names] <- paste0(objName, "$", .names)
			fullnames[!w.names] <- paste0(objName, "[[", seq_along(itemnames)[!w.names], "]]")
		}
	}
	
	n <- length(itemnames)
	rval <- .createObjListResultMatrix(n)
	rval[, 1L] <- itemnames
	rval[, 2L] <- fullnames
	j <- 3L:6L
	if(is.null(idx)) idx <- seq.int(n)
		
	
	if(is.environment(obj)) {
		nm <- names(obj)
		for(i in seq.int(n)) rval[i, j] <- objinfo(obj[[nm[idx[i]]]]) ## recursive if attrib=TRUE
	} else
		for(i in seq.int(n)) rval[i, j] <- objinfo(obj[[idx[i]]]) ## recursive if attrib=TRUE
	if(isAttrib) rval[, 6L] <- paste0(rval[, 6L], "a")
	return(rval)
}



.createObjListResultMatrix <-
function(n) {
	matrix("", ncol = 6L, nrow = n,
	dimnames = list(NULL, c("Name", "Full.name", "Dims", "Group", "Class", "Recursive")))
}

# Called by objls_object for functions
objls_function <-
function (obj, objName = deparse(substitute(obj))) {
	## formals(obj) returns NULL if only arg is ..., try: formals(expression)
	obj <- formals(args(obj))
	
	objName <- paste0("formals(args(", objName, "))")

	if(length(obj) == 0L) return(NULL)

	itemnames <- fullnames <- names(obj)
	nsx <- itemnames != make.names(itemnames) # non-syntactic names
	itemnames[nsx] <- bqname(itemnames[nsx])
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

## Called by objls_object in S4 case
objls_s4 <-
function (obj, objName = deparse(substitute(obj))) {
	
	itemnames <- slotNames(obj)
	n <- length(itemnames)

	if(n == 0L) return(NULL)
	isClassDef <- is(obj, "classRepresentation")

	nsx <- itemnames != make.names(itemnames)
	itemnames[nsx] <- bqname(itemnames[nsx])

	rval <- .createObjListResultMatrix(n)
	rval[, 1L] <- itemnames
	#rval[, 2L] <- paste0(objName, "@", itemnames)
	rval[, 2L] <- paste0(objName, if(isClassDef) "@slots$" else "@", itemnames)
	j <- 3L:6L
	
	if(isClassDef)
		for(i in seq.int(n)) rval[i, j] <- objinfo(obj@slots[[i]])
		else
			for(i in seq.int(n)) rval[i, j] <-  objinfo(slot(obj, itemnames[i]))
	return(rval)
}


## Returns a *character* vector with unnamed elements: dims, mode, class, 'r'(ecursive) or ''
objinfo <-
function (x) {
    if(missing(x)) return(c("", "language", "missing", ""))

	# XXX better method of detecting promises?
	if(tryCatch({ x; FALSE }, error = function(e) TRUE, warning = function(e) TRUE))
		return(c("", "language", "missing", ""))
		
	xClass <- class(x)
	s4 <- isS4(x)
	
	if(tryCatch({
		slotnames <- if(s4) slotNames(x) else character(0L)
	
		if(is.function(x))
			d <- length(formals(x))
		else
			d <- dim(x)
		if (is.null(d))
			d <- if(s4) length(slotnames) else length(x)
			
		isRecursive <- (s4 || is.function(x) ||
			(is.recursive(x) && !inherits(x, 'POSIXlt'))) && !is.symbol(x) &&
				 sum(d) != 0L
    
	    FALSE
	}, error = function(x) TRUE)) {
		d <- "?"
		slotnames <- character(0L)
		isRecursive <- FALSE
	} 
	
	type <- if(is.language(x)) "language" else
		if(is.pairlist(x) || is.list(x)) "list" else
		tryCatch(if(is.factor(x)) "factor" else mode(x),
		error = function(e) mode(x), warning = function(e) mode(x))
	    
	
	# attributes omit identical slots
	c(paste0(d, collapse = "x"), type, xClass[1L],
	  paste0(if(isRecursive) "r" else "", if(hasAttributes(x, slotnames)) "b" else ""))
}


.createEmptyObjList <-
function(envir, object) {
    rval <- character(0L)
	class(rval) <- "objList"
	attr(rval, "envir") <- envir
	attr(rval, "object") <- object
	return(rval)
}
