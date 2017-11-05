#' @title Functions used by R object browser
#' @description Internal functions for Komodo's R object browser.
#' @rdname rbrowser
# @keywords internal
#' @md
#' @param id character string.
#' @param envir which environment to use in listing the objects. Defaults to the current evaluation environment.
#' @param object optional, name of the object of which elements should be listed.
#' @param all.names logical. If `FALSE`, names which begin with a `.` are omitted.
#' @param pattern optional, a regular expression. Only names matching pattern are returned. 
#' @param group optional, name of the group of object classes. If provided, only object of that group are returned.
#' @param all.info if `TRUE`, the first column holds the environment name.
#' @param compare if `TRUE` and the result is identical to the previous one with the same `id`, an empty list is returned. 
#' @param \dots additional arguments. Ignored.
#' @examples
#' if(require(datasets)) {
#'    objList()
#'    write.objList(objList(object="npk", compare=FALSE))
#'    objList(object="Loblolly")
#'    objList(object="Loblolly") ## an empty list (compare is TRUE)
#' }
objList <-
function (id = "default", envir = getEvalEnv(), object = NULL,
all.names = FALSE, pattern = "", group = "", all.info = FALSE, 
compare = TRUE, ...) {
	## Make sure that id is character
	id <- as.character(id)[1L]
	if (id == "") id <- "default"
	ename <- NA_character_

	## Format envir as character (use only first item provided!)
	if (!is.environment(envir)){
		if(is.numeric(envir) && envir > 0) envir <- search()[envir]

		if (is.character(envir)) {
			ename <- envir
			envir <- tryCatch(as.environment(envir), error = function(e) NULL)
			if (is.null(envir) || inherits(envir, "error")) {
				envir <- NULL
				ename <- ""
			}
		}
	}

	# base and .GlobalEnv do not have name attribute
	if (!is.null(attr(envir, "name"))) ename <- attr(envir, "name")
		else if (is.na(ename)) ename <- deparse(substitute(envir))
	if (ename %in% c("baseenv()", ".BaseNamespaceEnv"))
		ename <- "package:base"

	if (is.null(envir)) return(.getEmptyObjList(all.info, ename, object))

	if (!missing(object) && is.character(object) && object != "") {
		res <- .lsObj(envir = envir, objname = object)
	} else {
		## Get the list of objects in this environment
		Items <- ls(envir = envir, all.names = all.names, pattern = pattern)
		if (length(Items) == 0L) return(.getEmptyObjList(all.info, ename, object))

		res <- data.frame(Items, t(vapply(Items, function(x) .objDescr(envir[[x]]),
				character(4L))), stringsAsFactors = FALSE, check.names = FALSE)
		colnames(res) <-  c("Name", "Dims", "Group", "Class", "Recursive")

		# Quote non-syntactic names
		nsx <- res$Name != make.names(res$Name)
		res$Full.name[!nsx] <- res$Name[!nsx]
		res$Full.name[nsx] <- paste0("`", res$Name[nsx], "`")
		res <- res[, c(1L, 6L, 2L:5L)]
	}

	if (NROW(res) == 0L) return(.getEmptyObjList(all.info, ename, object))

	if (isTRUE(all.info)) res <- cbind(Envir = ename, res)

	vMode <- Groups <- res$Group
	vClass <- res$Class

	Groups[Groups %in% c("name", "environment", "promise", "language", "char",
		"...", "any", "(", "call", "expression", "bytecode", "weakref",
		"externalptr")] <- "language"
	Groups[Groups == "pairlist"] <- "list"
	Groups[!(Groups %in% c("language", "function", "S4")) &
		vMode != vClass] <- "S3"
	Groups[vClass == "factor"] <- "factor"
	Groups[vClass == "data.frame"] <- "data.frame"
	Groups[vClass == "Date" | vClass == "POSIXt"] <- "DateTime"

	## Reaffect groups
	res$Group <- Groups

	## Possibly filter according to group
	if (!is.null(group) && group != "")
		res <- res[Groups == group, ]

	## Determine if it is required to refresh something
	Changed <- TRUE
	if (isTRUE(compare)) {
		objListCache <- getTemp(".objListCache", default = new.env(hash = TRUE))

		if (identical(res, objListCache[[id]])) 
			Changed <- FALSE else
				objListCache[[id]] <- res
	}

	## Create the 'objList' object
	attr(res, "all.info") <- all.info
	attr(res, "envir") <- ename
	attr(res, "object") <- object
	attr(res, "class") <- c("objList", "data.frame")

	return(if (Changed) res else .getEmptyObjList(all.info, ename, object))
}


