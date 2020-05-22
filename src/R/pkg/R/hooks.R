
.onAttach <- function(libname, pkgname) {
	if(is.null(getOption("ko.host"))) options(ko.host = "localhost")
	if(!is.numeric(getOption("ko.port"))) options(ko.port = 6666L)
	if(!is.numeric(getOption("ko.info.level"))) options(ko.info.level = 0L)

	init.Rserver()
	
	reg.finalizer(tempEnv(), function(env) {
		..onUnload()
		#cat("reg.finalizer run at", format(Sys.time()), "\n", file="~/kor_log.txt", append = TRUE)
	}, TRUE)
    #cat("kor attached at", format(Sys.time()), "\n", file="~/kor_log.txt", append = TRUE)
}

..onUnload <- function(libpath) {
	#message("Closing KomodoR ...")
	fnull <- function(...) NULL
	tryCatch(koCmd("kor.ui.addNotification(\"R says bye.\"); kor.command.setRStatus(false);"), error = fnull)
	tryCatch(stopAllServers(), error = fnull)
	tryCatch(stopAllConnections(), error = fnull)
	
	if(existsTemp("oldoptions")) # restore pager and browser (set by startup())
		options(getTemp("oldoptions"))
	#cat("kor unloaded at", format(Sys.time()), "\n", file="~/kor_log.txt", append = TRUE)
	if(exists("setWindowTitle", asNamespace("utils")))
		get("setWindowTitle", asNamespace("utils"))("")	
	
}


.onDetach <- 
function(libpath) {
    ..onUnload(libpath)

    .restore <- function(tempName, name, envir) {
        x <- getTemp(tempName)
        if(!is.null(x)) assignLocked(name, x, envir)
    }
    .restore("__base_readline", "readline", baseenv())
    if("package:utils" %in% search()) {
        if(exists("winProgressBar", "package:utils")) {
            for(env in list(asNamespace("utils"), as.environment("package:utils"))) {
                .restore("__utils_winProgressBar", "winProgressBar", env)
                assignLocked("__utils_setWinProgressBar", "setWinProgressBar", env)
                assignLocked("__utils_getWinProgressBar","getWinProgressBar", env)
            }
        }
    }
}
