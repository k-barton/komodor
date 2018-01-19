
.onAttach <- function(libname, pkgname) {
	setEvalEnv(.GlobalEnv)

	if(is.null(getOption("ko.host"))) options(ko.host = "localhost")
	if(!is.numeric(getOption("ko.port"))) options(ko.port = 6666L)

	init.Rserver()
	
	reg.finalizer(tempEnv(), function(env) {
		..onUnload()
		#cat("reg.finalizer run at", format(Sys.time()), "\n", file="~/kor_log.txt", append = TRUE)
	}, TRUE)
    #cat("kor attached at", format(Sys.time()), "\n", file="~/kor_log.txt", append = TRUE)
}

..onUnload  <- function(libpath) {
	#message("Closing KomodoR ...")
	fnull <- function(...) NULL
	tryCatch(koCmd("kor.ui.addNotification(\"R says bye.\"); kor.command.setRStatus(false);"), error = fnull)
	tryCatch(stopAllServers(), error = fnull)
	tryCatch(stopAllConnections(), error = fnull)
	
	if(existsTemp("oldoptions")) # restore pager and browser (set by startup())
		options(getTemp("oldoptions"))
	#cat("kor unloaded at", format(Sys.time()), "\n", file="~/kor_log.txt", append = TRUE)
}



