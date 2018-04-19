#' Startup tasks 
#'
#' This function initializes connection with Komodo and is not intended to be called by the user.
#' @keywords internal
#' @param verbose logical. Should verbose messages be printed?

startup <- 
function (verbose = FALSE) {
	title <- "Ko/R Startup"
	initFileName <- "_init.R"
	vmsg <- if(verbose)	function(...) cat(title, ": ", ..., "\n")
		else function(...) {}
	msg <- function(...) cat(..., "\n")
	
	cwd0 <- normalizePath(".")
	if(file.exists(initFileName)) {
		vmsg("Executing", initFileName, "...")
		source(initFileName, echo = verbose)
		vmsg("Done.")
	} else vmsg(initFileName, "not found.")
	msg("cwd is now ", sQuote(getwd()))

	port <- as.integer(getOption("ko.R.port", 1025L))
	port.last <- 65535L
	if(port >= port.last) port <- 1025L
	while((port < port.last) && (as.character(startServer(port)) == "0"))
		port <- port + 1L
	# TODO: wrap port numbers around
	vmsg("Socket server started at port", port)

	## Do we have a .Rprofile file to source?
	cwd <- normalizePath(getwd())
	isBaseDir <- cwd == cwd0 # TODO
	rprofile <- file.path(c(if(!isBaseDir) getwd(), Sys.getenv("R_USER")), ".Rprofile")
	rprofile <- rprofile[file.exists(rprofile)][1L]
	if (!is.na(rprofile)) {
		vmsg("Loading profile ...")
		source(rprofile)
		msg("Loaded profile:", rprofile)
	}
	
	if(file.exists(".Rhistory")) {
		vmsg("Loading command history ...")
		loadhistory(".Rhistory")
		vmsg("Done.")
	}

	Rservers <- enumServers()
	vmsg("R servers running: ", Rservers)
    if(length(Rservers) > 0L) {
        portstr <- tail(Rservers, 1L)
        options(ko.R.port = as.integer(portstr))
        writeLines(text = portstr, con = file.path(cwd0, "~port")) # for rconnect.py
    } else portstr <- NULL
	
	if(is.numeric(getOption("ko.port")) && !is.null(portstr)) {
	    writeLines(text = paste(portstr, getOption("ko.port")), con = file.path(cwd0, "~ports"))
	
		hello <- tryCatch(koCmd("'hello'"), error = function(e) {
			stop(simpleError(paste0(strwrap(paste(
				"cannot connect to Komodo. Try restarting the application (or KomodoR socket server)."
				#"This problem may also be caused by a previous R",
				#"session that was improperly closed. Quit R, kill any running",
				#"ghost R processes, then start R again."
				), 
				prefix = "  ", initial = ""), 
				collapse = "\n"), title))
		})
		if(!identical(hello, "hello")) {
			warning(simpleWarning("invalid response received from Komodo", title))
			vmsg("Expected \"hello\", got", deparse(hello, control = NULL))
		}

		invisible(koCmd(paste(
			"kor.cmdout.clear()",
			sprintf("kor.cmdout.append('%s is started')", R.version.string),
			"kor.command.setRStatus(true)",
			# "kor.rbrowser.refresh(true)", # not before workspace is loaded
			sprintf("kor.prefs.setPref('RInterface.RPort', %s)", portstr),
			if(!any(c("--vanilla", "--no-restore", "--no-restore-data") %in% commandArgs())
				&& file.exists(".RData")) {
				sprintf("kor.cmdout.append('%s')",
					gettext("[Previously saved workspace restored]", domain = "R-base"))
			},
			sep = ";")))
		
		ver <- koCmd("kor.version + '\n' + _W.ko.version")
		if(length(ver) == 2L) {
			msg("Using R interface ", ver[1L], " on Komodo ", ver[2L], sep = "")
			#if(.Platform$GUI == "Rgui") {
			if(exists("setWindowTitle", asNamespace("utils")))
				get("setWindowTitle", asNamespace("utils"))("[connected to Komodo]")	
			#}
		} else {
			warning(simpleWarning("invalid response received from Komodo", title))
			vmsg("Expected \"kor.version\\nko.version\", got", deparse(ver, control = NULL))
		}
		
		oldoptions <- options(browser = koBrowser, pager = koPager)
		assignTemp("oldoptions", oldoptions)
	}
	#TODO: handle case when no server is started
	
	# if there is ".First" in the workspace to be loaded this one will be overwritten.
	assign(".First", function() {
			invisible(koCmd("kor.fireEvent(\"r-environment-change\")"))
			rm(list = ".First", envir = .GlobalEnv) # self-destruct
		}, .GlobalEnv)
	
	vmsg("Done.")
	invisible()
}
