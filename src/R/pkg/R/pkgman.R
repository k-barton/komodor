#' @rdname pkgMan
#' @name pkgMan
#' @title Package manager supporting routines
#' @description These functions are used by the R package manager.
#' @return `pkgMan*` functions return `NULL` invisibly, with the side effect
#'    the result being printed serialized in JSON format.

getRepositories <- 
function() {
	# from: utils::setRepositories
    p <- file.path(Sys.getenv("HOME"), ".R", "repositories")
    if (!file.exists(p)) 
        p <- file.path(R.home("etc"), "repositories")
    a <- getFrom("tools", ".read_repositories")(p)
    
	pkgType <- getOption("pkgType")
    if (any(grepl("mac.binary", pkgType, fixed = TRUE)))
		pkgType <- "mac.binary" else
	if (any(pkgType == "both"))
		pkgType <- c("source", "win.binary")
		
    thisType <- apply(a[, pkgType, drop = FALSE], 1L, any)
    a <- a[thisType, 1L:3L]
    repos <- getOption("repos")

    if ("CRAN" %in% row.names(a) && !is.na(CRAN <- repos["CRAN"])) 
        a["CRAN", "URL"] <- CRAN
    a[(a[["URL"]] %in% repos), "default"] <- TRUE
    new <- !(repos %in% a[["URL"]])
    if (any(new)) {
        aa <- names(repos[new])
        if (is.null(aa)) 
            aa <- rep("", length(repos[new]))
        aa[aa == ""] <- repos[new][aa == ""]
        newa <- data.frame(menu_name = aa, URL = repos[new], 
            default = TRUE)
        row.names(newa) <- aa
        a <- rbind(a, newa)
    }
    cbind(a, Contrib.URL = contrib.url(a[, "URL"]))
}

.matrixToStringizable <-
function(x, labelCol = 1L) {
	rval <- vector("list", n <- nrow(x))
	names(rval) <- x[, labelCol]
	x[is.na(x)] <- ""
	fieldNames <- colnames(x)[-labelCol]
	x <- unname(x)[, -labelCol, drop = FALSE]
	for(i in seq_len(n)) rval[[i]] <- x[i, ]
	list(fieldNames = fieldNames, values = rval)
}


getPackages <- 
function(reload = FALSE, names = NULL, type = "available",
		 includeInstalledVersion = TRUE, includeLoaded = TRUE
		 ) { #  = c('available', 'installed')
	cnPackage <- "Package"
	cnVersion <- "Version"
	cnInstalledVersion <- "InstalledVersion"

	if(reload) rmTemp("availablepackages")
	ap <- getTemp("availablepackages", {
		oop <- options(timeout = 2)
		on.exit(options(oop))
		ap <- available.packages(filters = c("OS_type"))
		col <- c(cnPackage, cnVersion, "RepositoryName", "Priority")
		repositories <- getRepositories()
		if(length(j <- which(colnames(ap) == "Repository"))) {
			ap[, j] <- rownames(repositories)[match(ap[, j], repositories[, "Contrib.URL"])]
			colnames(ap)[j] <- "RepositoryName"
		}
		cbind(ap[order(toupper(ap[, cnPackage])),
			col[col %in% colnames(ap)], drop = FALSE],
			"InstalledVersion" = NA_character_, "Loaded" = NA_character_)
	})
	
	if(includeInstalledVersion || type != "available") {
		ip <- installed.packages()
		ip <- ip[, match(colnames(ap), colnames(ip), nomatch = 0L), drop = FALSE]
	} else ip <- NULL
	
	if(!is.null(names)) {
		ap <- ap[match(names, ap[, cnPackage], nomatch = 0L), , drop = FALSE]
		if(!is.null(ip)) ip <- ip[match(names, ip[, cnPackage], nomatch = 0L), , drop = FALSE]
	}
	
	if(type == "available" || type == "both")
		if(includeInstalledVersion) {
			j <- match(ip[, cnPackage], ap[, cnPackage], nomatch = 0L)
			if(type == "both" && length(j) != 0L && any(j == 0L)) {
				p <- rbind(ap, matrix(NA_character_, nrow = sum(j == 0L), ncol = ncol(ap)))
				i <- seq.int(nrow(ap) + 1L, nrow(p))
				p[i, colnames(ip)] <- ip[j == 0L, ]
				p[i, cnInstalledVersion] <- p[i, cnVersion]
				p[i, cnVersion] <- ""
			} else
				p <- ap
			p[j, cnInstalledVersion] <- ip[j != 0, cnVersion]
		} else
			p <- ap
	else if(type == "installed") {
		p <- matrix(nrow = nrow(ip), ncol = ncol(ap), dimnames = list(NULL, colnames(ap)))
		p[, match(colnames(ip), colnames(p), nomatch = 0L)] <- ip
		p[, cnInstalledVersion] <- p[, cnVersion]
		j <- match(p[, cnPackage], ap[, cnPackage], nomatch = 0L)
		p[j != 0L, cnVersion] <- ap[j, cnVersion]
		p[j == 0L, cnVersion] <- ""
	}
	if(includeLoaded)
		p[match(.packages(), p[, cnPackage], nomatch = 0L), "Loaded"] <- "y"

	p <- p[, ! colnames(p) %in% c(if(!includeInstalledVersion) cnInstalledVersion, if(!includeLoaded) "Loaded"), drop = FALSE]
	rownames(p) <- NULL
	invisible(p)
}