print.objList <-
function (x, header = !attr(x, "all.info"), ...) {
	if (!inherits(x, "objList")) stop("x must be an 'objList' object")

	empty <- !is.data.frame(x) || NROW(x) == 0L
	cat(if (empty) "An empty objects list\n" else "Objects list:\n")
	if (header) {
		header.fmt <- "\tEnvironment: %s\n\tObject: %s\n"
		objname <- if (is.null(attr(x, "object"))) "<All>" else attr(x, "object")
		cat(sprintf(header.fmt, attr(x, "envir"), objname))
	}
	if (!empty) print.data.frame(x)
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

	empty <- !is.data.frame(x) || NROW(x) == 0L
	
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
function (objname, envir, ...) {
	error <- FALSE
	obj <- tryCatch(eval(parse(text = objname), envir = as.environment(envir)),
			error = function(e) error <<- TRUE)

	if (error) return(NULL)

	if (is.environment(obj)) obj <- as.list(obj)

	if (mode(obj) == "S4") {
		ret <- .lsObjS4(obj, objname)
	} else if (is.function(obj)) {
		ret <- .lsObjFunction(obj, objname)
	} else {  # S3
		if (!(mode(obj) %in% c("list", "pairlist")) || length(obj) == 0L)
			return(NULL)

		itemnames <- fullnames <- names(obj)
		if (is.null(itemnames)) {
			itemnames <- seq_along(obj)
			fullnames <- paste0(objname, "[[", itemnames, "]]")
		} else {
			w.names <- itemnames != ""
			.names <- itemnames[w.names]
			nsx <- .names != make.names(.names)  # Non-syntactic names
			.names[nsx] <- paste0("`", .names[nsx], "`")
			fullnames[w.names] <- paste0(objname, "$", .names)
			fullnames[!w.names] <- paste0(objname, "[[",
				seq_along(itemnames)[!w.names], "]]")
		}

		ret <- data.frame(itemnames, fullnames,
			t(vapply(seq_along(obj), function (i) .objDescr(obj[[i]]), character(4L))),
			stringsAsFactors = FALSE, check.names = FALSE)
	}
	if (!is.null(ret))
		names(ret) <- c("Name", "Full.name", "Dims/default", "Group", "Class",
			"Recursive")
	return(ret)
}

# Called by .lsObj for functions
.lsObjFunction <-
function (obj, objname = deparse(substitute(obj))) {
	## formals(obj) returns NULL if only arg is ..., try: formals(expression)
	obj <- formals(args(obj))
	objname <- paste0("formals(args(", objname, "))")

	if(length(obj) == 0L) return(NULL)

	itemnames <- fullnames <- names(obj)
	nsx <- itemnames != make.names(itemnames) # non-syntactic names
	itemnames[nsx] <- paste0("`", itemnames[nsx], "`")
	fullnames <- paste0(objname, "$", itemnames)

	ret <- t(sapply(seq_along(obj), function (i) {
		x <- obj[[i]]
		lang <- is.language(obj[[i]])
		o.class <- class(obj[[i]])[1L]
		o.mode <- mode(obj[[i]])
		d <- deparse(obj[[i]])
		if (lang && o.class == "name") {
			o.class <- ""
			o.mode <- ""
		}
		ret <- c(paste0(d, collapse = "x"), o.class, o.mode, FALSE)
		return(ret)
	}))

	ret <- data.frame(itemnames, fullnames, ret, stringsAsFactors = FALSE)
	return(ret)
}

## Called by .lsObj in S4 case
.lsObjS4 <-
function (obj, objname = deparse(substitute(obj))) {
	itemnames <- fullnames <- slotNames(obj)
	nsx <- itemnames != make.names(itemnames)
	itemnames[nsx] <- paste0("`", itemnames[nsx], "`")
	fullnames <- paste0(objname, "@", itemnames)

	ret <- t(vapply(itemnames, function (i) .objDescr(slot(obj, i)),
		character(4L)))
	ret <- data.frame(itemnames, fullnames, ret, stringsAsFactors = FALSE,
		check.names = FALSE)
	return(ret)
}

## Returns a *character* vector with elements: dims, mode, class, rec(ursive)
.objDescr <-
function (x) {
    classx <- class(x)
	if(!is.null(attr(classx, "package")) &&
		length(find.package(attr(classx, "package"), quiet = TRUE)) == 0) {
		## class' package not available
		d <- "?"
	} else {
		d <- dim(x)
		if (is.null(d)) d <- length(x)
	}
	modex <- mode(x)
	return(c(dims = paste0(d, collapse = "x"),
		mode = modex, class = classx[1L],
		rec = modex == "S4" || is.function(x) ||
			(is.recursive(x) &&
			 !inherits(x, 'POSIXlt') &&
			 !is.language(x) &&
			 sum(d) != 0L)))
}

.getEmptyObjList <- function(all.info, envir, object) {
    rval <- FALSE
	class(rval) <- c("objList")
	attr(rval, "all.info") <- all.info
	attr(rval, "envir") <- envir
	attr(rval, "object") <- object
	return(rval)
}

