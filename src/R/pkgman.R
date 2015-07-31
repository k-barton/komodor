# <LICENSE BLOCK:KomodoR>

# this should be evaluated in "komodoConnection" environment
# 'imports'
fromEnv <- asNamespace("utils")
toEnv <- as.environment("komodoConnection")
for(x in c("compareVersion", "available.packages", "installed.packages",
"install.packages", "remove.packages", "old.packages", "packageDescription",
"getCRANmirrors", "write.table", "contrib.url"))
	assign(x, get(x, fromEnv), envir = toEnv)
rm(fromEnv, toEnv, x)


sv_pkgManGetDescription <-
function(pkg, print = TRUE) {
	if (pkg %in% rownames(installed.packages())) {
		desc <- packageDescription(pkg)
	} else {
		con <- url(file.path(getOption("repos")['CRAN'], "web", "packages", pkg,
							 'DESCRIPTION', fsep = '/'))
        m <- try(open(con, "r"), silent = TRUE)
        if (!inherits(m, "try-error")) {
			dcf <- try(read.dcf(con))
			close(con)
			desc <- as.list(dcf[1, ])
			class(desc) <- "packageDescription"
		} else {
			return(invisible(NULL))
		}
	}
	if (print) {
		write.dcf(as.data.frame.list(desc[!sapply(desc, is.na)],
			optional = TRUE), width = Inf)
		invisible(desc)
	} else {
		desc
	}
}

sv_pkgManGetMirrors <- function() {
	tmpVar <- "pkgMan.CRANmirrors"
	if(existsTemp(tmpVar)) {
		mirrors <- getTemp(tmpVar)
	} else {
		mirrors <- getCRANmirrors()
		assignTemp(tmpVar, mirrors)
	}
	write.table(mirrors[, c("Name", "URL", "CountryCode")],
		row.names = FALSE, col.names = F, sep=';', quote = F, na="")
}

sv_pkgManGetAvailable <- function(page = "next", pattern = "", ilen=50,
	col=c("Package", "Version", "InstalledVersion", "Status", "Repository"),
	reload = FALSE, sep = ';', eol = "\t\n") {

	if (!existsTemp('avpkg.list') || reload) {
		oop <- options(timeout = 2)
		avpkg.list <- availablePkgs(utils::available.packages(filters=c("R_version",
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

availablePkgs <- function(avpkg = available.packages(), installed = TRUE) {
	#browser()
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

sv_pkgManGetInstalled <- function(sep=';', eol="\t\n") {
	inspkg <- installed.packages(fields="Description")
	inspkg <- inspkg[order(toupper(inspkg[, "Package"])),
		c("Package","Version","Description")]

	inspkg[,3] <- gsub("\n", " ", inspkg[,3])
	inspkg <- cbind(inspkg, Installed=inspkg[, 'Package'] %in% .packages())
	write.table(inspkg, row.names = FALSE, col.names = F, sep=sep, quote = F, eol=eol, na='')
}

sv_pkgManSetCRANMirror <- function(url) {
	repos <- getOption("repos")
	repos['CRAN'] <- url
	options(repos = repos)
}

sv_pkgManInstallPackages <- function(upkgs, installDeps=FALSE, ask=TRUE) {
	dep <- suppressMessages(utils:::getDependencies(upkgs, available = getTemp('avpkg.list')))
	msg <- status <- ""
	if (!ask && (installDeps || all(dep %in% upkgs))) {
		msg <- sv_captureAll(install.packages(dep))
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

sv_pkgManRemovePackage <- function(pkgName) {
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

sv_pkgManLoadPackage  <- function(pkgName) {
	status <- logical(length(pkgName))
	names(status) <- pkgName
	msg <- paste(sv_captureAll(expression(for(i in pkgName) {
		status[i] <- library(i, character.only = TRUE, logical.return = TRUE)
	}), envir = sys.frame(sys.nframe())), collapse = "\n")
	list(message = msg, status = as.list(status))
}

getRepositories <- function() {
	# from: utils::setRepositories
    p <- file.path(Sys.getenv("HOME"), ".R", "repositories")
    if (!file.exists(p))
        p <- file.path(R.home("etc"), "repositories")
    a <- tools:::.read_repositories(p)
    pkgType <- getOption("pkgType")
    if (length(grep("^mac\\.binary", pkgType)))
        pkgType <- "mac.binary"
    thisType <- a[[pkgType]]
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
	cbind(a, "Contrib.URL" = contrib.url(a[, "URL"]))
}

sv_pkgManGetRepositories <- function (json = TRUE, sep = ";;") {
    if (json)
        cat(simpsON(apply(getRepositories(), 1, as.list)))
    else write.table(getRepositories(), row.names = T, col.names = F,
        sep = sep, quote = F)
}

sv_pkgManGetUpdateable <- function(sep = ';;', eol = '\n') {
	if(!existsTemp('avpkg.list')) {
		oop <- options(timeout = 2)
		avpkg.list <- availablePkgs(utils::available.packages(filters=c("R_version",
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

#sv_pkgManGetAvailable()
#sv_pkgManGetRepositories()
##==============================================================================
#getOption("repos")
#repositories
##cat(simpsON(sv_pkgManLoadPackage(c("buc", "aod"))))
#
#sv_pkgManGetAvailable(page ="next", ilen =10)
#sv_pkgManGetAvailable(page ="prev", ilen =10)
#
#getRepositories(as.character(avpkg.list["aod", "Repository"]))
#
#sv_pkgManGetRepositories()
#sv_pkgManGetRepositories()
#
#unloadNamespace("aod")
#
#head(availablePkgs())
#
#library(aod)
#write.table(getRepositories(), sep  = ";;", quote = F)
#
#traceback()
##==============================================================================

sv_pkgManDetachPackage <- function(pkgName) {
	status <- logical(length(pkgName))
	names(status) <- pkgName
	msg <- paste(sv_captureAll(expression(for(i in pkgName) {
		pack <- paste("package", i, sep=":")
		if(pack %in% search()) status[i] <-
			is.null(detach(pack, character.only = TRUE, unload = TRUE))
	}), envir = sys.frame(sys.nframe())), collapse = "\n")
	list(message = msg, status = as.list(status))
}
