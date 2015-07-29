options(json.method="R")

if(exists("stopAllConnections", mode="function")) stopAllConnections()
if(exists("stopAllServers", mode="function")) stopAllServers()

if("komodoConnection" %in% search()) detach("komodoConnection")
attach(new.env(), name = "komodoConnection")

with(as.environment("komodoConnection"), {

	sv_CurrentEnvir <- .GlobalEnv
	svSetEnv <- function(envir = .GlobalEnv) {
		assign("sv_CurrentEnvir", envir, envir = as.environment("komodoConnection"))
	}


	`koMsg` <- function(...) {
		cat(..., "\n")
	}

	`svPager` <- function (files, header, title, delete.file) {
		files <- gsub("\\", "\\\\", files[1L], fixed = TRUE)
		tryCatch(koCmd(sprintf('sv.r.pager("%1$s", "%2$s", %3$s)',
			 files, title, if (delete.file) 'true' else 'false')),
			error=function(e) utils::browseURL(files, NULL))
	}

	`svBrowser` <- function(url) {
		url <- gsub("\\", "\\\\", url, fixed = TRUE)
		## If the URL starts with '/', assume a file path
		## on Unix or Mac and prepend 'file://'
		url <- sub("^/", "file:///", url)
		tryCatch(koCmd(sprintf("sv.command.openHelp(\"%s\")", url)),
			warning = function(e) utils::browseURL(url, NULL),
			error = function(e) utils::browseURL(url, NULL)
			)
	}
	
	#XXX: does not work:
	local({
		tryCatch({
			require(utils)
			`readline` <- function (prompt = "")
				paste(koCmd(sprintf("ko.dialogs.prompt('%s', '', '', 'R asked a question', 'R-readline')", prompt),
				timeout=0), collapse = " ")
		}, error = function(e) {
			# Nothing...
		})
	})

	options(browser = svBrowser, pager = svPager)


	# a way round to get the url:
    `getHelpURL` <-
    function(topic, package = NULL) {
        httpdPort <- if(is.function(tools:::httpdPort)) tools:::httpdPort() else
            tools:::httpdPort
        if(httpdPort == 0L) httpdPort <- suppressMessages(tools:::startDynamicHelp(TRUE))
        helpURI <- NULL
        if(httpdPort == 0L) return("")
        oBrowser <- options(browser = function(uri) helpURI <<- uri)
        on.exit(options(oBrowser))

   
        if(missing(topic)){
              host <- "http://127.0.0.1"
            helpURI <- if(is.null(package)) {
                paste(host, ":", httpdPort, "/doc/html/index.html",
                  sep = "")
            } else {
                package <- package[1L]
                if(system.file("html/00Index.html", package = package) != "")
                    paste0(host, ":", file.path(httpdPort,
                    "library", package, "html", "00Index.html", fsep = "/"))
            }
        } else {
            if(try.all.packages <- !is.null(package) && is.na(package))
                package <- NULL
            print(do.call(utils::help, list(topic = topic,
                try.all.packages = try.all.packages,
                package = package, help_type = "html")))
        }
        invisible(helpURI)
    }

	require(utils)

	env <- as.environment("komodoConnection")

	src <- dir(pattern = "^[^_].*\\.R$")
	Rdata <- "startup.RData"

	if(file.exists(Rdata) && {
		mtime <- file.info(c(Rdata, src))[, "mtime"]
		all(mtime[-1L] <= mtime[1L])
	}) {
		#cat('komodoConnection restored from "startup.RData" \n')
		load(Rdata, envir = env)
		rm(mtime)
		#sys.source("rserver.R", envir = env)
	} else{
		lapply(src, sys.source, envir = env, keep.source = FALSE)
		if(length(find.package("compiler", quiet = TRUE))) {
			for(fun in ls(env)) if(exists(fun, env, mode = "function"))
					assign(fun, compiler::cmpfun(get(fun, env),
						options = list(suppressAll = TRUE)))
		}
		suppressWarnings(save(list = ls(env), file = Rdata, envir = env))
		cat("created 'komodoConnection' startup data \n")

	}
	init.Rserver()
	rm(env, Rdata, src)
	invisible()
})

local({
	cwd0 <- normalizePath(".")
	if(file.exists("_init.R")) source("_init.R")

	port <- as.integer(getOption("ko.R.port", 1111L))
	port.last <- port + 200L
	
	while((port < port.last) && (as.character(sv_startServer(port)) == "0"))
		port <- port + 1L
		
	cat("cwd is now ", sQuote(getwd()), "\n")

	## Do we have a .Rprofile file to source?
	#rprofile <- file.path(c(getwd(), Sys.getenv("R_USER")), ".Rprofile")
	cwd <- normalizePath(getwd())
	isBaseDir <- file.exists(file.path(cwd, "sv-basedir")) || (cwd == cwd0)
	rprofile <- file.path(c(if(!isBaseDir) getwd(), Sys.getenv("R_USER")), ".Rprofile")
	rprofile <- rprofile[file.exists(rprofile)][1L]

	if (!is.na(rprofile)) {
		source(rprofile)
		koMsg("Loaded file:", rprofile)
	}

	if(.Platform$GUI == "Rgui") {
		##if(file.exists("Rconsole"))	utils:::loadRconsole("Rconsole")
		utils::setWindowTitle("talking to Komodo")
	}

	#sys.load.image(".RData", FALSE)
	if(file.exists(".Rhistory")) loadhistory(".Rhistory")

	Rservers <- enumServers()
    if(length(Rservers) > 0L) {
        portstr <- tail(Rservers, 1L)
        options(ko.R.port = as.integer(portstr))
        writeLines(text = portstr, con = file.path(cwd0, "~port"))
    } else portstr <- NULL
   
	if(is.numeric(getOption("ko.port")) && !is.null(portstr)) {
		koMsg("Server started at port", portstr)
		invisible(koCmd(paste(
			"sv.cmdout.clear()",
			sprintf("sv.cmdout.append('%s is started')", R.version.string),
			"sv.command.updateRStatus(true)",
			# "sv.rbrowser.smartRefresh(true)", # not before workspace is loaded
			sprintf("sv.pref.setPref('sciviews.r.port', %s)", portstr),
			if(!any(c("--vanilla", "--no-restore", "--no-restore-data") %in% commandArgs())
				&& file.exists(".RData")) {
				sprintf("sv.cmdout.append('%s')", gettext("[Previously saved workspace restored]", domain="R-base"))
			},
			sep = ";")))
		sv.ver <- koCmd("sv.version")
		if(sv.ver != "") {
			koMsg("This is KomodoR", sv.ver)
		} else {}
	}

	assign(".First", function() {
			invisible(koCmd("sv.rbrowser.smartRefresh(true)"))
			#cat("Komodo is refreshed \n")
			rm(list = ".First", envir = .GlobalEnv) # self-destruct
		}, .GlobalEnv)


	assign(".Last", function() {
		tryCatch({
		koCmd("sv.addNotification(\"R says bye!\"); sv.command.updateRStatus(false);")
		stopAllServers()
		stopAllConnections()
		}, error = function(...) NULL)
	}, .GlobalEnv)
})
