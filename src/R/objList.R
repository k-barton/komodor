sv_objList <-
function (id = "default", envir = sv_CurrentEnvir, object = NULL,
all.names = FALSE, pattern = "", group = "", all.info = FALSE, sep = "\t",
compare = TRUE, ...) {
	## Make sure that id is character
	id <- as.character(id)[1L]
	if (id == "") id <- "default"
	ename <- NA_character_

	## Format envir as character (use only first item provided!)
	if (!is.environment(envir)){
		if(is.numeric(envir) && envir > 0)
			envir <- search()[envir]

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


	## Object to return in case of empty data
	# This is ~15x faster than data.frame...
	Nothing <- structure(list(Name = character(0L), Dims = character(0L),
							  Group = character(0L), Class = character(0L),
							  Recursive = logical(0L), stringsAsFactors = FALSE),
						 class = c("objList", "data.frame"),
						 all.info = all.info, envir = ename, object = object)

	if (isTRUE(all.info)) Nothing <- cbind(Envir = character(0L), Nothing)

	if (is.null(envir)) return(Nothing)

	if (!missing(object) && is.character(object) && object != "") {
		res <- .lsObj(envir = envir, objname = object)
	} else {
		## Get the list of objects in this environment
		Items <- ls(envir = envir, all.names = all.names, pattern = pattern)
		if (length(Items) == 0L) return(Nothing)

		res <- data.frame(Items, t(vapply(Items, function(x) .objDescr(envir[[x]]),
				character(4L))), stringsAsFactors = FALSE, check.names = FALSE)
		colnames(res) <-  c("Name", "Dims", "Group", "Class", "Recursive")

		# Quote non-syntactic names
		nsx <- res$Name != make.names(res$Name)
		res$Full.name[!nsx] <- res$Name[!nsx]
		res$Full.name[nsx] <- paste("`", res$Name[nsx], "`", sep = "")
		res <- res[, c(1L, 6L, 2L:5L)]
	}

	if (NROW(res) == 0L) return(Nothing)

	if (isTRUE(all.info)) res <- cbind(Envir = ename, res)

	vMode <- Groups <- res$Group
	vClass <- res$Class

	## Recalculate groups into meaningful ones for the object explorer
	## 1) Correspondance of typeof() and group depicted in the browser
	Groups[Groups %in% c("name", "environment", "promise", "language", "char",
		"...", "any", "(", "call", "expression", "bytecode", "weakref",
		"externalptr")] <- "language"

	Groups[Groups == "pairlist"] <- "list"

	## 2) All Groups not being language, function or S4 whose class is
	##    different than typeof are flagged as S3 objects
	Groups[!(Groups %in% c("language", "function", "S4")) &
		vMode != vClass] <- "S3"

	## 3) Integers of class factor become factor in group
	Groups[vClass == "factor"] <- "factor"

	## 4) Objects of class 'data.frame' are also group 'data.frame'
	Groups[vClass == "data.frame"] <- "data.frame"

	## 5) Objects of class 'Date' or 'POSIXt' are of group 'DateTime'
	Groups[vClass == "Date" | vClass == "POSIXt"] <- "DateTime"

	## Reaffect groups
	res$Group <- Groups

	## Possibly filter according to group
	if (!is.null(group) && group != "")
		res <- res[Groups == group, ]

	## Determine if it is required to refresh something
	Changed <- TRUE
	if (isTRUE(compare)) {
		allList <- getTemp(".guiObjListCache", default = list())

		if (identical(res, allList[[id]])) Changed <- FALSE else {
			## Keep a copy of the last version in TempEnv
			allList[[id]] <- res
			assignTemp(".guiObjListCache", allList)
		}
	}

	## Create the 'objList' object
	attr(res, "all.info") <- all.info
	attr(res, "envir") <- ename
	attr(res, "object") <- object
	attr(res, "class") <- c("objList", "data.frame")

	return(if (Changed) res else Nothing)
}

print_objList <-
function (x, sep = NA, eol = "\n", header = !attr(x, "all.info"),
		  raw.output = !is.na(sep), ...) {
	if (!inherits(x, "objList"))
		stop("x must be an 'objList' object")

	empty <- NROW(x) == 0L

	if (!raw.output)
		cat(if (empty) "An empty objects list\n" else "Objects list:\n")

	if (header) {
		header.fmt <- if (raw.output) "Env=%s\nObj=%s\n" else
			"\tEnvironment: %s\n\tObject: %s\n"

		objname <- if (is.null(attr(x, "object"))) {
			if (raw.output) "" else "<All>"
		} else attr(x, "object")

		cat(sprintf(header.fmt,  attr(x, "envir"), objname))
	}

	if (!empty) {
		if (is.na(sep)) {
			print(as.data.frame(x))
		} else if (!is.null(nrow(x)) && nrow(x) > 0L) {
			utils::write.table(x, row.names = FALSE, col.names = FALSE, sep = sep,
				eol = eol, quote = FALSE)
			cat("\n")
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
			fullnames <- paste(objname, "[[", itemnames, "]]", sep = "")
		} else {
			w.names <- itemnames != ""
			.names <- itemnames[w.names]
			nsx <- .names != make.names(.names)  # Non-syntactic names
			.names[nsx] <- paste("`", .names[nsx], "`", sep = "")
			fullnames[w.names] <- paste (objname, "$", .names, sep = "")
			fullnames[!w.names] <- paste(objname, "[[",
				seq_along(itemnames)[!w.names], "]]", sep = "")
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
	objname <- paste("formals(args(", objname, "))", sep = "")

	if(length(obj) == 0L) return(NULL)

	itemnames <- fullnames <- names(obj)
	nsx <- itemnames != make.names(itemnames) # non-syntactic names
	itemnames[nsx] <- paste("`", itemnames[nsx], "`", sep = "")
	fullnames <- paste(objname, "$", itemnames, sep = "")

	ret <- t(sapply (seq_along(obj), function (i) {
		x <- obj[[i]]
		lang <- is.language(obj[[i]])
		o.class <- class(obj[[i]])[1]
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
	itemnames[nsx] <- paste("`", itemnames[nsx], "`", sep = "")
	fullnames <- paste(objname, "@", itemnames, sep = "")

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
