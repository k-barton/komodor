#' Startup tasks 
#'
#' This function initializes connection with Komodo and is not intended to be called by the user.
#' @keywords internal
#' @param verbose logical. Should verbose messages be printed?

startup <- 
function (verbose = FALSE) {
	title <- "KomodoR Startup"
	initFileName <- "_init.R"
	vmsg <- if(verbose)	function(...) message(title, ": ", ...)
		else function(...) {}
	msg <- function(...) cat(..., "\n")
	
	cwd0 <- normalizePath(".")
	if(file.exists(initFileName)) {
		vmsg("Executing", initFileName, "...")
		source(initFileName, echo = verbose, encoding = "UTF-8")
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
		vmsg("Loading profile...")
		source(rprofile)
		msg("Profile loaded ", dQuote(rprofile))
	}
	
	if(file.exists(".Rhistory")) {
		vmsg("Loading command history...")
		loadhistory(".Rhistory")
		vmsg("Done.")
	}

	Rservers <- enumServers()
	vmsg("R servers running: ", Rservers)
    if(length(Rservers) > 0L) {
        portstr <- tail(Rservers, 1L)
        options(ko.R.port = as.integer(portstr))
    } else portstr <- NULL
	
	if(is.numeric(getOption("ko.port")) && !is.null(portstr)) {
		
		charSet = utils::localeToCharset()[1L]
		
	    writeLines(text = paste(c(portstr, getOption("ko.port"), charSet)),
			con = file.path(cwd0, "~session"))
	
		hello <- tryCatch(koCmd("'hello'"), error = function(e) {
			stop(simpleError(paste0(strwrap(paste(
				"cannot connect to Komodo. Run",
				sQuote("Troubleshooting->Fix R connection"),
				"from the", sQuote("R Tools"), "toolbox, or",
				"restart Komodo."
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
			sprintf("kor.setRProps(%s, '%s')", portstr, charSet),
			if(!any(c("--vanilla", "--no-restore", "--no-restore-data") %in% commandArgs())
				&& file.exists(".RData")) {
				sprintf("kor.cmdout.append('%s')",
					gettext("[Previously saved workspace restored]", domain = "R-base"))
			},
			sep = ";")))
		
		ver <- koCmd("kor.version + '\\n' + _W.ko.version")
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
		
		oldoptions <- options(browser = koBrowser, pager = koPager,
            askYesNo = koAskYesNo)
		assignTemp("oldoptions", oldoptions)
	}
	#TODO: handle case when no server is started
	
	# if there is ".First" in the workspace to be loaded this one will be overwritten.
	assign(".First", function() {
			invisible(koCmd("kor.fireEvent(\"r_environment_change\")"))
			rm(list = ".First", envir = .GlobalEnv) # self-destruct
		}, .GlobalEnv)

    # evil replacements:
    assignTemp("__base_readline", base::readline)
    assignLocked("readline", koReadLine, baseenv())

    .replaceUtils <- 
    function(...) {
        if(exists("winProgressBar", "package:utils")) {
            assignTemp("__utils_winProgressBar", utils::winProgressBar)
            assignTemp("__utils_setWinProgressBar", utils::setWinProgressBar)
            assignTemp("__utils_getWinProgressBar", utils::getWinProgressBar)
            for(env in list(asNamespace("utils"), as.environment("package:utils"))) {
                assignLocked("winProgressBar", koProgressBar, envir = env)
                assignLocked("setWinProgressBar", setKoProgressBar, envir = env)
                assignLocked("getWinProgressBar", getKoProgressBar, envir = env)
            }
        }
    }
    
    if("package:utils" %in% search()) 
        .replaceUtils() else 
	    setHook(packageEvent("utils", "attach"), .replaceUtils)
  
	vmsg("Done.")
	invisible()
}



