# <LICENSE BLOCK:KomodoR>

options(json.method = "R")

if (exists("stopAllConnections", mode = "function")) stopAllConnections()
if (exists("stopAllServers", mode = "function")) stopAllServers()

if("komodoConnection" %in% search()) detach("komodoConnection")
attach(NULL, name = "komodoConnection")

with(as.environment("komodoConnection"), {
	require(utils)
	# XXX: does not work:
	local({
		tryCatch({
			readline <- function(prompt = "")
			paste(koCmd(sprintf("ko.dialogs.prompt('%s', '', '', 'R asked a question', 'R-readline')", prompt), timeout = 0), collapse = " ")
		}, error = function(e) {
			# do nothing
		})
	})

	env <- as.environment("komodoConnection")
	src <- dir(pattern = "^[^_].*\\.R$")
	Rdatafile <- "startup.RData"
	
	createStartupData <- function(Rdatafile, srcfiles) {
		funcEnv <- new.env()
		lapply(srcfiles, sys.source, envir = funcEnv, keep.source = FALSE)
		if(length(find.package("compiler", quiet = TRUE))) {
			for(fun in ls(funcEnv)) if(exists(fun, funcEnv, mode = "function"))
					assign(fun, compiler::cmpfun(get(fun, funcEnv),
						options = list(suppressAll = TRUE)), envir = funcEnv)
		}
		assign("funcEnv", funcEnv, envir = funcEnv)
		assign(".withRVersion", getRversion(), envir = funcEnv)
		suppressWarnings(save(list = ls(funcEnv), file = Rdatafile, envir = funcEnv))
		cat("created startup data \n")
	}

	if(!file.exists(Rdatafile) || {
		mtime <- file.info(c(Rdatafile, src))[, "mtime"]
		any(mtime[-1L] > mtime[1L])
	}) createStartupData(Rdatafile, src)

	load(Rdatafile, envir = env)
	if(!exists(".withRVersion", funcEnv) || get(".withRVersion", funcEnv) != getRversion()) {
		createStartupData(Rdatafile, src)
		load(Rdatafile, envir = env)
	}
	
	#sys.source("rserver.R", envir = env)
	assign("sv_CurrentEnvir", .GlobalEnv, envir = funcEnv)

	options(browser = svBrowser, pager = svPager)
	
	init.Rserver()

	suppressWarnings(rm(env, Rdatafile, src, mtime))
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

	isBaseDir <- all(file.exists(file.path(cwd, c("_startup.R", ".Rprofile")))) || (cwd == cwd0)
	rprofile <- file.path(c(if(!isBaseDir) getwd(), Sys.getenv("R_USER")), ".Rprofile")
		rprofile <- rprofile[file.exists(rprofile)][1L]

	if (!is.na(rprofile)) {
		source(rprofile)
		koMsg("Loaded profile:", rprofile)
	}

	#sys.load.image(".RData", FALSE)
	if(file.exists(".Rhistory")) loadhistory(".Rhistory")

	Rservers <- enumServers()
    if(length(Rservers) > 0L) {
        portstr <- tail(Rservers, 1L)
        options(ko.R.port = as.integer(portstr))
        writeLines(text = portstr, con = file.path(cwd0, "~port")) # for rconnect.py
    } else portstr <- NULL

	if(is.numeric(getOption("ko.port")) && !is.null(portstr)) {
		koMsg("Server started at port", portstr)
		
		ok <- tryCatch(koCmd("'ok'"), error = function(e) {
			stop(simpleError(paste0(strwrap(paste(
				"cannot connect to Komodo. This may be caused by a previous R",
				"session that was improperly closed. Quit R, kill any running",
				"ghost R processes, then start R again."), 
				prefix = "  ", initial = ""), 
				collapse = "\n"), "Ko/R Startup"))
		})
		if(ok != "ok") warning(simpleWarning("invalid response received from Komodo"))

		
		invisible(koCmd(paste(
			"sv.cmdout.clear()",
			sprintf("sv.cmdout.append('%s is started')", R.version.string),
			"sv.command.setRStatus(true)",
			# "sv.rbrowser.refresh(true)", # not before workspace is loaded
			sprintf("sv.pref.setPref('sciviews.r.port', %s)", portstr),
			if(!any(c("--vanilla", "--no-restore", "--no-restore-data") %in% commandArgs())
				&& file.exists(".RData")) {
				sprintf("sv.cmdout.append('%s')",
					gettext("[Previously saved workspace restored]", domain="R-base"))
			},
			sep = ";")))
		
		ver <- koCmd("sv.version + '\n' + sv.misc.getKomodoVersion()")
		if(length(ver) == 2L) {
			koMsg("Using R interface ", ver[1L], " on Komodo ", ver[2L], sep = "")
			if(.Platform$GUI == "Rgui") 
				utils::setWindowTitle("[connected to Komodo]")
		} else {
			warning(simpleWarning("invalid response received from Komodo", "Ko/R Startup"))
		}
	}

	assign(".First", function() {
			invisible(koCmd("sv.rbrowser.refresh(true)"))
			rm(list = ".First", envir = .GlobalEnv) # self-destruct
		}, .GlobalEnv)
		
	reg.finalizer(as.environment("komodoConnection"),
		function(e) {
			tryCatch({
				koCmd("sv.addNotification(\"R says bye\"); sv.command.setRStatus(false);")
				stopAllServers()
				stopAllConnections()				
			}, error = function(...) NULL)
		}, TRUE)	

})