getReverseDependencies <-
function(pkgName, revFields = c("Depends", "Imports", "Suggests", "Enhances")) {
    z <- installed.packages()[, revFields]
    z <- lapply(seq_along(revFields), function(k)
        names(Filter(function(x) pkgName %in% x, strsplit(z[, k], " *, *"))))
    names(z) <- revFields
    z <- z[vapply(z, length, 1L) > 0L]
	if(length(z) == 0L) return(list())
    z <- lapply(z, paste0, collapse = ", ")
    renamemap <- c("Depends"="Dependants", "Imports"="Imported by",
				   "Suggests"="Suggested by", "Enhances"="Enhanced by",
				   "LinkingTo"="Linked to by")
    j <- match(names(z), names(renamemap), nomatch = 0L)
    names(z)[j != 0L] <- renamemap[j]
    names(z)[j == 0L] <- paste0("Reverse ", names(z)[j == 0L])
    z
}

## pkgMan* functions - all should return invisible NULL
## and print stringized (JSON) result

#' @rdname pkgMan
#' @md
#' @export
#' @param pkgName character vector of package names
#' @param type either `"installed"` or `"available"`
pkgManGetPackages <- function(pkgName, type = "installed") {
	p <- getPackages(names = pkgName, type = type)
	cat(stringize(.matrixToStringizable(p)))
}


#' @rdname pkgMan
#' @md
#' @export
pkgManGetRepositories <- 
function ()
    cat(stringize(apply(getRepositories(), 1L, as.list)))


#' @rdname pkgMan
#' @md
#' @param page character string. Either "prev", "next" (default), "first", "last" or "current".
#' @param pattern an optional regular expression. Only names matching pattern are returned.
#' @param ilen numeric, number of records per page.
#' @param col vector of character strings. Column names to be returned.
#' @param reload Should new data be produced if a cached copy exists?
#' @export
pkgManGetAvailable <- 
function(page = "next", pattern = "", ilen = 50,
	col = c("Package", "Version", "InstalledVersion", "Status", "RepositoryName", "Priority"),
	reload = FALSE) {
	
	p <- getPackages(type = "available")	
	if (page == "first") {
		newSearch <- TRUE
		i0 <- 1L
	} else {
		newSearch <- getTemp('avpkg.pattern', "") != pattern
		i0 <- getTemp('avpkg.idx', default = 1L)
	}

	if(is.character(pattern) && pattern != "") {
		if(newSearch) {
			page <- "current"
			i0 <- 1L
			idx <- grep(pattern, p[, "Package"], ignore.case = TRUE)
			assignTemp('avpkg.pattern.idx', idx)
		} else
			idx <- getTemp('avpkg.pattern.idx')
		imax <- length(idx)
	} else {
		imax <- nrow(p)
		idx <- seq(imax)
	}
	assignTemp('avpkg.pattern', pattern)

	if (page == "next") i0 <- i0 + ilen else
		if (page == "prev") i0 <- i0 - ilen
	outside <- i0 > imax || i0 < 1L
	if (outside) return(NULL)
	assignTemp('avpkg.idx', i0)
	i1 <- min(i0 + ilen - 1L, imax)
	i <- seq(i0, i1)
	cat(stringize(c(list(index = c(i0, i1, imax)),
		.matrixToStringizable(p[idx[i], , drop = FALSE]))))
}

