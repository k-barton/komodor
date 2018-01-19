#' @rdname pkgMan
#' @name pkgMan
#' @title Package manager supporting routines
#' @description These functions are used by the R package manager.

#' @rdname pkgMan
#' @md
#' @param print logical, if `TRUE` the result is printed in DCF format.
#' @param fields a character vector giving the tags of fields to be omitted.
#' @param revDep logical, should reverse dependencies (only within installed packages) be added to standard fields?
#' @param \dots optional, additional arguments passed to `pkgReverseDependencies`. Possible arguments are:
#      `revFields` (a character vector of fields to examine for reverse dependencies, must be one/some of
#      `"Depends"`, `"Imports"`, `"Suggests"` and `"Enhances"`.
#' @export

pkgManGetDescription <-
function(pkgName, print = TRUE, omitFields = NULL, revDep = TRUE, ...) {
	if (pkgName %in% rownames(installed.packages())) {
		desc <- packageDescription(pkgName)
		if(revDep) {
			rddesc <- pkgReverseDependencies(pkgName, ...)
			if(length(rddesc) != 0L) {
				names(rddesc) <- paste0("[reverse]", names(rddesc))
				desc <- c(desc, rddesc)				
			}
		}
	} else {
		con <- url(file.path(getOption("repos")['CRAN'], "web", "packages", pkgName,
							 'DESCRIPTION', fsep = '/'))
        m <- try(open(con, "r"), silent = TRUE)
        if (!inherits(m, "try-error")) {
			dcf <- try(read.dcf(con))
			close(con)
			desc <- as.list(dcf[1L, ])
			class(desc) <- "packageDescription"
		} else {
			return(invisible(NULL))
		}
	}
	
	if(is.null(omitFields) || isTRUE(!is.na(omitFields))) {
		if(is.null(omitFields)) omitFields <-
		c("Package", "Version", "Priority", "Collate", "LazyData", "LazyLoad", "KeepSource", "ByteCompile",
		  "ZipData", "Biarch",
		  "BuildVignettes", "VignetteBuilder", "NeedsCompilation", "Classification/", "Packaged", "Built",
		  "Additional_repositories", "RoxygenNote", "Encoding")
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
c("Package", "Version", "Title", "Description", "Date", "Date/", "Author", "Authors", "Maintainer", 
"License", "URL", "Copyright", "Depends", "Imports", "Suggests", "Enhances", "LinkingTo", "Repository",
"BugReports", "Additional_repositories", "SystemRequirements", "OS_type", "Type", "Encoding", "Priority",
"Collate", "LazyData", "LazyLoad", "KeepSource", "ByteCompile", "ZipData", "Biarch", "BuildVignettes",
"VignetteBuilder", "NeedsCompilation", "Classification/", "Repository/", "Packaged", "Built")
	
	desc <- desc[order(match(sub("/.+$", "/", names(desc)), fieldOrder, nomatch = length(fieldOrder) + 1L))]
	desc[] <- gsub(" *[\r\n]+ *", " ", desc)
	
	
	if (print) {
		write.dcf(as.data.frame.list(desc[!sapply(desc, is.na)],
			optional = TRUE), width = Inf)
		invisible(desc)
	} else desc
}

pkgReverseDependencies <-
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




#' @rdname pkgMan
#' @export
pkgManGetMirrors <- 
function() {
	tmpVar <- "pkgMan.CRANmirrors"
	if(existsTemp(tmpVar)) {
		mirrors <- getTemp(tmpVar)
	} else {
		mirrors <- getCRANmirrors()
		assignTemp(tmpVar, mirrors)
	}
	write.table(mirrors[, c("Name", "URL", "CountryCode")],
		row.names = FALSE, col.names = F, sep=';', quote = FALSE, na="")
}

#' @rdname pkgMan
#' @md
#' @param page character string. Either "prev", "next" (default), "first", "last" or "current".
#' @param pattern an optional regular expression. Only names matching pattern are returned.
#' @param ilen numeric, number of records per page.
#' @param col vector of character strings. Column names to be returned.
#' @param reload Should new data be produced if a cached copy exists?
#' @param sep,eol record and end of line separators.
#' @export
pkgManGetAvailable <- 
function(page = "next", pattern = "", ilen=50,
	col=c("Package", "Version", "InstalledVersion", "Status", "Repository"),
	reload = FALSE, sep = ';', eol = "\t\n") {

	if (!existsTemp('avpkg.list') || reload) {
		oop <- options(timeout = 2)
		avpkg.list <- availablePkgs(available.packages(filters=c("R_version",
			"OS_type", "duplicates")), installed = FALSE)
		options(oop)
		assignTemp('avpkg.list', avpkg.list)
	} else {
		avpkg.list <- getTemp('avpkg.list')
	}
	if (page == "first") {
		newSearch <- TRUE
		i0 <- 1
	} else {
		newSearch <- getTemp('avpkg.pattern', "") != pattern
		i0 <- getTemp('avpkg.idx', default = 1)
	}

	if(is.character(pattern) && pattern != "") {
		if(newSearch) {
			page <- "current"
			i0 <- 1
			idx <- grep(pattern, avpkg.list[,'Package'], ignore.case = TRUE)
			assignTemp('avpkg.pattern.idx', idx)
		} else {
			idx <- getTemp('avpkg.pattern.idx')
		}
		imax <- length(idx)
	} else {
		imax <- nrow(avpkg.list)
		idx <- seq(imax)
	}
	assignTemp('avpkg.pattern', pattern)

	if (page == "next") i0 <- i0 + ilen else
		if (page == "prev") i0 <- i0 - ilen
	outside <- i0 > imax || i0 < 1
	if (outside) return(NULL)
	assignTemp('avpkg.idx', i0)
	i1 <- min(i0 + ilen - 1, imax)
	i <- seq(i0, i1)
	cat(i0, i1, imax, "\t\n")

	ret <- availablePkgs(avpkg.list[idx[i], , drop = FALSE])[, col, drop = FALSE]
	repositories <- getRepositories()
	ret[, "Repository"] <- rownames(repositories)[match(ret[, "Repository"],
		repositories[, "Contrib.URL"])]
	write.table(ret, row.names = FALSE, col.names = FALSE, sep=sep,
				quote = TRUE, eol=eol, na='')
}

# @md
# @param avpkg a `data.frame` of available packages.
# @param installed if `TRUE`, the result has two additional columns: "InstalledVersion" and "Status".
availablePkgs <- 
function(avpkg = available.packages(), installed = TRUE) {
	avpkg <- avpkg[order(toupper(avpkg[, "Package"])), , drop = FALSE]
	if(installed) {
		inspkg <- installed.packages()
		ipkgnames <- unique(inspkg[, 'Package'])

		ipkgnames <- ipkgnames[ipkgnames %in% avpkg[, 'Package']]
		avpkg <- cbind(avpkg, 'InstalledVersion' = NA, 'Status' = NA)
		if(length(ipkgnames)) {
			pkgstatus <- sapply(ipkgnames, function(pkg) {
				compareVersion(as.character(avpkg[pkg, 'Version']),
							   inspkg[pkg, 'Version'])
			})
			avpkg[ipkgnames, 'Status'] <- pkgstatus
			avpkg[ipkgnames, 'InstalledVersion'] <- inspkg[ipkgnames, 'Version']
		}
	}
	#avpkg <- as.data.frame(avpkg)
	avpkg
}

#' @rdname pkgMan
#' @export
pkgManGetInstalled <- 
function(sep=';', eol="\t\n") {
	inspkg <- installed.packages(fields="Description")
	inspkg <- inspkg[order(toupper(inspkg[, "Package"])),
		c("Package","Version","Description")]

	inspkg[, 3L] <- gsub("\n", " ", inspkg[, 3L])
	inspkg <- cbind(inspkg, Installed=inspkg[, 'Package'] %in% .packages())
	write.table(inspkg, row.names = FALSE, col.names = FALSE, sep=sep, quote = FALSE, eol=eol, na='')
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
#' @param pkgName names of the packages to be installed/removed etc.
#' @param installDeps logical. Install package dependencies?
#' @param ask if `TRUE`, asks for confirmation first.
#' @export
pkgManInstallPackages <- 
function(pkgName, installDeps = FALSE, ask = TRUE) {
	dep <- suppressMessages(getFrom("utils", "getDependencies")(pkgName, available = getTemp('avpkg.list')))
	msg <- status <- ""
	if (!ask && (installDeps || all(dep %in% pkgName))) {
		msg <- captureAll(install.packages(dep))
		status <- "done"
	} else {
		l <- length(dep)
		msg <- sprintf(ngettext(l,
			"This will install package %2$s.",
			"This will install packages: %s and %s.",
		), paste(sQuote(dep[-l]), collapse = ", "), sQuote(dep[l]))
		status <- "question"
	}
	list(packages=dep, message=msg, status=status)
	#invisible(dep)
}

#' @rdname pkgMan
#' @md
#' @export
pkgManRemovePackage <- 
function(pkgName) {
	sapply(pkgName, function(pkgName) {
		if(pkgName %in% loadedNamespaces()) unloadNamespace(pkgName)
		pack <- paste("package", pkgName, sep=":")
		if(pack %in% search()) detach(pack, character.only = TRUE)

		dlli <- getLoadedDLLs()[[pkgName]]
		if(!is.null(dlli)) dyn.unload(dlli[['path']])

		pkgpath <- find.package(pkgName, quiet = TRUE)
		if(length(pkgpath) == 0L) return(FALSE)

		pkglib <- normalizePath(file.path(pkgpath, ".."))
		if(file.access(pkglib, 2) == 0) {
			remove.packages(pkgName, lib=pkglib)
			return(TRUE)
		} else {
			#warning("No sufficient access rights to library", sQuote(pkglib))
			return(FALSE)
		}
	}, simplify=FALSE)
}

#' @rdname pkgMan
#' @export
pkgManLoadPackage  <- 
function(pkgName) {
	status <- logical(length(pkgName))
	names(status) <- pkgName
	msg <- paste(captureAll(expression(for(i in pkgName) {
		status[i] <- library(i, character.only = TRUE, logical.return = TRUE)
	}), envir = sys.frame(sys.nframe())), collapse = "\n")
	list(message = msg, status = as.list(status))
}

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

#' @rdname pkgMan
#' @md
#' @param json logical. Should the result be stringized in JSON format?
#' @export
pkgManGetRepositories <- 
function (json = TRUE, sep = ";;") {
    if (json)
        cat(stringize(apply(getRepositories(), 1L, as.list)))
    else write.table(getRepositories(), row.names = TRUE, col.names = FALSE,
        sep = sep, quote = FALSE)
}

#' @rdname pkgMan
#' @export
pkgManGetUpdateable <- 
function(sep = ';;', eol = '\n') {
	if(!existsTemp('avpkg.list')) {
		oop <- options(timeout = 2)
		avpkg.list <- availablePkgs(available.packages(filters=c("R_version",
			"OS_type", "duplicates")), installed = FALSE)
		options(oop)
		assignTemp('avpkg.list', avpkg.list)
	} else avpkg.list <- getTemp('avpkg.list')
	ret <- old.packages(available = avpkg.list)
	repositories <- getRepositories()
	ret[, "Repository"] <- rownames(repositories)[match(ret[, "Repository"],
		repositories[, "Contrib.URL"])]
	write.table(ret, row.names = FALSE, col.names = TRUE, sep=sep,
		quote = FALSE, eol=eol, na='')
}

#' @rdname pkgMan
#' @export
pkgManDetachPackage <- 
function(pkgName) {
	status <- logical(length(pkgName))
	names(status) <- pkgName
	msg <- paste(captureAll(expression(for(i in pkgName) {
		pack <- paste("package", i, sep=":")
		if(pack %in% search()) status[i] <-
			is.null(detach(pack, character.only = TRUE, unload = TRUE))
	}), envir = sys.frame(sys.nframe())), collapse = "\n")
	list(message = msg, status = as.list(status))
}