#' @rdname pkgMan
#' @export
pkgManGetMirrors <- 
function() {
	cat(stringize(.matrixToStringizable(getTemp("pkgMan.CRANmirrors",
		getCRANmirrors()[, c("Name", "URL", "CountryCode")]))))
}

#' @rdname pkgMan
#' @param url character string. CRAN mirror URL.
#' @export
pkgManSetCRANMirror <- 
function(url) {
	repos <- getOption("repos")
	repos['CRAN'] <- url
	options(repos = repos)
}

#' @rdname pkgMan
#' @md
#' @param print logical, if `TRUE` the result is printed in DCF format.
#' @param omitFields a character vector giving the tags of fields to be omitted.
#' @param revDep logical, should reverse dependencies (only within installed 
#'     packages) be added to standard fields?
#' @param \dots optional, additional arguments passed to 
#'     `pkgReverseDependencies`. Possible arguments are:
#'     `revFields` (a character vector of fields to examine for reverse 
#'     dependencies, must be one/some of `"Depends"`, `"Imports"`, `"Suggests"` 
#'     and `"Enhances"`.
#' @export
pkgManGetDescription <-
function(pkgName, print = TRUE, omitFields = NULL, revDep = TRUE, ...) {
	if (pkgName %in% rownames(installed.packages())) {
		desc <- packageDescription(pkgName)
		if(revDep) {
			rddesc <- getReverseDependencies(pkgName, ...)
			if(length(rddesc) != 0L) {
				names(rddesc) <- paste0("[reverse]", names(rddesc))
				desc <- c(desc, rddesc)				
			}
		}
	} else {
		repositoryName <- getPackages(names = pkgName,
			includeInstalledVersion = FALSE, includeLoaded = FALSE)[, "RepositoryName"]
		if(length(repositoryName) == 0L) return(invisible())
		url <- getRepositories()[repositoryName, "URL"]
		if(is.na(url)) return(invisible())

		con <- url(file.path(url, "web", "packages", pkgName, 'DESCRIPTION', fsep = '/'))
		
        m <- tryCatch(open(con, "r"), error = function(e) e)
        if (inherits(m, "error")) return(invisible())

        dcf <- tryCatch(read.dcf(con), error = function(e) e)
		close(con)
        if (inherits(dcf, "error")) return(invisible())
		desc <- as.list(dcf[1L, ])			
		if("Encoding" %in% names(desc))
			desc[] <- lapply(desc[], iconv, from = desc$Encoding)
		class(desc) <- "packageDescription"
	}
	
	if(is.null(omitFields) || isTRUE(!is.na(omitFields))) {
		if(is.null(omitFields)) omitFields <-
		c("Package", "Version", "Priority", "Collate", "LazyData", "LazyLoad",
		  "KeepSource", "ByteCompile", "ZipData", "Biarch", "BuildVignettes",
		  "VignetteBuilder", "NeedsCompilation", "Classification/", "Packaged",
		  "Built", "Additional_repositories", "RoxygenNote", "Encoding")
		nm <- names(desc)
		j <- match(nm, omitFields, nomatch = 0L)
		i <- j == 0L
		for(s in omitFields) {
			i[i] <- !startsWith(nm[i], s)
			if(all(!i)) break
		}
		desc <- desc[i]
	}

	if(any(j <- which(names(desc) == "Authors@R"))) {
		tryCatch({
			auth <- paste0(eval(parse(text = desc[[j[1L]]]), .GlobalEnv), collapse = ", ")
			desc[[j]] <- auth
			names(desc)[j] <- "Authors"
			desc$Author <- desc$Maintainer <- NULL
		}, error = function(...) {})
	}
	
	fieldOrder <- 
		c("Package", "Version", "Title", "Description", "Date", "Date/",
		"Author", "Authors", "Maintainer", "License", "URL", "Copyright",
		"Depends", "Imports", "Suggests", "Enhances", "LinkingTo", "Repository",
		"BugReports", "Additional_repositories", "SystemRequirements",
		"OS_type", "Type", "Encoding", "Priority", "Collate", "LazyData",
		"LazyLoad", "KeepSource", "ByteCompile", "ZipData", "Biarch",
		"BuildVignettes", "VignetteBuilder", "NeedsCompilation",
		"Classification/", "Repository/", "Packaged", "Built")
	
	desc <- desc[order(match(sub("/.+$", "/", names(desc)), fieldOrder,
		nomatch = length(fieldOrder) + 1L))]
	desc[] <- gsub(" *[\r\n]+ *", " ", desc)
	cat(stringize(desc))
}


#' @rdname pkgMan
#' @export
pkgManGetInstalled <- 
function() cat(stringize(.matrixToStringizable(getPackages(type = "installed"))))


suppressWarningsAndMessages <-
function (expr) {
    ops <- options(warn = -1)
    on.exit(options(ops))
    withCallingHandlers(expr,
        warning = function(w) invokeRestart("muffleWarning"),
        message = function(c) invokeRestart("muffleMessage"))
}


# Based on utils:::getDependencies
getDependencies <- 
function (pkgs, available = NULL, lib = .libPaths()[1L], 
    binary = FALSE, ...) {
    if(length(lib) > 1L) return(NULL)
    dependencies <- c("Depends", "Imports", "Suggests")
    dep2 <- c("Depends", "Imports")
    if (!binary) {
        dependencies <- c(dependencies, "LinkingTo")
        dep2 <- c(dep2, "LinkingTo")
    }
    p0 <- unique(pkgs)
    miss <- !p0 %in% row.names(available)
    notAvailable <- NULL
    if (sum(miss)) {
        msg <- paste0(if (binary) "as a binary package ", "for ",
            sub(" *\\(.*", "", R.version.string)
            )
        notAvailable <- p0[miss]
    }
    p0 <- p0[!miss]
    p1 <- p0
    libpath <- .libPaths()
    if (!lib %in% libpath) libpath <- c(lib, libpath)
    installed <- installed.packages(lib.loc = libpath, fields = c("Package", "Version"), ...)
    not_avail <- character()
    repeat {
        deps <- apply(available[p1, dependencies, drop = FALSE], 
            1L, function(x) paste(x[!is.na(x)], collapse = ", "))
        res <- utils:::.clean_up_dependencies2(deps, installed, available)
        not_avail <- c(not_avail, res[[2L]])
        deps <- unique(res[[1L]])
        deps <- deps[!deps %in% c("R", pkgs)]
        if (!length(deps)) break
        pkgs <- c(deps, pkgs)
        p1 <- deps
        if (!is.null(dep2)) {
            dependencies <- dep2
            dep2 <- NULL
        }
    }
    if (length(not_avail)) not_avail <- unique(not_avail)
    pkgs <- unique(pkgs)
    pkgs <- pkgs[pkgs %in% row.names(available)]
    list(packages = pkgs, not_avail = not_avail)
}


#' @rdname pkgMan
#' @md
#' @param installDeps logical. Install package dependencies?
#' @param ask if `TRUE`, asks for confirmation first.
#' @export
getAvailable <-
function()
getTemp("available.packages",
		available.packages()[, c("Package", "Version", "Depends", "Imports",
			"LinkingTo", "Suggests", "Enhances"), drop = FALSE])

pkgManGetDependencies <-
function(pkgName, ...)
    cat(stringize(getDependencies(pkgName, available = getAvailable(), ...)))

pkgManInstallPackages <- 
function(pkgName, ...) {
	msg <- captureAll(install.packages(pkgName, dependencies = FALSE, ...))
	cat(stringize(list(packages = 
        .matrixToStringizable(getPackages(names = pkgName, type = "installed")),
        message = msg)))
}

#' @rdname pkgMan
#' @md
#' @export
pkgManRemovePackage <- 
function(pkgName) {
    
    packages <- .packages(TRUE)
	
    res <- sapply(pkgName, function(pkgName) {
		if(pkgName %in% loadedNamespaces()) unloadNamespace(pkgName)
		pack <- paste("package", pkgName, sep = ":")
		if(pack %in% search()) detach(pack, character.only = TRUE)

		dlli <- getLoadedDLLs()[[pkgName]]
		if(!is.null(dlli)) dyn.unload(dlli[['path']])

		pkgpath <- find.package(pkgName, quiet = TRUE)
		if(length(pkgpath) == 0L) return(FALSE)

		pkglib <- normalizePath(file.path(pkgpath, ".."))
		if(file.access(pkglib, 2) == 0L) {
			tryCatch(remove.packages(pkgName, lib = pkglib), error = function(e) NULL)
			return(TRUE)
		} else 
			#warning("No sufficient access rights to library", sQuote(pkglib))
			return(FALSE)

	}, simplify = FALSE)
	cat(stringize(list(status = res, removed = packages[! packages  %in% .packages(TRUE)])))
}

#' @rdname pkgMan
#' @export
pkgManLoadPackage  <- 
function(pkgName) {
    pkgBefore <- .packages()
	status <- logical(length(pkgName))
	names(status) <- pkgName
	msg <- paste(captureAll(expression(for(i in pkgName) {
		status[i] <- library(i, character.only = TRUE, logical.return = TRUE)
	}), envir = sys.frame(sys.nframe())), collapse = "\n")
    pkgAfter <- .packages()
    cat(stringize(list(message = msg, status = as.list(status),
        loaded = pkgAfter[! pkgAfter %in% pkgBefore ])))
}

#' @rdname pkgMan
#' @export
pkgManDetachPackage <- 
function(pkgName) {
    pkgBefore <- .packages()
	status <- logical(length(pkgName))
	names(status) <- pkgName
	msg <- paste(captureAll(expression(for(i in pkgName) {
		pack <- paste("package", i, sep = ":")
		if(pack %in% search()) status[i] <-
			is.null(detach(pack, character.only = TRUE, unload = TRUE))
	}), envir = sys.frame(sys.nframe())), collapse = "\n")
    pkgAfter <- .packages()
	cat(stringize(list(message = msg, status = as.list(status),
        detached = pkgBefore[! pkgBefore %in% pkgAfter ])))
}

#' @rdname pkgMan
#' @export
pkgManGetUpdateable <- 
function() {
	ap <- getPackages(type = "available")
	repos <- getRepositories()
	j <- which(colnames(ap) == "RepositoryName")
	ap[, j] <- as.character(repos[ap[, j], "Contrib.URL"])    
	colnames(ap)[j] <- "Repository"
	op <- old.packages(available = ap)
	j <- which(colnames(op) == "Repository")
	op[, j] <- rownames(repos)[match(op[, j], repos[, "Contrib.URL"], nomatch = 0L)]
	colnames(op)[j] <- "RepositoryName"
	op <- cbind(op, Loaded = "")	
	op[match(.packages(), op[, "Package"], nomatch = 0L), "Loaded"] <- "y"
	cat(stringize(.matrixToStringizable(op[, c("Package", "Installed", "ReposVer", "RepositoryName", "Loaded")])))
}
